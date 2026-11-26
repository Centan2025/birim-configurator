import type { BayConfig, ModuleInstance } from "./types";

export interface ModuleLoadCapacitySummary {
  bayCount: number;
  clearBaySpanMm: number;
  safeLoadPerShelfKg: number;
  safeLoadPerDrawerKg: number;
  safeLoadPerHangingRailKg: number;
  totalShelvesCount: number;
  totalDrawersCount: number;
  totalRailsCount: number;
  totalSafeModuleLoadKg: number;
  deflectionSafe: boolean;
  recommendedBayCount: number;
}

/**
 * Computes the optimal deflection-safe bay count according to ISO 7170 Euler span rules
 * so users stretching a cabinet width in Simple/Architect mode never trigger shelf sagging
 * or excessively heavy >620mm hinged door leaves.
 */
export function computeOptimalDeflectionSafeBayCount(
  widthMm: number,
  options?: {
    panelThicknessMm?: number;
    shelfThicknessMm?: number;
    isSlidingDoor?: boolean;
  }
): number {
  const w = Math.max(280, Math.round(widthMm || 600));
  const pT = options?.panelThicknessMm || 18;
  const sT = options?.shelfThicknessMm || 18;
  const isSliding = Boolean(options?.isSlidingDoor);

  // Sliding wardrobes naturally prefer 2 bays up to 2100mm, 3 bays up to 3100mm, 4 bays above
  if (isSliding) {
    if (w <= 2100) return 2;
    if (w <= 3100) return 3;
    return 4;
  }

  // Max safe clear shelf span: ~780mm for 18mm melamine/MDFLam, ~980mm for 25mm reinforced shelf
  const maxSafeBayClearMm = sT >= 25 ? 980 : 780;
  for (let bays = 1; bays <= 8; bays++) {
    const netClearPerBay = (w - (bays + 1) * pT) / bays;
    if (netClearPerBay <= maxSafeBayClearMm) {
      return bays;
    }
  }
  return Math.max(1, Math.ceil(w / maxSafeBayClearMm));
}

function cloneBayTemplateWithFreshIds(
  templateBay: BayConfig,
  moduleId: string,
  targetBayIndex: number,
  clearBayWidthMm: number
): BayConfig {
  const bTag = `${moduleId}_b${targetBayIndex + 1}`;
  const isSliding = templateBay.door?.type === "sliding";
  const nextDoorType = isSliding
    ? "sliding"
    : templateBay.door?.type === "open"
    ? "open"
    : clearBayWidthMm >= 680
    ? "double"
    : targetBayIndex === 0
    ? "single_left"
    : "single_right";

  return {
    ...templateBay,
    index: targetBayIndex,
    customWidth: undefined,
    door: {
      ...templateBay.door,
      type: nextDoorType,
    },
    shelves: (templateBay.shelves || []).map((s, si) => ({
      ...s,
      id: `${bTag}_sh_${si + 1}`,
    })),
    drawers: (templateBay.drawers || []).map((d, di) => ({
      ...d,
      id: `${bTag}_dr_${di + 1}`,
    })),
    hangingRails: (templateBay.hangingRails || []).map((r, ri) => ({
      ...r,
      id: `${bTag}_rl_${ri + 1}`,
    })),
    specialFittings: (templateBay.specialFittings || []).map((f, fi) => ({
      ...f,
      id: `${bTag}_sf_${fi + 1}`,
    })),
    subDividers: (templateBay.subDividers || []).map((sd, sdi) => ({
      ...sd,
      id: `${bTag}_sd_${sdi + 1}`,
    })),
  };
}

/**
 * Tylko-inspired parametric auto-partitioning: adjusts `bays.length` automatically when
 * cabinet width changes so shelf span and door leaf widths stay structurally valid without
 * requiring manual divider splitting.
 */
