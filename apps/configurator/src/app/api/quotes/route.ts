import { NextRequest, NextResponse } from "next/server";
import {
  DEFAULT_MATERIALS,
  parseAndMigrateProject,
  migrateV3ProjectToV4,
  evaluateProjectCompatibility,
  evaluateUnifiedEngineeringModel,
  syncProjectCustomMaterials,
  type DesignProject,
} from "@birim/core";
import { generateBOMForProject } from "@birim/manufacturing";
import { calculateProjectPrice } from "@birim/pricing";
import { generateQrCodeSvg } from "../../../lib/qr-svg";
import { encodeSharePayloadBase64Url } from "../../../lib/quote-codec";
import { generateShortQuoteCode, saveVerifiedQuote } from "../../../lib/server-quote-store";
import {
  TenantSecurityError,
  assertTenantPermissionAndEntitlement,
  checkTenantRateLimit,
  recordTenantAuditEvent,
  resolveTenantRequestContext,
} from "../../../lib/tenant-auth-guard";

const MAX_PAYLOAD_BYTES = 1_500_000;

export async function POST(req: NextRequest) {
  try {
    const rawBody = await req.text();
    if (rawBody.length > MAX_PAYLOAD_BYTES) {
      return NextResponse.json(
        { ok: false, error: "Proje verisi izin verilen maksimum boyutu (1.5 MB) aşıyor." },
        { status: 413 }
      );
    }

    const body = JSON.parse(rawBody) as {
      project?: unknown;
      tenantId?: string;
      organizationId?: string;
      sessionRole?: string;
      requestedDiscountPercent?: number;
      requestedInstallments?: number;
      clientReportedTotalEur?: number;
    };

    const ctx = resolveTenantRequestContext(req, {
      tenantId: body?.tenantId,
      organizationId: body?.organizationId,
      sessionRole: body?.sessionRole,
    });
    checkTenantRateLimit(ctx.tenantId, "quotes_post", 90);
    assertTenantPermissionAndEntitlement(ctx, "quote:create");

    if (!body || !body.project) {
      return NextResponse.json(
        { ok: false, error: "Doğrulanacak proje verisi eksik." },
        { status: 400 }
      );
    }

    const parsed = parseAndMigrateProject(body.project);
    if (!parsed.success) {
      return NextResponse.json(
        { ok: false, error: `Şema doğrulama hatası: ${parsed.error}` },
        { status: 422 }
      );
    }

    const cleanProject = migrateV3ProjectToV4({
      ...parsed.data,
      tenantId: ctx.tenantId,
      status: "draft",
    } as DesignProject);

    syncProjectCustomMaterials(cleanProject.customMaterials || []);
    const materialsMap = new Map(
      [...DEFAULT_MATERIALS, ...(cleanProject.customMaterials || [])].map((m) => [m.id, m])
    );

    const cRule = ctx.profile.construction;
    const pRule = ctx.profile.pricing;
    const sheetAreaM2 = (cRule.standardSheetLengthMm * cRule.standardSheetWidthMm) / 1_000_000;

    // Server-side authoritative BOM, Compatibility, and Tenant-Isolated Pricing recomputation
    const serverBom = generateBOMForProject(cleanProject, materialsMap, {
      sheetConfig: {
        name: `${ctx.profile.brand.displayName} Plaka ${cRule.standardSheetLengthMm}x${cRule.standardSheetWidthMm}`,
        lengthMm: cRule.standardSheetLengthMm,
        widthMm: cRule.standardSheetWidthMm,
        trimCutMm: cRule.edgeTrimMarginMm,
        kerfMm: cRule.sawKerfMm,
      },
    });

    const serverPricing = calculateProjectPrice(
      serverBom,
      {
        ...pRule,
        standardSheetAreaM2: sheetAreaM2,
      },
      materialsMap,
      cleanProject.sceneObjects || []
    );
    const compat = evaluateProjectCompatibility(cleanProject);
    const unifiedEng = evaluateUnifiedEngineeringModel(cleanProject);

    const maxAllowedDiscount = pRule.maxSalesRepDiscountPercent ?? 25;
    const safeDiscountPct = Math.max(
      0,
      Math.min(
        maxAllowedDiscount,
        Number.isFinite(body.requestedDiscountPercent)
          ? Number(body.requestedDiscountPercent)
          : 0
      )
    );
    const safeInstallments = Math.max(
      1,
      Math.min(
        18,
        Number.isFinite(body.requestedInstallments)
          ? Math.round(Number(body.requestedInstallments))
          : 1
      )
    );

    const discountedTotalEur = Number(
      (serverPricing.totalWithVatEur * (1 - safeDiscountPct / 100)).toFixed(2)
    );
    const clientMismatch =
      typeof body.clientReportedTotalEur === "number" &&
      Math.abs(body.clientReportedTotalEur - serverPricing.totalWithVatEur) > 1.0;

    const code = generateShortQuoteCode(ctx.profile.brand.quoteCodePrefix);
    const now = new Date();
    const expires = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000);
    const totalSheetsCount = (serverBom.nestingResults || []).reduce(
      (sum, nr) => sum + (nr.totalSheetsCount || 0),
      0
    );

    const saved = saveVerifiedQuote({
      code,
      tenantId: ctx.tenantId,
      dealerNetTotalWithVatTry: serverPricing.dealerNetWithVatTry,
      projectId: cleanProject.id,
      projectTitle: cleanProject.title,
      version: cleanProject.version,
      createdAt: now.toISOString(),
      expiresAt: expires.toISOString(),
      discountPercent: safeDiscountPct,
      installments: safeInstallments,
      serverVerifiedSubtotalEur: serverPricing.subtotalNetEur,
      serverVerifiedTotalWithVatEur: serverPricing.totalWithVatEur,
      serverVerifiedDiscountedTotalEur: discountedTotalEur,
      serverVerifiedTotalWithVatTry: serverPricing.totalWithVatTry,
      cutPiecesCount: serverBom.cutList.length,
      totalSheetsCount,
      canApproveProduction:
        compat.canApproveProduction &&
        unifiedEng.canExportToCncAndSaw &&
        unifiedEng.canApproveFinalErpRelease,
      projectSnapshot: cleanProject,
    });

    recordTenantAuditEvent({
      tenantId: ctx.tenantId,
      actorUserId: ctx.userId,
      actorRole: ctx.role,
      action: "QUOTE_VERIFIED_AND_SIGNED",
      targetType: "quote",
      targetId: saved.code,
      metadata: {
        currency: pRule.currency,
        totalWithVatEur: saved.serverVerifiedTotalWithVatEur,
        totalWithVatTry: saved.serverVerifiedTotalWithVatTry,
        dealerNetWithVatTry: serverPricing.dealerNetWithVatTry,
      },
    });

    const origin =
      req.nextUrl?.origin || `https://${ctx.profile.brand.customDomain || "app.modul.studio"}`;
    const shortShareUrl = `${origin}/p/${saved.code}`;
    const statelessShareToken = encodeSharePayloadBase64Url({
      code: saved.code,
      tenantId: ctx.tenantId,
      verifiedTotalEur: saved.serverVerifiedDiscountedTotalEur,
      sig: saved.hmacSignature.slice(0, 16),
      project: cleanProject,
    });
    const qrSvg = generateQrCodeSvg(shortShareUrl, {
      sizePx: 192,
      darkHex: ctx.profile.brand.primaryColorHex || "#141413",
      lightHex: "#FFFFFF",
    });

    return NextResponse.json({
      ok: true,
      tenantId: ctx.tenantId,
      tenantSlug: ctx.tenantSlug,
      currency: pRule.currency,
      dealerDiscountPercent: serverPricing.dealerDiscountPercent ?? 0,
      dealerNetWithVatEur: serverPricing.dealerNetWithVatEur,
      dealerNetWithVatTry: serverPricing.dealerNetWithVatTry,
      priceTamperingDetected: clientMismatch,
      quote: saved,
      sharePath: `/p/${saved.code}`,
      shareUrl: shortShareUrl,
      statelessRecoveryUrl: `${shortShareUrl}?d=${statelessShareToken}`,
      qrSvg,
    });
  } catch (err: unknown) {
    if (err instanceof TenantSecurityError) {
      return NextResponse.json(
        { ok: false, code: err.code, error: err.message },
        { status: err.httpStatus }
      );
    }
    return NextResponse.json(
      {
        ok: false,
        error: err instanceof Error ? err.message : "Sunucu teklif doğrulama hatası",
      },
      { status: 500 }
    );
  }
}
