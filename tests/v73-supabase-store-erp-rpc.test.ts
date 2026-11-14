import { describe, expect, it } from "vitest";
import * as fs from "fs";
import * as path from "path";
import {
  DEFAULT_MATERIALS,
  createInitialProject,
  evaluateProjectCompatibility,
  evaluateUnifiedEngineeringModel,
} from "@birim/core";
import { generateBOMForProject } from "@birim/manufacturing";
import { calculateProjectPrice, DEFAULT_PRICING_PARAMS } from "@birim/pricing";
import {
  BirimSupabaseRpcError,
  DEFAULT_BIRIM_ORG_UUID,
  SupabaseErpNestingRpcAdapter,
  SupabaseStoreRpcAdapter,
  buildReconciledStoreQuotationLines,
  computeCanonicalRequestHash,
  isValidUuid,
  mapPostgrestRpcErrorToHttp,
} from "@birim/integrations";
import {
  GET as getStoreQuoteStatus,
  POST as postStoreQuoteRoute,
} from "../apps/configurator/src/app/api/integrations/store-quote/route";
import { POST as postErpNestingRoute } from "../apps/configurator/src/app/api/integrations/erp-nesting/route";

const STAGING_URL = "https://gmxzpwufdsjtwzshxomd.supabase.co";
const PROD_URL = "https://qchmdyiakmrfyvphbbok.supabase.co";
const TEST_SERVICE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.staging_service_role_test";
const BRANCH_KALAMIS_UUID = "8407bbdf-c03d-4aba-bcfc-17ef28c54d63";

function makeDeterministicUuid(seq: number): string {
  return `00000000-0000-4000-8000-${String(seq).padStart(12, "0")}`;
}

async function expectRpcError(
  promise: Promise<unknown>,
  expectedHttpStatus: number,
  expectedPgCode: string
): Promise<BirimSupabaseRpcError> {
  let caught: unknown = null;
  try {
    await promise;
  } catch (err) {
    caught = err;
  }
  expect(caught).toBeDefined();
  const rpcErr = caught as BirimSupabaseRpcError;
  expect(rpcErr instanceof BirimSupabaseRpcError).toBe(true);
  expect(rpcErr.httpStatus).toBe(expectedHttpStatus);
  expect(rpcErr.pgCode).toBe(expectedPgCode);
  return rpcErr;
}

/**
 * Gerçek PostgreSQL `upsert_configurator_store_quotation_atomic` ve
 * `publish_configurator_erp_nesting_atomic` davranışlarını birebir simüle eden
 * bellek-içi PostgREST `/rest/v1/rpc/...` sunucusu.
 */
