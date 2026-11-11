// Auto-generated ESM bundle from TypeScript sources for Node test verification



export const DOOR_MECHANISM_SPECS = {
  hinged_single: {
    systemId: "hinged_single",
    label: "Tek Kanat Menteşeli (Blum Clip Top 110°)",
    isVerified: true,
    kinematicType: "hinged_pivot",
    maxAngleDeg: 110,
    leafCountPerBay: 1,
    trackOffsetZMm: 0,
    requiresTopClearanceMm: 0,
  },
  hinged_double: {
    systemId: "hinged_double",
    label: "Çift Kanat Menteşeli (Blum Clip Top 110°)",
    isVerified: true,
    kinematicType: "hinged_pivot",
    maxAngleDeg: 110,
    leafCountPerBay: 2,
    trackOffsetZMm: 0,
    requiresTopClearanceMm: 0,
  },
  hinged_inset: {
    systemId: "hinged_inset",
    label: "İçerlek (Inset) Menteşeli Kapak",
    isVerified: true,
    kinematicType: "hinged_pivot",
    maxAngleDeg: 110,
    leafCountPerBay: 1,
    trackOffsetZMm: -18,
    requiresTopClearanceMm: 0,
  },
  hinged_overlay_variant: {
    systemId: "hinged_overlay_variant",
    label: "Yarım Binili (Half-Overlay) Menteşeli Kapak",
    isVerified: true,
    kinematicType: "hinged_pivot",
    maxAngleDeg: 110,
    leafCountPerBay: 1,
    trackOffsetZMm: 0,
    requiresTopClearanceMm: 0,
  },
  sliding_top_hung: {
    systemId: "sliding_top_hung",
    label: "Üstten Askılı Sürgülü Sistem (Çift Ray)",
    isVerified: true,
    kinematicType: "sliding_track",
    maxAngleDeg: 0,
    leafCountPerBay: 2,
    trackOffsetZMm: 22,
    requiresTopClearanceMm: 0,
  },
  sliding_bottom_rolling: {
    systemId: "sliding_bottom_rolling",
    label: "Alttan Taşıyıcılı Sürgülü Sistem",
    isVerified: true,
    kinematicType: "sliding_track",
    maxAngleDeg: 0,
    leafCountPerBay: 2,
    trackOffsetZMm: 20,
    requiresTopClearanceMm: 0,
  },
  folding_side: {
    systemId: "folding_side",
    label: "Katlanır (Bi-Fold) Kapak Mekanizması (WingLine)",
    isVerified: true,
    kinematicType: "bi_fold",
    maxAngleDeg: 90,
    leafCountPerBay: 2,
    trackOffsetZMm: 0,
    requiresTopClearanceMm: 0,
  },
  lift_up_stay: {
    systemId: "lift_up_stay",
    label: "Tek Parça Kalkar Kapak (Blum Aventos HK-S / HK top)",
    isVerified: true,
    kinematicType: "lift_stay",
    maxAngleDeg: 107,
    leafCountPerBay: 1,
    trackOffsetZMm: 0,
    requiresTopClearanceMm: 120,
  },
  lift_parallel: {
    systemId: "lift_parallel",
    label: "Paralel Kalkar Kapak (Blum Aventos HL)",
    isVerified: true,
    kinematicType: "lift_parallel",
    maxAngleDeg: 0,
    leafCountPerBay: 1,
    trackOffsetZMm: 180,
    requiresTopClearanceMm: 350,
  },
  lift_bi_fold: {
    systemId: "lift_bi_fold",
    label: "Katlanır Kalkar Kapak (Blum Aventos HF)",
    isVerified: true,
    kinematicType: "lift_bifold",
    maxAngleDeg: 95,
    leafCountPerBay: 2,
    trackOffsetZMm: 0,
    requiresTopClearanceMm: 180,
  },
  pocket_retractable: {
    systemId: "pocket_retractable",
    label: "Gövde İçi Gizlenir (Pocket) Kapak Sistemi",
    isVerified: false,
    kinematicType: "unverified",
    maxAngleDeg: 0,
    leafCountPerBay: 1,
    trackOffsetZMm: 0,
    requiresTopClearanceMm: 0,
    reasonIfUnverified:
      "Pocket (gövde içi gizlenir) mekanizmanın iç yan panel cep boşluğu ve CNC delik şablonu henüz üretim onayı almamıştır (NOT VERIFIED).",
  },
  tambour_roller: {
    systemId: "tambour_roller",
    label: "Panjur (Tambour) Kapak Sistemi",
    isVerified: false,
    kinematicType: "unverified",
    maxAngleDeg: 0,
    leafCountPerBay: 1,
    trackOffsetZMm: 0,
    requiresTopClearanceMm: 0,
    reasonIfUnverified:
      "Tambour (panjur) salyangoz kanal profili ve lamel sarım hacmi henüz CNC üretim onayı almamıştır (NOT VERIFIED).",
  },
  open: {
    systemId: "open",
    label: "Kapaksız Açık Modül",
    isVerified: true,
    kinematicType: "open_none",
    maxAngleDeg: 0,
    leafCountPerBay: 1,
    trackOffsetZMm: 0,
    requiresTopClearanceMm: 0,
  },
};

export function inferDoorSystemIdFromType(type) {
  switch (type) {
    case "left":
    case "single_left":
    case "right":
    case "single_right":
      return "hinged_single";
    case "double":
      return "hinged_double";
    case "inset_left":
    case "inset_right":
    case "inset_double":
      return "hinged_inset";
    case "half_overlay_left":
    case "half_overlay_right":
      return "hinged_overlay_variant";
    case "sliding":
      return "sliding_top_hung";
    case "sliding_bottom":
      return "sliding_bottom_rolling";
    case "folding":
      return "folding_side";
    case "lift":
    case "lift_up_stay":
      return "lift_up_stay";
    case "lift_parallel":
      return "lift_parallel";
    case "lift_bi_fold":
      return "lift_bi_fold";
    case "pocket":
      return "pocket_retractable";
    case "tambour":
      return "tambour_roller";
    default:
      return "open";
  }
}

/**
 * FAZ A: Exact Dimension-Chain Closure for Bay Widths
 * Guarantees sum(bayWidths) + (bayCount + 1) * T === module.dimensions.width
 * with zero floating-point drift. Supports locked customWidthMm per bay.
 */
export function calculateBayWidths(module) {
  const T = module.carcass.panelThickness;
  const bayCount = Math.max(1, module.bays.length || module.carcass.verticalDividerCount + 1);
  const totalDividerAndSideThickness = (bayCount + 1) * T;
  const totalAvailableInnerWidth = Math.max(bayCount * 100, module.dimensions.width - totalDividerAndSideThickness);

  let lockedSum = 0;
  let unlockedIndices = [];

  for (let i = 0; i < bayCount; i++) {
    const bay = module.bays[i];
    if (bay && typeof bay.customWidthMm === "number" && bay.customWidthMm >= 100) {
      lockedSum += bay.customWidthMm;
    } else {
      unlockedIndices.push(i);
    }
  }

  // Auto-fix if locked bays exceed total available inner width
  if (lockedSum > totalAvailableInnerWidth - unlockedIndices.length * 100) {
    unlockedIndices = Array.from({ length: bayCount }, (_, idx) => idx);
    lockedSum = 0;
  }

  const remainingWidth = totalAvailableInnerWidth - lockedSum;
  const widths = new Array(bayCount).fill(0);

  if (unlockedIndices.length > 0) {
    const baseUnlockedW = Math.floor((remainingWidth / unlockedIndices.length) * 100) / 100;
    let distributed = 0;
    unlockedIndices.forEach((idx, pos) => {
      if (pos === unlockedIndices.length - 1) {
        widths[idx] = Number((remainingWidth - distributed).toFixed(2));
      } else {
        widths[idx] = baseUnlockedW;
        distributed += baseUnlockedW;
      }
    });
  }

  for (let i = 0; i < bayCount; i++) {
    const bay = module.bays[i];
    if (bay && typeof bay.customWidthMm === "number" && bay.customWidthMm >= 100 && lockedSum > 0) {
      widths[i] = bay.customWidthMm;
    }
  }

  // Final closure guarantee on last bay
  const currentSum = widths.reduce((a, b) => a + b, 0);
  const drift = Number((totalAvailableInnerWidth - currentSum).toFixed(2));
  if (Math.abs(drift) > 0 && widths.length > 0) {
    widths[widths.length - 1] = Number((widths[widths.length - 1] + drift).toFixed(2));
  }

  return widths;
}

export function calculateNetInnerHeight(module) {
  const T = module.carcass.panelThickness;
  const plinth = Math.max(0, module.carcass.plinthHeight || 0);
  return Math.max(100, module.dimensions.height - plinth - 2 * T);
}

export function calculateNetInnerDepth(module) {
  const T_back = module.carcass.backPanelThickness || 8;
  const mountType = module.carcass.backMountType || "grooved";
  const grooveOffset =
    mountType === "grooved"
      ? (module.carcass.backGrooveOffsetMm ?? 18)
      : 0;
  return Math.max(100, module.dimensions.depth - grooveOffset - T_back);
}

/**
 * Calculates grooved back panel engagement depth into side/top/bottom panels:
 * e_g = min(8mm, 0.5 * T)
 */
