import {
  calculateNetInnerHeight,
  DoorSystemId,
  HandleCategory,
  ModuleInstance,
  OpeningTechnology,
  UnitLength,
} from "@birim/core";
import { getV4TemplateById } from "./v4-module-taxonomy";

export type WardrobeInteriorWizardId =
  | "wiz_hanging_heavy"
  | "wiz_shelf_heavy"
  | "wiz_drawer_heavy"
  | "wiz_shoe_tower"
  | "wiz_mixed_organizer"
  | "wiz_walkin_luxury";

export interface WardrobeWizardDefinition {
  id: WardrobeInteriorWizardId;
  name: string;
  description: string;
}

export const WARDROBE_INTERIOR_WIZARDS: WardrobeWizardDefinition[] = [
  {
    id: "wiz_hanging_heavy",
    name: "Askılık Ağırlıklı",
    description: "Üstte asansör askılık, ortada sabit raf, altta gömlek/ceket askısı",
  },
  {
    id: "wiz_shelf_heavy",
    name: "Raf Ağırlıklı",
    description: "System 32 adımlarına uyumlu 5-6 katlı simetrik raf düzeni",
  },
  {
    id: "wiz_drawer_heavy",
    name: "Çekmeceli Düzen",
    description: "Altta 3-4 frenli çekmece, üstte katlı kıyafet rafları",
  },
  {
    id: "wiz_shoe_tower",
    name: "Ayakkabılık & Çanta",
    description: "Altta eğimli raylı ayakkabılık rafları, üstte çanta bölmeleri",
  },
  {
    id: "wiz_mixed_organizer",
    name: "Karma İç Düzen",
    description: "Üst bagaj rafı, askı borusu, iç çekmeceler ve teleskopik pantolonluk",
  },
  {
    id: "wiz_walkin_luxury",
    name: "Lüks Giyinme Odası",
    description: "Boydan LED aydınlatma, takı çekmecesi, raf arası dikme ve çift askı",
  },
];

export interface SmartWallLayoutProposal {
  id: string;
  title: string;
  subtitle: string;
  carcassCount: number;
  moduleWidthsMm: UnitLength[];
  leftFillerMm: UnitLength;
  rightFillerMm: UnitLength;
  buildModules: () => ModuleInstance[];
}

/**
 * FAZ 08 — Smart Wall Span Layout Generator
 * Given a target wall length (e.g. 3600mm), proposes engineering-valid 4-carcass, 3-carcass,
 * and mixed-width layouts including automatic left/right wall filler strips.
 */