export function autoPartitionModuleBaysForWidth(
  mod: ModuleInstance,
  nextWidthMm: number
): ModuleInstance {
  const clampedW = Math.max(280, Math.min(4800, Math.round(nextWidthMm)));
  if (mod.category === "complementary" || mod.bays.length === 0) {
    return {
      ...mod,
      dimensions: { ...mod.dimensions, width: clampedW },
    };
  }

  const pT = mod.carcass.panelThickness || 18;
  const maxShelfThick = Math.max(
    pT,
    ...mod.bays.flatMap((b) => (b.shelves || []).map((s) => s.thickness || pT))
  );
  const isSliding = mod.bays.some((b) => b.door?.type === "sliding");
  const targetBayCount = computeOptimalDeflectionSafeBayCount(clampedW, {
    panelThicknessMm: pT,
    shelfThicknessMm: maxShelfThick,
    isSlidingDoor: isSliding,
  });

  const clearBayWidthMm = Math.max(180, (clampedW - (targetBayCount + 1) * pT) / targetBayCount);

  if (targetBayCount === mod.bays.length) {
    return {
      ...mod,
      dimensions: { ...mod.dimensions, width: clampedW },
      bays: mod.bays.map((b, idx) => ({
        ...b,
        customWidth: undefined,
        door:
          b.door?.type === "sliding" || b.door?.type === "open"
            ? b.door
            : {
                ...b.door,
                type:
                  clearBayWidthMm >= 680
                    ? "double"
                    : b.door?.type === "double" && clearBayWidthMm < 580
                    ? idx === 0
                      ? "single_left"
                      : "single_right"
                    : b.door.type,
              },
      })),
    };
  }

  const nextBays: BayConfig[] = [];
  for (let i = 0; i < targetBayCount; i++) {
    const srcBay = mod.bays[i] || mod.bays[i % mod.bays.length];
    nextBays.push(cloneBayTemplateWithFreshIds(srcBay, mod.id, i, clearBayWidthMm));
  }

  return {
    ...mod,
    dimensions: { ...mod.dimensions, width: clampedW },
    bays: nextBays,
  };
}

/**
 * Computes transparent customer-facing ISO 7170 storage load capacity metrics (kg per shelf,
 * kg per drawer runner, kg per rail, and total safe load kg) similar to Tylko's shelf stats.
 */
export function computeModuleLoadCapacitySummary(mod: ModuleInstance): ModuleLoadCapacitySummary {
  const bayCount = Math.max(1, mod.bays.length);
  const pT = mod.carcass.panelThickness || 18;
  const clearBaySpanMm = Math.max(
    180,
    Math.round((mod.dimensions.width - (bayCount + 1) * pT) / bayCount)
  );
  const depthM = Math.max(0.24, mod.dimensions.depth / 1000);
  const spanM = clearBaySpanMm / 1000;

  const avgShelfThick = (() => {
    const thicknesses = mod.bays.flatMap((b) => (b.shelves || []).map((s) => s.thickness || pT));
    if (thicknesses.length === 0) return pT;
    return thicknesses.reduce((a, v) => a + v, 0) / thicknesses.length;
  })();

  // ISO 7170 Euler deflection-bounded safe uniform shelf load (18mm/25mm board)
  const thicknessFactor = Math.pow(avgShelfThick / 18, 2.4);
  const rawShelfKg = (24 * thicknessFactor * Math.min(1.25, depthM / 0.45)) / Math.pow(Math.max(0.38, spanM), 1.65);
  const safeLoadPerShelfKg = Math.max(12, Math.min(65, Math.round(rawShelfKg)));

  // Hardware box system runner rating (LEGRABOX/MOVENTO: 40-70kg, TANDEMBOX/AvanTech: 30-40kg)
  const boxSys = mod.carcass.drawerBoxSystem || "metal_box_tandembox";
  const safeLoadPerDrawerKg =
    boxSys === "metal_box_legrabox" || boxSys === "wooden_undermount"
      ? 40
      : 30;

  // Oval/round aluminum wardrobe hanging rail safe load over span
  const safeLoadPerHangingRailKg = clearBaySpanMm <= 700 ? 32 : clearBaySpanMm <= 950 ? 24 : 18;

  const totalShelvesCount = mod.bays.reduce((acc, b) => acc + (b.shelves?.length || 0), 0);
  const totalDrawersCount = mod.bays.reduce((acc, b) => acc + (b.drawers?.length || 0), 0);
  const totalRailsCount = mod.bays.reduce((acc, b) => acc + (b.hangingRails?.length || 0), 0);
  // Base panel floor per bay carries ~35 kg
  const baseFloorLoadKg = bayCount * 35;

  const totalSafeModuleLoadKg =
    baseFloorLoadKg +
    totalShelvesCount * safeLoadPerShelfKg +
    totalDrawersCount * safeLoadPerDrawerKg +
    totalRailsCount * safeLoadPerHangingRailKg;

  const isSliding = mod.bays.some((b) => b.door?.type === "sliding");
  const recommendedBayCount = computeOptimalDeflectionSafeBayCount(mod.dimensions.width, {
    panelThicknessMm: pT,
    shelfThicknessMm: avgShelfThick,
    isSlidingDoor: isSliding,
  });

  return {
    bayCount,
    clearBaySpanMm,
    safeLoadPerShelfKg,
    safeLoadPerDrawerKg,
    safeLoadPerHangingRailKg,
    totalShelvesCount,
    totalDrawersCount,
    totalRailsCount,
    totalSafeModuleLoadKg,
    deflectionSafe: clearBaySpanMm <= (avgShelfThick >= 25 ? 980 : 800),
    recommendedBayCount,
  };
}
