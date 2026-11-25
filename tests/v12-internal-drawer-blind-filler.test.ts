import { describe, it, expect } from "vitest";
import {
  createInitialProject,
  resolveInternalDrawerHingeClearance,
  validateModule,
  evaluateUnifiedEngineeringModel,
} from "@birim/core";
import { generateModuleGeometry } from "@birim/geometry";
import { generateBOMForProject } from "@birim/manufacturing";

function createWardrobeWithInternalDrawers(
  doorType: "single_left" | "single_right" | "double",
  solution: "auto_155_hinge" | "spacer_block_25mm" | "blind_panel_filler",
  blindWidthMm = 40,
  symmetric = false
) {
  const project = createInitialProject();
  const mod = project.modules[0];
  mod.category = "wardrobe";
  mod.dimensions = { width: 600, height: 2100, depth: 600 };
  mod.carcass.panelThickness = 18;
  mod.carcass.plinthHeight = 80;
  mod.carcass.internalDrawerHingeSolution = solution;
  mod.carcass.internalDrawerBlindWidthMm = blindWidthMm;
  mod.carcass.internalDrawerBlindSymmetric = symmetric;

  const bay = mod.bays[0];
  bay.widthRatio = 1;
  mod.bays = [bay];
  bay.door = {
    ...bay.door,
    type: doorType,
    doorSystemId: doorType === "double" ? "hinged_double" : "hinged_single",
    hardwareProductId: "hw_blum_71b3550", // standard 110° hinge
  };
  bay.drawers = [
    { id: "drw_int_1", bayIndex: 0, elevationY: 0, height: 180, slideType: "soft_close", isInternal: true },
    { id: "drw_int_2", bayIndex: 0, elevationY: 185, height: 180, slideType: "soft_close", isInternal: true },
    { id: "drw_int_3", bayIndex: 0, elevationY: 370, height: 180, slideType: "soft_close", isInternal: true },
  ];
  bay.shelves = [
    { id: "shf_cap", bayIndex: 0, elevationY: 565, thickness: 18, isAdjustable: false, isFixed: true },
  ];

  return { project, mod, bay };
}

