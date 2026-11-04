import {
  HardwareProductRecord,
  V4_HARDWARE_CATALOG,
  VerificationScopeFlags,
} from "./v4-hardware-catalog";
import { V4_MODULE_TEMPLATES, V4ModuleTemplateDefinition } from "./v4-module-taxonomy";

export type LibraryLifecycleState = "DRAFT" | "REVIEW" | "VERIFIED" | "PUBLISHED" | "DEPRECATED";

export interface LibraryCatalogEntry {
  id: string;
  entityType: "MODULE_TEMPLATE" | "HARDWARE_PRODUCT";
  code: string;
  name: string;
  familyOrManufacturer: string;
  lifecycleState: LibraryLifecycleState;
  sourceId: string;
  verification: VerificationScopeFlags;
  semver: string;
  updatedAt: string;
}

export interface PublishedLibraryReleaseSnapshot {
  releaseId: string;
  semver: string;
  publishedAt: string;
  publishedBy: string;
  sha256Digest: string;
  templatesCount: number;
  hardwareProductsCount: number;
}

export class V4LibraryAdminStore {
  private entries: Map<string, LibraryCatalogEntry> = new Map();
  private customHardware: HardwareProductRecord[] = [];
  private customTemplates: V4ModuleTemplateDefinition[] = [];
  private releases: PublishedLibraryReleaseSnapshot[] = [];

  constructor() {
    this.seedFromCanonicalLibrary();
  }

  private seedFromCanonicalLibrary() {
    V4_MODULE_TEMPLATES.forEach((tpl) => {
      this.entries.set(tpl.templateId, {
        id: tpl.templateId,
        entityType: "MODULE_TEMPLATE",
        code: tpl.templateId,
        name: tpl.name,
        familyOrManufacturer: tpl.familyId,
        lifecycleState: tpl.requiresFactoryValidation ? "REVIEW" : "PUBLISHED",
        sourceId: "SRC_BIRIM_FACTORY_V3",
        verification: {
          sourceTechDataVerified: true,
          cadGeometryVerified: true,
          bomFormulaVerified: true,
          drillingPatternVerified: !tpl.requiresFactoryValidation,
          physicalFactorySampleTested: !tpl.requiresFactoryValidation,
        },
        semver: "4.0.0",
        updatedAt: new Date().toISOString(),
      });
    });

    V4_HARDWARE_CATALOG.forEach((hw) => {
      this.entries.set(hw.id, {
        id: hw.id,
        entityType: "HARDWARE_PRODUCT",
        code: hw.sku,
        name: hw.name,
        familyOrManufacturer: hw.manufacturerName,
        lifecycleState: "PUBLISHED",
        sourceId: hw.sourceId,
        verification: { ...hw.verification },
        semver: "4.0.0",
        updatedAt: new Date().toISOString(),
      });
    });

    this.releases.push({
      releaseId: "rel_v4_0_0_init",
      semver: "4.0.0",
      publishedAt: new Date().toISOString(),
      publishedBy: "BIRIM_PRODUCT_ENGINEERING",
      sha256Digest: "SHA256_V4_CANONICAL_92TPL_21HW",
      templatesCount: V4_MODULE_TEMPLATES.length,
      hardwareProductsCount: V4_HARDWARE_CATALOG.length,
    });
  }

  getAllEntries(filterType?: "MODULE_TEMPLATE" | "HARDWARE_PRODUCT"): LibraryCatalogEntry[] {
    const all = Array.from(this.entries.values());
    if (!filterType) return all;
    return all.filter((e) => e.entityType === filterType);
  }

  getEntry(id: string): LibraryCatalogEntry | undefined {
    return this.entries.get(id);
  }

  createDraftHardwareEntry(params: {
    id: string;
    sku: string;
    name: string;
    manufacturerName: string;
    sourceId: string;
  }): LibraryCatalogEntry {
    const entry: LibraryCatalogEntry = {
      id: params.id,
      entityType: "HARDWARE_PRODUCT",
      code: params.sku,
      name: params.name,
      familyOrManufacturer: params.manufacturerName,
      lifecycleState: "DRAFT",
      sourceId: params.sourceId,
      verification: {
        sourceTechDataVerified: false,
        cadGeometryVerified: false,
        bomFormulaVerified: false,
        drillingPatternVerified: false,
        physicalFactorySampleTested: false,
      },
      semver: "4.1.0-draft",
      updatedAt: new Date().toISOString(),
    };
    this.entries.set(entry.id, entry);
    return entry;
  }

  updateVerificationFlags(id: string, patch: Partial<VerificationScopeFlags>): LibraryCatalogEntry | null {
    const existing = this.entries.get(id);
    if (!existing) return null;
    const updated: LibraryCatalogEntry = {
      ...existing,
      verification: { ...existing.verification, ...patch },
      updatedAt: new Date().toISOString(),
    };
    this.entries.set(id, updated);
    return updated;
  }

  transitionLifecycleState(
    id: string,
    targetState: LibraryLifecycleState
  ): { success: boolean; error?: string; entry?: LibraryCatalogEntry } {
    const existing = this.entries.get(id);
    if (!existing) {
      return { success: false, error: "Kayıt bulunamadı." };
    }

    const v = existing.verification;
    if (targetState === "VERIFIED" || targetState === "PUBLISHED") {
      if (
        !v.sourceTechDataVerified ||
        !v.cadGeometryVerified ||
        !v.bomFormulaVerified ||
        !v.drillingPatternVerified
      ) {
        return {
          success: false,
          error:
            "VERIFIED veya PUBLISHED durumuna geçiş için Kaynak Teknik Veri, CAD Geometrisi, BOM Formülü ve Delik Şablonu doğrulamaları tamamlanmış olmalıdır.",
        };
      }
      if (!existing.sourceId || existing.sourceId.trim() === "") {
        return {
          success: false,
          error: "Kaynağı (sourceId) olmayan kayıt VERIFIED veya PUBLISHED durumuna geçirilemez.",
        };
      }
    }

    const updated: LibraryCatalogEntry = {
      ...existing,
      lifecycleState: targetState,
      updatedAt: new Date().toISOString(),
    };
    this.entries.set(id, updated);
    return { success: true, entry: updated };
  }

  publishNewRelease(semver: string, publishedBy = "BIRIM_ADMIN"): PublishedLibraryReleaseSnapshot {
    const publishedEntries = Array.from(this.entries.values()).filter(
      (e) => e.lifecycleState === "PUBLISHED"
    );
    const snapshot: PublishedLibraryReleaseSnapshot = {
      releaseId: `rel_${semver.replace(/\./g, "_")}_${Date.now()}`,
      semver,
      publishedAt: new Date().toISOString(),
      publishedBy,
      sha256Digest: `SHA256_${semver}_${publishedEntries.length}_${Date.now()}`,
      templatesCount: publishedEntries.filter((e) => e.entityType === "MODULE_TEMPLATE").length,
      hardwareProductsCount: publishedEntries.filter((e) => e.entityType === "HARDWARE_PRODUCT").length,
    };
    this.releases.unshift(snapshot);
    return snapshot;
  }

  getReleases(): PublishedLibraryReleaseSnapshot[] {
    return this.releases;
  }
}

export const defaultLibraryAdminStore = new V4LibraryAdminStore();
