import {
  ModuleInstance,
  ValidationIssue,
  UnitLength,
  DesignProject,
  ShelfConfig,
} from "./types";
import {
  computeContinuousKitchenLayers,
  evaluateSlidingDoorDeadZones,
} from "./parametric-spec-engine";

/**
 * Eliminates IEEE-754 floating-point drift (e.g. 0.1 + 0.2 = 0.30000000000000004)
 * while preserving sub-millimeter precision (default 0.01 mm).
 */
export function roundMm(value: number, decimals = 2): number {
  if (!Number.isFinite(value)) return 0;
  const factor = Math.pow(10, decimals);
  return Math.round((value + Number.EPSILON) * factor) / factor;
}

/**
 * Rounds to integer millimeters safely, clamping NaN/Infinity to fallback.
 */
export function roundIntMm(value: number, fallback = 0): number {
  if (!Number.isFinite(value)) return fallback;
  return Math.round(value);
}

/**
 * Canonical check whether a module uses floor-standing side uprights (y = 0..height)
 * with plinth recessed between the side panels (wardrobe construction) vs. carcass sitting
 * on top of adjustable legs/plinth (kitchen base/tall construction).
 */
export function isWardrobeModule(module: ModuleInstance): boolean {
  return (
    !module.category ||
    module.category.startsWith("wardrobe") ||
    module.category === "special_corner" ||
    module.moduleFamilyId === "fam_wardrobe" ||
    module.moduleFamilyId === "fam_special_corner" ||
    Boolean(module.templateId?.startsWith("tpl_wd_")) ||
    Boolean(module.templateId?.startsWith("tpl_wardrobe")) ||
    Boolean(module.templateId?.startsWith("tpl_sc_")) ||
    (Boolean(module.isCorner) && module.dimensions.height >= 1400)
  );
}

/**
 * Computes the maximum structurally valid bay count for a given outer width and panel thickness
 * so individual bays never collapse below minClearBayWidthMm (default 140mm).
 */
export function getMaxSafeBayCount(
  outerWidthMm: UnitLength,
  panelThicknessMm = 18,
  minClearBayWidthMm = 140
): number {
  const safeW = Math.max(150, outerWidthMm);
  const safeT = Math.max(12, panelThicknessMm);
  const maxBays = Math.floor((safeW - safeT) / (minClearBayWidthMm + safeT));
  return Math.max(1, Math.min(8, maxBays));
}

export interface SystemRulesConfig {
  minCarcassWidth: UnitLength;
  maxCarcassWidth: UnitLength;
  minCarcassHeight: UnitLength;
  maxCarcassHeight: UnitLength;
  minCarcassDepth: UnitLength;
  maxCarcassDepth: UnitLength;
  maxShelfSpanWithoutSupport: UnitLength; // 900mm for 18mm movable shelves (ISO 7170 / MD Spec #16)
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
  maxShelfSpanWithoutSupport: 900,
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
    origin: {
      x: roundMm(module.position.x - minX),
      y: roundMm(module.position.y),
      z: roundMm(module.position.z - minZ),
    },
    width: roundMm(Math.max(...corners.map((p) => p.x)) - minX),
    depth: roundMm(Math.max(...corners.map((p) => p.z)) - minZ),
  };
}

/**
 * Computes the 3D AABB of a module's front door/drawer opening sweep zone in room coordinates,
 * including handle protrusion (+32mm) for 90° L/U corner clash checks!
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
    !module.bays.some(
      (b) =>
        (b.door.type !== "open" && b.door.type !== "sliding") || b.drawers.length > 0
    )
  ) {
    return null;
  }
  const place = calculateModulePlacement(module);
  const rotY = (((module.rotation?.y ?? 0) % 360) + 360) % 360;
  const hasProtrudingHandle = module.bays.some(
    (b) =>
      b.door.handleCategory !== "handleless_plain" &&
      b.door.handleCategory !== "gola_profile" &&
      b.door.handleCategory !== "j_pull" &&
      b.door.handleCategory !== "recessed_grip"
  );
  const handleExtra = hasProtrudingHandle ? 30 : 0;
  const sweepDepth =
    Math.min(
      550,
      Math.max(350, Math.round(module.dimensions.width / Math.max(1, module.bays.length)))
    ) + handleExtra;
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

/**
 * Canonical bay clear-width solver.
 * Guarantees exact dimensional closure: sum(bayWidths) + (numBays + 1) * panelThickness === outerWidth
 */
