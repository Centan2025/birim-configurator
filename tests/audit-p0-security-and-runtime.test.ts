import { describe, it, expect } from "vitest";
import { NextRequest } from "next/server";
import {
  DEFAULT_MATERIALS,
  TENANT_ANKA_BUSINESS,
  TENANT_BIRIM_ENTERPRISE,
  createInitialProject,
} from "@birim/core";
import { V5_SCENE_OBJECT_CATALOG } from "@birim/catalog";
import { OutboundWebhookErpAdapter } from "@birim/integrations";
import {
  buildAuthoritativeMaterialsMap,
  buildAuthoritativeSceneObjects,
  clampAuthoritativeDiscountPercent,
} from "../apps/configurator/src/lib/authoritative-pricing";
import {
  ALLOWED_EXTENSIONS,
  validateR2UploadContent,
} from "../apps/configurator/src/lib/r2-upload-helpers";
import { StripeBillingAdapter } from "../apps/configurator/src/lib/saas-billing-and-metering";
import { signTenantSessionToken } from "../apps/configurator/src/lib/tenant-auth-guard";
import { POST as postQuotes } from "../apps/configurator/src/app/api/quotes/route";
import { GET as getTenants } from "../apps/configurator/src/app/api/saas/tenants/route";
import { POST as postAuth } from "../apps/configurator/src/app/api/saas/auth/route";
import { GET as getSupabaseHealth } from "../apps/configurator/src/app/api/saas/supabase-health/route";
import { useConfiguratorStore } from "../apps/configurator/src/store/useConfiguratorStore";

