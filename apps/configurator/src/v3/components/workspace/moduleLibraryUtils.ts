import type { DoorSystemId, ModuleFamilyId, ModuleInstance } from "@birim/core";
import {
  V4_HARDWARE_CATALOG,
  V4_MODULE_FAMILIES,
  type HardwareProductRecord,
  type V4ModuleTemplateDefinition,
} from "@birim/catalog";

export type CatalogViewMode = "grid" | "list" | "category";
export type CatalogWidthFilter = "all" | "narrow" | "medium" | "wide";
export type CatalogFeatureFilter = "all" | "sliding" | "drawer" | "open";

export type StudioSubCategoryId =
  | "tumu"
  | "dolap"
  | "giyinme"
  | "cekmeceler"
  | "acik"
  | "kose"
  | "ust"
  | "alt"
  | "ozel"
  | "tamamlayici";

export interface CatalogCategoryChip {
  id: StudioSubCategoryId;
  label: string;
  familyId: ModuleFamilyId;
  testId: string;
}

export const CATALOG_CATEGORY_CHIPS: CatalogCategoryChip[] = [
  { id: "tumu", label: "Tümü", familyId: "fam_wardrobe", testId: "v4-subcat-tumu" },
  { id: "dolap", label: "Gardırop", familyId: "fam_wardrobe", testId: "v4-family-chip-fam_wardrobe" },
  { id: "giyinme", label: "Giyinme", familyId: "fam_wardrobe", testId: "v4-subcat-giyinme" },
  { id: "cekmeceler", label: "Çekmece", familyId: "fam_kitchen_base", testId: "v4-subcat-cekmeceler" },
  { id: "acik", label: "Açık / Raf", familyId: "fam_wardrobe", testId: "v4-subcat-acik" },
  { id: "alt", label: "Mutfak Alt", familyId: "fam_kitchen_base", testId: "v4-family-chip-fam_kitchen_base" },
  { id: "ust", label: "Mutfak Üst", familyId: "fam_kitchen_wall", testId: "v4-family-chip-fam_kitchen_wall" },
  { id: "ozel", label: "Boy / Kiler", familyId: "fam_kitchen_tall", testId: "v4-family-chip-fam_kitchen_tall" },
  { id: "kose", label: "Köşe", familyId: "fam_special_corner", testId: "v4-family-chip-fam_special_corner" },
  { id: "tamamlayici", label: "Tamamlayıcı", familyId: "fam_complementary", testId: "v4-family-chip-fam_complementary" },
];

export const FAVORITE_TEMPLATES_STORAGE_KEY = "birim_v4_favorite_templates";
export const RECENT_TEMPLATES_STORAGE_KEY = "birim_v4_recent_templates";

export const DEFAULT_FAVORITE_TEMPLATE_IDS: string[] = [
  "tpl_wd_02_two_door",
  "tpl_wd_10_sliding_2door",
  "tpl_kb_05_three_drawers",
  "tpl_sc_01_l_corner_base",
];

const DOOR_SYSTEM_LABELS: Record<DoorSystemId, string> = {
  open: "Açık Modül (Kapaksız)",
  hinged_single: "Tek Menteşeli Kapak",
  hinged_double: "Çift Menteşeli Kapak",
  hinged_inset: "İçerde (Inset) Menteşeli",
  hinged_overlay_variant: "Yarım/Özel Biniş Menteşeli",
  lift_up_stay: "Yukarı Kalkar (AVENTOS HK)",
  lift_bi_fold: "Katlanır Kalkar (AVENTOS HF)",
  lift_parallel: "Paralel Kalkar (AVENTOS HL)",
  sliding_top_hung: "Üstten Askılı Sürgü",
  sliding_bottom_rolling: "Alttan Taşımalı Sürgü",
  sliding_coplanar: "Eş Düzlemli (Coplanar) Sürgü",
  folding_side: "Yana Katlanır (WingLine)",
  pocket_retractable: "Cep Kapak (REVEGO)",
  tambour_roller: "Tambur (Jaluzi) Kapak",
};

export function getDoorSystemLabelTr(doorSystemId: DoorSystemId): string {
  return DOOR_SYSTEM_LABELS[doorSystemId] || doorSystemId;
}

export function cleanTemplateTitle(name: string): string {
  return (name || "").replace(/^V4\s+/i, "").trim();
}

