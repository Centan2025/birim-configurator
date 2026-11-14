import {
  DEFAULT_MATERIALS,
  DesignProject,
  evaluateProjectCompatibility,
  evaluateUnifiedEngineeringModel,
  roundMm,
} from "@birim/core";
import {
  ManufacturingBOM,
  buildBirimErpNestingBundle,
  convertCutPieceToErpPartInput,
  generateBlumBxfXml,
  generateProjectCncPostProcessorBundle,
  mapCutPieceToCncPieceInput,
  type BirimErpNestingBuildOptions,
  type BirimErpNestingExportBundle,
} from "@birim/manufacturing";
import { PricingBreakdown } from "@birim/pricing";
import { AuditLogEntry, ERPBlueprintPayload, IERPAdapter, IStoreAdapter } from "./types";

export const DEFAULT_BIRIM_ORG_UUID = "00000000-0000-0000-0000-000000000001";
const PROTECTED_PRODUCTION_PROJECT_REF = "qchmdyiakmrfyvphbbok";

export type BirimSessionRole =
  | "super_admin"
  | "admin"
  | "owner"
  | "executive"
  | "sales_manager"
  | "store_manager"
  | "branch_manager"
  | "sales_rep"
  | "operator"
  | "receptionist";

export interface SupabaseRpcSessionContext {
  organizationId: string;
  branchIdOrCode?: string | null;
  userId?: string | null;
  username?: string | null;
  role?: BirimSessionRole;
}

export interface SupabaseRpcAdapterConfig {
  supabaseUrl?: string;
  supabaseServiceRoleKey?: string;
  defaultSession?: Partial<SupabaseRpcSessionContext>;
  /**
   * Varsayılan olarak `false`: Canlı üretim (`qchmdyiakmrfyvphbbok`) veritabanına
   * açıkça `allowProductionMutation: true` verilmedikçe kazara yazma yapılmasını engeller.
   */
  allowProductionMutation?: boolean;
  fetchImpl?: typeof fetch;
}

export interface StoreReconciledQuotationLine {
  lineKey: string;
  productId: string;
  isCustom: boolean;
  sku: string;
  name: string;
  title: string;
  quantity: number;
  unit: string;
  unitPrice: number;
  unitCost: number;
  expectedMargin: number;
  currency: "TRY" | "EUR";
  discountRate: number;
  discountAmount: number;
  vatRate: number;
  subtotal: number;
  vatAmount: number;
  totalPrice: number;
  calculatedPriceEur: number;
  notes: string;
  dimensions: string;
  materialSummary: string;
  configuratorProjectId: string;
  configuratorVersion: number;
  compatibilityStatus: string;
  technicalSpecs: Record<string, unknown>;
}

export interface LiveStoreQuotationRpcResult {
  success: boolean;
  snapshotId: string;
  timestamp: string;
  isUpdate: boolean;
  quotationId: string;
  quotationNo: string;
  revision: number;
  version: number;
  organizationId: string;
  branchId: string | null;
  subtotal: number;
  discountTotal: number;
  taxTotal: number;
  totalAmount: number;
  currency: "TRY" | "EUR";
  lineCount: number;
  autoConvertedOrder: boolean;
  salesCardId: string | null;
  salesNo: string | null;
  reconciledLines: StoreReconciledQuotationLine[];
}

export interface LiveErpNestingJobRpcSummary {
  nestingProjectId: string;
  projectNo: string;
  sheetId: string;
  materialName: string;
  thicknessMm: number;
  partsInserted: number;
  placementsInserted: number;
  sheetsUsed: number;
  utilizationPercent: number;
}

export interface LiveErpNestingRpcResult {
  success: boolean;
  blueprintId: string;
  orderRef: string;
  itemsCount: number;
  nestingJobsCount: number;
  nestingProjectIds: string[];
  nestingProjectNos: string[];
  nestingJobs: LiveErpNestingJobRpcSummary[];
  totalSheetsUsed: number;
  totalPartsInserted: number;
  totalPlacementsInserted: number;
  overallUtilizationPercent: number;
  reclaimableRemnantsCount: number;
  nestingBundle: BirimErpNestingExportBundle;
  publishedAt: string;
}

export class BirimSupabaseRpcError extends Error {
  public readonly httpStatus: number;
  public readonly pgCode: string;
  public readonly details?: string;

  constructor(message: string, httpStatus: number, pgCode = "BIRIM_RPC_ERR", details?: string) {
    super(message);
    this.name = "BirimSupabaseRpcError";
    this.httpStatus = httpStatus;
    this.pgCode = pgCode;
    this.details = details;
  }
}

function round2(val: number): number {
  return Math.round((val + Number.EPSILON) * 100) / 100;
}

const UUID_REGEX = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;

export function isValidUuid(value: string | null | undefined): boolean {
  return Boolean(value && UUID_REGEX.test(value.trim()));
}

/**
 * PostgreSQL SQLSTATE hata kodlarını Birim-Store / Birim-Portal BFF sözleşmesindeki
 * HTTP durum kodlarına birebir eşler (`42883 -> 503`, `23505 -> 409`, `42501 -> 403`,
 * `22023 -> 400`, `P0002 -> 404`, `55P03 -> 409`).
 */