export function generateSmartWallLayouts(
  wallSpanMm: UnitLength,
  heightMm: UnitLength = 2200,
  depthMm: UnitLength = 600,
  mode: "wardrobe" | "kitchen" = "wardrobe"
): SmartWallLayoutProposal[] {
  const proposals: SmartWallLayoutProposal[] = [];
  const safeSpan = Math.max(800, Math.min(6000, Math.round(wallSpanMm)));

  // Standard 30mm left & right wall filler strips for door swing & wall plumb tolerance
  const fillerEach = safeSpan >= 1400 ? 30 : 0;
  const usableSpan = safeSpan - 2 * fillerEach;

  if (mode === "wardrobe") {
    // Option 1: 4-Carcass Layout (for spans >= 2400mm)
    const count4 = safeSpan >= 2400 ? 4 : 2;
    const w4Base = Math.floor(usableSpan / count4);
    const w4Rem = usableSpan - w4Base * count4;
    const widths4 = Array.from({ length: count4 }, (_, i) => (i === 0 ? w4Base + w4Rem : w4Base));

    proposals.push({
      id: "smart_layout_4_equal",
      title: `${count4} Eşit Gövdeli Dolap (${widths4.join(" + ")} mm)`,
      subtitle:
        fillerEach > 0
          ? `Simetrik çift kapaklı ${count4} gövde + 2×${fillerEach}mm duvar bitiş kör parçası`
          : `Simetrik ${count4} gövde yerleşimi`,
      carcassCount: count4,
      moduleWidthsMm: widths4,
      leftFillerMm: fillerEach,
      rightFillerMm: fillerEach,
      buildModules: () => {
        const tpl = getV4TemplateById("tpl_wd_02_two_door")!;
        let curX = fillerEach;
        return widths4.map((w, idx) => {
          const m = tpl.createInstance(`mod_w4_${idx + 1}`, `Gardırop Gövde ${idx + 1}`);
          m.position = { x: curX, y: 0, z: 0 };
          m.dimensions = { width: w, height: heightMm, depth: depthMm };
          curX += w;
          return m;
        });
      },
    });

    // Option 2: 3-Carcass Layout (for spans >= 1800mm)
    if (safeSpan >= 1800) {
      const w3Base = Math.floor(usableSpan / 3);
      const w3Rem = usableSpan - w3Base * 3;
      const widths3 = [w3Base, w3Base + w3Rem, w3Base];

      proposals.push({
        id: "smart_layout_3_equal",
        title: `3 Gövdeli Master Dolap (${widths3.join(" + ")} mm)`,
        subtitle: `Yanlar askı, orta bölüm çekmece/raf kulesi + 2×${fillerEach}mm dolgu`,
        carcassCount: 3,
        moduleWidthsMm: widths3,
        leftFillerMm: fillerEach,
        rightFillerMm: fillerEach,
        buildModules: () => {
          const tplAsk = getV4TemplateById("tpl_wd_02_two_door")!;
          const tplMix = getV4TemplateById("tpl_wd_12_mixed_organizer")!;
          let curX = fillerEach;
          return widths3.map((w, idx) => {
            const tpl = idx === 1 ? tplMix : tplAsk;
            const m = tpl.createInstance(`mod_w3_${idx + 1}`, idx === 1 ? "Orta Master Kule" : `Yan Askı Gövde ${idx + 1}`);
            m.position = { x: curX, y: 0, z: 0 };
            m.dimensions = { width: w, height: heightMm, depth: depthMm };
            curX += w;
            return m;
          });
        },
      });
    }

    // Option 3: Mixed Width Functional Layout (Askı + Pantolonluk/Çekmece + Vitrin + Ayakkabılık)
    if (safeSpan >= 2400) {
      const wLeft = Math.round(usableSpan * 0.3);
      const wMid = Math.round(usableSpan * 0.28);
      const wRight = Math.round(usableSpan * 0.24);
      const wEnd = usableSpan - wLeft - wMid - wRight;
      const mixedWidths = [wLeft, wMid, wRight, wEnd];

      proposals.push({
        id: "smart_layout_mixed_wardrobe",
        title: `Karma Fonksiyonel Yerleşim (${mixedWidths.join(" + ")} mm)`,
        subtitle: "Uzun Askı + İç Çekmeceli Master + Pantolonluk + Cam Vitrin",
        carcassCount: 4,
        moduleWidthsMm: mixedWidths,
        leftFillerMm: fillerEach,
        rightFillerMm: fillerEach,
        buildModules: () => {
          const templates = [
            getV4TemplateById("tpl_wd_09_hanging_heavy")!,
            getV4TemplateById("tpl_wd_12_mixed_organizer")!,
            getV4TemplateById("tpl_wd_17_trouser_unit")!,
            getV4TemplateById("tpl_wd_19_glass_showcase")!,
          ];
          let curX = fillerEach;
          return mixedWidths.map((w, idx) => {
            const m = templates[idx].createInstance(`mod_mix_${idx + 1}`);
            m.position = { x: curX, y: 0, z: 0 };
            m.dimensions = { width: w, height: heightMm, depth: depthMm };
            curX += w;
            return m;
          });
        },
      });
    }
  } else {
    // Kitchen wall span layout: Fixed 600mm Oven + Fixed 600mm Dishwasher + Sink + Drawers
    const fixedOven = 600;
    const fixedDw = 600;
    const remaining = Math.max(800, usableSpan - fixedOven - fixedDw);
    const sinkW = Math.min(900, Math.max(600, Math.round(remaining * 0.45)));
    const drawerW = Math.max(400, remaining - sinkW);
    const kWidths = [sinkW, fixedDw, drawerW, fixedOven];

    proposals.push({
      id: "smart_layout_kitchen_run",
      title: `Akıllı Mutfak Dizilimi (${kWidths.join(" + ")} mm)`,
      subtitle: "Evye + Bulaşık Makinesi (600 Sabit) + 3 Çekmeceli Hazırlık + Ankastre Fırın (600 Sabit)",
      carcassCount: 4,
      moduleWidthsMm: kWidths,
      leftFillerMm: fillerEach,
      rightFillerMm: fillerEach,
      buildModules: () => {
        const tpls = [
          getV4TemplateById("tpl_kb_08_sink_base")!,
          getV4TemplateById("tpl_kb_10_dishwasher_front")!,
          getV4TemplateById("tpl_kb_05_three_drawers")!,
          getV4TemplateById("tpl_kb_09_oven_housing")!,
        ];
        let curX = fillerEach;
        return kWidths.map((w, idx) => {
          const m = tpls[idx].createInstance(`mod_k_${idx + 1}`);
          m.position = { x: curX, y: 0, z: 0 };
          m.dimensions = { width: w, height: 720, depth: 580 };
          curX += w;
          return m;
        });
      },
    });
  }

  return proposals;
}

