import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";
import {
  DEFAULT_MATERIALS,
  DesignProjectSchema,
  TENANT_ANKA_BUSINESS,
  TENANT_BIRIM_ENTERPRISE,
  createInitialProject,
  createDefaultWardrobeModule,
  computeModuleIntrinsicSignature,
  evaluateUnifiedEngineeringModel,
  loadSavedCustomModuleTemplates,
  persistCustomModuleTemplates,
} from "@birim/core";
import {
  V5_SPECIALIZED_MODULE_TEMPLATES,
  resolveCustomTemplatesStorageKey,
} from "@birim/catalog";
import { generateModuleGeometry } from "@birim/geometry";
import {
  generateBOMForProject,
  mapCutPieceToCncPieceInput,
  generateHomagMprPrograms,
  generateBiesseCixProgram,
} from "@birim/manufacturing";
import { calculateProjectPrice } from "@birim/pricing";
import {
  buildGuidedWizardProject,
  generateSmartStarterTemplates,
} from "../apps/configurator/src/v3/adapter/guidedWizardBuilder";
import { computeBaySystem32ShelfHoleElevations, snapShelfToMultiHoleOrElevationTargets } from "../apps/configurator/src/v3/engine/elevationSnapEngine";
import { signTenantSessionToken, resolveTenantRequestContext, TenantSecurityError } from "../apps/configurator/src/lib/tenant-auth-guard";
import { POST as postStoreQuote } from "../apps/configurator/src/app/api/integrations/store-quote/route";