export function mapPostgrestRpcErrorToHttp(
  pgCode: string | undefined,
  fallbackHttpStatus = 500
): number {
  switch ((pgCode || "").toUpperCase()) {
    case "42883":
    case "PGRST202":
    case "PGRST203":
      return 503; // RPC fonksiyonu eksik veya şema önbelleği güncel değil -> Fail-Closed!
    case "23505":
    case "55P03":
      return 409; // Idempotency çakışması, aktif kilit veya mükerrer sipariş/revizyon
    case "42501":
      return 403; // RBAC rol, şube (branch) veya kiracı (organization) ihlali
    case "P0002":
      return 404; // Teklif veya satış kartı bulunamadı
    case "22023":
    case "22000":
    case "22P02":
      return 400; // Geçersiz parametre, satır aritmetiği veya P0 üretim kapısı engeli
    default:
      return fallbackHttpStatus >= 400 ? fallbackHttpStatus : 500;
  }
}

/**
 * İdempotensi anahtarlarının farklı içerikle tekrar kullanılmasını (`23505 Conflict`)
 * yakalamak için deterministik FNV-1a / SHA benzeri kanonik özet üretir (tarayıcı + Node uyumlu).
 */
export function computeCanonicalRequestHash(payload: unknown): string {
  const canonicalJson = JSON.stringify(payload, (_k, v) => {
    if (v && typeof v === "object" && !Array.isArray(v)) {
      const sorted: Record<string, unknown> = {};
      for (const key of Object.keys(v as Record<string, unknown>).sort()) {
        sorted[key] = (v as Record<string, unknown>)[key];
      }
      return sorted;
    }
    return v;
  });

  // Node.js ortamında gerçek SHA-256 varsa kullan, yoksa deterministik 64-bit çift FNV-1a kullan
  try {
    if (typeof process !== "undefined" && process.versions?.node) {
      // Dinamik require ile tarayıcı paketleyicilerini kırmadan kripto modülünü yükle
      const req = eval("require") as (mod: string) => {
        createHash: (alg: string) => { update: (d: string) => { digest: (enc: string) => string } };
      };
      const cryptoMod = req("crypto");
      return cryptoMod.createHash("sha256").update(canonicalJson).digest("hex");
    }
  } catch {
    // Tarayıcı ortamı fallback
  }

  let h1 = 0x811c9dc5;
  let h2 = 0x811c9dc5;
  for (let i = 0; i < canonicalJson.length; i++) {
    const ch = canonicalJson.charCodeAt(i);
    h1 ^= ch;
    h1 = Math.imul(h1, 0x01000193);
    h2 ^= ch ^ (i & 0xff);
    h2 = Math.imul(h2, 0x01000193);
  }
  return `fnv64_${(h1 >>> 0).toString(16).padStart(8, "0")}${(h2 >>> 0).toString(16).padStart(8, "0")}`;
}

/**
 * Configurator fiyat kırılımını (`PricingBreakdown`) ve ticari sahne objelerini (`sceneObjects`),
 * `convert_store_quotation_to_order_atomic` RPC'sinin beklediği **sıfır kuruş farkı (`0.00` delta)**
 * garantili `saved_quotations.quotation_data.lines` formatına dönüştürür.
 */
