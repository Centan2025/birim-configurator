import {
  DEFAULT_MATERIALS,
  DesignProject,
  evaluateProjectCompatibility,
  evaluateUnifiedEngineeringModel,
  parseAndMigrateProject,
  syncProjectCustomMaterials,
} from "@birim/core";
import { generateBOMForProject } from "@birim/manufacturing";
import { calculateProjectPrice, DEFAULT_PRICING_PARAMS } from "@birim/pricing";
import {
  BirimSupabaseRpcError,
  DEFAULT_BIRIM_ORG_UUID,
  MockStoreAdapter,
  SupabaseStoreRpcAdapter,
  buildReconciledStoreQuotationLines,
  type BirimSessionRole,
} from "@birim/integrations";

function resolveAuthoritativeProjectArtifacts(rawProject: unknown) {
  const parsedRes = parseAndMigrateProject(rawProject);
  if (!parsedRes.ok) {
    throw new BirimSupabaseRpcError(
      `Geçersiz konfigüratör proje şeması: ${parsedRes.error}`,
      400,
      "22023"
    );
  }
  const parsed = parsedRes.project;
  syncProjectCustomMaterials(parsed.customMaterials || []);
  const materialsMap = new Map(
    [...DEFAULT_MATERIALS, ...(parsed.customMaterials || [])].map((m) => [m.id, m])
  );
  const bom = generateBOMForProject(parsed, materialsMap);
  const pricing = calculateProjectPrice(
    bom,
    DEFAULT_PRICING_PARAMS,
    materialsMap,
    parsed.sceneObjects || []
  );
  const unified = evaluateUnifiedEngineeringModel(parsed);
  const compatibility = evaluateProjectCompatibility(parsed);

  return { project: parsed, bom, pricing, unified, compatibility };
}

import { resolveSharedBirimPortalEnv } from "../../../../lib/birim-portal-env";

export async function GET(): Promise<Response> {
  resolveSharedBirimPortalEnv({ hydrateProcessEnv: true });
  const adapter = new SupabaseStoreRpcAdapter();
  const configured = adapter.isConfigured();
  const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || "";
  const prodSafetyLockActive =
    supabaseUrl.includes("qchmdyiakmrfyvphbbok") &&
    process.env.BIRIM_ALLOW_PRODUCTION_SUPABASE_MUTATION !== "true";

  return Response.json({
    ok: true,
    configured,
    mode: configured ? "live_supabase_rpc" : "offline_simulation",
    rpcFunction: "public.upsert_configurator_store_quotation_atomic",
    erpRpcFunction: "public.publish_configurator_erp_nesting_atomic",
    defaultOrganizationId: process.env.BIRIM_DEFAULT_ORG_ID || DEFAULT_BIRIM_ORG_UUID,
    defaultBranchId: process.env.BIRIM_DEFAULT_BRANCH_ID || null,
    prodSafetyLockActive,
  });
}

