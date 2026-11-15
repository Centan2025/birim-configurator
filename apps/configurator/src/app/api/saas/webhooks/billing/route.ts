import { NextRequest, NextResponse } from "next/server";
import type { SaasPlanId } from "@birim/core";
import {
  IyzicoBillingAdapter,
  StripeBillingAdapter,
  processVerifiedBillingWebhookEvent,
  type BillingProviderId,
} from "../../../../../lib/saas-billing-and-metering";

export async function POST(req: NextRequest) {
  try {
    const rawBody = await req.text();
    const iyzSig = req.headers.get("x-iyz-signature-v3");
    const stripeSig = req.headers.get("stripe-signature");

    let verifiedProvider: BillingProviderId | null = null;
    if (iyzSig) {
      const iyz = new IyzicoBillingAdapter();
      if (iyz.verifyWebhookSignature(rawBody, iyzSig)) {
        verifiedProvider = "iyzico_tr";
      }
    } else if (stripeSig) {
      const stripe = new StripeBillingAdapter();
      if (stripe.verifyWebhookSignature(rawBody, stripeSig)) {
        verifiedProvider = "stripe_global";
      }
    }

    if (!verifiedProvider) {
      return NextResponse.json(
        {
          ok: false,
          code: "INVALID_BILLING_WEBHOOK_SIGNATURE",
          error: "Ödeme sağlayıcı (İyzico / Stripe) webhook imzası doğrulanamadı.",
        },
        { status: 401 }
      );
    }

    const parsed = JSON.parse(rawBody) as {
      eventType:
        | "subscription.activated"
        | "invoice.paid"
        | "invoice.payment_failed"
        | "subscription.canceled";
      tenantId: string;
      planId?: SaasPlanId;
      externalSubscriptionRef?: string;
    };

    const subscription = processVerifiedBillingWebhookEvent({
      provider: verifiedProvider,
      eventType: parsed.eventType,
      tenantId: parsed.tenantId,
      planId: parsed.planId,
      externalSubscriptionRef: parsed.externalSubscriptionRef,
    });

    return NextResponse.json({ ok: true, provider: verifiedProvider, subscription });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "Billing webhook hatası." },
      { status: 400 }
    );
  }
}
