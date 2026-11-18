import { describe, it, expect } from "vitest";
import {
  HARDWARE_ENGINEERING_RULES_VERSION,
  HARDWARE_PRODUCTION_STATUS_META,
  evaluateHardwareMountPlacement,
  evaluateHardwareAfterModuleResize,
  evaluateProjectHardwareProductionGate,
  resolveHardwareProductionStatus,
  type ModuleInstance,
} from "@birim/core";
import {
  V4_HARDWARE_CATALOG,
  HARDWARE_CATEGORY_GROUPS,
  getHardwareProductById,
  getAllHardwareProducts,
} from "@birim/catalog";
import { generateDrillingForPart } from "@birim/manufacturing";

function createTestModule(overrides?: Partial<ModuleInstance>): ModuleInstance {
  return {
    id: "mod_test_hw",
    name: "Test Mutfak Alt Modül",
    category: "kitchen_base",
    position: { x: 0, y: 0, z: 0 },
    dimensions: { width: 600, height: 820, depth: 560 },
    carcass: {
      panelThickness: 18,
      backPanelThickness: 8,
      backPanelType: "grooved",
      plinthHeight: 100,
      doorPerimeterGap: 2,
      edgeBandThickness: 1,
      bodyMaterialId: "mat_white",
      doorMaterialId: "mat_white",
      jointType: "minifix_dowel",
      doorThickness: 18,
    },
    bays: [
      {
        index: 0,
        shelves: [],
        hangingRails: [],
        drawers: [],
        specialFittings: [],
        door: {
          id: "door_0",
          bayIndex: 0,
          type: "single_left",
          doorSystemId: "hinged_single",
          softClose: true,
          hardwareProductId: "hw_blum_71b3550",
        },
      },
    ],
    ...overrides,
  };
}

