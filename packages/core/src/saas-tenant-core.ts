import type { CarcassJoineryTopology, ModuleInstance, PlinthConstructionType } from "./types";

export type SaasPlanId = "starter" | "professional" | "business" | "enterprise";

export type SaasRoleId =
  | "platform_admin"
  | "org_owner"
  | "org_admin"
  | "production_lead"
  | "architect"
  | "designer"
  | "sales_rep"
  | "dealer_admin"
  | "dealer_staff"
  | "external_guest"
  | "readonly_viewer";

export type SaasPermissionKey =
  | "project:read"
  | "project:write"
  | "quote:create"
  | "quote:approve_order"
  | "pricing:view_factory_cost"
  | "pricing:manage_rules"
  | "catalog:manage_templates"
  | "manufacturing:export_bom"
  | "manufacturing:export_cnc"
  | "erp:publish_production"
  | "tenant:manage_members"
  | "tenant:manage_settings"
  | "platform:manage_tenants";

export type ConnectorSystemType = "minifix_dowel" | "lamello_cabineo" | "confirmat";

export type BackPanelMountingMode = "grooved_8mm" | "rabbeted_8mm" | "surface_nailed_4mm";

export type CncMachineFormatId = "homag_mpr" | "biesse_cix" | "scm_xcs" | "iso_gcode";

export type TenantIntegrationMode =
  | "birim_store_portal_rpc"
  | "webhook_rest_erp"
  | "standalone_cloud_inbox";

export interface TenantBrandTheme {
  displayName: string;
  legalName: string;
  logoVariant: "birim_authentic" | "custom_wordmark";
  badgeSubtitle: string;
  primaryColorHex: string;
  accentColorHex: string;
  customDomain: string;
  quoteCodePrefix: string;
  supportEmail: string;
  defaultCurrency: "EUR" | "TRY" | "USD";
  defaultDisplayUnit: "mm" | "cm";
}

export interface ConstructionRuleProfile {
  id: string;
  name: string;
  defaultCarcassThicknessMm: number;
  allowedPanelThicknessesMm: number[];
  defaultBackThicknessMm: number;
  backPanelMounting: BackPanelMountingMode;
  defaultJoineryTopology: CarcassJoineryTopology;
  connectorSystem: ConnectorSystemType;
  defaultPlinthHeightMm: number;
  defaultPlinthConstruction: PlinthConstructionType;
  standardSheetLengthMm: number;
  standardSheetWidthMm: number;
  allowJumboSheet3660: boolean;
  sawKerfMm: number;
  edgeTrimMarginMm: number;
  preMillingEdgeDeduction: boolean;
}

export interface TenantMachineProfile {
  id: string;
  name: string;
  primaryCncFormat: CncMachineFormatId;
  barcodeLabelFormat: "zebra_zpl" | "thermal_html";
  toolNumbers: {
    system32Dia5: number;
    dowelDia8: number;
    minifixCamDia15: number;
    cabineoPocketDia15: number;
    hingeCupDia35: number;
    backGrooveSaw: number;
  };
}

export interface TenantPricingPolicy {
  wasteFactorPercent: number;
  laborRatePerHourEur: number;
  estimatedHoursPerM2: number;
  operationalOverheadPercent: number;
  assemblyCostEur: number;
  perModuleInstallEur: number;
  deliveryBaseEur: number;
  cncCostPerHoleEur: number;
  packagingCostEur: number;
  targetMarginPercent: number;
  dealerDiscountPercent: number;
  maxSalesRepDiscountPercent: number;
  vatRatePercent: number;
  minSpecialDecorBoardFraction: number;
  lacquerPaintshopMatteEurPerM2: number;
  lacquerPaintshopGlossEurPerM2: number;
  miter45LinearMeterEur: number;
  currency: "EUR" | "TRY";
  eurTryExchangeRate: number;
  stockedMaterialIds: string[];
}

