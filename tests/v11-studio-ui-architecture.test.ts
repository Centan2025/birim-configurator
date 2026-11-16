import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";
import {
  DEFAULT_MATERIALS,
  applyApprovedRemediationProposal,
  calculateFourSpaceDimensions,
  computeSystem32MultiHoleYs,
  createInitialProject,
  evaluateUnifiedEngineeringModel,
} from "@birim/core";
import {
  V4_MODULE_TEMPLATES,
  V5_SPECIALIZED_MODULE_TEMPLATES,
  V5_COMPOSITE_ASSEMBLIES,
} from "@birim/catalog";
import { generateModuleGeometry } from "@birim/geometry";
import { generateBOMForProject } from "@birim/manufacturing";
import {
  V11_CATALOG_GROUPS,
  classifyTemplateGroup,
  filterMaterialsByGroup,
  formatFindingForTier,
} from "../apps/configurator/src/v11/v11Constants";
import {
  computeBaySystem32ShelfHoleElevations,
  computeElevationSnapTargets,
  snapShelfToMultiHoleOrElevationTargets,
} from "../apps/configurator/src/v3/engine/elevationSnapEngine";

describe("V11.4 Studio UI, Fixed Shelf, System-32 Multi-Hole Shelf Snap, Performance & 3D Error Beacons", () => {
  const rootDir = path.resolve(__dirname, "..");

  it("wires /, /v3, /v3/studio, /v3/plan, and /v3/showroom to BirimStudioWorkspace and keeps V3ThreeViewport persistently mounted", () => {
    const routes = [
      "apps/configurator/src/app/page.tsx",
      "apps/configurator/src/app/v3/page.tsx",
      "apps/configurator/src/app/v3/studio/page.tsx",
      "apps/configurator/src/app/v3/plan/page.tsx",
      "apps/configurator/src/app/v3/showroom/page.tsx",
    ];
    for (const rel of routes) {
      const content = fs.readFileSync(path.join(rootDir, rel), "utf8");
      expect(content).toContain("BirimStudioWorkspace");
    }
    const ws = fs.readFileSync(
      path.join(rootDir, "apps/configurator/src/v11/BirimStudioWorkspace.tsx"),
      "utf8"
    );
    expect(ws).toContain("paused={!show3DCanvas}");
    expect(ws).toContain("onBeginSliderDrag={beginHistoryTransaction}");
    expect(ws).toContain("onCommitSliderDrag={commitHistoryTransaction}");

    const nextCfg = fs.readFileSync(
      path.join(rootDir, "apps/configurator/next.config.mjs"),
      "utf8"
    );
    expect(nextCfg).toContain('source: "/favicon.ico"');
    expect(nextCfg).toContain('destination: "/icon.svg"');
  });

  it("exposes interactive 3D red/amber beacon popovers and top-header issue explanations", () => {
    const vp3d = fs.readFileSync(
      path.join(rootDir, "apps/configurator/src/v3/components/V3ThreeViewport.tsx"),
      "utf8"
    );
    expect(vp3d).toContain("engineeringBeaconGroupRef");
    expect(vp3d).toContain('data-testid="v11-3d-beacon-popover"');
    expect(vp3d).toContain('data-testid="v11-3d-beacon-summary-pill"');
    expect(vp3d).toContain("isXrayActive ? storeBom : null");

    const hdr = fs.readFileSync(
      path.join(rootDir, "apps/configurator/src/v11/StudioHeaderBar.tsx"),
      "utf8"
    );
    expect(hdr).toContain('data-testid="v11-header-issues-btn"');
    expect(hdr).toContain('data-testid="v11-header-issues-popover"');
  });

  it("snaps dragged movable shelves strictly to physical System-32 multi-hole coordinates while allowing fixed shelves free placement", () => {
    const proj = createInitialProject();
    const mod = proj.modules[0];
    mod.carcass.multiHoleMode = "full_system_32";
    const movableShelf = mod.bays[0].shelves.find((s) => s.isAdjustable)!;
    const fixedShelf = mod.bays[0].shelves.find((s) => !s.isAdjustable)!;

    const holeYs = computeBaySystem32ShelfHoleElevations(mod, 0, movableShelf.id);
    expect(holeYs).toBeDefined();
    expect(holeYs!.length).toBeGreaterThan(10);

    // Every consecutive non-blocked hole must follow exact 32mm System-32 pitch
    for (let i = 1; i < holeYs!.length; i++) {
      expect((holeYs![i] - holeYs![i - 1]) % 32).toBe(0);
    }

    // Verify 0.00mm match against physical side-panel System-32 boring coordinates
    const plinthH = mod.carcass.plinthHeight ?? 80;
    const panelT = mod.carcass.panelThickness || 18;
    const sideHoleYs = computeSystem32MultiHoleYs({
      mode: "full_system_32",
      panelHeightMm: mod.dimensions.height,
      bottomOffsetY: plinthH,
      panelThicknessMm: panelT,
      edgeMarginMm: 96,
      adjustableShelfYsMm: [],
      blockedYsMm: [{ y: plinthH + panelT + fixedShelf.elevationY, clearanceMm: 22 }],
    });
    for (const hy of holeYs!) {
      expect(sideHoleYs.includes(plinthH + panelT + hy)).toBe(true);
    }

    // Arbitrary drag input (e.g., 463mm) must snap onto an exact System-32 hole (not 465mm!)
    const targets = computeElevationSnapTargets(proj, 0, 0, movableShelf.id, 18);
    const snapped = snapShelfToMultiHoleOrElevationTargets({
      project: proj,
      moduleIndex: 0,
      bayIndex: 0,
      shelfId: movableShelf.id,
      rawElevationY: 463,
      snapTargets: targets,
    });
    expect(holeYs!.includes(snapped.elevationY)).toBe(true);
    expect(snapped.snappedTarget?.kind).toBe("system32_hole");
    expect(snapped.snappedTarget?.label).toContain("Sistem 32 Delik");

    // Fixed shelf returns null from multi-hole restriction (not pinned to Ø5mm holes)
    expect(computeBaySystem32ShelfHoleElevations(mod, 0, fixedShelf.id)).toBeNull();
  });

  it("loads a standard 1500mm 3-door initial wardrobe with 0 span warnings both initially AND when right bay uses 5-shelf preset", () => {
    const proj = createInitialProject();
    const mod = proj.modules[0];
    expect(mod.dimensions.width).toBe(1500);
    const fs4 = calculateFourSpaceDimensions(mod);
    expect(fs4.usableInternal.bayClearWidthsMm[0]).toBe(473);
    expect(fs4.usableInternal.bayClearWidthsMm[1]).toBe(973);
    expect(Math.abs(fs4.doorLeaves[0].leafWidthMm - fs4.doorLeaves[1].leafWidthMm)).toBeLessThanOrEqual(4);

    const repInit = evaluateUnifiedEngineeringModel(proj);
    expect(repInit.findings.filter((f) => f.code.includes("SPAN") || f.code.includes("DEFLECTION"))).toHaveLength(0);

    mod.bays[1].drawers = [];
    mod.bays[1].hangingRails = [];
    mod.bays[1].shelves = [1, 2, 3, 4, 5].map((i) => ({
      id: `sh_test_${i}`,
      bayIndex: 1,
      elevationY: i * 340,
      isAdjustable: i !== 3,
      isFixed: i === 3,
      fixedConnectorType: i === 3 ? "minifix_dowel" : undefined,
    }));
    const repShelves = evaluateUnifiedEngineeringModel(proj);
    expect(repShelves.findings.filter((f) => f.code.includes("SPAN") || f.code.includes("DEFLECTION"))).toHaveLength(0);
    expect(repShelves.findings.filter((f) => f.code === "INFO_TALL_CARCASS_NEEDS_FIXED_SHELF")).toHaveLength(0);

    const wideProj = createInitialProject();
    wideProj.modules[0].dimensions.width = 1800;
    wideProj.modules[0].bays[0].customWidth = 575;
    const repWideFixedOnly = evaluateUnifiedEngineeringModel(wideProj);
    expect(
      repWideFixedOnly.findings.some((f) => f.code.includes("SPAN") || f.code.includes("DEFLECTION"))
    ).toBe(true);
  });

  it("drills Minifix+Dowel vs Rafix 20 fixed shelves accurately on side/divider panels and remediates all-movable tall stacks", () => {
    const proj = createInitialProject();
    const mod = proj.modules[0];
    mod.bays[0].hangingRails = [];
    mod.bays[0].shelves = [350, 750, 1150, 1550].map((y, idx) => ({
      id: `mov_${idx}`,
      bayIndex: 0,
      elevationY: y,
      isAdjustable: true,
      isFixed: false,
    }));
    const repBefore = evaluateUnifiedEngineeringModel(proj);
    const tallFinding = repBefore.findings.find(
      (f) => f.code === "INFO_TALL_CARCASS_NEEDS_FIXED_SHELF"
    );
    expect(tallFinding).toBeDefined();
    expect(tallFinding?.remediationProposals?.[0]?.patchKind).toBe("convert_mid_shelf_to_fixed");

    const fixedProj = applyApprovedRemediationProposal(proj, tallFinding!.remediationProposals![0]);
    expect(
      fixedProj.modules[0].bays[0].shelves.some((s) => s.isAdjustable === false && s.isFixed === true)
    ).toBe(true);

    const fxShelf = fixedProj.modules[0].bays[0].shelves.find((s) => !s.isAdjustable)!;
    fxShelf.fixedConnectorType = "rafix_20";
    const bom = generateBOMForProject(fixedProj);
    expect(bom.hardwareList.some((h) => (h.id === "HW_RAFIX_20_SET" || (h as any).sku === "HW_RAFIX_20_SET"))).toBe(true);
    const shelfCut = bom.cutList.find((c) => c.id.includes(fxShelf.id))!;
    expect((shelfCut.holes || []).some((h) => h.purpose === "rafix_housing" && h.diameter === 20)).toBe(true);
    const leftSide = bom.cutList.find((c) => c.componentRole === "carcass_side_left")!;
    expect((leftSide.holes || []).some((h) => h.purpose === "rafix_stud" && h.diameter === 5)).toBe(true);
    const midDivider = bom.cutList.find((c) => c.componentRole === "carcass_divider")!;
    expect((midDivider.holes || []).some((h) => h.purpose === "rafix_stud" && h.diameter === 5)).toBe(true);
    expect((midDivider.holes || []).some((h) => h.purpose === "minifix_bolt" && h.direction === "face_back")).toBe(true);
  });

  it("ensures every ready module template and composite set passes industrial engineering & 3D clash rules", () => {
    for (const tpl of [...V4_MODULE_TEMPLATES, ...V5_SPECIALIZED_MODULE_TEMPLATES]) {
      if (tpl.requiresFactoryValidation) continue;
      const proj = createInitialProject();
      const mod = tpl.createInstance("audit_" + tpl.templateId);
      proj.modules = [mod];
      proj.space.walls[0].length = Math.max(3600, mod.dimensions.width + 400);
      proj.space.walls[0].height = Math.max(2700, mod.dimensions.height + 200);
      const rep = evaluateUnifiedEngineeringModel(proj);
      const hardErrors = rep.findings.filter((f) => f.severity === "error");
      expect(hardErrors).toHaveLength(0);

      const geom = generateModuleGeometry(mod, { doorOpenAngleDeg: 0, drawerOpenMm: 0 });
      const doors = geom.components.filter((c) => c.role === "door_left" || c.role === "door_right");
      const drwFronts = geom.components.filter((c) => c.role === "drawer_front");
      for (const df of drwFronts) {
        for (const dr of doors) {
          const ox =
            df.position.x < dr.position.x + dr.dimensions.width - 2 &&
            df.position.x + df.dimensions.width > dr.position.x + 2;
          const oy =
            df.position.y < dr.position.y + dr.dimensions.height - 2 &&
            df.position.y + df.dimensions.height > dr.position.y + 2;
          const oz = df.position.z + df.dimensions.depth > dr.position.z - 2;
          expect(ox && oy && oz).toBe(false);
        }
      }
    }

    for (const comp of V5_COMPOSITE_ASSEMBLIES) {
      const proj = createInitialProject();
      const built = comp.buildItems(100);
      proj.modules = built.modules || [];
      proj.sceneObjects = built.sceneObjects || [];
      proj.space.walls[0].length = 4800;
      const rep = evaluateUnifiedEngineeringModel(proj);
      const hardErrors = rep.findings.filter((f) => f.severity === "error");
      expect(hardErrors).toHaveLength(0);
    }
  });

  it("strips DIN/EN jargon in simple tier while keeping technical codes in factory tier", () => {
    expect(filterMaterialsByGroup(DEFAULT_MATERIALS, "all").length).toBe(
      DEFAULT_MATERIALS.length
    );
    const sampleFinding = {
      code: "SHELF_SPAN_WARNING",
      severity: "warning" as const,
      message: "DIN 68874 standardına göre sehim uyarısı.",
    };
    expect(formatFindingForTier(sampleFinding as any, "simple").detail).not.toContain("DIN");
    expect(formatFindingForTier(sampleFinding as any, "factory").detail).toContain("DIN 68874");
  });
});
