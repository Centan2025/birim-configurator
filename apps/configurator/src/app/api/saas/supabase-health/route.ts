import { NextResponse } from "next/server";
import { TENANT_BIRIM_ENTERPRISE } from "@birim/core";

export const dynamic = "force-dynamic";

export async function GET() {
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

    // 2. Live Write Roundtrip to modul_audit_logs
    const writeRes = await fetch(`${supabaseUrl}/rest/v1/modul_audit_logs`, {
      method: "POST",
      headers: {
        ...headers,
        Prefer: "return=representation",
      },
      body: JSON.stringify({
        tenant_id: TENANT_BIRIM_ENTERPRISE.tenantId,
        actor_role: "platform_admin",
        action: "SUPABASE_HEALTH_ROUNDTRIP_OK",
        target_type: "healthcheck",
        target_id: "modul_saas_init",
        metadata: { checkedAt: new Date().toISOString() },
      }),
    });

    const auditWriteVerified = writeRes.ok;
    const latencyMs = Date.now() - t0;

    return NextResponse.json({
      ok: auditWriteVerified && tenant1Found && plans.length >= 4,
      stage: "ALL_CHECKS_PASSED",
      supabaseConnected: true,
      latencyMs,
      keyFormat: secretKey.startsWith("sb_secret_") ? "sb_secret_modern" : "legacy_jwt",
      portalFallbackDisabled,
      postgrestLiveEnabled,
      plansCount: plans.length,
      organizationsCount: orgs.length,
      organizations: orgs,
      tenant1Found,
      auditWriteVerified,
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
