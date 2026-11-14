import {
  DEFAULT_MATERIALS,
  DesignProject,
  evaluateProjectCompatibility,
  evaluateUnifiedEngineeringModel,
  parseAndMigrateProject,
  syncProjectCustomMaterials,
} from "@birim/core";
import { generateBOMForProject } from "@birim/manufacturing";
import {
  BirimSupabaseRpcError,
  DEFAULT_BIRIM_ORG_UUID,
  MockERPAdapter,
  SupabaseErpNestingRpcAdapter,
  type BirimSessionRole,
} from "@birim/integrations";

import { resolveSharedBirimPortalEnv } from "../../../../lib/birim-portal-env";

export async function POST(req: Request): Promise<Response> {
  try {
    resolveSharedBirimPortalEnv({ hydrateProcessEnv: true });
    const body = (await req.json()) as {
      project?: unknown;
      orderRef?: string;
      salesCardId?: string | null;
      quotationId?: string | null;
      idempotencyKey?: string;
      organizationId?: string;
      branchIdOrCode?: string | null;
      sessionUserId?: string | null;
      sessionUsername?: string | null;
      sessionRole?: BirimSessionRole;
      sheetWidthMm?: number;
      sheetHeightMm?: number;
      kerfMm?: number;
      edgeMarginMm?: number;
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

    // 1. Sunucu Tarafı Yetkili Geometri, Mühendislik Kapısı ve BOM Hesabı
    const parsedRes = parseAndMigrateProject(body.project);
    if (!parsedRes.ok) {
      return Response.json(
        {
          ok: false,
          code: "22023",
          error: `Geçersiz konfigüratör proje şeması: ${parsedRes.error}`,
        },
        { status: 400 }
      );
    }
    const project = parsedRes.project;
    syncProjectCustomMaterials(project.customMaterials || []);

    const unified = evaluateUnifiedEngineeringModel(project);
    const compatibility = evaluateProjectCompatibility(project);
    if (
      !unified.canExportToCncAndSaw ||
      !unified.canApproveFinalErpRelease ||
      compatibility.overallStatus === "INCOMPATIBLE" ||
      compatibility.overallStatus === "UNVERIFIED"
    ) {
      const firstErr =
        unified.blockingSafetyAndEngineeringErrors[0] ||
        unified.verificationRequiredFindings[0];
      return Response.json(
        {
          ok: false,
          code: "22023",
          error: `Üretim kapısı kilitli (${compatibility.overallStatus}): [${
            firstErr?.code || "ERR_PRODUCTION_GATE"
          }] ${
            firstErr?.message ||
            "Fiziksel olarak doğrulanmamış veya P0 hatası içeren tasarımlar ERP Nesting tablolarına aktarılamaz."
          }`,
          blockingErrorsCount: unified.blockingSafetyAndEngineeringErrors.length,
          verificationRequiredCount: unified.verificationRequiredFindings.length,
        },
        { status: 400 }
      );
    }

    const materialsMap = new Map(
      [...DEFAULT_MATERIALS, ...(project.customMaterials || [])].map((m) => [m.id, m])
    );
    const bom = generateBOMForProject(project, materialsMap);

    const headerIdempKey = req.headers.get("Idempotency-Key") || req.headers.get("idempotency-key");
    const idempotencyKey = (headerIdempKey || body.idempotencyKey || "").trim() || undefined;
    const orderRef = body.orderRef || `SIP_${project.id}_v${project.version}`;

    const nestingOptions = {
      sheetWidthMm: body.sheetWidthMm ?? 2800,
      sheetHeightMm: body.sheetHeightMm ?? 2100,
      kerfMm: body.kerfMm ?? 4,
      edgeMarginMm: body.edgeMarginMm ?? 15,
      algorithm: "Auto" as const,
      useNetCutDimensions: true,
    };

    const adapter = new SupabaseErpNestingRpcAdapter({
      defaultSession: {
        organizationId:
          body.organizationId || process.env.BIRIM_DEFAULT_ORG_ID || DEFAULT_BIRIM_ORG_UUID,
        branchIdOrCode:
          body.branchIdOrCode ?? process.env.BIRIM_DEFAULT_BRANCH_ID ?? project.branchId ?? null,
        userId: body.sessionUserId ?? null,
        username: body.sessionUsername || "birim-configurator-bff",
        role: body.sessionRole || "admin",
      },
    });

    if (!adapter.isConfigured()) {
      if (body.allowOfflineSimulationFallback) {
        const mockErp = new MockERPAdapter();
        const mockRes = await mockErp.publishProductionBlueprint(
          project,
          bom,
          orderRef,
          idempotencyKey,
          nestingOptions
        );
        const year = new Date().getFullYear();
        const simJobs = mockRes.nestingBundle.jobs.map((j, idx) => ({
          nestingProjectId: `00000000-0000-4000-8000-${String(idx + 301).padStart(12, "0")}`,
          projectNo: `NST-${year}-SIM${idx + 1}`,
          sheetId: `00000000-0000-4000-8000-${String(idx + 401).padStart(12, "0")}`,
          materialName: j.material_name,
          thicknessMm: j.thickness_mm,
          partsInserted: j.part_records.length,
          placementsInserted: j.placement_records.length,
          sheetsUsed: j.optimization_result.sheets.length,
          utilizationPercent: j.optimization_result.overall_utilization,
        }));

        return Response.json(
          {
            ok: true,
            mode: "local_simulation_fallback",
            data: {
              success: true,
              blueprintId: mockRes.blueprintId,
              orderRef,
              itemsCount: mockRes.itemsCount,
              nestingJobsCount: mockRes.nestingJobsCount,
              nestingProjectIds: simJobs.map((j) => j.nestingProjectId),
              nestingProjectNos: simJobs.map((j) => j.projectNo),
              nestingJobs: simJobs,
              totalSheetsUsed: mockRes.totalSheetsUsed,
              totalPartsInserted: simJobs.reduce((s, j) => s + j.partsInserted, 0),
              totalPlacementsInserted: simJobs.reduce((s, j) => s + j.placementsInserted, 0),
              overallUtilizationPercent:
                mockRes.nestingBundle.summary.overall_utilization_percent,
              reclaimableRemnantsCount:
                mockRes.nestingBundle.summary.reclaimable_remnants_count,
              publishedAt: new Date().toISOString(),
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
            "Canlı ERP Nesting Supabase RPC bağlantısı için SUPABASE_URL ve SUPABASE_SERVICE_ROLE_KEY ortam değişkenleri tanımlanmalıdır.",
        },
        { status: 503 }
      );
    }

    const result = await adapter.publishErpNestingWithOptions(project, bom, {
      orderRef,
      salesCardId: body.salesCardId || null,
      quotationId: body.quotationId || null,
      idempotencyKey,
      includeScmAndBxfPrograms: true,
      nestingOptions,
    });

    return Response.json(
      {
        ok: true,
        mode: "live_supabase_rpc",
        data: {
          ...result,
          // Ağ yükünü şişirmemek için ham nestingBundle istemcide zaten hesaplandığından özet alanları dönülür
          nestingBundle: undefined,
        },
      },
      { status: 201 }
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
        error: err instanceof Error ? err.message : "Birim-Portal ERP Nesting aktarımı başarısız oldu.",
      },
      { status: 500 }
    );
  }
}