export interface TenantEntitlements {
  planId: SaasPlanId;
  planNameTr: string;
  maxUsers: number;
  maxActiveProjects: number;
  monthlyCloudRenderCredits: number;
  monthlyCamExports: number;
  storageQuotaGb: number;
  allowCustomTemplates: boolean;
  allowBomExport: boolean;
  allowCncExport: boolean;
  allowErpIntegration: boolean;
  allowCustomDomain: boolean;
  allowWhiteLabelEmbed: boolean;
  allowDealerHierarchy: boolean;
}

export interface TenantWorkspaceProfile {
  tenantId: string;
  slug: string;
  status: "active" | "trialing" | "past_due_grace" | "suspended";
  planId: SaasPlanId;
  integrationMode: TenantIntegrationMode;
  webhookEndpointUrl?: string;
  brand: TenantBrandTheme;
  construction: ConstructionRuleProfile;
  machine: TenantMachineProfile;
  pricing: TenantPricingPolicy;
}

export const PLAN_ENTITLEMENTS_MATRIX: Record<SaasPlanId, TenantEntitlements> = {
  starter: {
    planId: "starter",
    planNameTr: "Starter (Bireysel)",
    maxUsers: 1,
    maxActiveProjects: 15,
    monthlyCloudRenderCredits: 5,
    monthlyCamExports: 0,
    storageQuotaGb: 2,
    allowCustomTemplates: false,
    allowBomExport: true,
    allowCncExport: false,
    allowErpIntegration: false,
    allowCustomDomain: false,
    allowWhiteLabelEmbed: false,
    allowDealerHierarchy: false,
  },
  professional: {
    planId: "professional",
    planNameTr: "Professional (Mimarlık Ofisi)",
    maxUsers: 5,
    maxActiveProjects: 250,
    monthlyCloudRenderCredits: 50,
    monthlyCamExports: 0,
    storageQuotaGb: 25,
    allowCustomTemplates: true,
    allowBomExport: true,
    allowCncExport: false,
    allowErpIntegration: false,
    allowCustomDomain: false,
    allowWhiteLabelEmbed: false,
    allowDealerHierarchy: false,
  },
  business: {
    planId: "business",
    planNameTr: "Business (Mobilya Üreticisi)",
    maxUsers: 20,
    maxActiveProjects: 2000,
    monthlyCloudRenderCredits: 200,
    monthlyCamExports: 300,
    storageQuotaGb: 100,
    allowCustomTemplates: true,
    allowBomExport: true,
    allowCncExport: true,
    allowErpIntegration: true,
    allowCustomDomain: true,
    allowWhiteLabelEmbed: true,
    allowDealerHierarchy: true,
  },
  enterprise: {
    planId: "enterprise",
    planNameTr: "Enterprise (Kurumsal Fabrika & Bayi Ağı)",
    maxUsers: 500,
    maxActiveProjects: 50000,
    monthlyCloudRenderCredits: 2500,
    monthlyCamExports: 10000,
    storageQuotaGb: 1024,
    allowCustomTemplates: true,
    allowBomExport: true,
    allowCncExport: true,
    allowErpIntegration: true,
    allowCustomDomain: true,
    allowWhiteLabelEmbed: true,
    allowDealerHierarchy: true,
  },
};

