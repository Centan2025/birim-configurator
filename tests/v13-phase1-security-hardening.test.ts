import { describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import {
  TENANT_ANKA_BUSINESS,
  TENANT_BIRIM_ENTERPRISE,
  isOriginAllowedForTenantEmbed,
  registerOrUpdateTenantProfile,
} from "@birim/core";
import {
  OutboundWebhookErpAdapter,
  assertSafeOutboundWebhookUrl,
  isPrivateOrReservedIpAddress,
} from "@birim/integrations";
import { middleware } from "../apps/configurator/src/middleware";
import {
  TenantSecurityError,
  resolveTenantRequestContext,
  resolveTrustedClientIp,
} from "../apps/configurator/src/lib/tenant-auth-guard";
import { resolveSharedBirimPortalEnv } from "../apps/configurator/src/lib/birim-portal-env";

describe("V13 Faz 1 — P0 Güvenlik, İzolasyon, SSRF ve Embed Sertleştirmesi", () => {
  it("1. Üretim modunda MODUL_SAAS_REQUIRE_AUTH=false unutulsa dahi oturumsuz istekleri 401 ile reddeder", () => {
    const prevNodeEnv = process.env.NODE_ENV;
    const prevReqAuth = process.env.MODUL_SAAS_REQUIRE_AUTH;
    const prevSecret = process.env.MODUL_SAAS_SESSION_SECRET;
    try {
      process.env.NODE_ENV = "production";
      process.env.MODUL_SAAS_REQUIRE_AUTH = "false";
      process.env.MODUL_SAAS_SESSION_SECRET = "prod-test-secret-minimum-32-chars-long!!";

      const unauthReq = new Request("https://app.modul.studio/api/quotes", {
        method: "POST",
      });
      expect(() =>
        resolveTenantRequestContext(unauthReq, { sessionRole: "owner" })
      ).toThrow(TenantSecurityError);
    } finally {
      process.env.NODE_ENV = prevNodeEnv;
      if (prevReqAuth === undefined) delete process.env.MODUL_SAAS_REQUIRE_AUTH;
      else process.env.MODUL_SAAS_REQUIRE_AUTH = prevReqAuth;
      if (prevSecret === undefined) delete process.env.MODUL_SAAS_SESSION_SECRET;
      else process.env.MODUL_SAAS_SESSION_SECRET = prevSecret;
    }
  });

  it("2. Sıkı modda oturumsuz sessionRole=owner/admin yetki yükseltmesini readonly_viewer seviyesine kilitler", () => {
    const prevStrict = process.env.MODUL_SAAS_STRICT_UNAUTH_ROLE;
    try {
      process.env.MODUL_SAAS_STRICT_UNAUTH_ROLE = "true";
      const req = new Request("http://localhost:3300/api/quotes", { method: "POST" });
      const ctx = resolveTenantRequestContext(req, { sessionRole: "owner" });
      expect(ctx.authenticated).toBe(false);
      expect(ctx.role).toBe("readonly_viewer");
    } finally {
      if (prevStrict === undefined) delete process.env.MODUL_SAAS_STRICT_UNAUTH_ROLE;
      else process.env.MODUL_SAAS_STRICT_UNAUTH_ROLE = prevStrict;
    }
  });

  it("3. X-Forwarded-For sol tarafa sahte IP ekleme (left-prepend spoofing) saldırısını engeller", () => {
    const spoofedReq = new Request("http://localhost:3300/api/saas/auth", {
      headers: {
        "x-forwarded-for": "1.2.3.4, 5.6.7.8, 203.0.113.55",
      },
    });
    expect(resolveTrustedClientIp(spoofedReq)).toBe("203.0.113.55");

    const vercelReq = new Request("http://localhost:3300/api/saas/auth", {
      headers: {
        "x-forwarded-for": "9.9.9.9, 203.0.113.55",
        "x-vercel-forwarded-for": "198.51.100.77",
      },
    });
    expect(resolveTrustedClientIp(vercelReq)).toBe("198.51.100.77");
  });

  it("4. IPv4-mapped IPv6, tam sayı IP, DNS rebinding (.nip.io/.sslip.io) ve yasaklı iç port SSRF vektörlerini bloklar", () => {
    expect(isPrivateOrReservedIpAddress("::ffff:127.0.0.1")).toBe(true);
    expect(isPrivateOrReservedIpAddress("::ffff:169.254.169.254")).toBe(true);
    expect(isPrivateOrReservedIpAddress("[::ffff:7f00:1]")).toBe(true);
    expect(isPrivateOrReservedIpAddress("2130706433")).toBe(true); // 127.0.0.1
    expect(isPrivateOrReservedIpAddress("0x7f000001")).toBe(true);
    expect(isPrivateOrReservedIpAddress("93.184.216.34")).toBe(false);

    const maliciousUrls = [
      "https://[::ffff:169.254.169.254]/latest/meta-data/",
      "https://[::ffff:127.0.0.1]:3000/api",
      "http://2130706433/admin",
      "https://169.254.169.254.nip.io/hook",
      "https://10.0.0.1.sslip.io/hook",
      "https://erp.example.com:6379/redis",
      "https://user:pass@erp.example.com/hook",
    ];
    for (const bad of maliciousUrls) {
      expect(() => assertSafeOutboundWebhookUrl(bad)).toThrow(/SSRF/i);
    }

    expect(
      () =>
        new OutboundWebhookErpAdapter({
          tenantId: TENANT_ANKA_BUSINESS.tenantId,
          endpointUrl: "https://erp.ankamutfak.com.tr/hooks/modul",
          signingSecret: "whsec_safe_ok",
        })
    ).not.toThrow();
  });

  it("5. /embed/* rotasında kiracı allowedEmbedOrigins tanımladığında dinamik frame-ancestors ve origin doğrulaması uygular", () => {
    registerOrUpdateTenantProfile({
      ...TENANT_ANKA_BUSINESS,
      allowedEmbedOrigins: ["https://shop.ankamutfak.com.tr"],
    });
    try {
      const ankaEmbedRes = middleware(new NextRequest("http://localhost:3300/embed/anka"));
      expect(ankaEmbedRes.headers.get("X-Frame-Options")).toBeNull();
      expect(ankaEmbedRes.headers.get("Content-Security-Policy")).toContain(
        "frame-ancestors 'self' https://shop.ankamutfak.com.tr"
      );

      const ankaUpdated = {
        ...TENANT_ANKA_BUSINESS,
        allowedEmbedOrigins: ["https://shop.ankamutfak.com.tr"],
      };
      expect(isOriginAllowedForTenantEmbed("https://shop.ankamutfak.com.tr", ankaUpdated)).toBe(true);
      expect(isOriginAllowedForTenantEmbed("https://evil-phishing.example.com", ankaUpdated)).toBe(false);

      // Default Birim without explicit allowlist keeps backward-compatible open embed behavior
      const birimEmbedRes = middleware(new NextRequest("http://localhost:3300/embed/birim"));
      expect(birimEmbedRes.headers.get("Content-Security-Policy")).toBeNull();
    } finally {
      registerOrUpdateTenantProfile({
        ...TENANT_ANKA_BUSINESS,
        allowedEmbedOrigins: undefined,
      });
    }
  });

  it("6. Üretim modunda kardeş dizin .env.local okumasını varsayılan olarak kilitler", () => {
    const prevNodeEnv = process.env.NODE_ENV;
    try {
      process.env.NODE_ENV = "production";
      const res = resolveSharedBirimPortalEnv({
        portalEnvPath: "/etc/passwd",
        tenantId: TENANT_BIRIM_ENTERPRISE.tenantId,
      });
      expect(res.portalEnvFilePath).toBeNull();
    } finally {
      process.env.NODE_ENV = prevNodeEnv;
    }
  });
});
