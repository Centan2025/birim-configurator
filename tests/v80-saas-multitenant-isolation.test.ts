import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import {
  DEFAULT_MATERIALS,
  PLAN_ENTITLEMENTS_MATRIX,
  TENANT_ANKA_BUSINESS,
  TENANT_ATOLYE_PRO,
  TENANT_BIRIM_ENTERPRISE,
  applyTenantConstructionToModule,
  buildTenantEmbedSdkSnippet,
  buildTenantScopedStorageKey,
  checkTenantEntitlement,
  createInitialProject,
  hasTenantPermission,
} from "@birim/core";
import { generateBOMForProject } from "@birim/manufacturing";
import { calculateProjectPrice } from "@birim/pricing";
import {
  assertTenantPermissionAndEntitlement,
  listTenantAuditEvents,
  resolveTenantRequestContext,
  signTenantSessionToken,
  TenantSecurityError,
} from "../apps/configurator/src/lib/tenant-auth-guard";
import { resolveSharedBirimPortalEnv } from "../apps/configurator/src/lib/birim-portal-env";
import {
  generateShortQuoteCode,
  getVerifiedQuoteByCodeForTenant,
  saveVerifiedQuote,
} from "../apps/configurator/src/lib/server-quote-store";
import { POST as postStoreQuote } from "../apps/configurator/src/app/api/integrations/store-quote/route";
import { POST as postErpNesting } from "../apps/configurator/src/app/api/integrations/erp-nesting/route";
import { POST as postR2Upload } from "../apps/configurator/src/app/api/integrations/r2-upload/route";
import { buildIsolatedConfiguratorR2Key } from "../apps/configurator/src/lib/r2-upload-helpers";

