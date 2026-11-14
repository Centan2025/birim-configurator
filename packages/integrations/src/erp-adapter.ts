import {
  DEFAULT_MATERIALS,
  DesignProject,
  evaluateProjectCompatibility,
  evaluateUnifiedEngineeringModel,
} from "@birim/core";
import {
  ManufacturingBOM,
  buildBirimErpNestingBundle,
  convertCutPieceToErpPartInput,
  type BirimErpNestingBuildOptions,
  type BirimErpNestingExportBundle,
} from "@birim/manufacturing";
import { ERPBlueprintPayload, IERPAdapter, AuditLogEntry } from "./types";

export class MockERPAdapter implements IERPAdapter {
  private inMemoryBlueprints: Map<string, ERPBlueprintPayload> = new Map();
  private idempotencyRegistry: Map<string, string> = new Map();
  private auditLogs: AuditLogEntry[] = [];

  buildNestingPayload(
    project: DesignProject,
    bom: ManufacturingBOM,
    orderId = `SIPARIS_${project.id}`,
    nestingOptions?: BirimErpNestingBuildOptions
  ): BirimErpNestingExportBundle {
    const materialsMap = new Map([...DEFAULT_MATERIALS, ...(project.customMaterials || [])].map((m) => [m.id, m]));
    return buildBirimErpNestingBundle(project, bom, materialsMap, {
      organizationId: project.branchId || "org_birim_fabrika",
      orderRef: orderId,
      ...nestingOptions,
    });
  }