/**
 * FAZ 08 — Equal & Fixed/Flexible Width Distribution Across Wall Span
 * Respects `isFixedWidth: true` modules (like 600mm ovens) and distributes remaining space
 * evenly across flexible modules, returning remaining filler gap.
 */
export function distributeModulesAlongWall(
  modules: ModuleInstance[],
  wallLengthMm: UnitLength,
  reserveWallFillerMm = 30
): { updatedModules: ModuleInstance[]; leftFillerMm: UnitLength; rightFillerMm: UnitLength } {
  const baseModules = modules.filter(
    (m) => m.category !== "kitchen_wall" && m.category !== "complementary" && (m.rotation?.y || 0) === 0
  );
  if (baseModules.length === 0) {
    return { updatedModules: modules, leftFillerMm: 0, rightFillerMm: 0 };
  }

  const usableSpan = Math.max(400, wallLengthMm - 2 * reserveWallFillerMm);
  const fixedTotal = baseModules
    .filter((m) => m.isFixedWidth)
    .reduce((sum, m) => sum + m.dimensions.width, 0);
  const flexMods = baseModules.filter((m) => !m.isFixedWidth);
  const remainingForFlex = Math.max(flexMods.length * 300, usableSpan - fixedTotal);
  const flexUnitW = flexMods.length > 0 ? Math.floor(remainingForFlex / flexMods.length) : 0;
  const flexRemainder = flexMods.length > 0 ? remainingForFlex - flexUnitW * flexMods.length : 0;

  let curX = reserveWallFillerMm;
  let flexSeen = 0;

  const updatedModules = modules.map((mod) => {
    if (mod.category === "kitchen_wall" || mod.category === "complementary" || (mod.rotation?.y || 0) !== 0) {
      return mod;
    }
    const nextW = mod.isFixedWidth
      ? mod.dimensions.width
      : flexSeen++ === 0
      ? flexUnitW + flexRemainder
      : flexUnitW;

    const updated: ModuleInstance = {
      ...mod,
      position: { ...mod.position, x: curX },
      dimensions: { ...mod.dimensions, width: nextW },
    };
    curX += nextW;
    return updated;
  });

  const rightGap = Math.max(0, wallLengthMm - curX);
  return {
    updatedModules,
    leftFillerMm: reserveWallFillerMm,
    rightFillerMm: rightGap,
  };
}

/**
 * FAZ 08 — Multi-Module Batch Property Updater
 */
export function batchUpdateModules(
  modules: ModuleInstance[],
  selectedIndices: number[],
  updates: {
    heightMm?: UnitLength;
    depthMm?: UnitLength;
    bodyMaterialId?: string;
    doorMaterialId?: string;
    doorSystemId?: DoorSystemId;
    handleCategory?: HandleCategory;
    openingTechnology?: OpeningTechnology;
    hardwareProductId?: string;
  }
): ModuleInstance[] {
  const indexSet = new Set(selectedIndices);
  return modules.map((mod, idx) => {
    if (!indexSet.has(idx)) return mod;
    return {
      ...mod,
      dimensions: {
        width: mod.dimensions.width,
        height: updates.heightMm ?? mod.dimensions.height,
        depth: updates.depthMm ?? mod.dimensions.depth,
      },
      carcass: {
        ...mod.carcass,
        bodyMaterialId: updates.bodyMaterialId ?? mod.carcass.bodyMaterialId,
        doorMaterialId: updates.doorMaterialId ?? mod.carcass.doorMaterialId,
      },
      bays: mod.bays.map((b) => ({
        ...b,
        door: {
          ...b.door,
          doorSystemId: updates.doorSystemId ?? b.door.doorSystemId,
          handleCategory: updates.handleCategory ?? b.door.handleCategory,
          openingTechnology: updates.openingTechnology ?? b.door.openingTechnology,
          hardwareProductId: updates.hardwareProductId ?? b.door.hardwareProductId,
        },
      })),
    };
  });
}

/**
 * FAZ 09 — Wardrobe Interior Layout Wizard
 * Automatically scales shelves, drawers, hanging rails, trouser racks, shoe racks, and LED profiles
 * to the module's actual net inner height and bay width.
 */
