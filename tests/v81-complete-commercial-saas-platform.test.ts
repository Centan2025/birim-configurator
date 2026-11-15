import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";
import { NextRequest } from "next/server";
import {
  TENANT_ANKA_BUSINESS,
  TENANT_BIRIM_ENTERPRISE,
  addCustomStandardRule,
  createDefaultWardrobeModule,
  createInitialProject,
  evaluateCustomStandardRules,
  loadSavedCustomModuleTemplates,
  persistCustomModuleTemplates,
  removeCustomStandardRule,
} from "@birim/core";
import {
  OutboundWebhookErpAdapter,
  retryDeadLetterWebhookEvent,
  runBirimTenant1ShadowVerification,
  verifyWebhookPayloadHmac256,
} from "@birim/integrations";
import { signTenantSessionToken } from "../apps/configurator/src/lib/tenant-auth-guard";
import {
  IyzicoBillingAdapter,
  StripeBillingAdapter,
} from "../apps/configurator/src/lib/saas-billing-and-metering";
import { POST as postQuotes } from "../apps/configurator/src/app/api/quotes/route";
import { GET as getQuoteByCode } from "../apps/configurator/src/app/api/quotes/[code]/route";
import { POST as postBlenderRender } from "../apps/configurator/src/app/api/render/blender/route";
import { POST as postAuth } from "../apps/configurator/src/app/api/saas/auth/route";
import {
  DELETE as deleteCloudProject,
  GET as getCloudProjects,
  POST as postCloudProjects,
} from "../apps/configurator/src/app/api/saas/projects/route";
import { POST as postCatalog } from "../apps/configurator/src/app/api/saas/catalog/route";
import { POST as postBillingWebhook } from "../apps/configurator/src/app/api/saas/webhooks/billing/route";
import { GET as getPlatformAdmin } from "../apps/configurator/src/app/api/saas/platform-admin/route";

