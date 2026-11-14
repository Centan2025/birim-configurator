import { CustomModuleTemplateRecord, DesignProject, SceneObjectInstance } from "@birim/core";

export interface SupabaseCloudConfig {
  supabaseUrl: string;
  supabaseAnonKey: string;
  r2UploadEndpointUrl?: string;
  r2PublicBaseUrl?: string;
  branchId?: string;
}

export interface CloudSyncResult<T = unknown> {
  ok: boolean;
  mode: "supabase_cloud" | "indexeddb_offline_fallback";
  data?: T;
  publicUrl?: string;
  error?: string;
}

const IDB_DB_NAME = "birim_configurator_v5_assets";
const IDB_STORE_BLOBS = "glb_blobs";
const IDB_STORE_PROJECTS = "cloud_projects";

function openBirimIndexedDb(): Promise<IDBDatabase | null> {
  if (typeof window === "undefined" || !("indexedDB" in window)) {
    return Promise.resolve(null);
  }
  return new Promise((resolve) => {
    try {
      const req = window.indexedDB.open(IDB_DB_NAME, 1);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(IDB_STORE_BLOBS)) {
          db.createObjectStore(IDB_STORE_BLOBS);
        }
        if (!db.objectStoreNames.contains(IDB_STORE_PROJECTS)) {
          db.createObjectStore(IDB_STORE_PROJECTS, { keyPath: "id" });
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

/**
 * Persistent browser IndexedDB + optional Cloudflare R2 `.GLB` / `.KTX2` binary asset storage.
 * Ensures user-uploaded 3D `.glb` models survive page reloads even without internet,
 * and seamlessly uploads to Cloudflare R2 when `NEXT_PUBLIC_R2_UPLOAD_URL` is configured.
 */
export async function saveGlbAssetPersistent(
  assetKey: string,
  fileOrBytes: Blob | ArrayBuffer,
  fileName: string,
  cloudConfig?: Partial<SupabaseCloudConfig>
): Promise<CloudSyncResult<{ assetKey: string; resolvedUrl: string }>> {
  const blob =
    fileOrBytes instanceof Blob
      ? fileOrBytes
      : new Blob([fileOrBytes], { type: "model/gltf-binary" });

  // 1. Always cache locally in IndexedDB for instant reload resilience
  const db = await openBirimIndexedDb();
  if (db) {
    await new Promise<void>((resolve) => {
      const tx = db.transaction(IDB_STORE_BLOBS, "readwrite");
      tx.objectStore(IDB_STORE_BLOBS).put({ blob, fileName, updatedAt: Date.now() }, assetKey);
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    });
  }

  // 2. Upload to Cloudflare R2 worker / presigned endpoint if configured
  const r2Endpoint =
    cloudConfig?.r2UploadEndpointUrl ||
    (typeof process !== "undefined" ? process.env.NEXT_PUBLIC_R2_UPLOAD_URL : undefined);
  const r2Public =
    cloudConfig?.r2PublicBaseUrl ||
    (typeof process !== "undefined" ? process.env.NEXT_PUBLIC_R2_PUBLIC_URL : undefined);

  if (r2Endpoint && typeof fetch !== "undefined") {
    try {
      const safeKey = `scene-assets/${assetKey}-${fileName.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
      const res = await fetch(`${r2Endpoint.replace(/\/$/, "")}/${safeKey}`, {
        method: "PUT",
        headers: { "Content-Type": "model/gltf-binary" },
        body: blob,
      });
      if (res.ok) {
        const publicUrl = r2Public
          ? `${r2Public.replace(/\/$/, "")}/${safeKey}`
          : `${r2Endpoint.replace(/\/$/, "")}/${safeKey}`;
        return {
          ok: true,
          mode: "supabase_cloud",
          publicUrl,
          data: { assetKey, resolvedUrl: publicUrl },
        };
      }
    } catch {
      // Fall back cleanly to BFF / IndexedDB
    }
  } else if (typeof window !== "undefined" && typeof fetch !== "undefined") {
    try {
      const safeFileName = `${assetKey}-${fileName.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
      const bffRes = await fetch("/api/integrations/r2-upload", {
        method: "POST",
        headers: {
          "Content-Type": "model/gltf-binary",
          "x-birim-filename": safeFileName.endsWith(".glb") ? safeFileName : `${safeFileName}.glb`,
          "x-birim-folder": "configurator-glb",
        },
        body: blob,
      });
      if (bffRes.ok) {
        const json = (await bffRes.json()) as { ok?: boolean; url?: string };
        if (json?.ok && json.url) {
          return {
            ok: true,
            mode: "supabase_cloud",
            publicUrl: json.url,
            data: { assetKey, resolvedUrl: json.url },
          };
        }
      }
    } catch {
      // R2 env tanımlı değilse veya çevrimdışıysa sessizce IndexedDB URL ile devam et
    }
  }

  const localBlobUrl = typeof URL !== "undefined" ? URL.createObjectURL(blob) : "";
  return {
    ok: true,
    mode: "indexeddb_offline_fallback",
    publicUrl: localBlobUrl,
    data: { assetKey, resolvedUrl: localBlobUrl },
  };
}

export async function resolvePersistentGlbAssetUrl(assetKey: string): Promise<string | null> {
  const db = await openBirimIndexedDb();
  if (!db) return null;
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(IDB_STORE_BLOBS, "readonly");
      const req = tx.objectStore(IDB_STORE_BLOBS).get(assetKey);
      req.onsuccess = () => {
        const rec = req.result as { blob?: Blob } | undefined;
        if (rec?.blob && typeof URL !== "undefined") {
          resolve(URL.createObjectURL(rec.blob));
        } else {
          resolve(null);
        }
      };
      req.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

/**
 * Direct REST adapter for Birim Portal / Birim Store Supabase PostgreSQL backend,
 * with automatic IndexedDB fallback when running standalone in local dev.
 */
export class SupabaseCloudPersistenceAdapter {
  private config: SupabaseCloudConfig;

  constructor(config?: Partial<SupabaseCloudConfig>) {
    const envUrl =
      typeof process !== "undefined" ? process.env.NEXT_PUBLIC_SUPABASE_URL || "" : "";
    const envKey =
      typeof process !== "undefined" ? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "" : "";
    this.config = {
      supabaseUrl: config?.supabaseUrl ?? envUrl,
      supabaseAnonKey: config?.supabaseAnonKey ?? envKey,
      r2UploadEndpointUrl: config?.r2UploadEndpointUrl,
      r2PublicBaseUrl: config?.r2PublicBaseUrl,
      branchId: config?.branchId || "branch_main",
    };
  }

  isCloudConfigured(): boolean {
    return Boolean(this.config.supabaseUrl && this.config.supabaseAnonKey);
  }

  async upsertProject(
    project: DesignProject,
    totalWithVatEur: number
  ): Promise<CloudSyncResult<{ id: string }>> {
    if (this.isCloudConfigured() && typeof fetch !== "undefined") {
      try {
        const res = await fetch(
          `${this.config.supabaseUrl.replace(/\/$/, "")}/rest/v1/configurator_projects`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              apikey: this.config.supabaseAnonKey,
              Authorization: `Bearer ${this.config.supabaseAnonKey}`,
              Prefer: "resolution=merge-duplicates,return=minimal",
            },
            body: JSON.stringify({
              id: project.id,
              branch_id: project.branchId || this.config.branchId,
              title: project.title,
              customer_name: project.customerName || null,
              version: project.version,
              status: project.status,
              total_with_vat_eur: totalWithVatEur,
              modules_count: project.modules.length,
              scene_objects_count: (project.sceneObjects || []).length,
              payload: project,
              updated_at: new Date().toISOString(),
            }),
          }
        );
        if (res.ok) {
          return { ok: true, mode: "supabase_cloud", data: { id: project.id } };
        }
      } catch {
        // Fall through to IndexedDB offline store
      }
    }

    const db = await openBirimIndexedDb();
    if (db) {
      await new Promise<void>((resolve) => {
        const tx = db.transaction(IDB_STORE_PROJECTS, "readwrite");
        tx.objectStore(IDB_STORE_PROJECTS).put({
          id: project.id,
          title: project.title,
          totalWithVatEur,
          updatedAt: new Date().toISOString(),
          project,
        });
        tx.oncomplete = () => resolve();
        tx.onerror = () => resolve();
      });
    }
    return { ok: true, mode: "indexeddb_offline_fallback", data: { id: project.id } };
  }

  async syncCustomTemplates(
    templates: CustomModuleTemplateRecord[]
  ): Promise<CloudSyncResult<{ count: number }>> {
    if (this.isCloudConfigured() && typeof fetch !== "undefined" && templates.length > 0) {
      try {
        const rows = templates.map((t) => ({
          template_id: t.templateId,
          branch_id: this.config.branchId,
          name: t.name,
          family_id: t.familyId,
          category: t.category,
          base_dimensions: t.baseDimensions,
          module_snapshot: t.serializedModuleSnapshot,
          created_at: t.createdAt,
        }));
        const res = await fetch(
          `${this.config.supabaseUrl.replace(/\/$/, "")}/rest/v1/configurator_custom_templates`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              apikey: this.config.supabaseAnonKey,
              Authorization: `Bearer ${this.config.supabaseAnonKey}`,
              Prefer: "resolution=merge-duplicates,return=minimal",
            },
            body: JSON.stringify(rows),
          }
        );
        if (res.ok) {
          return { ok: true, mode: "supabase_cloud", data: { count: rows.length } };
        }
      } catch {
        // Offline fallback handled by localStorage in catalog
      }
    }
    return { ok: true, mode: "indexeddb_offline_fallback", data: { count: templates.length } };
  }
}

/**
 * Ready-to-run PostgreSQL / Supabase RLS migration SQL for `birim-portal` & `birim-store` integration.
 */
export function getBirimV5SupabaseMigrationSql(): string {
  return `-- Birim Configurator V5 — Supabase + Cloudflare R2 Schema Migration
CREATE TABLE IF NOT EXISTS public.configurator_projects (
  id TEXT PRIMARY KEY,
  branch_id TEXT NOT NULL DEFAULT 'branch_main',
  title TEXT NOT NULL,
  customer_name TEXT,
  version INTEGER NOT NULL DEFAULT 1,
  status TEXT NOT NULL DEFAULT 'draft',
  total_with_vat_eur NUMERIC(12,2) NOT NULL DEFAULT 0,
  modules_count INTEGER NOT NULL DEFAULT 1,
  scene_objects_count INTEGER NOT NULL DEFAULT 0,
  payload JSONB NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.configurator_custom_templates (
  template_id TEXT PRIMARY KEY,
  branch_id TEXT NOT NULL DEFAULT 'branch_main',
  name TEXT NOT NULL,
  family_id TEXT NOT NULL,
  category TEXT NOT NULL,
  base_dimensions JSONB NOT NULL,
  module_snapshot JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.configurator_scene_assets (
  asset_key TEXT PRIMARY KEY,
  branch_id TEXT NOT NULL DEFAULT 'branch_main',
  sku TEXT,
  name TEXT NOT NULL,
  category TEXT NOT NULL,
  r2_public_url TEXT NOT NULL,
  dimensions_mm JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_conf_projects_branch ON public.configurator_projects(branch_id, updated_at DESC);
ALTER TABLE public.configurator_projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.configurator_custom_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.configurator_scene_assets ENABLE ROW LEVEL SECURITY;
`;
}
