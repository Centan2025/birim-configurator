import { DesignProject } from "@birim/core";
import { ManufacturingBOM } from "@birim/manufacturing";
import { ERPBlueprintPayload, IERPAdapter } from "./types";

export class MockERPAdapter implements IERPAdapter {
  private inMemoryBlueprints: Map<string, ERPBlueprintPayload> = new Map();

  async publishProductionBlueprint(
    project: DesignProject,
    bom: ManufacturingBOM,
    orderId = "order_mock_001"
  ): Promise<{ success: boolean; blueprintId: string; itemsCount: number }> {
    const blueprintId = `bp_${orderId}_v${project.version}`;

    const items = bom.cutList.map((piece) => {
      // Determine workshop steps according to Birim manufacturing workflow
      const workshops: string[] = ["ebatlama"];
      if (piece.edgeBandMeters > 0) {
        workshops.push("kenar_bantlama");
      }
      if (piece.componentRole === "shelf" || piece.componentRole.includes("side") || piece.componentRole.includes("divider")) {
        workshops.push("delik_ve_freze");
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

    return {
      success: true,
      blueprintId,
      itemsCount: items.length,
    };
  }

  getBlueprint(blueprintId: string): ERPBlueprintPayload | undefined {
    return this.inMemoryBlueprints.get(blueprintId);
  }
}