describe("v80 — Modül Multi-Tenant SaaS Architecture, Isolation & Zero-Trust Security", () => {
  it("1. preserves Birim Mobilya A.Ş. as Tenant #1 with authentic brand & 18mm System-32 defaults", () => {
    expect(TENANT_BIRIM_ENTERPRISE.tenantId).toBe("00000000-0000-0000-0000-000000000001");
    expect(TENANT_BIRIM_ENTERPRISE.slug).toBe("birim");
    expect(TENANT_BIRIM_ENTERPRISE.brand.logoVariant).toBe("birim_authentic");
    expect(TENANT_BIRIM_ENTERPRISE.construction.defaultCarcassThicknessMm).toBe(18);
    expect(TENANT_BIRIM_ENTERPRISE.construction.defaultBackThicknessMm).toBe(8);
    expect(TENANT_BIRIM_ENTERPRISE.construction.connectorSystem).toBe("minifix_dowel");
    expect(TENANT_BIRIM_ENTERPRISE.machine.primaryCncFormat).toBe("homag_mpr");
    expect(TENANT_BIRIM_ENTERPRISE.pricing.currency).toBe("EUR");
  });

  it("2. switches engineering core cleanly to Tenant #2 (Anka 19mm Egger + 4mm HDF + Lamello Cabineo Ø15mm CNC)", () => {
    const baseProj = createInitialProject();
    const ankaModules = baseProj.modules.map((m) =>
      applyTenantConstructionToModule(structuredClone(m), TENANT_ANKA_BUSINESS)
    );
    const ankaProj = {
      ...baseProj,
      tenantId: TENANT_ANKA_BUSINESS.tenantId,
      modules: ankaModules,
    };

    const matMap = new Map(DEFAULT_MATERIALS.map((m) => [m.id, m]));
    const bom = generateBOMForProject(ankaProj, matMap, {
      sheetConfig: {
        name: "Anka 2800x2070",
        lengthMm: TENANT_ANKA_BUSINESS.construction.standardSheetLengthMm,
        widthMm: TENANT_ANKA_BUSINESS.construction.standardSheetWidthMm,
        trimCutMm: TENANT_ANKA_BUSINESS.construction.edgeTrimMarginMm,
        kerfMm: TENANT_ANKA_BUSINESS.construction.sawKerfMm,
      },
    });

    const sidePieces = bom.cutList.filter((p) => p.componentRole === "carcass_side_left" || p.componentRole === "carcass_side_right");
    expect(sidePieces.length).toBeGreaterThan(0);
    expect(sidePieces.every((p) => p.thicknessMm === 19)).toBe(true);

    const backPieces = bom.cutList.filter((p) => p.componentRole === "carcass_back");
    expect(backPieces.length).toBeGreaterThan(0);
    expect(backPieces.every((p) => p.thicknessMm === 4)).toBe(true);

    const cabineoHoles = bom.cutList.flatMap((p) =>
      (p.holes || []).filter((h) => h.purpose === "cabineo_pocket")
    );
    expect(cabineoHoles.length).toBeGreaterThanOrEqual(8);
    expect(cabineoHoles[0].diameter).toBe(15);
    expect(cabineoHoles[0].depth).toBe(12.5);
  });

  it("3. isolates pricing engine & B2B dealer net discount between Tenant #1 (EUR) and Tenant #2 (TRY + 18% dealer)", () => {
    const proj = createInitialProject();
    const matMap = new Map(DEFAULT_MATERIALS.map((m) => [m.id, m]));
    const birimBom = generateBOMForProject(proj, matMap);
    const birimPrice = calculateProjectPrice(birimBom, undefined, matMap);

    const ankaPrice = calculateProjectPrice(
      birimBom,
      {
        ...TENANT_ANKA_BUSINESS.pricing,
        standardSheetAreaM2: (2800 * 2070) / 1_000_000,
      },
      matMap
    );

    expect(birimPrice.currency).toBe("EUR");
    expect(birimPrice.dealerDiscountPercent).toBe(0);
    expect(ankaPrice.currency).toBe("TRY");
    expect(ankaPrice.dealerDiscountPercent).toBe(18);
    expect(ankaPrice.dealerNetWithVatTry).toBe(Math.round(ankaPrice.totalWithVatTry * 0.82));
    expect(ankaPrice.totalWithVatEur).not.toBe(birimPrice.totalWithVatEur);
  });

  it("4. enforces subscription plan entitlements (Professional blocks CNC & ERP; Business/Enterprise allow)", async () => {
    expect(checkTenantEntitlement(TENANT_ATOLYE_PRO, "allowBomExport").allowed).toBe(true);
    expect(checkTenantEntitlement(TENANT_ATOLYE_PRO, "allowCncExport").allowed).toBe(false);
    expect(checkTenantEntitlement(TENANT_ATOLYE_PRO, "allowErpIntegration").allowed).toBe(false);
    expect(checkTenantEntitlement(TENANT_ANKA_BUSINESS, "allowCncExport").allowed).toBe(true);
    expect(checkTenantEntitlement(TENANT_BIRIM_ENTERPRISE, "allowErpIntegration").allowed).toBe(true);

    const atolyeToken = signTenantSessionToken({
      tenantId: TENANT_ATOLYE_PRO.tenantId,
      role: "org_owner",
      userId: "usr_atolye_1",
    });
    const proj = createInitialProject();
    const erpReq = new Request("http://localhost:3300/api/integrations/erp-nesting", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-modul-session-token": atolyeToken,
      },
      body: JSON.stringify({
        project: proj,
        allowOfflineSimulationFallback: true,
      }),
    });
    const erpRes = await postErpNesting(erpReq);
    expect(erpRes.status).toBe(403);
    const erpJson = await erpRes.json();
    expect(erpJson.code).toBe("PLAN_ENTITLEMENT_LOCKED");
  });

  it("5. blocks cross-tenant spoofing (403 TENANT_SPOOFING_BLOCKED) on Store Quote & R2 Upload APIs", async () => {
    const ankaSessionToken = signTenantSessionToken({
      tenantId: TENANT_ANKA_BUSINESS.tenantId,
      role: "org_owner",
      userId: "usr_anka_sec",
    });

    const spoofQuoteReq = new Request("http://localhost:3300/api/integrations/store-quote", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${ankaSessionToken}`,
      },
      body: JSON.stringify({
        project: createInitialProject(),
        organizationId: TENANT_BIRIM_ENTERPRISE.tenantId, // Spoofing Tenant #1 Birim!
        allowOfflineSimulationFallback: true,
      }),
    });
    const spoofQuoteRes = await postStoreQuote(spoofQuoteReq);
    expect(spoofQuoteRes.status).toBe(403);
    const spoofQuoteJson = await spoofQuoteRes.json();
    expect(spoofQuoteJson.code).toBe("TENANT_SPOOFING_BLOCKED");

    const spoofR2Req = new Request("http://localhost:3300/api/integrations/r2-upload", {
      method: "POST",
      headers: {
        "Content-Type": "application/zip",
        "x-modul-session-token": ankaSessionToken,
        "x-birim-org-id": TENANT_BIRIM_ENTERPRISE.tenantId, // Spoofing Birim R2 prefix!
        "x-birim-filename": "spoof.zip",
      },
      body: new Uint8Array([80, 75, 3, 4]),
    });
    const spoofR2Res = await postR2Upload(spoofR2Req);
    expect(spoofR2Res.status).toBe(403);
    const spoofR2Json = await spoofR2Res.json();
    expect(spoofR2Json.code).toBe("TENANT_SPOOFING_BLOCKED");

    const ankaAudits = listTenantAuditEvents(TENANT_ANKA_BUSINESS.tenantId);
    expect(ankaAudits.some((a) => a.action === "SECURITY_CROSS_TENANT_SPOOF_BLOCKED")).toBe(true);
  });

  it("6. isolates sibling Birim Portal .env credentials so external SaaS tenants never inherit Birim secrets", () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "modul-saas-env-test-"));
    const fakePortalEnv = path.join(tmpDir, ".env.local");
    fs.writeFileSync(
      fakePortalEnv,
      [
        "R2_ENDPOINT=https://portalacc.r2.cloudflarestorage.com",
        "R2_BUCKET_NAME=birim-teklif",
        "R2_ACCESS_KEY_ID=birim_key",
        "R2_SECRET_ACCESS_KEY=birim_secret",
      ].join("\n"),
      "utf8"
    );

    const prevEnd = process.env.R2_ENDPOINT;
    const prevBkt = process.env.R2_BUCKET_NAME;
    const prevKey = process.env.R2_ACCESS_KEY_ID;
    const prevSec = process.env.R2_SECRET_ACCESS_KEY;
    delete process.env.R2_ENDPOINT;
    delete process.env.R2_BUCKET_NAME;
    delete process.env.R2_ACCESS_KEY_ID;
    delete process.env.R2_SECRET_ACCESS_KEY;

    try {
      const birimResolved = resolveSharedBirimPortalEnv({
        portalEnvPath: fakePortalEnv,
        tenantId: TENANT_BIRIM_ENTERPRISE.tenantId,
      });
      expect(birimResolved.r2Configured).toBe(true);
      expect(birimResolved.r2BucketName).toBe("birim-teklif");

      const ankaResolved = resolveSharedBirimPortalEnv({
        portalEnvPath: fakePortalEnv,
        tenantId: TENANT_ANKA_BUSINESS.tenantId,
      });
      expect(ankaResolved.r2Configured).toBe(false);
      expect(ankaResolved.portalEnvFilePath).toBeNull();
    } finally {
      if (prevEnd !== undefined) process.env.R2_ENDPOINT = prevEnd;
      if (prevBkt !== undefined) process.env.R2_BUCKET_NAME = prevBkt;
      if (prevKey !== undefined) process.env.R2_ACCESS_KEY_ID = prevKey;
      if (prevSec !== undefined) process.env.R2_SECRET_ACCESS_KEY = prevSec;
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it("7. signs tenant-prefixed quote codes (BRM- vs ANK-) and prevents cross-tenant quote retrieval", () => {
    const proj = createInitialProject();
    const brmCode = generateShortQuoteCode("BRM");
    const ankCode = generateShortQuoteCode("ANK");
    expect(brmCode.startsWith("BRM-")).toBe(true);
    expect(ankCode.startsWith("ANK-")).toBe(true);

    const savedBirim = saveVerifiedQuote({
      code: brmCode,
      tenantId: TENANT_BIRIM_ENTERPRISE.tenantId,
      projectId: proj.id,
      projectTitle: proj.title,
      version: 1,
      createdAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 86400_000).toISOString(),
      discountPercent: 0,
      installments: 1,
      serverVerifiedSubtotalEur: 2158.02,
      serverVerifiedTotalWithVatEur: 2589.62,
      serverVerifiedDiscountedTotalEur: 2589.62,
      serverVerifiedTotalWithVatTry: 108246.12,
      cutPiecesCount: 18,
      totalSheetsCount: 4,
      canApproveProduction: true,
      projectSnapshot: proj,
    });

    expect(
      getVerifiedQuoteByCodeForTenant(savedBirim.code, TENANT_BIRIM_ENTERPRISE.tenantId)?.code
    ).toBe(savedBirim.code);
    expect(
      getVerifiedQuoteByCodeForTenant(savedBirim.code, TENANT_ANKA_BUSINESS.tenantId)
    ).toBeNull();
  });

  it("8. isolates R2 object keys, localStorage keys, and white-label embed snippets per tenant", () => {
    const birimR2 = buildIsolatedConfiguratorR2Key({
      organizationId: TENANT_BIRIM_ENTERPRISE.tenantId,
      subFolder: "cam-packages",
      fileName: "job.zip",
      timestampMs: 1700000000000,
    });
    const ankaR2 = buildIsolatedConfiguratorR2Key({
      organizationId: TENANT_ANKA_BUSINESS.tenantId,
      subFolder: "cam-packages",
      fileName: "job.zip",
      timestampMs: 1700000000000,
    });
    expect(birimR2).toBe(
      "00000000-0000-0000-0000-000000000001/configurator/cam-packages/1700000000000-job.zip"
    );
    expect(ankaR2).toBe(
      "00000000-0000-0000-0000-000000000002/configurator/cam-packages/1700000000000-job.zip"
    );

    const k1 = buildTenantScopedStorageKey(TENANT_BIRIM_ENTERPRISE.tenantId, "saved_projects");
    const k2 = buildTenantScopedStorageKey(TENANT_ANKA_BUSINESS.tenantId, "saved_projects");
    expect(k1).not.toBe(k2);

    const snippet = buildTenantEmbedSdkSnippet(TENANT_ANKA_BUSINESS);
    expect(snippet).toContain('data-tenant="anka"');
    expect(snippet).toContain('data-currency="TRY"');
  });

  it("9. enforces granular 11-role RBAC permissions across sales, dealer, viewer, and production roles", () => {
    expect(hasTenantPermission("sales_rep", "quote:create")).toBe(true);
    expect(hasTenantPermission("sales_rep", "manufacturing:export_cnc")).toBe(false);
    expect(hasTenantPermission("sales_rep", "pricing:view_factory_cost")).toBe(false);
    expect(hasTenantPermission("readonly_viewer", "project:write")).toBe(false);
    expect(hasTenantPermission("production_lead", "erp:publish_production")).toBe(true);
    expect(hasTenantPermission("dealer_admin", "quote:approve_order")).toBe(true);
    expect(hasTenantPermission("dealer_admin", "tenant:manage_settings")).toBe(false);

    const salesToken = signTenantSessionToken({
      tenantId: TENANT_BIRIM_ENTERPRISE.tenantId,
      role: "sales_rep",
      userId: "usr_sales_1",
    });
    const ctx = resolveTenantRequestContext(
      new Request("http://localhost:3300/api/integrations/erp-nesting", {
        headers: { "x-modul-session-token": salesToken },
      })
    );
    expect(() =>
      assertTenantPermissionAndEntitlement(ctx, "erp:publish_production", "allowErpIntegration")
    ).toThrow(TenantSecurityError);
  });

  it("10. verifies PostgreSQL Force-RLS migration DDL, authentic BirimLogo preservation, and brand rules", () => {
    const repoRoot = path.resolve(__dirname, "..");
    const sqlPath = path.join(
      repoRoot,
      "supabase/migrations/20261115000100_modul_saas_multitenant_backbone.sql"
    );
    expect(fs.existsSync(sqlPath)).toBe(true);
    const sql = fs.readFileSync(sqlPath, "utf8");
    expect(sql).toContain("ENABLE ROW LEVEL SECURITY");
    expect(sql).toContain("FORCE ROW LEVEL SECURITY");
    expect(sql).toContain("ORDER_SNAPSHOT_IMMUTABLE");
    expect(sql).toContain("'00000000-0000-0000-0000-000000000001'");
    expect(Object.keys(PLAN_ENTITLEMENTS_MATRIX)).toEqual([
      "starter",
      "professional",
      "business",
      "enterprise",
    ]);

    const dsContent = fs.readFileSync(
      path.join(repoRoot, "apps/configurator/src/v3/design-system/index.tsx"),
      "utf8"
    );
    expect(dsContent).toContain("export const BirimLogo");
    expect(dsContent).toContain('aria-label="BİRİM Logo"');
  });
});