export function buildReconciledStoreQuotationLines(
  project: DesignProject,
  bom: ManufacturingBOM,
  pricing: PricingBreakdown,
  options?: {
    currency?: "TRY" | "EUR";
    discountRatePercent?: number;
  }
): {
  currency: "TRY" | "EUR";
  lines: StoreReconciledQuotationLine[];
  subtotal: number;
  discountTotal: number;
  taxTotal: number;
  totalAmount: number;
} {
  const currency = options?.currency || "TRY";
  const fxRate = currency === "TRY" ? pricing.eurTryExchangeRate || 41.8 : 1;
  const discountRate = Math.max(0, Math.min(100, round2(options?.discountRatePercent ?? 0)));
  const vatRate = 20;

  const unified = evaluateUnifiedEngineeringModel(project);
  const compat = evaluateProjectCompatibility(project);
  const compatibilityStatus = !unified.canExportToCncAndSaw
    ? "INCOMPATIBLE"
    : !unified.canApproveFinalErpRelease
    ? "UNVERIFIED"
    : compat.overallStatus;

  const commercialObjs = pricing.details.commercialObjectLines || [];
  const commercialNetEur = commercialObjs.reduce((s, c) => s + c.totalEur, 0);
  const parametricNetEur = Math.max(1, roundMm(pricing.subtotalBeforeVatEur - commercialNetEur, 2));

  const mainMod = project.modules[0];
  const dimsSummary =
    project.modules.length === 1 && mainMod
      ? `${mainMod.dimensions.width}×${mainMod.dimensions.height}×${mainMod.dimensions.depth} mm`
      : `${project.modules.length} Modül Sistem (${project.modules
          .map((m) => `${m.dimensions.width}×${m.dimensions.height}×${m.dimensions.depth}`)
          .join(" + ")} mm)`;

  const matNames = Array.from(new Set(bom.materialUsage.map((u) => u.materialName))).join(", ");
  const hwSummary = bom.hardwareList
    .slice(0, 6)
    .map((h) => `${h.quantity}× ${h.sku}`)
    .join(", ");

  const cleanCode = project.id.replace(/[^a-zA-Z0-9]/g, "").slice(0, 8).toUpperCase() || "PRJ";
  const lines: StoreReconciledQuotationLine[] = [];

  // 1. Parametrik Özel Üretim Mobilya Sistemi Ana Satırı
  const paramUnitPrice = Math.max(0.01, round2(parametricNetEur * fxRate));
  const paramDiscountAmt = round2(paramUnitPrice * (discountRate / 100));
  const paramSubtotal = round2(Math.max(0.01, paramUnitPrice - paramDiscountAmt));
  const paramVat = round2(paramSubtotal * (vatRate / 100));
  const paramTotal = round2(paramSubtotal + paramVat);
  const paramUnitCost = round2((pricing.netProductionCostEur || parametricNetEur * 0.65) * fxRate);

  lines.push({
    lineKey: `cfg_${project.id}_v${project.version}_main`,
    productId: `cfg_${project.id}`,
    isCustom: true,
    sku: `CFG-${cleanCode}-V${project.version}`,
    name: `${project.title} (Parametrik Özel Üretim — ${project.modules.length} Modül)`,
    title: `${project.title} (Parametrik Özel Üretim — ${project.modules.length} Modül)`,
    quantity: 1,
    unit: "takım",
    unitPrice: paramUnitPrice,
    unitCost: paramUnitCost,
    expectedMargin: 35,
    currency,
    discountRate,
    discountAmount: paramDiscountAmt,
    vatRate,
    subtotal: paramSubtotal,
    vatAmount: paramVat,
    totalPrice: paramTotal,
    calculatedPriceEur: round2(parametricNetEur * (1 - discountRate / 100) * 1.2),
    notes: [
      `Ölçü: ${dimsSummary}`,
      `Malzeme: ${matNames || "Standart Melamin/MDF"}`,
      `BOM: ${bom.summary.totalPiecesCount} panel (${bom.summary.totalPanelAreaM2} m²), ${bom.summary.totalEdgeBandMeters} m bant, ${bom.summary.totalDrillingHolesCount || 0} CNC delik`,
      hwSummary ? `Donanım: ${hwSummary}` : "",
      pricing.leadTime?.label ? `Termin: ${pricing.leadTime.label}` : "",
    ]
      .filter(Boolean)
      .join(" | "),
    dimensions: dimsSummary,
    materialSummary: matNames || "Standart Melamin/MDF",
    configuratorProjectId: project.id,
    configuratorVersion: project.version,
    compatibilityStatus,
    technicalSpecs: {
      modulesCount: project.modules.length,
      totalPiecesCount: bom.summary.totalPiecesCount,
      totalPanelAreaM2: bom.summary.totalPanelAreaM2,
      totalEdgeBandMeters: bom.summary.totalEdgeBandMeters,
      totalHardwareCount: bom.summary.totalHardwareCount,
      totalDrillingHolesCount: bom.summary.totalDrillingHolesCount || 0,
      canExportToCncAndSaw: unified.canExportToCncAndSaw,
      canApproveFinalErpRelease: unified.canApproveFinalErpRelease,
    },
  });

  // 2. Ticari Sahne Objeleri (`commercialRole === "quoted_product"`) Ayrı Satırlar Olarak Eklenir
  commercialObjs.forEach((cObj, idx) => {
    const qty = Math.max(1, Math.round(cObj.qty || 1));
    const unitPrice = Math.max(0.01, round2(cObj.unitPriceEur * fxRate));
    const lineGross = round2(unitPrice * qty);
    const lineDisc = round2(lineGross * (discountRate / 100));
    const lineSub = round2(Math.max(0.01, lineGross - lineDisc));
    const lineVat = round2(lineSub * (vatRate / 100));
    const lineTot = round2(lineSub + lineVat);

    const matchedSceneObj = (project.sceneObjects || []).find((s) => s.sku === cObj.sku);
    lines.push({
      lineKey: `cfg_${project.id}_v${project.version}_obj_${idx + 1}`,
      productId: matchedSceneObj && isValidUuid(matchedSceneObj.catalogItemId)
        ? matchedSceneObj.catalogItemId
        : `scene_sku_${cObj.sku}`,
      isCustom: !(matchedSceneObj && isValidUuid(matchedSceneObj.catalogItemId)),
      sku: cObj.sku,
      name: cObj.name,
      title: cObj.name,
      quantity: qty,
      unit: "adet",
      unitPrice,
      unitCost: round2(unitPrice * 0.7),
      expectedMargin: 30,
      currency,
      discountRate,
      discountAmount: lineDisc,
      vatRate,
      subtotal: lineSub,
      vatAmount: lineVat,
      totalPrice: lineTot,
      calculatedPriceEur: round2(cObj.totalEur * (1 - discountRate / 100) * 1.2),
      notes: `Sahne yerleşimli ticari ürün (${cObj.sku}) — Configurator Proje: ${project.title}`,
      dimensions: matchedSceneObj
        ? `${matchedSceneObj.dimensions.width}×${matchedSceneObj.dimensions.height}×${matchedSceneObj.dimensions.depth} mm`
        : "",
      materialSummary: "Katalog Ürünü / Cihaz",
      configuratorProjectId: project.id,
      configuratorVersion: project.version,
      compatibilityStatus,
      technicalSpecs: {
        commercialSceneObject: true,
        sku: cObj.sku,
      },
    });
  });

  const subtotal = round2(lines.reduce((s, l) => s + l.subtotal, 0));
  const discountTotal = round2(lines.reduce((s, l) => s + l.discountAmount, 0));
  const taxTotal = round2(lines.reduce((s, l) => s + l.vatAmount, 0));
  const totalAmount = round2(lines.reduce((s, l) => s + l.totalPrice, 0));

  return {
    currency,
    lines,
    subtotal,
    discountTotal,
    taxTotal,
    totalAmount,
  };
}