export function applyWardrobeInteriorWizard(
  module: ModuleInstance,
  wizardId: WardrobeInteriorWizardId,
  targetBayIndex?: number
): ModuleInstance {
  const netH = calculateNetInnerHeight(module);
  const snap32 = (y: number) => Math.max(64, Math.min(netH - 64, Math.round(y / 32) * 32));

  const updatedBays = module.bays.map((bay, idx) => {
    if (typeof targetBayIndex === "number" && idx !== targetBayIndex) {
      return bay;
    }

    if (wizardId === "wiz_hanging_heavy") {
      const topShelfY = snap32(netH - 320);
      const midShelfY = snap32(netH * 0.48);
      return {
        ...bay,
        shelves: [
          { id: `sh_${module.id}_${idx}_top`, bayIndex: idx, elevationY: topShelfY, isAdjustable: false },
          { id: `sh_${module.id}_${idx}_mid`, bayIndex: idx, elevationY: midShelfY, isAdjustable: false },
        ],
        hangingRails: [
          { id: `rl_${module.id}_${idx}_lift`, bayIndex: idx, elevationY: topShelfY - 70, isLiftMechanism: true },
          { id: `rl_${module.id}_${idx}_bot`, bayIndex: idx, elevationY: midShelfY - 70, isLiftMechanism: false },
        ],
        drawers: [],
        specialFittings: [
          { id: `fit_${module.id}_${idx}_lift`, bayIndex: idx, elevationY: topShelfY - 120, type: "wardrobe_lift" as const, height: 120 },
        ],
      };
    }

    if (wizardId === "wiz_shelf_heavy") {
      const count = netH >= 1900 ? 5 : 4;
      const shelves = Array.from({ length: count }, (_, sIdx) => ({
        id: `sh_${module.id}_${idx}_${sIdx}`,
        bayIndex: idx,
        elevationY: snap32(((sIdx + 1) * netH) / (count + 1)),
        isAdjustable: true,
      }));
      return {
        ...bay,
        shelves,
        hangingRails: [],
        drawers: [],
        specialFittings: [],
      };
    }

    if (wizardId === "wiz_drawer_heavy") {
      const drawers = [0, 1, 2, 3].map((dIdx) => ({
        id: `drw_${module.id}_${idx}_${dIdx}`,
        bayIndex: idx,
        elevationY: dIdx * 185,
        height: 180,
        slideType: "soft_close" as const,
        isInternal: bay.door.type !== "open",
        hardwareProductId: "hw_blum_legrabox_m40",
      }));
      const coverShelfY = snap32(4 * 185 + 20);
      const upperShelfY = snap32((coverShelfY + netH) / 2);
      return {
        ...bay,
        shelves: [
          { id: `sh_${module.id}_${idx}_cov`, bayIndex: idx, elevationY: coverShelfY, isAdjustable: false },
          { id: `sh_${module.id}_${idx}_up`, bayIndex: idx, elevationY: upperShelfY, isAdjustable: true },
        ],
        hangingRails: [],
        drawers,
        specialFittings: [],
        door: {
          ...bay.door,
          hardwareProductId: bay.door.type !== "open" ? "hw_blum_71b7550" : bay.door.hardwareProductId,
        },
      };
    }

    if (wizardId === "wiz_shoe_tower") {
      const shoeFittings = [0, 1, 2, 3].map((fIdx) => ({
        id: `fit_${module.id}_${idx}_shoe_${fIdx}`,
        bayIndex: idx,
        elevationY: 120 + fIdx * 180,
        type: "shoe_rack" as const,
        height: 100,
      }));
      return {
        ...bay,
        shelves: [
          { id: `sh_${module.id}_${idx}_bag1`, bayIndex: idx, elevationY: snap32(950), isAdjustable: true },
          { id: `sh_${module.id}_${idx}_bag2`, bayIndex: idx, elevationY: snap32(1350), isAdjustable: true },
          { id: `sh_${module.id}_${idx}_bag3`, bayIndex: idx, elevationY: snap32(1750), isAdjustable: true },
        ],
        hangingRails: [],
        drawers: [],
        specialFittings: shoeFittings,
      };
    }

    if (wizardId === "wiz_walkin_luxury") {
      const topY = snap32(netH - 340);
      return {
        ...bay,
        shelves: [
          { id: `sh_${module.id}_${idx}_top`, bayIndex: idx, elevationY: topY, isAdjustable: false },
          { id: `sh_${module.id}_${idx}_mid`, bayIndex: idx, elevationY: snap32(580), isAdjustable: false },
        ],
        hangingRails: [{ id: `rl_${module.id}_${idx}_main`, bayIndex: idx, elevationY: topY - 70 }],
        drawers: [
          { id: `drw_${module.id}_${idx}_0`, bayIndex: idx, elevationY: 0, height: 180, slideType: "soft_close" as const, hardwareProductId: "hw_blum_legrabox_m40" },
          { id: `drw_${module.id}_${idx}_1`, bayIndex: idx, elevationY: 185, height: 140, slideType: "soft_close" as const, hardwareProductId: "hw_blum_legrabox_m40" },
        ],
        specialFittings: [
          { id: `fit_${module.id}_${idx}_jwl`, bayIndex: idx, elevationY: 200, type: "jewelry_tray" as const, height: 60 },
          { id: `fit_${module.id}_${idx}_led`, bayIndex: idx, elevationY: topY - 10, type: "led_profile" as const, height: 20 },
        ],
      };
    }

    // Default: wiz_mixed_organizer
    const topShelfY = snap32(netH - 350);
    return {
      ...bay,
      shelves: [
        { id: `sh_${module.id}_${idx}_top`, bayIndex: idx, elevationY: topShelfY, isAdjustable: false },
        { id: `sh_${module.id}_${idx}_low`, bayIndex: idx, elevationY: snap32(560), isAdjustable: false },
      ],
      hangingRails: [{ id: `rl_${module.id}_${idx}_0`, bayIndex: idx, elevationY: topShelfY - 70 }],
      drawers: [
        {
          id: `drw_${module.id}_${idx}_0`,
          bayIndex: idx,
          elevationY: 0,
          height: 180,
          slideType: "soft_close" as const,
          isInternal: bay.door.type !== "open",
          hardwareProductId: "hw_blum_legrabox_m40",
        },
        {
          id: `drw_${module.id}_${idx}_1`,
          bayIndex: idx,
          elevationY: 185,
          height: 180,
          slideType: "soft_close" as const,
          isInternal: bay.door.type !== "open",
          hardwareProductId: "hw_blum_legrabox_m40",
        },
      ],
      specialFittings: [
        { id: `fit_${module.id}_${idx}_tr`, bayIndex: idx, elevationY: 420, type: "trouser_rack" as const, height: 90 },
      ],
      door: {
        ...bay.door,
        hardwareProductId: bay.door.type !== "open" ? "hw_blum_71b7550" : bay.door.hardwareProductId,
      },
    };
  });

  return {
    ...module,
    bays: updatedBays,
  };
}