export function getTemplateWidthRangeCm(tpl: V4ModuleTemplateDefinition): { minCm: number; maxCm: number } {
  const minMm = tpl.dimensionLimits?.minW ?? Math.max(300, tpl.defaultDimensions.width - 200);
  const maxMm = tpl.dimensionLimits?.maxW ?? tpl.defaultDimensions.width + 200;
  return {
    minCm: Math.round(minMm / 10),
    maxCm: Math.round(maxMm / 10),
  };
}

export function isTemplateSliding(tpl: V4ModuleTemplateDefinition): boolean {
  const nameLower = (tpl.name || "").toLowerCase();
  return (
    tpl.defaultDoorSystemId?.startsWith("sliding") ||
    nameLower.includes("sürgü") ||
    nameLower.includes("sürgülü")
  );
}

export function isTemplateDrawer(tpl: V4ModuleTemplateDefinition): boolean {
  const nameLower = (tpl.name || "").toLowerCase();
  const idLower = (tpl.templateId || "").toLowerCase();
  return nameLower.includes("çekmece") || nameLower.includes("drawer") || idLower.includes("drawer");
}

export function isTemplateOpenOrShelf(tpl: V4ModuleTemplateDefinition): boolean {
  const nameLower = (tpl.name || "").toLowerCase();
  return (
    tpl.defaultDoorSystemId === "open" ||
    nameLower.includes("açık") ||
    nameLower.includes("raf") ||
    nameLower.includes("vitrin")
  );
}

export function matchesSubCategory(
  tpl: V4ModuleTemplateDefinition,
  subCat: StudioSubCategoryId,
  selectedFamily: ModuleFamilyId
): boolean {
  const nameLower = (tpl.name || "").toLowerCase();
  const isOpen = isTemplateOpenOrShelf(tpl);
  const hasDrawer = isTemplateDrawer(tpl);
  const isSlidingOrDressing =
    isTemplateSliding(tpl) ||
    tpl.defaultDoorSystemId === "pocket_retractable" ||
    tpl.defaultDoorSystemId === "folding_side" ||
    tpl.defaultDimensions.width >= 1500 ||
    nameLower.includes("giyinme");

  if (subCat === "tumu") return tpl.familyId !== "fam_complementary";
  if (subCat === "dolap") return tpl.familyId === "fam_wardrobe" && !isOpen;
  if (subCat === "giyinme") return tpl.familyId === "fam_wardrobe" && (isSlidingOrDressing || isOpen);
  if (subCat === "cekmeceler") {
    return (tpl.familyId === "fam_wardrobe" || tpl.familyId === "fam_kitchen_base") && hasDrawer;
  }
  if (subCat === "acik") return isOpen;
  if (subCat === "kose") return tpl.familyId === "fam_special_corner" || Boolean(tpl.isCorner);
  if (subCat === "ust") return tpl.familyId === "fam_kitchen_wall";
  if (subCat === "alt") return tpl.familyId === "fam_kitchen_base";
  if (subCat === "tamamlayici") return tpl.familyId === "fam_complementary";
  if (subCat === "ozel") return tpl.familyId === "fam_kitchen_tall" || tpl.familyId === selectedFamily;
  return true;
}

export interface CatalogFilterOptions {
  subCat: StudioSubCategoryId;
  selectedFamily: ModuleFamilyId;
  searchQuery: string;
  widthFilter: CatalogWidthFilter;
  featureFilter: CatalogFeatureFilter;
  showFavoritesOnly: boolean;
  favoriteIds: string[];
  ignoreSubCategory?: boolean;
}

export function filterCatalogTemplates(
  templates: V4ModuleTemplateDefinition[],
  opts: CatalogFilterOptions
): V4ModuleTemplateDefinition[] {
  const q = (opts.searchQuery || "").toLowerCase().trim();

  return templates.filter((tpl) => {
    if (!opts.ignoreSubCategory && !matchesSubCategory(tpl, opts.subCat, opts.selectedFamily)) {
      return false;
    }

    if (opts.showFavoritesOnly && !opts.favoriteIds.includes(tpl.templateId)) {
      return false;
    }

    if (opts.featureFilter === "sliding" && !isTemplateSliding(tpl)) return false;
    if (opts.featureFilter === "drawer" && !isTemplateDrawer(tpl)) return false;
    if (opts.featureFilter === "open" && !isTemplateOpenOrShelf(tpl)) return false;

    if (opts.widthFilter === "narrow" && tpl.defaultDimensions.width > 600) return false;
    if (
      opts.widthFilter === "medium" &&
      (tpl.defaultDimensions.width <= 600 || tpl.defaultDimensions.width > 1000)
    ) {
      return false;
    }
    if (opts.widthFilter === "wide" && tpl.defaultDimensions.width <= 1000) return false;

    if (q) {
      const nameLower = (tpl.name || "").toLowerCase();
      const descLower = (tpl.description || "").toLowerCase();
      const idLower = (tpl.templateId || "").toLowerCase();
      const dimText = `${tpl.defaultDimensions.width}x${tpl.defaultDimensions.height}x${tpl.defaultDimensions.depth}`;
      const match =
        nameLower.includes(q) ||
        descLower.includes(q) ||
        idLower.includes(q) ||
        dimText.includes(q) ||
        String(tpl.defaultDimensions.width).includes(q);
      if (!match) return false;
    }

    return true;
  });
}

