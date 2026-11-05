import { describe, it, expect } from "vitest";
import {
  createInitialProject,
  calculateFourSpaceDimensions,
  evaluateModuleCompatibility,
  evaluateProjectCompatibility,
  migrateV3ProjectToV4,
  DoorSystemId,
  HandleCategory,
  OpeningTechnology,
} from "@birim/core";
import {
  V4_MODULE_FAMILIES,
  V4_MODULE_TEMPLATES,
  DOOR_SYSTEM_DEFINITIONS,
  HANDLE_PROFILES,
  OPENING_MECHANISM_DEFINITIONS,
  V4_HARDWARE_CATALOG,
  getV4TemplateById,
  generateSmartWallLayouts,
  distributeModulesAlongWall,
  batchUpdateModules,
  applyWardrobeInteriorWizard,
  generateKitchenComplementaryModules,
  V4LibraryAdminStore,
  createKitchenLProject,
  createKitchenUProject,
} from "@birim/catalog";
import { generateModuleGeometry, generateElevation2D } from "@birim/geometry";
import { generateBOMForProject } from "@birim/manufacturing";
import { calculateProjectPrice } from "@birim/pricing";
import { MockStoreAdapter, MockERPAdapter } from "@birim/integrations";

describe("Birim Configurator V4 — Universal Furniture Module & Hardware Library", () => {
  describe("1. Universal Module Taxonomy (6 Families, 92 Parametric Templates) & 4-Space Dimension Engine", () => {
    it("verifies exact template counts across all 6 module families (92 total)", () => {
      expect(V4_MODULE_FAMILIES.length).toBe(6);
      expect(V4_MODULE_TEMPLATES.length).toBe(92);

      const countByFamily = (familyId: string) =>
        V4_MODULE_TEMPLATES.filter((t) => t.familyId === familyId).length;

      expect(countByFamily("fam_kitchen_base")).toBe(20);
      expect(countByFamily("fam_kitchen_wall")).toBe(15);
      expect(countByFamily("fam_kitchen_tall")).toBe(12);
      expect(countByFamily("fam_wardrobe")).toBe(20);
      expect(countByFamily("fam_special_corner")).toBe(10);
      expect(countByFamily("fam_complementary")).toBe(15);
    });

    it("instantiates all 92 templates and computes valid 4-space canonical dimensions", () => {
      for (const tpl of V4_MODULE_TEMPLATES) {
        const mod = tpl.createInstance(`inst_${tpl.templateId}`);
        expect(mod).toBeDefined();
        expect(mod.moduleFamilyId).toBe(tpl.familyId);
        expect(mod.dimensions.width).toBeGreaterThan(0);

        const fourSpace = calculateFourSpaceDimensions(mod);
        expect(fourSpace.externalCarcass.widthMm).toBe(mod.dimensions.width);
        expect(fourSpace.usableInternal.netInnerHeightMm).toBeGreaterThanOrEqual(0);
        expect(fourSpace.netPanelCut.sidePanelHeightMm).toBeGreaterThanOrEqual(0);

        const geom = generateModuleGeometry(mod);
        expect(geom.components.length).toBeGreaterThan(0);
      }
    });
  });

  describe("2. 12 Door Systems, 10 Handle Categories, Opening Mechanisms & Hardware Swap", () => {
    it("supports all 12 door motion categories, 10 handle categories, and 5 opening technologies", () => {
      expect(DOOR_SYSTEM_DEFINITIONS.length).toBe(12);
      expect(HANDLE_PROFILES.length).toBe(10);
      expect(OPENING_MECHANISM_DEFINITIONS.length).toBe(5);
      expect(V4_HARDWARE_CATALOG.length).toBeGreaterThanOrEqual(15);

      const baseProj = createInitialProject();
      for (const ds of DOOR_SYSTEM_DEFINITIONS) {
        const proj = JSON.parse(JSON.stringify(baseProj));
        proj.modules[0].bays[0].door.doorSystemId = ds.id;
        const geom = generateModuleGeometry(proj.modules[0], { doorOpenAngleDeg: 60 });
        expect(geom.components.length).toBeGreaterThan(0);
        const elev = generateElevation2D(geom);
        expect(elev.elements.length).toBeGreaterThan(0);
      }
    });

    it("dynamically recalculates CNC drilling coordinates, BOM SKUs, and pricing when swapping hardware (Blum 110° vs Blum 155° vs Hettich TH52 vs Salice)", () => {
      const projBlum110 = createInitialProject();
      projBlum110.modules[0].bays[0].door.hardwareProductId = "hw_blum_71b3550";
      projBlum110.modules[0].bays[0].door.handleCategory = "bar_handle";
      const bomBlum110 = generateBOMForProject(projBlum110);
      const priceBlum110 = calculateProjectPrice(bomBlum110);

      const doorPieceBlum110 = bomBlum110.cutList.find((p) => p.pieceName.includes("Kapak"))!;
      const blum110Cup = doorPieceBlum110.holes!.find((h) => h.id.includes("hinge_cup_0"))!;
      const blum110ScrewA = doorPieceBlum110.holes!.find((h) => h.id.includes("hinge_screw_0_a"))!;
      expect(blum110Cup.depth).toBe(13.0);
      // Blum 45mm pitch (+/-22.5mm), 9.5mm offset from cupX (21.5 + 9.5 = 31.0mm)
      expect(blum110ScrewA.x).toBe(31.0);
      expect(blum110Cup.y - blum110ScrewA.y).toBe(22.5);
      expect(bomBlum110.hardwareList.some((h) => h.sku === "71B3550")).toBe(true);

      // Swap to Blum 155° Zero-Protrusion (71B7550, cupDepth = 11.7mm)
      const projBlum155 = JSON.parse(JSON.stringify(projBlum110));
      projBlum155.modules[0].bays[0].door.hardwareProductId = "hw_blum_71b7550";
      const bomBlum155 = generateBOMForProject(projBlum155);
      const priceBlum155 = calculateProjectPrice(bomBlum155);
      const doorPieceBlum155 = bomBlum155.cutList.find((p) => p.pieceName.includes("Kapak"))!;
      const blum155Cup = doorPieceBlum155.holes!.find((h) => h.id.includes("hinge_cup_0"))!;
      expect(blum155Cup.depth).toBe(11.7);
      expect(bomBlum155.hardwareList.some((h) => h.sku === "71B7550")).toBe(true);
      expect(priceBlum155.totalWithVatEur).toBeGreaterThan(priceBlum110.totalWithVatEur);

      // Swap to Hettich Sensys 8645i TH52 (9071205, 52mm pitch -> +/-26.0mm, 5.5mm offset -> 21.5+5.5=27.0mm, depth 12.8mm)
      const projHettich = JSON.parse(JSON.stringify(projBlum110));
      projHettich.modules[0].bays[0].door.hardwareProductId = "hw_hettich_9071205";
      const bomHettich = generateBOMForProject(projHettich);
      const doorPieceHettich = bomHettich.cutList.find((p) => p.pieceName.includes("Kapak"))!;
      const hettichCup = doorPieceHettich.holes!.find((h) => h.id.includes("hinge_cup_0"))!;
      const hettichScrewA = doorPieceHettich.holes!.find((h) => h.id.includes("hinge_screw_0_a"))!;
      expect(hettichCup.depth).toBe(12.8);
      expect(hettichScrewA.x).toBe(27.0);
      expect(hettichCup.y - hettichScrewA.y).toBe(26.0);
      expect(bomHettich.hardwareList.some((h) => h.sku === "9071205")).toBe(true);

      // Swap to Salice Silentia+ (C7P6AE9, 48mm pitch -> +/-24.0mm, 9.0mm offset -> 21.5+9.0=30.5mm, depth 12.0mm)
      const projSalice = JSON.parse(JSON.stringify(projBlum110));
      projSalice.modules[0].bays[0].door.hardwareProductId = "hw_salice_c7p6ae9";
      const bomSalice = generateBOMForProject(projSalice);
      const doorPieceSalice = bomSalice.cutList.find((p) => p.pieceName.includes("Kapak"))!;
      const saliceCup = doorPieceSalice.holes!.find((h) => h.id.includes("hinge_cup_0"))!;
      const saliceScrewA = doorPieceSalice.holes!.find((h) => h.id.includes("hinge_screw_0_a"))!;
      expect(saliceCup.depth).toBe(12.0);
      expect(saliceScrewA.x).toBe(30.5);
      expect(saliceCup.y - saliceScrewA.y).toBe(24.0);

      // Swap to Inset door -> side panel front row shifts from 37mm to 57mm
      const projInset = JSON.parse(JSON.stringify(projBlum110));
      projInset.modules[0].bays[0].door.overlayType = "inset";
      const bomInset = generateBOMForProject(projInset);
      const sidePanelInset = bomInset.cutList.find((p) => p.pieceName.includes("Sol Yan"))!;
      const frontPinHole = sidePanelInset.holes!.find((h) => h.purpose === "shelf_pin")!;
      expect(frontPinHole.x).toBe(57);
    });
  });

  describe("3. Universal 15-Category Compatibility Engine & Property-Based Validation Sweep", () => {
    it("detects 110° hinge + internal pull-out drawer collision and suggests 155° zero-protrusion hinge", () => {
      const tpl = getV4TemplateById("tpl_kt_03_pantry_internal_drawers")!;
      const mod = tpl.createInstance("mod_pantry_test");
      // Force standard 110° hinge on a bay with internal drawer
      mod.bays[0].door.hardwareProductId = "hw_blum_71b3550";
      const issues = evaluateModuleCompatibility(mod);
      expect(issues.some((i) => i.code === "CHK_07_INTERNAL_DRAWER_REQUIRES_ZERO_PROTRUSION")).toBe(
        true
      );

      // Upgrade to 155° zero protrusion hinge -> issue resolved
      mod.bays[0].door.hardwareProductId = "hw_blum_71b7550";
      const fixedIssues = evaluateModuleCompatibility(mod);
      expect(
        fixedIssues.some((i) => i.code === "CHK_07_INTERNAL_DRAWER_REQUIRES_ZERO_PROTRUSION")
      ).toBe(false);
    });

    it("detects handleless push-to-open without TIP-ON/SERVO-DRIVE and blocks unverified CNC items", () => {
      const tpl = getV4TemplateById("tpl_kb_01_single_door")!;
      const mod = tpl.createInstance("mod_kb1");
      mod.bays[0].door.handleCategory = "handleless_plain";
      mod.bays[0].door.openingTechnology = "soft_close";
      const proj = { ...createInitialProject(), modules: [mod] };
      const res = evaluateProjectCompatibility(proj);
      expect(res.overallStatus).toBe("INCOMPATIBLE");
      expect(res.issues.some((i) => i.code === "CHK_08_HANDLELESS_REQUIRES_PUSH_OR_SERVO")).toBe(true);

      // Tambour door is UNVERIFIED for CNC
      const modTambour = tpl.createInstance("mod_tambour");
      modTambour.bays[0].door.doorSystemId = "tambour_roller";
      const resTambour = evaluateProjectCompatibility({
        ...createInitialProject(),
        modules: [modTambour],
      });
      expect(resTambour.overallStatus).toBe("UNVERIFIED");
      expect(resTambour.canApproveProduction).toBe(false);
    });

    it("runs deterministic property-based sweep across module dimensions, door systems, and handles", () => {
      const widths = [350, 600, 900, 1200, 2000];
      const doorSystems: DoorSystemId[] = [
        "hinged_single",
        "hinged_double",
        "hinged_inset",
        "lift_parallel",
        "sliding_top_hung",
      ];
      const handles: HandleCategory[] = ["bar_handle", "gola_profile", "handleless_plain"];
      const techs: OpeningTechnology[] = ["soft_close", "push_to_open", "servo_electric"];

      const tpl = getV4TemplateById("tpl_kb_01_single_door")!;
      for (const w of widths) {
        for (const ds of doorSystems) {
          for (const h of handles) {
            const tech: OpeningTechnology = h === "handleless_plain" ? techs[1] : techs[0];
            const mod = tpl.createInstance("mod_prop");
            mod.dimensions.width = w;
            mod.bays[0].door.doorSystemId = ds;
            mod.bays[0].door.handleCategory = h;
            mod.bays[0].door.openingTechnology = tech;

            const evalRes = evaluateProjectCompatibility({
              ...createInitialProject(),
              modules: [mod],
            });
            expect(["COMPATIBLE", "COMPATIBLE_WITH_CONDITIONS", "INCOMPATIBLE", "UNVERIFIED"]).toContain(
              evalRes.overallStatus
            );
          }
        }
      }
    });
  });

  describe("4. 10 Required Reference Production Scenarios", () => {
    it("executes all 10 reference scenarios end-to-end (3D, 2D, BOM, Pricing, Compatibility)", () => {
      // 1. 2-Door Hinged Wardrobe
      const s1Mod = getV4TemplateById("tpl_wd_02_two_door")!.createInstance("s1");
      expect(
        evaluateProjectCompatibility({ ...createInitialProject(), modules: [s1Mod] })
          .canApproveProduction
      ).toBe(false);

      // 2. 4-Carcass Master Wardrobe (3600mm Wall Smart Builder)
      const s2Proposals = generateSmartWallLayouts(3600, 2200, 600, "wardrobe");
      const s2Equal4 = s2Proposals.find((p) => p.id === "smart_layout_4_equal")!;
      const s2Mods = s2Equal4.buildModules();
      expect(s2Mods.length).toBe(4);
      expect(s2Mods.reduce((acc, m) => acc + m.dimensions.width, 0) + 60).toBe(3600);

      // 3. 2-Door Sliding Wardrobe (TopLine L)
      const s3Mod = getV4TemplateById("tpl_wd_05_sliding_2door")!.createInstance("s3");
      const s3Proj = { ...createInitialProject(), modules: [s3Mod] };
      const s3Bom = generateBOMForProject(s3Proj);
      expect(s3Bom.hardwareList.some((h) => h.sku === "TopLineL_50")).toBe(true);

      // 4. Retractable Pocket Door Cabinet (REVEGO uno)
      const s4Mod = getV4TemplateById("tpl_kt_11_pocket_appliance")!.createInstance("s4");
      const s4Bom = generateBOMForProject({ ...createInitialProject(), modules: [s4Mod] });
      expect(s4Bom.hardwareList.some((h) => h.sku === "REVEGO_UNO_650")).toBe(true);

      // 5. Lift-Up Kitchen Wall Cabinet (AVENTOS HF top)
      const s5Mod = getV4TemplateById("tpl_kw_06_lift_bifold")!.createInstance("s5");
      const s5Bom = generateBOMForProject({ ...createInitialProject(), modules: [s5Mod] });
      expect(s5Bom.hardwareList.some((h) => h.sku === "22F2510+22F3500")).toBe(true);

      // 6. Metal-Box Drawer Unit (LEGRABOX M)
      const s6Mod = getV4TemplateById("tpl_kb_05_three_drawers")!.createInstance("s6");
      const s6Bom = generateBOMForProject({ ...createInitialProject(), modules: [s6Mod] });
      expect(s6Bom.hardwareList.some((h) => h.sku.startsWith("750.5001S"))).toBe(true);

      // 7. L-Corner Kitchen
      const s7Proj = createKitchenLProject();
      const s7Corner = getV4TemplateById("tpl_kb_14_l_corner")!.createInstance("s7_corner");
      s7Proj.modules.push(s7Corner);
      const s7Bom = generateBOMForProject(s7Proj);
      expect(s7Bom.cutList.length).toBeGreaterThan(15);

      // 8. U-Kitchen with Auto-Generated Complementary Modules
      const s8Proj = createKitchenUProject();
      const s8WithComp = generateKitchenComplementaryModules(s8Proj.modules);
      expect(s8WithComp.length).toBeGreaterThan(s8Proj.modules.length);

      // 9. Built-In Appliance Tower (EN 1116 600mm width check)
      const s9Mod = getV4TemplateById("tpl_kt_05_oven_microwave_tower")!.createInstance("s9");
      expect(
        evaluateProjectCompatibility({ ...createInitialProject(), modules: [s9Mod] })
          .canApproveProduction
      ).toBe(false);

      // 10. Open Walk-In Closet + Wardrobe Interior Wizard
      const s10Mod = applyWardrobeInteriorWizard(
        getV4TemplateById("tpl_wd_14_walkin_l_unit")!.createInstance("s10"),
        "wiz_drawer_heavy"
      );
      expect(s10Mod.bays[0].drawers.length).toBe(4);

      // Batch update & distribution helper verification
      const { updatedModules, leftFillerMm, rightFillerMm } = distributeModulesAlongWall(
        s2Mods,
        4000
      );
      expect(
        updatedModules.reduce((acc, m) => acc + m.dimensions.width, 0) +
          leftFillerMm +
          rightFillerMm
      ).toBe(4000);
      const batched = batchUpdateModules(updatedModules, [0, 1], {
        handleCategory: "gola_profile",
      });
      expect(batched[0].bays[0].door.handleCategory).toBe("gola_profile");
    });
  });

  describe("5. Library Admin Lifecycle State Machine, Store/ERP Fail-Closed Gate & V3.1 Migration", () => {
    it("enforces verification gates before VERIFIED / PUBLISHED in V4LibraryAdminStore", () => {
      const store = new V4LibraryAdminStore();
      const draft = store.createDraftHardwareEntry({
        id: "hw_test_custom_hinge",
        sku: "71B3550-TEST",
        name: "Blum Custom 110 Menteşe",
        manufacturerName: "Julius Blum GmbH",
        sourceId: "SRC_BLUM_CAT_HINGE",
      });

      expect(draft.lifecycleState).toBe("DRAFT");
      store.transitionLifecycleState(draft.id, "REVIEW");
      expect(store.getEntry(draft.id)?.lifecycleState).toBe("REVIEW");

      // Should fail verification because verification flags are false
      const failedVerify = store.transitionLifecycleState(draft.id, "VERIFIED");
      expect(failedVerify.success).toBe(false);

      // Complete verification gates
      store.updateVerificationFlags(draft.id, {
        sourceTechDataVerified: true,
        cadGeometryVerified: true,
        bomFormulaVerified: true,
        drillingPatternVerified: true,
        physicalFactorySampleTested: true,
      });
      const okVerify = store.transitionLifecycleState(draft.id, "VERIFIED");
      expect(okVerify.success).toBe(true);

      const okPublish = store.transitionLifecycleState(draft.id, "PUBLISHED");
      expect(okPublish.success).toBe(true);
      expect(store.getEntry(draft.id)?.lifecycleState).toBe("PUBLISHED");
    });

    it("migrates V3.1 projects with zero data loss and blocks ERP export on UNVERIFIED designs", async () => {
      const legacyProj = createInitialProject();
      const bomBefore = generateBOMForProject(legacyProj);
      const priceBefore = calculateProjectPrice(bomBefore);

      const migratedProj = migrateV3ProjectToV4(legacyProj);
      expect(migratedProj.libraryVersionId).toBe("lib_v4_0_0");
      expect(migratedProj.constructionProfileId).toBe("profile_birim_factory_std");
      expect(migratedProj.modules[0].moduleFamilyId).toBe("fam_wardrobe");

      const bomAfter = generateBOMForProject(migratedProj);
      const priceAfter = calculateProjectPrice(bomAfter);
      expect(bomAfter.summary.totalPiecesCount).toBe(bomBefore.summary.totalPiecesCount);
      expect(priceAfter.totalWithVatEur).toBe(priceBefore.totalWithVatEur);

      // Store adapter includes V4 fields
      const storeAdapter = new MockStoreAdapter();
      const quoteRes = await storeAdapter.createOrUpdateQuoteItem(
        migratedProj,
        bomAfter,
        priceAfter,
        "quote_v4_01"
      );
      const snap = storeAdapter.getSnapshot(quoteRes.snapshotId)!;
      expect(snap.configuratorSnapshot.libraryVersionId).toBe("lib_v4_0_0");
      expect(snap.configuratorSnapshot.compatibilityStatus).toBe("UNVERIFIED");

      // ERP adapter blocks UNVERIFIED bespoke/sloped ceiling design
      const erpAdapter = new MockERPAdapter();
      const unverifiedMod = getV4TemplateById("tpl_sc_05_sloped_ceiling")!.createInstance("unv_1");
      const unverifiedProj = {
        ...createInitialProject(),
        modules: [unverifiedMod],
      };
      const unverifiedBom = generateBOMForProject(unverifiedProj);
      await expect(
        erpAdapter.publishProductionBlueprint(unverifiedProj, unverifiedBom, "order_blocked_01")
      ).rejects.toThrow(/UNVERIFIED/);
    });
  });
});