export function calculateBackPanelEngagementMm(panelThickness, mountType = "grooved") {
  if (mountType === "applied") return 0;
  return Math.min(8, Math.floor(panelThickness * 0.5));
}

/**
 * Euler-Bernoulli Shelf Deflection Check (inspired by Cabineteer / OpenCabinet I7 rule)
 * Returns deflection in mm under uniform load (default 40 kg/m = 0.392 N/mm)
 */
export function calculateShelfDeflectionMm(spanMm, depthMm, thicknessMm, elasticModulusMpa = 2500, uniformLoadNPerMm = 0.392) {
  const I = (depthMm * Math.pow(thicknessMm, 3)) / 12; // mm^4
  const deflectionMm =
    I > 0 ? (5 * uniformLoadNPerMm * Math.pow(spanMm, 4)) / (384 * elasticModulusMpa * I) : 0;
  const limitMm = spanMm / 300; // Industry standard L/300 sag limit
  return {
    deflectionMm: Number(deflectionMm.toFixed(3)),
    limitMm: Number(limitMm.toFixed(3)),
    exceedsLimit: deflectionMm > limitMm || spanMm > 900,
  };
}




const SHELF_FRONT_SETBACK_MM = 2; // 2mm front setback for adjustable shelves (Cabinet Studio standard)
const DRAWER_REAR_CLEARANCE_MM = 20; // 20mm rear clearance from back panel inside face
const UNDERMOUNT_RUNNER_GAP_MM = 10; // 10mm per side for undermount runner clearance