export function getTemplateSubCategoryLabel(tpl: V4ModuleTemplateDefinition): string {
  const nameLower = (tpl.name || "").toLowerCase();
  if (tpl.familyId === "fam_wardrobe") {
    if (isTemplateSliding(tpl)) return "Sürgülü Gardıroplar";
    if (isTemplateOpenOrShelf(tpl) || nameLower.includes("giyinme")) return "Açık & Giyinme Odası";
    if (isTemplateDrawer(tpl) || nameLower.includes("ada") || nameLower.includes("şifonyer")) {
      return "Çekmeceli & Ada Modülleri";
    }
    return "Menteşeli Gardıroplar";
  }
  if (tpl.familyId === "fam_kitchen_base") {
    if (isTemplateDrawer(tpl)) return "Çekmeceli Alt Modüller";
    if (tpl.isCorner || nameLower.includes("köşe")) return "Köşe Alt Modüller";
    if (nameLower.includes("fırın") || nameLower.includes("evye") || nameLower.includes("bulaşık")) {
      return "Evye & Ankastre Alt";
    }
    return "Kapaklı & Özel Alt Modüller";
  }
  if (tpl.familyId === "fam_kitchen_wall") {
    if (tpl.defaultDoorSystemId.startsWith("lift_")) return "Yukarı Kalkar Üst Dolaplar";
    if (isTemplateOpenOrShelf(tpl)) return "Açık & Vitrin Üst Dolaplar";
    return "Menteşeli Üst Dolaplar";
  }
  if (tpl.familyId === "fam_kitchen_tall") {
    if (nameLower.includes("fırın") || nameLower.includes("buzdolabı") || nameLower.includes("ankastre")) {
      return "Cihaz & Fırın Kuleleri";
    }
    return "Kiler & Boy Dolapları";
  }
  if (tpl.familyId === "fam_special_corner") {
    if (nameLower.includes("eğimli") || nameLower.includes("merdiven")) return "Eğimli & Mimari Geçiş";
    return "İç / Dış Köşe Modülleri";
  }
  if (tpl.familyId === "fam_complementary") {
    if (nameLower.includes("tezgâh") || nameLower.includes("backsplash") || nameLower.includes("waterfall")) {
      return "Tezgâh & Duvar Panelleri";
    }
    if (nameLower.includes("taç") || nameLower.includes("led") || nameLower.includes("askı")) {
      return "Taç, Aydınlatma & Donanım";
    }
    return "Baza, Dolgu & Bitiş Panelleri";
  }
  return "Diğer Modüller";
}

export interface CategoryTreeGroup {
  familyId: ModuleFamilyId;
  familyName: string;
  familyCode: string;
  templates: V4ModuleTemplateDefinition[];
  subcategories: { label: string; templates: V4ModuleTemplateDefinition[] }[];
}

export function buildCategoryTreeGroups(
  templates: V4ModuleTemplateDefinition[]
): CategoryTreeGroup[] {
  return V4_MODULE_FAMILIES.map((fam) => {
    const famTemplates = templates.filter((t) => t.familyId === fam.id);
    const subMap = new Map<string, V4ModuleTemplateDefinition[]>();
    for (const tpl of famTemplates) {
      const subLabel = getTemplateSubCategoryLabel(tpl);
      const list = subMap.get(subLabel) || [];
      list.push(tpl);
      subMap.set(subLabel, list);
    }
    return {
      familyId: fam.id,
      familyName: fam.name.replace(/^[A-F]\.\s*/, ""),
      familyCode: fam.code,
      templates: famTemplates,
      subcategories: Array.from(subMap.entries()).map(([label, list]) => ({
        label,
        templates: list,
      })),
    };
  }).filter((g) => g.templates.length > 0);
}

