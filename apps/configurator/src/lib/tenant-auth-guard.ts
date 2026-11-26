import crypto from "crypto";
import {
  flushSaasPersistentLedger,
  readSaasPersistentLedger,
  syncRowToSaasPostgrest,
} from "./saas-persistent-ledger";
import {
  TENANT_BIRIM_ENTERPRISE,
  checkTenantEntitlement,
  getTenantProfileByIdOrSlug,
  hasTenantPermission,
  type SaasPermissionKey,
  type SaasRoleId,
  type TenantEntitlements,
  type TenantWorkspaceProfile,
} from "@birim/core";

export interface TenantSessionClaims {
  tenantId: string;
  tenantSlug: string;
  userId: string;
  role: SaasRoleId;
  branchId?: string | null;
  iat: number;
  exp: number;
}

export interface ResolvedTenantRequestContext {
  authenticated: boolean;
  tenantId: string;
  tenantSlug: string;
  userId: string;
  role: SaasRoleId;
  branchId: string | null;
  profile: TenantWorkspaceProfile;
}

export interface TenantAuditEvent {
  id: string;
  tenantId: string;
  actorUserId: string;
  actorRole: SaasRoleId;
  action: string;
  targetType: string;
  targetId: string;
  metadata: Record<string, unknown>;
  createdAt: string;
}

export class TenantSecurityError extends Error {
  readonly httpStatus: number;
  readonly code: string;

  constructor(code: string, message: string, httpStatus = 403) {
    super(message);
    this.name = "TenantSecurityError";
    this.code = code;
    this.httpStatus = httpStatus;
  }
}

const AUDIT_LOGS_BY_TENANT = new Map<string, TenantAuditEvent[]>();
const RATE_LIMIT_BUCKETS = new Map<string, { count: number; resetAtMs: number }>();

function getSessionSecret(): string {
  const configured =
    process.env.MODUL_SAAS_SESSION_SECRET ||
    process.env.BIRIM_SESSION_HMAC_SECRET ||
    process.env.BIRIM_QUOTE_SIGNING_SECRET;
  if (!configured && process.env.NODE_ENV === "production") {
    throw new TenantSecurityError(
      "SERVER_SECRET_MISSING",
      "Üretim ortamında MODUL_SAAS_SESSION_SECRET tanımlanması zorunludur.",
      503
    );
  }
  return configured || "modul-saas-dev-session-hmac-secret-v1";
}

