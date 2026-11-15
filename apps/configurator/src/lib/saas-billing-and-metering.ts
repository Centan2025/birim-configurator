import crypto from "crypto";
import {
  BUILTIN_SAAS_TENANTS,
  PLAN_ENTITLEMENTS_MATRIX,
  getTenantProfileByIdOrSlug,
  registerOrUpdateTenantProfile,
  type SaasPlanId,
  type TenantWorkspaceProfile,
} from "@birim/core";
import { TenantSecurityError, recordTenantAuditEvent } from "./tenant-auth-guard";
import {
  flushSaasPersistentLedger,
  readSaasPersistentLedger,
  syncRowToSaasPostgrest,
} from "./saas-persistent-ledger";

export type UsageMetricKey =
  | "active_projects"
  | "cloud_render"
  | "cam_export"
  | "erp_publish"
  | "r2_upload_mb"
  | "quote_created";

export type BillingProviderId = "iyzico_tr" | "stripe_global";

export type SubscriptionBillingStatus =
  | "trialing"
  | "active"
  | "past_due"
  | "suspended"
  | "canceled";

export interface TenantSubscriptionRecord {
  subscriptionId: string;
  tenantId: string;
  planId: SaasPlanId;
  provider: BillingProviderId;
  billingCycle: "monthly" | "annual";
  status: SubscriptionBillingStatus;
  currency: "TRY" | "EUR" | "USD";
  amountPerPeriod: number;
  currentPeriodStart: string;
  currentPeriodEnd: string;
  gracePeriodEndsAt?: string | null;
  externalSubscriptionRef?: string;
  updatedAt: string;
}

export interface BillingCheckoutSession {
  provider: BillingProviderId;
  checkoutSessionId: string;
  checkoutUrl: string;
  tenantId: string;
  targetPlanId: SaasPlanId;
  billingCycle: "monthly" | "annual";
  currency: "TRY" | "EUR";
  totalWithTax: number;
  createdAt: string;
}

export interface IBillingProvider {
  readonly providerId: BillingProviderId;
  createCheckoutSession(params: {
    tenant: TenantWorkspaceProfile;
    targetPlanId: SaasPlanId;
    billingCycle: "monthly" | "annual";
    originUrl: string;
  }): BillingCheckoutSession;
  verifyWebhookSignature(rawBody: string, signatureHeader: string): boolean;
}

export const SAAS_PLAN_PRICING_TABLE: Record<
  SaasPlanId,
  { monthlyEur: number; annualEur: number; monthlyTry: number; annualTry: number }
> = {
  starter: { monthlyEur: 49, annualEur: 490, monthlyTry: 1950, annualTry: 19500 },
  professional: { monthlyEur: 149, annualEur: 1490, monthlyTry: 5900, annualTry: 59000 },
  business: { monthlyEur: 399, annualEur: 3990, monthlyTry: 15900, annualTry: 159000 },
  enterprise: { monthlyEur: 990, annualEur: 9900, monthlyTry: 39500, annualTry: 395000 },
};

const SUBSCRIPTIONS_BY_TENANT = new Map<string, TenantSubscriptionRecord>();
const USAGE_LEDGER = new Map<string, number>();
const USAGE_IDEMPOTENCY = new Set<string>();