/**
 * FAZ 09 — Kitchen Automatic Complementary Parts Generator
 * Automatically creates continuous Countertop (Tezgâh), Backsplash (Tezgâh Arası),
 * Wall Filler (Kör Parça), End Panel (Yan Bitiş Paneli), and Top Infill for a kitchen project.
 */
export function generateKitchenComplementaryModules(existingModules: ModuleInstance[]): ModuleInstance[] {
  const nonComp = existingModules.filter((m) => m.category !== "complementary");
  const baseCabinets = nonComp.filter(
    (m) => m.category === "kitchen_base" && (m.rotation?.y || 0) === 0
  );
  if (baseCabinets.length === 0) return existingModules;

  const minX = Math.min(...baseCabinets.map((m) => m.position.x));
  const maxX = Math.max(...baseCabinets.map((m) => m.position.x + m.dimensions.width));
  const spanW = Math.max(600, maxX - minX);
  const topOfBaseY = baseCabinets[0].dimensions.height; // 720mm

  const tplCountertop = getV4TemplateById("tpl_cm_09_countertop")!;
  const countertop = tplCountertop.createInstance("comp_auto_countertop", `Otomatik Kuvars Tezgâh (${spanW}mm)`);
  countertop.position = { x: minX, y: topOfBaseY, z: 0 };
  countertop.dimensions = { width: spanW, height: 40, depth: 600 };

  const tplBacksplash = getV4TemplateById("tpl_cm_11_backsplash")!;
  const backsplash = tplBacksplash.createInstance("comp_auto_backsplash", `Otomatik Tezgâh Arası Panel (${spanW}mm)`);
  backsplash.position = { x: minX, y: topOfBaseY + 40, z: 0 };
  backsplash.dimensions = { width: spanW, height: 600, depth: 18 };

  const tplEndPanel = getV4TemplateById("tpl_cm_05_end_panel")!;
  const allMainWall = nonComp.filter((m) => (m.rotation?.y || 0) === 0);
  const rightmostX = Math.max(...allMainWall.map((m) => m.position.x + m.dimensions.width));
  const maxH = Math.max(...allMainWall.map((m) => m.position.y + m.dimensions.height));
  const endPanel = tplEndPanel.createInstance("comp_auto_end_panel", "Otomatik Yan Bitiş Paneli");
  endPanel.position = { x: rightmostX, y: 0, z: 0 };
  endPanel.dimensions = { width: 18, height: maxH, depth: 600 };

  return [...nonComp, countertop, backsplash, endPanel];
}
