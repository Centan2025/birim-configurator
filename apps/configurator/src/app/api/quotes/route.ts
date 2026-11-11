import { NextRequest, NextResponse } from "next/server";
import {
  parseAndMigrateProject,
  migrateV3ProjectToV4,
  evaluateProjectCompatibility,
  type DesignProject,
} from "@birim/core";
import { generateBOMForProject } from "@birim/manufacturing";
import { calculateProjectPrice } from "@birim/pricing";
import { generateQrCodeSvg } from "../../../lib/qr-svg";
import { encodeSharePayloadBase64Url } from "../../../lib/quote-codec";
import { generateShortQuoteCode, saveVerifiedQuote } from "../../../lib/server-quote-store";

const MAX_PAYLOAD_BYTES = 1_500_000;
const MAX_ALLOWED_DISCOUNT_PCT = 25;

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
      requestedDiscountPercent?: number;
      requestedInstallments?: number;
      clientReportedTotalEur?: number;
    };

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
      status: "draft",
    } as DesignProject);

    // Server-side authoritative BOM, Compatibility, and Pricing recomputation (client price is NEVER trusted)
    const serverBom = generateBOMForProject(cleanProject);
    const serverPricing = calculateProjectPrice(serverBom);
    const compat = evaluateProjectCompatibility(cleanProject);

    const safeDiscountPct = Math.max(
      0,
      Math.min(
        MAX_ALLOWED_DISCOUNT_PCT,
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

    const code = generateShortQuoteCode();
    const now = new Date();
    const expires = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000);
    const totalSheetsCount = (serverBom.nestingResults || []).reduce(
      (sum, nr) => sum + (nr.totalSheetsCount || 0),
      0
    );

    const saved = saveVerifiedQuote({
      code,
      projectId: cleanProject.id,
      projectTitle: cleanProject.title,
      version: cleanProject.version,
      createdAt: now.toISOString(),
      expiresAt: expires.toISOString(),
      discountPercent: safeDiscountPct,
      installments: safeInstallments,
      serverVerifiedSubtotalEur: serverPricing.subtotalEur,
      serverVerifiedTotalWithVatEur: serverPricing.totalWithVatEur,
      serverVerifiedDiscountedTotalEur: discountedTotalEur,
      serverVerifiedTotalWithVatTry: serverPricing.totalWithVatTry,
      cutPiecesCount: serverBom.cutList.length,
      totalSheetsCount,
      canApproveProduction: compat.canApproveProduction,
      projectSnapshot: cleanProject,
    });

    const origin = req.nextUrl.origin || "https://konfigurator.birim.com";
    const shortShareUrl = `${origin}/p/${saved.code}`;
    const statelessShareToken = encodeSharePayloadBase64Url({
      code: saved.code,
      verifiedTotalEur: saved.serverVerifiedDiscountedTotalEur,
      sig: saved.hmacSignature.slice(0, 16),
      project: cleanProject,
    });
    const qrSvg = generateQrCodeSvg(shortShareUrl, {
      sizePx: 192,
      darkHex: "#141413",
      lightHex: "#FFFFFF",
    });

    return NextResponse.json({
      ok: true,
      priceTamperingDetected: clientMismatch,
      quote: saved,
      sharePath: `/p/${saved.code}`,
      shareUrl: shortShareUrl,
      statelessRecoveryUrl: `${shortShareUrl}?d=${statelessShareToken}`,
      qrSvg,
    });
  } catch (err: unknown) {
    return NextResponse.json(
      {
        ok: false,
        error: err instanceof Error ? err.message : "Sunucu teklif doğrulama hatası",
      },
      { status: 500 }
    );
  }
}