function currentYearMonth(): string {
  const d = new Date();
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

function ensureDefaultSubscription(tenantId: string): TenantSubscriptionRecord {
  const existing = SUBSCRIPTIONS_BY_TENANT.get(tenantId);
  if (existing) return existing;
  const ledger = readSaasPersistentLedger();
  const fromDisk = ledger.subscriptionsByTenant[tenantId] as TenantSubscriptionRecord | undefined;
  if (fromDisk) {
    SUBSCRIPTIONS_BY_TENANT.set(tenantId, fromDisk);
    return fromDisk;
  }

  const profile = getTenantProfileByIdOrSlug(tenantId);
  const priceRow = SAAS_PLAN_PRICING_TABLE[profile.planId];
  const isTry = profile.pricing.currency === "TRY";
  const now = Date.now();
  const seeded: TenantSubscriptionRecord = {
    subscriptionId: `sub_${profile.slug}_default`,
    tenantId: profile.tenantId,
    planId: profile.planId,
    provider: isTry ? "iyzico_tr" : "stripe_global",
    billingCycle: "annual",
    status: profile.status === "trialing" ? "trialing" : "active",
    currency: isTry ? "TRY" : "EUR",
    amountPerPeriod: isTry ? priceRow.annualTry : priceRow.annualEur,
    currentPeriodStart: new Date(now - 7 * 86400_000).toISOString(),
    currentPeriodEnd: new Date(now + 358 * 86400_000).toISOString(),
    gracePeriodEndsAt: null,
    updatedAt: new Date(now).toISOString(),
  };
  SUBSCRIPTIONS_BY_TENANT.set(profile.tenantId, seeded);
  return seeded;
}

for (const t of BUILTIN_SAAS_TENANTS) {
  ensureDefaultSubscription(t.tenantId);
}

export function getTenantSubscription(tenantId: string): TenantSubscriptionRecord {
  return { ...ensureDefaultSubscription(tenantId) };
}

export function listAllTenantSubscriptions(): TenantSubscriptionRecord[] {
  return Array.from(SUBSCRIPTIONS_BY_TENANT.values()).map((s) => ({ ...s }));
}

export function updateTenantSubscriptionStatus(params: {
  tenantId: string;
  planId?: SaasPlanId;
  status: SubscriptionBillingStatus;
  provider?: BillingProviderId;
  externalSubscriptionRef?: string;
}): TenantSubscriptionRecord {
  const cur = ensureDefaultSubscription(params.tenantId);
  const nextPlan = params.planId || cur.planId;
  const now = Date.now();
  const updated: TenantSubscriptionRecord = {
    ...cur,
    planId: nextPlan,
    provider: params.provider || cur.provider,
    status: params.status,
    externalSubscriptionRef: params.externalSubscriptionRef || cur.externalSubscriptionRef,
    gracePeriodEndsAt:
      params.status === "past_due"
        ? new Date(now + 7 * 86400_000).toISOString()
        : null,
    updatedAt: new Date(now).toISOString(),
  };
  SUBSCRIPTIONS_BY_TENANT.set(params.tenantId, updated);
  const ledger = readSaasPersistentLedger();
  ledger.subscriptionsByTenant[params.tenantId] = updated;
  flushSaasPersistentLedger();
  void syncRowToSaasPostgrest("modul_subscriptions", params.tenantId, {
    tenant_id: params.tenantId,
    plan_id: updated.planId,
    billing_status: updated.status === "suspended" ? "canceled" : updated.status,
    billing_cycle: updated.billingCycle,
  });

  const profile = getTenantProfileByIdOrSlug(params.tenantId);
  registerOrUpdateTenantProfile({
    ...profile,
    planId: nextPlan,
    status:
      params.status === "suspended" || params.status === "canceled"
        ? "suspended"
        : params.status === "past_due"
          ? "past_due"
          : params.status === "trialing"
            ? "trialing"
            : "active",
  });
  return { ...updated };
}

/**
 * Enforces subscription lifecycle state on mutating / export endpoints:
 * - `active` / `trialing`: Full plan access.
 * - `past_due` (within 7-day grace window): Read-only mode! Viewing projects is allowed,
 *   but new mutations, cloud renders, and CAM/ERP exports throw `402 BILLING_PAST_DUE_READONLY`.
 * - `suspended` / `canceled` (or expired grace period): Throws `403 SUBSCRIPTION_SUSPENDED`.
 */
export function assertSubscriptionWritable(tenantId: string): TenantSubscriptionRecord {
  const sub = ensureDefaultSubscription(tenantId);
  if (sub.status === "suspended" || sub.status === "canceled") {
    throw new TenantSecurityError(
      "SUBSCRIPTION_SUSPENDED",
      "Organizasyon aboneliği askıya alınmış veya iptal edilmiş durumda.",
      403
    );
  }
  if (sub.status === "past_due") {
    const graceEnd = sub.gracePeriodEndsAt ? Date.parse(sub.gracePeriodEndsAt) : 0;
    if (graceEnd > 0 && Date.now() > graceEnd) {
      updateTenantSubscriptionStatus({ tenantId, status: "suspended" });
      throw new TenantSecurityError(
        "SUBSCRIPTION_SUSPENDED",
        "Ödeme ek süresi (7 gün) dolduğu için organizasyon erişimi durduruldu.",
        403
      );
    }
    throw new TenantSecurityError(
      "BILLING_PAST_DUE_READONLY",
      "Ödeme gecikmesi nedeniyle hesabınız geçici salt-okunur (read-only) moddadır; projelerinizi görüntüleyebilir ancak yeni üretim/render çıktısı alamazsınız.",
      402
    );
  }
  return sub;
}

export function getTenantUsageSummary(tenantId: string, profile?: TenantWorkspaceProfile) {
  const p = profile || getTenantProfileByIdOrSlug(tenantId);
  const entitlements = PLAN_ENTITLEMENTS_MATRIX[p.planId];
  const ym = currentYearMonth();
  const readMetric = (m: UsageMetricKey) => USAGE_LEDGER.get(`${tenantId}:${ym}:${m}`) || 0;

  return {
    period: ym,
    planId: p.planId,
    metrics: {
      active_projects: { used: readMetric("active_projects"), limit: entitlements.maxActiveProjects },
      cloud_render: { used: readMetric("cloud_render"), limit: entitlements.monthlyCloudRenderCredits },
      cam_export: { used: readMetric("cam_export"), limit: entitlements.monthlyCamExports },
      erp_publish: { used: readMetric("erp_publish"), limit: entitlements.allowErpIntegration ? 999999 : 0 },
      r2_upload_mb: { used: readMetric("r2_upload_mb"), limit: entitlements.storageQuotaGb * 1024 },
      quote_created: { used: readMetric("quote_created"), limit: 999999 },
    },
  };
}

export function consumeTenantUsageQuota(
  tenantId: string,
  profile: TenantWorkspaceProfile,
  metric: UsageMetricKey,
  quantity = 1,
  idempotencyKey?: string
): { used: number; limit: number; remaining: number } {
  assertSubscriptionWritable(tenantId);
  const ym = currentYearMonth();
  const bucketKey = `${tenantId}:${ym}:${metric}`;

  if (idempotencyKey) {
    const idemKey = `${tenantId}:${metric}:${idempotencyKey}`;
    if (USAGE_IDEMPOTENCY.has(idemKey)) {
      const curUsed = USAGE_LEDGER.get(bucketKey) || 0;
      const summary = getTenantUsageSummary(tenantId, profile);
      const lim = summary.metrics[metric].limit;
      return { used: curUsed, limit: lim, remaining: Math.max(0, lim - curUsed) };
    }
    USAGE_IDEMPOTENCY.add(idemKey);
  }

  const summary = getTenantUsageSummary(tenantId, profile);
  const limit = summary.metrics[metric].limit;
  const currentUsed = summary.metrics[metric].used;
  if (currentUsed + quantity > limit) {
    throw new TenantSecurityError(
      "USAGE_QUOTA_EXCEEDED",
      `'${metric}' aylık kullanım kotası doldu (${currentUsed}/${limit}). Üst abonelik paketine geçerek kotanızı artırabilirsiniz.`,
      402
    );
  }
  const nextUsed = Number((currentUsed + quantity).toFixed(3));
  USAGE_LEDGER.set(bucketKey, nextUsed);
  const ledger = readSaasPersistentLedger();
  ledger.usageCounters[bucketKey] = nextUsed;
  if (idempotencyKey) {
    ledger.usageIdempotencyKeys = Array.from(USAGE_IDEMPOTENCY).slice(-1000);
  }
  flushSaasPersistentLedger();
  void syncRowToSaasPostgrest("modul_usage_events", tenantId, {
    tenant_id: tenantId,
    metric_key: metric === "active_projects" ? "quote_created" : metric,
    quantity,
    idempotency_key: idempotencyKey || `${bucketKey}:${nextUsed}`,
  });
  return { used: nextUsed, limit, remaining: Math.max(0, limit - nextUsed) };
}

export class IyzicoBillingAdapter implements IBillingProvider {
  readonly providerId: BillingProviderId = "iyzico_tr";
  private readonly secretKey: string;

  constructor(secretKey?: string) {
    this.secretKey =
      secretKey || process.env.IYZICO_SECRET_KEY || "iyzico-dev-webhook-secret-v1";
  }

  createCheckoutSession(params: {
    tenant: TenantWorkspaceProfile;
    targetPlanId: SaasPlanId;
    billingCycle: "monthly" | "annual";
    originUrl: string;
  }): BillingCheckoutSession {
    const row = SAAS_PLAN_PRICING_TABLE[params.targetPlanId];
    const netTry = params.billingCycle === "annual" ? row.annualTry : row.monthlyTry;
    const totalWithTax = Math.round(netTry * 1.2); // %20 KDV dahil
    const checkoutSessionId = `iyz_chk_${Date.now()}_${params.tenant.slug}`;
    return {
      provider: "iyzico_tr",
      checkoutSessionId,
      checkoutUrl: `${params.originUrl}/${params.tenant.slug}/admin?billing_checkout=${checkoutSessionId}&provider=iyzico`,
      tenantId: params.tenant.tenantId,
      targetPlanId: params.targetPlanId,
      billingCycle: params.billingCycle,
      currency: "TRY",
      totalWithTax,
      createdAt: new Date().toISOString(),
    };
  }

  signWebhookPayload(rawBody: string): string {
    return crypto.createHmac("sha256", this.secretKey).update(rawBody, "utf8").digest("hex");
  }

  verifyWebhookSignature(rawBody: string, signatureHeader: string): boolean {
    const expected = this.signWebhookPayload(rawBody);
    try {
      return (
        expected.length === signatureHeader.length &&
        crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signatureHeader))
      );
    } catch {
      return false;
    }
  }
}