export function generateModuleGeometry(module, options = {}) {
  const { doorOpenAngleDeg = 0, drawerOpenMm = 0, explodedFactor = 0 } = options;
  const { width, height, depth } = module.dimensions;
  const {
    panelThickness: T,
    backPanelThickness: T_back,
    plinthHeight,
    bodyMaterialId,
    doorMaterialId,
    doorPerimeterGap,
  } = module.carcass;
  const mountType = module.carcass.backMountType || "grooved";
  const backGrooveOffset =
    mountType === "grooved" ? (module.carcass.backGrooveOffsetMm ?? 18) : 0;
  const backEngagement = calculateBackPanelEngagementMm(T, mountType);

  const warnings = [];

  if (module.category === "complementary" && module.complementaryRole) {
    const compRole =
      module.complementaryRole === "countertop" || module.complementaryRole === "waterfall_edge"
        ? "countertop"
        : module.complementaryRole === "plinth_strip" || module.complementaryRole === "skirting"
        ? "plinth"
        : "carcass_side_left";
    return {
      moduleId: module.id,
      overall: module.dimensions,
      components: [
        {
          id: `${module.id}_comp_main`,
          partCode: "A",
          role: compRole,
          label: module.name,
          dimensions: { width, height, depth },
          cutDimensions: {
            finishedLengthMm: Math.max(width, depth),
            finishedWidthMm: Math.min(width, depth),
            thicknessMm: height <= 40 ? height : T,
            grain: "horizontal",
          },
          position: { x: 0, y: 0, z: 0 },
          materialId: bodyMaterialId,
          isFrontFacing: true,
          isPanelCutPiece: true,
        },
      ],
      bayWidths: [width],
      netInnerHeight: height,
      netInnerDepth: depth,
      warnings,
    };
  }

  const components = [];
  const bayWidths = calculateBayWidths(module);
  const netInnerH = calculateNetInnerHeight(module);
  const netInnerD = calculateNetInnerDepth(module);

  const explodeX = explodedFactor * 80;
  const explodeY = explodedFactor * 80;
  const explodeZ = explodedFactor * 80;

  // --- 1. Left Side Panel (Full height to floor) ---
  components.push({
    id: `${module.id}_side_left`,
    partCode: "A1",
    role: "carcass_side_left",
    label: "Sol Yan Panel",
    dimensions: { width: T, height, depth },
    cutDimensions: {
      finishedLengthMm: height,
      finishedWidthMm: depth,
      thicknessMm: T,
      grain: "vertical",
    },
    position: { x: -explodeX, y: 0, z: 0 },
    materialId: bodyMaterialId,
    isPanelCutPiece: true,
  });

  // --- 2. Right Side Panel (Full height to floor) ---
  components.push({
    id: `${module.id}_side_right`,
    partCode: "A2",
    role: "carcass_side_right",
    label: "Sağ Yan Panel",
    dimensions: { width: T, height, depth },
    cutDimensions: {
      finishedLengthMm: height,
      finishedWidthMm: depth,
      thicknessMm: T,
      grain: "vertical",
    },
    position: { x: width - T + explodeX, y: 0, z: 0 },
    materialId: bodyMaterialId,
    isPanelCutPiece: true,
  });

  // --- 3. Bottom Panel (Taban Tablası - inset between side panels above plinth) ---
  const horizPanelW = width - 2 * T;
  components.push({
    id: `${module.id}_bottom`,
    partCode: "B1",
    role: "carcass_bottom",
    label: "Alt Tabla",
    dimensions: { width: horizPanelW, height: T, depth },
    cutDimensions: {
      finishedLengthMm: horizPanelW,
      finishedWidthMm: depth,
      thicknessMm: T,
      grain: "horizontal",
    },
    position: { x: T, y: plinthHeight - explodeY, z: 0 },
    materialId: bodyMaterialId,
    isPanelCutPiece: true,
  });

  // --- 4. Top Panel (Üst Tabla - inset between side panels) ---
  components.push({
    id: `${module.id}_top`,
    partCode: "B2",
    role: "carcass_top",
    label: "Üst Tabla",
    dimensions: { width: horizPanelW, height: T, depth },
    cutDimensions: {
      finishedLengthMm: horizPanelW,
      finishedWidthMm: depth,
      thicknessMm: T,
      grain: "horizontal",
    },
    position: { x: T, y: height - T + explodeY, z: 0 },
    materialId: bodyMaterialId,
    isPanelCutPiece: true,
  });

  // --- 5. Back Panel (Arkalık - with grooved engagement e_g = min(8mm, 0.5*T)) ---
  const backW = horizPanelW + 2 * backEngagement;
  const backH = netInnerH + 2 * backEngagement;
  components.push({
    id: `${module.id}_back`,
    partCode: "C",
    role: "carcass_back",
    label: "Arkalık Paneli",
    dimensions: { width: backW, height: backH, depth: T_back },
    cutDimensions: {
      finishedLengthMm: Math.max(backW, backH),
      finishedWidthMm: Math.min(backW, backH),
      thicknessMm: T_back,
      grain: "vertical",
    },
    position: {
      x: T - backEngagement,
      y: plinthHeight + T - backEngagement,
      z: backGrooveOffset - explodeZ,
    },
    materialId: bodyMaterialId,
    isPanelCutPiece: true,
  });

  // --- 6. Plinth (Baza Klapası) ---
  if (plinthHeight > 0) {
    components.push({
      id: `${module.id}_plinth`,
      partCode: "D",
      role: "plinth",
      label: "Ön Baza Klapası",
      dimensions: { width: horizPanelW, height: plinthHeight, depth: T },
      cutDimensions: {
        finishedLengthMm: horizPanelW,
        finishedWidthMm: plinthHeight,
        thicknessMm: T,
        grain: "horizontal",
      },
      position: { x: T, y: -explodeY, z: depth - T - 20 },
      materialId: bodyMaterialId,
      isPanelCutPiece: true,
    });
  }

  // --- 7. Vertical Dividers (Ara Dikmeler) ---
  let currentX = T;
  const dividerCount = Math.max(0, bayWidths.length - 1);
  for (let i = 0; i < dividerCount; i++) {
    currentX += bayWidths[i];
    components.push({
      id: `${module.id}_divider_${i + 1}`,
      partCode: `E${i + 1}`,
      role: "carcass_divider",
      label: `Ara Dikme ${i + 1}`,
      dimensions: { width: T, height: netInnerH, depth: netInnerD },
      cutDimensions: {
        finishedLengthMm: netInnerH,
        finishedWidthMm: netInnerD,
        thicknessMm: T,
        grain: "vertical",
      },
      position: { x: currentX, y: plinthHeight + T, z: backGrooveOffset + T_back },
      materialId: bodyMaterialId,
      isPanelCutPiece: true,
    });
    currentX += T;
  }

  // --- 8. Internal Elements & Fronts per Bay (FAZ A, B, C) ---
  let bayStartX = T;
  module.bays.forEach((bay, bayIdx) => {
    const bayW = bayWidths[bayIdx] ?? bayWidths[0];
    const innerZ0 = backGrooveOffset + T_back;
    const innerY0 = plinthHeight + T;

    // Calculate drawer stack height first so shelves & doors know the remaining upper opening
    const drawerCount = bay.drawers.length;
    let totalDrawerZoneHeightMm = 0;
    const resolvedDrawerHeights = [];

    if (drawerCount > 0) {
      // Determine if drawers occupy full bay or bottom stack
      const hasUpperElements =
        bay.shelves.length > 0 ||
        bay.hangingRails.length > 0 ||
        (bay.doors && bay.doors.type !== "none" && bay.doors.type !== "open");

      const defaultTargetZoneH = hasUpperElements
        ? Math.min(netInnerH * 0.45, drawerCount * 200)
        : netInnerH;

      let lockedDrawerSum = 0;
      let unlockedCount = 0;
      bay.drawers.forEach((drw) => {
        if (typeof drw.heightMm === "number" && drw.heightMm >= 80) {
          lockedDrawerSum += drw.heightMm;
        } else {
          unlockedCount++;
        }
      });

      const totalGaps = (drawerCount + 1) * doorPerimeterGap;
      const availableForUnlocked = Math.max(
        unlockedCount * 100,
        defaultTargetZoneH - totalGaps - lockedDrawerSum
      );
      const autoDrawerH =
        unlockedCount > 0 ? Number((availableForUnlocked / unlockedCount).toFixed(2)) : 0;

      bay.drawers.forEach((drw) => {
        const h =
          typeof drw.heightMm === "number" && drw.heightMm >= 80 ? drw.heightMm : autoDrawerH;
        resolvedDrawerHeights.push(h);
      });

      totalDrawerZoneHeightMm =
        resolvedDrawerHeights.reduce((a, b) => a + b, 0) + drawerCount * doorPerimeterGap;
    }

    const upperZoneStartY = innerY0 + totalDrawerZoneHeightMm;
    const upperZoneHeight = Math.max(100, netInnerH - totalDrawerZoneHeightMm);

    // --- 8A. Shelves (with deflection check & explicit yPositionMm support) ---
    bay.shelves.forEach((shelf, sIdx) => {
      const shelfT = shelf.thicknessMm || T;
      const setback =
        shelf.depthOffsetMm !== undefined
          ? shelf.depthOffsetMm
          : shelf.type === "adjustable"
          ? SHELF_FRONT_SETBACK_MM
          : 0;
      const shelfDepth = Math.max(100, netInnerD - setback);

      // Deflection check
      const deflection = calculateShelfDeflectionMm(bayW, shelfDepth, shelfT);
      if (deflection.exceedsLimit) {
        warnings.push(
          `Bölme ${bayIdx + 1} Raf ${sIdx + 1}: Açıklık ${bayW}mm için hesaplanan sehim (${deflection.deflectionMm}mm) sınır değeri (${deflection.limitMm}mm) aşıyor. Ara dikme veya 25mm raf önerilir.`
        );
      }

      const defaultY =
        upperZoneStartY + ((sIdx + 1) * upperZoneHeight) / (bay.shelves.length + 1);
      const resolvedY =
        typeof shelf.yPositionMm === "number"
          ? Math.min(innerY0 + netInnerH - shelfT - 50, Math.max(innerY0 + 50, innerY0 + shelf.yPositionMm))
          : Number(defaultY.toFixed(2));

      components.push({
        id: shelf.id || `${module.id}_shelf_b${bayIdx + 1}_${sIdx + 1}`,
        partCode: `F${bayIdx + 1}_${sIdx + 1}`,
        role: shelf.type === "fixed" ? "shelf_fixed" : "shelf_adjustable",
        label: `${shelf.type === "fixed" ? "Sabit" : "Hareketli"} Raf B${bayIdx + 1}-${sIdx + 1}`,
        bayIndex: bayIdx,
        dimensions: { width: bayW, height: shelfT, depth: shelfDepth },
        cutDimensions: {
          finishedLengthMm: bayW,
          finishedWidthMm: shelfDepth,
          thicknessMm: shelfT,
          grain: "horizontal",
        },
        position: { x: bayStartX, y: resolvedY, z: innerZ0 },
        materialId: bodyMaterialId,
        isPanelCutPiece: true,
      });
    });

    // --- 8B. Hanging Rails (Askı Borusu) ---
    bay.hangingRails.forEach((rail, rIdx) => {
      const yOffset = rail.yOffsetFromTopMm ?? 80 + rIdx * 900;
      const railY = Math.max(upperZoneStartY + 100, height - T - yOffset);
      components.push({
        id: rail.id || `${module.id}_rail_b${bayIdx + 1}_${rIdx + 1}`,
        role: "hanging_rail",
        label: `Askı Borusu B${bayIdx + 1}-${rIdx + 1}`,
        bayIndex: bayIdx,
        dimensions: { width: bayW, height: 30, depth: 15 },
        position: { x: bayStartX, y: railY, z: innerZ0 + netInnerD / 2 },
        materialId: "mat_anodized_metal",
        isPanelCutPiece: false,
        hardwareRefId: "HRD_HANGING_RAIL_OVAL",
      });
    });

    // --- 8C. Internal Accessories (Trouser rack, shoe rack, pull-out basket, etc.) ---
    if (bay.accessories && bay.accessories.length > 0) {
      bay.accessories.forEach((acc, aIdx) => {
        components.push({
          id: acc.id || `${module.id}_acc_b${bayIdx + 1}_${aIdx + 1}`,
          role: "accessory_unit",
          label: `İç Aksesuar (${acc.type}) B${bayIdx + 1}-${aIdx + 1}`,
          bayIndex: bayIdx,
          dimensions: { width: bayW - 20, height: acc.heightMm || 80, depth: netInnerD - 30 },
          position: { x: bayStartX + 10, y: innerY0 + acc.yPositionMm, z: innerZ0 + 15 },
          materialId: "mat_anodized_metal",
          isPanelCutPiece: false,
          hardwareRefId: `HRD_ACC_${acc.type.toUpperCase()}`,
        });
      });
    }

    // --- 8D. Sub-Dividers (Bölme İçi Ara Dikme) ---
    if (bay.subDividers && bay.subDividers.length > 0) {
      bay.subDividers.forEach((sub, sdIdx) => {
        components.push({
          id: sub.id || `${module.id}_subdiv_b${bayIdx + 1}_${sdIdx + 1}`,
          partCode: `SD${bayIdx + 1}_${sdIdx + 1}`,
          role: "carcass_sub_divider",
          label: `İç Ara Dikme B${bayIdx + 1}-${sdIdx + 1}`,
          bayIndex: bayIdx,
          dimensions: { width: T, height: sub.heightMm, depth: netInnerD - 5 },
          cutDimensions: {
            finishedLengthMm: sub.heightMm,
            finishedWidthMm: netInnerD - 5,
            thicknessMm: T,
            grain: "vertical",
          },
          position: {
            x: bayStartX + Math.min(bayW - T, Math.max(50, sub.xOffsetMm)),
            y: innerY0 + sub.startYMm,
            z: innerZ0,
          },
          materialId: bodyMaterialId,
          isPanelCutPiece: true,
        });
      });
    }

    // --- 8E. Drawers & Undermount Slides ---
    let currentDrawerY = innerY0 + doorPerimeterGap;
    bay.drawers.forEach((drawer, dIdx) => {
      const frontH = resolvedDrawerHeights[dIdx];
      const frontW = Number((bayW - 2 * doorPerimeterGap).toFixed(2));
      const boxD = Math.max(250, netInnerD - DRAWER_REAR_CLEARANCE_MM);
      const maxStroke = Math.min(450, Math.round(boxD * 0.85));
      const pulledZ = Math.min(maxStroke, Math.max(0, drawerOpenMm));
      const frontId = `${drawer.id}_front`;

      // 1. Drawer Front Panel
      components.push({
        id: frontId,
        partCode: `DF${bayIdx + 1}_${dIdx + 1}`,
        role: "drawer_front",
        label: `Çekmece Önü B${bayIdx + 1}-${dIdx + 1}`,
        bayIndex: bayIdx,
        dimensions: { width: frontW, height: frontH, depth: T },
        cutDimensions: {
          finishedLengthMm: frontW,
          finishedWidthMm: frontH,
          thicknessMm: T,
          grain: "horizontal",
        },
        position: { x: bayStartX + doorPerimeterGap, y: currentDrawerY, z: depth + pulledZ },
        materialId: doorMaterialId || bodyMaterialId,
        isFrontFacing: true,
        isPanelCutPiece: true,
      });

      // 2. Drawer Handle (Child of Drawer Front)
      if (drawer.handleProfileId && drawer.handleProfileId !== "handleless_plain") {
        const handleW = Math.min(160, Math.max(64, frontW - 60));
        components.push({
          id: `${drawer.id}_handle`,
          role: "drawer_handle",
          label: `Çekmece Kulpu B${bayIdx + 1}-${dIdx + 1}`,
          bayIndex: bayIdx,
          parentComponentId: frontId,
          hardwareRefId: drawer.handleProfileId,
          dimensions: { width: handleW, height: 14, depth: 24 },
          position: {
            x: bayStartX + doorPerimeterGap + (frontW - handleW) / 2,
            y: currentDrawerY + frontH - Math.min(35, frontH / 2),
            z: depth + T + pulledZ + explodeZ,
          },
          materialId: "mat_anodized_metal",
          isFrontFacing: true,
          isPanelCutPiece: false,
        });
      }

      // 3. Drawer Box (Sides, Back, Bottom) — Strictly behind drawer front (z <= depth)
      const boxT = 16;
      const boxH = Math.max(60, frontH - 34);
      const boxX0 = bayStartX + UNDERMOUNT_RUNNER_GAP_MM;
      const boxW = bayW - 2 * UNDERMOUNT_RUNNER_GAP_MM;
      const boxZ0 = depth - boxD + pulledZ; // Box front meets inside face of drawer_front at z = depth

      components.push({
        id: `${drawer.id}_side_left`,
        partCode: `DSL${bayIdx + 1}_${dIdx + 1}`,
        role: "drawer_side_left",
        label: `Çekmece Sol Yan B${bayIdx + 1}-${dIdx + 1}`,
        bayIndex: bayIdx,
        dimensions: { width: boxT, height: boxH, depth: boxD },
        cutDimensions: {
          finishedLengthMm: boxD,
          finishedWidthMm: boxH,
          thicknessMm: boxT,
          grain: "horizontal",
        },
        position: { x: boxX0, y: currentDrawerY + 12, z: boxZ0 },
        materialId: bodyMaterialId,
        isPanelCutPiece: true,
      });

      components.push({
        id: `${drawer.id}_side_right`,
        partCode: `DSR${bayIdx + 1}_${dIdx + 1}`,
        role: "drawer_side_right",
        label: `Çekmece Sağ Yan B${bayIdx + 1}-${dIdx + 1}`,
        bayIndex: bayIdx,
        dimensions: { width: boxT, height: boxH, depth: boxD },
        cutDimensions: {
          finishedLengthMm: boxD,
          finishedWidthMm: boxH,
          thicknessMm: boxT,
          grain: "horizontal",
        },
        position: { x: boxX0 + boxW - boxT, y: currentDrawerY + 12, z: boxZ0 },
        materialId: bodyMaterialId,
        isPanelCutPiece: true,
      });

      const innerBoxW = boxW - 2 * boxT;
      components.push({
        id: `${drawer.id}_back`,
        partCode: `DBK${bayIdx + 1}_${dIdx + 1}`,
        role: "drawer_back",
        label: `Çekmece Arkalığı B${bayIdx + 1}-${dIdx + 1}`,
        bayIndex: bayIdx,
        dimensions: { width: innerBoxW, height: boxH - 12, depth: boxT },
        cutDimensions: {
          finishedLengthMm: innerBoxW,
          finishedWidthMm: boxH - 12,
          thicknessMm: boxT,
          grain: "horizontal",
        },
        position: { x: boxX0 + boxT, y: currentDrawerY + 12 + T_back, z: boxZ0 },
        materialId: bodyMaterialId,
        isPanelCutPiece: true,
      });

      components.push({
        id: `${drawer.id}_bottom`,
        partCode: `DBM${bayIdx + 1}_${dIdx + 1}`,
        role: "drawer_bottom",
        label: `Çekmece Tabanı B${bayIdx + 1}-${dIdx + 1}`,
        bayIndex: bayIdx,
        dimensions: { width: innerBoxW + 12, height: T_back, depth: boxD },
        cutDimensions: {
          finishedLengthMm: boxD,
          finishedWidthMm: innerBoxW + 12,
          thicknessMm: T_back,
          grain: "horizontal",
        },
        position: { x: boxX0 + boxT - 6, y: currentDrawerY + 12, z: boxZ0 },
        materialId: bodyMaterialId,
        isPanelCutPiece: true,
      });

      // 4. Undermount Slides (Left & Right)
      components.push({
        id: `${drawer.id}_slide_left`,
        role: "drawer_slide",
        label: `Gizli Ray Sol B${bayIdx + 1}-${dIdx + 1}`,
        bayIndex: bayIdx,
        dimensions: { width: 10, height: 18, depth: boxD },
        position: { x: bayStartX, y: currentDrawerY + 4, z: depth - boxD + pulledZ * 0.5 },
        materialId: "mat_anodized_metal",
        isPanelCutPiece: false,
        hardwareRefId: drawer.runnerSystemId || `HRD_RUNNER_${boxD}`,
      });

      components.push({
        id: `${drawer.id}_slide_right`,
        role: "drawer_slide",
        label: `Gizli Ray Sağ B${bayIdx + 1}-${dIdx + 1}`,
        bayIndex: bayIdx,
        dimensions: { width: 10, height: 18, depth: boxD },
        position: { x: bayStartX + bayW - 10, y: currentDrawerY + 4, z: depth - boxD + pulledZ * 0.5 },
        materialId: "mat_anodized_metal",
        isPanelCutPiece: false,
        hardwareRefId: drawer.runnerSystemId || `HRD_RUNNER_${boxD}`,
      });

      currentDrawerY += frontH + doorPerimeterGap;
    });

    // --- 8F. Doors, Mechanism Kinematics & Handle Placement (FAZ B) ---
    if (bay.doors && bay.doors.type !== "none" && bay.doors.type !== "open") {
      const doorType = bay.doors.type;
      const systemId = bay.doors.systemId || inferDoorSystemIdFromType(doorType);
      const spec = DOOR_MECHANISM_SPECS[systemId];

      if (!spec.isVerified) {
        warnings.push(
          `Bölme ${bayIdx + 1} Kapak Sistemi (${spec.label}): ${spec.reasonIfUnverified}`
        );
      }

      const isDoubleLeaf =
        doorType === "double" ||
        doorType === "inset_double" ||
        spec.leafCountPerBay === 2;
      const doorCount = isDoubleLeaf ? 2 : 1;

      const isVerticalSplit = spec.kinematicType === "lift_bifold";
      const doorOpeningY0 = upperZoneStartY + doorPerimeterGap;
      const doorOpeningH = Math.max(100, upperZoneHeight - 2 * doorPerimeterGap);

      const leafW = isVerticalSplit
        ? Number((bayW - 2 * doorPerimeterGap).toFixed(2))
        : Number(((bayW - (doorCount + 1) * doorPerimeterGap) / doorCount).toFixed(2));
      const leafH = isVerticalSplit
        ? Number(((doorOpeningH - doorPerimeterGap) / 2).toFixed(2))
        : doorOpeningH;

      // Normalize opening progress [0..1] — strictly 0 if mechanism is NOT VERIFIED
      const openProgress = spec.isVerified
        ? Math.min(1, Math.max(0, doorOpenAngleDeg / (spec.maxAngleDeg || 90)))
        : 0;

      for (let d = 0; d < doorCount; d++) {
        // Resolve true hinge side for single-right, single-left, double, lift, sliding
        let hingeSide = "left";
        if (spec.kinematicType === "sliding_track") {
          hingeSide = d === 0 ? "sliding_front" : "sliding_rear";
        } else if (
          spec.kinematicType === "lift_stay" ||
          spec.kinematicType === "lift_parallel" ||
          spec.kinematicType === "lift_bifold"
        ) {
          hingeSide = "top";
        } else if (
          doorType === "right" ||
          doorType === "single_right" ||
          doorType === "inset_right" ||
          doorType === "half_overlay_right"
        ) {
          hingeSide = "right";
        } else if (doorCount === 2) {
          hingeSide = d === 0 ? "left" : "right";
        }

        const baseLeafX = isVerticalSplit
          ? bayStartX + doorPerimeterGap
          : bayStartX + doorPerimeterGap + d * (leafW + doorPerimeterGap);
        const baseLeafY = isVerticalSplit
          ? doorOpeningY0 + d * (leafH + doorPerimeterGap)
          : doorOpeningY0;
        const baseLeafZ =
          systemId === "hinged_inset"
            ? depth - T
            : spec.kinematicType === "sliding_track"
            ? depth + (d === 0 ? spec.trackOffsetZMm : 2)
            : depth;

        // Calculate mechanism-specific 3D transform (rotation + translation)
        let rotX = 0;
        let rotY = 0;
        let posX = baseLeafX;
        let posY = baseLeafY;
        let posZ = baseLeafZ + explodeZ;

        const maxRad = (spec.maxAngleDeg * Math.PI) / 180;

        if (spec.kinematicType === "hinged_pivot") {
          const sign = hingeSide === "left" ? -1 : 1;
          rotY = sign * openProgress * maxRad;
        } else if (spec.kinematicType === "sliding_track") {
          const slideTravel = leafW * 0.85 * openProgress;
          posX = baseLeafX + (d === 0 ? slideTravel : -slideTravel);
        } else if (spec.kinematicType === "bi_fold") {
          // WingLine bi-fold: Leaf 0 pivots at left edge, Leaf 1 counter-folds and translates toward left edge
          const foldRad = openProgress * maxRad;
          rotY = d === 0 ? -foldRad : foldRad;
          if (d === 1) {
            posX = baseLeafX - leafW * (1 - Math.cos(foldRad));
            posZ = baseLeafZ + leafW * Math.sin(foldRad);
          }
        } else if (spec.kinematicType === "lift_stay") {
          rotX = -openProgress * maxRad;
        } else if (spec.kinematicType === "lift_parallel") {
          posY = baseLeafY + openProgress * Math.min(320, leafH * 0.65);
          posZ = baseLeafZ + Math.sin(openProgress * Math.PI * 0.5) * spec.trackOffsetZMm + explodeZ;
        } else if (spec.kinematicType === "lift_bifold") {
          // Top leaf (d === 1) swings up, bottom leaf (d === 0) folds upward with it
          const foldRad = openProgress * maxRad;
          rotX = d === 1 ? -foldRad : foldRad * 0.65;
          if (d === 0) {
            posY = baseLeafY + leafH * (1 - Math.cos(foldRad)) * 0.85;
            posZ = baseLeafZ + leafH * Math.sin(foldRad) * 0.5 + explodeZ;
          }
        }

        const pivotPos = {
          x: hingeSide === "right" ? baseLeafX + leafW : baseLeafX,
          y: hingeSide === "top" ? baseLeafY + leafH : baseLeafY + leafH / 2,
          z: baseLeafZ,
        };

        const doorLeafId = `${module.id}_door_b${bayIdx + 1}_${d + 1}`;
        components.push({
          id: doorLeafId,
          partCode: `DR${bayIdx + 1}_${d + 1}`,
          role: "door_leaf",
          label: `Kapak B${bayIdx + 1}-${d + 1} (${spec.label})`,
          bayIndex: bayIdx,
          dimensions: { width: leafW, height: leafH, depth: T },
          cutDimensions: {
            finishedLengthMm: Math.max(leafW, leafH),
            finishedWidthMm: Math.min(leafW, leafH),
            thicknessMm: T,
            grain: "vertical",
          },
          position: { x: posX, y: posY, z: posZ },
          pivotPosition: pivotPos,
          rotation: [rotX, rotY, 0],
          materialId: doorMaterialId || bodyMaterialId,
          isFrontFacing: true,
          isPanelCutPiece: true,
          doorSystemId: systemId,
          doorHingeSide: hingeSide,
          isMechanismVerified: spec.isVerified,
        });

        // --- Door Handle Generation (FAZ B: Strictly attached to correct door & opening edge) ---
        const handleProfileId = bay.doors.handleProfileId || "HRD_HANDLE_BAR_160";
        const shouldRenderHandle =
          handleProfileId !== "handleless_plain" &&
          handleProfileId !== "none" &&
          (!isVerticalSplit || d === 0); // On Aventos HF bi-fold, handle sits on the lower leaf (d=0)

        if (shouldRenderHandle) {
          const isVerticalHandle =
            hingeSide === "left" ||
            hingeSide === "right" ||
            hingeSide === "sliding_front" ||
            hingeSide === "sliding_rear";
          const handleLength = Math.min(160, Math.max(64, (isVerticalHandle ? leafH : leafW) * 0.25));
          const handleW = isVerticalHandle ? 14 : handleLength;
          const handleH = isVerticalHandle ? handleLength : 14;
          const handleD = 24;
          const edgeMarginX = 38; // Standard 38mm handle drilling setback from opening edge

          // Compute handle X on the opening edge (opposite the hinge!)
          let handleLocalX = (leafW - handleW) / 2;
          if (hingeSide === "left" || hingeSide === "sliding_front") {
            handleLocalX = Math.max(15, leafW - edgeMarginX - handleW / 2);
          } else if (hingeSide === "right" || hingeSide === "sliding_rear") {
            handleLocalX = Math.min(leafW - 25, edgeMarginX - handleW / 2);
          }

          // Compute handle Y based on module category / placement rule
          const placement = bay.doors.handlePlacement || "auto";
          let handleLocalY = (leafH - handleH) / 2;
          if (placement === "top_corner" || (placement === "auto" && module.category === "base")) {
            handleLocalY = Math.max(20, leafH - handleH - 50);
          } else if (placement === "bottom_corner" || (placement === "auto" && (module.category === "wall" || hingeSide === "top"))) {
            handleLocalY = Math.min(leafH - handleH - 20, 40);
          }

          // Transform handle position with door rotation/translation so it moves with the door leaf
          let handleWorldX = posX + handleLocalX;
          let handleWorldY = posY + handleLocalY;
          let handleWorldZ = posZ + T;

          if (spec.kinematicType === "hinged_pivot" && Math.abs(rotY) > 0.001) {
            const dxFromPivot =
              hingeSide === "left" ? handleLocalX + handleW / 2 : -(leafW - handleLocalX - handleW / 2);
            handleWorldX = pivotPos.x + dxFromPivot * Math.cos(rotY);
            handleWorldZ = pivotPos.z + Math.abs(dxFromPivot * Math.sin(rotY)) + T;
          } else if (spec.kinematicType === "lift_stay" && Math.abs(rotX) > 0.001) {
            const dyFromPivot = leafH - handleLocalY;
            handleWorldY = pivotPos.y - dyFromPivot * Math.cos(Math.abs(rotX));
            handleWorldZ = pivotPos.z + dyFromPivot * Math.sin(Math.abs(rotX)) + T;
          }

          components.push({
            id: `${doorLeafId}_handle`,
            role: "door_handle",
            label: `Kapak Kulpu B${bayIdx + 1}-${d + 1}`,
            bayIndex: bayIdx,
            parentComponentId: doorLeafId,
            hardwareRefId: handleProfileId,
            dimensions: { width: handleW, height: handleH, depth: handleD },
            position: {
              x: Number(handleWorldX.toFixed(2)),
              y: Number(handleWorldY.toFixed(2)),
              z: Number(handleWorldZ.toFixed(2)),
            },
            rotation: [rotX, rotY, 0],
            materialId: "mat_anodized_metal",
            isFrontFacing: true,
            isPanelCutPiece: false,
            doorSystemId: systemId,
            doorHingeSide: hingeSide,
            isMechanismVerified: spec.isVerified,
          });
        }
      }
    }

    bayStartX += bayW + T;
  });

  return {
    moduleId: module.id,
    overall: module.dimensions,
    components,
    bayWidths,
    netInnerHeight: netInnerH,
    netInnerDepth: netInnerD,
    warnings,
  };
}




