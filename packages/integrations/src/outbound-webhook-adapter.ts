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

const BLOCKED_INTERNAL_PORTS = new Set<string>([
  "21",
  "22",
  "23",
  "25",
  "53",
  "110",
  "135",
  "139",
  "143",
  "445",
  "1433",
  "1521",
  "2375",
  "2379",
  "3306",
  "3389",
  "5432",
  "5672",
  "6379",
  "9200",
  "11211",
  "27017",
]);

const REBINDING_DOMAIN_SUFFIXES = [
  ".local",
  ".internal",
  ".localhost",
  ".home.arpa",
  ".nip.io",
  ".sslip.io",
  ".xip.io",
  ".localtest.me",
  ".lvh.me",
];

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

function isPrivateOrReservedIpv4Octets(a: number, b: number, c: number, d: number): boolean {
  if ([a, b, c, d].some((x) => !Number.isInteger(x) || x < 0 || x > 255)) return true;
  if (a === 0 || a === 10 || a === 127) return true;
  if (a === 169 && b === 254) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 168) return true;
  if (a === 100 && b >= 64 && b <= 127) return true; // Carrier-grade NAT (RFC 6598)
  if (a === 192 && b === 0 && (c === 0 || c === 2)) return true;
  if (a === 198 && (b === 18 || b === 19)) return true;
  if (a === 198 && b === 51 && c === 100) return true;
  if (a === 203 && b === 0 && c === 113) return true;
  if (a >= 224) return true; // Multicast & reserved
  return false;
}

/**
 * Evaluates whether a literal IPv4 or IPv6 address (including IPv4-mapped IPv6 such as
 * `::ffff:127.0.0.1` or normalized `::ffff:7f00:1`, hex/octal/integer IPv4) belongs to
 * private, loopback, link-local, cloud-metadata, or reserved address space.
 */
export function isPrivateOrReservedIpAddress(rawHost: string): boolean {
  const stripped = rawHost.trim().toLowerCase().replace(/^\[|\]$/g, "");
  if (!stripped) return true;

  // Single-integer, hex, or octal IPv4 representation (e.g. 2130706433, 0x7f000001)
  if (/^(0x[0-9a-f]+|\d+)$/i.test(stripped)) {
    const num = stripped.startsWith("0x") ? parseInt(stripped, 16) : Number(stripped);
    if (!Number.isFinite(num) || num < 0 || num > 0xffffffff) return true;
    return isPrivateOrReservedIpv4Octets(
      (num >>> 24) & 0xff,
      (num >>> 16) & 0xff,
      (num >>> 8) & 0xff,
      num & 0xff
    );
  }

  // Standard or octal dotted IPv4
  if (/^[0-9.x]+$/i.test(stripped) && stripped.includes(".")) {
    const parts = stripped.split(".");
    if (parts.length !== 4) return true;
    const octets = parts.map((p) => {
      if (p.startsWith("0x")) return parseInt(p, 16);
      if (p.length > 1 && p.startsWith("0")) return parseInt(p, 8);
      return Number(p);
    });
    return isPrivateOrReservedIpv4Octets(octets[0], octets[1], octets[2], octets[3]);
  }

  // IPv6 checks (including IPv4-mapped IPv6 in dotted or hex-pair form)
  if (stripped.includes(":")) {
    const noZone = stripped.split("%")[0];
    if (noZone === "::" || noZone === "::1" || noZone === "0:0:0:0:0:0:0:1" || noZone === "0:0:0:0:0:0:0:0") {
      return true;
    }
    if (
      noZone.startsWith("fc") ||
      noZone.startsWith("fd") ||
      noZone.startsWith("fe8") ||
      noZone.startsWith("fe9") ||
      noZone.startsWith("fea") ||
      noZone.startsWith("feb") ||
      noZone.startsWith("ff")
    ) {
      return true;
    }
    // Dotted IPv4-mapped IPv6: ::ffff:169.254.169.254
    const dottedMapped = noZone.match(/(?::ffff:|0:0:0:0:0:ffff:)(\d+\.\d+\.\d+\.\d+)$/i);
    if (dottedMapped) {
      return isPrivateOrReservedIpAddress(dottedMapped[1]);
    }
    // Hex IPv4-mapped IPv6 (URL parser normalizes [::ffff:127.0.0.1] -> [::ffff:7f00:1])
    const hexMapped = noZone.match(/(?:^::ffff:|^0:0:0:0:0:ffff:)([0-9a-f]{1,4}):([0-9a-f]{1,4})$/i);
    if (hexMapped) {
      const hi = parseInt(hexMapped[1], 16);
      const lo = parseInt(hexMapped[2], 16);
      return isPrivateOrReservedIpv4Octets(
        (hi >>> 8) & 0xff,
        hi & 0xff,
        (lo >>> 8) & 0xff,
        lo & 0xff
      );
    }
    // Expanded IPv4-compatible IPv6 ::127.0.0.1 or ::7f00:1
    const compatHex = noZone.match(/^::([0-9a-f]{1,4}):([0-9a-f]{1,4})$/i);
    if (compatHex) {
      const hi = parseInt(compatHex[1], 16);
      const lo = parseInt(compatHex[2], 16);
      return isPrivateOrReservedIpv4Octets(
        (hi >>> 8) & 0xff,
        hi & 0xff,
        (lo >>> 8) & 0xff,
        lo & 0xff
      );
    }
  }

  return false;
}