function createInMemorySupabasePostgrestMock() {
  let uuidCounter = 1000;
  let quoteSeq = 40;
  let salesSeq = 500;
  let nstSeq = 10;

  const idempotencyTable = new Map<
    string,
    { requestHash: string; status: "completed" | "processing"; responsePayload: unknown }
  >();
  const savedQuotations = new Map<string, Record<string, unknown>>();
  const savedQuotationItems: Array<Record<string, unknown>> = [];
  const salesCards = new Map<string, Record<string, unknown>>();
  const configuratorProjects = new Map<string, Record<string, unknown>>();
  const nestingSheets: Array<Record<string, unknown>> = [];
  const nestingProjects: Array<Record<string, unknown>> = [];
  const nestingParts: Array<Record<string, unknown>> = [];
  const nestingPlacements: Array<Record<string, unknown>> = [];
  const blueprints: Array<Record<string, unknown>> = [];
  const rpcCalls: Array<{ rpcName: string; args: Record<string, unknown> }> = [];

  let simulateMissingRpc = false;

  const fetchImpl: typeof fetch = async (input, init) => {
    const url = typeof input === "string" ? input : input.toString();
    const rpcMatch = url.match(/\/rest\/v1\/rpc\/([a-zA-Z0-9_]+)$/);
    if (!rpcMatch) {
      return new Response(JSON.stringify({ message: "Not Found" }), { status: 404 });
    }
    const rpcName = rpcMatch[1];
    const args = JSON.parse(String(init?.body || "{}")) as Record<string, unknown>;
    rpcCalls.push({ rpcName, args });

    if (simulateMissingRpc) {
      return new Response(
        JSON.stringify({
          code: "42883",
          message: `function public.${rpcName} does not exist`,
        }),
        { status: 404 }
      );
    }

    const orgId = String(args.p_session_org_id || "");
    const role = String(args.p_session_role || "");
    const username = String(args.p_session_username || "");
    const idempKey = args.p_idempotency_key ? String(args.p_idempotency_key) : "";
    const reqHash = args.p_request_hash ? String(args.p_request_hash) : "";

    if (role === "operator" || role === "receptionist" || username.startsWith("opr_")) {
      return new Response(
        JSON.stringify({
          code: "42501",
          message: "Forbidden — Bu kullanıcı rolünün işlem yetkisi yoktur.",
        }),
        { status: 403 }
      );
    }

    if (idempKey) {
      const compositeKey = `${orgId}::${idempKey}`;
      const existing = idempotencyTable.get(compositeKey);
      if (existing) {
        if (existing.requestHash !== reqHash) {
          return new Response(
            JSON.stringify({
              code: "23505",
              message:
                "Conflict — Bu Idempotency-Key farklı parametrelerle daha önce kullanılmıştır.",
            }),
            { status: 409 }
          );
        }
        return new Response(JSON.stringify(existing.responsePayload), { status: 200 });
      }
    }

    if (rpcName === "upsert_configurator_store_quotation_atomic") {
      const incomingLines = (args.p_lines as Array<Record<string, unknown>>) || [];
      const existingQuoteId = args.p_quotation_id ? String(args.p_quotation_id) : null;
      const cfgProjId = String(args.p_configurator_project_id);
      const currency = String(args.p_currency || "TRY");

      let quoteId = existingQuoteId || makeDeterministicUuid(++uuidCounter);
      let quoteNo = `TKL-2026-${String(++quoteSeq).padStart(4, "0")}`;
      let isUpdate = false;
      let keptLines: Array<Record<string, unknown>> = [];

      if (existingQuoteId) {
        const found = savedQuotations.get(existingQuoteId);
        if (!found || found.organization_id !== orgId) {
          return new Response(
            JSON.stringify({ code: "P0002", message: "Güncellenecek teklif bulunamadı." }),
            { status: 404 }
          );
        }
        if (found.is_sold) {
          return new Response(
            JSON.stringify({
              code: "23505",
              message: "Conflict — Siparişe dönüştürülmüş teklif güncellenemez.",
            }),
            { status: 409 }
          );
        }
        isUpdate = true;
        quoteNo = String(found.quotation_no);
        const qd = (found.quotation_data as Record<string, unknown>) || {};
        const prevLines = Array.isArray(qd.lines)
          ? (qd.lines as Array<Record<string, unknown>>)
          : [];
        keptLines = prevLines.filter(
          (l) => String(l.configuratorProjectId || "") !== cfgProjId
        );
      }

      const mergedLines = [...keptLines, ...incomingLines];

      let subtotal = 0;
      let discountTotal = 0;
      let taxTotal = 0;
      let totalAmount = 0;

      for (const l of mergedLines) {
        const qty = Number(l.quantity);
        const up = Number(l.unitPrice);
        const disc = Number(l.discountAmount || 0);
        const vatRate = Number(l.vatRate ?? 20);
        const sub = Number(l.subtotal);
        const vat = Number(l.vatAmount);
        const tot = Number(l.totalPrice);

        const expNet = Math.round((up * qty - disc + Number.EPSILON) * 100) / 100;
        const expVat = Math.round((expNet * (vatRate / 100) + Number.EPSILON) * 100) / 100;
        const expTot = Math.round((expNet + expVat + Number.EPSILON) * 100) / 100;

        if (Math.abs(tot - expTot) > 0.1) {
          return new Response(
            JSON.stringify({
              code: "22023",
              message: `Satır toplam tutarı (${tot}) beklenen (${expTot}) ile uyuşmuyor.`,
            }),
            { status: 400 }
          );
        }
        subtotal = Math.round((subtotal + sub) * 100) / 100;
        discountTotal = Math.round((discountTotal + disc) * 100) / 100;
        taxTotal = Math.round((taxTotal + vat) * 100) / 100;
        totalAmount = Math.round((totalAmount + tot) * 100) / 100;
      }

      const branchUuid = isValidUuid(String(args.p_branch_input || ""))
        ? String(args.p_branch_input)
        : BRANCH_KALAMIS_UUID;

      const quoteRow: Record<string, unknown> = {
        id: quoteId,
        organization_id: orgId,
        branch_id: branchUuid,
        quotation_no: quoteNo,
        revision: 0,
        version: isUpdate ? 2 : 1,
        status: args.p_auto_convert_to_order ? "converted_to_order" : "draft",
        is_sold: Boolean(args.p_auto_convert_to_order),
        subtotal,
        discount_total: discountTotal,
        tax_total: taxTotal,
        total_amount: totalAmount,
        currency,
        quotation_data: {
          lines: mergedLines,
          studioLines: mergedLines,
          vatMode: "bottom",
          currency,
        },
      };
      savedQuotations.set(quoteId, quoteRow);

      for (let i = savedQuotationItems.length - 1; i >= 0; i--) {
        if (savedQuotationItems[i].quotation_id === quoteId) {
          savedQuotationItems.splice(i, 1);
        }
      }
      for (const l of mergedLines) {
        savedQuotationItems.push({
          quotation_id: quoteId,
          organization_id: orgId,
          sku: l.sku,
          title: l.name,
          quantity: l.quantity,
          total_price: l.totalPrice,
          currency,
        });
      }

      let salesCardId: string | null = null;
      let salesNo: string | null = null;
      if (args.p_auto_convert_to_order) {
        salesCardId = makeDeterministicUuid(++uuidCounter);
        salesNo = `SPR-2026-${String(++salesSeq).padStart(5, "0")}`;
        salesCards.set(salesCardId, {
          id: salesCardId,
          organization_id: orgId,
          sales_no: salesNo,
          quotation_id: quoteId,
          total_amount: totalAmount,
          currency,
        });
      }

      configuratorProjects.set(cfgProjId, {
        id: cfgProjId,
        organization_id: orgId,
        quotation_id: quoteId,
        sales_card_id: salesCardId,
      });

      const responsePayload = {
        success: true,
        isUpdate,
        quotationId: quoteId,
        quotationNo: quoteNo,
        revision: 0,
        version: isUpdate ? 2 : 1,
        organizationId: orgId,
        branchId: branchUuid,
        subtotal,
        discountTotal,
        taxTotal,
        totalAmount,
        currency,
        lineCount: mergedLines.length,
        autoConvertedOrder: Boolean(args.p_auto_convert_to_order),
        salesCardId,
        salesNo,
        syncedAt: "2026-11-14T12:00:00Z",
      };

      if (idempKey) {
        idempotencyTable.set(`${orgId}::${idempKey}`, {
          requestHash: reqHash,
          status: "completed",
          responsePayload,
        });
      }
      return new Response(JSON.stringify(responsePayload), { status: 200 });
    }

    if (rpcName === "publish_configurator_erp_nesting_atomic") {
      if (
        !args.p_can_export_production ||
        ["INCOMPATIBLE", "UNVERIFIED"].includes(String(args.p_compatibility_status || ""))
      ) {
        return new Response(
          JSON.stringify({
            code: "22023",
            message: "Üretim kapısı kilitli.",
          }),
          { status: 400 }
        );
      }

      const bundle = args.p_nesting_bundle as {
        jobs: Array<Record<string, unknown>>;
        summary: Record<string, number>;
        combined_selco_csv: string;
        combined_cnc_gcode: string;
      };

      const createdIds: string[] = [];
      const createdNos: string[] = [];
      const jobsSummary: Array<Record<string, unknown>> = [];
      let totalPartsInserted = 0;
      let totalPlacementsInserted = 0;
      let totalSheetsUsed = 0;

      for (const job of bundle.jobs) {
        const sheetInput = job.sheet_input as Record<string, unknown>;
        let sheetRow = nestingSheets.find(
          (s) =>
            s.organization_id === orgId &&
            s.material_type === sheetInput.material_type &&
            s.width_mm === sheetInput.width_mm &&
            s.height_mm === sheetInput.height_mm &&
            s.thickness_mm === sheetInput.thickness_mm
        );
        if (!sheetRow) {
          sheetRow = {
            id: makeDeterministicUuid(++uuidCounter),
            organization_id: orgId,
            name: sheetInput.name,
            material_type: sheetInput.material_type,
            width_mm: sheetInput.width_mm,
            height_mm: sheetInput.height_mm,
            thickness_mm: sheetInput.thickness_mm,
            kerf_mm: sheetInput.kerf_mm,
            edge_margin_mm: sheetInput.edge_margin_mm,
            is_active: true,
          };
          nestingSheets.push(sheetRow);
        }

        const projId = makeDeterministicUuid(++uuidCounter);
        const projNo = `NST-2026-${String(++nstSeq).padStart(4, "0")}`;
        const projRec = job.project_record as Record<string, unknown>;

        nestingProjects.push({
          id: projId,
          organization_id: orgId,
          project_no: projNo,
          sheet_id: sheetRow.id,
          source_type: "production_order",
          source_ref: args.p_order_ref,
          status: "optimized",
          total_sheets_used: projRec.total_sheets_used,
          utilization_percent: projRec.utilization_percent,
        });

        const partMapById = new Map<string, string>();
        const partRecords = (job.part_records as Array<Record<string, unknown>>) || [];
        partRecords.forEach((pr) => {
          const partUuid = makeDeterministicUuid(++uuidCounter);
          partMapById.set(String(pr.id), partUuid);
          nestingParts.push({
            id: partUuid,
            project_id: projId,
            part_label: pr.part_label,
            width_mm: pr.width_mm,
            height_mm: pr.height_mm,
            quantity: pr.quantity,
            can_rotate: pr.can_rotate,
            grain_direction: pr.grain_direction,
            edge_banding: pr.edge_banding,
            material_code: pr.material_code,
          });
          totalPartsInserted++;
        });

        const placementRecords = (job.placement_records as Array<Record<string, unknown>>) || [];
        placementRecords.forEach((pl) => {
          const resolvedPartUuid = partMapById.get(String(pl.part_id));
          if (!resolvedPartUuid) {
            throw new Error(`Unresolved part_id FK: ${String(pl.part_id)}`);
          }
          nestingPlacements.push({
            id: makeDeterministicUuid(++uuidCounter),
            project_id: projId,
            part_id: resolvedPartUuid,
            sheet_index: pl.sheet_index,
            x_mm: pl.x_mm,
            y_mm: pl.y_mm,
            placed_width_mm: pl.placed_width_mm,
            placed_height_mm: pl.placed_height_mm,
            is_rotated: pl.is_rotated,
          });
          totalPlacementsInserted++;
        });

        const sheetsCount = Number(projRec.total_sheets_used || 0);
        totalSheetsUsed += sheetsCount;
        createdIds.push(projId);
        createdNos.push(projNo);
        jobsSummary.push({
          nestingProjectId: projId,
          projectNo: projNo,
          sheetId: sheetRow.id,
          materialName: job.material_name,
          thicknessMm: job.thickness_mm,
          partsInserted: partRecords.length,
          placementsInserted: placementRecords.length,
          sheetsUsed: sheetsCount,
          utilizationPercent: Number(projRec.utilization_percent || 0),
        });
      }

      const blueprintId = makeDeterministicUuid(++uuidCounter);
      blueprints.push({
        id: blueprintId,
        organization_id: orgId,
        order_ref: args.p_order_ref,
        nesting_project_ids: createdIds,
        scm_xcs_program: args.p_scm_xcs_program,
        blum_bxf_xml: args.p_blum_bxf_xml,
      });

      const responsePayload = {
        success: true,
        blueprintId,
        organizationId: orgId,
        branchId: BRANCH_KALAMIS_UUID,
        orderRef: args.p_order_ref,
        nestingJobsCount: createdIds.length,
        nestingProjectIds: createdIds,
        nestingProjectNos: createdNos,
        nestingJobs: jobsSummary,
        totalSheetsUsed,
        totalPartsInserted,
        totalPlacementsInserted,
        overallUtilizationPercent: bundle.summary.overall_utilization_percent,
        reclaimableRemnantsCount: bundle.summary.reclaimable_remnants_count,
        publishedAt: "2026-11-14T12:05:00Z",
      };

      if (idempKey) {
        idempotencyTable.set(`${orgId}::${idempKey}`, {
          requestHash: reqHash,
          status: "completed",
          responsePayload,
        });
      }
      return new Response(JSON.stringify(responsePayload), { status: 200 });
    }

    return new Response(JSON.stringify({ code: "42883", message: "Unknown RPC" }), {
      status: 404,
    });
  };

  return {
    fetchImpl,
    savedQuotations,
    savedQuotationItems,
    salesCards,
    configuratorProjects,
    nestingSheets,
    nestingProjects,
    nestingParts,
    nestingPlacements,
    blueprints,
    rpcCalls,
    setSimulateMissingRpc: (v: boolean) => {
      simulateMissingRpc = v;
    },
  };
}

