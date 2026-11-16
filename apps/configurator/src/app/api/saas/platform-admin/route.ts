import { NextRequest, NextResponse } from "next/server";
import { listRegisteredTenantProfiles, type SaasPlanId } from "@birim/core";
import {
  retryDeadLetterWebhookEvent,
  runBirimTenant1ShadowVerification,
} from "@birim/integrations";
import {
  TenantSecurityError,
  recordTenantAuditEvent,
  resolveTenantRequestContext,
} from "../../../../lib/tenant-auth-guard";
import {
  listAllTenantSubscriptions,
  updateTenantSubscriptionStatus,
  type SubscriptionBillingStatus,
} from "../../../../lib/saas-billing-and-metering";

function assertPlatformSuperAdmin(role: string): void {
  if (role !== "platform_admin") {
    throw new TenantSecurityError(
      "PLATFORM_SUPERADMIN_REQUIRED",
      "Bu uç nokta yalnızca Modül Platform SuperAdmin yetkisine açıktır.",
      403
    );
  }
}

export async function GET(req: NextRequest) {
  try {
    const ctx = resolveTenantRequestContext(req);
    assertPlatformSuperAdmin(ctx.role);

    const tenants = listRegisteredTenantProfiles();
    const subscriptions = listAllTenantSubscriptions();
    const birimShadowReport = runBirimTenant1ShadowVerification();

    return NextResponse.json({
      ok: true,
      tenantsCount: tenants.length,
      tenants,
      subscriptions,
      birimShadowReport,
    });
  } catch (err) {
    if (err instanceof TenantSecurityError) {
      return NextResponse.json({ ok: false, code: err.code, error: err.message }, { status: err.httpStatus });
    }
    return NextResponse.json({ ok: false, error: "Platform yönetim verisi alınamadı." }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const ctx = resolveTenantRequestContext(req);
    assertPlatformSuperAdmin(ctx.role);

    const body = (await req.json()) as {
      action?: "set_tenant_status" | "retry_dlq_webhook";
      targetTenantId: string;
      status?: SubscriptionBillingStatus;
      planId?: SaasPlanId;
      outboxEventId?: string;
    };

    if (body.action === "set_tenant_status" && body.status) {
      const sub = updateTenantSubscriptionStatus({
        tenantId: body.targetTenantId,
        planId: body.planId,
        status: body.status,
      });
      recordTenantAuditEvent({
        tenantId: body.targetTenantId,
        actorUserId: ctx.userId,
        actorRole: ctx.role,
        action: "PLATFORM_SUPERADMIN_STATUS_CHANGE",
        targetType: "subscription",
        targetId: sub.subscriptionId,
        metadata: { status: body.status, planId: sub.planId },
      });
      return NextResponse.json({ ok: true, subscription: sub });
    }

    if (body.action === "retry_dlq_webhook" && body.outboxEventId) {
      const retried = await retryDeadLetterWebhookEvent(body.targetTenantId, body.outboxEventId);
      return NextResponse.json({ ok: Boolean(retried), event: retried });
    }

    return NextResponse.json({ ok: false, error: "Geçersiz platform işlemi." }, { status: 400 });
  } catch (err) {
    if (err instanceof TenantSecurityError) {
      return NextResponse.json({ ok: false, code: err.code, error: err.message }, { status: err.httpStatus });
    }
    return NextResponse.json({ ok: false, error: "Platform işlemi başarısız." }, { status: 500 });
  }
}