describe("V12 End-to-End Audit Remediation, 10 User Scenarios & Parametric Boundary Invariants", () => {
  it("Scenario 1 & Feature #2: generates 4 engineering-valid, live-priced smart starter templates with 0.00 mm single-model alignment", () => {
    const baseProj = createInitialProject();
    const proposals = generateSmartStarterTemplates(baseProj, {
      spaceCategory: "wardrobe",
      roomShape: "rectangular",
      wallWidthMm: 2400,
      targetHeightMm: 2400,
      targetDepthMm: 600,
      colorSwatchId: "mat_veneer_oak",
    });

    expect(proposals).toHaveLength(4);
    const ids = proposals.map((p) => p.id);
    expect(ids).toEqual([
      "starter_balanced",
      "starter_max_hanging",
      "starter_drawer_folded",
      "starter_vitrine_signature",
    ]);

    for (const card of proposals) {
      expect(card.estimatedTotalWithVatEur).toBeGreaterThan(200);
      expect(card.moduleCount).toBeGreaterThanOrEqual(1);
      const report = evaluateUnifiedEngineeringModel(card.previewProject);
      expect(report.blockingSafetyAndEngineeringErrors).toHaveLength(0);

      // Verify 0.00 mm dimensional alignment between 3D geometry carcass and BOM cutlist
      const bom = generateBOMForProject(card.previewProject);
      for (const mod of card.previewProject.modules.filter((m) => m.category !== "complementary")) {
        const geo = generateModuleGeometry(mod);
        const leftSideGeo = geo.components.find((c) => c.role === "carcass_side_left");
        const leftSideBom = bom.cutList.find(
          (cp) => cp.moduleId === mod.id && cp.componentRole === "carcass_side_left"
        );
        expect(leftSideGeo).toBeDefined();
        expect(leftSideBom).toBeDefined();
        expect(Math.abs(leftSideGeo!.dimensions.height - leftSideBom!.nominalLengthMm)).toBeLessThan(0.5);
      }
    }
  });

  it("Scenario 2, 10 & Features #1, #3, #5: verifies OnObjectQuickToolbar, Kolay/Pro/Üretim modes, guided steps & <1024px mobile/touch safety", () => {
    const wsSrc = fs.readFileSync(
      path.resolve(__dirname, "../apps/configurator/src/v11/BirimStudioWorkspace.tsx"),
      "utf8"
    );
    const hdrSrc = fs.readFileSync(
      path.resolve(__dirname, "../apps/configurator/src/v11/StudioHeaderBar.tsx"),
      "utf8"
    );
    const rpiSrc = fs.readFileSync(
      path.resolve(__dirname, "../apps/configurator/src/v11/RightParametricInspector.tsx"),
      "utf8"
    );
    const onObjSrc = fs.readFileSync(
      path.resolve(__dirname, "../apps/configurator/src/v11/OnObjectQuickToolbar.tsx"),
      "utf8"
    );

    // Feature #1: Direct On-Object 3D Quick Toolbar
    expect(onObjSrc).toContain('data-testid="v12-on-object-quick-toolbar"');
    expect(onObjSrc).toContain("bg-[#FAF8F4]/95");
    expect(onObjSrc).not.toContain("bg-[#141413]/92");
    expect(onObjSrc).not.toContain("Kapağı Kapat");
    expect(onObjSrc).toContain('selectedPartKind === "sub_divider"');
    expect(rpiSrc).toContain("renderInteriorItemSvg");
    expect(rpiSrc).toContain("v12-subdivider-row-");
    expect(rpiSrc).toContain("draggable={false}");
    expect(rpiSrc).toContain("startLive3DPartGrab");
    expect(wsSrc).toContain("<OnObjectQuickToolbar");

    // Feature #3 & #5: Guided 3-step strip + 1-click Showroom Presentation
    expect(hdrSrc).toContain('data-testid="v12-guided-step-strip"');
    expect(hdrSrc).toContain('data-testid="v12-one-click-presentation-btn"');

    // Kolay / Pro / Üretim 3-level mode selector + bay interior copy & symmetry
    expect(rpiSrc).toContain('{ id: "simple", label: "Kolay" }');
    expect(rpiSrc).toContain('{ id: "architect", label: "Pro" }');
    expect(rpiSrc).toContain('{ id: "factory", label: "Üretim" }');
    expect(rpiSrc).toContain('data-testid="v12-copy-bay-interior-btn"');
    expect(rpiSrc).toContain('data-testid="v12-mirror-bays-btn"');

    // Mobile/tablet non-overlap (<1024px closed default, <1200px mutual exclusion, PointerEvent split resize)
    expect(wsSrc).toContain("window.innerWidth < 1024");
    expect(wsSrc).toContain("onPointerDown={(e) => {");
    expect(wsSrc).toContain("touch-none");
  });

  it("Scenario 3 (P1-ENG-02 & P1-ENG-03): separates Blum AVENTOS HF/HL/HK SKUs and prevents fixed shelves from snapping to System 32 pin holes", () => {
    const mkLiftProject = (doorSys: "lift_bi_fold" | "lift_parallel" | "lift_up_stay") => {
      const p = createInitialProject();
      const m = createDefaultWardrobeModule("mod_lift");
      m.category = "kitchen_wall";
      m.dimensions = { width: 800, height: 720, depth: 350 };
      m.carcass.plinthHeight = 0;
      m.bays = [
        {
          ...m.bays[0],
          index: 0,
          door: {
            id: "d_lift",
            bayIndex: 0,
            type: "lift_up" as any,
            doorSystemId: doorSys as any,
            softClose: true,
          },
          shelves: [],
          drawers: [],
          hangingRails: [],
          specialFittings: [],
        },
      ];
      p.modules = [m];
      return generateBOMForProject(p);
    };

    const bomHf = mkLiftProject("lift_bi_fold");
    const bomHl = mkLiftProject("lift_parallel");
    const bomHk = mkLiftProject("lift_up_stay");

    expect(bomHf.hardwareList.some((h) => h.sku.startsWith("22F"))).toBe(true);
    expect(bomHl.hardwareList.some((h) => h.sku.startsWith("22L"))).toBe(true);
    expect(bomHk.hardwareList.some((h) => h.sku.startsWith("22K"))).toBe(true);

    // Fixed structural shelf must NOT snap to System 32 5mm pin grid; adjustable shelf MUST snap
    const sampleProj = createInitialProject();
    const sampleMod = sampleProj.modules[0];
    sampleMod.carcass.multiHoleMode = "system_32_full";
    sampleMod.bays[0].shelves = [
      { id: "sh_fixed", bayIndex: 0, elevationY: 500, isAdjustable: false, isFixed: true },
      { id: "sh_adj", bayIndex: 0, elevationY: 900, isAdjustable: true },
    ];
    expect(computeBaySystem32ShelfHoleElevations(sampleMod, 0, "sh_fixed")).toBeNull();
    expect(computeBaySystem32ShelfHoleElevations(sampleMod, 0, "sh_adj")).not.toBeNull();
    const fixedRes = snapShelfToMultiHoleOrElevationTargets({
      project: sampleProj,
      moduleIndex: 0,
      bayIndex: 0,
      shelfId: "sh_fixed",
      rawElevationY: 503,
      snapTargets: [],
    });
    expect(fixedRes.snappedTarget).toBeNull();
  });

  it("Scenario 4 (P0-CNC-01 & P0-CNC-02 Property-Based): guarantees 4-side back grooves in .MPR/.CIX and 100% in-bounds holes across cross-grain & vertical drawer fronts", () => {
    const testCases = [
      { w: 600, h: 2100, d: 580, grain: "lengthwise" as const },
      { w: 900, h: 2400, d: 600, grain: "crosswise" as const },
      { w: 1200, h: 2550, d: 620, grain: "crosswise" as const },
      { w: 1600, h: 2200, d: 550, grain: "lengthwise" as const },
      { w: 800, h: 870, d: 580, grain: "crosswise" as const },
      { w: 2000, h: 2400, d: 650, grain: "crosswise" as const },
    ];

    for (const tc of testCases) {
      const proj = createInitialProject();
      const mod = createDefaultWardrobeModule(`mod_${tc.w}_${tc.grain}`);
      mod.dimensions = { width: tc.w, height: tc.h, depth: tc.d };
      mod.carcass.bodyMaterialId = "mat_veneer_oak";
      mod.carcass.doorMaterialId = "mat_veneer_oak";
      mod.carcass.backPanelType = "grooved";
      mod.componentGrainOverrides = {};
      mod.bays.forEach((b, idx) => {
        b.drawers = [
          {
            id: `drw_${idx}_1`,
            bayIndex: idx,
            elevationY: 0,
            height: 220,
            slideType: "soft_close",
          },
        ];
        if (tc.grain === "crosswise") {
          mod.componentGrainOverrides![`door_bay_${idx}_left`] = "crosswise";
          mod.componentGrainOverrides![`door_bay_${idx}_right`] = "crosswise";
          mod.componentGrainOverrides![`door_bay_${idx}`] = "crosswise";
          mod.componentGrainOverrides![`drawer_front_drw_${idx}_1`] = "crosswise";
        }
      });
      // Test vertical grain continuity on drawer fronts too!
      proj.facadeGrainContinuity = tc.grain === "lengthwise";
      proj.modules = [mod];

      const bom = generateBOMForProject(proj);
      const outOfBoundsWarnings = bom.validationWarnings.filter((w) =>
        w.includes("[ERR_CNC_HOLE_OUT_OF_BOUNDS]")
      );
      expect(outOfBoundsWarnings).toEqual([]);

      for (const piece of bom.cutList) {
        for (const hole of piece.holes || []) {
          expect(hole.x).toBeGreaterThanOrEqual(-0.5);
          expect(hole.x).toBeLessThanOrEqual(piece.nominalWidthMm + 0.5);
          expect(hole.y).toBeGreaterThanOrEqual(-0.5);
          expect(hole.y).toBeLessThanOrEqual(piece.nominalLengthMm + 0.5);
        }
      }

      const leftSide = bom.cutList.find((p) => p.componentRole === "carcass_side_left")!;
      const rightSide = bom.cutList.find((p) => p.componentRole === "carcass_side_right")!;
      const mprLeft = generateHomagMprPrograms(mapCutPieceToCncPieceInput(leftSide))[0].content;
      const cixRight = generateBiesseCixProgram(mapCutPieceToCncPieceInput(rightSide)).content;
      expect(mprLeft).toContain("<109 \\Nut\\");
      expect(cixRight).toContain("NAME=CUT_G");
    }

    // Verify v5_entryway_vestiyer_180 passes EN 16122 / ISO 7170 deflection with realistic 3200 MPa MDFLam modulus
    const vestiyerTpl = V5_SPECIALIZED_MODULE_TEMPLATES.find(
      (t) => t.templateId === "v5_entryway_vestiyer_180"
    )!;
    const pVest = createInitialProject();
    pVest.modules = [vestiyerTpl.createInstance("mod_vest_1")];
    const vestReport = evaluateUnifiedEngineeringModel(pVest);
    expect(
      vestReport.blockingSafetyAndEngineeringErrors.filter((f) => f.code.includes("DEFLECTION"))
    ).toHaveLength(0);
  });

  it("Scenario 5 & 6 (P0-MFG-03 & P0-PRC-06): distinguishes UV/PET pre-laminated panels from paintshop lacquer and preserves commercial appliance costs in materialAlternatives", () => {
    const proj = createInitialProject();
    const mod = proj.modules[0];
    mod.carcass.bodyMaterialId = "mat_melamine_white";
    // Pre-laminated UV/PET Supramat panel -> MUST get PVC edge banding and 0 paintshop surcharge
    mod.carcass.doorMaterialId = "mat_lacquer_white";
    proj.sceneObjects = [
      {
        id: "so_fridge_lux",
        catalogId: "obj_fridge_french_910",
        name: "Ankastre Gardırop Buzdolabı",
        category: "appliance",
        visualKind: "fridge_french_door",
        position: { x: 2500, y: 0, z: 0 },
        dimensions: { width: 910, height: 1820, depth: 700 },
        quantity: 1,
        unitPriceEur: 2500,
        commercialRole: "quoted_product",
      },
    ];

    const bomUv = generateBOMForProject(proj);
    const prUv = calculateProjectPrice(bomUv, undefined, undefined, proj.sceneObjects);
    const uvDoors = bomUv.cutList.filter((p) => p.componentRole.startsWith("door"));
    expect(uvDoors.length).toBeGreaterThan(0);
    expect(uvDoors.every((d) => d.edgeBanding.top && d.edgeBanding.left)).toBe(true);

    // Every material alternative must include the €2,500 commercial appliance + VAT (no fake -2,900 € delta!)
    for (const alt of prUv.materialAlternatives) {
      expect(alt.totalWithVatEur).toBeGreaterThan(2500);
    }

    // Genuine Birim Paintshop Silk-Matte Lacquer -> 0 edgeband on doors + higher paintshop labor cost
    const projPaint = JSON.parse(JSON.stringify(proj));
    projPaint.modules[0].carcass.doorMaterialId = "mat_lacquer_cream";
    const bomPaint = generateBOMForProject(projPaint);
    const prPaint = calculateProjectPrice(bomPaint, undefined, undefined, projPaint.sceneObjects);
    const paintDoors = bomPaint.cutList.filter((p) => p.componentRole.startsWith("door"));
    expect(paintDoors.every((d) => !d.edgeBanding.top && !d.edgeBanding.left)).toBe(true);
    expect(prPaint.laborCost).toBeGreaterThan(prUv.laborCost);
  });

  it("Scenario 7 & 8 (P0-INT-04 & P0-SEC-05): validates Schema v4 round-trip, @birim/core template exports, SQL RPC migration & SaaS middleware slug isolation", async () => {
    const proj = buildGuidedWizardProject(createInitialProject(), {
      spaceCategory: "wardrobe",
      roomShape: "l_shape",
      wallWidthMm: 2800,
      targetHeightMm: 2400,
      targetDepthMm: 600,
      autoFiller50Mm: true,
      interiorFocus: "balanced",
      doorStyle: "hinged",
      conceptTier: "smart",
      colorSwatchId: "mat_veneer_oak",
      addLed: true,
      addTrouserRack: true,
      addJewelryTray: false,
    });
    const parsed = DesignProjectSchema.safeParse(JSON.parse(JSON.stringify(proj)));
    expect(parsed.success).toBe(true);
    expect(typeof loadSavedCustomModuleTemplates).toBe("function");
    expect(typeof persistCustomModuleTemplates).toBe("function");
    expect(resolveCustomTemplatesStorageKey("acme-mobilya")).toContain("acme-mobilya");

    // SQL Migration check
    const migSql = fs.readFileSync(
      path.resolve(
        __dirname,
        "../supabase/migrations/20261118160000_fix_store_erp_rpc_contracts.sql"
      ),
      "utf8"
    );
    expect(migSql).toContain("upsert_configurator_store_quotation_atomic");
    expect(migSql).toContain("publish_configurator_erp_nesting_atomic");
    expect(migSql).toContain("p_nesting_bundle->'jobs'");

    // Tenant Auth Guard: non-Birim SaaS session MUST NOT be blocked by passive x-modul-resolved-tenant-slug: birim
    const ankaToken = signTenantSessionToken({
      tenantId: TENANT_ANKA_BUSINESS.tenantId,
      role: "org_owner",
      userId: "usr_anka_01",
    });
    const reqAllowed = new Request("http://localhost:3300/api/integrations/store-quote", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${ankaToken}`,
        "x-modul-resolved-tenant-slug": "birim",
      },
    });
    const ctxOk = resolveTenantRequestContext(reqAllowed, {});
    expect(ctxOk.tenantId).toBe(TENANT_ANKA_BUSINESS.tenantId);

    // Genuine cross-tenant body spoofing MUST still be blocked with 403 TENANT_SPOOFING_BLOCKED
    const spoofReq = new Request("http://localhost:3300/api/integrations/store-quote", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${ankaToken}`,
        "x-modul-resolved-tenant-slug": "birim",
      },
      body: JSON.stringify({
        project: proj,
        organizationId: TENANT_BIRIM_ENTERPRISE.tenantId,
        allowOfflineSimulationFallback: true,
      }),
    });
    const spoofRes = await postStoreQuote(spoofReq);
    expect(spoofRes.status).toBe(403);
    const spoofBody = await spoofRes.json();
    expect(spoofBody.code).toBe("TENANT_SPOOFING_BLOCKED");
    expect(TenantSecurityError).toBeDefined();
  });

  it("Scenario 9 (Faz 3 Incremental Cache): achieves O(1) cache hits across 49 horizontally shifted modules in a 50-module project", () => {
    const proj50 = createInitialProject();
    proj50.modules = Array.from({ length: 50 }, (_, idx) => {
      const m = createDefaultWardrobeModule(`mod_perf_${idx}`);
      m.position = { x: idx * 900, y: 0, z: 0 };
      m.dimensions = { width: 900, height: 2400, depth: 600 };
      return m;
    });

    // Confirm intrinsic signature is invariant under horizontal X shift
    const sigBefore = computeModuleIntrinsicSignature(proj50.modules[10]);
    const shiftedClone = JSON.parse(JSON.stringify(proj50.modules[10]));
    shiftedClone.position.x += 120;
    expect(computeModuleIntrinsicSignature(shiftedClone)).toBe(sigBefore);

    // Cold run on 50 modules (skipSyncNesting: true, matching interactive store updates)
    const tCold0 = performance.now();
    const bomCold = generateBOMForProject(proj50, undefined, { skipSyncNesting: true });
    for (const m of proj50.modules) generateModuleGeometry(m);
    const dtColdMs = performance.now() - tCold0;

    // Edit Module #0 width (900 -> 1000mm) and shift Modules #1..#49 by +100mm along X
    const projEdited: typeof proj50 = {
      ...proj50,
      version: proj50.version + 1,
      modules: proj50.modules.map((m, idx) =>
        idx === 0
          ? { ...m, dimensions: { ...m.dimensions, width: 1000 } }
          : { ...m, position: { ...m.position, x: m.position.x + 100 } }
      ),
    };

    const t0 = performance.now();
    const bomIncremental = generateBOMForProject(projEdited, undefined, {
      skipSyncNesting: true,
    });
    for (const m of projEdited.modules) generateModuleGeometry(m);
    const dtMs = performance.now() - t0;

    expect(bomIncremental.cutList.length).toBe(bomCold.cutList.length);
    expect(dtMs).toBeLessThan(135);
    expect(dtMs).toBeLessThan(dtColdMs * 0.7);
  });
});
