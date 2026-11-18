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
    process.env.BIRIM_QUOTE_SIGNING_SECRET;
  if (!configured && process.env.NODE_ENV === "production") {
    throw new TenantSecurityError(
      "SERVER_SECRET_MISSING",
      "Üretim ortamında MODUL_SAAS_SESSION_SECRET tanımlanması zorunludur.",
      500
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

function mapLegacySessionRoleToSaasRole(legacyRole?: string | null): SaasRoleId {
  switch ((legacyRole || "").toLowerCase()) {
    case "admin":
    case "super_admin":
      return "org_admin";
    case "production_manager":
    case "factory":
      return "production_lead";
    case "sales_manager":
    case "sales":
      return "sales_rep";
    case "dealer":
      return "dealer_admin";
    case "viewer":
      return "readonly_viewer";
    default:
      return "org_owner";
  }
}

/**
 * Zero-Trust Multi-Tenant Request Resolver:
 * 1. If a signed `x-modul-session-token` or `Authorization: Bearer mdl_sess_...` is supplied,
 *    the tenantId & role come EXCLUSIVELY from the verified cryptographic token, and any attempt
 *    to pass a mismatched `organizationId` / `tenantId` in headers or JSON body throws `403 TENANT_SPOOFING_BLOCKED`.
 * 2. When `MODUL_SAAS_REQUIRE_AUTH=true` in production SaaS deployments, unauthenticated requests are rejected with `401`.
 * 3. In local development / legacy Birim single-tenant RPC tests without bearer tokens, gracefully resolves the tenant
 *    profile while isolating non-Birim tenants from Birim's sibling `.env` files.
 */
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

export function resolveTenantRequestContext(
  req: Request,
  bodyHint?: {
    organizationId?: string | null;
    tenantId?: string | null;
    branchIdOrCode?: string | null;
    sessionUserId?: string | null;
    sessionRole?: string | null;
  }
): ResolvedTenantRequestContext {
  const authHeader = req.headers.get("authorization") || "";
  const bearerToken = authHeader.startsWith("Bearer ") ? authHeader.slice(7).trim() : null;
  const cookieToken = extractCookieValue(req.headers.get("cookie"), "modul_session");
  const headerToken = req.headers.get("x-modul-session-token") || bearerToken || cookieToken;

  const explicitHeaderOrgId =
    req.headers.get("x-modul-tenant-id") ||
    req.headers.get("x-birim-org-id");
  const passiveMiddlewareSlug = req.headers.get("x-modul-resolved-tenant-slug");
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

  if (process.env.MODUL_SAAS_REQUIRE_AUTH === "true") {
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

export function checkTenantRateLimit(
  tenantId: string,
  bucketName: string,
  maxRequestsPerMinute = 120
): void {
  const now = Date.now();
  const key = `${tenantId}:${bucketName}`;
  const entry = RATE_LIMIT_BUCKETS.get(key);
  if (!entry || now >= entry.resetAtMs) {
    RATE_LIMIT_BUCKETS.set(key, { count: 1, resetAtMs: now + 60_000 });
    return;
  }
  entry.count += 1;
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
