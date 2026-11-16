import * as crypto from "crypto";
import type { DesignProject } from "@birim/core";
import type { ManufacturingBOM } from "@birim/manufacturing";
import type { PricingBreakdown } from "@birim/pricing";

export type OutboxDeliveryStatus = "pending" | "delivered" | "failed_dlq";

export interface IntegrationOutboxEvent {
  id: string;
  tenantId: string;
  endpointUrl: string;
  eventType: "quotation.upserted" | "production.blueprint.published";
  idempotencyKey: string;
  status: OutboxDeliveryStatus;
  attemptCount: number;
  maxAttempts: number;
  lastHttpStatus?: number;
  lastError?: string;
  signatureHeader: string;
  payload: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

const OUTBOX_BY_TENANT = new Map<string, IntegrationOutboxEvent[]>();

export function signWebhookPayloadHmac256(
  rawBody: string,
  timestampIso: string,
  secret: string
): string {
  const digest = crypto
    .createHmac("sha256", secret)
    .update(`${timestampIso}.${rawBody}`, "utf8")
    .digest("hex");
  return `sha256=${digest}`;
}

export function verifyWebhookPayloadHmac256(
  rawBody: string,
  timestampIso: string,
  signatureHeader: string,
  secret: string
): boolean {
  const expected = signWebhookPayloadHmac256(rawBody, timestampIso, secret);
  try {
    return (
      expected.length === signatureHeader.length &&
      crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signatureHeader))
    );
  } catch {
    return false;
  }
}

export function listTenantOutboxEvents(tenantId: string): IntegrationOutboxEvent[] {
  return [...(OUTBOX_BY_TENANT.get(tenantId) || [])];
}

export class OutboundWebhookErpAdapter {
  private readonly tenantId: string;
  private readonly endpointUrl: string;
  private readonly signingSecret: string;
  private readonly maxAttempts: number;

  constructor(params: {
    tenantId: string;
    endpointUrl: string;
    signingSecret?: string;
    maxAttempts?: number;
  }) {
    this.tenantId = params.tenantId;
    this.endpointUrl = params.endpointUrl;
    this.signingSecret =
      params.signingSecret ||
      process.env.MODUL_WEBHOOK_SIGNING_SECRET ||
      `whsec_${params.tenantId.replace(/-/g, "").slice(0, 16)}`;
    this.maxAttempts = params.maxAttempts ?? 3;
  }

  async dispatchEvent(params: {
    eventType: IntegrationOutboxEvent["eventType"];
    idempotencyKey?: string;
    payload: Record<string, unknown>;
  }): Promise<IntegrationOutboxEvent> {
    const idemp =
      (params.idempotencyKey || "").trim() ||
      `idemp_${this.tenantId.slice(0, 8)}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;

    const existingList = OUTBOX_BY_TENANT.get(this.tenantId) || [];
    const duplicate = existingList.find((e) => e.idempotencyKey === idemp);
    if (duplicate && duplicate.status === "delivered") {
      return duplicate;
    }

    const nowIso = new Date().toISOString();
    const rawBody = JSON.stringify(params.payload);
    const sig = signWebhookPayloadHmac256(rawBody, nowIso, this.signingSecret);

    const record: IntegrationOutboxEvent = duplicate || {
      id: `outbox_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      tenantId: this.tenantId,
      endpointUrl: this.endpointUrl,
      eventType: params.eventType,
      idempotencyKey: idemp,
      status: "pending",
      attemptCount: 0,
      maxAttempts: this.maxAttempts,
      signatureHeader: sig,
      payload: params.payload,
      createdAt: nowIso,
      updatedAt: nowIso,
    };

    if (!duplicate) {
      existingList.unshift(record);
      OUTBOX_BY_TENANT.set(this.tenantId, existingList.slice(0, 250));
    }

    while (record.attemptCount < record.maxAttempts) {
      record.attemptCount += 1;
      record.updatedAt = new Date().toISOString();
      try {
        const res = await fetch(this.endpointUrl, {
          method: "POST",
          headers: {
            "Content-Type": "application/json; charset=utf-8",
            "X-Modul-Tenant-Id": this.tenantId,
            "X-Modul-Event-Type": params.eventType,
            "X-Modul-Timestamp": nowIso,
            "X-Modul-Signature-256": sig,
            "Idempotency-Key": idemp,
          },
          body: rawBody,
        });
        record.lastHttpStatus = res.status;
        if (res.ok) {
          record.status = "delivered";
          record.lastError = undefined;
          return { ...record };
        }
        record.lastError = `HTTP ${res.status}`;
      } catch (err) {
        record.lastError = err instanceof Error ? err.message : "Webhook network error";
      }
    }

    record.status = "failed_dlq";
    return { ...record };
  }

  async publishQuotationWebhook(params: {
    project: DesignProject;
    bom: ManufacturingBOM;
    pricing: PricingBreakdown;
    currency: "EUR" | "TRY";
    discountRatePercent: number;
    autoConvertToOrder: boolean;
    idempotencyKey?: string;
  }) {
    return this.dispatchEvent({
      eventType: "quotation.upserted",
      idempotencyKey: params.idempotencyKey,
      payload: {
        tenantId: this.tenantId,
        projectId: params.project.id,
        projectTitle: params.project.title,
        version: params.project.version,
        currency: params.currency,
        discountRatePercent: params.discountRatePercent,
        autoConvertToOrder: params.autoConvertToOrder,
        totalWithVatEur: params.pricing.totalWithVatEur,
        totalWithVatTry: params.pricing.totalWithVatTry,
        dealerNetWithVatTry: params.pricing.dealerNetWithVatTry,
        cutPiecesCount: params.bom.cutList.length,
        totalSheetsCount: params.bom.nestingResults.reduce((s, n) => s + n.totalSheetsCount, 0),
      },
    });
  }

  async publishErpBlueprintWebhook(params: {
    project: DesignProject;
    bom: ManufacturingBOM;
    orderRef: string;
    cncFormat: string;
    idempotencyKey?: string;
  }) {
    return this.dispatchEvent({
      eventType: "production.blueprint.published",
      idempotencyKey: params.idempotencyKey,
      payload: {
        tenantId: this.tenantId,
        orderRef: params.orderRef,
        projectId: params.project.id,
        cncFormat: params.cncFormat,
        cutListCount: params.bom.cutList.length,
        hardwareCount: params.bom.summary.totalHardwareCount,
        drillingHolesCount: params.bom.summary.totalDrillingHolesCount,
        sheetsCount: params.bom.nestingResults.reduce((s, n) => s + n.totalSheetsCount, 0),
      },
    });
  }
}

export async function retryDeadLetterWebhookEvent(
  tenantId: string,
  outboxEventId: string,
  signingSecret?: string
): Promise<IntegrationOutboxEvent | null> {
  const list = OUTBOX_BY_TENANT.get(tenantId) || [];
  const target = list.find((e) => e.id === outboxEventId);
  if (!target) return null;
  target.attemptCount = 0;
  target.status = "pending";
  const adapter = new OutboundWebhookErpAdapter({
    tenantId,
    endpointUrl: target.endpointUrl,
    signingSecret,
    maxAttempts: 1,
  });
  return adapter.dispatchEvent({
    eventType: target.eventType,
    idempotencyKey: target.idempotencyKey,
    payload: target.payload,
  });
}