export function assertSafeOutboundWebhookUrl(rawUrl: string): URL {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    throw new Error("Geçersiz webhook hedef URL formatı.");
  }
  if (parsed.username || parsed.password) {
    throw new Error("SSRF koruması: Webhook URL içinde kullanıcı adı veya parola bilgisi taşınamaz.");
  }
  const isProd = typeof process !== "undefined" && process.env?.NODE_ENV === "production";
  if (parsed.protocol !== "https:" && (isProd || parsed.protocol !== "http:")) {
    throw new Error("Webhook hedef URL yalnızca HTTPS protokolünü kullanabilir.");
  }
  if (parsed.port && BLOCKED_INTERNAL_PORTS.has(parsed.port)) {
    throw new Error(`SSRF koruması: Yasaklı iç servis portuna (${parsed.port}) webhook gönderilemez.`);
  }
  const host = parsed.hostname.toLowerCase();
  if (
    host === "localhost" ||
    host === "metadata.google.internal" ||
    host === "metadata" ||
    host === "instance-data" ||
    REBINDING_DOMAIN_SUFFIXES.some((sfx) => host.endsWith(sfx)) ||
    isPrivateOrReservedIpAddress(host)
  ) {
    throw new Error(`SSRF koruması: Özel/yerel ağ hedefine (${host}) webhook gönderimi engellendi.`);
  }
  return parsed;
}

/**
 * Resolves DNS A/AAAA records on Node.js runtimes prior to outbound HTTP dispatch
 * to defeat DNS-rebinding domains pointing to internal VPC or cloud metadata IPs.
 */
export async function verifyOutboundWebhookDnsSafety(parsedUrl: URL): Promise<void> {
  assertSafeOutboundWebhookUrl(parsedUrl.toString());
  const host = parsedUrl.hostname.toLowerCase().replace(/^\[|\]$/g, "");
  if (typeof process === "undefined" || !process.versions?.node) return;

  try {
    // Dynamic require keeps client/Edge bundlers free of hard node:dns coupling
    const dnsMod = require("dns") as typeof import("dns");
    const records = await dnsMod.promises.lookup(host, { all: true, verbatim: true });
    if (!Array.isArray(records) || records.length === 0) {
      if (process.env?.NODE_ENV === "production") {
        throw new Error(`SSRF koruması: Webhook alan adı (${host}) çözümlenemedi.`);
      }
      return;
    }
    for (const rec of records) {
      if (isPrivateOrReservedIpAddress(rec.address)) {
        throw new Error(
          `SSRF koruması: Alan adı (${host}) özel/yerel IP adresine (${rec.address}) çözümlendiği için engellendi.`
        );
      }
    }
  } catch (err) {
    if (err instanceof Error && err.message.startsWith("SSRF koruması:")) {
      throw err;
    }
    // In offline unit test environments with mocked fetch, non-SSRF ENOTFOUND/EAI_AGAIN is allowed;
    // in production, DNS resolution failure fails closed.
    if (process.env?.NODE_ENV === "production") {
      throw new Error(
        `SSRF koruması: Webhook hedef DNS doğrulaması başarısız (${host}).`
      );
    }
  }
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
    assertSafeOutboundWebhookUrl(params.endpointUrl);
    this.tenantId = params.tenantId;
    this.endpointUrl = params.endpointUrl;
    const resolvedSecret =
      params.signingSecret || process.env.MODUL_WEBHOOK_SIGNING_SECRET;
    if (!resolvedSecret && typeof process !== "undefined" && process.env?.NODE_ENV === "production") {
      throw new Error("SERVER_SECRET_MISSING: MODUL_WEBHOOK_SIGNING_SECRET üretim ortamında zorunludur.");
    }
    this.signingSecret =
      resolvedSecret || `whsec_${params.tenantId.replace(/-/g, "").slice(0, 16)}`;
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
        const parsedTarget = assertSafeOutboundWebhookUrl(this.endpointUrl);
        await verifyOutboundWebhookDnsSafety(parsedTarget);
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 15_000);
        let res: Response;
        try {
          res = await fetch(this.endpointUrl, {
            method: "POST",
            redirect: "error",
            headers: {
              "Content-Type": "application/json; charset=utf-8",
              "X-Modul-Tenant-Id": this.tenantId,
              "X-Modul-Event-Type": params.eventType,
              "X-Modul-Timestamp": nowIso,
              "X-Modul-Signature-256": sig,
              "Idempotency-Key": idemp,
            },
            body: rawBody,
            signal: controller.signal,
          });
        } finally {
          clearTimeout(timer);
        }
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
