import { NextRequest, NextResponse } from "next/server";
import { getVerifiedQuoteByCode } from "../../../../lib/server-quote-store";

export async function GET(
  _req: NextRequest,
  context: { params: Promise<{ code: string }> }
) {
  const { code } = await context.params;
  const record = getVerifiedQuoteByCode(code);
  if (!record) {
    return NextResponse.json(
      { ok: false, error: "Teklif kaydı bulunamadı veya imza doğrulaması başarısız." },
      { status: 404 }
    );
  }

  return NextResponse.json({
    ok: true,
    quote: record,
  });
}