function resolveSupabaseRpcConfig(config?: SupabaseRpcAdapterConfig): {
  supabaseUrl: string;
  serviceRoleKey: string;
  allowProductionMutation: boolean;
  fetchFn: typeof fetch;
  defaultSession: SupabaseRpcSessionContext;
} {
  const envUrl =
    typeof process !== "undefined"
      ? process.env?.SUPABASE_URL || process.env?.NEXT_PUBLIC_SUPABASE_URL || ""
      : "";
  const envServiceKey =
    typeof process !== "undefined" ? process.env?.SUPABASE_SERVICE_ROLE_KEY || "" : "";
  const envOrgId =
    typeof process !== "undefined"
      ? process.env?.BIRIM_DEFAULT_ORG_ID || DEFAULT_BIRIM_ORG_UUID
      : DEFAULT_BIRIM_ORG_UUID;
  const envAllowProd =
    typeof process !== "undefined"
      ? process.env?.BIRIM_ALLOW_PRODUCTION_SUPABASE_MUTATION === "true"
      : false;

  return {
    supabaseUrl: (config?.supabaseUrl ?? envUrl).replace(/\/$/, ""),
    serviceRoleKey: config?.supabaseServiceRoleKey ?? envServiceKey,
    allowProductionMutation: config?.allowProductionMutation ?? envAllowProd,
    fetchFn: config?.fetchImpl ?? fetch,
    defaultSession: {
      organizationId: config?.defaultSession?.organizationId || envOrgId,
      branchIdOrCode: config?.defaultSession?.branchIdOrCode ?? null,
      userId: config?.defaultSession?.userId ?? null,
      username: config?.defaultSession?.username ?? "birim-configurator",
      role: config?.defaultSession?.role ?? "sales_manager",
    },
  };
}

async function invokeSupabasePostgrestRpc<TResponse>(
  rpcName: string,
  rpcArgs: Record<string, unknown>,
  resolved: ReturnType<typeof resolveSupabaseRpcConfig>
): Promise<TResponse> {
  if (!resolved.supabaseUrl || !resolved.serviceRoleKey) {
    throw new BirimSupabaseRpcError(
      `Canlı Supabase RPC yapılandırması eksik (SUPABASE_URL ve SUPABASE_SERVICE_ROLE_KEY gereklidir; hedef RPC: ${rpcName}).`,
      503,
      "SUPABASE_ENV_MISSING"
    );
  }

  if (
    resolved.supabaseUrl.includes(PROTECTED_PRODUCTION_PROJECT_REF) &&
    !resolved.allowProductionMutation
  ) {
    throw new BirimSupabaseRpcError(
      `Güvenlik kilidi: Canlı üretim Supabase projesine (${PROTECTED_PRODUCTION_PROJECT_REF}) yazma işlemi varsayılan olarak engellenmiştir. Staging ortamı kullanın veya BIRIM_ALLOW_PRODUCTION_SUPABASE_MUTATION=true tanımlayın.`,
      403,
      "PROD_SAFETY_LOCK"
    );
  }

  const endpoint = `${resolved.supabaseUrl}/rest/v1/rpc/${rpcName}`;
  let response: Response;
  try {
    response = await resolved.fetchFn(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: resolved.serviceRoleRoleKeyFix(resolved.serviceRoleKey),
        Authorization: `Bearer ${resolved.serviceRoleKey}`,
        Prefer: "return=representation",
      },
      body: JSON.stringify(rpcArgs),
    });
  } catch (err) {
    throw new BirimSupabaseRpcError(
      `Supabase RPC ağ bağlantısı kurulamadı (${rpcName}): ${
        err instanceof Error ? err.message : String(err)
      }`,
      503,
      "NETWORK_UNREACHABLE"
    );
  }

  const rawText = await response.text();
  let parsed: unknown = null;
  if (rawText) {
    try {
      parsed = JSON.parse(rawText);
    } catch {
      parsed = { message: rawText };
    }
  }

  if (!response.ok) {
    const errObj = (parsed && typeof parsed === "object" ? parsed : {}) as {
      code?: string;
      message?: string;
      details?: string;
      hint?: string;
    };
    const pgCode = errObj.code || `HTTP_${response.status}`;
    const httpStatus = mapPostgrestRpcErrorToHttp(pgCode, response.status);
    const msg =
      pgCode === "42883" || pgCode === "PGRST202"
        ? `Veritabanında '${rpcName}' atomik RPC fonksiyonu bulunamadı (503 Service Unavailable — lütfen 20261114120000_birim_configurator_store_erp_rpc.sql göçünü uygulayın).`
        : errObj.message || `Supabase RPC hatası (${rpcName}: HTTP ${response.status})`;
    throw new BirimSupabaseRpcError(msg, httpStatus, pgCode, errObj.details || errObj.hint);
  }

  return parsed as TResponse;
}