const ROLE_PERMISSION_MAP: Record<SaasRoleId, ReadonlySet<SaasPermissionKey>> = {
  platform_admin: new Set([
    "platform:manage_tenants",
    "project:read",
  ]),
  org_owner: new Set([
    "project:read",
    "project:write",
    "quote:create",
    "quote:approve_order",
    "pricing:view_factory_cost",
    "pricing:manage_rules",
    "catalog:manage_templates",
    "manufacturing:export_bom",
    "manufacturing:export_cnc",
    "erp:publish_production",
    "tenant:manage_members",
    "tenant:manage_settings",
  ]),
  org_admin: new Set([
    "project:read",
    "project:write",
    "quote:create",
    "quote:approve_order",
    "pricing:view_factory_cost",
    "pricing:manage_rules",
    "catalog:manage_templates",
    "manufacturing:export_bom",
    "manufacturing:export_cnc",
    "erp:publish_production",
    "tenant:manage_members",
    "tenant:manage_settings",
  ]),
  production_lead: new Set([
    "project:read",
    "project:write",
    "quote:approve_order",
    "pricing:view_factory_cost",
    "catalog:manage_templates",
    "manufacturing:export_bom",
    "manufacturing:export_cnc",
    "erp:publish_production",
  ]),
  architect: new Set([
    "project:read",
    "project:write",
    "quote:create",
    "catalog:manage_templates",
    "manufacturing:export_bom",
  ]),
  designer: new Set([
    "project:read",
    "project:write",
    "quote:create",
    "manufacturing:export_bom",
  ]),
  sales_rep: new Set([
    "project:read",
    "project:write",
    "quote:create",
    "quote:approve_order",
  ]),
  dealer_admin: new Set([
    "project:read",
    "project:write",
    "quote:create",
    "quote:approve_order",
    "tenant:manage_members",
  ]),
  dealer_staff: new Set([
    "project:read",
    "project:write",
    "quote:create",
  ]),
  external_guest: new Set([
    "project:read",
    "project:write",
  ]),
  readonly_viewer: new Set([
    "project:read",
  ]),
};

export function getTenantEntitlements(planId: SaasPlanId): TenantEntitlements {
  return PLAN_ENTITLEMENTS_MATRIX[planId] || PLAN_ENTITLEMENTS_MATRIX.starter;
}

export function hasTenantPermission(
  role: SaasRoleId,
  permission: SaasPermissionKey,
  options?: {
    tenantStatus?: TenantWorkspaceProfile["status"];
    userBranchId?: string | null;
    resourceBranchId?: string | null;
    allowedProjectIds?: string[];
    targetProjectId?: string;
  }
): boolean {
  const perms = ROLE_PERMISSION_MAP[role];
  if (!perms || !perms.has(permission)) return false;

  // Read-only grace period enforcement on unpaid/past-due subscriptions
  if (
    options?.tenantStatus === "past_due_grace" &&
    permission !== "project:read"
  ) {
    return false;
  }
  if (options?.tenantStatus === "suspended") {
    return false;
  }

  // Dealer branch isolation: dealer roles cannot access another branch's records
  if (
    (role === "dealer_admin" || role === "dealer_staff") &&
    options?.userBranchId &&
    options?.resourceBranchId &&
    options.userBranchId !== options.resourceBranchId
  ) {
    return false;
  }

  // Resource-level ABAC for external project collaborators
  if (
    role === "external_guest" &&
    options?.allowedProjectIds &&
    options?.targetProjectId &&
    !options.allowedProjectIds.includes(options.targetProjectId)
  ) {
    return false;
  }

  return true;
}

export type TenantEntitlementFeatureKey =
  | "custom_templates"
  | "allowCustomTemplates"
  | "bom_export"
  | "allowBomExport"
  | "cnc_export"
  | "allowCncExport"
  | "erp_integration"
  | "allowErpIntegration"
  | "custom_domain"
  | "allowCustomDomain"
  | "white_label_embed"
  | "allowWhiteLabelEmbed"
  | "dealer_hierarchy"
  | "allowDealerHierarchy";