export function generateDrillingForComponent(comp) {
  const holes = [];
  const { width, height, depth } = comp.dimensions;

  // 1. Carcass Side Panels & Vertical Dividers (X is thickness T=18mm, Y is height, Z is depth)
  if (
    comp.role === "carcass_side_left" ||
    comp.role === "carcass_side_right" ||
    comp.role === "carcass_divider"
  ) {
    const panelSpanZ = depth; // True horizontal width of the side panel
    const panelHeightY = height;
    const T = width;

    // Minifix bolt & dowel holes along Z span (at 50mm from front and 50mm from back)
    const jointZPositions = [50, Math.max(96, panelSpanZ - 50)];
    jointZPositions.forEach((zPos, idx) => {
      holes.push({
        id: `H_${comp.id}_minifix_bolt_bot_${idx}`,
        diameter: 8,
        depth: 12,
        x: zPos,
        y: T / 2,
        z: 0,
        direction: "face_front",
        purpose: "minifix_bolt",
      });
      holes.push({
        id: `H_${comp.id}_dowel_bot_${idx}`,
        diameter: 8,
        depth: 12,
        x: zPos + 32,
        y: T / 2,
        z: 0,
        direction: "face_front",
        purpose: "dowel",
      });
      holes.push({
        id: `H_${comp.id}_minifix_bolt_top_${idx}`,
        diameter: 8,
        depth: 12,
        x: zPos,
        y: panelHeightY - T / 2,
        z: 0,
        direction: "face_front",
        purpose: "minifix_bolt",
      });
      holes.push({
        id: `H_${comp.id}_dowel_top_${idx}`,
        diameter: 8,
        depth: 12,
        x: zPos + 32,
        y: panelHeightY - T / 2,
        z: 0,
        direction: "face_front",
        purpose: "dowel",
      });
    });

    // System 32 shelf support pin holes (Blum 37mm front setback + rear row, 32mm vertical pitch)
    const startY = 128;
    const endY = panelHeightY - 128;
    const pinZFront = 37;
    const pinZBack = Math.max(100, panelSpanZ - 64);

    let holeIdx = 0;
    for (let y = startY; y <= endY; y += 32) {
      holes.push({
        id: `H_${comp.id}_shelf_pin_f_${holeIdx}`,
        diameter: 5,
        depth: 12,
        x: pinZFront,
        y,
        z: 0,
        direction: "face_front",
        purpose: "shelf_support",
      });
      holes.push({
        id: `H_${comp.id}_shelf_pin_b_${holeIdx}`,
        diameter: 5,
        depth: 12,
        x: pinZBack,
        y,
        z: 0,
        direction: "face_front",
        purpose: "shelf_support",
      });
      holeIdx++;
    }
  }

  // 2. Door Leaves (35mm Hinge Cups on Hinge Edge + Handle Through-Holes on Opening Edge)
  if (comp.role === "door_leaf") {
    const doorW = width;
    const doorH = height;
    const hingeSide = comp.doorHingeSide || "left";

    if (hingeSide === "left" || hingeSide === "right") {
      const hingeX = hingeSide === "right" ? doorW - 22.5 : 22.5;
      const screwOffsetX = hingeSide === "right" ? hingeX + 9.5 : hingeX - 9.5;
      const hingePositionsY =
        doorH > 1600
          ? [100, Math.round(doorH * 0.36), Math.round(doorH * 0.64), doorH - 100]
          : doorH > 950
          ? [100, Math.round(doorH / 2), doorH - 100]
          : [100, doorH - 100];

      hingePositionsY.forEach((yPos, idx) => {
        holes.push({
          id: `H_${comp.id}_hinge_cup_${idx}`,
          diameter: 35,
          depth: 13.5,
          x: hingeX,
          y: yPos,
          z: 0,
          direction: "face_back",
          purpose: "hinge_cup",
        });
        holes.push({
          id: `H_${comp.id}_hinge_screw_1_${idx}`,
          diameter: 2.5,
          depth: 10,
          x: screwOffsetX,
          y: yPos - 22.5,
          z: 0,
          direction: "face_back",
          purpose: "screw_pilot",
        });
        holes.push({
          id: `H_${comp.id}_hinge_screw_2_${idx}`,
          diameter: 2.5,
          depth: 10,
          x: screwOffsetX,
          y: yPos + 22.5,
          z: 0,
          direction: "face_back",
          purpose: "screw_pilot",
        });
      });
    }
  }

  // 3. Top & Bottom Panels (Minifix Cam 15mm + Edge Dowel 8mm along depth Z)
  if (comp.role === "carcass_bottom" || comp.role === "carcass_top") {
    const panelW = width;
    const panelD = depth;
    const jointZPositions = [50, Math.max(96, panelD - 50)];

    jointZPositions.forEach((zPos, idx) => {
      holes.push({
        id: `H_${comp.id}_minifix_cam_l_${idx}`,
        diameter: 15,
        depth: 14,
        x: 34,
        y: zPos,
        z: 0,
        direction: "face_back",
        purpose: "minifix_cam",
      });
      holes.push({
        id: `H_${comp.id}_edge_dowel_l_${idx}`,
        diameter: 8,
        depth: 25,
        x: 0,
        y: zPos + 32,
        z: 9,
        direction: "edge_left",
        purpose: "dowel",
      });
      holes.push({
        id: `H_${comp.id}_minifix_cam_r_${idx}`,
        diameter: 15,
        depth: 14,
        x: panelW - 34,
        y: zPos,
        z: 0,
        direction: "face_back",
        purpose: "minifix_cam",
      });
      holes.push({
        id: `H_${comp.id}_edge_dowel_r_${idx}`,
        diameter: 8,
        depth: 25,
        x: panelW,
        y: zPos + 32,
        z: 9,
        direction: "edge_right",
        purpose: "dowel",
      });
    });
  }

  return holes;
}








