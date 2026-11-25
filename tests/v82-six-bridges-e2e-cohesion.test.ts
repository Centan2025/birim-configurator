import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import { NextRequest } from "next/server";
import {
  TENANT_ANKA_BUSINESS,
  TENANT_BIRIM_ENTERPRISE,
  createInitialProject,
} from "@birim/core";
import {
  buildPortableNestingWorkerBootstrapSource,
  generateBOMForProject,
  runPortableGuillotineNestingKernel,
} from "@birim/manufacturing";
import {
  extractCookieValue,
  recordTenantAuditEvent,
  resolveTenantRequestContext,
  signTenantSessionToken,
  TenantSecurityError,
} from "../apps/configurator/src/lib/tenant-auth-guard";
import { importTenantMaterialsFromCsv } from "../apps/configurator/src/lib/tenant-catalog-importer";
import {
  getSaasLedgerFilePath,
  readSaasPersistentLedger,
  syncRowToSaasPostgrest,
} from "../apps/configurator/src/lib/saas-persistent-ledger";
import { GET as getCloudProjects } from "../apps/configurator/src/app/api/saas/projects/route";

describe("v82 — End-to-End Cohesion of All 6 Final SaaS Bridges", () => {
  it("1. authenticates HttpOnly modul_session cookies and blocks cross-tenant spoofing on cookie sessions", async () => {
    const ankaSession = signTenantSessionToken({
      tenantId: TENANT_ANKA_BUSINESS.tenantId,
      role: "org_owner",
      userId: "usr_anka_cookie",
    });
    const cookieHeader = `theme=light; modul_session=${encodeURIComponent(ankaSession)}; lang=tr`;
    expect(extractCookieValue(cookieHeader, "modul_session")).toBe(ankaSession);

    const okReq = new NextRequest("http://localhost:3300/api/saas/projects", {
      headers: { Cookie: cookieHeader },
    });
    const ctx = resolveTenantRequestContext(okReq);
    expect(ctx.authenticated).toBe(true);
    expect(ctx.tenantId).toBe(TENANT_ANKA_BUSINESS.tenantId);

    const res = await getCloudProjects(okReq);
    expect(res.status).toBe(200);

    const spoofReq = new NextRequest("http://localhost:3300/api/saas/projects", {
      headers: {
        Cookie: cookieHeader,
        "x-birim-org-id": TENANT_BIRIM_ENTERPRISE.tenantId,
      },
    });
    expect(() => resolveTenantRequestContext(spoofReq)).toThrow(TenantSecurityError);
  });

  it("2. imports CSV materials and verifies portable single-source Worker nesting bootstrap", () => {
    const imported = importTenantMaterialsFromCsv(
      TENANT_ANKA_BUSINESS.tenantId,
      "code,name,brand,category,thicknessMm,costPerM2Eur,edgeBandCostPerMEur,colorHex\negger_w1000,Egger Premium Beyaz 19mm,Egger,laminate,19,20.90,1.50,#FAFAFA"
    );
    expect(imported.importedCount).toBe(1);
    expect(imported.materials[0].thickness).toBe(19);

    const bom = generateBOMForProject(createInitialProject(), undefined, { skipSyncNesting: true });
    const directRes = runPortableGuillotineNestingKernel(bom.cutList, {
      lengthMm: 2800,
      widthMm: 2070,
      trimCutMm: 15,
      kerfMm: 4.0,
    });
    expect(directRes.length).toBeGreaterThan(0);

    // Execute serialized worker bootstrap string in an isolated Worker-like scope
    const workerSrc = buildPortableNestingWorkerBootstrapSource();
    let postedMsg: { ok: boolean; result?: unknown[] } | null = null;
    const selfShim: {
      onmessage: ((e: { data: unknown }) => void) | null;
      postMessage: (m: { ok: boolean; result?: unknown[] }) => void;
    } = {
      onmessage: null,
      postMessage(msg) {
        postedMsg = msg;
      },
    };
    new Function("self", workerSrc)(selfShim);
    selfShim.onmessage?.({ data: { pieces: bom.cutList } });
    const msg = postedMsg as { ok: boolean; result?: unknown[] } | null;
    expect(msg?.ok).toBe(true);
    expect(msg?.result?.length).toBe(directRes.length);
  });

  it("3. persists audit & subscription ledgers to disk and writes through to PostgREST when enabled", async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "modul-ledger-test-"));
    const prevDir = process.env.MODUL_SAAS_DATA_DIR;
    const prevUrl = process.env.SUPABASE_URL;
    const prevKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const origFetch = global.fetch;

    process.env.MODUL_SAAS_DATA_DIR = tmpDir;
    process.env.SUPABASE_URL = "https://saas-test-instance.supabase.co";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "srv_test_key";

    let postgrestCalledUrl = "";
    global.fetch = (async (url: RequestInfo | URL) => {
      postgrestCalledUrl = String(url);
      return new Response("", { status: 201 });
    }) as typeof fetch;

    try {
      recordTenantAuditEvent({
        tenantId: TENANT_BIRIM_ENTERPRISE.tenantId,
        actorUserId: "usr_1",
        actorRole: "org_owner",
        action: "BRIDGE_4_PERSISTENCE_TEST",
        targetType: "ledger",
        targetId: "l1",
      });
      expect(fs.existsSync(getSaasLedgerFilePath())).toBe(true);
      expect(
        Array.isArray(readSaasPersistentLedger().auditLogsByTenant[TENANT_BIRIM_ENTERPRISE.tenantId])
      ).toBe(true);

      const synced = await syncRowToSaasPostgrest(
        "modul_audit_logs",
        TENANT_BIRIM_ENTERPRISE.tenantId,
        { tenant_id: TENANT_BIRIM_ENTERPRISE.tenantId, action: "TEST" }
      );
      expect(synced).toBe(true);
      expect(postgrestCalledUrl).toContain("/rest/v1/modul_audit_logs");
    } finally {
      global.fetch = origFetch;
      if (prevDir === undefined) delete process.env.MODUL_SAAS_DATA_DIR;
      else process.env.MODUL_SAAS_DATA_DIR = prevDir;
      if (prevUrl === undefined) delete process.env.SUPABASE_URL;
      else process.env.SUPABASE_URL = prevUrl;
      if (prevKey === undefined) delete process.env.SUPABASE_SERVICE_ROLE_KEY;
      else process.env.SUPABASE_SERVICE_ROLE_KEY = prevKey;
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it("4. verifies V3ProjectModal cloud integration, .env.example SaaS keys, and modular RulesStandardsModal", () => {
    const repoRoot = path.resolve(__dirname, "..");
    const envExample = fs.readFileSync(
      path.join(repoRoot, "apps/configurator/.env.example"),
      "utf8"
    );
    expect(envExample).toContain("MODUL_SAAS_SESSION_SECRET");
    expect(envExample).toContain("IYZICO_SECRET_KEY");
    expect(envExample).toContain("STRIPE_WEBHOOK_SECRET");

    const projModal = fs.readFileSync(
      path.join(repoRoot, "apps/configurator/src/v3/components/V3ProjectModal.tsx"),
      "utf8"
    );
    expect(projModal).toContain("/api/saas/projects");
    expect(projModal).toContain('data-testid="v3-cloud-save-btn"');

    const workerClient = fs.readFileSync(
      path.join(repoRoot, "apps/configurator/src/workers/manufacturing-worker-client.ts"),
      "utf8"
    );
    expect(workerClient).not.toContain("INLINE_NESTING_WORKER_SOURCE");
    expect(workerClient).toContain("buildPortableNestingWorkerBootstrapSource");

    expect(
      fs.existsSync(
        path.join(repoRoot, "apps/configurator/src/v3/components/workspace/RulesStandardsModal.tsx")
      )
    ).toBe(true);
  });
});