export function checkTenantEntitlement(
  profile: TenantWorkspaceProfile,
  feature: TenantEntitlementFeatureKey
): { allowed: boolean; reason?: string; reasonTr?: string } {
  if (profile.status === "suspended") {
    const msg = "Organizasyon aboneliği askıya alınmış durumda.";
    return { allowed: false, reason: msg, reasonTr: msg };
  }
  if ((profile.status as string) === "past_due" || (profile.status as string) === "past_due_grace") {
    const msg = "Ödeme geçiş süresinde (Salt-Okunur Mod) yeni üretim/entegrasyon çıktısı alınamaz.";
    return { allowed: false, reason: msg, reasonTr: msg };
  }
  const ent = getTenantEntitlements(profile.planId);
  const map: Record<TenantEntitlementFeatureKey, boolean> = {
    custom_templates: ent.allowCustomTemplates,
    allowCustomTemplates: ent.allowCustomTemplates,
    bom_export: ent.allowBomExport,
    allowBomExport: ent.allowBomExport,
    cnc_export: ent.allowCncExport,
    allowCncExport: ent.allowCncExport,
    erp_integration: ent.allowErpIntegration,
    allowErpIntegration: ent.allowErpIntegration,
    custom_domain: ent.allowCustomDomain,
    allowCustomDomain: ent.allowCustomDomain,
    white_label_embed: ent.allowWhiteLabelEmbed,
    allowWhiteLabelEmbed: ent.allowWhiteLabelEmbed,
    dealer_hierarchy: ent.allowDealerHierarchy,
    allowDealerHierarchy: ent.allowDealerHierarchy,
  };
  if (!map[feature]) {
    const msg = `Bu özellik "${ent.planNameTr}" paketinde kapalıdır; Business veya Enterprise pakete yükseltin.`;
    return { allowed: false, reason: msg, reasonTr: msg };
  }
  return { allowed: true };
}

/**
 * TENANT #1 (Flagship Enterprise Reference Customer): Birim Mobilya Sanayi ve Ticaret A.Ş.
 * Exact 1-to-1 parity with Birim's production defaults, authentic B1R1M® logo, and Store/Portal RPCs.
 */
export const TENANT_BIRIM_ENTERPRISE: TenantWorkspaceProfile = {
  tenantId: "00000000-0000-0000-0000-000000000001",
  slug: "birim",
  status: "active",
  planId: "enterprise",
  integrationMode: "birim_store_portal_rpc",
  brand: {
    displayName: "BİRİM",
    legalName: "Birim Mobilya Sanayi ve Ticaret A.Ş.",
    logoVariant: "birim_authentic",
    badgeSubtitle: "MODÜL",
    primaryColorHex: "#141413",
    accentColorHex: "#8C7A6B",
    customDomain: "modul.birim.com",
    quoteCodePrefix: "BRM",
    supportEmail: "info@birim.com",
    defaultCurrency: "EUR",
    defaultDisplayUnit: "mm",
  },
  construction: {
    id: "const_birim_18mm_std",
    name: "Birim 18mm Sistem 32 + Minifiks Standardı",
    defaultCarcassThicknessMm: 18,
    allowedPanelThicknessesMm: [18, 22, 25, 36],
    defaultBackThicknessMm: 8,
    backPanelMounting: "grooved_8mm",
    defaultJoineryTopology: "sides_through",
    connectorSystem: "minifix_dowel",
    defaultPlinthHeightMm: 80,
    defaultPlinthConstruction: "pedestal_box",
    standardSheetLengthMm: 2800,
    standardSheetWidthMm: 2070,
    allowJumboSheet3660: true,
    sawKerfMm: 4.0,
    edgeTrimMarginMm: 15,
    preMillingEdgeDeduction: true,
  },
  machine: {
    id: "mach_birim_homag_scm",
    name: "Birim Fabrika Homag / SCM + Zebra Hattı",
    primaryCncFormat: "homag_mpr",
    barcodeLabelFormat: "zebra_zpl",
    toolNumbers: {
      system32Dia5: 105,
      dowelDia8: 108,
      minifixCamDia15: 115,
      cabineoPocketDia15: 116,
      hingeCupDia35: 135,
      backGrooveSaw: 201,
    },
  },
  pricing: {
    wasteFactorPercent: 12,
    laborRatePerHourEur: 28,
    estimatedHoursPerM2: 0.65,
    operationalOverheadPercent: 10,
    assemblyCostEur: 95,
    perModuleInstallEur: 22,
    deliveryBaseEur: 45,
    cncCostPerHoleEur: 0.04,
    packagingCostEur: 35,
    targetMarginPercent: 35,
    dealerDiscountPercent: 0,
    maxSalesRepDiscountPercent: 25,
    vatRatePercent: 20,
    minSpecialDecorBoardFraction: 0.5,
    lacquerPaintshopMatteEurPerM2: 18,
    lacquerPaintshopGlossEurPerM2: 26,
    miter45LinearMeterEur: 9.5,
    currency: "EUR",
    eurTryExchangeRate: 41.8,
    stockedMaterialIds: [
      "mat_melamine_white",
      "mat_melamine_anthracite",
      "mat_melamine_cashmere",
      "mat_mdf_white",
      "mat_back_white_8mm",
    ],
  },
};

