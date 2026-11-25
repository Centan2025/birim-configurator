import { NextRequest, NextResponse } from "next/server";
import { TENANT_BIRIM_ENTERPRISE } from "@birim/core";
import {
  TenantSecurityError,
  resolveTenantRequestContext,
} from "../../../../lib/tenant-auth-guard";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const ctx = resolveTenantRequestContext(req);
    const isAllowed =
      ctx.role === "platform_admin" ||
      (process.env.NODE_ENV !== "production" && ctx.role === "org_owner");
    if (!isAllowed) {
      throw new TenantSecurityError(
        "PLATFORM_SUPERADMIN_REQUIRED",
        "Supabase sağlık denetimi yalnızca Platform SuperAdmin yetkisine açıktır.",
        403
      );
    }
  } catch (err) {
    if (err instanceof TenantSecurityError) {
      return NextResponse.json(
        { ok: false, code: err.code, message: err.message },
        { status: err.httpStatus }
      );
    }
    return NextResponse.json({ ok: false, message: "Yetki doğrulama hatası." }, { status: 403 });
  }
  const t0 = Date.now();
  const supabaseUrl = (
    process.env.SUPABASE_URL ||
    process.env.NEXT_PUBLIC_SUPABASE_URL ||
    ""
  )
    .trim()
    .replace(/\/+$/, "");
  const publishableKey = (
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    ""
  ).trim();
  const secretKey = (
    process.env.SUPABASE_SECRET_KEY ||
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    ""
  ).trim();

  const portalFallbackDisabled = process.env.BIRIM_DISABLE_PORTAL_ENV_FALLBACK === "true";
  const postgrestLiveEnabled = process.env.MODUL_ALLOW_LIVE_SAAS_POSTGREST === "true";

  if (!supabaseUrl || !secretKey || supabaseUrl.includes("PROJE_REF_KODUNUZ")) {
    return NextResponse.json(
      {
        ok: false,
        stage: "ENV_CHECK",
        supabaseConnected: false,
        message:
          "apps/configurator/.env.local içindeki NEXT_PUBLIC_SUPABASE_URL ve SUPABASE_SECRET_KEY alanlarını gerçek Supabase değerlerinizle doldurun.",
        envSummary: {
          supabaseUrlConfigured: Boolean(supabaseUrl && !supabaseUrl.includes("PROJE_REF_KODUNUZ")),
          publishableKeyPrefix: publishableKey ? publishableKey.slice(0, 15) + "..." : null,
          secretKeyFormat: secretKey.startsWith("sb_secret_")
            ? "sb_secret_modern"
            : secretKey.startsWith("eyJ")
              ? "legacy_jwt"
              : "missing_or_placeholder",
          portalFallbackDisabled,
          postgrestLiveEnabled,
        },
      },
      { status: 503 }
    );
  }

  const headers: Record<string, string> = {
    apikey: secretKey,
    ...(secretKey.startsWith("sb_") ? {} : { Authorization: `Bearer ${secretKey}` }),
    "Content-Type": "application/json",
  };

  try {
    // 1. Read modul_plans & modul_organizations
    const [plansRes, orgsRes] = await Promise.all([
      fetch(`${supabaseUrl}/rest/v1/modul_plans?select=id,name_tr`, { headers }),
      fetch(`${supabaseUrl}/rest/v1/modul_organizations?select=id,slug,plan_id,status`, { headers }),
    ]);

    if (!plansRes.ok || !orgsRes.ok) {
      const errText = await (plansRes.ok ? orgsRes : plansRes).text();
      return NextResponse.json(
        {
          ok: false,
          stage: "SCHEMA_READ_CHECK",
          supabaseConnected: false,
          httpStatus: plansRes.ok ? orgsRes.status : plansRes.status,
          message:
            "Supabase sunucusuna ulaşıldı ancak modul_* tabloları okunamadı. SQL Editor üzerinden 20261115000100_modul_saas_multitenant_backbone.sql dosyasını çalıştırdığınızdan ve Secret Key değerinin doğru olduğundan emin olun.",
          upstreamError: errText.slice(0, 300),
        },
        { status: 502 }
      );
    }

    const plans = (await plansRes.json()) as { id: string }[];
    const orgs = (await orgsRes.json()) as { id: string; slug: string; plan_id: string }[];
    const tenant1Found = orgs.some((o) => o.id === TENANT_BIRIM_ENTERPRISE.tenantId);
    const latencyMs = Date.now() - t0;

    return NextResponse.json({
      ok: tenant1Found && plans.length >= 4,
      stage: "READ_HEALTH_PASSED",
      supabaseConnected: true,
      latencyMs,
      keyFormat: secretKey.startsWith("sb_secret_") ? "sb_secret_modern" : "legacy_jwt",
      portalFallbackDisabled,
      postgrestLiveEnabled,
      plansCount: plans.length,
      organizationsCount: orgs.length,
      tenant1Found,
    });
  } catch (err) {
    return NextResponse.json(
      {
        ok: false,
        stage: "NETWORK_ERROR",
        supabaseConnected: false,
        message: err instanceof Error ? err.message : "Supabase ağ bağlantısı kurulamadı.",
      },
      { status: 503 }
    );
  }
}