// Küçük yardımcı: serviceRoleKey boşluk temizliği
declare module "./supabase-rpc-bridge" {}
function buildResolved(config?: SupabaseRpcAdapterConfig) {
  const base = resolveSupabaseRpcConfig(config);
  return {
    ...base,
    serviceRoleKey: base.serviceRoleKey.trim(),
    serviceRoleRoleKeyFix: (k: string) => k.trim(),
  };
}

/**
 * Canlı Birim-Store Teklif Akışı Supabase RPC Adaptörü (`IStoreAdapter` uyumlu).
 * `public.upsert_configurator_store_quotation_atomic` üzerinden `saved_quotations`,
 * `saved_quotation_items`, `configurator_projects` ve isteğe bağlı olarak
 * `convert_store_quotation_to_order_atomic` (`sales_cards` + `sales_order_lines`)
 * tablolarını tek bir PostgreSQL işleminde günceller.
 */
export class SupabaseStoreRpcAdapter implements IStoreAdapter {
  private readonly resolved: ReturnType<typeof buildResolved>;
  private readonly auditLogs: AuditLogEntry[] = [];

  constructor(config?: SupabaseRpcAdapterConfig) {
    this.resolved = buildResolved(config);
  }

  isConfigured(): boolean {
    return Boolean(this.resolved.supabaseUrl && this.resolved.serviceRoleKey);
  }

  async upsertQuotationWithOptions(
    project: DesignProject,
    bom: ManufacturingBOM,
    pricing: PricingBreakdown,
    options?: {
      quotationId?: string | null;
      customerId?: string | null;
      customerName?: string | null;
      currency?: "TRY" | "EUR";
      discountRatePercent?: number;
      autoConvertToOrder?: boolean;
      orderDraft?: Record<string, unknown> | null;
      idempotencyKey?: string;
      session?: Partial<SupabaseRpcSessionContext>;
    }
  ): Promise<LiveStoreQuotationRpcResult> {
    const orgId = options?.session?.organizationId || this.resolved.defaultSession.organizationId;
    if (!isValidUuid(orgId)) {
      throw new BirimSupabaseRpcError(
        `Geçersiz organizasyon UUID formatı: '${orgId}'. Birim-Store / Birim-Portal kiracı kimliği UUID olmalıdır.`,
        400,
        "22023"
      );
    }

    if (options?.quotationId && !isValidUuid(options.quotationId)) {
      throw new BirimSupabaseRpcError(
        `Güncellenecek teklif ID'si geçerli bir UUID olmalıdır ('${options.quotationId}'). Yeni teklif oluşturmak için quotationId alanını boş bırakın.`,
        400,
        "22023"
      );
    }

    const unified = evaluateUnifiedEngineeringModel(project);
    const compat = evaluateProjectCompatibility(project);
    const compatibilityStatus = !unified.canExportToCncAndSaw
      ? "INCOMPATIBLE"
      : !unified.canApproveFinalErpRelease
      ? "UNVERIFIED"
      : compat.overallStatus;
    const canExportProduction =
      unified.canExportToCncAndSaw &&
      unified.canApproveFinalErpRelease &&
      compat.overallStatus !== "INCOMPATIBLE" &&
      compat.overallStatus !== "UNVERIFIED";

    if (options?.autoConvertToOrder && !canExportProduction) {
      throw new BirimSupabaseRpcError(
        `Mühendislik kapısı kilitli (${compatibilityStatus}): Doğrulanmamış veya P0 hatalı tasarım doğrudan siparişe dönüştürülemez.`,
        400,
        "22023"
      );
    }

    const reconciled = buildReconciledStoreQuotationLines(project, bom, pricing, {
      currency: options?.currency || "TRY",
      discountRatePercent: options?.discountRatePercent ?? 0,
    });

    const branchInput =
      options?.session?.branchIdOrCode ??
      this.resolved.defaultSession.branchIdOrCode ??
      project.branchId ??
      null;
    const sessionUserId =
      options?.session?.userId ?? this.resolved.defaultSession.userId ?? null;
    const sessionUsername =
      options?.session?.username ?? this.resolved.defaultSession.username ?? "birim-configurator";
    const sessionRole =
      options?.session?.role ?? this.resolved.defaultSession.role ?? "sales_manager";

    const requestHash = computeCanonicalRequestHash({
      orgId,
      projectId: project.id,
      version: project.version,
      quotationId: options?.quotationId || null,
      currency: reconciled.currency,
      totalAmount: reconciled.totalAmount,
      lines: reconciled.lines.map((l) => ({
        sku: l.sku,
        qty: l.quantity,
        totalPrice: l.totalPrice,
      })),
      autoConvertToOrder: Boolean(options?.autoConvertToOrder),
    });

    const rpcArgs: Record<string, unknown> = {
      p_session_org_id: orgId,
      p_configurator_project_id: project.id,
      p_configurator_version: project.version,
      p_project_title: project.title,
      p_project_payload: project,
      p_lines: reconciled.lines,
      p_currency: reconciled.currency,
      p_quotation_id: options?.quotationId || null,
      p_customer_id: options?.customerId && isValidUuid(options.customerId) ? options.customerId : null,
      p_customer_name: options?.customerName || project.customerName || null,
      p_branch_input: branchInput,
      p_compatibility_status: compatibilityStatus,
      p_can_export_production: canExportProduction,
      p_auto_convert_to_order: Boolean(options?.autoConvertToOrder),
      p_order_draft: options?.orderDraft || null,
      p_active_rates: {
        EUR: pricing.eurTryExchangeRate || 41.8,
        TRY: 1,
      },
      p_idempotency_key: options?.idempotencyKey || null,
      p_request_hash: requestHash,
      p_session_user_id: sessionUserId && isValidUuid(sessionUserId) ? sessionUserId : null,
      p_session_username: sessionUsername,
      p_session_role: sessionRole,
    };

    const rawRes = await invokeSupabasePostgrestRpc<Record<string, unknown>>(
      "upsert_configurator_store_quotation_atomic",
      rpcArgs,
      this.resolved
    );

    const quotationId = String(rawRes.quotationId || "");
    const quotationNo = String(rawRes.quotationNo || "");
    const syncedAt = String(rawRes.syncedAt || new Date().toISOString());

    this.auditLogs.push({
      id: `AUDIT_RPC_QUOTE_${Date.now()}`,
      timestamp: syncedAt,
      userId: sessionUsername,
      branchId: String(rawRes.branchId || branchInput || ""),
      action: "QUOTE_SNAPSHOT_CREATED",
      resourceId: quotationId,
      details: {
        quotationNo,
        totalAmount: Number(rawRes.totalAmount || reconciled.totalAmount),
        lineCount: Number(rawRes.lineCount || reconciled.lines.length),
      },
    });

    return {
      success: true,
      snapshotId: quotationId,
      timestamp: syncedAt,
      isUpdate: Boolean(rawRes.isUpdate),
      quotationId,
      quotationNo,
      revision: Number(rawRes.revision ?? 0),
      version: Number(rawRes.version ?? 1),
      organizationId: String(rawRes.organizationId || orgId),
      branchId: rawRes.branchId ? String(rawRes.branchId) : null,
      subtotal: Number(rawRes.subtotal ?? reconciled.subtotal),
      discountTotal: Number(rawRes.discountTotal ?? reconciled.discountTotal),
      taxTotal: Number(rawRes.taxTotal ?? reconciled.taxTotal),
      totalAmount: Number(rawRes.totalAmount ?? reconciled.totalAmount),
      currency: (rawRes.currency as "TRY" | "EUR") || reconciled.currency,
      lineCount: Number(rawRes.lineCount ?? reconciled.lines.length),
      autoConvertedOrder: Boolean(rawRes.autoConvertedOrder),
      salesCardId: rawRes.salesCardId ? String(rawRes.salesCardId) : null,
      salesNo: rawRes.salesNo ? String(rawRes.salesNo) : null,
      reconciledLines: reconciled.lines,
    };
  }