const STANDARD_SHEET_LENGTH_MM = 2800;
const STANDARD_SHEET_WIDTH_MM = 2070;
const SHEET_TRIM_MM = 10;

export function resolveEdgeBandingForRole(role) {
  if (role === "door_leaf" || role === "drawer_front") {
    return { top: true, bottom: true, left: true, right: true, thicknessMm: 2.0 };
  }
  if (
    role === "carcass_side_left" ||
    role === "carcass_side_right" ||
    role === "carcass_bottom" ||
    role === "carcass_top" ||
    role === "carcass_divider" ||
    role === "carcass_sub_divider" ||
    role === "plinth"
  ) {
    return { top: true, bottom: false, left: true, right: true, thicknessMm: 1.0 };
  }
  if (role === "shelf_fixed" || role === "shelf_adjustable") {
    return { top: true, bottom: false, left: false, right: false, thicknessMm: 1.0 };
  }
  if (role === "drawer_side_left" || role === "drawer_side_right" || role === "drawer_back") {
    return { top: true, bottom: false, left: false, right: false, thicknessMm: 0.8 };
  }
  return { top: false, bottom: false, left: false, right: false, thicknessMm: 0 };
}

/**
 * Extracts true panel finished dimensions (length, width, thickness) from 3D ComponentGeometry.
 * Fixes the critical V3.1 bug where horizontal/frontal panels used min(height, depth) = 18mm as width!
 */