export interface ClampedDimensionsResult {
  width: number;
  height: number;
  depth: number;
  warnings: string[];
  isValid: boolean;
}

export function clampTemplateDimensions(
  tpl: V4ModuleTemplateDefinition,
  input: { width?: number; height?: number; depth?: number }
): ClampedDimensionsResult {
  const limits = tpl.dimensionLimits;
  const warnings: string[] = [];

  let rawW = Number.isFinite(input.width) ? Math.round(input.width!) : tpl.defaultDimensions.width;
  let rawH = Number.isFinite(input.height) ? Math.round(input.height!) : tpl.defaultDimensions.height;
  let rawD = Number.isFinite(input.depth) ? Math.round(input.depth!) : tpl.defaultDimensions.depth;

  if (tpl.isFixedWidth && rawW !== tpl.defaultDimensions.width) {
    warnings.push(`Sabit genişlikli modül: Genişlik ${tpl.defaultDimensions.width} mm olarak korundu.`);
    rawW = tpl.defaultDimensions.width;
  } else {
    if (rawW < limits.minW) {
      warnings.push(`Minimum genişlik ${limits.minW} mm.`);
      rawW = limits.minW;
    } else if (rawW > limits.maxW) {
      warnings.push(`Maksimum genişlik ${limits.maxW} mm.`);
      rawW = limits.maxW;
    }
  }

  if (rawH < limits.minH) {
    warnings.push(`Minimum yükseklik ${limits.minH} mm.`);
    rawH = limits.minH;
  } else if (rawH > limits.maxH) {
    warnings.push(`Maksimum yükseklik ${limits.maxH} mm.`);
    rawH = limits.maxH;
  }

  if (rawD < limits.minD) {
    warnings.push(`Minimum derinlik ${limits.minD} mm.`);
    rawD = limits.minD;
  } else if (rawD > limits.maxD) {
    warnings.push(`Maksimum derinlik ${limits.maxD} mm.`);
    rawD = limits.maxD;
  }

  return {
    width: rawW,
    height: rawH,
    depth: rawD,
    warnings,
    isValid: warnings.length === 0,
  };
}

export function applyValidatedDimensionsToModule(
  mod: ModuleInstance,
  tpl: V4ModuleTemplateDefinition,
  customDimensions?: { width?: number; height?: number; depth?: number }
): ModuleInstance {
  if (!customDimensions) return mod;
  const clamped = clampTemplateDimensions(tpl, customDimensions);
  const plinth = mod.carcass?.plinthHeight ?? 100;
  const tPanel = mod.carcass?.panelThickness ?? 18;
  const netH = Math.max(120, clamped.height - plinth - 2 * tPanel);

  return {
    ...mod,
    dimensions: {
      width: clamped.width,
      height: clamped.height,
      depth: clamped.depth,
    },
    bays: mod.bays.map((bay) => ({
      ...bay,
      customWidth: undefined,
      shelves: bay.shelves.map((s) => ({
        ...s,
        elevationY: Math.max(40, Math.min(netH - 40, s.elevationY)),
      })),
      drawers: bay.drawers.map((d) => ({
        ...d,
        elevationY: Math.max(0, Math.min(Math.max(0, netH - d.height), d.elevationY)),
      })),
      hangingRails: bay.hangingRails.map((r) => ({
        ...r,
        elevationY: Math.max(120, Math.min(netH - 40, r.elevationY)),
      })),
    })),
  };
}

export function getCompatibleHardwareForTemplate(
  tpl: V4ModuleTemplateDefinition
): { primary: HardwareProductRecord | null; alternatives: HardwareProductRecord[] } {
  const primary = tpl.defaultHardwareProductId
    ? V4_HARDWARE_CATALOG.find((h) => h.id === tpl.defaultHardwareProductId) ?? null
    : null;

  const compatSet = new Set(tpl.compatibleDoorSystems || []);
  const alternatives = V4_HARDWARE_CATALOG.filter(
    (h) =>
      h.id !== primary?.id &&
      (h.compatibleDoorSystems?.some((ds) => compatSet.has(ds)) ?? false)
  ).slice(0, 4);

  return { primary, alternatives };
}

export function loadStoredIdList(key: string, fallback: string[]): string[] {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.every((x) => typeof x === "string")) {
      return parsed;
    }
  } catch {
    // ignore storage errors
  }
  return fallback;
}

export function saveStoredIdList(key: string, ids: string[]): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key, JSON.stringify(ids));
  } catch {
    // ignore storage errors
  }
}
