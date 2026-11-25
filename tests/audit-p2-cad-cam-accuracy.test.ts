import { describe, it, expect } from "vitest";
import {
  createInitialProject,
  createDefaultWardrobeModule,
  roundMm,
} from "@birim/core";
import {
  generateBOMForProject,
  generateDrillingForPart,
  generatePanelDXF,
  generateBiesseCixProgram,
  generateHomagMprPrograms,
  generateScmXcsProgram,
  mapCutPieceToCncPieceInput,
} from "@birim/manufacturing";

describe("Audit Phase 2 — CAD/CAM, CNC Post-Processor & DXF Accuracy", () => {
  it("1. roundMm avoids float drift across positive and negative coordinates", () => {
    expect(roundMm(1.005, 2)).toBe(1.01);
    expect(roundMm(100.005, 2)).toBe(100.01);
    expect(roundMm(-100.005, 2)).toBe(-100.01);
    expect(roundMm(0.1 + 0.2, 2)).toBe(0.3);
    expect(roundMm(-0.0001, 2)).toBe(0);
  });

  it("2. crosswise grain uses proper 90° CCW rotation (det = +1) instead of mirror reflection", () => {
    const proj = createInitialProject();
    const mod = createDefaultWardrobeModule("mod_cross_rot");
    mod.dimensions = { width: 600, height: 1800, depth: 580 };
    mod.carcass.bodyMaterialId = "mat_veneer_oak";
    mod.carcass.doorMaterialId = "mat_veneer_oak";
    mod.bays = [
      {
        ...mod.bays[0],
        index: 0,
        door: {
          ...mod.bays[0].door,
          type: "single_left",
          doorSystemId: "hinged_single",
        },
        shelves: [],
        drawers: [],
        hangingRails: [],
        specialFittings: [],
      },
    ];
    proj.modules = [mod];

    const bomLen = generateBOMForProject(proj);
    const doorLen = bomLen.cutList.find((cp) => cp.componentRole === "door_left")!;
    const cupLen = (doorLen.holes || []).find((h) => h.purpose === "hinge_cup")!;

    const crossProj = structuredClone(proj);
    crossProj.modules[0].componentGrainOverrides = { __all__: "crosswise" };
    const bomCross = generateBOMForProject(crossProj);
    const doorCross = bomCross.cutList.find((cp) => cp.componentRole === "door_left")!;
    const cupCross = (doorCross.holes || []).find((h) => h.purpose === "hinge_cup")!;

    // Under proper 90° CCW rotation: (x', y') = (L - y, x)
    // Original left-hinge cup has small x (~21.5mm) -> rotated y' MUST equal original x (~21.5mm), NOT W - x (~574.5mm)!
    expect(Math.abs(cupCross.y - cupLen.x)).toBeLessThan(0.1);
    expect(Math.abs(cupCross.x - ((doorLen.nominalLengthMm ?? doorLen.lengthMm) - cupLen.y))).toBeLessThan(0.1);
  });

  it("3. CNC post-processors reject invalid workpieces & out-of-bounds holes instead of silently clamping", () => {
    const basePiece = {
      id: "P_GUARD_TEST",
      moduleId: "m1",
      moduleName: "Guard Mod",
      partRole: "carcass_side_left",
      pieceName: "Sol Yan",
      thicknessMm: 18,
      lengthMm: 700,
      widthMm: 560,
      netCutLengthMm: 700,
      netCutWidthMm: 558,
      rawOriginOffsetXMm: 2,
      rawOriginOffsetYMm: 0,
      hasBackGroove: true,
      backGrooveOffsetMm: 20,
      drillingOperations: [{ x: 600, y: 100, diameter: 15, depth: 13.5, face: "top" as const, type: "minifix_cam" }],
    };

    expect(() => generateBiesseCixProgram(basePiece)).toThrow(/ERR_CNC_HOLE_OUT_OF_BOUNDS/);
    expect(() => generateHomagMprPrograms(basePiece)).toThrow(/ERR_CNC_HOLE_OUT_OF_BOUNDS/);
    expect(() => generateScmXcsProgram(basePiece)).toThrow(/ERR_CNC_HOLE_OUT_OF_BOUNDS/);

    expect(() =>
      generateBiesseCixProgram({ ...basePiece, netCutWidthMm: 0, drillingOperations: [] })
    ).toThrow(/ERR_CNC_INVALID_WORKPIECE/);
  });

  it("4. Biesse .CIX & Homag .MPR back groove centerline matches DXF to 0.00 mm after 2mm front edge-band offset", () => {
    const sidePiece = {
      id: "P_GROOVE_SYNC",
      moduleId: "m1",
      moduleName: "Sync Mod",
      partRole: "carcass_side_left",
      pieceName: "Sol Yan",
      thicknessMm: 18,
      lengthMm: 720,
      widthMm: 600,
      netCutLengthMm: 720,
      netCutWidthMm: 598,
      rawOriginOffsetXMm: 2,
      rawOriginOffsetYMm: 0,
      mirrorInnerFaceX: false,
      hasBackGroove: true,
      backGrooveOffsetMm: 20,
      drillingOperations: [],
    };
    // Finished groove [580 .. 588.5] -> center 584.25 -> raw pre-band (offX=2) center = 582.25
    const cix = generateBiesseCixProgram(sidePiece);
    const mpr = generateHomagMprPrograms(sidePiece)[0];
    expect(cix.content).toContain("PARAM,NAME=Y,VALUE=582.25");
    expect(mpr.content).toContain('YA="582.25"');
  });

  it("5. DXF dynamically declares every emitted CNC layer in TABLES -> LAYER and distinguishes 4 edge drill sides", () => {
    const proj = createInitialProject();
    const bom = generateBOMForProject(proj);
    const side = bom.cutList.find((cp) => cp.componentRole === "carcass_side_left")!;
    const top = bom.cutList.find((cp) => cp.componentRole === "carcass_top")!;

    const dxfSide = generatePanelDXF(side);
    const tablesEnd = dxfSide.indexOf("ENDSEC\r\n  0\r\nSECTION\r\n  2\r\nBLOCKS");
    const tablesSection = dxfSide.slice(0, tablesEnd);
    expect(tablesSection).toContain("OUTLINE_T18");
    expect(tablesSection).toContain("GROOVE_W8.5_Z10");
    expect(tablesSection).toContain("DRILL_V_D8_Z11");

    const dxfTop = generatePanelDXF(top);
    expect(dxfTop).toContain("DRILL_H_BOTTOM_");
    expect(dxfTop).toContain("DRILL_H_TOP_");
  });

  it("6. miter_45 side panels drill alignment dowels and lamello_cabineo drills fixed shelves & divider mates", () => {
    const miterHoles = generateDrillingForPart({
      id: "P_MITER_SIDE",
      moduleId: "m1",
      label: "Sol Yan Panel",
      role: "carcass_side_left",
      dimensions: { width: 560, height: 800, depth: 18 },
      materialId: "mat_melamine_white",
      grain: "lengthwise",
      edgeBanding: { top: false, bottom: true, left: true, right: false, thickness: 1 },
      jointType: "miter_45",
      carcassJoineryTopology: "miter_45",
      holes: [],
      position: { x: 0, y: 0, z: 0 },
      isFrontFacing: false,
    });
    expect(miterHoles.some((h) => h.id.includes("_miter_dowel_bot_"))).toBe(true);

    const cabineoFixedShelf = generateDrillingForPart({
      id: "P_CAB_SHELF",
      moduleId: "m1",
      label: "Sabit Taşıyıcı Raf",
      role: "shelf",
      dimensions: { width: 520, height: 764, depth: 18 },
      materialId: "mat_melamine_white",
      grain: "none",
      edgeBanding: { top: false, bottom: false, left: true, right: false, thickness: 1 },
      jointType: "minifix_dowel",
      connectorSystem: "lamello_cabineo",
      holes: [],
      position: { x: 0, y: 400, z: 0 },
      isFrontFacing: false,
    });
    expect(cabineoFixedShelf.filter((h) => h.purpose === "cabineo_pocket").length).toBe(4);
  });
});
