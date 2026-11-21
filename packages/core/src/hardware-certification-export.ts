import type { HardwareProductRecord } from "@birim/catalog";
import type { DesignProject } from "./types";

export interface HardwareCertificationRow {
  id: string;
  name: string;
  brand: string;
  family: string;
  productionStatus: "production_ready" | "review_required" | "visual_only";
  cncDrillingAllowed: boolean;
  loadCapacityKg: number | null;
  system32Compatible: boolean;
  factorySignOffStatus: "APPROVED" | "PENDING_PHYSICAL_TEST" | "VISUAL_ONLY_BLOCKED";
  notes: string;
}

export interface ProjectHardwareCertificationSummary {
  totalCatalogItems: number;
  productionReadyCount: number;
  reviewRequiredCount: number;
  visualOnlyCount: number;
  projectUsedIds: string[];
  projectPendingApprovalIds: string[];
  rows: HardwareCertificationRow[];
}

/**
 * Generates a structured factory certification checklist covering the entire
 * 56-item hardware catalog and highlights items currently used in the active project.
 */
export function buildHardwareCertificationSummary(
  catalog: readonly HardwareProductRecord[],
  project?: DesignProject | null
): ProjectHardwareCertificationSummary {
  const projectUsedSet = new Set<string>();
  if (project) {
    for (const mod of project.modules) {
      const hw = (mod as unknown as { hardwarePackageId?: string; hardwareIds?: string[] });
      if (hw.hardwarePackageId) projectUsedSet.add(hw.hardwarePackageId);
      if (Array.isArray(hw.hardwareIds)) {
        for (const id of hw.hardwareIds) projectUsedSet.add(id);
      }
      for (const bay of mod.bays || []) {
        const legacyComponents = (bay as unknown as { components?: Array<{ hardwareId?: string; catalogItemId?: string }> }).components;
        for (const comp of legacyComponents || []) {
          if (comp.hardwareId) projectUsedSet.add(comp.hardwareId);
          if (comp.catalogItemId) projectUsedSet.add(comp.catalogItemId);
        }
      }
    }
  }

  let productionReadyCount = 0;
  let reviewRequiredCount = 0;
  let visualOnlyCount = 0;
  const projectPendingApprovalIds: string[] = [];

  const rows: HardwareCertificationRow[] = catalog.map((item) => {
    const raw = item as unknown as Record<string, unknown>;
    const status = (raw.productionStatus as HardwareCertificationRow["productionStatus"]) || "review_required";
    if (status === "production_ready") productionReadyCount += 1;
    else if (status === "visual_only") visualOnlyCount += 1;
    else reviewRequiredCount += 1;

    if (projectUsedSet.has(item.id) && status !== "production_ready") {
      projectPendingApprovalIds.push(item.id);
    }

    const loadCapacityKg =
      typeof raw.loadCapacityKg === "number"
        ? raw.loadCapacityKg
        : typeof raw.maxLoadKg === "number"
        ? raw.maxLoadKg
        : null;

    return {
      id: item.id,
      name: item.name,
      brand: String(raw.brand || raw.manufacturer || "Birim Standart"),
      family: String(raw.family || raw.category || "genel"),
      productionStatus: status,
      cncDrillingAllowed: status !== "visual_only",
      loadCapacityKg,
      system32Compatible: raw.system32Compatible !== false,
      factorySignOffStatus:
        status === "production_ready"
          ? "APPROVED"
          : status === "visual_only"
          ? "VISUAL_ONLY_BLOCKED"
          : "PENDING_PHYSICAL_TEST",
      notes:
        status === "production_ready"
          ? "CNC delik şablonu ve BOM Gate-07 onaylı"
          : status === "visual_only"
          ? "Yalnızca 3B görselleştirme; CNC delik üretimi kilitli"
          : "Fiziksel atölye numune ve delik ofset onayı bekleniyor",
    };
  });

  return {
    totalCatalogItems: catalog.length,
    productionReadyCount,
    reviewRequiredCount,
    visualOnlyCount,
    projectUsedIds: Array.from(projectUsedSet),
    projectPendingApprovalIds,
    rows,
  };
}

/**
 * Exports the factory hardware sign-off checklist as UTF-8 CSV (with BOM for Excel TR).
 */
export function exportHardwareCertificationCsv(
  summary: ProjectHardwareCertificationSummary
): string {
  const esc = (v: unknown) => {
    const s = String(v ?? "");
    return /[",\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const header = [
    "Donanim_ID",
    "Urun_Adi",
    "Marka",
    "Aile",
    "Uretim_Durumu",
    "CNC_Delik_Izni",
    "Yuk_Kapasitesi_Kg",
    "System32_Uyumlu",
    "Fabrika_Onay_Durumu",
    "Notlar",
  ].join(";");
  const body = summary.rows.map((r) =>
    [
      r.id,
      r.name,
      r.brand,
      r.family,
      r.productionStatus,
      r.cncDrillingAllowed ? "EVET" : "HAYIR",
      r.loadCapacityKg ?? "-",
      r.system32Compatible ? "EVET" : "HAYIR",
      r.factorySignOffStatus,
      r.notes,
    ]
      .map(esc)
      .join(";")
  );
  return "\uFEFF" + [header, ...body].join("\n");
}
