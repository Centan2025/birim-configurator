import { NextRequest, NextResponse } from "next/server";
import { getTenantProfileByIdOrSlug } from "@birim/core";
import {
  getVerifiedQuoteByCode,
  getVerifiedQuoteByCodeForTenant,
} from "../../../../lib/server-quote-store";
import {
  TenantSecurityError,
  extractCookieValue,
  verifyTenantSessionToken,
} from "../../../../lib/tenant-auth-guard";

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ code: string }> }
) {
  try {
    const { code } = await context.params;
    const explicitTenantParam = req.nextUrl?.searchParams?.get("tenantId");
    const authHeader = req.headers.get("authorization") || "";
    const bearerToken = authHeader.startsWith("Bearer ") ? authHeader.slice(7).trim() : null;
    const cookieToken = extractCookieValue(req.headers.get("cookie"), "modul_session");
    const sessionHeader = req.headers.get("x-modul-session-token") || bearerToken || cookieToken;

    if (sessionHeader) {
      const claims = verifyTenantSessionToken(sessionHeader);
      if (!claims) {
        throw new TenantSecurityError("INVALID_SESSION_TOKEN", "Geçersiz oturum jetonu.", 401);
      }
      const scopedRecord = getVerifiedQuoteByCodeForTenant(code, claims.tenantId);
      if (!scopedRecord) {
        return NextResponse.json(
          { ok: false, code: "QUOTE_NOT_FOUND_OR_ISOLATED", error: "Teklif kaydı bu organizasyonda bulunamadı." },
          { status: 404 }
        );
      }
      const tenantProfile = getTenantProfileByIdOrSlug(scopedRecord.tenantId);
      return NextResponse.json({
        ok: true,
        quote: scopedRecord,
        tenantSlug: tenantProfile.slug,
        brand: tenantProfile.brand,
        currency: tenantProfile.pricing.currency,
      });
    }

    const record = explicitTenantParam
      ? getVerifiedQuoteByCodeForTenant(code, getTenantProfileByIdOrSlug(explicitTenantParam).tenantId)
      : getVerifiedQuoteByCode(code);

    if (!record) {
      return NextResponse.json(
        { ok: false, error: "Teklif kaydı bulunamadı veya imza doğrulaması başarısız." },
        { status: 404 }
      );
    }

    const tenantProfile = getTenantProfileByIdOrSlug(record.tenantId);
    return NextResponse.json({
      ok: true,
      quote: record,
      tenantSlug: tenantProfile.slug,
      brand: tenantProfile.brand,
      currency: tenantProfile.pricing.currency,
    });
  } catch (err) {
    if (err instanceof TenantSecurityError) {
      return NextResponse.json({ ok: false, code: err.code, error: err.message }, { status: err.httpStatus });
    }
    return NextResponse.json(
      { ok: false, error: "Teklif sorgulama hatası." },
      { status: 500 }
    );
  }
}