/**
 * TENANT #2 (Multi-Tenant Independence Verification Manufacturer):
 * Anka Mutfak & Banyo Sistemleri A.Ş. — 19mm panel, 4mm HDF back, Lamello Cabineo, Biesse CIX, TRY Dealer pricing!
 */
export const TENANT_ANKA_BUSINESS: TenantWorkspaceProfile = {
  tenantId: "00000000-0000-0000-0000-000000000002",
  slug: "anka",
  status: "active",
  planId: "business",
  integrationMode: "webhook_rest_erp",
  webhookEndpointUrl: "https://erp.ankamutfak.com.tr/api/modul/webhooks/orders",
  brand: {
    displayName: "ANKA MUTFAK",
    legalName: "Anka Mutfak ve Banyo Sistemleri A.Ş.",
    logoVariant: "custom_wordmark",
    badgeSubtitle: "PRO",
    primaryColorHex: "#0F172A",
    accentColorHex: "#0284C7",
    customDomain: "tasarla.ankamutfak.com.tr",
    quoteCodePrefix: "ANK",
    supportEmail: "teknik@ankamutfak.com.tr",
    defaultCurrency: "TRY",
    defaultDisplayUnit: "cm",
  },
  construction: {
    id: "const_anka_19mm_cabineo",
    name: "Anka 19mm Egger + Lamello Cabineo Standardı",
    defaultCarcassThicknessMm: 19,
    allowedPanelThicknessesMm: [16, 19, 25],
    defaultBackThicknessMm: 4,
    backPanelMounting: "surface_nailed_4mm",
    defaultJoineryTopology: "top_bottom_through",
    connectorSystem: "lamello_cabineo",
    defaultPlinthHeightMm: 100,
    defaultPlinthConstruction: "adjustable_legs_clip",
    standardSheetLengthMm: 2800,
    standardSheetWidthMm: 2070,
    allowJumboSheet3660: false,
    sawKerfMm: 3.2,
    edgeTrimMarginMm: 10,
    preMillingEdgeDeduction: true,
  },
  machine: {
    id: "mach_anka_biesse_rover",
    name: "Anka Biesse Rover + Termal Etiket Hattı",
    primaryCncFormat: "biesse_cix",
    barcodeLabelFormat: "thermal_html",
    toolNumbers: {
      system32Dia5: 11,
      dowelDia8: 12,
      minifixCamDia15: 15,
      cabineoPocketDia15: 18,
      hingeCupDia35: 35,
      backGrooveSaw: 41,
    },
  },
  pricing: {
    wasteFactorPercent: 15,
    laborRatePerHourEur: 22,
    estimatedHoursPerM2: 0.58,
    operationalOverheadPercent: 12,
    assemblyCostEur: 75,
    perModuleInstallEur: 18,
    deliveryBaseEur: 35,
    cncCostPerHoleEur: 0.05,
    packagingCostEur: 28,
    targetMarginPercent: 42,
    dealerDiscountPercent: 18,
    maxSalesRepDiscountPercent: 15,
    vatRatePercent: 20,
    minSpecialDecorBoardFraction: 1.0,
    lacquerPaintshopMatteEurPerM2: 21,
    lacquerPaintshopGlossEurPerM2: 29,
    miter45LinearMeterEur: 11,
    currency: "TRY",
    eurTryExchangeRate: 42.5,
    stockedMaterialIds: ["mat_egger_19_white", "mat_egger_19_cashmere", "mat_egger_4mm_hdf_back", "mat_melamine_white"],
  },
};