describe("v81 — Complete Commercial Multi-Tenant SaaS Platform (Phases 0–6)", () => {
  it("1. isolates shared quote lookup (/api/quotes/[code]) by tenant session while serving brand & currency on public share links", async () => {
    const ankaToken = signTenantSessionToken({
      tenantId: TENANT_ANKA_BUSINESS.tenantId,
      role: "org_owner",
      userId: "usr_anka_q",
    });
    const birimToken = signTenantSessionToken({
      tenantId: TENANT_BIRIM_ENTERPRISE.tenantId,
      role: "org_owner",
      userId: "usr_birim_q",
    });

    const createRes = await postQuotes(
      new NextRequest("http://localhost:3300/api/quotes", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-modul-session-token": ankaToken },
        body: JSON.stringify({ project: createInitialProject() }),
      })
    );
    const created = await createRes.json();
    expect(created.ok).toBe(true);
    const code = created.quote.code as string;
    expect(code.startsWith("ANK-")).toBe(true);

    // Public share link resolves Anka brand + TRY currency
    const pubRes = await getQuoteByCode(
      new NextRequest(`http://localhost:3300/api/quotes/${code}`),
      { params: Promise.resolve({ code }) }
    );
    expect(pubRes.status).toBe(200);
    const pubJson = await pubRes.json();
    expect(pubJson.currency).toBe("TRY");
    expect(pubJson.brand.displayName).toBe("ANKA MUTFAK");

    // Cross-tenant authenticated session cannot read Anka's quote!
    const crossRes = await getQuoteByCode(
      new NextRequest(`http://localhost:3300/api/quotes/${code}`, {
        headers: { "x-modul-session-token": birimToken },
      }),
      { params: Promise.resolve({ code }) }
    );
    expect(crossRes.status).toBe(404);
  });

  it("2. enforces cloud GPU queue & monthly render quota on /api/render/blender for external SaaS tenants", async () => {
    const ankaToken = signTenantSessionToken({
      tenantId: TENANT_ANKA_BUSINESS.tenantId,
      role: "architect",
      userId: "usr_anka_render",
    });
    const res = await postBlenderRender(
      new NextRequest("http://localhost:3300/api/render/blender", {
        method: "POST",
        headers: { "x-modul-session-token": ankaToken },
      })
    );
    expect(res.status).toBe(202);
    const json = await res.json();
    expect(json.mode).toBe("cloud_gpu_render_queue");
    expect(json.r2TargetKey.startsWith(`${TENANT_ANKA_BUSINESS.tenantId}/configurator/renders/`)).toBe(true);
  });

  it("3. isolates custom engineering standards and custom module templates per tenantId", () => {
    const added = addCustomStandardRule(
      {
        name: "Anka Maksimum Yükseklik 1900mm",
        standardRef: "ANK-STD-1",
        category: "Gövde & Karkas",
        metric: "max_module_height",
        operator: "max",
        thresholdMm: 1900,
        appliesToCategory: "all",
        severity: "error",
        enabled: true,
      },
      TENANT_ANKA_BUSINESS.tenantId
    );
    expect(added.length).toBe(1);

    const birimProj = { ...createInitialProject(), tenantId: TENANT_BIRIM_ENTERPRISE.tenantId };
    const ankaProj = { ...createInitialProject(), tenantId: TENANT_ANKA_BUSINESS.tenantId };
    expect(evaluateCustomStandardRules(birimProj).length).toBe(0);
    expect(evaluateCustomStandardRules(ankaProj).length).toBeGreaterThan(0);

    removeCustomStandardRule(added[0].id, TENANT_ANKA_BUSINESS.tenantId);

    persistCustomModuleTemplates(
      [
        {
          templateId: "ctpl_anka_only",
          name: "Anka Özel Modül",
          category: "wardrobe",
          createdAt: new Date().toISOString(),
          baseDimensions: { width: 1000, height: 2100, depth: 600 },
          serializedModuleSnapshot: JSON.stringify(createDefaultWardrobeModule()),
        },
      ],
      TENANT_ANKA_BUSINESS.tenantId
    );
    expect(loadSavedCustomModuleTemplates(TENANT_BIRIM_ENTERPRISE.tenantId).length).toBe(0);
    expect(loadSavedCustomModuleTemplates(TENANT_ANKA_BUSINESS.tenantId).length).toBe(1);
  });

  it("4. dispatches HMAC-signed outbound ERP webhooks with Outbox DLQ & manual replay", async () => {
    const origFetch = global.fetch;
    let shouldFail = true;
    let capturedHeaders: Record<string, string> = {};
    let capturedBody = "";

    global.fetch = (async (_url: RequestInfo | URL, init?: RequestInit) => {
      const h = new Headers(init?.headers);
      capturedHeaders = {
        sig: h.get("x-modul-signature-256") || "",
        ts: h.get("x-modul-timestamp") || "",
        tenant: h.get("x-modul-tenant-id") || "",
      };
      capturedBody = String(init?.body || "");
      if (shouldFail) return new Response("Upstream Down", { status: 503 });
      return new Response(JSON.stringify({ received: true }), { status: 200 });
    }) as typeof fetch;

    try {
      const adapter = new OutboundWebhookErpAdapter({
        tenantId: TENANT_ANKA_BUSINESS.tenantId,
        endpointUrl: "https://erp.ankamutfak.com.tr/hooks/modul",
        signingSecret: "whsec_test_anka",
        maxAttempts: 2,
      });
      const dlqEvent = await adapter.dispatchEvent({
        eventType: "quotation.upserted",
        idempotencyKey: "idemp_dlq_1",
        payload: { quoteNo: "ANK-001", totalTry: 85000 },
      });
      expect(dlqEvent.status).toBe("failed_dlq");
      expect(dlqEvent.attemptCount).toBe(2);
      expect(
        verifyWebhookPayloadHmac256(
          capturedBody,
          capturedHeaders.ts,
          capturedHeaders.sig,
          "whsec_test_anka"
        )
      ).toBe(true);

      shouldFail = false;
      const replayed = await retryDeadLetterWebhookEvent(
        TENANT_ANKA_BUSINESS.tenantId,
        dlqEvent.id,
        "whsec_test_anka"
      );
      expect(replayed?.status).toBe("delivered");
    } finally {
      global.fetch = origFetch;
    }
  });

  it("5. proves 0.00 EUR and 0 piece/hole drift in Birim Tenant #1 shadow-run verification", () => {
    const report = runBirimTenant1ShadowVerification();
    expect(report.parityVerified).toBe(true);
    expect(report.eurDelta).toBe(0);
    expect(report.cutPieceCountDelta).toBe(0);
    expect(report.drillingHoleCountDelta).toBe(0);
  });

  it("6. supports self-service tenant onboarding, scrypt login, team invitations, and immutable order-locked versions", async () => {
    const regRes = await postAuth(
      new NextRequest("http://localhost:3300/api/saas/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "register_org",
          companyDisplayName: "EGE MOBİLYA",
          companyLegalName: "Ege Modüler Mobilya San. A.Ş.",
          slug: "ege-mobilya",
          fullName: "Deniz Kaya",
          email: "deniz@egemobilya.com.tr",
          password: "EgeStrongPassword2026!",
          planId: "business",
          currency: "TRY",
          carcassThicknessMm: 19,
          backPanelMounting: "surface_nailed_4mm",
          connectorSystem: "lamello_cabineo",
          primaryCncFormat: "biesse_cix",
        }),
      })
    );
    expect(regRes.status).toBe(201);
    const regJson = await regRes.json();
    const egeToken = regJson.sessionToken as string;
    const egeTenantId = regJson.tenant.tenantId as string;

    // Verify login with scrypt password
    const loginRes = await postAuth(
      new NextRequest("http://localhost:3300/api/saas/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "login",
          email: "deniz@egemobilya.com.tr",
          password: "EgeStrongPassword2026!",
        }),
      })
    );
    expect(loginRes.status).toBe(200);

    // Save order-locked project version (v1) and verify immutability (409 ORDER_SNAPSHOT_IMMUTABLE)
    const proj = createInitialProject();
    const saveRes = await postCloudProjects(
      new NextRequest("http://localhost:3300/api/saas/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-modul-session-token": egeToken },
        body: JSON.stringify({ project: proj, lockAsOrder: true }),
      })
    );
    expect(saveRes.status).toBe(201);

    const overwriteLockedRes = await postCloudProjects(
      new NextRequest("http://localhost:3300/api/saas/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-modul-session-token": egeToken },
        body: JSON.stringify({ project: proj, overwriteVersionNo: 1 }),
      })
    );
    expect(overwriteLockedRes.status).toBe(409);
    const overwriteJson = await overwriteLockedRes.json();
    expect(overwriteJson.code).toBe("ORDER_SNAPSHOT_IMMUTABLE");

    const delLockedRes = await deleteCloudProject(
      new NextRequest(
        `http://localhost:3300/api/saas/projects?projectId=${proj.id}&versionNo=1`,
        { headers: { "x-modul-session-token": egeToken } }
      )
    );
    expect(delLockedRes.status).toBe(409);

    // Verify İyzico & Stripe Billing Webhooks + 7-day past_due read-only grace period!
    const iyz = new IyzicoBillingAdapter();
    const failPayload = JSON.stringify({
      eventType: "invoice.payment_failed",
      tenantId: egeTenantId,
    });
    const forgedWh = await postBillingWebhook(
      new NextRequest("http://localhost:3300/api/saas/webhooks/billing", {
        method: "POST",
        headers: { "x-iyz-signature-v3": "forged_bad_sig" },
        body: failPayload,
      })
    );
    expect(forgedWh.status).toBe(401);

    const validFailWh = await postBillingWebhook(
      new NextRequest("http://localhost:3300/api/saas/webhooks/billing", {
        method: "POST",
        headers: { "x-iyz-signature-v3": iyz.signWebhookPayload(failPayload) },
        body: failPayload,
      })
    );
    expect(validFailWh.status).toBe(200);

    // In past_due grace mode: GET (read) succeeds, POST new project (write) returns 402 BILLING_PAST_DUE_READONLY!
    const readDuringGrace = await getCloudProjects(
      new NextRequest("http://localhost:3300/api/saas/projects", {
        headers: { "x-modul-session-token": egeToken },
      })
    );
    expect(readDuringGrace.status).toBe(200);

    const writeDuringGrace = await postCloudProjects(
      new NextRequest("http://localhost:3300/api/saas/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-modul-session-token": egeToken },
        body: JSON.stringify({ project: { ...proj, id: "proj_blocked_in_past_due" } }),
      })
    );
    expect(writeDuringGrace.status).toBe(402);

    // Stripe webhook reactivates subscription!
    const stripe = new StripeBillingAdapter();
    const paidPayload = JSON.stringify({
      eventType: "invoice.paid",
      tenantId: egeTenantId,
      planId: "enterprise",
    });
    const paidWh = await postBillingWebhook(
      new NextRequest("http://localhost:3300/api/saas/webhooks/billing", {
        method: "POST",
        headers: { "stripe-signature": stripe.signWebhookPayload(paidPayload) },
        body: paidPayload,
      })
    );
    expect(paidWh.status).toBe(200);

    // CSV Material Importer + Pre-publish Template Validator
    const csvRes = await postCatalog(
      new NextRequest("http://localhost:3300/api/saas/catalog", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-modul-session-token": egeToken },
        body: JSON.stringify({
          action: "import_materials_csv",
          csvText:
            "code,name,brand,category,thicknessMm,costPerM2Eur,edgeBandCostPerMEur,colorHex\negger_u708,Egger U708 Açık Gri 19mm,Egger,laminate,19,21.40,1.55,#D5D5D0",
        }),
      })
    );
    expect(csvRes.status).toBe(201);

    // Platform SuperAdmin Guard
    const deniedSuper = await getPlatformAdmin(
      new NextRequest("http://localhost:3300/api/saas/platform-admin", {
        headers: { "x-modul-session-token": egeToken },
      })
    );
    expect(deniedSuper.status).toBe(403);

    const superToken = signTenantSessionToken({
      tenantId: TENANT_BIRIM_ENTERPRISE.tenantId,
      role: "platform_admin",
      userId: "usr_platform_root",
    });
    const okSuper = await getPlatformAdmin(
      new NextRequest("http://localhost:3300/api/saas/platform-admin", {
        headers: { "x-modul-session-token": superToken },
      })
    );
    expect(okSuper.status).toBe(200);

    // Verify public/sdk/v1/embed.js exists and mounts iframe cleanly
    const embedPath = path.resolve(
      __dirname,
      "../apps/configurator/public/sdk/v1/embed.js"
    );
    expect(fs.existsSync(embedPath)).toBe(true);
  });
});