export function calculateBayWidths(module: ModuleInstance): UnitLength[] {
  const width = roundMm(module.dimensions.width);
  const panelThickness = roundMm(module.carcass.panelThickness || 18);
  const numBays = Math.max(1, module.bays.length);

  const totalDividerThickness = (numBays - 1) * panelThickness;
  const totalOuterThickness = 2 * panelThickness;
  const availableInnerWidth = roundMm(width - totalOuterThickness - totalDividerThickness);

  if (availableInnerWidth <= 0) {
    return module.bays.map(() => 0);
  }

  const targetWidth = availableInnerWidth;

  const minPerBay = Math.min(60, Math.floor(targetWidth / numBays));
  const fixedIndices: number[] = [];
  const flexIndices: number[] = [];

  module.bays.forEach((b, idx) => {
    if (typeof b.customWidth === "number" && Number.isFinite(b.customWidth) && b.customWidth > 0) {
      fixedIndices.push(idx);
    } else {
      flexIndices.push(idx);
    }
  });

  const rawFixedSum = fixedIndices.reduce(
    (sum, idx) => sum + Math.max(minPerBay, roundIntMm(module.bays[idx].customWidth || 0)),
    0
  );

  const minFlexReserve = flexIndices.length * minPerBay;
  const maxAllowedFixedSum = Math.max(0, targetWidth - minFlexReserve);

  const result = new Array<number>(numBays).fill(0);

  if (fixedIndices.length === numBays || rawFixedSum >= maxAllowedFixedSum) {
    const weights = module.bays.map((b) =>
      typeof b.customWidth === "number" && b.customWidth > 0
        ? b.customWidth
        : (b.widthRatio && b.widthRatio > 0 ? b.widthRatio : 1) *
          Math.max(minPerBay, targetWidth / numBays)
    );
    const weightSum = weights.reduce((a, b) => a + b, 0) || numBays;
    let allocated = 0;
    for (let i = 0; i < numBays; i++) {
      if (i === numBays - 1) {
        result[i] = Math.max(0, roundIntMm(targetWidth - allocated));
      } else {
        const w = Math.max(minPerBay, Math.floor((targetWidth * weights[i]) / weightSum));
        result[i] = w;
        allocated += w;
      }
    }
    return result;
  }

  let fixedAllocated = 0;
  fixedIndices.forEach((idx) => {
    const fw = Math.max(minPerBay, roundIntMm(module.bays[idx].customWidth || 0));
    result[idx] = fw;
    fixedAllocated += fw;
  });

  const remainingForFlex = Math.max(0, targetWidth - fixedAllocated);
  const flexWeights = flexIndices.map((idx) => {
    const r = module.bays[idx].widthRatio;
    return typeof r === "number" && Number.isFinite(r) && r > 0 ? r : 1;
  });
  const totalFlexWeight = flexWeights.reduce((a, b) => a + b, 0) || flexIndices.length;

  let flexAllocated = 0;
  flexIndices.forEach((bayIdx, fPos) => {
    if (fPos === flexIndices.length - 1) {
      result[bayIdx] = Math.max(0, roundIntMm(remainingForFlex - flexAllocated));
    } else {
      const w = Math.max(
        minPerBay,
        Math.floor((remainingForFlex * flexWeights[fPos]) / totalFlexWeight)
      );
      result[bayIdx] = w;
      flexAllocated += w;
    }
  });

  return result;
}

export function calculateNetInnerHeight(module: ModuleInstance): UnitLength {
  const { height } = module.dimensions;
  const { panelThickness, plinthHeight } = module.carcass;
  return Math.max(0, roundIntMm(height - plinthHeight - 2 * panelThickness));
}

/**
 * Computes usable clear internal depth (MD Spec Section 3.2 & Checklist #2):
 * - Grooved (Kanallı): D_internal = D_carcass - d_offset - t_back
 *   (Default d_offset: 12mm wardrobe -> 12+8=20mm; 18mm kitchen/wall -> 18+8=26mm, so 560mm -> 534mm!)
 * - Rebated (Lambalı): D_internal = D_carcass - t_back
 * - Flush (18mm İçten Tam Kalınlık): D_internal = D_carcass - t_back
 * - Nailed (Arkadan Çakma): D_internal = D_carcass (panel sits behind carcass, D_total = D_carcass + t_back)
 * - None (Arkalıksız / Eviye / Cihaz): D_internal = D_carcass
 */