function toBase64Url(input: string | Buffer): string {
  return Buffer.from(input)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function fromBase64Url(input: string): string {
  const padded = input.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((input.length + 3) % 4);
  return Buffer.from(padded, "base64").toString("utf8");
}

export function signTenantSessionToken(params: {
  tenantId: string;
  userId?: string;
  role?: SaasRoleId;
  branchId?: string | null;
  ttlSeconds?: number;
}): string {
  const profile = getTenantProfileByIdOrSlug(params.tenantId);
  const nowSec = Math.floor(Date.now() / 1000);
  const claims: TenantSessionClaims = {
    tenantId: profile.tenantId,
    tenantSlug: profile.slug,
    userId: params.userId || `usr_${profile.slug}_admin`,
    role: params.role || "org_owner",
    branchId: params.branchId ?? null,
    iat: nowSec,
    exp: nowSec + (params.ttlSeconds ?? 8 * 3600),
  };
  const payloadB64 = toBase64Url(JSON.stringify(claims));
  const sig = toBase64Url(
    crypto.createHmac("sha256", getSessionSecret()).update(payloadB64, "utf8").digest()
  );
  return `mdl_sess_${payloadB64}.${sig}`;
}

export function verifyTenantSessionToken(rawToken: string | null | undefined): TenantSessionClaims | null {
  if (!rawToken || !rawToken.startsWith("mdl_sess_")) return null;
  const body = rawToken.slice("mdl_sess_".length);
  const dotIdx = body.indexOf(".");
  if (dotIdx <= 0) return null;
  const payloadB64 = body.slice(0, dotIdx);
  const providedSig = body.slice(dotIdx + 1);
  const expectedSig = toBase64Url(
    crypto.createHmac("sha256", getSessionSecret()).update(payloadB64, "utf8").digest()
  );
  try {
    if (
      providedSig.length !== expectedSig.length ||
      !crypto.timingSafeEqual(Buffer.from(providedSig), Buffer.from(expectedSig))
    ) {
      return null;
    }
    const claims = JSON.parse(fromBase64Url(payloadB64)) as TenantSessionClaims;
    const nowSec = Math.floor(Date.now() / 1000);
    if (!claims.tenantId || claims.exp < nowSec) return null;
    return claims;
  } catch {
    return null;
  }
}

/**
 * Extracts a trustworthy client IP identifier without falling prey to left-prepended
 * `X-Forwarded-For` spoofing. Prefers edge-terminated headers (`x-vercel-forwarded-for`,
 * `cf-connecting-ip`, `x-real-ip`) and falls back to the rightmost proxy-appended hop
 * of `x-forwarded-for`.
 */
export function resolveTrustedClientIp(req: Pick<Request, "headers">): string {
  const sanitizeIp = (raw: string | null | undefined): string | null => {
    if (!raw) return null;
    const clean = raw.trim().slice(0, 64).replace(/[^a-fA-F0-9.:%_a-zA-Z-]/g, "");
    return clean || null;
  };

  const vercelIp = sanitizeIp(req.headers.get("x-vercel-forwarded-for")?.split(",")[0]);
  if (vercelIp) return vercelIp;

  const cfIp = sanitizeIp(req.headers.get("cf-connecting-ip"));
  if (cfIp) return cfIp;

  const realIp = sanitizeIp(req.headers.get("x-real-ip"));
  if (realIp) return realIp;

  const xff = req.headers.get("x-forwarded-for");
  if (xff) {
    const hops = xff
      .split(",")
      .map((s) => sanitizeIp(s))
      .filter((s): s is string => Boolean(s));
    if (hops.length > 0) {
      return hops[hops.length - 1];
    }
  }

  return "anonymous";
}

function mapLegacySessionRoleToSaasRole(legacyRole?: string | null): SaasRoleId {
  // Security Guard: Never allow unauthenticated callers to self-assign elevated roles
  // in production or when strict unauthenticated role clamping is active.
  if (
    process.env.NODE_ENV === "production" ||
    process.env.MODUL_SAAS_STRICT_UNAUTH_ROLE === "true"
  ) {
    return "readonly_viewer";
  }

  const normalized = (legacyRole || "").trim().toLowerCase();
  if (!normalized) {
    return "org_owner";
  }
  switch (normalized) {
    case "owner":
    case "org_owner":
      return "org_owner";
    case "admin":
    case "super_admin":
    case "org_admin":
      return "org_admin";
    case "production_manager":
    case "production_lead":
    case "factory":
      return "production_lead";
    case "architect":
      return "architect";
    case "designer":
      return "designer";
    case "sales_manager":
    case "sales_rep":
    case "sales":
      return "sales_rep";
    case "dealer":
    case "dealer_admin":
      return "dealer_admin";
    case "viewer":
    case "readonly_viewer":
      return "readonly_viewer";
    default:
      return "readonly_viewer";
  }
}

export function extractCookieValue(
  cookieHeader: string | null | undefined,
  cookieName: string
): string | null {
  if (!cookieHeader) return null;
  const parts = cookieHeader.split(";");
  for (const rawPart of parts) {
    const part = rawPart.trim();
    const eqIdx = part.indexOf("=");
    if (eqIdx <= 0) continue;
    const k = part.slice(0, eqIdx).trim();
    if (k === cookieName) {
      try {
        return decodeURIComponent(part.slice(eqIdx + 1).trim());
      } catch {
        return part.slice(eqIdx + 1).trim();
      }
    }
  }
  return null;
}

/**
 * Zero-Trust Multi-Tenant Request Resolver:
 * 1. If a signed `x-modul-session-token`, `Authorization: Bearer mdl_sess_...`, or `modul_session` cookie
 *    is supplied, `tenantId` & `role` come EXCLUSIVELY from the verified cryptographic token, and any
 *    attempt to pass a mismatched `organizationId` / `tenantId` throws `403 TENANT_SPOOFING_BLOCKED`.
 * 2. In `NODE_ENV === "production"` (or when `MODUL_SAAS_REQUIRE_AUTH=true`), unauthenticated requests
 *    are unconditionally rejected with `401 AUTH_SESSION_REQUIRED` (ignoring accidental `MODUL_SAAS_REQUIRE_AUTH=false`
 *    unless `MODUL_UNSAFE_ALLOW_UNAUTH_PROD=true` is explicitly set for isolated local build audits).
 * 3. In local development / automated unit tests without bearer tokens, resolves the tenant profile
 *    while isolating non-Birim tenants from Birim's sibling `.env` files.
 */
export function resolveTenantRequestContext(
  req?: Request | null,
  bodyHint?: {
    organizationId?: string | null;
    tenantId?: string | null;
    branchIdOrCode?: string | null;
    sessionUserId?: string | null;
    sessionRole?: string | null;
  }
): ResolvedTenantRequestContext {
  const authHeader = req?.headers?.get("authorization") || "";
  const bearerToken = authHeader.startsWith("Bearer ") ? authHeader.slice(7).trim() : null;
  const cookieToken = extractCookieValue(req?.headers?.get("cookie"), "modul_session");
  const headerToken = req?.headers?.get("x-modul-session-token") || bearerToken || cookieToken;

  const explicitHeaderOrgId =
    req?.headers?.get("x-modul-tenant-id") ||
    req?.headers?.get("x-birim-org-id");
  const passiveMiddlewareSlug = req?.headers?.get("x-modul-resolved-tenant-slug");
  const explicitRequestedOrgRaw = (
    bodyHint?.tenantId ||
    bodyHint?.organizationId ||
    explicitHeaderOrgId ||
    ""
  ).trim();
  const requestedOrgRaw = explicitRequestedOrgRaw || (passiveMiddlewareSlug || "").trim();

  if (headerToken) {
    const claims = verifyTenantSessionToken(headerToken);
    if (!claims) {
      throw new TenantSecurityError(
        "INVALID_SESSION_TOKEN",
        "Geçersiz veya süresi dolmuş Modül SaaS oturum jetonu.",
        401
      );
    }
    const profile = getTenantProfileByIdOrSlug(claims.tenantId);
    if (explicitRequestedOrgRaw) {
      const requestedProfile = getTenantProfileByIdOrSlug(explicitRequestedOrgRaw);
      const exactMatch =
        explicitRequestedOrgRaw.toLowerCase() === claims.tenantId.toLowerCase() ||
        explicitRequestedOrgRaw.toLowerCase() === claims.tenantSlug.toLowerCase() ||
        (requestedProfile.tenantId === claims.tenantId &&
          (explicitRequestedOrgRaw.toLowerCase() === requestedProfile.slug.toLowerCase() ||
            explicitRequestedOrgRaw.toLowerCase() === requestedProfile.tenantId.toLowerCase()));
      if (!exactMatch) {
        recordTenantAuditEvent({
          tenantId: claims.tenantId,
          actorUserId: claims.userId,
          actorRole: claims.role,
          action: "SECURITY_CROSS_TENANT_SPOOF_BLOCKED",
          targetType: "organization",
          targetId: explicitRequestedOrgRaw,
          metadata: { sessionTenantId: claims.tenantId, spoofedTarget: explicitRequestedOrgRaw },
        });
        throw new TenantSecurityError(
          "TENANT_SPOOFING_BLOCKED",
          `[ZERO-TRUST İZOLASYON KİLİDİ] Oturum organizasyonu (${claims.tenantId}) dışındaki başka bir organizasyona (${explicitRequestedOrgRaw}) erişim veya yazma girişimi engellendi.`,
          403
        );
      }
    }
    return {
      authenticated: true,
      tenantId: profile.tenantId,
      tenantSlug: profile.slug,
      userId: claims.userId,
      role: claims.role,
      branchId: claims.branchId ?? bodyHint?.branchIdOrCode ?? null,
      profile,
    };
  }

  const isProdStrict =
    process.env.NODE_ENV === "production" &&
    process.env.MODUL_UNSAFE_ALLOW_UNAUTH_PROD !== "true";
  const requireAuth =
    process.env.MODUL_SAAS_REQUIRE_AUTH === "true" || isProdStrict;
  if (requireAuth) {
    throw new TenantSecurityError(
      "AUTH_SESSION_REQUIRED",
      "Bu SaaS uç noktası için doğrulanmış organizasyon oturumu gereklidir.",
      401
    );
  }

  const fallbackTarget =
    requestedOrgRaw ||
    process.env.BIRIM_DEFAULT_ORG_ID ||
    TENANT_BIRIM_ENTERPRISE.tenantId;
  const knownProfile = getTenantProfileByIdOrSlug(fallbackTarget);
  const resolvedTenantId =
    knownProfile.tenantId !== TENANT_BIRIM_ENTERPRISE.tenantId ||
    fallbackTarget.toLowerCase() === "birim" ||
    fallbackTarget === TENANT_BIRIM_ENTERPRISE.tenantId
      ? knownProfile.tenantId
      : fallbackTarget;

  const finalProfile: TenantWorkspaceProfile =
    resolvedTenantId === knownProfile.tenantId
      ? knownProfile
      : {
          ...structuredClone(knownProfile),
          tenantId: resolvedTenantId,
        };

  return {
    authenticated: false,
    tenantId: resolvedTenantId,
    tenantSlug: finalProfile.slug,
    userId: bodyHint?.sessionUserId || "local-dev-operator",
    role: mapLegacySessionRoleToSaasRole(bodyHint?.sessionRole),
    branchId: bodyHint?.branchIdOrCode ?? null,
    profile: finalProfile,
  };
}

export function assertTenantPermissionAndEntitlement(
  ctx: ResolvedTenantRequestContext,
  permission: SaasPermissionKey,
  entitlementFeature?: keyof Pick<
    TenantEntitlements,
    | "allowCustomTemplates"
    | "allowBomExport"
    | "allowCncExport"
    | "allowErpIntegration"
    | "allowCustomDomain"
    | "allowWhiteLabelEmbed"
    | "allowDealerHierarchy"
  >
): void {
  if (ctx.profile.status === "suspended") {
    throw new TenantSecurityError(
      "TENANT_SUSPENDED",
      `Organizasyon hesabı (${ctx.profile.brand.legalName}) askıya alınmış durumda.`,
      403
    );
  }
  if (!hasTenantPermission(ctx.role, permission)) {
    throw new TenantSecurityError(
      "RBAC_PERMISSION_DENIED",
      `'${ctx.role}' rolü '${permission}' işlemi için yetkili değildir.`,
      403
    );
  }
  if (entitlementFeature) {
    const check = checkTenantEntitlement(ctx.profile, entitlementFeature);
    if (!check.allowed) {
      throw new TenantSecurityError(
        "PLAN_ENTITLEMENT_LOCKED",
        check.reasonTr || `Mevcut abonelik paketiniz (${ctx.profile.planId}) bu özelliği kapsamamaktadır.`,
        403
      );
    }
  }
}

const MAX_RATE_LIMIT_BUCKETS = 4096;
let rateLimitHydratedFromLedger = false;

function hydrateRateLimitBucketsFromLedgerOnce(): void {
  if (rateLimitHydratedFromLedger) return;
  rateLimitHydratedFromLedger = true;
  try {
    const ledger = readSaasPersistentLedger() as unknown as {
      rateLimitBuckets?: Record<string, { count: number; resetAtMs: number }>;
    };
    const saved = ledger.rateLimitBuckets;
    if (!saved || typeof saved !== "object") return;
    const now = Date.now();
    for (const [k, v] of Object.entries(saved)) {
      if (v && typeof v.count === "number" && typeof v.resetAtMs === "number" && v.resetAtMs > now) {
        RATE_LIMIT_BUCKETS.set(k, { count: v.count, resetAtMs: v.resetAtMs });
      }
    }
  } catch {
    // Non-fatal
  }
}

function persistRateLimitBucketToLedger(key: string, bucket: { count: number; resetAtMs: number }): void {
  try {
    const ledger = readSaasPersistentLedger() as unknown as {
      rateLimitBuckets?: Record<string, { count: number; resetAtMs: number }>;
    };
    if (!ledger.rateLimitBuckets) {
      ledger.rateLimitBuckets = {};
    }
    ledger.rateLimitBuckets[key] = bucket;
    // Periodically prune expired keys in ledger snapshot
    const entries = Object.entries(ledger.rateLimitBuckets);
    if (entries.length > 512) {
      const now = Date.now();
      for (const [k, v] of entries) {
        if (!v || v.resetAtMs <= now) delete ledger.rateLimitBuckets[k];
      }
    }
    flushSaasPersistentLedger();
  } catch {
    // Non-fatal on read-only containers
  }
}

export function resetTenantRateLimitBucketsForTests(): void {
  RATE_LIMIT_BUCKETS.clear();
}

export function checkTenantRateLimit(
  tenantId: string,
  bucketName: string,
  maxRequestsPerMinute = 120
): void {
  hydrateRateLimitBucketsFromLedgerOnce();
  const now = Date.now();
  if (RATE_LIMIT_BUCKETS.size > MAX_RATE_LIMIT_BUCKETS) {
    for (const [k, v] of RATE_LIMIT_BUCKETS.entries()) {
      if (now >= v.resetAtMs) RATE_LIMIT_BUCKETS.delete(k);
    }
    if (RATE_LIMIT_BUCKETS.size > MAX_RATE_LIMIT_BUCKETS) {
      const oldestKey = RATE_LIMIT_BUCKETS.keys().next().value;
      if (oldestKey) RATE_LIMIT_BUCKETS.delete(oldestKey);
    }
  }
  const key = `${tenantId}:${bucketName}`;
  const entry = RATE_LIMIT_BUCKETS.get(key);
  if (!entry || now >= entry.resetAtMs) {
    const fresh = { count: 1, resetAtMs: now + 60_000 };
    RATE_LIMIT_BUCKETS.set(key, fresh);
    persistRateLimitBucketToLedger(key, fresh);
    return;
  }
  entry.count += 1;
  persistRateLimitBucketToLedger(key, entry);
  if (entry.count > maxRequestsPerMinute) {
    throw new TenantSecurityError(
      "RATE_LIMIT_EXCEEDED",
      `Organizasyon istek limiti (${maxRequestsPerMinute}/dk) aşıldı; lütfen kısa süre sonra tekrar deneyin.`,
      429
    );
  }
}

export function recordTenantAuditEvent(params: {
  tenantId: string;
  actorUserId: string;
  actorRole: SaasRoleId;
  action: string;
  targetType: string;
  targetId: string;
  metadata?: Record<string, unknown>;
}): TenantAuditEvent {
  const event: TenantAuditEvent = {
    id: `aud_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    tenantId: params.tenantId,
    actorUserId: params.actorUserId,
    actorRole: params.actorRole,
    action: params.action,
    targetType: params.targetType,
    targetId: params.targetId,
    metadata: params.metadata || {},
    createdAt: new Date().toISOString(),
  };
  const ledger = readSaasPersistentLedger();
  const persisted = (ledger.auditLogsByTenant[params.tenantId] as TenantAuditEvent[] | undefined) || [];
  const merged = [event, ...(AUDIT_LOGS_BY_TENANT.get(params.tenantId) || persisted)];
  const deduped = Array.from(new Map(merged.map((x) => [x.id, x])).values()).slice(0, 200);
  AUDIT_LOGS_BY_TENANT.set(params.tenantId, deduped);
  ledger.auditLogsByTenant[params.tenantId] = deduped;
  flushSaasPersistentLedger();

  void syncRowToSaasPostgrest("modul_audit_logs", params.tenantId, {
    tenant_id: params.tenantId,
    actor_role: params.actorRole,
    action: params.action,
    target_type: params.targetType,
    target_id: params.targetId,
    metadata: params.metadata || {},
  });
  return event;
}

export function listTenantAuditEvents(tenantId: string): TenantAuditEvent[] {
  const mem = AUDIT_LOGS_BY_TENANT.get(tenantId);
  if (mem && mem.length > 0) return [...mem];
  const ledger = readSaasPersistentLedger();
  const fromDisk = (ledger.auditLogsByTenant[tenantId] as TenantAuditEvent[] | undefined) || [];
  return [...fromDisk];
}
