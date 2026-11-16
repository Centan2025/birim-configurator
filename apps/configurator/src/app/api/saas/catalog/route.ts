import { NextRequest, NextResponse } from "next/server";
import type { ModuleInstance } from "@birim/core";
import {
  TenantSecurityError,
  assertTenantPermissionAndEntitlement,
  recordTenantAuditEvent,
  resolveTenantRequestContext,
} from "../../../../lib/tenant-auth-guard";
import {
  importTenantMaterialsFromCsv,
  listTenantCustomMaterials,
  listTenantPublishedTemplates,
  publishTenantModuleTemplate,
} from "../../../../lib/tenant-catalog-importer";

export async function GET(req: NextRequest) {
  try {
    const ctx = resolveTenantRequestContext(req);
    return NextResponse.json({
      ok: true,
      tenantId: ctx.tenantId,
      materials: listTenantCustomMaterials(ctx.tenantId),
      templates: listTenantPublishedTemplates(ctx.tenantId),
    });
  } catch (err) {
    if (err instanceof TenantSecurityError) {
      return NextResponse.json({ ok: false, code: err.code, error: err.message }, { status: err.httpStatus });
    }
    return NextResponse.json({ ok: false, error: "Katalog verisi alınamadı." }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as {
      action?: "import_materials_csv" | "publish_template";
      csvText?: string;
      code?: string;
      name?: string;
      moduleSnapshot?: ModuleInstance;
    };
    const ctx = resolveTenantRequestContext(req);

    if (body.action === "import_materials_csv") {
      assertTenantPermissionAndEntitlement(ctx, "pricing:manage_rules");
      const res = importTenantMaterialsFromCsv(ctx.tenantId, body.csvText || "");
      recordTenantAuditEvent({
        tenantId: ctx.tenantId,
        actorUserId: ctx.userId,
        actorRole: ctx.role,
        action: "MATERIALS_CSV_IMPORTED",
        targetType: "material_library",
        targetId: ctx.tenantId,
        metadata: { importedCount: res.importedCount },
      });
      return NextResponse.json({ ok: true, ...res }, { status: 201 });
    }

    if (body.action === "publish_template" && body.moduleSnapshot) {
      assertTenantPermissionAndEntitlement(ctx, "catalog:manage_templates", "allowCustomTemplates");
      const published = publishTenantModuleTemplate({
        tenantId: ctx.tenantId,
        code: body.code || `tpl_${Date.now()}`,
        name: body.name || "Özel Firma Modülü",
        moduleSnapshot: body.moduleSnapshot,
      });
      recordTenantAuditEvent({
        tenantId: ctx.tenantId,
        actorUserId: ctx.userId,
        actorRole: ctx.role,
        action: "MODULE_TEMPLATE_PUBLISHED",
        targetType: "product_template",
        targetId: published.id,
        metadata: { versionNo: published.versionNo, cutPieces: published.verifiedCutPiecesCount },
      });
      return NextResponse.json({ ok: true, template: published }, { status: 201 });
    }

    return NextResponse.json({ ok: false, error: "Geçersiz katalog işlemi." }, { status: 400 });
  } catch (err) {
    if (err instanceof TenantSecurityError) {
      return NextResponse.json({ ok: false, code: err.code, error: err.message }, { status: err.httpStatus });
    }
    return NextResponse.json({ ok: false, error: "Katalog işlemi başarısız." }, { status: 500 });
  }
}
