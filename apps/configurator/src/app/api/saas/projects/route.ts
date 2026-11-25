import { NextRequest, NextResponse } from "next/server";
import { parseAndMigrateProject, syncProjectCustomMaterials, type DesignProject } from "@birim/core";
import { generateBOMForProject } from "@birim/manufacturing";
import { calculateProjectPrice } from "@birim/pricing";
import {
  TenantSecurityError,
  assertTenantPermissionAndEntitlement,
  resolveTenantRequestContext,
} from "../../../../lib/tenant-auth-guard";
import { sanitizeProjectForServerPricing } from "../../../../lib/authoritative-pricing";
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

    const cleanProject = parsed.project as DesignProject;
    // Never mutate global DEFAULT_MATERIALS from untrusted client payloads; resolve isolated map per request
    const { materialsMap, sceneObjects: safeSceneObjects } = sanitizeProjectForServerPricing(
      cleanProject,
      ctx.tenantId
    );
    const cRule = ctx.profile.construction;
    const serverBom = generateBOMForProject(cleanProject, materialsMap, {
      sheetConfig: {
        name: `${ctx.profile.brand.displayName} ${cRule.standardSheetLengthMm}x${cRule.standardSheetWidthMm}`,
        lengthMm: cRule.standardSheetLengthMm,
        widthMm: cRule.standardSheetWidthMm,
        trimCutMm: cRule.edgeTrimMarginMm,
        kerfMm: cRule.sawKerfMm,
      },
    });
    const serverPricing = calculateProjectPrice(
      serverBom,
      {
        ...ctx.profile.pricing,
        standardSheetAreaM2:
          (cRule.standardSheetLengthMm * cRule.standardSheetWidthMm) / 1_000_000,
      },
      materialsMap,
      safeSceneObjects
    );
    const authoritativePricingSnapshot: Record<string, unknown> = {
      currency: ctx.profile.pricing.currency,
      subtotalNetEur: serverPricing.subtotalNetEur,
      totalWithVatEur: serverPricing.totalWithVatEur,
      totalWithVatTry: serverPricing.totalWithVatTry,
      dealerNetWithVatTry: serverPricing.dealerNetWithVatTry,
      cutPiecesCount: serverBom.cutList.length,
      serverRecomputedAt: new Date().toISOString(),
    };

    const saved = await modulPostgresRepo.saveProjectVersion({
      tenantId: ctx.tenantId,
      actorUserId: ctx.userId,
      project: cleanProject,
      pricingSnapshot: authoritativePricingSnapshot,
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