describe("Birim Configurator — Akıllı Donanım Sistemi & Mühendislik Doğrulaması", () => {
  it("preserves all 19 original hardware IDs and expands catalog across all 13 families", () => {
    const originalIds = [
      "hw_blum_71b3550",
      "hw_blum_71b3650",
      "hw_blum_71b3750",
      "hw_blum_71b7550",
      "hw_blum_71b9550",
      "hw_hettich_9071205",
      "hw_hettich_9099540",
      "hw_salice_c7p6ae9",
      "hw_blum_legrabox_m40",
      "hw_blum_legrabox_c70",
      "hw_blum_tandembox_m30",
      "hw_blum_movento_760h",
      "hw_hettich_avantech_m",
      "hw_blum_aventos_hk_27",
      "hw_blum_aventos_hf_25",
      "hw_blum_aventos_hl_25",
      "hw_hettich_topline_l",
      "hw_hafele_slido_bottom",
      "hw_hettich_wingline_l",
      "hw_blum_revego_uno",
      "hw_hawa_concepta3_25",
    ];
    originalIds.forEach((id) => {
      expect(getHardwareProductById(id), `Missing legacy ID ${id}`).toBeDefined();
    });
    expect(V4_HARDWARE_CATALOG.length).toBeGreaterThanOrEqual(40);
    expect(HARDWARE_CATEGORY_GROUPS.length).toBe(13);
    expect(HARDWARE_ENGINEERING_RULES_VERSION).toBe("2026.11.1");
  });

  it("strictly separates production_ready, review_required, and visual_only products", () => {
    const blum110 = getHardwareProductById("hw_blum_71b3550")!;
    const hettichQuadro = getHardwareProductById("hw_hettich_quadro_v6_silent")!;
    const visualTrouser = getHardwareProductById("hw_wardrobe_trouser_rack_visual")!;

    expect(resolveHardwareProductionStatus(blum110)).toBe("production_ready");
    expect(resolveHardwareProductionStatus(hettichQuadro)).toBe("review_required");
    expect(resolveHardwareProductionStatus(visualTrouser)).toBe("visual_only");

    expect(HARDWARE_PRODUCTION_STATUS_META.production_ready.canAutoExportCnc).toBe(true);
    expect(HARDWARE_PRODUCTION_STATUS_META.review_required.canAutoExportCnc).toBe(false);
    expect(HARDWARE_PRODUCTION_STATUS_META.visual_only.canAutoExportBom).toBe(false);
  });

  it("validates Blum 71B3550 + companion plate 173H7100 and blocks 110° hinge when internal drawer exists", () => {
    const mod = createTestModule();
    const blum110 = getHardwareProductById("hw_blum_71b3550")!;
    const okEval = evaluateHardwareMountPlacement(mod, blum110, 0);
    expect(okEval.canMount).toBe(true);
    expect(okEval.canExportCnc).toBe(true);
    expect(okEval.requiredCompanions.some((c) => c.sku === "173H7100")).toBe(true);
    expect(okEval.mountPoints.length).toBeGreaterThanOrEqual(2);

    // Add internal drawer -> 110° hinge must fail with collision error, 155° must pass
    mod.bays[0].drawers.push({
      id: "drw_int_1",
      bayIndex: 0,
      elevationY: 80,
      height: 160,
      slideType: "soft_close",
      isInternal: true,
    });
    const blockedEval = evaluateHardwareMountPlacement(mod, blum110, 0);
    expect(blockedEval.canMount).toBe(false);
    expect(blockedEval.issues.some((i) => i.code === "HW_INTERNAL_DRAWER_COLLISION")).toBe(true);

    const blum155 = getHardwareProductById("hw_blum_71b7550")!;
    const zeroProtrusionEval = evaluateHardwareMountPlacement(mod, blum155, 0);
    expect(zeroProtrusionEval.canMount).toBe(true);
  });

  it("validates Hettich Sensys 8645i (TH52) with 9071626 plate and door thickness bounds", () => {
    const mod = createTestModule();
    const sensys = getHardwareProductById("hw_hettich_9071205")!;
    const okEval = evaluateHardwareMountPlacement(mod, sensys, 0);
    expect(okEval.canMount).toBe(true);
    expect(okEval.requiredCompanions.some((c) => c.sku === "9071626")).toBe(true);

    // Thick 28mm door exceeds Sensys 8645i 24mm limit
    mod.carcass.doorThickness = 28;
    const thickEval = evaluateHardwareMountPlacement(mod, sensys, 0);
    expect(thickEval.canMount).toBe(false);
    expect(thickEval.issues.some((i) => i.code === "HW_DOOR_THICKNESS_OUT_OF_RANGE")).toBe(true);
  });

  it("validates Blum MOVENTO / Hettich Quadro nominal length selection and shallow depth rejection", () => {
    const mod = createTestModule({ dimensions: { width: 600, height: 820, depth: 560 } });
    const movento = getHardwareProductById("hw_blum_movento_760h")!;
    const okEval = evaluateHardwareMountPlacement(mod, movento, 0);
    expect(okEval.canMount).toBe(true);
    expect(okEval.recommendedNominalLengthMm).toBe(500);

    // Shrink depth to 240mm -> cannot fit even shortest 250mm runner
    const shallowMod = createTestModule({ dimensions: { width: 600, height: 820, depth: 240 } });
    const failEval = evaluateHardwareMountPlacement(shallowMod, movento, 0);
    expect(failEval.canMount).toBe(false);
    expect(failEval.issues.some((i) => i.code === "HW_DRAWER_DEPTH_INSUFFICIENT")).toBe(true);
  });

  it("validates Blum AVENTOS HK top height & LF bounds and suggests HF top when height grows", () => {
    const wallMod = createTestModule({
      category: "kitchen_wall",
      dimensions: { width: 800, height: 480, depth: 340 },
      bays: [
        {
          index: 0,
          shelves: [],
          hangingRails: [],
          drawers: [],
          specialFittings: [],
          door: {
            id: "door_lift",
            bayIndex: 0,
            type: "lift_up_stay",
            doorSystemId: "lift_up_stay",
            softClose: true,
            hardwareProductId: "hw_blum_aventos_hk_27",
          },
        },
      ],
    });
    const hkTop = getHardwareProductById("hw_blum_aventos_hk_27")!;
    const okEval = evaluateHardwareMountPlacement(wallMod, hkTop, 0);
    expect(okEval.canMount).toBe(true);
    expect(okEval.computedPowerFactorLf).toBeGreaterThan(0);

    // Resize height to 780mm (>600mm HK top max) -> resize report flags incompatibility & suggests HF top
    wallMod.dimensions.height = 780;
    const resizeReport = evaluateHardwareAfterModuleResize(
      wallMod,
      getHardwareProductById,
      getAllHardwareProducts()
    );
    expect(resizeReport.allCompatible).toBe(false);
    expect(resizeReport.findings[0].currentHardwareId).toBe("hw_blum_aventos_hk_27");
    expect(
      resizeReport.findings[0].suggestedAlternatives.some((a) => a.hardwareId === "hw_blum_aventos_hf_25")
    ).toBe(true);
  });

  it("blocks visual_only hardware in production gate and prevents unverified CNC hinge cup drilling", () => {
    const mod = createTestModule();
    mod.bays[0].specialFittings.push({
      id: "sf_vis_1",
      bayIndex: 0,
      elevationY: 300,
      type: "trouser_rack",
      height: 150,
      hardwareProductId: "hw_wardrobe_trouser_rack_visual",
    });
    const gate = evaluateProjectHardwareProductionGate(
      [mod],
      getHardwareProductById,
      getAllHardwareProducts()
    );
    expect(gate.passed).toBe(false);
    expect(gate.visualOnlyCount).toBe(1);

    // Verify drilling engine emits 0 hinge cup holes for a visual_only door hardware ref
    const holes = generateDrillingForPart({
      id: "P_door_vis",
      moduleId: "mod_test_hw",
      label: "Kapak",
      role: "door_left",
      dimensions: { width: 500, height: 700, depth: 18 },
      materialId: "mat_white",
      grain: "lengthwise",
      edgeBanding: { top: true, bottom: true, left: true, right: true, thickness: 1 },
      jointType: "minifix_dowel",
      holes: [],
      position: { x: 0, y: 0, z: 0 },
      hardwareRefId: "hw_wardrobe_trouser_rack_visual",
    });
    expect(holes.filter((h) => h.purpose === "hinge_cup").length).toBe(0);
  });
});
