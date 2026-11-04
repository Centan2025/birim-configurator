import { DesignProject } from "@birim/core";
import { ManufacturingBOM } from "@birim/manufacturing";
import { ERPBlueprintPayload, IERPAdapter, AuditLogEntry } from "./types";

export class MockERPAdapter implements IERPAdapter {
  private inMemoryBlueprints: Map<string, ERPBlueprintPayload> = new Map();
  private idempotencyRegistry: Map<string, string> = new Map();
  private auditLogs: AuditLogEntry[] = [];

  async publishProductionBlueprint(
    project: DesignProject,
    bom: ManufacturingBOM,
    orderId = "order_mock_001",
    idempotencyKey?: string
  ): Promise<{ success: boolean; blueprintId: string; itemsCount: number }> {
    // Production lock check: must be technically validated or approved
    if (bom.validationWarnings.length > 0 && bom.validationWarnings.some((w) => w.includes("ERR_"))) {
      throw new Error("Üretim engeli (ERR_): Tasarım kritik imalat hataları içeriyor, ERP'ye aktarılamaz.");
    }

    if (idempotencyKey && this.idempotencyRegistry.has(idempotencyKey)) {
      const existingId = this.idempotencyRegistry.get(idempotencyKey)!;
      const bp = this.inMemoryBlueprints.get(existingId)!;
      return {
        success: true,
        blueprintId: existingId,
        itemsCount: bp.items.length,
      };
    }

    const blueprintId = `bp_${orderId}_v${project.version}`;

    const items = bom.cutList.map((piece) => {
      const workshops: string[] = ["ebatlama"];
      if (piece.edgeBandMeters > 0) {
        workshops.push("kenar_bantlama");
      }
      if (piece.holes && piece.holes.length > 0) {
        workshops.push("cnc_delik_ve_freze");
      }
      if (piece.materialName.toLowerCase().includes("lake")) {
        workshops.push("boyahane");
      }
      workshops.push("montaj_paketleme");

      return {
        piece_id: piece.id,
        label: piece.pieceName,
        material: piece.materialName,
        dimensions_mm: [piece.lengthMm, piece.widthMm, piece.thicknessMm] as [number, number, number],
        edge_banding: {
          top: piece.edgeBanding.top,
          bottom: piece.edgeBanding.bottom,
          left: piece.edgeBanding.left,
          right: piece.edgeBanding.right,
          thickness_mm: piece.edgeBanding.thickness,
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
      metadata: {
        project_id: project.id,
        project_title: project.title,
        branch_id: project.branchId,
        generated_at: new Date().toISOString(),
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
        version: project.version,
      },
    });

    return {
      success: true,
      blueprintId,
      itemsCount: items.length,
    };
  }

  getBlueprint(blueprintId: string): ERPBlueprintPayload | undefined {
    return this.inMemoryBlueprints.get(blueprintId);
  }

  getAuditLogs(): AuditLogEntry[] {
    return this.auditLogs;
  }
}
