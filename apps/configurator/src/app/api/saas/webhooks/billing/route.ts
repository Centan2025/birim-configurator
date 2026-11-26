import crypto from "crypto";
import { NextRequest, NextResponse } from "next/server";
import type { SaasPlanId } from "@birim/core";
import {
  IyzicoBillingAdapter,
  StripeBillingAdapter,
  processVerifiedBillingWebhookEvent,
  type BillingProviderId,
} from "../../../../../lib/saas-billing-and-metering";
import {
  queryRowsFromSaasPostgrest,
  syncRowToSaasPostgrest,
} from "../../../../../lib/saas-persistent-ledger";

const PROCESSED_WEBHOOK_EVENTS = new Map<string, number>();
const MAX_PROCESSED_WEBHOOK_EVENTS = 2048;

function isDuplicateWebhookEvent(dedupKey: string): boolean {
  const now = Date.now();
  if (PROCESSED_WEBHOOK_EVENTS.has(dedupKey)) {
    return true;
  }
  if (PROCESSED_WEBHOOK_EVENTS.size >= MAX_PROCESSED_WEBHOOK_EVENTS) {
    const oldestKey = PROCESSED_WEBHOOK_EVENTS.keys().next().value;
    if (oldestKey) PROCESSED_WEBHOOK_EVENTS.delete(oldestKey);
  }
  PROCESSED_WEBHOOK_EVENTS.set(dedupKey, now);
  return false;
}

export async function POST(req: NextRequest) {
  try {
    const rawBody = await req.text();
    const iyzSig = req.headers.get("x-iyz-signature-v3");
    const stripeSig = req.headers.get("stripe-signature");

    let verifiedProvider: BillingProviderId | null = null;
    if (iyzSig) {
      const iyzTsHeader = req.headers.get("x-iyz-timestamp");
      if (iyzTsHeader) {
        const tsSec = Number(iyzTsHeader);
        const nowSec = Math.floor(Date.now() / 1000);
        if (!Number.isFinite(tsSec) || Math.abs(nowSec - tsSec) > 300) {
          return NextResponse.json(
            {
              ok: false,
              code: "STALE_BILLING_WEBHOOK_TIMESTAMP",
              error: "İyzico webhook zaman damgası geçersiz veya süresi dolmuş.",
            },
            { status: 401 }
          );
        }
      }
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
      eventId?: string;
      eventType:
        | "subscription.activated"
        | "invoice.paid"
        | "invoice.payment_failed"
        | "subscription.canceled";
      tenantId: string;
      planId?: SaasPlanId;
      externalSubscriptionRef?: string;
    };

    const bodyDigest = crypto.createHash("sha256").update(rawBody, "utf8").digest("hex");
    const dedupKey = `${verifiedProvider}:${parsed.eventId || bodyDigest}`;
    const existingRemote = await queryRowsFromSaasPostgrest<{ dedup_key: string }>(
      "modul_billing_webhook_events",
      `dedup_key=eq.${encodeURIComponent(dedupKey)}&select=dedup_key&limit=1`
    );
    if ((existingRemote && existingRemote.length > 0) || isDuplicateWebhookEvent(dedupKey)) {
      return NextResponse.json({
        ok: true,
        duplicate: true,
        provider: verifiedProvider,
      });
    }

    void syncRowToSaasPostgrest("modul_billing_webhook_events", parsed.tenantId, {
      dedup_key: dedupKey,
      provider: verifiedProvider,
      event_type: parsed.eventType,
      tenant_id: parsed.tenantId,
    });

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