  async createOrUpdateQuoteItem(
    project: DesignProject,
    bom: ManufacturingBOM,
    pricing: PricingBreakdown,
    quoteId?: string,
    idempotencyKey?: string
  ): Promise<{ success: boolean; snapshotId: string; timestamp: string }> {
    const validExistingQuoteUuid = quoteId && isValidUuid(quoteId) ? quoteId : null;
    const res = await this.upsertQuotationWithOptions(project, bom, pricing, {
      quotationId: validExistingQuoteUuid,
      idempotencyKey,
    });
    return {
      success: res.success,
      snapshotId: res.quotationNo ? `${res.quotationNo} (${res.quotationId})` : res.snapshotId,
      timestamp: res.timestamp,
    };
  }

  getAuditLogs(): AuditLogEntry[] {
    return this.auditLogs;
  }
}

/**
 * Canlı Birim-Portal ERP Nesting Supabase RPC Adaptörü (`IERPAdapter` uyumlu).
 * `public.publish_configurator_erp_nesting_atomic` üzerinden `nesting_sheets`,
 * `nesting_projects` (`NST-YYYY-XXXX`), `nesting_parts` (`serializeEdgeBanding`),
 * `nesting_placements` (UUID `part_id` FK) ve `configurator_production_blueprints`
 * tablolarını tek bir PostgreSQL işleminde atomik olarak yazar.
 */
export class SupabaseErpNestingRpcAdapter implements IERPAdapter {
  private readonly resolved: ReturnType<typeof buildResolved>;
  private readonly auditLogs: AuditLogEntry[] = [];

  constructor(config?: SupabaseRpcAdapterConfig) {
    this.resolved = buildResolved(config);
  }

  isConfigured(): boolean {
    return Boolean(this.resolved.supabaseUrl && this.resolved.serviceRoleKey);
  }

  buildNestingPayload(
    project: DesignProject,
    bom: ManufacturingBOM,
    orderId = `SIP_${project.id}_v${project.version}`,
    nestingOptions?: BirimErpNestingBuildOptions
  ): BirimErpNestingExportBundle {
    const materialsMap = new Map(
      [...DEFAULT_MATERIALS, ...(project.customMaterials || [])].map((m) => [m.id, m])
    );
    return buildBirimErpNestingBundle(project, bom, materialsMap, {
      organizationId: this.resolved.defaultSession.organizationId,
      orderRef: orderId,
      createdBy: this.resolved.defaultSession.username || "birim-configurator",
      ...nestingOptions,
    });
  }

