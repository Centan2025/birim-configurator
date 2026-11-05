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
  sourceRevision?: string;
  defaultDimensions?: { width: number; height: number; depth: number };
  defaultDoorSystemId?: string;
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
  entries?: LibraryCatalogEntry[];
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
        lifecycleState: "REVIEW",
        sourceId: "SRC_BIRIM_FACTORY_V3",
        sourceRevision: "3.1",
        verification: {
          sourceTechDataVerified: false,
          cadGeometryVerified: false,
          bomFormulaVerified: false,
          drillingPatternVerified: false,
          physicalFactorySampleTested: false,
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
        lifecycleState: "REVIEW",
        sourceId: hw.sourceId,
        sourceRevision: hw.revision,
        verification: {
          sourceTechDataVerified: false,
          cadGeometryVerified: false,
          bomFormulaVerified: false,
          drillingPatternVerified: false,
          physicalFactorySampleTested: false,
        },
        semver: "4.0.0",
        updatedAt: new Date().toISOString(),
      });
    });
  }

  getAllEntries(filterType?: "MODULE_TEMPLATE" | "HARDWARE_PRODUCT"): LibraryCatalogEntry[] {
    const all = Array.from(this.entries.values());
    if (!filterType) return structuredClone(all);
    return structuredClone(all.filter((e) => e.entityType === filterType));
  }

  getEntry(id: string): LibraryCatalogEntry | undefined {
    const entry = this.entries.get(id);
    return entry ? structuredClone(entry) : undefined;
  }

  createDraftHardwareEntry(params: {
    id: string;
    sku: string;
    name: string;
    manufacturerName: string;
    sourceId: string;
  }): LibraryCatalogEntry {
    if (this.entries.has(params.id)) throw new Error("Kayıt kimliği zaten var.");
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
    return structuredClone(entry);
  }

  createDraftTemplateEntry(params: {
    id: string;
    code: string;
    name: string;
    familyId: string;
    sourceId: string;
    defaultDimensions?: { width: number; height: number; depth: number };
    defaultDoorSystemId?: string;
  }): LibraryCatalogEntry {
    if (this.entries.has(params.id)) throw new Error("Şablon kimliği zaten var.");
    const entry: LibraryCatalogEntry = {
      id: params.id,
      entityType: "MODULE_TEMPLATE",
      code: params.code,
      name: params.name,
      familyOrManufacturer: params.familyId,
      lifecycleState: "DRAFT",
      sourceId: params.sourceId,
      defaultDimensions: params.defaultDimensions,
      defaultDoorSystemId: params.defaultDoorSystemId,
      verification: {
        sourceTechDataVerified: false,
        cadGeometryVerified: false,
        bomFormulaVerified: false,
        drillingPatternVerified: false,
        physicalFactorySampleTested: false,
      },
      semver: "4.2.0-draft",
      updatedAt: new Date().toISOString(),
    };
    this.entries.set(entry.id, entry);
    return structuredClone(entry);
  }

  updateVerificationFlags(id: string, patch: Partial<VerificationScopeFlags>): LibraryCatalogEntry | null {
    const existing = this.entries.get(id);
    if (!existing) return null;
    const updated: LibraryCatalogEntry = {
      ...existing,
      verification: { ...existing.verification, ...patch },
      lifecycleState: "REVIEW",
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
        !v.drillingPatternVerified ||
        !v.physicalFactorySampleTested
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

  async publishNewRelease(semver: string, publishedBy = "BIRIM_ADMIN"): Promise<PublishedLibraryReleaseSnapshot> {
    if (!/^\d+\.\d+\.\d+$/.test(semver)) throw new Error("Geçersiz sürüm.");
    if (this.releases.some((r) => r.semver === semver)) throw new Error("Sürüm zaten var.");
    const publishedEntries = Array.from(this.entries.values()).filter(
      (e) => e.lifecycleState === "PUBLISHED"
    );
    if (!publishedEntries.length) throw new Error("Yayınlanmış doğrulanmış kayıt yok.");
    const payload = JSON.stringify(publishedEntries.sort((a, b) => a.id.localeCompare(b.id)));
    const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(payload));
    const snapshot: PublishedLibraryReleaseSnapshot = {
      releaseId: `rel_${semver.replace(/\./g, "_")}_${Date.now()}`,
      semver,
      publishedAt: new Date().toISOString(),
      publishedBy,
      sha256Digest: Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join(""),
      entries: JSON.parse(payload),
      templatesCount: publishedEntries.filter((e) => e.entityType === "MODULE_TEMPLATE").length,
      hardwareProductsCount: publishedEntries.filter((e) => e.entityType === "HARDWARE_PRODUCT").length,
    };
    this.releases.unshift(snapshot);
    return structuredClone(snapshot);
  }

  getReleases(): PublishedLibraryReleaseSnapshot[] {
    return structuredClone(this.releases);
  }

  /**
   * Restores the catalog entries contained in a published release snapshot and resets newer unverified items to REVIEW.
   */
  rollbackToRelease(releaseId: string): { success: boolean; error?: string; restoredCount: number } {
    const release = this.releases.find((r) => r.releaseId === releaseId);
    if (!release || !release.entries) {
      return { success: false, error: "Hedef sürüm snapshot kaydı bulunamadı.", restoredCount: 0 };
    }
    const snapshotIds = new Set(release.entries.map((e) => e.id));
    for (const [id, entry] of this.entries.entries()) {
      if (!snapshotIds.has(id) && entry.lifecycleState === "PUBLISHED") {
        this.entries.set(id, { ...entry, lifecycleState: "REVIEW", updatedAt: new Date().toISOString() });
      }
    }
    for (const snapEntry of release.entries) {
      this.entries.set(snapEntry.id, structuredClone(snapEntry));
    }
    return { success: true, restoredCount: release.entries.length };
  }

  saveToLocalStorage(storageKey = "birim_v4_library_admin_state"): boolean {
    try {
      if (typeof localStorage === "undefined") return false;
      const payload = {
        entries: Array.from(this.entries.values()),
        releases: this.releases,
      };
      localStorage.setItem(storageKey, JSON.stringify(payload));
      return true;
    } catch {
      return false;
    }
  }

  loadFromLocalStorage(storageKey = "birim_v4_library_admin_state"): boolean {
    try {
      if (typeof localStorage === "undefined") return false;
      const raw = localStorage.getItem(storageKey);
      if (!raw) return false;
      const parsed = JSON.parse(raw) as {
        entries?: LibraryCatalogEntry[];
        releases?: PublishedLibraryReleaseSnapshot[];
      };
      if (!Array.isArray(parsed.entries)) return false;
      this.entries.clear();
      for (const e of parsed.entries) {
        if (e && typeof e.id === "string") {
          this.entries.set(e.id, e);
        }
      }
      if (Array.isArray(parsed.releases)) {
        this.releases = parsed.releases;
      }
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Invalidates any VERIFIED or PUBLISHED entries bound to `sourceId` when the primary source revision changes.
   */
  invalidateEntriesForSourceRevision(sourceId: string, newRevision: string): string[] {
    const invalidatedIds: string[] = [];
    for (const [id, entry] of this.entries.entries()) {
      if (entry.sourceId === sourceId && entry.sourceRevision !== newRevision) {
        this.entries.set(id, {
          ...entry,
          sourceRevision: newRevision,
          lifecycleState: "REVIEW",
          verification: {
            sourceTechDataVerified: false,
            cadGeometryVerified: false,
            bomFormulaVerified: false,
            drillingPatternVerified: false,
            physicalFactorySampleTested: false,
          },
          updatedAt: new Date().toISOString(),
        });
        invalidatedIds.push(id);
      }
    }
    return invalidatedIds;
  }
}

export const defaultLibraryAdminStore = new V4LibraryAdminStore();
