import { NextRequest, NextResponse } from "next/server";
import {
  PLAN_ENTITLEMENTS_MATRIX,
  getTenantProfileByIdOrSlug,
  listRegisteredTenantProfiles,
  registerOrUpdateTenantProfile,
  type SaasRoleId,
  type TenantWorkspaceProfile,
} from "@birim/core";
import {
  TenantSecurityError,
  assertTenantPermissionAndEntitlement,
  listTenantAuditEvents,
  recordTenantAuditEvent,
  resolveTenantRequestContext,
  signTenantSessionToken,
} from "../../../../lib/tenant-auth-guard";

export async function GET(req: NextRequest) {
  try {
    const requestedTenant = req.nextUrl.searchParams.get("tenantId") || undefined;
    const ctx = resolveTenantRequestContext(req, { tenantId: requestedTenant });
    const entitlements = PLAN_ENTITLEMENTS_MATRIX[ctx.profile.planId];
    const demoSessionToken = signTenantSessionToken({
      tenantId: ctx.tenantId,
      role: ctx.role,
      userId: ctx.userId,
    });

    return NextResponse.json({
      ok: true,
      activeTenant: ctx.profile,
      entitlements,
      role: ctx.role,
      demoSessionToken,
      auditLogs: listTenantAuditEvents(ctx.tenantId).slice(0, 25),
      availableTenants: listRegisteredTenantProfiles().map((t) => ({
        tenantId: t.tenantId,
        slug: t.slug,
        displayName: t.brand.displayName,
        legalName: t.brand.legalName,
        planId: t.planId,
        currency: t.pricing.currency,
        carcassThicknessMm: t.construction.defaultCarcassThicknessMm,
        connectorSystem: t.construction.connectorSystem,
        cncFormat: t.machine.primaryCncFormat,
      })),
    });
  } catch (err) {
    if (err instanceof TenantSecurityError) {
      return NextResponse.json({ ok: false, code: err.code, error: err.message }, { status: err.httpStatus });
    }
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "SaaS kiracı bilgisi alınamadı." },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as {
      tenantId?: string;
      role?: SaasRoleId;
      patch?: Partial<Pick<TenantWorkspaceProfile, "construction" | "machine" | "pricing" | "brand">>;
    };
    const ctx = resolveTenantRequestContext(req, {
      tenantId: body.tenantId,
      sessionRole: body.role,
    });
    assertTenantPermissionAndEntitlement(ctx, "tenant:manage_settings");

    const base = getTenantProfileByIdOrSlug(ctx.tenantId);
    const updated: TenantWorkspaceProfile = {
      ...base,
      brand: { ...base.brand, ...(body.patch?.brand || {}) },
      construction: { ...base.construction, ...(body.patch?.construction || {}) },
      machine: {
        ...base.machine,
        ...(body.patch?.machine || {}),
        toolNumbers: {
          ...base.machine.toolNumbers,
          ...(body.patch?.machine?.toolNumbers || {}),
        },
      },
      pricing: { ...base.pricing, ...(body.patch?.pricing || {}) },
    };
    const saved = registerOrUpdateTenantProfile(updated);
    const audit = recordTenantAuditEvent({
      tenantId: saved.tenantId,
      actorUserId: ctx.userId,
      actorRole: ctx.role,
      action: "TENANT_PROFILE_UPDATED",
      targetType: "tenant_settings",
      targetId: saved.tenantId,
      metadata: { updatedKeys: Object.keys(body.patch || {}) },
    });

    return NextResponse.json({
      ok: true,
      tenant: saved,
      entitlements: PLAN_ENTITLEMENTS_MATRIX[saved.planId],
      audit,
    });
  } catch (err) {
    if (err instanceof TenantSecurityError) {
      return NextResponse.json({ ok: false, code: err.code, error: err.message }, { status: err.httpStatus });
    }
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "Kiracı ayarları güncellenemedi." },
      { status: 500 }
    );
  }
}
