import { describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { middleware } from "../apps/configurator/src/middleware";
import { POST as postBillingWebhook } from "../apps/configurator/src/app/api/saas/webhooks/billing/route";
import { GET as getR2Status } from "../apps/configurator/src/app/api/integrations/r2-upload/route";
import { GET as getStoreQuoteStatus } from "../apps/configurator/src/app/api/integrations/store-quote/route";
import { IyzicoBillingAdapter } from "../apps/configurator/src/lib/saas-billing-and-metering";

describe("Faz 3: SaaS Güvenlik Sertleştirme, Webhook Idempotency & Başlıklar", () => {
  it("P1-SEC-04: Billing webhook aynı eventId ile tekrar oynatıldığında duplicate=true ile engellenir", async () => {
    const adapter = new IyzicoBillingAdapter();
    const payload = JSON.stringify({
      eventId: `evt_faz3_dedup_${Date.now()}`,
      eventType: "invoice.paid",
      tenantId: "00000000-0000-0000-0000-000000000001",
      planId: "enterprise",
    });
    const sig = adapter.signWebhookPayload(payload);
    const nowTs = String(Math.floor(Date.now() / 1000));

    const firstReq = new NextRequest("http://localhost:3300/api/saas/webhooks/billing", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-iyz-signature-v3": sig,
        "x-iyz-timestamp": nowTs,
      },
      body: payload,
    });
    const firstRes = await postBillingWebhook(firstReq);
    expect(firstRes.status).toBe(200);
    const firstBody = (await firstRes.json()) as { ok: boolean; duplicate?: boolean };
    expect(firstBody.ok).toBe(true);
    expect(firstBody.duplicate).toBeUndefined();

    // Replay same signed payload
    const replayReq = new NextRequest("http://localhost:3300/api/saas/webhooks/billing", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-iyz-signature-v3": sig,
        "x-iyz-timestamp": nowTs,
      },
      body: payload,
    });
    const replayRes = await postBillingWebhook(replayReq);
    expect(replayRes.status).toBe(200);
    const replayBody = (await replayRes.json()) as { ok: boolean; duplicate?: boolean };
    expect(replayBody.ok).toBe(true);
    expect(replayBody.duplicate).toBe(true);

    // Stale timestamp (>300s old) rejected with 401
    const staleReq = new NextRequest("http://localhost:3300/api/saas/webhooks/billing", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-iyz-signature-v3": sig,
        "x-iyz-timestamp": String(Math.floor(Date.now() / 1000) - 600),
      },
      body: payload,
    });
    const staleRes = await postBillingWebhook(staleReq);
    expect(staleRes.status).toBe(401);
  });

  it("P1-SEC-05: R2 ve Store-Quote GET uç noktaları geçersiz oturum jetonunu 401 ile reddeder", async () => {
    const r2Req = new Request("http://localhost:3300/api/integrations/r2-upload", {
      headers: { authorization: "Bearer mdl_sess_forged.sig" },
    });
    const r2Res = await getR2Status(r2Req);
    expect(r2Res.status).toBe(401);

    const sqReq = new Request("http://localhost:3300/api/integrations/store-quote", {
      headers: { authorization: "Bearer mdl_sess_forged.sig" },
    });
    const sqRes = await getStoreQuoteStatus(sqReq);
    expect(sqRes.status).toBe(401);
  });

  it("P1-SEC-05: Middleware normal rotalarda X-Frame-Options + CSP + Permissions-Policy ekler, /embed/* rotasında iframe'e izin verir", () => {
    const normalReq = new NextRequest("http://localhost:3300/v3/studio");
    const normalRes = middleware(normalReq);
    expect(normalRes.headers.get("X-Frame-Options")).toBe("SAMEORIGIN");
    expect(normalRes.headers.get("Content-Security-Policy")).toContain("frame-ancestors 'self'");
    expect(normalRes.headers.get("Permissions-Policy")).toContain("camera=()");

    const embedReq = new NextRequest("http://localhost:3300/embed/birim");
    const embedRes = middleware(embedReq);
    expect(embedRes.headers.get("X-Frame-Options")).toBeNull();
    expect(embedRes.headers.get("Content-Security-Policy")).toBeNull();
  });
});