export function extractPanelDimensions(comp) {
  if (comp.cutDimensions) {
    return {
      finishedLengthMm: comp.cutDimensions.finishedLengthMm,
      finishedWidthMm: comp.cutDimensions.finishedWidthMm,
      thicknessMm: comp.cutDimensions.thicknessMm,
    };
  }
  const sorted = [comp.dimensions.width, comp.dimensions.height, comp.dimensions.depth].sort(
    (a, b) => b - a
  );
  return {
    finishedLengthMm: sorted[0],
    finishedWidthMm: sorted[1],
    thicknessMm: sorted[2],
  };
}

export function generateProjectBOM(project) {
  const cutPieces = [];
  const hardwareMap = new Map();
  const blockingErrors = [];
  const warnings = [];

  const maxAllowedLength = STANDARD_SHEET_LENGTH_MM - 2 * SHEET_TRIM_MM;
  const maxAllowedWidth = STANDARD_SHEET_WIDTH_MM - 2 * SHEET_TRIM_MM;

  project.modules.forEach((mod) => {
    const geom = generateModuleGeometry(mod);
    warnings.push(...geom.warnings);

    // 1. Only panel cut pieces go into cutPieces (exclude metal handles, rails, slides!)
    const panelComponents = geom.components.filter((c) => c.isPanelCutPiece !== false);

    panelComponents.forEach((comp, idx) => {
      const { finishedLengthMm, finishedWidthMm, thicknessMm } = extractPanelDimensions(comp);
      const edgeBanding = resolveEdgeBandingForRole(comp.role);
      const ebT = edgeBanding.thicknessMm;

      const deductLength = (edgeBanding.left ? ebT : 0) + (edgeBanding.right ? ebT : 0);
      const deductWidth = (edgeBanding.top ? ebT : 0) + (edgeBanding.bottom ? ebT : 0);

      const cutLengthMm = Number(Math.max(10, finishedLengthMm - deductLength).toFixed(2));
      const cutWidthMm = Number(Math.max(10, finishedWidthMm - deductWidth).toFixed(2));
      const areaM2 = Number(((finishedLengthMm * finishedWidthMm) / 1_000_000).toFixed(4));

      const edgeMeters =
        ((edgeBanding.top ? finishedLengthMm : 0) +
          (edgeBanding.bottom ? finishedLengthMm : 0) +
          (edgeBanding.left ? finishedWidthMm : 0) +
          (edgeBanding.right ? finishedWidthMm : 0)) /
        1000;

      // Oversize stock sheet verification gate
      if (cutLengthMm > maxAllowedLength || cutWidthMm > maxAllowedWidth) {
        blockingErrors.push(
          `Modül ${mod.name} (${comp.label}): Net kesim ölçüsü (${cutLengthMm}x${cutWidthMm}mm) standart ham plaka sınırını (${maxAllowedLength}x${maxAllowedWidth}mm) aşıyor.`
        );
      }

      const holes = generateDrillingForComponent(comp);

      cutPieces.push({
        id: comp.id,
        partCode: comp.partCode || `P${idx + 1}`,
        moduleId: mod.id,
        label: comp.label,
        role: comp.role,
        materialId: comp.materialId,
        thicknessMm,
        finishedLengthMm,
        finishedWidthMm,
        cutLengthMm,
        cutWidthMm,
        quantity: 1,
        areaM2,
        edgebandLinearMeters: Number(edgeMeters.toFixed(3)),
        edgeBanding,
        drillingHoles: holes,
      });
    });

    // 2. Structural Carcass Connectors (Minifix + Dowels for Top, Bottom, Dividers, Fixed Shelves)
    const fixedJointPanelCount =
      2 + // Top + Bottom
      Math.max(0, geom.bayWidths.length - 1) + // Vertical dividers
      mod.bays.reduce((sum, b) => sum + b.shelves.filter((s) => s.type === "fixed").length, 0);
    addHardwareItem(
      hardwareMap,
      "HRD_MINIFIX_SET",
      "Minifix Gövde Bağlantı Seti (Eksantrik + Mil + Kavela)",
      fixedJointPanelCount * 4,
      "set",
      0.85
    );

    // 3. Hardware per Bay (Hinges, Mechanisms, Door Handles, Drawer Slides, Drawer Handles, Shelf Pins, Hanging Rails)
    mod.bays.forEach((bay, bayIdx) => {
      // Adjustable shelf pins (4 per adjustable shelf)
      const adjShelfCount = bay.shelves.filter((s) => s.type !== "fixed").length;
      if (adjShelfCount > 0) {
        addHardwareItem(
          hardwareMap,
          "HRD_SHELF_PIN_5MM",
          "Çelik Raf Pimi Ø5mm",
          adjShelfCount * 4,
          "pcs",
          0.25
        );
      }

      // Hanging rails & flange brackets
      bay.hangingRails.forEach((rail) => {
        addHardwareItem(
          hardwareMap,
          rail.profileType || "HRD_HANGING_RAIL_OVAL",
          "Oval Gardırop Askı Borusu + Flanş Takımı",
          1,
          "set",
          14.5
        );
      });

      // Internal accessories
      if (bay.accessories) {
        bay.accessories.forEach((acc) => {
          addHardwareItem(
            hardwareMap,
            `HRD_ACC_${acc.type.toUpperCase()}`,
            `İç Donanım Aksesuarı (${acc.type})`,
            1,
            "set",
            45.0
          );
        });
      }

      // Drawers (Runners + Handles)
      bay.drawers.forEach((drw) => {
        const runnerLength = Math.min(550, Math.max(250, Math.floor(( geom.netInnerDepth - 20) / 50) * 50));
        addHardwareItem(
          hardwareMap,
          drw.runnerSystemId || `HRD_RUNNER_${runnerLength}`,
          `Blum Tandem Tam Açılım Frenli Ray ${runnerLength}mm`,
          1,
          "pair",
          22.0
        );
        if (drw.handleProfileId && drw.handleProfileId !== "handleless_plain") {
          addHardwareItem(
            hardwareMap,
            drw.handleProfileId,
            `Kulp (${drw.handleProfileId})`,
            1,
            "pcs",
            8.5
          );
        }
      });

      // Doors (Mechanism Hardware + Door Handles)
      if (bay.doors && bay.doors.type !== "none" && bay.doors.type !== "open") {
        const systemId = bay.doors.systemId || inferDoorSystemIdFromType(bay.doors.type);
        const spec = DOOR_MECHANISM_SPECS[systemId];

        if (!spec.isVerified) {
          blockingErrors.push(
            `Modül ${mod.name} Bölme ${bayIdx + 1}: Seçilen kapak mekanizması (${spec.label}) henüz doğrulanmamıştır (${spec.reasonIfUnverified}). Üretim emri oluşturulamaz.`
          );
        }

        const isDouble =
          bay.doors.type === "double" ||
          bay.doors.type === "inset_double" ||
          spec.leafCountPerBay === 2;
        const doorLeafCount = isDouble ? 2 : 1;

        if (spec.kinematicType === "hinged_pivot") {
          const hingesPerLeaf =
            mod.dimensions.height > 1600 ? 4 : mod.dimensions.height > 950 ? 3 : 2;
          addHardwareItem(
            hardwareMap,
            "HRD_HINGE_CLIPTOP_110",
            "Blum Clip Top Blumotion 110° Frenli Menteşe + Taban",
            doorLeafCount * hingesPerLeaf,
            "pcs",
            4.8
          );
        } else if (spec.kinematicType === "sliding_track") {
          addHardwareItem(
            hardwareMap,
            `HRD_SLIDING_${systemId.toUpperCase()}`,
            `${spec.label} Ray ve Tekerlek Seti`,
            1,
            "set",
            95.0
          );
        } else if (spec.kinematicType === "bi_fold") {
          addHardwareItem(
            hardwareMap,
            "HRD_FOLDING_WINGLINE",
            "Katlanır Kapak Mekanizma Seti (WingLine)",
            1,
            "set",
            78.0
          );
        } else if (
          spec.kinematicType === "lift_stay" ||
          spec.kinematicType === "lift_parallel" ||
          spec.kinematicType === "lift_bifold"
        ) {
          addHardwareItem(
            hardwareMap,
            `HRD_LIFT_${systemId.toUpperCase()}`,
            `${spec.label} Kalkar Kapak Güç Ünitesi Seti`,
            1,
            "set",
            85.0
          );
        }

        // Door Handles (FAZ B & F: Ensures every door handle in 3D is also counted in BOM!)
        const handleProfileId = bay.doors.handleProfileId || "HRD_HANDLE_BAR_160";
        if (handleProfileId !== "handleless_plain" && handleProfileId !== "none") {
          const handleCount = spec.kinematicType === "lift_bifold" ? 1 : doorLeafCount;
          addHardwareItem(
            hardwareMap,
            handleProfileId,
            `Kulp (${handleProfileId})`,
            handleCount,
            "pcs",
            8.5
          );
        }
      }
    });
  });

  const hardwareItems = Array.from(hardwareMap.values());
  const totalPanelAreaM2 = Number(
    cutPieces.reduce((sum, p) => sum + p.areaM2 * p.quantity, 0).toFixed(4)
  );
  const totalEdgebandMeters = Number(
    cutPieces.reduce((sum, p) => sum + p.edgebandLinearMeters * p.quantity, 0).toFixed(3)
  );

  return {
    projectId: project.id,
    generatedAt: new Date().toISOString(),
    totalCutPiecesCount: cutPieces.length,
    totalHardwareCount: hardwareItems.reduce((sum, h) => sum + h.quantity, 0),
    totalPanelAreaM2,
    totalEdgebandMeters,
    cutPieces,
    hardwareItems,
    productionGate: {
      isReadyForErp: blockingErrors.length === 0,
      blockingErrors,
      warnings,
    },
  };
}

