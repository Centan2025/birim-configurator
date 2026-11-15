import { NextRequest, NextResponse } from "next/server";
import { PLAN_ENTITLEMENTS_MATRIX, type SaasPlanId } from "@birim/core";
import {
  TenantSecurityError,
  assertTenantPermissionAndEntitlement,
  resolveTenantRequestContext,
} from "../../../../lib/tenant-auth-guard";
import {
  IyzicoBillingAdapter,
  SAAS_PLAN_PRICING_TABLE,
  StripeBillingAdapter,
  getTenantSubscription,
  getTenantUsageSummary,
  type BillingProviderId,
} from "../../../../lib/saas-billing-and-metering";

export async function GET(req: NextRequest) {
  try {
    const ctx = resolveTenantRequestContext(req);
    return NextResponse.json({
      ok: true,
      tenantId: ctx.tenantId,
      subscription: getTenantSubscription(ctx.tenantId),
      usage: getTenantUsageSummary(ctx.tenantId, ctx.profile),
      entitlements: PLAN_ENTITLEMENTS_MATRIX[ctx.profile.planId],
      pricingTable: SAAS_PLAN_PRICING_TABLE,
    });
  } catch (err) {
    if (err instanceof TenantSecurityError) {
      return NextResponse.json({ ok: false, code: err.code, error: err.message }, { status: err.httpStatus });
    }
    return NextResponse.json({ ok: false, error: "Abonelik bilgisi alınamadı." }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as {
      provider?: BillingProviderId;
      targetPlanId?: SaasPlanId;
      billingCycle?: "monthly" | "annual";
    };
    const ctx = resolveTenantRequestContext(req);
    assertTenantPermissionAndEntitlement(ctx, "tenant:manage_settings");

    const providerId: BillingProviderId =
      body.provider || (ctx.profile.pricing.currency === "TRY" ? "iyzico_tr" : "stripe_global");
    const adapter =
      providerId === "iyzico_tr" ? new IyzicoBillingAdapter() : new StripeBillingAdapter();
    const originUrl = req.nextUrl?.origin || "https://app.modul.studio";

    const checkout = adapter.createCheckoutSession({
      tenant: ctx.profile,
      targetPlanId: body.targetPlanId || "business",
      billingCycle: body.billingCycle || "annual",
      originUrl,
    });

    return NextResponse.json({ ok: true, checkout }, { status: 201 });
  } catch (err) {
    if (err instanceof TenantSecurityError) {
      return NextResponse.json({ ok: false, code: err.code, error: err.message }, { status: err.httpStatus });
    }
    return NextResponse.json({ ok: false, error: "Ödeme oturumu başlatılamadı." }, { status: 500 });
  }
}