  async publishErpNestingWithOptions(
    project: DesignProject,
    bom: ManufacturingBOM,
    options?: {
      orderRef?: string;
      salesCardId?: string | null;
      quotationId?: string | null;
      idempotencyKey?: string;
      includeScmAndBxfPrograms?: boolean;
      nestingOptions?: BirimErpNestingBuildOptions;
      session?: Partial<SupabaseRpcSessionContext>;
    }
  ): Promise<LiveErpNestingRpcResult> {
    const orgId = options?.session?.organizationId || this.resolved.defaultSession.organizationId;
    if (!isValidUuid(orgId)) {
      throw new BirimSupabaseRpcError(
        `Geçersiz organizasyon UUID formatı: '${orgId}'.`,
        400,
        "22023"
      );
    }

    // 1. Uygulama Katmanı Üretim Kapısı (P0 + Doğrulanmamış Kural Engeli)
    if (bom.validationWarnings.some((w) => w.includes("ERR_"))) {
      throw new BirimSupabaseRpcError(
        "Üretim engeli (ERR_): BOM doğrulama hataları içeren tasarım ERP Nesting tablolarına aktarılamaz.",
        400,
        "22023"
      );
    }

    const unified = evaluateUnifiedEngineeringModel(project);
    if (!unified.canExportToCncAndSaw) {
      const firstErr = unified.blockingSafetyAndEngineeringErrors[0];
      throw new BirimSupabaseRpcError(
        `Üretim engeli (${firstErr?.code || "ERR_UNIFIED_GATE"}): ${
          firstErr?.message || "Tasarım kritik mühendislik hataları içeriyor."
        }`,
        400,
        "22023"
      );
    }

    const compatibility = evaluateProjectCompatibility(project);
    if (
      compatibility.overallStatus === "INCOMPATIBLE" ||
      compatibility.overallStatus === "UNVERIFIED" ||
      !unified.canApproveFinalErpRelease
    ) {
      throw new BirimSupabaseRpcError(
        `Üretim engeli (${compatibility.overallStatus}): Tasarım uyumsuz veya doğrulanmamış kurallar içeriyor, ERP/CNC'ye aktarılamaz.`,
        400,
        "22023"
      );
    }

    const orderRef = options?.orderRef || `SIP_${project.id}_v${project.version}`;
    const nestingBundle = this.buildNestingPayload(project, bom, orderRef, {
      organizationId: orgId,
      ...options?.nestingOptions,
    });

    const items: ERPBlueprintPayload["items"] = bom.cutList.map((piece) => {
      const workshops: string[] = ["ebatlama"];
      if (piece.edgeBandMeters > 0) workshops.push("kenar_bantlama");
      if ((piece.holes && piece.holes.length > 0) || piece.hasBackGroove) {
        workshops.push("cnc_delik_ve_freze");
      }
      if (piece.materialName.toLowerCase().includes("lake")) workshops.push("boyahane");
      workshops.push("montaj_paketleme");

      const conv = convertCutPieceToErpPartInput(piece, { useNetCutDimensions: true });
      return {
        piece_id: piece.id,
        label: piece.pieceName,
        material: piece.materialName,
        dimensions_mm: [piece.lengthMm, piece.widthMm, piece.thicknessMm],
        net_cut_dimensions_mm: [
          piece.netCutLengthMm ?? piece.lengthMm,
          piece.netCutWidthMm ?? piece.widthMm,
          piece.thicknessMm,
        ],
        edge_banding: {
          top: piece.edgeBanding.top,
          bottom: piece.edgeBanding.bottom,
          left: piece.edgeBanding.left,
          right: piece.edgeBanding.right,
          thickness_mm: piece.edgeBanding.thickness,
          erp_serialized_edge_banding: conv.partInput.edge_banding,
        },
        grain: piece.grain,
        workshops,
        drilling_count: piece.holes ? piece.holes.length : 0,
      };
    });

    const blueprintPayload: ERPBlueprintPayload = {
      order_id: orderRef,
      version: project.version,
      branch_id: project.branchId,
      idempotency_key: options?.idempotencyKey,
      status: "active",
      items,
      hardware_items: bom.hardwareList.map((hw) => ({
        sku: hw.sku,
        name: hw.name,
        quantity: hw.quantity,
        unit: hw.unit,
      })),
      nesting_bundle: nestingBundle,
      metadata: {
        project_id: project.id,
        project_title: project.title,
        branch_id: project.branchId,
        generated_at: new Date().toISOString(),
        library_version_id: project.libraryVersionId || "lib_v7_3_0",
        compatibility_status: compatibility.overallStatus,
        cnc_production_approved: true,
      },
    };

    const includeCam = options?.includeScmAndBxfPrograms !== false;
    const scmXcsProgram = includeCam
      ? generateProjectCncPostProcessorBundle(
          bom.cutList.map((piece) => mapCutPieceToCncPieceInput(piece))
        )
          .scmXcsFiles.map((f) => `// === ${f.fileName} ===\n${f.content}`)
          .join("\n\n")
      : null;
    const blumBxfXml = includeCam ? generateBlumBxfXml(project, bom) : null;

    const branchInput =
      options?.session?.branchIdOrCode ??
      this.resolved.defaultSession.branchIdOrCode ??
      project.branchId ??
      null;
    const sessionUserId =
      options?.session?.userId ?? this.resolved.defaultSession.userId ?? null;
    const sessionUsername =
      options?.session?.username ?? this.resolved.defaultSession.username ?? "birim-configurator";
    const sessionRole =
      options?.session?.role ?? this.resolved.defaultSession.role ?? "admin";

    const requestHash = computeCanonicalRequestHash({
      orgId,
      projectId: project.id,
      version: project.version,
      orderRef,
      salesCardId: options?.salesCardId || null,
      boardGroups: nestingBundle.summary.board_groups_count,
      totalSheets: nestingBundle.summary.total_sheets_used,
      totalParts: nestingBundle.summary.total_parts_requested,
    });

    const rpcArgs: Record<string, unknown> = {
      p_session_org_id: orgId,
      p_configurator_project_id: project.id,
      p_configurator_version: project.version,
      p_order_ref: orderRef,
      p_nesting_bundle: nestingBundle,
      p_blueprint_payload: blueprintPayload,
      p_compatibility_status: compatibility.overallStatus,
      p_can_export_production: true,
      p_sales_card_id:
        options?.salesCardId && isValidUuid(options.salesCardId) ? options.salesCardId : null,
      p_quotation_id:
        options?.quotationId && isValidUuid(options.quotationId) ? options.quotationId : null,
      p_branch_input: branchInput,
      p_scm_xcs_program: scmXcsProgram,
      p_blum_bxf_xml: blumBxfXml,
      p_idempotency_key: options?.idempotencyKey || null,
      p_request_hash: requestHash,
      p_session_user_id: sessionUserId && isValidUuid(sessionUserId) ? sessionUserId : null,
      p_session_username: sessionUsername,
      p_session_role: sessionRole,
    };

    const rawRes = await invokeSupabasePostgrestRpc<Record<string, unknown>>(
      "publish_configurator_erp_nesting_atomic",
      rpcArgs,
      this.resolved
    );

    const blueprintId = String(rawRes.blueprintId || "");
    const projectIds = Array.isArray(rawRes.nestingProjectIds)
      ? rawRes.nestingProjectIds.map(String)
      : [];
    const projectNos = Array.isArray(rawRes.nestingProjectNos)
      ? rawRes.nestingProjectNos.map(String)
      : [];
    const nestingJobs = Array.isArray(rawRes.nestingJobs)
      ? (rawRes.nestingJobs as LiveErpNestingJobRpcSummary[])
      : [];
    const publishedAt = String(rawRes.publishedAt || new Date().toISOString());

    this.auditLogs.push({
      id: `AUDIT_RPC_ERP_${Date.now()}`,
      timestamp: publishedAt,
      userId: sessionUsername,
      branchId: String(rawRes.branchId || branchInput || ""),
      action: "ERP_NESTING_BUNDLE_EXPORTED",
      resourceId: blueprintId,
      details: {
        orderRef: String(rawRes.orderRef || orderRef),
        nestingJobsCount: Number(rawRes.nestingJobsCount ?? nestingBundle.jobs.length),
        totalSheetsUsed: Number(rawRes.totalSheetsUsed ?? nestingBundle.summary.total_sheets_used),
        totalPlacementsInserted: Number(rawRes.totalPlacementsInserted ?? 0),
      },
    });

    return {
      success: true,
      blueprintId,
      orderRef: String(rawRes.orderRef || orderRef),
      itemsCount: items.length,
      nestingJobsCount: Number(rawRes.nestingJobsCount ?? nestingBundle.jobs.length),
      nestingProjectIds: projectIds,
      nestingProjectNos: projectNos,
      nestingJobs,
      totalSheetsUsed: Number(rawRes.totalSheetsUsed ?? nestingBundle.summary.total_sheets_used),
      totalPartsInserted: Number(rawRes.totalPartsInserted ?? 0),
      totalPlacementsInserted: Number(rawRes.totalPlacementsInserted ?? 0),
      overallUtilizationPercent: Number(
        rawRes.overallUtilizationPercent ?? nestingBundle.summary.overall_utilization_percent
      ),
      reclaimableRemnantsCount: Number(
        rawRes.reclaimableRemnantsCount ?? nestingBundle.summary.reclaimable_remnants_count
      ),
      nestingBundle,
      publishedAt,
    };
  }

  async publishProductionBlueprint(
    project: DesignProject,
    bom: ManufacturingBOM,
    orderId = `SIP_${project.id}_v${project.version}`,
    idempotencyKey?: string,
    nestingOptions?: BirimErpNestingBuildOptions
  ): Promise<{
    success: boolean;
    blueprintId: string;
    itemsCount: number;
    nestingJobsCount: number;
    totalSheetsUsed: number;
    nestingBundle: BirimErpNestingExportBundle;
  }> {
    const res = await this.publishErpNestingWithOptions(project, bom, {
      orderRef: orderId,
      idempotencyKey,
      nestingOptions,
    });
    return {
      success: res.success,
      blueprintId: res.blueprintId,
      itemsCount: res.itemsCount,
      nestingJobsCount: res.nestingJobsCount,
      totalSheetsUsed: res.totalSheetsUsed,
      nestingBundle: res.nestingBundle,
    };
  }

  getAuditLogs(): AuditLogEntry[] {
    return this.auditLogs;
  }
}