/**
 * TENANT #3 (Design Studio Tier Verification): Atölye Mimarlık — Professional plan (CNC export disabled by entitlement!)
 */
export const TENANT_ATOLYE_PRO: TenantWorkspaceProfile = {
  tenantId: "00000000-0000-0000-0000-000000000003",
  slug: "atolye-mimarlik",
  status: "active",
  planId: "professional",
  integrationMode: "standalone_cloud_inbox",
  brand: {
    displayName: "ATÖLYE MİMARLIK",
    legalName: "Atölye İç Mimarlık ve Tasarım Ltd. Şti.",
    logoVariant: "custom_wordmark",
    badgeSubtitle: "STUDIO",
    primaryColorHex: "#1E293B",
    accentColorHex: "#059669",
    customDomain: "atolye.modul.app",
    quoteCodePrefix: "ATL",
    supportEmail: "proje@atolyemimarlik.com",
    defaultCurrency: "TRY",
    defaultDisplayUnit: "cm",
  },
  construction: {
    id: "const_generic_18mm",
    name: "Genel 18mm İç Mimarlık Konstrüksiyonu",
    defaultCarcassThicknessMm: 18,
    allowedPanelThicknessesMm: [18, 25],
    defaultBackThicknessMm: 8,
    backPanelMounting: "grooved_8mm",
    defaultJoineryTopology: "sides_through",
    connectorSystem: "minifix_dowel",
    defaultPlinthHeightMm: 80,
    defaultPlinthConstruction: "pedestal_box",
    standardSheetLengthMm: 2800,
    standardSheetWidthMm: 2070,
    allowJumboSheet3660: false,
    sawKerfMm: 4.0,
    edgeTrimMarginMm: 15,
    preMillingEdgeDeduction: true,
  },
  machine: {
    id: "mach_generic_iso",
    name: "Standart 2D DXF / Kesim Listesi Profili",
    primaryCncFormat: "iso_gcode",
    barcodeLabelFormat: "thermal_html",
    toolNumbers: {
      system32Dia5: 1,
      dowelDia8: 2,
      minifixCamDia15: 3,
      cabineoPocketDia15: 4,
      hingeCupDia35: 5,
      backGrooveSaw: 6,
    },
  },
  pricing: {
    wasteFactorPercent: 10,
    laborRatePerHourEur: 25,
    estimatedHoursPerM2: 0.6,
    operationalOverheadPercent: 8,
    assemblyCostEur: 80,
    perModuleInstallEur: 20,
    deliveryBaseEur: 40,
    cncCostPerHoleEur: 0.03,
    packagingCostEur: 25,
    targetMarginPercent: 30,
    dealerDiscountPercent: 0,
    maxSalesRepDiscountPercent: 20,
    vatRatePercent: 20,
    minSpecialDecorBoardFraction: 0.5,
    lacquerPaintshopMatteEurPerM2: 19,
    lacquerPaintshopGlossEurPerM2: 27,
    miter45LinearMeterEur: 10,
    currency: "TRY",
    eurTryExchangeRate: 42.0,
    stockedMaterialIds: ["mat_melamine_white", "mat_melamine_cashmere"],
  },
};

export const BUILTIN_SAAS_TENANTS: readonly TenantWorkspaceProfile[] = [
  TENANT_BIRIM_ENTERPRISE,
  TENANT_ANKA_BUSINESS,
  TENANT_ATOLYE_PRO,
];

const runtimeTenantRegistry = new Map<string, TenantWorkspaceProfile>(
  BUILTIN_SAAS_TENANTS.map((t) => [t.tenantId, structuredClone(t)])
);

export function registerOrUpdateTenantProfile(profile: TenantWorkspaceProfile): TenantWorkspaceProfile {
  const copy = structuredClone(profile);
  runtimeTenantRegistry.set(copy.tenantId, copy);
  return structuredClone(copy);
}

