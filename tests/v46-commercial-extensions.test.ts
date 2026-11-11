import { describe, it, expect } from "vitest";
import {
  evaluateCornerAndSweepCollisions,
  computeCornerFillerAutoFix,
  type SweepModuleInput,
} from "../packages/core/src/sweep-collision";
import {
  validatePanelCutouts,
  detectWallUtilityCutoutsForModule,
} from "../packages/core/src/panel-cutouts";
import {
  exportPartsToGLB,
  exportPartsToOBJ,
  exportPartsToUSDA,
} from "../packages/geometry/src/exporters3d";
import {
  generateHomagMprPrograms,
  generateBiesseCixProgram,
} from "../packages/manufacturing/src/cnc-postprocessors";
import { generateQrCodeSvg, encodeQrMatrix } from "../apps/configurator/src/lib/qr-svg";
import {
  saveVerifiedQuote,
  getVerifiedQuoteByCode,
  verifyQuoteHmac,
} from "../apps/configurator/src/lib/server-quote-store";

describe("Birim V4.6 Commercial, CAD, AR, CNC & Quote Extensions", () => {
  it("detects 90-degree corner handle/door sweep collisions and auto-resolves with 50mm filler", () => {
    const cornerModules: SweepModuleInput[] = [
      {
        id: "mod_main",
        name: "Ana Duvar Alt Dolap",
        position: { x: 0, y: 0, z: 0 },
        rotation: { x: 0, y: 0, z: 0 },
        dimensions: { width: 600, height: 850, depth: 580 },
        carcass: { panelThickness: 18, plinthHeight: 100 },
        bays: [
          {
            index: 0,
            door: { type: "single_left", handleCategory: "linear_bar" },
            drawers: [],
          },
        ],
      },
      {
        id: "mod_return",
        name: "Sol Dönüş Alt Dolap",
        position: { x: 600, y: 0, z: 580 },
        rotation: { x: 0, y: 270, z: 0 },
        dimensions: { width: 600, height: 850, depth: 580 },
        carcass: { panelThickness: 18, plinthHeight: 100 },
        bays: [
          {
            index: 0,
            door: { type: "single_right", handleCategory: "linear_bar" },
            drawers: [
              { id: "d1", elevationY: 0, height: 200 },
            ],
          },
        ],
      },
    ];

    const issues = evaluateCornerAndSweepCollisions(cornerModules, 50);
    expect(issues.length).toBeGreaterThan(0);
    expect(issues[0].recommendedFillerMm).toBeGreaterThanOrEqual(50);

    const fixed = computeCornerFillerAutoFix(cornerModules, 50);
    expect(fixed.resolvedCount).toBeGreaterThan(0);
    expect(fixed.insertedFillerSpecs[0].widthMm).toBeGreaterThanOrEqual(50);
  });

  it("validates socket/baseboard cutouts and auto-detects rear wall plumbing cutouts", () => {
    const auto = detectWallUtilityCutoutsForModule(
      {
        id: "m_sink",
        position: { x: 600, y: 0, z: 0 },
        dimensions: { width: 800, height: 860, depth: 580 },
        carcass: { panelThickness: 18, plinthHeight: 100 },
      },
      [
        {
          id: "obs_plumb",
          type: "plumbing",
          name: "Mutfak Tesisatı",
          position: { x: 920, y: 420, z: 0 },
          dimensions: { width: 120, height: 120, depth: 80 },
        },
      ]
    );
    expect(auto.length).toBe(1);
    expect(auto[0].targetPanel).toBe("back");

    const invalidEdge = validatePanelCutouts(
      { width: 800, height: 2200, depth: 600 },
      18,
      [
        {
          id: "c_bad",
          targetPanel: "back",
          kind: "socket_single",
          shape: "rect",
          centerXMm: 25,
          centerYMm: 350,
          widthMm: 82,
          heightMm: 82,
          label: "Kenara Taşan Priz",
        },
      ]
    );
    expect(invalidEdge.some((i) => i.severity === "error")).toBe(true);
  });

  it("exports spec-compliant binary .GLB (glTF 2.0), .OBJ+.MTL, and .USDA models", () => {
    const sampleParts = [
      {
        id: "p1",
        name: "Sol Yan Panel",
        role: "carcass_side",
        moduleId: "m1",
        moduleName: "Gardırop",
        materialId: "mat_veneer_oak",
        positionMm: { x: 9, y: 1200, z: 300 },
        dimensionsMm: { width: 18, height: 2400, depth: 600 },
      },
    ];
    const mats = [{ id: "mat_veneer_oak", name: "Doğal Meşe", colorHex: "#C5A882" }];

    const glb = exportPartsToGLB(sampleParts, mats, "Birim Gardırop");
    const dv = new DataView(glb.buffer, glb.byteOffset, glb.byteLength);
    expect(dv.getUint32(0, true)).toBe(0x46546c67); // 'glTF'
    expect(dv.getUint32(4, true)).toBe(2);
    expect(glb.byteLength % 4).toBe(0);

    const { objContent, mtlContent } = exportPartsToOBJ(sampleParts, mats);
    expect(objContent).toContain("usemtl mat_veneer_oak");
    expect(mtlContent).toContain("newmtl mat_veneer_oak");

    const usda = exportPartsToUSDA(sampleParts, mats, "Birim_Gardırop");
    expect(usda).toContain("#usda 1.0");
    expect(usda).toContain("UsdPreviewSurface");
  });

  it("generates double-sided flip .MPR and multi-side .CIX CNC files", () => {
    const dividerPiece = {
      id: "div_1",
      moduleId: "m1",
      moduleName: "Gardırop",
      partRole: "carcass_divider",
      pieceName: "Ara Dikme",
      thicknessMm: 18,
      lengthMm: 2284,
      widthMm: 572,
      drillingOperations: [
        { x: 37, y: 320, diameter: 5, depth: 12, face: "top" as const, type: "system_32" },
        { x: 37, y: 320, diameter: 5, depth: 12, face: "bottom" as const, type: "system_32" },
        { x: 69, y: 0, diameter: 8, depth: 24, face: "edge_bottom" as const, type: "minifix_bolt_8mm" },
      ],
      utilityCutouts: [
        {
          id: "co_1",
          shape: "circle" as const,
          centerXMm: 280,
          centerYMm: 600,
          widthMm: 60,
          heightMm: 60,
          diameterMm: 60,
          label: "Kablo Buat",
        },
      ],
    };

    const mprs = generateHomagMprPrograms(dividerPiece);
    expect(mprs.length).toBe(2);
    expect(mprs[0].faceSetup).toBe("TOP_SETUP_1");
    expect(mprs[1].faceSetup).toBe("FLIP_BOTTOM_SETUP_2");
    expect(mprs[0].content).toContain("\\BohrHoriz\\");
    expect(mprs[0].content).toContain("\\Tasche\\");
    // Mirrored Y coordinate on flip setup: 572 - 37 = 535.00
    expect(mprs[1].content).toContain('YA="535.00"');

    const cix = generateBiesseCixProgram(dividerPiece);
    expect(cix.requiresOperatorFlip).toBe(true);
    expect(cix.content).toContain("PARAM,NAME=SIDE,VALUE=0");
    expect(cix.content).toContain("PARAM,NAME=SIDE,VALUE=5");
    expect(cix.content).toContain("PARAM,NAME=SIDE,VALUE=1");
  });

  it("encodes offline Reed-Solomon QR SVG and verifies HMAC quote signatures", () => {
    const mat = encodeQrMatrix("https://konfigurator.birim.com/p/BRM-8K4P2X");
    expect(mat.length).toBeGreaterThanOrEqual(25);
    expect(mat[0][0]).toBe(true);
    const svg = generateQrCodeSvg("https://konfigurator.birim.com/p/BRM-8K4P2X");
    expect(svg).toContain("<svg");

    const signed = saveVerifiedQuote({
      code: "BRM-TEST99",
      projectId: "proj_1",
      projectTitle: "Test Proje",
      version: 1,
      createdAt: "2026-11-11T00:00:00.000Z",
      expiresAt: "2026-11-25T00:00:00.000Z",
      discountPercent: 10,
      installments: 6,
      serverVerifiedSubtotalEur: 1000,
      serverVerifiedTotalWithVatEur: 1200,
      serverVerifiedDiscountedTotalEur: 1080,
      serverVerifiedTotalWithVatTry: 43200,
      cutPiecesCount: 18,
      totalSheetsCount: 4,
      canApproveProduction: true,
      projectSnapshot: {} as never,
    });
    expect(verifyQuoteHmac(signed)).toBe(true);
    expect(getVerifiedQuoteByCode("BRM-TEST99")?.serverVerifiedDiscountedTotalEur).toBe(1080);

    // Tamper check: altering total by 1 cent invalidates HMAC
    expect(
      verifyQuoteHmac({
        ...signed,
        serverVerifiedDiscountedTotalEur: 1079.99,
      })
    ).toBe(false);
  });
});