function addHardwareItem(map, id, name, qty, unit, unitPrice) {
  const existing = map.get(id);
  if (existing) {
    existing.quantity += qty;
    existing.totalPrice = Number((existing.quantity * existing.unitPrice).toFixed(2));
  } else {
    map.set(id, {
      id,
      name,
      quantity: qty,
      unit,
      unitPrice,
      totalPrice: Number((qty * unitPrice).toFixed(2)),
    });
  }
}






const MIN_PASSAGE_CLEARANCE_MM = 800; // Minimum ergonomic corridor / front passage clearance

export function getModuleOrientedFootprint(m, index) {
  const rot = ((m.rotationY || 0) % 360 + 360) % 360;
  const isSwapped = rot === 90 || rot === 270;
  const planWidth = isSwapped ? m.dimensions.depth : m.dimensions.width;
  const planDepth = isSwapped ? m.dimensions.width : m.dimensions.depth;

  // Front clearance zone (800mm in front of the module's opening direction)
  let frontX = m.position.x;
  let frontZ = m.position.z + planDepth;
  let frontW = planWidth;
  let frontD = MIN_PASSAGE_CLEARANCE_MM;

  if (rot === 90) {
    frontX = m.position.x + planWidth;
    frontZ = m.position.z;
    frontW = MIN_PASSAGE_CLEARANCE_MM;
    frontD = planDepth;
  } else if (rot === 180) {
    frontX = m.position.x;
    frontZ = m.position.z - MIN_PASSAGE_CLEARANCE_MM;
    frontW = planWidth;
    frontD = MIN_PASSAGE_CLEARANCE_MM;
  } else if (rot === 270) {
    frontX = m.position.x - MIN_PASSAGE_CLEARANCE_MM;
    frontZ = m.position.z;
    frontW = MIN_PASSAGE_CLEARANCE_MM;
    frontD = planDepth;
  }

  return {
    moduleId: m.id,
    moduleIndex: index,
    name: m.name,
    category: m.category,
    x: m.position.x,
    z: m.position.z,
    planWidth,
    planDepth,
    yBottom: m.position.y,
    yTop: m.position.y + m.dimensions.height,
    rotationY: rot,
    rawWidth: m.dimensions.width,
    rawHeight: m.dimensions.height,
    rawDepth: m.dimensions.depth,
    frontClearanceBox: { x: frontX, z: frontZ, width: frontW, depth: frontD },
  };
}

function boxesOverlap2D(a, b, toleranceMm = 1) {
  return (
    a.x + toleranceMm < b.x + b.width &&
    a.x + a.width - toleranceMm > b.x &&
    a.z + toleranceMm < b.z + b.depth &&
    a.z + a.depth - toleranceMm > b.z
  );
}

function rangesOverlap1D(aMin, aMax, bMin, bMax, tol = 1) {
  return aMin + tol < bMax && aMax - tol > bMin;
}

/**
 * FAZ D: Synchronizes 2D Plan manipulation with 3D Module Position, including
 * magnetic wall/module snapping and room boundary clamping.
 */
export function moveModuleInPlan2D(project, moduleId, targetX, targetZ, options = {}) {
  const { snapMm = 10, magneticSnapThresholdMm = 35 } = options;
  const updatedModules = project.modules.map((m, idx) => {
    if (m.id !== moduleId) return m;
    const fp = getModuleOrientedFootprint(m, idx);

    let nextX = Math.round(targetX / snapMm) * snapMm;
    let nextZ = Math.round(targetZ / snapMm) * snapMm;

    // Wall snap (back wall z=0, left wall x=0, right wall x=room.width, front wall z=room.depth)
    if (Math.abs(nextX) <= magneticSnapThresholdMm) nextX = 0;
    if (Math.abs(nextZ) <= magneticSnapThresholdMm) nextZ = 0;
    if (Math.abs(nextX + fp.planWidth - project.room.width) <= magneticSnapThresholdMm) {
      nextX = project.room.width - fp.planWidth;
    }
    if (Math.abs(nextZ + fp.planDepth - project.room.depth) <= magneticSnapThresholdMm) {
      nextZ = project.room.depth - fp.planDepth;
    }

    // Magnetic edge snap to adjacent modules
    project.modules.forEach((other, oIdx) => {
      if (other.id === moduleId) return;
      const ofp = getModuleOrientedFootprint(other, oIdx);
      if (Math.abs(nextZ - ofp.z) <= magneticSnapThresholdMm) {
        nextZ = ofp.z;
      }
      if (Math.abs(nextX - (ofp.x + ofp.planWidth)) <= magneticSnapThresholdMm) {
        nextX = ofp.x + ofp.planWidth;
      } else if (Math.abs(nextX + fp.planWidth - ofp.x) <= magneticSnapThresholdMm) {
        nextX = ofp.x - fp.planWidth;
      }
    });

    return {
      ...m,
      position: {
        ...m.position,
        x: nextX,
        z: nextZ,
      },
    };
  });

  return {
    ...project,
    version: (project.version || 1) + 1,
    updatedAt: new Date().toISOString(),
    modules: updatedModules,
  };
}

/**
 * FAZ D: Validates 2D/3D room boundaries, module-to-module 3D AABB collisions,
 * architectural obstacles (walls, columns, windows, door swings), and passage clearances.
 */