describe("Internal Drawer Blind Panel + Front Filler System (Kör Dikme + Ön Kör Kapama)", () => {
  it("generates single continuous left blind divider + front filler for single_left hinged door and moves runner holes to blind divider", () => {
    const { project, mod, bay } = createWardrobeWithInternalDrawers(
      "single_left",
      "blind_panel_filler",
      40,
      false
    );

    const plan = resolveInternalDrawerHingeClearance(mod, bay);
    expect(plan.solution).toBe("blind_panel_filler");
    expect(plan.hasLeftBlindFiller).toBe(true);
    expect(plan.hasRightBlindFiller).toBe(false);
    expect(plan.leftDeductionMm).toBe(40);
    expect(plan.rightDeductionMm).toBe(0);
    expect(plan.blockBottomInnerYMm).toBe(0);
    expect(plan.blockTopInnerYMm).toBe(565); // snapped cleanly to underside of capping shelf
    expect(plan.blockHeightMm).toBe(565);

    const geo = generateModuleGeometry(mod);
    const leftDivider = geo.components.find((c) => c.id.includes("_blind_divider_left"));
    const leftFront = geo.components.find((c) => c.id.includes("_blind_front_left"));
    const rightDivider = geo.components.find((c) => c.id.includes("_blind_divider_right"));
    const legacySpacers = geo.components.filter((c) => c.id.includes("_spacer_"));

    expect(leftDivider).toBeDefined();
    expect(leftFront).toBeDefined();
    expect(rightDivider).toBeUndefined();
    expect(legacySpacers).toHaveLength(0);

    // Blind divider is real 18mm panel; front filler is 40mm wide × 18mm thick
    expect(leftDivider!.dimensions.width).toBe(18);
    expect(leftDivider!.dimensions.height).toBe(565);
    expect(leftFront!.dimensions.width).toBe(40);
    expect(leftFront!.dimensions.height).toBe(565);
    expect(leftFront!.dimensions.depth).toBe(18);

    // Internal drawer front is narrowed by 40mm and shifted +40mm right
    const bayW = 600 - 36; // 564mm
    const drwFront = geo.components.find((c) => c.id === "drw_int_1_front");
    expect(drwFront).toBeDefined();
    expect(drwFront!.dimensions.width).toBe(bayW - 40 - 4);
    expect(drwFront!.position.x).toBe(18 + 40 + 2);

    // Validation must pass with zero internal drawer hinge clash errors
    const ruleIssues = validateModule(mod);
    expect(ruleIssues.some((i) => i.code === "ERR_INTERNAL_DRAWER_HINGE_COLLISION")).toBe(false);
    const engReport = evaluateUnifiedEngineeringModel(project);
    expect(engReport.findings.some((f) => f.code === "ERR_INTERNAL_DRAWER_HINGE_BODY_CLASH")).toBe(
      false
    );

    // BOM & Drilling: blind panels are 18mm manufacturable parts; runner holes are on blind divider, NOT on main left carcass side
    const bom = generateBOMForProject(project);
    const leftSidePart = bom.cutList.find((p) => p.componentRole === "carcass_side_left");
    const blindDivPart = bom.cutList.find((p) => p.pieceName.includes("Sol Kör Dikme"));
    const blindFrontPart = bom.cutList.find((p) => p.pieceName.includes("Sol Ön Kör Kapama"));

    expect(blindDivPart).toBeDefined();
    expect(blindDivPart!.thicknessMm).toBe(18);
    expect(blindFrontPart).toBeDefined();
    expect(blindFrontPart!.thicknessMm).toBe(18);
    expect(blindFrontPart!.edgeBanding.left).toBe(true);
    expect(blindFrontPart!.edgeBanding.right).toBe(true);

    const leftSideRunnerHoles = (leftSidePart?.holes || []).filter(
      (h) => h.purpose === "slide_mount" || String(h.purpose) === "drawer_runner"
    );
    const blindDivRunnerHoles = (blindDivPart?.holes || []).filter(
      (h) => h.purpose === "slide_mount" || String(h.purpose) === "drawer_runner"
    );
    expect(leftSideRunnerHoles).toHaveLength(0);
    expect(blindDivRunnerHoles.length).toBeGreaterThanOrEqual(6);
  });

  it("generates both left and right blind zones automatically for double hinged doors", () => {
    const { mod, bay } = createWardrobeWithInternalDrawers(
      "double",
      "blind_panel_filler",
      45,
      false
    );

    const plan = resolveInternalDrawerHingeClearance(mod, bay);
    expect(plan.hasLeftBlindFiller).toBe(true);
    expect(plan.hasRightBlindFiller).toBe(true);
    expect(plan.leftDeductionMm).toBe(45);
    expect(plan.rightDeductionMm).toBe(45);

    const geo = generateModuleGeometry(mod);
    expect(geo.components.find((c) => c.id.includes("_blind_divider_left"))).toBeDefined();
    expect(geo.components.find((c) => c.id.includes("_blind_front_left"))).toBeDefined();
    expect(geo.components.find((c) => c.id.includes("_blind_divider_right"))).toBeDefined();
    expect(geo.components.find((c) => c.id.includes("_blind_front_right"))).toBeDefined();

    const bayW = 600 - 36;
    const drwFront = geo.components.find((c) => c.id === "drw_int_1_front");
    expect(drwFront!.dimensions.width).toBe(bayW - 90 - 4);
  });

  it("supports symmetric left + right blind zones on single-leaf door when internalDrawerBlindSymmetric is enabled", () => {
    const { mod, bay } = createWardrobeWithInternalDrawers(
      "single_right",
      "blind_panel_filler",
      36,
      true
    );

    const plan = resolveInternalDrawerHingeClearance(mod, bay);
    expect(plan.hasLeftBlindFiller).toBe(true);
    expect(plan.hasRightBlindFiller).toBe(true);
    expect(plan.leftDeductionMm).toBe(36);
    expect(plan.rightDeductionMm).toBe(36);
  });

  it("emits actionable remediationProposals (Kör Dikme + Kapama & 155° Menteşe) for both hinge body clash (including upper half of drawer) and protrusion warning", () => {
    const { project, mod } = createWardrobeWithInternalDrawers(
      "single_left",
      "auto_155_hinge",
      40,
      false
    );
    // Keep standard 110° hinge (hw_blum_71b3550) and place a drawer whose upper half hits the bottom hinge (~82mm inner Y)
    mod.bays[0].drawers = [
      { id: "drw_upper_clash", bayIndex: 0, elevationY: 0, height: 180, slideType: "soft_close", isInternal: true },
      { id: "drw_clear_mid", bayIndex: 0, elevationY: 300, height: 160, slideType: "soft_close", isInternal: true },
    ];

    const report = evaluateUnifiedEngineeringModel(project);
    const clashFinding = report.findings.find(
      (f) => f.code === "ERR_INTERNAL_DRAWER_HINGE_BODY_CLASH" && f.targetId === "drw_upper_clash"
    );
    expect(clashFinding).toBeDefined();
    expect(clashFinding!.remediationProposals?.length).toBeGreaterThanOrEqual(2);
    expect(clashFinding!.remediationProposals![0].label).toContain("Kör Dikme");
    expect(clashFinding!.remediationProposals![1].label).toContain("155°");

    const warnFinding = report.findings.find(
      (f) => f.code === "WARN_INTERNAL_DRAWER_HINGE_PROTRUSION" && f.targetId === "drw_clear_mid"
    );
    expect(warnFinding).toBeDefined();
    expect(warnFinding!.remediationProposals?.length).toBeGreaterThanOrEqual(2);
  });

  it("recesses blind front filler and shortens blind divider depth by internalDrawerBlindSetbackFromFrontMm", () => {
    const { mod: modFlush } = createWardrobeWithInternalDrawers(
      "single_left",
      "blind_panel_filler",
      40,
      false
    );
    modFlush.carcass.internalDrawerBlindSetbackFromFrontMm = 0;

    const { mod: modRecessed } = createWardrobeWithInternalDrawers(
      "single_left",
      "blind_panel_filler",
      40,
      false
    );
    modRecessed.carcass.internalDrawerBlindSetbackFromFrontMm = 18;

    const geoFlush = generateModuleGeometry(modFlush);
    const geoRecessed = generateModuleGeometry(modRecessed);

    const frontFlush = geoFlush.components.find((c) => c.id.includes("_blind_front_left"))!;
    const frontRecessed = geoRecessed.components.find((c) => c.id.includes("_blind_front_left"))!;
    const divFlush = geoFlush.components.find((c) => c.id.includes("_blind_divider_left"))!;
    const divRecessed = geoRecessed.components.find((c) => c.id.includes("_blind_divider_left"))!;

    expect(frontFlush.position.z - frontRecessed.position.z).toBe(18);
    expect(divFlush.dimensions.depth - divRecessed.dimensions.depth).toBe(18);
  });
});
