import { describe, expect, it } from "vitest";
import { V4_MODULE_TEMPLATES } from "@birim/catalog";
import {
  applyValidatedDimensionsToModule,
  buildCategoryTreeGroups,
  clampTemplateDimensions,
  filterCatalogTemplates,
  getCompatibleHardwareForTemplate,
  getTemplateWidthRangeCm,
} from "../apps/configurator/src/v3/components/workspace/moduleLibraryUtils";

describe("Module Library UX & Parametric Utilities", () => {
  it("builds real category tree groups from V4_MODULE_TEMPLATES without fake categories", () => {
    const groups = buildCategoryTreeGroups(V4_MODULE_TEMPLATES);
    expect(groups.length).toBe(6);

    const totalGrouped = groups.reduce((sum, g) => sum + g.templates.length, 0);
    expect(totalGrouped).toBe(V4_MODULE_TEMPLATES.length);

    for (const g of groups) {
      expect(g.subcategories.length).toBeGreaterThan(0);
      const subTotal = g.subcategories.reduce((s, sub) => s + sub.templates.length, 0);
      expect(subTotal).toBe(g.templates.length);
    }
  });

  it("filters consistently across category, search, width, feature, and favorites", () => {
    const drawerBase = filterCatalogTemplates(V4_MODULE_TEMPLATES, {
      subCat: "alt",
      selectedFamily: "fam_kitchen_base",
      searchQuery: "çekmece",
      widthFilter: "medium",
      featureFilter: "drawer",
      showFavoritesOnly: false,
      favoriteIds: [],
    });
    expect(drawerBase.length).toBeGreaterThan(0);
    expect(
      drawerBase.every(
        (t) =>
          t.familyId === "fam_kitchen_base" &&
          t.defaultDimensions.width > 600 &&
          t.defaultDimensions.width <= 1000
      )
    ).toBe(true);

    const favOnly = filterCatalogTemplates(V4_MODULE_TEMPLATES, {
      subCat: "tumu",
      selectedFamily: "fam_wardrobe",
      searchQuery: "",
      widthFilter: "all",
      featureFilter: "all",
      showFavoritesOnly: true,
      favoriteIds: ["tpl_kb_05_three_drawers"],
      ignoreSubCategory: true,
    });
    expect(favOnly.map((t) => t.templateId)).toEqual(["tpl_kb_05_three_drawers"]);
  });

  it("clamps parametric dimensions strictly to template dimensionLimits and respects isFixedWidth", () => {
    const threeDrawer = V4_MODULE_TEMPLATES.find(
      (t) => t.templateId === "tpl_kb_05_three_drawers"
    )!;
    expect(threeDrawer).toBeDefined();

    const clamped = clampTemplateDimensions(threeDrawer, {
      width: 2000,
      height: 100,
      depth: 1200,
    });
    expect(clamped.width).toBe(threeDrawer.dimensionLimits.maxW);
    expect(clamped.height).toBe(threeDrawer.dimensionLimits.minH);
    expect(clamped.depth).toBe(threeDrawer.dimensionLimits.maxD);
    expect(clamped.isValid).toBe(false);
    expect(clamped.warnings.length).toBe(3);

    const fixedWidthTpl = V4_MODULE_TEMPLATES.find((t) => t.isFixedWidth)!;
    expect(fixedWidthTpl).toBeDefined();
    const fixedClamp = clampTemplateDimensions(fixedWidthTpl, {
      width: fixedWidthTpl.defaultDimensions.width + 100,
      height: fixedWidthTpl.defaultDimensions.height,
      depth: fixedWidthTpl.defaultDimensions.depth,
    });
    expect(fixedClamp.width).toBe(fixedWidthTpl.defaultDimensions.width);
    expect(fixedClamp.isValid).toBe(false);
  });

  it("applies validated custom dimensions to instantiated module without breaking bays", () => {
    const wardrobe = V4_MODULE_TEMPLATES.find((t) => t.templateId === "tpl_wd_02_two_door")!;
    const base = wardrobe.createInstance("test_mod_1");
    const resized = applyValidatedDimensionsToModule(base, wardrobe, {
      width: 1000,
      height: 2100,
      depth: 600,
    });
    expect(resized.dimensions).toEqual({ width: 1000, height: 2100, depth: 600 });
    expect(resized.bays.length).toBe(base.bays.length);
  });

  it("resolves real width range in cm and compatible hardware from V4_HARDWARE_CATALOG", () => {
    const tpl = V4_MODULE_TEMPLATES.find((t) => t.templateId === "tpl_kb_07_door_internal_drawer")!;
    const range = getTemplateWidthRangeCm(tpl);
    expect(range.minCm).toBe(Math.round(tpl.dimensionLimits.minW / 10));
    expect(range.maxCm).toBe(Math.round(tpl.dimensionLimits.maxW / 10));

    const hw = getCompatibleHardwareForTemplate(tpl);
    expect(hw.primary || hw.alternatives.length > 0).toBeTruthy();
  });
});
