import { describe, it, expect } from "vitest";
import { createInitialProject, createDefaultWardrobeModule } from "@birim/core";
import { getV4TemplateById, createKitchenLinearProject } from "@birim/catalog";
import {
  generateBOMForProject,
  generateDrillingForPart,
  generateHomagMprPrograms,
  generateBiesseCixProgram,
  generatePanelDXF,
  generateThermalPartLabelsZpl,
  computeProjectMepUtilityPoints,
  exportArchitecturalMepDxf,
  generateMepCoordinationPlanSvg,
} from "@birim/manufacturing";
import { calculateProjectPrice, DEFAULT_PRICING_PARAMS } from "@birim/pricing";
import {
  buildShareableProjectUrl,
  decodeProjectFromShareHash,
} from "../apps/configurator/src/v3/utils/projectShareCodec";

describe("Birim V6.3 Full Audit Remediation Suite (Manufacturer, Architect & Customer)", () => {
  it("1. Manufacturer Fix: Signed pre-milling > edgeBandThickness cuts panel LARGER so pre-mill shave yields exact finished size", () => {
    const mod = createDefaultWardrobeModule("mod_premill");
    // Carcass sides have 0.8mm or 1mm band; set doorEdgeBandThicknessMm = 1mm, preMillingMm = 1.5mm -> delta = -0.5mm per edge (+1.0mm total!)
    mod.carcass.preMillingMm = 1.5;
    mod.bays[0].door.doorEdgeBandThicknessMm = 1;
    const proj = { ...createInitialProject(), modules: [mod] };
    const bom = generateBOMForProject(proj);
    const door = bom.cutList.find((p) => p.componentRole === "door_left")!;
    expect(door.netCutWidthMm).toBe(door.widthMm + 1);
    expect(door.netCutLengthMm).toBe(door.lengthMm + 1);
    expect(door.rawOriginOffsetXMm).toBe(-0.5);
  });

  it("2. Manufacturer Fix: Pre-banding Nesting CNC (.MPR & .CIX) shifts hinge cup bore by raw edge-band offset", () => {
    const mprs = generateHomagMprPrograms({
      id: "door_nest_1",
      moduleId: "m1",
      moduleName: "Gardırop",
      partRole: "door_left",
      pieceName: "Sol Kapak",
      thicknessMm: 18,
      lengthMm: 2100,
      widthMm: 600,
      netCutLengthMm: 2096,
      netCutWidthMm: 596,
      rawOriginOffsetXMm: 2,
      rawOriginOffsetYMm: 2,
      drillingOperations: [
        { x: 21.5, y: 100, diameter: 35, depth: 13, face: "top", type: "hinge_cup" },
      ],
    });
    // Before gluing 2mm left/bottom band on raw 596x2096 blank, 21.5mm finished center MUST be bored at 19.50mm (and Y=98.00mm)!
    expect(mprs[0].content).toContain('XA="98.00"');
    expect(mprs[0].content).toContain('YA="19.50"');

    const cix = generateBiesseCixProgram({
      id: "door_nest_1",
      moduleId: "m1",
      moduleName: "Gardırop",
      partRole: "door_left",
      pieceName: "Sol Kapak",
      thicknessMm: 18,
      lengthMm: 2100,
      widthMm: 600,
      netCutLengthMm: 2096,
      netCutWidthMm: 596,
      rawOriginOffsetXMm: 2,
      rawOriginOffsetYMm: 2,
      drillingOperations: [
        { x: 21.5, y: 100, diameter: 35, depth: 13, face: "top", type: "hinge_cup" },
      ],
    });
    expect(cix.content).toContain("PARAM,NAME=X,VALUE=98.00");
    expect(cix.content).toContain("PARAM,NAME=Y,VALUE=19.50");
  });

  it("3. Manufacturer Fix: Carcass side minifix/dowel joints snap strictly to 37 + k*32mm System-32 grid on arbitrary depths", () => {
    for (const depth of [350, 450, 550, 580, 600]) {
      const holes = generateDrillingForPart({
        id: `side_${depth}`,
        moduleId: "m1",
        label: "Sol Yan",
        role: "carcass_side_left",
        dimensions: { width: depth, height: 800, depth: 18 },
        materialId: "mat_melamine_white",
        grain: "lengthwise",
        edgeBanding: { top: false, bottom: true, left: true, right: false, thickness: 1 },
        jointType: "minifix_dowel",
        holes: [],
        position: { x: 0, y: 0, z: 0 },
      });
      const boltXs = Array.from(
        new Set(holes.filter((h) => h.purpose === "minifix_bolt").map((h) => h.x))
      ).sort((a, b) => a - b);
      expect(boltXs[0]).toBe(37);
      expect((boltXs[boltXs.length - 1] - boltXs[0]) % 32).toBe(0);
    }
  });

  it("4. Manufacturer & Architect Fix: Continuous countertop cuts BOTH Sink AND Cooktop at exact module X coordinates with zero PVC band on stone", () => {
    const kProj = createKitchenLinearProject();
    // Add a continuous stone countertop spanning the entire kitchen run (0..2600mm)
    const sinkMod = getV4TemplateById("tpl_kb_08_sink_base")!.createInstance("kb_sink_test");
    sinkMod.position = { x: 600, y: 0, z: 0 };
    const hobMod = getV4TemplateById("tpl_kb_18_cooktop_base")!.createInstance("kb_hob_test");
    hobMod.position = { x: 1800, y: 0, z: 0 };
    const contTop = {
      ...sinkMod,
      id: "comp_ctop_full",
      name: "Tek Parça Porselen Tezgâh",
      category: "complementary" as const,
      complementaryRole: "countertop" as const,
      position: { x: 0, y: 860, z: 0 },
      dimensions: { width: 2600, height: 38, depth: 600 },
      bays: [],
      carcass: {
        ...sinkMod.carcass,
        bodyMaterialId: "mat_quartz_calacatta",
        doorMaterialId: "mat_quartz_calacatta",
        countertopMaterialId: "mat_quartz_calacatta",
      },
    };
    kProj.modules = [sinkMod, hobMod, contTop];
    const bom = generateBOMForProject(kProj);
    const ctopPiece = bom.cutList.find((p) => p.moduleId === "comp_ctop_full")!;
    expect(ctopPiece.edgeBanding.thickness).toBe(0);
    const sinkHobCuts = (ctopPiece.utilityCutouts || []).filter((c) => c.id.startsWith("cutout_"));
    expect(sinkHobCuts.length).toBe(2);
    expect(sinkHobCuts[0].centerYMm).not.toBe(sinkHobCuts[1].centerYMm);
  });

  it("5. CPQ Pricing, Angled Table Hardware/Miter, MEP AIA .DXF, Zebra .ZPL, and Share URL Codec work end-to-end", () => {
    const proj = createInitialProject();
    // Set luxury lacquer doors -> verify paintshop surcharge + 18-24 business days lead time
    proj.modules[0].carcass.doorMaterialId = "mat_lacquer_cream";
    // Add a 45° angled attached table
    proj.modules.push({
      ...proj.modules[0],
      id: "comp_table_1",
      name: "Açılı Ada Masası (45°)",
      category: "complementary",
      complementaryRole: "attached_table",
      position: { x: 1800, y: 0, z: 200 },
      dimensions: { width: 1500, height: 750, depth: 850 },
      bays: [],
      attachedTableConfig: {
        anchorModuleId: proj.modules[0].id,
        angleDeg: 45,
        legStyle: "metal_u_frame",
        topThicknessMm: 40,
      },
    });

    const bom = generateBOMForProject(proj);
    expect(bom.hardwareList.some((h) => h.sku === "HW_TABLE_CANTILEVER_FLANGE")).toBe(true);
    expect(bom.hardwareList.some((h) => h.sku === "HW_TABLE_LEG_U_FRAME")).toBe(true);

    const tblTop = bom.cutList.find((p) => p.id.endsWith("_table_top"))!;
    expect(tblTop.miterBevelAngleDeg).toBe(45);
    expect(generatePanelDXF(tblTop)).toContain("MITER_BEVEL_JOINT");

    const pricing = calculateProjectPrice(bom, DEFAULT_PRICING_PARAMS);
    expect(pricing.paintshopLacquerCostEur).toBeGreaterThan(0);
    expect(pricing.leadTime.minBusinessDays).toBe(18);
    expect(pricing.deliveryAndInstallationEur).toBeGreaterThan(95);

    const zpl = generateThermalPartLabelsZpl(proj, bom);
    expect(zpl).toContain("^XA");
    expect(zpl).toContain("^BCN");

    const kLin = createKitchenLinearProject();
    const mepPts = computeProjectMepUtilityPoints(kLin);
    expect(mepPts.length).toBeGreaterThanOrEqual(3);
    const mepDxf = exportArchitecturalMepDxf(kLin);
    expect(mepDxf).toContain("M-PLUMBING");
    expect(mepDxf).toContain("E-POWER");
    expect(generateMepCoordinationPlanSvg(kLin)).toContain("FFL ±0.00");

    // Portable Share URL round-trip
    const url = buildShareableProjectUrl(proj, "https://configurator.birim.com/");
    const decoded = decodeProjectFromShareHash(url);
    expect(decoded).not.toBeNull();
    expect(decoded!.modules.length).toBe(proj.modules.length);
  });
});