export async function POST(req: Request): Promise<Response> {
  try {
    resolveSharedBirimPortalEnv({ hydrateProcessEnv: true });
    const body = (await req.json()) as {
      project?: unknown;
      quotationId?: string | null;
      customerId?: string | null;
      customerName?: string | null;
      currency?: "TRY" | "EUR";
      discountRatePercent?: number;
      autoConvertToOrder?: boolean;
      orderDraft?: Record<string, unknown> | null;
      idempotencyKey?: string;
      organizationId?: string;
      branchIdOrCode?: string | null;
      sessionUserId?: string | null;
      sessionUsername?: string | null;
      sessionRole?: BirimSessionRole;
      allowOfflineSimulationFallback?: boolean;
    };

    if (!body || !body.project || typeof body.project !== "object") {
      return Response.json(
        {
          ok: false,
          code: "INVALID_PROJECT_PAYLOAD",
          error: "Geçerli bir Birim Configurator proje verisi (project) gönderilmelidir.",
        },
        { status: 400 }
      );
    }

    // Sunucu Tarafı Yetkili Yeniden Hesaplama: İstemciden gelen hiçbir fiyat veya kapı bayrağına güvenilmez!
    const { project, bom, pricing, unified, compatibility } = resolveAuthoritativeProjectArtifacts(
      body.project
    );

    const headerIdempKey = req.headers.get("Idempotency-Key") || req.headers.get("idempotency-key");
    const idempotencyKey = (headerIdempKey || body.idempotencyKey || "").trim() || undefined;

    const adapter = new SupabaseStoreRpcAdapter({
      defaultSession: {
        organizationId:
          body.organizationId || process.env.BIRIM_DEFAULT_ORG_ID || DEFAULT_BIRIM_ORG_UUID,
        branchIdOrCode:
          body.branchIdOrCode ?? process.env.BIRIM_DEFAULT_BRANCH_ID ?? project.branchId ?? null,
        userId: body.sessionUserId ?? null,
        username: body.sessionUsername || "birim-configurator-bff",
        role: body.sessionRole || "sales_manager",
      },
    });

    if (!adapter.isConfigured()) {
      if (body.allowOfflineSimulationFallback) {
        const canExport =
          unified.canExportToCncAndSaw &&
          unified.canApproveFinalErpRelease &&
          compatibility.overallStatus !== "INCOMPATIBLE" &&
          compatibility.overallStatus !== "UNVERIFIED";

        if (body.autoConvertToOrder && !canExport) {
          return Response.json(
            {
              ok: false,
              code: "22023",
              error: `Mühendislik kapısı kilitli (${compatibility.overallStatus}): P0 veya doğrulanmamış kurallar içeren tasarım doğrudan siparişe dönüştürülemez.`,
            },
            { status: 400 }
          );
        }

        const mock = new MockStoreAdapter();
        const reconciled = buildReconciledStoreQuotationLines(project, bom, pricing, {
          currency: body.currency || "TRY",
          discountRatePercent: body.discountRatePercent ?? 0,
        });
        const mockQuoteNo = `TKL-${new Date().getFullYear()}-SIM1`;
        const mockRes = await mock.createOrUpdateQuoteItem(
          project,
          bom,
          pricing,
          mockQuoteNo,
          idempotencyKey
        );

        return Response.json(
          {
            ok: true,
            mode: "local_simulation_fallback",
            data: {
              success: true,
              snapshotId: mockRes.snapshotId,
              timestamp: mockRes.timestamp,
              isUpdate: Boolean(body.quotationId),
              quotationId: body.quotationId || "00000000-0000-4000-8000-000000000101",
              quotationNo: mockQuoteNo,
              revision: 0,
              version: 1,
              organizationId: body.organizationId || DEFAULT_BIRIM_ORG_UUID,
              branchId: body.branchIdOrCode || project.branchId,
              subtotal: reconciled.subtotal,
              discountTotal: reconciled.discountTotal,
              taxTotal: reconciled.taxTotal,
              totalAmount: reconciled.totalAmount,
              currency: reconciled.currency,
              lineCount: reconciled.lines.length,
              autoConvertedOrder: Boolean(body.autoConvertToOrder),
              salesCardId: body.autoConvertToOrder
                ? "00000000-0000-4000-8000-000000000202"
                : null,
              salesNo: body.autoConvertToOrder
                ? `SPR-${new Date().getFullYear()}-00001`
                : null,
              reconciledLines: reconciled.lines,
            },
          },
          { status: 200 }
        );
      }

      return Response.json(
        {
          ok: false,
          code: "SUPABASE_ENV_MISSING",
          error:
            "Canlı Supabase RPC bağlantısı için SUPABASE_URL ve SUPABASE_SERVICE_ROLE_KEY ortam değişkenleri tanımlanmalıdır.",
        },
        { status: 503 }
      );
    }

    const result = await adapter.upsertQuotationWithOptions(project, bom, pricing, {
      quotationId: body.quotationId || null,
      customerId: body.customerId || null,
      customerName: body.customerName || project.customerName || null,
      currency: body.currency || "TRY",
      discountRatePercent: body.discountRatePercent ?? 0,
      autoConvertToOrder: Boolean(body.autoConvertToOrder),
      orderDraft: body.orderDraft || null,
      idempotencyKey,
    });

    return Response.json(
      {
        ok: true,
        mode: "live_supabase_rpc",
        data: result,
      },
      { status: result.isUpdate ? 200 : 201 }
    );
  } catch (err) {
    if (err instanceof BirimSupabaseRpcError) {
      return Response.json(
        {
          ok: false,
          code: err.pgCode,
          error: err.message,
          details: err.details,
        },
        { status: err.httpStatus }
      );
    }
    return Response.json(
      {
        ok: false,
        code: "INTERNAL_ERROR",
        error: err instanceof Error ? err.message : "Birim-Store teklif aktarımı başarısız oldu.",
      },
      { status: 500 }
    );
  }
}
