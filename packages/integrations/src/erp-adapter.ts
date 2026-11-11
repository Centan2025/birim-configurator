import {
  DEFAULT_MATERIALS,
  DesignProject,
  evaluateProjectCompatibility,
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
    const materialsMap = new Map(DEFAULT_MATERIALS.map((m) => [m.id, m]));
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

    const compatibility = evaluateProjectCompatibility(project);
    if (compatibility.overallStatus === "INCOMPATIBLE" || compatibility.overallStatus === "UNVERIFIED") {
      throw new Error(
        `Üretim engeli (${compatibility.overallStatus}): Tasarım uyumsuz kurallar içeriyor, ERP/CNC'ye aktarılamaz.`
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