export function validateSpatialAndKitchenEngineering(project) {
  const footprints = project.modules.map((m, idx) => getModuleOrientedFootprint(m, idx));
  const issues = [];
  const obstacles = project.room.obstacles || [];

  // 1. Room Boundary Validation (Duvar sınır kontrolü)
  footprints.forEach((fp) => {
    if (
      fp.x < 0 ||
      fp.z < 0 ||
      fp.x + fp.planWidth > project.room.width ||
      fp.z + fp.planDepth > project.room.depth ||
      fp.yTop > project.room.height
    ) {
      issues.push({
        code: "ROOM_BOUNDARY_OVERFLOW",
        severity: "error",
        message: `Modül "${fp.name}" oda/duvar sınırlarını (${project.room.width}x${project.room.depth}x${project.room.height}mm) aşıyor.`,
        affectedIds: [fp.moduleId],
      });
    }
  });

  // 2. Module-to-Module 3D AABB Collision Check
  for (let i = 0; i < footprints.length; i++) {
    for (let j = i + 1; j < footprints.length; j++) {
      const a = footprints[i];
      const b = footprints[j];
      const xyOverlap = rangesOverlap1D(a.yBottom, a.yTop, b.yBottom, b.yTop);
      const planOverlap = boxesOverlap2D(
        { x: a.x, z: a.z, width: a.planWidth, depth: a.planDepth },
        { x: b.x, z: b.z, width: b.planWidth, depth: b.planDepth }
      );
      if (xyOverlap && planOverlap) {
        issues.push({
          code: "MODULE_COLLISION",
          severity: "error",
          message: `"${a.name}" ile "${b.name}" modülleri 3D mekânda çakışıyor.`,
          affectedIds: [a.moduleId, b.moduleId],
        });
      }

      // Opposing module passage clearance check
      const clearanceOverlap = boxesOverlap2D(a.frontClearanceBox, {
        x: b.x,
        z: b.z,
        width: b.planWidth,
        depth: b.planDepth,
      });
      if (clearanceOverlap && xyOverlap && !planOverlap) {
        issues.push({
          code: "PASSAGE_CLEARANCE_VIOLATION",
          severity: "warning",
          message: `"${a.name}" ön geçiş ve kapak açılma alanı (${MIN_PASSAGE_CLEARANCE_MM}mm) "${b.name}" tarafından daraltılıyor.`,
          affectedIds: [a.moduleId, b.moduleId],
        });
      }
    }
  }

  // 3. Architectural Obstacles Validation (Column, Window, Door Swing, Radiator)
  footprints.forEach((fp) => {
    const modBox = { x: fp.x, z: fp.z, width: fp.planWidth, depth: fp.planDepth };
    obstacles.forEach((obs) => {
      const obsBox = { x: obs.x, z: obs.z, width: obs.width, depth: obs.depth };
      const yOverlap = rangesOverlap1D(fp.yBottom, fp.yTop, obs.y, obs.y + obs.height);

      if (obs.type === "column" || obs.type === "radiator") {
        if (boxesOverlap2D(modBox, obsBox) && yOverlap) {
          issues.push({
            code: "OBSTACLE_COLLISION",
            severity: "error",
            message: `Modül "${fp.name}", mimari eleman "${obs.label}" (${obs.type}) ile çakışıyor.`,
            affectedIds: [fp.moduleId, obs.id],
          });
        }
      } else if (obs.type === "window") {
        // Tall/wall modules blocking window light opening
        if (boxesOverlap2D(modBox, obsBox) && fp.yTop > obs.y) {
          issues.push({
            code: "WINDOW_OCCLUSION",
            severity: "error",
            message: `Modül "${fp.name}" üst kotu (${fp.yTop}mm), pencere "${obs.label}" denizlik kotunu (${obs.y}mm) kapatıyor.`,
            affectedIds: [fp.moduleId, obs.id],
          });
        }
      } else if (obs.type === "door") {
        const swingRadius = obs.swingRadiusMm || obs.width || 900;
        const doorSwingZone = {
          x: obs.x,
          z: obs.z,
          width: Math.max(obs.width, swingRadius),
          depth: Math.max(obs.depth, swingRadius),
        };
        if (boxesOverlap2D(modBox, doorSwingZone)) {
          issues.push({
            code: "DOOR_SWING_COLLISION",
            severity: "error",
            message: `Modül "${fp.name}", oda kapısı "${obs.label}" açılma süpürme alanını (${swingRadius}mm) engelliyor.`,
            affectedIds: [fp.moduleId, obs.id],
          });
        }
      }
    });
  });

  const hasErrors = issues.some((i) => i.severity === "error");
  return {
    isCompliant: !hasErrors,
    footprints,
    issues,
  };
}




/**
 * FAZ E: One-Click / Minimum-Click Parametric Module Mutations
 * Automatically synchronizes bays, dividers, doors, handles, 3D geometry, and BOM.
 */
export function updateModuleQuickParams(project, moduleId, patch) {
  const modules = project.modules.map((mod) => {
    if (mod.id !== moduleId) return mod;

    const nextDimensions = {
      width: patch.width ?? mod.dimensions.width,
      height: patch.height ?? mod.dimensions.height,
      depth: patch.depth ?? mod.dimensions.depth,
    };

    const nextDividerCount =
      patch.verticalDividerCount !== undefined
        ? Math.max(0, patch.verticalDividerCount)
        : mod.carcass.verticalDividerCount;
    const targetBayCount = nextDividerCount + 1;

    const nextBays = [...mod.bays];
    while (nextBays.length < targetBayCount) {
      const idx = nextBays.length;
      nextBays.push({
        id: `${mod.id}_bay_${idx + 1}`,
        index: idx,
        shelves: [{ id: `${mod.id}_shelf_b${idx + 1}_1`, type: "adjustable" }],
        drawers: [],
        hangingRails: [],
        doors: mod.bays[0]?.doors ? { ...mod.bays[0].doors } : { type: "single_left", handleProfileId: "HRD_HANDLE_BAR_160" },
      });
    }
    if (nextBays.length > targetBayCount) {
      nextBays.length = targetBayCount;
    }

    return {
      ...mod,
      dimensions: nextDimensions,
      carcass: {
        ...mod.carcass,
        bodyMaterialId: patch.bodyMaterialId ?? mod.carcass.bodyMaterialId,
        doorMaterialId: patch.doorMaterialId ?? mod.carcass.doorMaterialId,
        plinthHeight: patch.plinthHeight ?? mod.carcass.plinthHeight,
        verticalDividerCount: nextDividerCount,
      },
      bays: nextBays,
    };
  });

  return {
    ...project,
    version: (project.version || 1) + 1,
    updatedAt: new Date().toISOString(),
    modules,
  };
}

export function setBayDoorAndHandle(project, moduleId, bayIndex, doorType, handleProfileId, systemId) {
  const modules = project.modules.map((mod) => {
    if (mod.id !== moduleId) return mod;
    const bays = mod.bays.map((bay, idx) => {
      if (idx !== bayIndex) return bay;
      return {
        ...bay,
        doors: {
          ...bay.doors,
          type: doorType,
          systemId: systemId || inferDoorSystemIdFromType(doorType),
          handleProfileId,
        },
      };
    });
    return { ...mod, bays };
  });

  return {
    ...project,
    version: (project.version || 1) + 1,
    updatedAt: new Date().toISOString(),
    modules,
  };
}

export function addOrUpdateBayShelf(project, moduleId, bayIndex, shelf) {
  const modules = project.modules.map((mod) => {
    if (mod.id !== moduleId) return mod;
    const bays = mod.bays.map((bay, idx) => {
      if (idx !== bayIndex) return bay;
      const exists = bay.shelves.some((s) => s.id === shelf.id);
      const shelves = exists
        ? bay.shelves.map((s) => (s.id === shelf.id ? { ...s, ...shelf } : s))
        : [...bay.shelves, shelf];
      return { ...bay, shelves };
    });
    return { ...mod, bays };
  });

  return {
    ...project,
    version: (project.version || 1) + 1,
    updatedAt: new Date().toISOString(),
    modules,
  };
}

export function removeBayShelf(project, moduleId, bayIndex, shelfId) {
  const modules = project.modules.map((mod) => {
    if (mod.id !== moduleId) return mod;
    const bays = mod.bays.map((bay, idx) => {
      if (idx !== bayIndex) return bay;
      return { ...bay, shelves: bay.shelves.filter((s) => s.id !== shelfId) };
    });
    return { ...mod, bays };
  });

  return {
    ...project,
    version: (project.version || 1) + 1,
    updatedAt: new Date().toISOString(),
    modules,
  };
}

export function addOrUpdateBayDrawer(project, moduleId, bayIndex, drawer) {
  const modules = project.modules.map((mod) => {
    if (mod.id !== moduleId) return mod;
    const bays = mod.bays.map((bay, idx) => {
      if (idx !== bayIndex) return bay;
      const exists = bay.drawers.some((d) => d.id === drawer.id);
      const drawers = exists
        ? bay.drawers.map((d) => (d.id === drawer.id ? { ...d, ...drawer } : d))
        : [...bay.drawers, drawer];
      return { ...bay, drawers };
    });
    return { ...mod, bays };
  });

  return {
    ...project,
    version: (project.version || 1) + 1,
    updatedAt: new Date().toISOString(),
    modules,
  };
}

export function serializeProjectSnapshot(project) {
  return JSON.stringify(
    {
      schemaVersion: "birim-v4.0",
      exportedAt: new Date().toISOString(),
      project,
    },
    null,
    2
  );
}

export function deserializeProjectSnapshot(rawJson) {
  const parsed = JSON.parse(rawJson);
  const project = parsed.project ? parsed.project : parsed;
  if (!project || !project.id || !Array.isArray(project.modules) || !project.room) {
    throw new Error("Geçersiz proje dosyası: room veya modules alanı eksik.");
  }
  return project;
}

export function computeUnifiedWorkspaceState(project, options = {}) {
  const geometries = {};
  project.modules.forEach((mod) => {
    geometries[mod.id] = generateModuleGeometry(mod, options);
  });
  const spatial = validateSpatialAndKitchenEngineering(project);
  const bom = generateProjectBOM(project);
  return { geometries, spatial, bom };
}