describe("Audit Phase 1 — P0 Security & Runtime Crash Remediation", () => {
  it("1. prevents runtime ReferenceError on animated door/drawer open and tenant switching", () => {
    const store = useConfiguratorStore.getState();
    expect(() => store.setDoorOpenAngleDeg(75, true)).not.toThrow();
    expect(() => store.setDrawerOpenMm(240, true)).not.toThrow();
    expect(() => store.toggleDoorOpen(true)).not.toThrow();
    expect(() => store.toggleDrawerOpen(true)).not.toThrow();
    expect(() => store.switchActiveTenant(TENANT_ANKA_BUSINESS.tenantId, "org_owner")).not.toThrow();
    expect(() =>
      store.updateActiveTenantProfile({ brand: { ...TENANT_ANKA_BUSINESS.brand } })
    ).not.toThrow();
    store.switchActiveTenant(TENANT_BIRIM_ENTERPRISE.tenantId, "org_owner");
  });

  it("2. blocks client-side material cost & sceneObject price tampering on /api/quotes", async () => {
    const baseProject = createInitialProject();
    const quotedObj = V5_SCENE_OBJECT_CATALOG.find(
      (c) => c.commercialRole === "quoted_product" && c.unitPriceEur > 100
    )!;

    const officialMap = buildAuthoritativeMaterialsMap(TENANT_BIRIM_ENTERPRISE.tenantId, [
      {
        ...DEFAULT_MATERIALS[0],
        costPerM2: 0.01,
        edgeBandCostPerM: 0,
      },
    ]);
    expect(officialMap.get(DEFAULT_MATERIALS[0].id)?.costPerM2).toBe(DEFAULT_MATERIALS[0].costPerM2);

    const safeObjs = buildAuthoritativeSceneObjects([
      {
        id: "so_tamper_1",
        catalogId: quotedObj.catalogId,
        sku: quotedObj.sku,
        name: quotedObj.name,
        brand: quotedObj.brand,
        category: quotedObj.category,
        anchorMode: quotedObj.anchorMode,
        visualKind: quotedObj.visualKind,
        dimensions: quotedObj.defaultDimensions,
        position: { x: 0, y: 0, z: 0 },
        rotation: { x: 0, y: 0, z: 0 },
        primaryColorHex: quotedObj.primaryColorHex,
        secondaryColorHex: quotedObj.secondaryColorHex,
        commercialRole: "decor_only",
        unitPriceEur: 0.01,
        quantity: 1,
      },
    ]);
    expect(safeObjs[0].commercialRole).toBe("quoted_product");
    expect(safeObjs[0].unitPriceEur).toBe(quotedObj.unitPriceEur);
    expect(clampAuthoritativeDiscountPercent(999, TENANT_BIRIM_ENTERPRISE)).toBeLessThanOrEqual(25);

    const token = signTenantSessionToken({
      tenantId: TENANT_BIRIM_ENTERPRISE.tenantId,
      role: "sales_rep",
      userId: "usr_sales_test",
    });

    const cleanRes = await postQuotes(
      new NextRequest("http://localhost:3300/api/quotes", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-modul-session-token": token },
        body: JSON.stringify({ project: baseProject }),
      })
    );
    const cleanJson = await cleanRes.json();

    const tamperedRes = await postQuotes(
      new NextRequest("http://localhost:3300/api/quotes", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-modul-session-token": token },
        body: JSON.stringify({
          project: {
            ...baseProject,
            customMaterials: [
              {
                ...DEFAULT_MATERIALS[0],
                costPerM2: 0.01,
                edgeBandCostPerM: 0,
              },
            ],
          },
          requestedDiscountPercent: 95,
        }),
      })
    );
    const tamperedJson = await tamperedRes.json();
    expect(tamperedJson.ok).toBe(true);
    expect(tamperedJson.quote.serverVerifiedTotalWithVatEur).toBe(
      cleanJson.quote.serverVerifiedTotalWithVatEur
    );
    expect(tamperedJson.quote.discountPercent).toBeLessThanOrEqual(25);
  });

  it("3. eliminates R2 Stored XSS (.html/.svg) and enforces MIME & magic-byte validation", () => {
    expect(ALLOWED_EXTENSIONS.has("html")).toBe(false);
    expect(ALLOWED_EXTENSIONS.has("svg")).toBe(false);

    const badMime = validateR2UploadContent("png", "text/html", Buffer.from("<html></html>"));
    expect(badMime.ok).toBe(false);

    const badMagic = validateR2UploadContent("png", "image/png", Buffer.from("not-a-png"));
    expect(badMagic.ok).toBe(false);

    const goodZip = validateR2UploadContent("zip", "application/zip", Buffer.from([0x50, 0x4b, 0x03, 0x04]));
    expect(goodZip.ok).toBe(true);
  });

  it("4. blocks SSRF targets, Stripe replay attacks, weak registration passwords, and tenant enumeration", async () => {
    expect(
      () =>
        new OutboundWebhookErpAdapter({
          tenantId: TENANT_ANKA_BUSINESS.tenantId,
          endpointUrl: "http://169.254.169.254/latest/meta-data/",
          signingSecret: "whsec_test",
        })
    ).toThrow(/SSRF/i);

    const stripe = new StripeBillingAdapter("whsec_test_replay");
    const staleSig = stripe.signWebhookPayload('{"eventType":"invoice.paid"}', 1_000_000);
    expect(stripe.verifyWebhookSignature('{"eventType":"invoice.paid"}', staleSig)).toBe(false);

    const weakPwdRes = await postAuth(
      new NextRequest("http://localhost:3300/api/saas/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "register_org",
          slug: "weak-test",
          email: "weak@test.com",
          password: "123",
        }),
      })
    );
    expect(weakPwdRes.status).toBe(400);

    const entRes = await postAuth(
      new NextRequest("http://localhost:3300/api/saas/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "register_org",
          slug: "free-ent",
          email: "ent@test.com",
          password: "StrongPassword2026!",
          planId: "enterprise",
        }),
      })
    );
    expect(entRes.status).toBe(403);

    const designerToken = signTenantSessionToken({
      tenantId: TENANT_ANKA_BUSINESS.tenantId,
      role: "designer",
      userId: "usr_anka_des",
    });
    const tenantsRes = await getTenants(
      new NextRequest("http://localhost:3300/api/saas/tenants", {
        headers: { "x-modul-session-token": designerToken },
      })
    );
    const tenantsJson = await tenantsRes.json();
    expect(tenantsJson.availableTenants.length).toBe(1);
    expect(tenantsJson.availableTenants[0].tenantId).toBe(TENANT_ANKA_BUSINESS.tenantId);

    const healthRes = await getSupabaseHealth(
      new NextRequest("http://localhost:3300/api/saas/supabase-health", {
        headers: { "x-modul-session-token": designerToken },
      })
    );
    expect(healthRes.status).toBe(403);
  });
});