  async publishProductionBlueprint(
    project: DesignProject,
    bom: ManufacturingBOM,
    orderId = "order_mock_001",
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
    if (
      bom.validationWarnings.length > 0 &&
      bom.validationWarnings.some((w) => w.includes("ERR_"))
    ) {
      throw new Error(
        "Üretim engeli (ERR_): Tasarım kritik imalat hataları içeriyor, ERP'ye aktarılamaz."
      );
    }

    const unified = evaluateUnifiedEngineeringModel(project);
    if (!unified.canExportToCncAndSaw) {
      const firstErr = unified.blockingSafetyAndEngineeringErrors[0];
      throw new Error(
        `Üretim engeli (${firstErr?.code || "ERR_UNIFIED_GATE"}): ${firstErr?.message || "Tasarım kritik mühendislik hataları içeriyor, ERP/CNC'ye aktarılamaz."}`
      );
    }
    const compatibility = evaluateProjectCompatibility(project);
    if (
      compatibility.overallStatus === "INCOMPATIBLE" ||
      compatibility.overallStatus === "UNVERIFIED" ||
      !unified.canApproveFinalErpRelease
    ) {
      throw new Error(
        `Üretim engeli (${compatibility.overallStatus}): Tasarım uyumsuz veya doğrulanmamış kurallar içeriyor, ERP/CNC'ye aktarılamaz.`
      );
    }

    if (idempotencyKey && this.idempotencyRegistry.has(idempotencyKey)) {
      const existingId = this.idempotencyRegistry.get(idempotencyKey)!;
      const bp = this.inMemoryBlueprints.get(existingId)!;
      return {
        success: true,
        blueprintId: existingId,
        itemsCount: bp.items.length,
        nestingJobsCount: bp.nesting_bundle.jobs.length,
        totalSheetsUsed: bp.nesting_bundle.summary.total_sheets_used,
        nestingBundle: bp.nesting_bundle,
      };
    }

    const blueprintId = `bp_${orderId}_v${project.version}`;
    const nestingBundle = this.buildNestingPayload(
      project,
      bom,
      orderId,
      nestingOptions
    );

    const items = bom.cutList.map((piece) => {
      const workshops: string[] = ["ebatlama"];
      if (piece.edgeBandMeters > 0) {
        workshops.push("kenar_bantlama");
      }
      if ((piece.holes && piece.holes.length > 0) || piece.hasBackGroove) {
        workshops.push("cnc_delik_ve_freze");
      }
      if (piece.materialName.toLowerCase().includes("lake")) {
        workshops.push("boyahane");
      }
      workshops.push("montaj_paketleme");

      const conv = convertCutPieceToErpPartInput(piece, {
        useNetCutDimensions: true,
      });

      return {
        piece_id: piece.id,
        label: piece.pieceName,
        material: piece.materialName,
        dimensions_mm: [
          piece.lengthMm,
          piece.widthMm,
          piece.thicknessMm,
        ] as [number, number, number],
        net_cut_dimensions_mm: [
          piece.netCutLengthMm ?? piece.lengthMm,
          piece.netCutWidthMm ?? piece.widthMm,
          piece.thicknessMm,
        ] as [number, number, number],
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

    const hardware_items = bom.hardwareList.map((hw) => ({
      sku: hw.sku,
      name: hw.name,
      quantity: hw.quantity,
      unit: hw.unit,
    }));

    const payload: ERPBlueprintPayload = {
      order_id: orderId,
      version: project.version,
      branch_id: project.branchId,
      idempotency_key: idempotencyKey,
      status: "draft",
      items,
      hardware_items,
      nesting_bundle: nestingBundle,
      metadata: {
        project_id: project.id,
        project_title: project.title,
        branch_id: project.branchId,
        generated_at: new Date().toISOString(),
        library_version_id: project.libraryVersionId || "lib_v4_0_0",
        compatibility_status: compatibility.overallStatus,
        cnc_production_approved: compatibility.canApproveProduction,
      },
    };

    this.inMemoryBlueprints.set(blueprintId, payload);
    if (idempotencyKey) {
      this.idempotencyRegistry.set(idempotencyKey, blueprintId);
    }

    this.auditLogs.push({
      id: `AUDIT_${Date.now()}`,
      timestamp: new Date().toISOString(),
      userId: "ERP_INTEGRATION_SERVICE",
      branchId: project.branchId,
      action: "PRODUCTION_BLUEPRINT_EXPORTED",
      resourceId: blueprintId,
      details: {
        orderId,
        itemsCount: items.length,
        nestingJobsCount: nestingBundle.jobs.length,
        totalSheetsUsed: nestingBundle.summary.total_sheets_used,
        version: project.version,
      },
    });

    return {
      success: true,
      blueprintId,
      itemsCount: items.length,
      nestingJobsCount: nestingBundle.jobs.length,
      totalSheetsUsed: nestingBundle.summary.total_sheets_used,
      nestingBundle,
    };
  }

  getBlueprint(blueprintId: string): ERPBlueprintPayload | undefined {
    return this.inMemoryBlueprints.get(blueprintId);
  }

  getAuditLogs(): AuditLogEntry[] {
    return this.auditLogs;
  }
}


export interface RemnantSheetRecord {
  remnantId: string;
  materialId: string;
  materialName: string;
  lengthMm: number;
  widthMm: number;
  areaM2: number;
  sourceOrderId: string;
  createdAt: string;
}

const REMNANT_STORAGE_KEY = "birim_erp_remnant_stock_v1";

export function listSavedRemnantSheets(): RemnantSheetRecord[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(REMNANT_STORAGE_KEY);
    return raw ? (JSON.parse(raw) as RemnantSheetRecord[]) : [];
  } catch {
    return [];
  }
}

export function registerBomRemnantsToStock(
  bom: ManufacturingBOM,
  orderId: string
): RemnantSheetRecord[] {
  const created: RemnantSheetRecord[] = [];
  bom.nestingResults.forEach((nr) => {
    nr.sheets.forEach((sh, sIdx) => {
      (sh.usableRemnants || []).forEach((rm, rIdx) => {
        const areaM2 = Math.round(((rm.length * rm.width) / 1_000_000) * 1000) / 1000;
        if (areaM2 >= 0.45) {
          created.push({
            remnantId: `REM_${orderId}_${sIdx + 1}_${rIdx + 1}`,
            materialId: nr.materialId,
            materialName: sh.materialName,
            lengthMm: rm.length,
            widthMm: rm.width,
            areaM2,
            sourceOrderId: orderId,
            createdAt: new Date().toISOString(),
          });
        }
      });
    });
  });

  if (typeof window !== "undefined" && created.length > 0) {
    try {
      const existing = listSavedRemnantSheets().filter((r) => r.sourceOrderId !== orderId);
      window.localStorage.setItem(
        REMNANT_STORAGE_KEY,
        JSON.stringify([...created, ...existing].slice(0, 120))
      );
    } catch {
      // Ignore quota errors
    }
  }
  return created;
}

/**
 * Production-ready Hybrid Supabase/REST + Offline Persistent ERP Adapter.
 * Automatically dispatches to `NEXT_PUBLIC_BIRIM_PORTAL_API_URL` or Supabase REST when configured,
 * while registering reusable offcut remnants (`>= 0.45 m²`) to stock.
 */
export class BirimHybridERPAdapter extends MockERPAdapter {
  constructor(
    private readonly endpointUrl?: string,
    private readonly apiKey?: string
  ) {
    super();
  }

  override async publishProductionBlueprint(
    project: DesignProject,
    bom: ManufacturingBOM,
    orderId = `SIP_${project.id}`,
    idempotencyKey?: string,
    nestingOptions?: BirimErpNestingBuildOptions
  ) {
    const baseRes = await super.publishProductionBlueprint(
      project,
      bom,
      orderId,
      idempotencyKey,
      nestingOptions
    );
    registerBomRemnantsToStock(bom, orderId);

    const apiBase =
      this.endpointUrl ||
      (typeof process !== "undefined"
        ? process.env?.NEXT_PUBLIC_BIRIM_PORTAL_API_URL || process.env?.NEXT_PUBLIC_SUPABASE_URL
        : undefined);

    if (apiBase && typeof fetch === "function") {
      try {
        const headers: Record<string, string> = {
          "Content-Type": "application/json",
        };
        if (this.apiKey) {
          headers["apikey"] = this.apiKey;
          headers["Authorization"] = `Bearer ${this.apiKey}`;
        }
        await fetch(`${apiBase.replace(/\/$/, "")}/rest/v1/production_blueprints`, {
          method: "POST",
          headers,
          body: JSON.stringify({
            blueprint_id: baseRes.blueprintId,
            order_id: orderId,
            project_id: project.id,
            items_count: baseRes.itemsCount,
            sheets_used: baseRes.totalSheetsUsed,
            nesting_bundle: baseRes.nestingBundle,
          }),
        });
      } catch {
        // Keep local blueprint commit if remote network is unreachable
      }
    }
    return baseRes;
  }
}
