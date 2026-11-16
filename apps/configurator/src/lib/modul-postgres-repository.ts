import crypto from "crypto";
import {
  BUILTIN_SAAS_TENANTS,
  TENANT_BIRIM_ENTERPRISE,
  getTenantProfileByIdOrSlug,
  registerOrUpdateTenantProfile,
  type BackPanelMountingMode,
  type CncMachineFormatId,
  type ConnectorSystemType,
  type DesignProject,
  type SaasPlanId,
  type SaasRoleId,
  type TenantWorkspaceProfile,
} from "@birim/core";
import { TenantSecurityError, recordTenantAuditEvent } from "./tenant-auth-guard";
import {
  consumeTenantUsageQuota,
  updateTenantSubscriptionStatus,
} from "./saas-billing-and-metering";

export interface SaasUserAccount {
  id: string;
  email: string;
  fullName: string;
  passwordSaltHex: string;
  passwordHashHex: string;
  isPlatformSuperAdmin?: boolean;
  createdAt: string;
}

export interface SaasOrganizationMembership {
  id: string;
  tenantId: string;
  userId: string;
  userEmail: string;
  userFullName: string;
  role: SaasRoleId;
  branchCode?: string | null;
  isActive: boolean;
  createdAt: string;
}

export interface SaasMemberInvitation {
  inviteToken: string;
  tenantId: string;
  invitedEmail: string;
  role: SaasRoleId;
  invitedByUserId: string;
  expiresAt: string;
  acceptedAt?: string | null;
}

export interface CloudProjectRecord {
  id: string;
  tenantId: string;
  ownerUserId: string;
  title: string;
  customerName?: string;
  status: DesignProject["status"];
  latestVersion: number;
  createdAt: string;
  updatedAt: string;
}

export interface CloudProjectVersionRecord {
  id: string;
  tenantId: string;
  projectId: string;
  versionNo: number;
  isOrderLocked: boolean;
  designDocument: DesignProject;
  pricingSnapshot: Record<string, unknown>;
  createdAt: string;
}