export class StripeBillingAdapter implements IBillingProvider {
  readonly providerId: BillingProviderId = "stripe_global";
  private readonly webhookSecret: string;

  constructor(webhookSecret?: string) {
    this.webhookSecret =
      webhookSecret || process.env.STRIPE_WEBHOOK_SECRET || "whsec_stripe_dev_secret_v1";
  }

  createCheckoutSession(params: {
    tenant: TenantWorkspaceProfile;
    targetPlanId: SaasPlanId;
    billingCycle: "monthly" | "annual";
    originUrl: string;
  }): BillingCheckoutSession {
    const row = SAAS_PLAN_PRICING_TABLE[params.targetPlanId];
    const totalWithTax = params.billingCycle === "annual" ? row.annualEur : row.monthlyEur;
    const checkoutSessionId = `cs_live_${Date.now()}_${params.tenant.slug}`;
    return {
      provider: "stripe_global",
      checkoutSessionId,
      checkoutUrl: `${params.originUrl}/${params.tenant.slug}/admin?billing_checkout=${checkoutSessionId}&provider=stripe`,
      tenantId: params.tenant.tenantId,
      targetPlanId: params.targetPlanId,
      billingCycle: params.billingCycle,
      currency: "EUR",
      totalWithTax,
      createdAt: new Date().toISOString(),
    };
  }