export function calculateNetInnerDepth(module: ModuleInstance): UnitLength {
  const { depth } = module.dimensions;
  const bpType = module.carcass.backPanelType || "grooved";

  if (bpType === "none" || bpType === "nailed") {
    return Math.max(0, roundIntMm(depth));
  }
  if (bpType === "rebated") {
    const tBack = module.carcass.backPanelThickness || 8;
    return Math.max(0, roundIntMm(depth - tBack));
  }
  if (bpType === "flush") {
    const tBack = module.carcass.backPanelThickness || 18;
    return Math.max(0, roundIntMm(depth - tBack));
  }

  // Grooved back panel: D_internal = D_carcass - d_offset - t_back
  const hasConcealedWallHanger =
    module.category === "kitchen_wall" &&
    module.carcass.wallSuspensionType === "concealed_camar_807";
  const defaultOffset = isWardrobeModule(module) ? 12 : 18;
  const rawOffset = module.carcass.backOffsetMm ?? defaultOffset;
  const dOffset = hasConcealedWallHanger ? Math.max(16, rawOffset) : rawOffset;
  const tBack = module.carcass.backPanelThickness ?? 8;
  return Math.max(0, roundIntMm(depth - dOffset - tBack));
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

  // Sliding door overlap dead-zone clash check (Checklist #6)
  issues.push(...evaluateSlidingDoorDeadZones(module));

  // Sloped ceiling side-hinge validation (MD Spec Section 7.4 & Checklist #21)
  const slope = module.carcass.slopedCeiling;
  if (slope && slope.mode !== "none") {
    module.bays.forEach((bay, bIdx) => {
      if (slope.mode === "left_slope" && (bay.door.type === "single_left")) {
        issues.push({
          severity: "error",
          code: "ERR_SLOPED_DOOR_HINGE_SIDE",
          message: `Sol yan eğimli çatı dolabında Bölme ${bIdx + 1} menteşeleri kısa eğimli kenara konulamaz; sağ (uzun dik) kenara alınmalıdır!`,
          targetId: bay.door.id,
          blockingProduction: true,
        });
      } else if (slope.mode === "right_slope" && (bay.door.type === "single_right")) {
        issues.push({
          severity: "error",
          code: "ERR_SLOPED_DOOR_HINGE_SIDE",
          message: `Sağ yan eğimli çatı dolabında Bölme ${bIdx + 1} menteşeleri kısa eğimli kenara konulamaz; sol (uzun dik) kenara alınmalıdır!`,
          targetId: bay.door.id,
          blockingProduction: true,
        });
      }
    });
  }

  const bayWidths = calculateBayWidths(module);
  const netInnerHeight = calculateNetInnerHeight(module);

  bayWidths.forEach((bayWidth, idx) => {
    if (bayWidth < 120) {
      issues.push({
        severity: "error",
        code: "ERR_BAY_TOO_NARROW",
        message: `Bölme ${idx + 1} net iç genişliği (${bayWidth}mm) çok dar (min 120mm). Bölme sayısını azaltın veya dolap genişliğini artırın.`,
        targetId: `bay_${idx}`,
        blockingProduction: true,
      });
    } else {
      const bayObj = module.bays[idx];
      const hasMovable18mmShelf = bayObj?.shelves?.some(
        (sh) => !sh.isHidden && sh.isAdjustable && (sh.thickness || module.carcass.panelThickness || 18) <= 18
      );
      const effMaxSpan = hasMovable18mmShelf ? rules.maxShelfSpanWithoutSupport : 1200;
      if (bayWidth > effMaxSpan) {
        issues.push({
          severity: "warning",
          code: "WARN_SHELF_SPAN_DEFLECTION",
          message: `Bölme ${idx + 1} genişliği (${bayWidth}mm), ${effMaxSpan}mm sehim sınırını aşıyor; 25mm raf veya orta ara dikme önerilir.`,
          targetId: `bay_${idx}`,
        });
      }
    }

    const bay = module.bays[idx];
    if (bay) {
      // Structural fixed shelf check for tall bodies > 1800mm (MD Spec Section 4.1)
      if (
        height > 1800 &&
        module.category !== "complementary" &&
        !bay.shelves.some((s) => !s.isAdjustable && !s.isHidden) &&
        bay.drawers.length === 0
      ) {
        issues.push({
          severity: "info",
          code: "INFO_TALL_CARCASS_NEEDS_FIXED_SHELF",
          message: `Bölme ${idx + 1}: 1800mm üzeri gövdede yan dikmelerin bel vermemesi için en az 1 adet sabit yapısal raf önerilir.`,
          targetId: `bay_${idx}`,
        });
      }

      // Pantograph width [500, 1150] & height >= 850mm check (MD Spec Section 4.3)
      const hasPantograph =
        bay.hangingRails.some((r) => r.isLiftMechanism && !r.isHidden) ||
        (bay.specialFittings || []).some((f) => f.type === "wardrobe_lift" && !f.isHidden);
      if (hasPantograph && (bayWidth < 500 || bayWidth > 1150 || netInnerHeight < 850)) {
        issues.push({
          severity: "warning",
          code: "WARN_PANTOGRAPH_BOUNDS",
          message: `Bölme ${idx + 1} asansörlü askı (pantograf) için iç genişlik 500–1150mm ve iç yükseklik ≥850mm olmalıdır (Mevcut: ${bayWidth}×${netInnerHeight}mm).`,
          targetId: `bay_${idx}`,
        });
      }

      // Blind corner LeMans / Magic Corner minimum door opening >= 450mm (MD Spec Section 4.4)
      const hasCornerPullout = (bay.specialFittings || []).some(
        (f) =>
          !f.isHidden &&
          (f.type === "corner_lemans" || f.type === "magic_corner" || f.type === "carousel_half_moon")
      );
      if (hasCornerPullout && bayWidth < 450) {
        issues.push({
          severity: "warning",
          code: "WARN_CORNER_MECHANISM_DOOR_OPENING",
          message: `Bölme ${idx + 1} kör köşe mekanizması (LeMans / Sihirli Köşe) için minimum 450mm kapak açıklığı gerekir.`,
          targetId: `bay_${idx}`,
        });
      }

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

        if (drawer.isInternal && bay.door.type !== "open") {
          const isZeroProtrusion =
            bay.door.hardwareProductId === "hw_blum_71b7550" ||
            bay.door.hardwareProductId === "hw_hettich_9099540" ||
            module.carcass.internalDrawerHingeSolution === "spacer_block_25mm";
          const isNearHinge = rules.hingeZonesY.some(
            (hy) => Math.abs(drawer.elevationY - hy) < 50
          );
          if (isNearHinge && !isZeroProtrusion) {
            issues.push({
              severity: "warning",
              code: "WARN_INTERNAL_DRAWER_HINGE_COLLISION",
              message: `Bölme ${idx + 1} iç çekmecesi menteşe gövdesi ile çakışabilir; 25mm besleme çıtası veya 155° sıfır çıkıntılı menteşe seçiniz.`,
              targetId: drawer.id,
            });
          }
        }
      });

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
 * Validates entire project including multi-module collisions, front opening sweeps,
 * lift-door ceiling sweeps, countertop slab seams, and architectural space boundaries.
 */
export function validateProject(project: DesignProject): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  project.modules.forEach((mod) => {
    issues.push(...validateModule(mod));
  });

  const ceiling = project.space.ceilingHeight || 2600;
  const allObstacles = [
    ...(project.space.elements || []),
    ...(project.space.walls || []).flatMap((w) => w.elements || []),
  ];

  // Continuous kitchen countertop seam & island overhang checks (MD Spec Section 7.3 & 8.1)
  const contLayers = computeContinuousKitchenLayers(project);
  contLayers.countertops.forEach((ct) => {
    if (ct.hasSeamCutoutConflict) {
      issues.push({
        severity: "error",
        code: "ERR_COUNTERTOP_SEAM_OVER_CUTOUT",
        message: `Tezgâh ek yeri (${ct.slabMaxLengthMm}mm plaka sınırı) eviye veya ocak boşaltması üzerine denk geliyor!`,
        targetId: ct.moduleIds[0],
        blockingProduction: true,
      });
    }
    if (ct.requiresSupportBrackets) {
      issues.push({
        severity: "warning",
        code: "WARN_ISLAND_OVERHANG_BRACKET",
        message: `Ada/bar tezgâh arka taşması (${ct.rearOverhangMm}mm) 300mm desteksiz sınırı aşıyor; gizli çelik konsol veya bar ayağı zorunludur.`,
        targetId: ct.moduleIds[0],
      });
    }
  });

  const isPlumbingCompatibleModule = (mod: ModuleInstance): boolean => {
    const label = `${mod.id} ${mod.name} ${mod.templateId || ""}`.toLowerCase();
    return (
      label.includes("eviye") ||
      label.includes("evye") ||
      label.includes("sink") ||
      label.includes("snk") ||
      label.includes("ıslak") ||
      label.includes("islak") ||
      label.includes("tesisat") ||
      label.includes("bulaşık") ||
      label.includes("bulasik") ||
      label.includes("dishwasher") ||
      label.includes("dsh")
    );
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

    // Kinematic Upward Lift Door Sweep vs Ceiling / Crown Check (Checklist #14)
    mod.bays.forEach((bay) => {
      const ds = bay.door?.doorSystemId || bay.door?.type || "";
      if (ds === "lift_up_stay" || ds === "lift_parallel" || ds === "lift_bi_fold" || ds === "lift") {
        const doorH = Math.max(200, mod.dimensions.height - (mod.carcass.plinthHeight || 0));
        const upwardRiseMm =
          ds === "lift_parallel"
            ? Math.round(doorH * 0.55)
            : ds === "lift_bi_fold"
            ? Math.round(doorH * 0.22)
            : Math.round(doorH * 0.38);
        if (mod.position.y + mod.dimensions.height + upwardRiseMm > ceiling) {
          issues.push({
            severity: "warning",
            code: "WARN_LIFT_DOOR_CEILING_SWEEP",
            message: `"${mod.name}" kalkar kapak açıldığında üst noktası (${
              mod.position.y + mod.dimensions.height + upwardRiseMm
            }mm) tavana (${ceiling}mm) çarpıyor; 86° açı sınırlayıcı klips kullanılmalıdır!`,
            targetId: mod.id,
          });
        }
      }
    });

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
      const oMaxX =
        obs.position.x +
        (isSideObs ? Math.max(180, obs.dimensions.depth || 150) : obs.dimensions.width);
      const oMinY = obs.position.y;
      const oMaxY = obs.position.y + obs.dimensions.height;
      const rawMinZ = obs.position.z;
      const rawMaxZ =
        obs.position.z + (isSideObs ? obs.dimensions.width : obs.dimensions.depth || 150);
      const oMinZ = Math.min(rawMinZ, 0);
      const oMaxZ = Math.max(
        rawMaxZ,
        obs.type === "door" && !isSideObs ? obs.dimensions.width * 0.85 : 220
      );

      const xHit = mMinX < oMaxX - 1 && mMaxX > oMinX + 1;
      const yHit = mMinY < oMaxY - 1 && mMaxY > oMinY + 1;
      const zHit = mMinZ < oMaxZ - 1 && mMaxZ > oMinZ - 160;

      if (
        obs.type === "column" ||
        obs.type === "beam" ||
        obs.type === "partition" ||
        obs.type === "protrusion" ||
        obs.type === "radiator"
      ) {
        if (xHit && yHit && zHit) {
          issues.push({
            severity: "error",
            code: "ERR_COLUMN_COLLISION",
            message: `Taşıyıcı eleman çakışması: "${mod.name}" ile "${obs.name}" çakışıyor (Kolon/kiriş kertmesi uygulanabilir).`,
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
            message: `Kapak açılım engeli: "${mod.name}" kapağı açılırken "${obs.name}" engeline çarpıyor.`,
            targetId: mod.id,
            blockingProduction: true,
          });
        }
      }

      if (obs.type === "window") {
        const horizHit = isSideObs
          ? mMinZ < rawMaxZ - 5 && mMaxZ > rawMinZ + 5 && mMinX < 250
          : xHit && mMinZ < 350;
        if (horizHit && yHit) {
          const isBaseBlockingSash = mod.category === "kitchen_base" && mMaxY > oMinY;
          issues.push({
            severity: "error",
            code: "ERR_WINDOW_COLLISION",
            message: isBaseBlockingSash
              ? `Tezgâh pencere kanadını bloke ediyor! "${mod.name}" tezgâh üst kotu (${mMaxY}mm), "${obs.name}" parapet kotunu (${oMinY}mm) aşıyor.`
              : `Pencere kesişimi: "${mod.name}" üst kotu (${mMaxY}mm), "${obs.name}" denizlik kotunu (Y:${oMinY}mm) aşarak pencereyi kapatıyor.`,
            targetId: mod.id,
            blockingProduction: true,
          });
        }
      }

      if (obs.type === "door") {
        const doorSwingMaxX = isSideObs ? oMinX + obs.dimensions.width * 0.85 : oMaxX;
        const doorSwingMaxZ = isSideObs
          ? rawMaxZ
          : Math.max(oMaxZ, obs.dimensions.width * 0.85);
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
            message: `Kapı açılım engeli: "${mod.name}" modülü, "${obs.name}" oda kapısının 90° açılış süpürme alanını kapatıyor.`,
            targetId: mod.id,
            blockingProduction: true,
          });
        }
      }

      if (obs.type === "plumbing") {
        const plumbingCenterX = obs.position.x + obs.dimensions.width / 2;
        const isFloorModule = mod.position.y < 500 && mod.category !== "kitchen_wall";
        if (isFloorModule && xHit && mMinZ < 350) {
          if (!isPlumbingCompatibleModule(mod)) {
            issues.push({
              severity: "error",
              code: "ERR_PLUMBING_INCOMPATIBLE_MODULE",
              message: `Tesisat uyumsuzluğu: Su/gider tesisatı (X:${Math.round(
                plumbingCenterX
              )}mm) önüne "${mod.name}" yerleştirildi. Eviye veya bulaşık makinesi modülü gereklidir.`,
              targetId: mod.id,
              blockingProduction: true,
            });
          }
        }
      }
    });
  });

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
          message: `Açıkta tesisat: X:${pCenterX}mm noktasındaki tesisat önünde henüz eviye alt modülü bulunmuyor.`,
          targetId: plumb.id,
        });
      }
    });

  for (let i = 0; i < project.modules.length; i++) {
    for (let j = i + 1; j < project.modules.length; j++) {
      const m1 = project.modules[i];
      const m2 = project.modules[j];
      if (m1.category === "complementary" || m2.category === "complementary") continue;

      const a = calculateModulePlacement(m1),
        b = calculateModulePlacement(m2);
      const xOverlap =
        m1.position.x < m2.position.x + b.width - 0.001 &&
        m1.position.x + a.width > m2.position.x + 0.001;
      const yOverlap =
        m1.position.y < m2.position.y + m2.dimensions.height &&
        m1.position.y + m1.dimensions.height > m2.position.y;
      const zOverlap =
        m1.position.z < m2.position.z + b.depth - 0.001 &&
        m1.position.z + a.depth > m2.position.z + 0.001;

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
          message: `"${m1.name}" ve "${m2.name}" kapak/kulp/çekmece açılım hacimleri çakışıyor; 90° L-köşe dolgu çıtası (min 50mm) önerilir.`,
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
 * with long-term wood composite creep factor and ISO 7170 L/300 limit.
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
      : 3200;

  const creepFactor =
    materialCategory === "melamine" || materialCategory === "lacquer"
      ? 1.25
      : materialCategory === "wood"
      ? 1.15
      : 1.0;

  const uniformLoadKg = roundMm((loadKgPerMeter * L) / 1000, 2);
  const totalForceN = uniformLoadKg * 9.80665;
  const momentOfInertiaMm4 = (b * Math.pow(t, 3)) / 12;

  const rawDeflectionMm =
    creepFactor *
    ((5 * totalForceN * Math.pow(L, 3)) / (384 * elasticModulusMpa * momentOfInertiaMm4));
  const deflectionMm = roundMm(rawDeflectionMm, 2);
  const maxAllowedDeflectionMm = roundMm(L / 300, 2);
  const maxSafeSpanForThickness = t <= 18 ? 900 : 1150;
  const passed = deflectionMm <= maxAllowedDeflectionMm && L <= maxSafeSpanForThickness;
  const safetyRatio = roundMm(maxAllowedDeflectionMm / Math.max(0.01, deflectionMm), 2);

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
 * One-click intelligent engineering auto-fix for store customers, architects, and factory engineers.
 */
export function autoFixModuleIssues(module: ModuleInstance): AutoFixModuleResult {
  const nextMod: ModuleInstance = JSON.parse(JSON.stringify(module));
  const appliedFixes: string[] = [];

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
      appliedFixes.push(`Ankastre arka havalandırma (min 50mm baca) için derinlik ${minD}mm yapıldı.`);
    }
  }

  if (nextMod.carcass.panelThickness < 16) {
    nextMod.carcass.panelThickness = 18;
    appliedFixes.push("Gövde panel kalınlığı System 32 standardı için 18mm yapıldı.");
  }

  const maxSafeBays = getMaxSafeBayCount(
    nextMod.dimensions.width,
    nextMod.carcass.panelThickness,
    140
  );
  if (nextMod.bays.length > maxSafeBays) {
    nextMod.bays = nextMod.bays.slice(0, maxSafeBays).map((b, idx) => ({ ...b, index: idx }));
    appliedFixes.push(
      `Dar gövde genişliğine uyum için bölme sayısı ${maxSafeBays} adede düşürüldü.`
    );
  }

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
    // Fix sliding door dead-zone clashes by equalizing custom widths or moving pullouts
    const deadZoneIssues = evaluateSlidingDoorDeadZones(nextMod);
    if (deadZoneIssues.length > 0) {
      nextMod.bays.forEach((b) => {
        b.customWidth = undefined;
      });
      appliedFixes.push("Sürgü kapak ölü bölge çekmece çakışmasını önlemek için bölmeler eşitlendi.");
    }
  }

  // Fix sloped ceiling hinge orientation (Checklist #21)
  if (nextMod.carcass.slopedCeiling?.mode === "left_slope") {
    nextMod.bays.forEach((b) => {
      if (b.door.type === "single_left") {
        b.door.type = "single_right";
        appliedFixes.push("Sol eğimli tavan kapağı menteşeleri uzun dik (sağ) kenara alındı.");
      }
    });
  } else if (nextMod.carcass.slopedCeiling?.mode === "right_slope") {
    nextMod.bays.forEach((b) => {
      if (b.door.type === "single_right") {
        b.door.type = "single_left";
        appliedFixes.push("Sağ eğimli tavan kapağı menteşeleri uzun dik (sol) kenara alındı.");
      }
    });
  }

  let bayWidths = calculateBayWidths(nextMod);
  const expectedInnerW =
    nextMod.dimensions.width - (nextMod.bays.length + 1) * nextMod.carcass.panelThickness;
  const currentSumW = bayWidths.reduce((a, b) => a + b, 0);
  if (Math.abs(currentSumW - expectedInnerW) > 1 && !nextMod.bays.some((b) => b.door.doorSystemId === "pocket_retractable")) {
    nextMod.bays.forEach((b) => {
      b.customWidth = undefined;
    });
    bayWidths = calculateBayWidths(nextMod);
    appliedFixes.push("Bölme iç genişlikleri dış gövde ölçüsüne göre dengelendi.");
  }

  const hasWideSpan = bayWidths.some((bw) => bw > 900);
  if (hasWideSpan && nextMod.bays.length < 6) {
    const idealBays = Math.min(6, Math.max(2, Math.ceil(nextMod.dimensions.width / 800)));
    while (nextMod.bays.length < idealBays) {
      const templateBay = JSON.parse(
        JSON.stringify(nextMod.bays[nextMod.bays.length - 1])
      ) as ModuleInstance["bays"][number];
      const newIdx = nextMod.bays.length;
      templateBay.index = newIdx;
      templateBay.customWidth = undefined;
      templateBay.door.id = `door_${nextMod.id}_${newIdx}_${Date.now()}`;
      templateBay.shelves = templateBay.shelves.map((s: ShelfConfig, si: number) => ({
        ...s,
        bayIndex: newIdx,
        id: `shelf_${nextMod.id}_${newIdx}_${si}`,
      }));
      templateBay.drawers = [];
      nextMod.bays.push(templateBay);
    }
    nextMod.bays.forEach((b) => {
      b.customWidth = undefined;
    });
    bayWidths = calculateBayWidths(nextMod);
    appliedFixes.push(`Raf sehimini (>900mm) önlemek için modül ${nextMod.bays.length} eşit bölmeye ayrıldı.`);
  }

  const netInnerH = calculateNetInnerHeight(nextMod);
  const netInnerD = calculateNetInnerDepth(nextMod);
  nextMod.bays.forEach((bay, bIdx) => {
    const bw = bayWidths[bIdx] || 600;
    if (
      (bay.door.doorSystemId === "hinged_single" ||
        bay.door.type === "single_left" ||
        bay.door.type === "single_right") &&
      bw > 600
    ) {
      bay.door.doorSystemId = "hinged_double";
      bay.door.type = "double";
      appliedFixes.push(
        `Bölme ${bIdx + 1} geniş kapağı (>600mm) sarkmayı önlemek için çift kapağa dönüştürüldü.`
      );
    }

    // Internal drawer behind hinged door -> auto upgrade to Blum 155° Zero-Protrusion Hinge (Checklist #5)
    if (
      bay.drawers.some((d) => d.isInternal) &&
      bay.door.type !== "open" &&
      bay.door.hardwareProductId !== "hw_blum_71b7550" &&
      bay.door.hardwareProductId !== "hw_hettich_9099540" &&
      nextMod.carcass.internalDrawerHingeSolution !== "spacer_block_25mm"
    ) {
      bay.door.hardwareProductId = "hw_blum_71b7550";
      appliedFixes.push(
        `Bölme ${bIdx + 1}: İç çekmece çakışmasını önlemek için menteşe 155° Sıfır Çıkıntılı (Blum 71B7550) yapıldı.`
      );
    }

    if (
      bay.door.handleCategory === "gola_profile" &&
      (bay.door.overlayType === "inset" || bay.door.doorSystemId === "hinged_inset")
    ) {
      bay.door.overlayType = "full_overlay";
      if (bay.door.doorSystemId === "hinged_inset") {
        bay.door.doorSystemId = bw > 600 ? "hinged_double" : "hinged_single";
        bay.door.type = bw > 600 ? "double" : "single_left";
      }
      appliedFixes.push(
        `Bölme ${bIdx + 1}: Gola profil için kapak bini tipi Tam Bini (full_overlay) yapıldı.`
      );
    }

    if (
      bay.door.handleCategory === "handleless_plain" &&
      bay.door.openingTechnology !== "push_to_open" &&
      bay.door.openingTechnology !== "push_to_open_soft_close" &&
      bay.door.openingTechnology !== "servo_electric"
    ) {
      bay.door.openingTechnology = "push_to_open_soft_close";
      bay.door.handleType = "push_to_open";
      appliedFixes.push(
        `Bölme ${bIdx + 1}: Kulpsuz düz kapak için Bas-Aç + Frenli (TIP-ON BLUMOTION) mekanizma aktif edildi.`
      );
    }

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
      appliedFixes.push(
        `Bölme ${bIdx + 1}: J-Pull kulp için 22mm MDF İpek Mat Lake kapak standardı uygulandı.`
      );
    }

    bay.shelves.forEach((s) => {
      s.elevationY = roundIntMm(s.elevationY);
      if (s.elevationY > netInnerH - 40) {
        s.elevationY = Math.max(60, netInnerH - 120);
        appliedFixes.push(`Bölme ${bIdx + 1}: Üst sınırı aşan raf yüksekliği iç hacme çekildi.`);
      }
    });
    bay.drawers.forEach((d) => {
      d.elevationY = roundIntMm(d.elevationY);
      d.height = roundIntMm(d.height);
      if (d.nominalLengthMm && d.nominalLengthMm + 10 > netInnerD) {
        d.nominalLengthMm = Math.max(250, Math.floor((netInnerD - 10) / 50) * 50);
        appliedFixes.push(
          `Bölme ${bIdx + 1}: Çekmece ray boyu kanallı arkalık net iç derinliğine (${d.nominalLengthMm}mm) uyarlandı.`
        );
      }
    });
  });

  return { updatedModule: nextMod, appliedFixes };
}