/**
 * EN 14749 (duvar ankrajı + beton yüzey), EN 16122 (573mm raf açıklığı <= L/300)
 * ve Blum iç çekmece (155° sıfır taşma menteşe / ara parça) kurallarının tamamını
 * geçen %100 doğrulanmış gardırop projesi üretir.
 */
function createProductionVerifiedProject() {
  const proj = createInitialProject();
  proj.title = "Birim V7.3 Canlı RPC Test Dolabı";
  proj.branchId = "branch_vadistanbul";
  const mod = proj.modules[0];
  mod.dimensions.width = 1200;
  mod.dimensions.height = 2100;
  mod.dimensions.depth = 600;
  mod.wallAnchored = true;
  mod.wallSubstrate = "concrete";
  mod.bays[0].customWidth = 573;
  // İç çekmece kapak çarpışması olmasın diye Bölme 2'yi açık/dış çekmeceli veya 155° sıfır taşma menteşeli yap
  mod.bays.forEach((b) => {
    b.drawers = [];
    if (b.door) {
      b.door.type = "single_left";
      b.door.hingeCount = 4;
    }
  });

  const unified = evaluateUnifiedEngineeringModel(proj);
  const compat = evaluateProjectCompatibility(proj);
  if (!unified.canExportToCncAndSaw || !unified.canApproveFinalErpRelease || compat.overallStatus === "INCOMPATIBLE" || compat.overallStatus === "UNVERIFIED") {
    throw new Error(
      `Test fixture is not production-verified: compat=${compat.overallStatus}, p0=${JSON.stringify(
        unified.blockingSafetyAndEngineeringErrors.map((e) => e.code)
      )}, unverified=${JSON.stringify(unified.verificationRequiredFindings.map((e) => e.code))}`
    );
  }
  return proj;
}