export function getTenantProfileByIdOrSlug(idOrSlug: string | null | undefined): TenantWorkspaceProfile {
  const key = (idOrSlug || "").trim().toLowerCase();
  if (!key) return structuredClone(TENANT_BIRIM_ENTERPRISE);
  for (const profile of runtimeTenantRegistry.values()) {
    if (
      profile.tenantId.toLowerCase() === key ||
      profile.slug.toLowerCase() === key ||
      profile.brand.customDomain.toLowerCase() === key
    ) {
      return structuredClone(profile);
    }
  }
  return structuredClone(TENANT_BIRIM_ENTERPRISE);
}

export function listRegisteredTenantProfiles(): TenantWorkspaceProfile[] {
  return Array.from(runtimeTenantRegistry.values()).map((t) => structuredClone(t));
}

/**
 * Generates a strict tenant-isolated storage key so switching organizations in the browser
 * never leaks saved drafts, custom materials, or custom standards across tenants.
 */
export function buildTenantScopedStorageKey(tenantId: string, baseKey: string): string {
  const cleanTenant = (tenantId || TENANT_BIRIM_ENTERPRISE.tenantId).replace(/[^a-zA-Z0-9_-]/g, "");
  return `modul:v1:${cleanTenant}:${baseKey}`;
}

/**
 * Generates snippet for external e-commerce / dealer websites to embed a tenant's configurator.
 */
export function buildTenantEmbedSdkSnippet(profile: TenantWorkspaceProfile, platformOrigin = "https://app.modul.studio"): string {
  return [
    `<!-- ${profile.brand.legalName} — Modül 3B Konfigüratör Embed SDK -->`,
    `<div id="modul-configurator-mount" style="width:100%;height:780px;border-radius:16px;overflow:hidden;"></div>`,
    `<script src="${platformOrigin}/sdk/v1/embed.js" data-tenant="${profile.slug}" data-currency="${profile.brand.defaultCurrency}" async></script>`,
  ].join("\n");
}

/**
 * Applies a tenant's ConstructionRuleProfile to a newly created or converted ModuleInstance
 * without mutating hardcoded Birim defaults in shared templates.
 */
export function applyTenantConstructionToModule(
  mod: ModuleInstance,
  profile: TenantWorkspaceProfile
): ModuleInstance {
  const c = profile.construction;
  const backType =
    c.backPanelMounting === "surface_nailed_4mm"
      ? "nailed"
      : c.backPanelMounting === "rabbeted_8mm"
        ? "rebated"
        : "grooved";
  const defaultBodyMat =
    profile.slug === "anka"
      ? "mat_egger_19_white"
      : mod.carcass.bodyMaterialId || "mat_melamine_white";
  const defaultDoorMat =
    profile.slug === "anka" && mod.carcass.doorMaterialId === "mat_veneer_oak"
      ? "mat_egger_19_cashmere"
      : mod.carcass.doorMaterialId;

  return {
    ...mod,
    carcass: {
      ...mod.carcass,
      panelThickness: c.defaultCarcassThicknessMm,
      backPanelThickness: c.defaultBackThicknessMm,
      backPanelType: backType,
      carcassJoineryTopology:
        mod.category === "kitchen_base" || mod.category === "kitchen_island"
          ? mod.carcass.carcassJoineryTopology || "kitchen_stretchers"
          : c.defaultJoineryTopology,
      connectorSystem: c.connectorSystem,
      jointType: c.connectorSystem === "confirmat" ? "confirmat" : "minifix_dowel",
      plinthHeight:
        mod.category === "kitchen_wall" ? 0 : c.defaultPlinthHeightMm,
      plinthConstruction: c.defaultPlinthConstruction,
      allowJumboSheet3660: c.allowJumboSheet3660,
      constructionProfileId: c.id,
      bodyMaterialId: defaultBodyMat,
      doorMaterialId: defaultDoorMat,
    },
  };
}