const UUID_V4_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function toDeterministicPostgresUuid(rawId: string, namespace = "modul"): string {
  const trimmed = (rawId || "").trim();
  if (UUID_V4_REGEX.test(trimmed)) return trimmed.toLowerCase();
  const hex = crypto.createHash("sha256").update(`${namespace}:${trimmed}`, "utf8").digest("hex");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-4${hex.slice(13, 16)}-a${hex.slice(17, 20)}-${hex.slice(20, 32)}`;
}

function hashPasswordScrypt(password: string, saltHex?: string): { saltHex: string; hashHex: string } {
  const salt = saltHex || crypto.randomBytes(16).toString("hex");
  const derived = crypto.scryptSync(password, salt, 64).toString("hex");
  return { saltHex: salt, hashHex: derived };
}

function verifyPasswordScrypt(password: string, saltHex: string, expectedHashHex: string): boolean {
  const { hashHex } = hashPasswordScrypt(password, saltHex);
  try {
    return crypto.timingSafeEqual(Buffer.from(hashHex, "hex"), Buffer.from(expectedHashHex, "hex"));
  } catch {
    return false;
  }
}

const USERS_BY_EMAIL = new Map<string, SaasUserAccount>();
const MEMBERSHIPS_BY_TENANT = new Map<string, SaasOrganizationMembership[]>();
const INVITES_BY_TOKEN = new Map<string, SaasMemberInvitation>();
const PROJECTS_BY_TENANT = new Map<string, CloudProjectRecord[]>();
const VERSIONS_BY_TENANT_PROJECT = new Map<string, CloudProjectVersionRecord[]>();

function seedInitialAccountsOnce(): void {
  if (USERS_BY_EMAIL.size > 0) return;

  const birimAdminPwd = hashPasswordScrypt("Birim2026!");
  const birimOwner: SaasUserAccount = {
    id: "00000000-0000-4000-8000-000000000001",
    email: "info@birim.com",
    fullName: "Birim Platform & Organizasyon Yöneticisi",
    passwordSaltHex: birimAdminPwd.saltHex,
    passwordHashHex: birimAdminPwd.hashHex,
    isPlatformSuperAdmin: true,
    createdAt: new Date().toISOString(),
  };
  USERS_BY_EMAIL.set(birimOwner.email, birimOwner);

  const ankaPwd = hashPasswordScrypt("Anka2026!");
  const ankaOwner: SaasUserAccount = {
    id: "00000000-0000-4000-8000-000000000002",
    email: "teknik@ankamutfak.com.tr",
    fullName: "Anka Mutfak Üretim Yöneticisi",
    passwordSaltHex: ankaPwd.saltHex,
    passwordHashHex: ankaPwd.hashHex,
    createdAt: new Date().toISOString(),
  };
  USERS_BY_EMAIL.set(ankaOwner.email, ankaOwner);

  for (const t of BUILTIN_SAAS_TENANTS) {
    const owner = t.slug === "anka" ? ankaOwner : birimOwner;
    MEMBERSHIPS_BY_TENANT.set(t.tenantId, [
      {
        id: `mem_${t.slug}_owner`,
        tenantId: t.tenantId,
        userId: owner.id,
        userEmail: owner.email,
        userFullName: owner.fullName,
        role: t.slug === "birim" ? "org_owner" : "org_owner",
        branchCode: "HQ",
        isActive: true,
        createdAt: new Date().toISOString(),
      },
    ]);
  }
}
seedInitialAccountsOnce();

export class ModulPostgresRepository {
  private get supabaseUrl(): string {
    return (process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || "").replace(/\/+$/, "");
  }

  private get serviceRoleKey(): string {
    return (process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || "").trim();
  }

  isLivePostgrestConfigured(): boolean {
    const url = this.supabaseUrl;
    if (!url || !this.serviceRoleKey) return false;
    // Production safety lock on Birim live DB unless explicitly enabled
    if (url.includes("qchmdyiakmrfyvphbbok") && process.env.MODUL_ALLOW_LIVE_SAAS_POSTGREST !== "true") {
      return false;
    }
    return true;
  }

  private async postgrestRequest<T>(
    tablePath: string,
    tenantId: string,
    init: RequestInit
  ): Promise<T | null> {
    if (!this.isLivePostgrestConfigured()) return null;
    const res = await fetch(`${this.supabaseUrl}/rest/v1/${tablePath}`, {
      ...init,
      headers: {
        apikey: this.serviceRoleKey,
        ...(this.serviceRoleKey.startsWith("sb_")
          ? {}
          : { Authorization: `Bearer ${this.serviceRoleKey}` }),
        "Content-Type": "application/json",
        Prefer: "return=representation",
        "x-modul-tenant-id": tenantId,
        ...(init.headers || {}),
      },
    });
    if (!res.ok) return null;
    return (await res.json()) as T;
  }

  authenticateUser(emailRaw: string, password: string): {
    user: Omit<SaasUserAccount, "passwordHashHex" | "passwordSaltHex">;
    memberships: SaasOrganizationMembership[];
  } {
    seedInitialAccountsOnce();
    const email = emailRaw.trim().toLowerCase();
    const acc = USERS_BY_EMAIL.get(email);
    if (!acc || !verifyPasswordScrypt(password, acc.passwordSaltHex, acc.passwordHashHex)) {
      throw new TenantSecurityError(
        "INVALID_CREDENTIALS",
        "E-posta adresi veya parola hatalı.",
        401
      );
    }
    const memberships: SaasOrganizationMembership[] = [];
    for (const list of MEMBERSHIPS_BY_TENANT.values()) {
      for (const m of list) {
        if (m.userId === acc.id && m.isActive) memberships.push({ ...m });
      }
    }
    return {
      user: {
        id: acc.id,
        email: acc.email,
        fullName: acc.fullName,
        isPlatformSuperAdmin: acc.isPlatformSuperAdmin,
        createdAt: acc.createdAt,
      },
      memberships,
    };
  }

  async registerOrganizationAndOwner(params: {
    companyDisplayName: string;
    companyLegalName: string;
    slug: string;
    ownerFullName: string;
    ownerEmail: string;
    password: string;
    planId: SaasPlanId;
    currency: "EUR" | "TRY";
    carcassThicknessMm: number;
    backPanelMounting: BackPanelMountingMode;
    connectorSystem: ConnectorSystemType;
    primaryCncFormat: CncMachineFormatId;
  }): Promise<{
    tenant: TenantWorkspaceProfile;
    owner: Omit<SaasUserAccount, "passwordHashHex" | "passwordSaltHex">;
    membership: SaasOrganizationMembership;
  }> {
    seedInitialAccountsOnce();
    const cleanSlug = params.slug
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9-]/g, "-")
      .replace(/^-+|-+$/g, "");
    if (cleanSlug.length < 2) {
      throw new TenantSecurityError("INVALID_TENANT_SLUG", "Organizasyon kısa adı en az 2 karakter olmalıdır.", 400);
    }
    const existingTenant = getTenantProfileByIdOrSlug(cleanSlug);
    if (existingTenant.slug === cleanSlug && cleanSlug !== "") {
      throw new TenantSecurityError(
        "TENANT_SLUG_TAKEN",
        `'${cleanSlug}' kısa adı başka bir firma tarafından kullanılıyor.`,
        409
      );
    }

    const email = params.ownerEmail.trim().toLowerCase();
    let user = USERS_BY_EMAIL.get(email);
    if (!user) {
      const hashed = hashPasswordScrypt(params.password);
      user = {
        id: crypto.randomUUID(),
        email,
        fullName: params.ownerFullName.trim() || "Firma Kurucusu",
        passwordSaltHex: hashed.saltHex,
        passwordHashHex: hashed.hashHex,
        createdAt: new Date().toISOString(),
      };
      USERS_BY_EMAIL.set(email, user);
    }

    const tenantId = crypto.randomUUID();
    const quotePrefix = cleanSlug.replace(/[^a-z0-9]/gi, "").toUpperCase().slice(0, 3) || "MDL";
    const baseTemplate = structuredClone(TENANT_BIRIM_ENTERPRISE);

    const newTenant: TenantWorkspaceProfile = {
      ...baseTemplate,
      tenantId,
      slug: cleanSlug,
      status: "trialing",
      planId: params.planId,
      integrationMode: "standalone_cloud_inbox",
      brand: {
        displayName: params.companyDisplayName.trim().toUpperCase(),
        legalName: params.companyLegalName.trim() || params.companyDisplayName.trim(),
        logoVariant: "custom_wordmark",
        badgeSubtitle: params.planId.toUpperCase().slice(0, 6),
        primaryColorHex: "#141413",
        accentColorHex: "#0F766E",
        customDomain: `${cleanSlug}.modul.studio`,
        quoteCodePrefix: quotePrefix,
        supportEmail: email,
        defaultCurrency: params.currency,
        defaultDisplayUnit: "cm",
      },
      construction: {
        ...baseTemplate.construction,
        id: `const_${cleanSlug}_default`,
        name: `${params.companyDisplayName} ${params.carcassThicknessMm}mm Standart`,
        defaultCarcassThicknessMm: params.carcassThicknessMm,
        defaultBackThicknessMm: params.backPanelMounting === "surface_nailed_4mm" ? 4 : 8,
        backPanelMounting: params.backPanelMounting,
        connectorSystem: params.connectorSystem,
      },
      machine: {
        ...baseTemplate.machine,
        id: `mach_${cleanSlug}_primary`,
        name: `${params.companyDisplayName} Ana CNC Hattı`,
        primaryCncFormat: params.primaryCncFormat,
      },
      pricing: {
        ...baseTemplate.pricing,
        currency: params.currency,
      },
    };

    registerOrUpdateTenantProfile(newTenant);
    updateTenantSubscriptionStatus({
      tenantId,
      planId: params.planId,
      status: "trialing",
      provider: params.currency === "TRY" ? "iyzico_tr" : "stripe_global",
    });

    const membership: SaasOrganizationMembership = {
      id: `mem_${cleanSlug}_${Date.now()}`,
      tenantId,
      userId: user.id,
      userEmail: user.email,
      userFullName: user.fullName,
      role: "org_owner",
      branchCode: "HQ",
      isActive: true,
      createdAt: new Date().toISOString(),
    };
    MEMBERSHIPS_BY_TENANT.set(tenantId, [membership]);

    await this.postgrestRequest("modul_organizations", tenantId, {
      method: "POST",
      body: JSON.stringify({
        id: tenantId,
        slug: cleanSlug,
        display_name: newTenant.brand.displayName,
        legal_name: newTenant.brand.legalName,
        status: "trialing",
        plan_id: params.planId,
        quote_code_prefix: quotePrefix,
      }),
    });

    recordTenantAuditEvent({
      tenantId,
      actorUserId: user.id,
      actorRole: "org_owner",
      action: "TENANT_SELF_SERVICE_ONBOARDED",
      targetType: "organization",
      targetId: tenantId,
      metadata: { slug: cleanSlug, planId: params.planId },
    });

    return {
      tenant: newTenant,
      owner: {
        id: user.id,
        email: user.email,
        fullName: user.fullName,
        createdAt: user.createdAt,
      },
      membership,
    };
  }

  listOrganizationMembers(tenantId: string): SaasOrganizationMembership[] {
    seedInitialAccountsOnce();
    return [...(MEMBERSHIPS_BY_TENANT.get(tenantId) || [])];
  }

  createMemberInvitation(params: {
    tenantId: string;
    invitedEmail: string;
    role: SaasRoleId;
    invitedByUserId: string;
  }): SaasMemberInvitation {
    const token = `inv_${crypto.randomBytes(12).toString("hex")}`;
    const inv: SaasMemberInvitation = {
      inviteToken: token,
      tenantId: params.tenantId,
      invitedEmail: params.invitedEmail.trim().toLowerCase(),
      role: params.role,
      invitedByUserId: params.invitedByUserId,
      expiresAt: new Date(Date.now() + 7 * 86400_000).toISOString(),
      acceptedAt: null,
    };
    INVITES_BY_TOKEN.set(token, inv);
    return { ...inv };
  }

  acceptMemberInvitation(params: {
    inviteToken: string;
    fullName: string;
    password: string;
  }): SaasOrganizationMembership {
    const inv = INVITES_BY_TOKEN.get(params.inviteToken);
    if (!inv || inv.acceptedAt || Date.parse(inv.expiresAt) < Date.now()) {
      throw new TenantSecurityError("INVALID_INVITE_TOKEN", "Davet bağlantısı geçersiz veya süresi dolmuş.", 400);
    }
    let user = USERS_BY_EMAIL.get(inv.invitedEmail);
    if (!user) {
      const hashed = hashPasswordScrypt(params.password);
      user = {
        id: crypto.randomUUID(),
        email: inv.invitedEmail,
        fullName: params.fullName.trim() || inv.invitedEmail,
        passwordSaltHex: hashed.saltHex,
        passwordHashHex: hashed.hashHex,
        createdAt: new Date().toISOString(),
      };
      USERS_BY_EMAIL.set(user.email, user);
    }
    inv.acceptedAt = new Date().toISOString();
    const list = MEMBERSHIPS_BY_TENANT.get(inv.tenantId) || [];
    const membership: SaasOrganizationMembership = {
      id: `mem_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      tenantId: inv.tenantId,
      userId: user.id,
      userEmail: user.email,
      userFullName: user.fullName,
      role: inv.role,
      branchCode: "HQ",
      isActive: true,
      createdAt: new Date().toISOString(),
    };
    list.push(membership);
    MEMBERSHIPS_BY_TENANT.set(inv.tenantId, list);
    return { ...membership };
  }

  async saveProjectVersion(params: {
    tenantId: string;
    actorUserId: string;
    project: DesignProject;
    pricingSnapshot?: Record<string, unknown>;
    lockAsOrder?: boolean;
    overwriteVersionNo?: number;
  }): Promise<{ projectRecord: CloudProjectRecord; versionRecord: CloudProjectVersionRecord }> {
    const profile = getTenantProfileByIdOrSlug(params.tenantId);
    const tenantProjects = PROJECTS_BY_TENANT.get(params.tenantId) || [];
    let projRec = tenantProjects.find((p) => p.id === params.project.id);

    if (!projRec) {
      consumeTenantUsageQuota(params.tenantId, profile, "active_projects", 1, `proj_${params.project.id}`);
      projRec = {
        id: params.project.id,
        tenantId: params.tenantId,
        ownerUserId: params.actorUserId,
        title: params.project.title,
        customerName: params.project.customerName,
        status: params.lockAsOrder ? "production_approved" : params.project.status,
        latestVersion: 0,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      tenantProjects.unshift(projRec);
      PROJECTS_BY_TENANT.set(params.tenantId, tenantProjects);
    }

    const verKey = `${params.tenantId}:${params.project.id}`;
    const versions = VERSIONS_BY_TENANT_PROJECT.get(verKey) || [];

    if (typeof params.overwriteVersionNo === "number") {
      const existingVer = versions.find((v) => v.versionNo === params.overwriteVersionNo);
      if (existingVer?.isOrderLocked) {
        throw new TenantSecurityError(
          "ORDER_SNAPSHOT_IMMUTABLE",
          "Siparişe dönüşmüş ve kilitlenmiş proje versiyonu (is_order_locked=true) değiştirilemez veya silinemez.",
          409
        );
      }
    }

    const nextVerNo = params.overwriteVersionNo ?? projRec.latestVersion + 1;
    projRec.latestVersion = Math.max(projRec.latestVersion, nextVerNo);
    projRec.title = params.project.title;
    projRec.updatedAt = new Date().toISOString();
    if (params.lockAsOrder) {
      projRec.status = "production_approved";
    }

    const versionRecord: CloudProjectVersionRecord = {
      id: `pver_${params.project.id}_v${nextVerNo}`,
      tenantId: params.tenantId,
      projectId: params.project.id,
      versionNo: nextVerNo,
      isOrderLocked: Boolean(params.lockAsOrder),
      designDocument: { ...structuredClone(params.project), tenantId: params.tenantId, version: nextVerNo },
      pricingSnapshot: params.pricingSnapshot || {},
      createdAt: new Date().toISOString(),
    };

    const filtered = versions.filter((v) => v.versionNo !== nextVerNo);
    filtered.unshift(versionRecord);
    VERSIONS_BY_TENANT_PROJECT.set(verKey, filtered);

    const pgProjectUuid = toDeterministicPostgresUuid(params.project.id, params.tenantId);
    await this.postgrestRequest("modul_projects?on_conflict=tenant_id,id", params.tenantId, {
      method: "POST",
      headers: { Prefer: "resolution=merge-duplicates,return=representation" },
      body: JSON.stringify({
        id: pgProjectUuid,
        tenant_id: params.tenantId,
        title: projRec.title,
        customer_name: projRec.customerName || null,
        status: projRec.status,
        latest_version: projRec.latestVersion,
      }),
    });

    await this.postgrestRequest("modul_project_versions?on_conflict=tenant_id,project_id,version_no", params.tenantId, {
      method: "POST",
      headers: { Prefer: "resolution=merge-duplicates,return=representation" },
      body: JSON.stringify({
        tenant_id: params.tenantId,
        project_id: pgProjectUuid,
        version_no: nextVerNo,
        is_order_locked: Boolean(params.lockAsOrder),
        design_document: versionRecord.designDocument,
        pricing_snapshot: versionRecord.pricingSnapshot,
      }),
    });

    return { projectRecord: { ...projRec }, versionRecord: { ...versionRecord } };
  }

  listTenantProjects(tenantId: string): CloudProjectRecord[] {
    return [...(PROJECTS_BY_TENANT.get(tenantId) || [])];
  }

  listProjectVersions(tenantId: string, projectId: string): CloudProjectVersionRecord[] {
    return [...(VERSIONS_BY_TENANT_PROJECT.get(`${tenantId}:${projectId}`) || [])];
  }

  deleteProjectVersion(tenantId: string, projectId: string, versionNo: number): boolean {
    const verKey = `${tenantId}:${projectId}`;
    const versions = VERSIONS_BY_TENANT_PROJECT.get(verKey) || [];
    const target = versions.find((v) => v.versionNo === versionNo);
    if (!target) return false;
    if (target.isOrderLocked) {
      throw new TenantSecurityError(
        "ORDER_SNAPSHOT_IMMUTABLE",
        "Siparişe dönüşmüş proje versiyonu silinemez.",
        409
      );
    }
    VERSIONS_BY_TENANT_PROJECT.set(
      verKey,
      versions.filter((v) => v.versionNo !== versionNo)
    );
    return true;
  }
}

export const modulPostgresRepo = new ModulPostgresRepository();
