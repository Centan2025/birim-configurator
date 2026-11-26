import { describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { createInitialProject, DEFAULT_MATERIALS, type ParametricPart } from "@birim/core";
import {
  generateBOMForProject,
  generateBiesseCixProgram,
  generateDrillingForPart,
  generateHomagMprPrograms,
  optimizeSheetNesting,
  type CutPiece,
} from "@birim/manufacturing";
import { saveVerifiedQuote } from "../apps/configurator/src/lib/server-quote-store";
import { GET as getQuoteByCode } from "../apps/configurator/src/app/api/quotes/[code]/route";
import { POST as postErpNesting } from "../apps/configurator/src/app/api/integrations/erp-nesting/route";
import { signTenantSessionToken } from "../apps/configurator/src/lib/tenant-auth-guard";

describe("Faz 1: P0 Güvenlik & CNC Üretim Sertleştirmeleri", () => {
  it("P0-SEC-02: Oturumsuz GET /api/quotes/[code] yanıtı dealerNetTotalWithVatTry alanını sızdırmaz", async () => {
    const project = createInitialProject();
    const saved = saveVerifiedQuote({
      code: "TST-DEALER1",
      tenantId: "00000000-0000-0000-0000-000000000001",
      dealerNetTotalWithVatTry: 99999,
      projectId: project.id,
      projectTitle: project.title,
      version: project.version,
      createdAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 86400_000).toISOString(),
      discountPercent: 0,
      installments: 1,
      serverVerifiedSubtotalEur: 1000,
      serverVerifiedTotalWithVatEur: 1200,
      serverVerifiedDiscountedTotalEur: 1200,
      serverVerifiedTotalWithVatTry: 50000,
      cutPiecesCount: 10,
      totalSheetsCount: 2,
      canApproveProduction: false,
      projectSnapshot: project,
    });

    const publicReq = new NextRequest(`http://localhost:3300/api/quotes/${saved.code}`, {
      headers: { "x-forwarded-for": "10.0.0.42" },
    });
    const publicRes = await getQuoteByCode(publicReq, {
      params: Promise.resolve({ code: saved.code }),
    });
    expect(publicRes.status).toBe(200);
    const publicBody = (await publicRes.json()) as {
      ok: boolean;
      quote: Record<string, unknown>;
    };
    expect(publicBody.ok).toBe(true);
    expect("dealerNetTotalWithVatTry" in publicBody.quote).toBe(false);

    // Authenticated tenant request still receives full quote including dealer net
    const token = signTenantSessionToken({
      tenantId: "00000000-0000-0000-0000-000000000001",
      role: "org_owner",
    });
    const authReq = new NextRequest(`http://localhost:3300/api/quotes/${saved.code}`, {
      headers: {
        authorization: `Bearer ${token}`,
        "x-forwarded-for": "10.0.0.43",
      },
    });
    const authRes = await getQuoteByCode(authReq, {
      params: Promise.resolve({ code: saved.code }),
    });
    expect(authRes.status).toBe(200);
    const authBody = (await authRes.json()) as {
      ok: boolean;
      quote: Record<string, unknown>;
    };
    expect(authBody.quote.dealerNetTotalWithVatTry).toBe(99999);
  });

  it("P0-SEC-03: POST /api/integrations/erp-nesting auth öncesi global DEFAULT_MATERIALS mutasyonu yapmaz", async () => {
    const initialCount = DEFAULT_MATERIALS.length;
    const project = createInitialProject();
    project.customMaterials = [
      {
        ...DEFAULT_MATERIALS[0],
        id: "mat_poison_attempt_faz1",
        name: "Poison Material",
        costPerM2: 0.01,
        edgeBandCostPerM: 0.01,
        hasGrain: false,
      },
    ];

    const req = new Request("http://localhost:3300/api/integrations/erp-nesting", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        authorization: "Bearer mdl_sess_invalid.token",
      },
      body: JSON.stringify({ project }),
    });
    const res = await postErpNesting(req);
    expect(res.status).toBe(401);
    expect(DEFAULT_MATERIALS.length).toBe(initialCount);
    expect(DEFAULT_MATERIALS.some((m) => m.id === "mat_poison_attempt_faz1")).toBe(false);
  });

  it("P0-CNC-01: role='shelf_fixed' sabit raflar minifix/kavela deliklerini üretir (0 delik hatası yok)", () => {
    const fixedShelfPart: ParametricPart = {
      id: "part_fixed_shelf_1",
      moduleId: "mod_1",
      label: "Ara Sabit Raf",
      role: "shelf_fixed",
      dimensions: { width: 520, height: 764, depth: 18 },
      materialId: DEFAULT_MATERIALS[0].id,
      grain: "none",
      edgeBanding: { top: false, bottom: false, left: true, right: false, thickness: 1 },
      jointType: "minifix_dowel",
      holes: [],
      position: { x: 0, y: 0, z: 0 },
      connectorSystem: "minifix_dowel",
      carcassJoineryTopology: "sides_through",
    };

    const holes = generateDrillingForPart(fixedShelfPart);
    expect(holes.length).toBeGreaterThan(0);
    expect(holes.some((h) => h.purpose === "minifix_cam")).toBe(true);
    expect(holes.some((h) => h.purpose === "minifix_bolt")).toBe(true);
  });

  it("P0-CNC-02: hasBackGroove undefined/false olduğunda Homag MPR ve Biesse CIX arkalık kanalı açmaz", () => {
    const baseSide = {
      id: "side_no_groove",
      moduleId: "mod_1",
      moduleName: "Açık Raf",
      partRole: "carcass_side_left",
      pieceName: "Sol Yan Panel",
      thicknessMm: 18,
      lengthMm: 720,
      widthMm: 560,
      netCutLengthMm: 718,
      netCutWidthMm: 558,
      drillingOperations: [],
    };

    const mprNoGroove = generateHomagMprPrograms(baseSide)[0].content;
    const cixNoGroove = generateBiesseCixProgram(baseSide).content;
    expect(mprNoGroove).not.toContain("BACK_GROOVE_8MM");
    expect(cixNoGroove).not.toContain("NAME=CUT_G");

    const mprWithGroove = generateHomagMprPrograms({ ...baseSide, hasBackGroove: true })[0].content;
    const cixWithGroove = generateBiesseCixProgram({ ...baseSide, hasBackGroove: true }).content;
    expect(mprWithGroove).toContain("BACK_GROOVE_8MM");
    expect(cixWithGroove).toContain("NAME=CUT_G");
  });

  it("P1-CNC-03: optimizeSheetNesting sıfır veya negatif ölçülü parçaları unplacedPieces'e ayırır", () => {
    const invalidPiece: CutPiece = {
      id: "bad_zero_piece",
      pieceName: "Bozuk Parça",
      moduleName: "Test",
      moduleId: "mod_1",
      componentRole: "shelf",
      materialId: DEFAULT_MATERIALS[0].id,
      materialName: DEFAULT_MATERIALS[0].name,
      lengthMm: 0,
      widthMm: -50,
      netCutLengthMm: 0,
      netCutWidthMm: -50,
      thicknessMm: 18,
      quantity: 1,
      edgeBanding: { top: false, bottom: false, left: false, right: false, thickness: 1 },
      areaM2: 0,
      edgeBandMeters: 0,
      grain: "none",
      holes: [],
    };

    const results = optimizeSheetNesting([invalidPiece]);
    expect(results.length).toBe(1);
    expect(results[0].unplacedPieces.length).toBe(1);
    expect(results[0].unplacedPieces[0].id).toBe("bad_zero_piece");
    expect(results[0].totalSheetsCount).toBe(0);
  });

  it("P1-MFG-01: Eviye sahne nesnesi BOM'da çift koruma sacı SKU'su eklemez", () => {
    const project = createInitialProject();
    project.sceneObjects = [
      {
        id: "so_sink_1",
        catalogId: "obj_sink_inox_1",
        sku: "SNK-1",
        name: "Paslanmaz Eviye",
        category: "appliance",
        visualKind: "sink_undermount_faucet",
        anchorMode: "countertop_cutout",
        position: { x: 200, y: 850, z: 300 },
        rotation: { x: 0, y: 0, z: 0 },
        dimensions: { width: 500, height: 200, depth: 450 },
        commercialRole: "quoted_product",
        unitPriceEur: 180,
        cutoutTrigger: { kind: "sink", cutoutWidthMm: 480, cutoutDepthMm: 430 },
      },
    ];
    const bom = generateBOMForProject(project);
    const evyeSac = bom.hardwareList.filter(
      (h) => h.sku === "EVYE-KORUMA-SAC" || h.sku === "HW_SINK_DRIP_MAT_ALU"
    );
    expect(evyeSac.length).toBe(1);
    expect(evyeSac[0].sku).toBe("EVYE-KORUMA-SAC");
    expect(evyeSac[0].quantity).toBe(1);
  });
});
