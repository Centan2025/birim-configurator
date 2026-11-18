import type { CustomModuleTemplateRecord } from "./types";
import { buildTenantScopedStorageKey } from "./saas-tenant-core";

const CUSTOM_TPL_STORAGE_KEY = "birim_v5_custom_module_templates";
const BIRIM_DEFAULT_TENANT = "00000000-0000-0000-0000-000000000001";
const inMemoryCustomTemplatesByTenant = new Map<string, CustomModuleTemplateRecord[]>();

export function resolveCustomTemplatesStorageKey(tenantId?: string | null): string {
  const clean = (tenantId || BIRIM_DEFAULT_TENANT).trim();
  if (!clean || clean === BIRIM_DEFAULT_TENANT || clean.toLowerCase() === "birim") {
    return CUSTOM_TPL_STORAGE_KEY;
  }
  return buildTenantScopedStorageKey(clean, "v5_custom_module_templates");
}

export function loadSavedCustomModuleTemplates(tenantId?: string | null): CustomModuleTemplateRecord[] {
  const key = resolveCustomTemplatesStorageKey(tenantId);
  const st = typeof globalThis !== "undefined" ? (globalThis as { localStorage?: Storage }).localStorage : undefined;
  if (!st) {
    return [...(inMemoryCustomTemplatesByTenant.get(key) || [])];
  }
  try {
    const raw = st.getItem(key);
    if (!raw) return [...(inMemoryCustomTemplatesByTenant.get(key) || [])];
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      inMemoryCustomTemplatesByTenant.set(key, parsed as CustomModuleTemplateRecord[]);
      return [...(parsed as CustomModuleTemplateRecord[])];
    }
    return [];
  } catch {
    return [...(inMemoryCustomTemplatesByTenant.get(key) || [])];
  }
}

export function persistCustomModuleTemplates(
  list: CustomModuleTemplateRecord[],
  tenantId?: string | null
): void {
  const key = resolveCustomTemplatesStorageKey(tenantId);
  const sliced = list.slice(0, 60);
  inMemoryCustomTemplatesByTenant.set(key, [...sliced]);
  const st = typeof globalThis !== "undefined" ? (globalThis as { localStorage?: Storage }).localStorage : undefined;
  if (!st) return;
  try {
    st.setItem(key, JSON.stringify(sliced));
  } catch {
    // Ignore storage quota errors
  }
}
