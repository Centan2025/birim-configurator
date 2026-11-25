import {
  buildTenantScopedStorageKey,
  parseAndMigrateProject,
  type DesignProject,
} from "@birim/core";
import {
  safeLocalStorageGet,
  safeLocalStorageRemove,
  safeLocalStorageSet,
} from "./safeStorage";

export type AutoSaveStatus = "saved" | "saving" | "unsaved";

export const AUTOSAVE_STORAGE_SUFFIX = "autosave_draft_v4";
export const MAX_UNDERLAY_DATA_URL_BYTES = 150 * 1024;

interface StoredAutoSaveEnvelope {
  savedAt: string;
  project: DesignProject;
}

/**
 * Strips oversized base64 underlay payloads (>150 KB) before writing to localStorage
 * so browser storage quotas (~5 MB) never silently break auto-save for large floor plans.
 */
export function sanitizeProjectForAutoSave(project: DesignProject): DesignProject {
  const underlay = project.space?.floorPlanUnderlay;
  if (!underlay) return project;

  const dataUrlOversized =
    typeof underlay.dataUrl === "string" && underlay.dataUrl.length > MAX_UNDERLAY_DATA_URL_BYTES;

  if (!dataUrlOversized) return project;

  return {
    ...project,
    space: {
      ...project.space,
      floorPlanUnderlay: {
        ...underlay,
        dataUrl: "",
      },
    },
  };
}

export function getAutoSaveStorageKey(tenantId: string): string {
  return buildTenantScopedStorageKey(tenantId, AUTOSAVE_STORAGE_SUFFIX);
}

export function saveAutoSaveDraftNow(tenantId: string, project: DesignProject): boolean {
  const sanitized = sanitizeProjectForAutoSave(project);
  const envelope: StoredAutoSaveEnvelope = {
    savedAt: new Date().toISOString(),
    project: sanitized,
  };
  try {
    const serialized = JSON.stringify(envelope);
    return safeLocalStorageSet(getAutoSaveStorageKey(tenantId), serialized);
  } catch {
    return false;
  }
}

export function loadAutoSavedDraft(
  tenantId: string
): { project: DesignProject; savedAt: string } | null {
  const raw = safeLocalStorageGet(getAutoSaveStorageKey(tenantId));
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<StoredAutoSaveEnvelope>;
    if (!parsed || typeof parsed !== "object" || !parsed.project) return null;
    const migrated = parseAndMigrateProject(parsed.project);
    if (!migrated.success || !migrated.data) return null;
    return {
      project: migrated.data,
      savedAt: typeof parsed.savedAt === "string" ? parsed.savedAt : new Date().toISOString(),
    };
  } catch {
    return null;
  }
}

export function clearAutoSavedDraft(tenantId: string): void {
  safeLocalStorageRemove(getAutoSaveStorageKey(tenantId));
}

export interface DebouncedDraftAutoSaver {
  schedule: (
    tenantId: string,
    project: DesignProject,
    onStatusChange?: (status: AutoSaveStatus) => void
  ) => void;
  flush: () => boolean;
  cancel: () => void;
  hasPending: () => boolean;
}

export function createDebouncedDraftAutoSaver(delayMs = 1500): DebouncedDraftAutoSaver {
  let timer: ReturnType<typeof setTimeout> | null = null;
  let pending: {
    tenantId: string;
    project: DesignProject;
    onStatusChange?: (status: AutoSaveStatus) => void;
  } | null = null;

  const flush = (): boolean => {
    if (timer !== null) {
      clearTimeout(timer);
      timer = null;
    }
    if (!pending) return false;
    const current = pending;
    pending = null;
    const ok = saveAutoSaveDraftNow(current.tenantId, current.project);
    current.onStatusChange?.(ok ? "saved" : "unsaved");
    return ok;
  };

  const cancel = (): void => {
    if (timer !== null) {
      clearTimeout(timer);
      timer = null;
    }
    pending = null;
  };

  const schedule = (
    tenantId: string,
    project: DesignProject,
    onStatusChange?: (status: AutoSaveStatus) => void
  ): void => {
    if (timer !== null) {
      clearTimeout(timer);
      timer = null;
    }
    pending = { tenantId, project, onStatusChange };
    onStatusChange?.("saving");
    timer = setTimeout(() => {
      flush();
    }, delayMs);
  };

  return {
    schedule,
    flush,
    cancel,
    hasPending: () => pending !== null,
  };
}