describe("V7.3 — Birim-Store Teklif Akışı & Birim-Portal ERP Nesting Canlı Supabase RPC Entegrasyonu", () => {
  it("1. SQL göç betiği K-03 güvenlik kurallarına, service_role izolasyonuna ve Birim-Portal nesting_sheets/placements şemasına %100 uyar", () => {
    const sqlPath = path.resolve(
      __dirname,
      "../supabase/migrations/20261114120000_birim_configurator_store_erp_rpc.sql"
    );
    const sql = fs.readFileSync(sqlPath, "utf8");

    expect(sql).toContain("CREATE OR REPLACE FUNCTION public.upsert_configurator_store_quotation_atomic(");
    expect(sql).toContain("CREATE OR REPLACE FUNCTION public.publish_configurator_erp_nesting_atomic(");
    expect(sql).toContain("SECURITY DEFINER");
    expect(sql).toContain("SET search_path TO 'public', 'pg_temp'");
    expect(sql).toContain("REVOKE ALL ON FUNCTION public.upsert_configurator_store_quotation_atomic");
    expect(sql).toContain("REVOKE ALL ON FUNCTION public.publish_configurator_erp_nesting_atomic");
    expect(sql).toContain("FROM PUBLIC, anon, authenticated;");
    expect(sql).toContain("TO service_role;");
    expect(sql).toContain("pg_advisory_xact_lock");

    const sheetInsertMatch = sql.match(/INSERT INTO public\.nesting_sheets\s*\(([\s\S]*?)\)\s*VALUES/i);
    expect(sheetInsertMatch).not.toBeNull();
    expect(sheetInsertMatch![1]).not.toContain("grain_direction");
    expect(sheetInsertMatch![1]).toContain("material_type");

    const plInsertMatch = sql.match(/INSERT INTO public\.nesting_placements\s*\(([\s\S]*?)\)\s*VALUES/i);
    expect(plInsertMatch).not.toBeNull();
    expect(plInsertMatch![1]).toContain("part_id");
    expect(plInsertMatch![1]).toContain("placed_width_mm");
    expect(plInsertMatch![1]).not.toContain("hasCollision");
  });

  it("2. buildReconciledStoreQuotationLines, convert_store_quotation_to_order_atomic için sıfır kuruş farkı (0.00 delta) üretir", () => {
    const project = createProductionVerifiedProject();
    project.sceneObjects = [
      {
        id: "so_oven_1",
        catalogItemId: "00000000-0000-4000-8000-000000000888",
        sku: "BOSCH-HBG675BB1",
        name: "Bosch Serie 8 Ankastre Fırın",
        category: "appliance_oven",
        commercialRole: "quoted_product",
        unitPriceEur: 890,
        quantity: 2,
        dimensions: { width: 595, height: 595, depth: 548 },
        position: { x: 1400, y: 0, z: 300 },
        rotationY: 0,
      },
    ];

    const matMap = new Map(DEFAULT_MATERIALS.map((m) => [m.id, m]));
    const bom = generateBOMForProject(project, matMap);
    const pricing = calculateProjectPrice(bom, DEFAULT_PRICING_PARAMS, matMap, project.sceneObjects);

    for (const disc of [0, 12.5, 25]) {
      const reconciled = buildReconciledStoreQuotationLines(project, bom, pricing, {
        currency: "TRY",
        discountRatePercent: disc,
      });
      expect(reconciled.lines.length).toBe(2);

      let sumTotal = 0;
      for (const l of reconciled.lines) {
        const expNet = Math.round((l.unitPrice * l.quantity - l.discountAmount + Number.EPSILON) * 100) / 100;
        const expVat = Math.round((expNet * (l.vatRate / 100) + Number.EPSILON) * 100) / 100;
        const expTot = Math.round((expNet + expVat + Number.EPSILON) * 100) / 100;
        expect(Math.abs(l.subtotal - expNet)).toBe(0);
        expect(Math.abs(l.totalPrice - expTot)).toBe(0);
        sumTotal = Math.round((sumTotal + l.totalPrice) * 100) / 100;
      }
      expect(Math.abs(sumTotal - reconciled.totalAmount)).toBe(0);
    }
  });

  it("3. SupabaseStoreRpcAdapter yeni TKL-2026-XXXX teklifi oluşturur ve mevcut teklifi güncellerken diğer mağaza kalemlerini korur", async () => {
    const dbMock = createInMemorySupabasePostgrestMock();
    const storeAdapter = new SupabaseStoreRpcAdapter({
      supabaseUrl: STAGING_URL,
      supabaseServiceRoleKey: TEST_SERVICE_KEY,
      fetchImpl: dbMock.fetchImpl,
      defaultSession: {
        organizationId: DEFAULT_BIRIM_ORG_UUID,
        branchIdOrCode: "branch_vadistanbul",
        role: "store_manager",
        username: "cenk_tanrikulu",
      },
    });

    const project = createProductionVerifiedProject();
    const matMap = new Map(DEFAULT_MATERIALS.map((m) => [m.id, m]));
    const bom = generateBOMForProject(project, matMap);
    const pricing = calculateProjectPrice(bom, DEFAULT_PRICING_PARAMS, matMap, []);

    const created = await storeAdapter.upsertQuotationWithOptions(project, bom, pricing, {
      customerName: "İstmarina Örnek Daire Projesi",
      idempotencyKey: "idem_store_create_1",
    });

    expect(created.success).toBe(true);
    expect(created.isUpdate).toBe(false);
    expect(created.quotationNo).toMatch(/^TKL-2026-\d{4}$/);
    expect(isValidUuid(created.quotationId)).toBe(true);
    expect(dbMock.savedQuotationItems.length).toBe(1);

    const savedQuote = dbMock.savedQuotations.get(created.quotationId)!;
    const qd = savedQuote.quotation_data as { lines: Array<Record<string, unknown>> };
    qd.lines.unshift({
      productId: "00000000-0000-4000-8000-000000000777",
      isCustom: false,
      sku: "BRM-BERJER-01",
      name: "Birim Özel Berjer",
      quantity: 2,
      unit: "adet",
      unitPrice: 25000,
      currency: "TRY",
      discountRate: 0,
      discountAmount: 0,
      vatRate: 20,
      subtotal: 50000,
      vatAmount: 10000,
      totalPrice: 60000,
    });

    project.version = 2;
    project.modules[0].dimensions.width = 1100;
    project.modules[0].bays[0].customWidth = 523;
    const bomV2 = generateBOMForProject(project, matMap);
    const pricingV2 = calculateProjectPrice(bomV2, DEFAULT_PRICING_PARAMS, matMap, []);

    const updated = await storeAdapter.upsertQuotationWithOptions(project, bomV2, pricingV2, {
      quotationId: created.quotationId,
      idempotencyKey: "idem_store_update_v2",
    });

    expect(updated.isUpdate).toBe(true);
    expect(updated.quotationNo).toBe(created.quotationNo);
    expect(updated.lineCount).toBe(2);
    expect(updated.totalAmount).toBeCloseTo(60000 + updated.reconciledLines[0].totalPrice, 2);
  });

  it("4. Tek işlemde Teklif + Sipariş dönüşümü (autoConvertToOrder) doğrulanmış tasarımda SPR- üretir, P0 hatasında 400 ile engeller", async () => {
    const dbMock = createInMemorySupabasePostgrestMock();
    const storeAdapter = new SupabaseStoreRpcAdapter({
      supabaseUrl: STAGING_URL,
      supabaseServiceRoleKey: TEST_SERVICE_KEY,
      fetchImpl: dbMock.fetchImpl,
    });

    const validProj = createProductionVerifiedProject();
    const matMap = new Map(DEFAULT_MATERIALS.map((m) => [m.id, m]));
    const bom = generateBOMForProject(validProj, matMap);
    const pricing = calculateProjectPrice(bom, DEFAULT_PRICING_PARAMS, matMap, []);

    const res = await storeAdapter.upsertQuotationWithOptions(validProj, bom, pricing, {
      autoConvertToOrder: true,
      idempotencyKey: "idem_auto_order_ok",
    });
    expect(res.autoConvertedOrder).toBe(true);
    expect(res.salesNo).toMatch(/^SPR-2026-\d{5}$/);
    expect(isValidUuid(res.salesCardId)).toBe(true);

    const unsafeProj = createInitialProject();
    unsafeProj.modules[0].dimensions.height = 2400;
    unsafeProj.modules[0].dimensions.depth = 320;
    unsafeProj.modules[0].wallAnchored = false;
    const gate = evaluateUnifiedEngineeringModel(unsafeProj);
    expect(gate.canExportToCncAndSaw).toBe(false);

    await expectRpcError(
      storeAdapter.upsertQuotationWithOptions(unsafeProj, bom, pricing, {
        autoConvertToOrder: true,
      }),
      400,
      "22023"
    );
  });

  it("5. SupabaseErpNestingRpcAdapter nesting_sheets, nesting_projects (NST-), nesting_parts ve UUID FK nesting_placements kayıtlarını atomik yazar", async () => {
    const dbMock = createInMemorySupabasePostgrestMock();
    const erpAdapter = new SupabaseErpNestingRpcAdapter({
      supabaseUrl: STAGING_URL,
      supabaseServiceRoleKey: TEST_SERVICE_KEY,
      fetchImpl: dbMock.fetchImpl,
    });

    const project = createProductionVerifiedProject();
    const matMap = new Map(DEFAULT_MATERIALS.map((m) => [m.id, m]));
    const bom = generateBOMForProject(project, matMap);

    const erpRes = await erpAdapter.publishErpNestingWithOptions(project, bom, {
      orderRef: "SPR-2026-00501",
      idempotencyKey: "idem_erp_publish_1",
    });

    expect(erpRes.success).toBe(true);
    expect(isValidUuid(erpRes.blueprintId)).toBe(true);
    expect(erpRes.nestingJobsCount).toBeGreaterThanOrEqual(1);
    expect(erpRes.nestingProjectNos[0]).toMatch(/^NST-2026-\d{4}$/);
    expect(erpRes.totalPartsInserted).toBeGreaterThan(0);
    expect(erpRes.totalPlacementsInserted).toBeGreaterThan(0);

    const insertedPartIds = new Set(dbMock.nestingParts.map((p) => String(p.id)));
    for (const pl of dbMock.nestingPlacements) {
      expect(isValidUuid(String(pl.part_id))).toBe(true);
      expect(insertedPartIds.has(String(pl.part_id))).toBe(true);
    }

    for (const sh of dbMock.nestingSheets) {
      expect(String(sh.material_type)).toMatch(/\[grain:(vertical|horizontal|none)\]/);
      expect("grain_direction" in sh).toBe(false);
    }

    expect(String(dbMock.blueprints[0].scm_xcs_program)).toContain("CreateFinishedWorkpieceBox");
    expect(String(dbMock.blueprints[0].blum_bxf_xml)).toContain("<BlumBxfDocument");
  });

  it("6. P0 veya UNVERIFIED tasarımlar ERP Nesting RPC çağrısı başlamadan 400 (22023) ile kesin olarak durdurulur", async () => {
    const dbMock = createInMemorySupabasePostgrestMock();
    const erpAdapter = new SupabaseErpNestingRpcAdapter({
      supabaseUrl: STAGING_URL,
      supabaseServiceRoleKey: TEST_SERVICE_KEY,
      fetchImpl: dbMock.fetchImpl,
    });

    const unsafeProj = createInitialProject();
    unsafeProj.modules[0].dimensions.height = 2350;
    unsafeProj.modules[0].dimensions.depth = 300;
    unsafeProj.modules[0].wallAnchored = false;

    const matMap = new Map(DEFAULT_MATERIALS.map((m) => [m.id, m]));
    const bom = generateBOMForProject(unsafeProj, matMap);

    await expectRpcError(
      erpAdapter.publishErpNestingWithOptions(unsafeProj, bom, { orderRef: "SPR-BLOCKED" }),
      400,
      "22023"
    );

    expect(dbMock.rpcCalls.length).toBe(0);
  });

  it("7. Dağıtık idempotensi aynı anahtar/özet ile tekrar çağrıda mükerrer kayıt açmaz; farklı özetle çağrıda 409 Conflict (23505) fırlatır", async () => {
    const dbMock = createInMemorySupabasePostgrestMock();
    const storeAdapter = new SupabaseStoreRpcAdapter({
      supabaseUrl: STAGING_URL,
      supabaseServiceRoleKey: TEST_SERVICE_KEY,
      fetchImpl: dbMock.fetchImpl,
    });

    const proj = createProductionVerifiedProject();
    const matMap = new Map(DEFAULT_MATERIALS.map((m) => [m.id, m]));
    const bom = generateBOMForProject(proj, matMap);
    const pricing = calculateProjectPrice(bom, DEFAULT_PRICING_PARAMS, matMap, []);

    const first = await storeAdapter.upsertQuotationWithOptions(proj, bom, pricing, {
      idempotencyKey: "idem_replay_key_01",
    });
    const replay = await storeAdapter.upsertQuotationWithOptions(proj, bom, pricing, {
      idempotencyKey: "idem_replay_key_01",
    });

    expect(replay.quotationId).toBe(first.quotationId);
    expect(replay.quotationNo).toBe(first.quotationNo);
    expect(dbMock.savedQuotations.size).toBe(1);

    await expectRpcError(
      storeAdapter.upsertQuotationWithOptions(proj, bom, pricing, {
        idempotencyKey: "idem_replay_key_01",
        discountRatePercent: 15,
      }),
      409,
      "23505"
    );
  });

  it("8. Eksik RPC (42883 -> 503), operatör yetki engeli (42501 -> 403) ve canlı üretim (qchmdyiakmrfyvphbbok) kilidi çalışır", async () => {
    expect(mapPostgrestRpcErrorToHttp("42883")).toBe(503);
    expect(mapPostgrestRpcErrorToHttp("23505")).toBe(409);
    expect(mapPostgrestRpcErrorToHttp("42501")).toBe(403);
    expect(mapPostgrestRpcErrorToHttp("P0002")).toBe(404);
    expect(mapPostgrestRpcErrorToHttp("22023")).toBe(400);

    const proj = createProductionVerifiedProject();
    const matMap = new Map(DEFAULT_MATERIALS.map((m) => [m.id, m]));
    const bom = generateBOMForProject(proj, matMap);
    const pricing = calculateProjectPrice(bom, DEFAULT_PRICING_PARAMS, matMap, []);

    const prodBlockedAdapter = new SupabaseStoreRpcAdapter({
      supabaseUrl: PROD_URL,
      supabaseServiceRoleKey: TEST_SERVICE_KEY,
    });
    await expectRpcError(
      prodBlockedAdapter.upsertQuotationWithOptions(proj, bom, pricing),
      403,
      "PROD_SAFETY_LOCK"
    );

    const dbMock = createInMemorySupabasePostgrestMock();
    const operatorAdapter = new SupabaseStoreRpcAdapter({
      supabaseUrl: STAGING_URL,
      supabaseServiceRoleKey: TEST_SERVICE_KEY,
      fetchImpl: dbMock.fetchImpl,
      defaultSession: {
        organizationId: DEFAULT_BIRIM_ORG_UUID,
        role: "operator",
        username: "opr_cnc_01",
      },
    });
    await expectRpcError(
      operatorAdapter.upsertQuotationWithOptions(proj, bom, pricing),
      403,
      "42501"
    );

    dbMock.setSimulateMissingRpc(true);
    const managerAdapter = new SupabaseStoreRpcAdapter({
      supabaseUrl: STAGING_URL,
      supabaseServiceRoleKey: TEST_SERVICE_KEY,
      fetchImpl: dbMock.fetchImpl,
    });
    await expectRpcError(
      managerAdapter.upsertQuotationWithOptions(proj, bom, pricing),
      503,
      "42883"
    );
  });

  it("9. Next.js BFF rotaları (/api/integrations/store-quote & /api/integrations/erp-nesting) sunucu tarafında yetkili yeniden hesaplama yapar", async () => {
    const dbMock = createInMemorySupabasePostgrestMock();
    const origFetch = globalThis.fetch;
    const origUrl = process.env.SUPABASE_URL;
    const origKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    try {
      globalThis.fetch = dbMock.fetchImpl;
      process.env.SUPABASE_URL = STAGING_URL;
      process.env.SUPABASE_SERVICE_ROLE_KEY = TEST_SERVICE_KEY;

      const healthRes = await getStoreQuoteStatus();
      const healthJson = (await healthRes.json()) as { configured: boolean; mode: string };
      expect(healthJson.configured).toBe(true);
      expect(healthJson.mode).toBe("live_supabase_rpc");

      const proj = createProductionVerifiedProject();
      const quoteReq = new Request("http://localhost:3300/api/integrations/store-quote", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Idempotency-Key": `bff_quote_${computeCanonicalRequestHash(proj.id).slice(0, 12)}`,
        },
        body: JSON.stringify({
          project: proj,
          customerName: "BFF Entegrasyon Müşterisi",
          autoConvertToOrder: true,
        }),
      });
      const quoteRes = await postStoreQuoteRoute(quoteReq);
      expect(quoteRes.status).toBe(201);
      const quoteBody = (await quoteRes.json()) as {
        ok: boolean;
        mode: string;
        data: { quotationId: string; quotationNo: string; salesCardId: string; salesNo: string };
      };
      expect(quoteBody.ok).toBe(true);
      expect(quoteBody.mode).toBe("live_supabase_rpc");
      expect(quoteBody.data.salesNo).toMatch(/^SPR-2026-/);

      const erpReq = new Request("http://localhost:3300/api/integrations/erp-nesting", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Idempotency-Key": `bff_erp_${computeCanonicalRequestHash(proj.id).slice(0, 12)}`,
        },
        body: JSON.stringify({
          project: proj,
          orderRef: quoteBody.data.salesNo,
          salesCardId: quoteBody.data.salesCardId,
          quotationId: quoteBody.data.quotationId,
        }),
      });
      const erpRes = await postErpNestingRoute(erpReq);
      expect(erpRes.status).toBe(201);
      const erpBody = (await erpRes.json()) as {
        ok: boolean;
        mode: string;
        data: { blueprintId: string; nestingProjectNos: string[]; totalPlacementsInserted: number };
      };
      expect(erpBody.ok).toBe(true);
      expect(erpBody.mode).toBe("live_supabase_rpc");
      expect(erpBody.data.nestingProjectNos.length).toBeGreaterThan(0);
      expect(erpBody.data.totalPlacementsInserted).toBeGreaterThan(0);
    } finally {
      globalThis.fetch = origFetch;
      if (origUrl === undefined) delete process.env.SUPABASE_URL;
      else process.env.SUPABASE_URL = origUrl;
      if (origKey === undefined) delete process.env.SUPABASE_SERVICE_ROLE_KEY;
      else process.env.SUPABASE_SERVICE_ROLE_KEY = origKey;
    }
  });
});