  signWebhookPayload(rawBody: string, timestampSec = Math.floor(Date.now() / 1000)): string {
    const v1 = crypto
      .createHmac("sha256", this.webhookSecret)
      .update(`${timestampSec}.${rawBody}`, "utf8")
      .digest("hex");
    return `t=${timestampSec},v1=${v1}`;
  }

  verifyWebhookSignature(rawBody: string, signatureHeader: string): boolean {
    const parts = Object.fromEntries(
      signatureHeader.split(",").map((kv) => {
        const idx = kv.indexOf("=");
        return idx > 0 ? [kv.slice(0, idx).trim(), kv.slice(idx + 1).trim()] : ["", ""];
      })
    );
    if (!parts.t || !parts.v1) return false;
    const expectedV1 = crypto
      .createHmac("sha256", this.webhookSecret)
      .update(`${parts.t}.${rawBody}`, "utf8")
      .digest("hex");
    try {
      return (
        expectedV1.length === parts.v1.length &&
        crypto.timingSafeEqual(Buffer.from(expectedV1), Buffer.from(parts.v1))
      );
    } catch {
      return false;
    }
  }
}

export function processVerifiedBillingWebhookEvent(event: {
  provider: BillingProviderId;
  eventType:
    | "subscription.activated"
    | "invoice.paid"
    | "invoice.payment_failed"
    | "subscription.canceled";
  tenantId: string;
  planId?: SaasPlanId;
  externalSubscriptionRef?: string;
}): TenantSubscriptionRecord {
  const statusMap: Record<typeof event.eventType, SubscriptionBillingStatus> = {
    "subscription.activated": "active",
    "invoice.paid": "active",
    "invoice.payment_failed": "past_due",
    "subscription.canceled": "canceled",
  };
  const nextStatus = statusMap[event.eventType];
  const updated = updateTenantSubscriptionStatus({
    tenantId: event.tenantId,
    planId: event.planId,
    status: nextStatus,
    provider: event.provider,
    externalSubscriptionRef: event.externalSubscriptionRef,
  });
  recordTenantAuditEvent({
    tenantId: event.tenantId,
    actorUserId: `billing_${event.provider}`,
    actorRole: "platform_admin",
    action: `BILLING_${event.eventType.toUpperCase().replace(/\./g, "_")}`,
    targetType: "subscription",
    targetId: updated.subscriptionId,
    metadata: { planId: updated.planId, status: updated.status },
  });
  return updated;
}
