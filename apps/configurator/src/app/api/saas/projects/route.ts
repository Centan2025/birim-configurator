import { NextRequest, NextResponse } from "next/server";
import { parseAndMigrateProject, type DesignProject } from "@birim/core";
import {
  TenantSecurityError,
  assertTenantPermissionAndEntitlement,
  resolveTenantRequestContext,
} from "../../../../lib/tenant-auth-guard";
import { modulPostgresRepo } from "../../../../lib/modul-postgres-repository";

export async function GET(req: NextRequest) {
  try {
    const ctx = resolveTenantRequestContext(req);
    assertTenantPermissionAndEntitlement(ctx, "project:read");
    const projectId = req.nextUrl?.searchParams?.get("projectId");
    if (projectId) {
      return NextResponse.json({
        ok: true,
        tenantId: ctx.tenantId,
        versions: modulPostgresRepo.listProjectVersions(ctx.tenantId, projectId),
      });
    }
    return NextResponse.json({
      ok: true,
      tenantId: ctx.tenantId,
      projects: modulPostgresRepo.listTenantProjects(ctx.tenantId),
    });
  } catch (err) {
    if (err instanceof TenantSecurityError) {
      return NextResponse.json({ ok: false, code: err.code, error: err.message }, { status: err.httpStatus });
    }
    return NextResponse.json({ ok: false, error: "Proje listesi alınamadı." }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as {
      project?: unknown;
      pricingSnapshot?: Record<string, unknown>;
      lockAsOrder?: boolean;
      overwriteVersionNo?: number;
      organizationId?: string;
    };
    const ctx = resolveTenantRequestContext(req, { organizationId: body.organizationId });
    assertTenantPermissionAndEntitlement(
      ctx,
      body.lockAsOrder ? "quote:approve_order" : "project:write"
    );

    const parsed = parseAndMigrateProject(body.project);
    if (!parsed.ok) {
      return NextResponse.json({ ok: false, error: parsed.error }, { status: 422 });
    }

    const saved = await modulPostgresRepo.saveProjectVersion({
      tenantId: ctx.tenantId,
      actorUserId: ctx.userId,
      project: parsed.project as DesignProject,
      pricingSnapshot: body.pricingSnapshot,
      lockAsOrder: body.lockAsOrder,
      overwriteVersionNo: body.overwriteVersionNo,
    });
    return NextResponse.json({ ok: true, ...saved }, { status: 201 });
  } catch (err) {
    if (err instanceof TenantSecurityError) {
      return NextResponse.json({ ok: false, code: err.code, error: err.message }, { status: err.httpStatus });
    }
    return NextResponse.json({ ok: false, error: "Proje versiyonu kaydedilemedi." }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const ctx = resolveTenantRequestContext(req);
    assertTenantPermissionAndEntitlement(ctx, "project:write");
    const projectId = req.nextUrl?.searchParams?.get("projectId") || "";
    const versionNo = Number(req.nextUrl?.searchParams?.get("versionNo") || "0");
    const deleted = modulPostgresRepo.deleteProjectVersion(ctx.tenantId, projectId, versionNo);
    return NextResponse.json({ ok: deleted });
  } catch (err) {
    if (err instanceof TenantSecurityError) {
      return NextResponse.json({ ok: false, code: err.code, error: err.message }, { status: err.httpStatus });
    }
    return NextResponse.json({ ok: false, error: "Proje silinemedi." }, { status: 500 });
  }
}
