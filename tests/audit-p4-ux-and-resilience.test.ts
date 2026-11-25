import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  createInitialProject,
  Dimensions3DSchema,
  Position3DSchema,
  Rotation3DSchema,
  TENANT_BIRIM_ENTERPRISE,
} from "@birim/core";
import {
  clearAutoSavedDraft,
  createDebouncedDraftAutoSaver,
  loadAutoSavedDraft,
  MAX_UNDERLAY_DATA_URL_BYTES,
  sanitizeProjectForAutoSave,
  saveAutoSaveDraftNow,
  type AutoSaveStatus,
} from "../apps/configurator/src/lib/draftAutoSave";
import { safeLocalStorageGet, safeLocalStorageSet } from "../apps/configurator/src/lib/safeStorage";

describe("Audit Phase 4 — UX Resilience, Auto-Save, Safe Storage & Schema Bounds", () => {
  const tenantId = TENANT_BIRIM_ENTERPRISE.tenantId;

  beforeEach(() => {
    clearAutoSavedDraft(tenantId);
  });

  afterEach(() => {
    vi.useRealTimers();
    clearAutoSavedDraft(tenantId);
  });

  it("rejects NaN and Infinity in Dimensions3DSchema, Position3DSchema, and Rotation3DSchema", () => {
    expect(Dimensions3DSchema.safeParse({ width: 600, height: 2200, depth: 600 }).success).toBe(true);
    expect(Dimensions3DSchema.safeParse({ width: Number.NaN, height: 2200, depth: 600 }).success).toBe(false);
    expect(Dimensions3DSchema.safeParse({ width: Infinity, height: 2200, depth: 600 }).success).toBe(false);

    expect(Position3DSchema.safeParse({ x: 0, y: 0, z: 0 }).success).toBe(true);
    expect(Position3DSchema.safeParse({ x: Number.POSITIVE_INFINITY, y: 0, z: 0 }).success).toBe(false);
    expect(Position3DSchema.safeParse({ x: 0, y: Number.NaN, z: 0 }).success).toBe(false);

    expect(Rotation3DSchema.safeParse({ x: 0, y: 90, z: 0 }).success).toBe(true);
    expect(Rotation3DSchema.safeParse({ x: 0, y: Number.NEGATIVE_INFINITY, z: 0 }).success).toBe(false);
  });

  it("strips oversized base64 floorPlanUnderlay.dataUrl (>150KB) before auto-save persistence", () => {
    const proj = createInitialProject();
    const oversizedDataUrl = `data:image/png;base64,${"A".repeat(MAX_UNDERLAY_DATA_URL_BYTES + 1024)}`;
    proj.space = {
      ...proj.space,
      floorPlanUnderlay: {
        fileName: "plan.png",
        fileType: "image",
        scaleMmPerUnit: 1,
        dataUrl: oversizedDataUrl,
        widthMm: 4000,
        depthMm: 3000,
        offsetXMm: 0,
        offsetZMm: 0,
        opacity: 0.5,
      },
    };

    const sanitized = sanitizeProjectForAutoSave(proj);
    expect(sanitized.space?.floorPlanUnderlay?.dataUrl).toBe("");
    // Original project reference remains intact in memory
    expect(proj.space?.floorPlanUnderlay?.dataUrl).toBe(oversizedDataUrl);
  });

  it("persists and reloads a tenant-scoped auto-saved draft cleanly", () => {
    const proj = createInitialProject();
    proj.title = "Faz 4 Otomatik Taslak Testi";

    saveAutoSaveDraftNow(tenantId, proj);
    const restored = loadAutoSavedDraft(tenantId);
    expect(restored).not.toBeNull();
    expect(restored?.project.title).toBe("Faz 4 Otomatik Taslak Testi");
    expect(restored?.project.modules.length).toBe(proj.modules.length);
  });

  it("debounces auto-save writes and transitions status saving -> saved on flush/timer", () => {
    vi.useFakeTimers();
    const proj = createInitialProject();
    proj.title = "Debounced Draft";
    const statuses: AutoSaveStatus[] = [];

    const saver = createDebouncedDraftAutoSaver(1500);
    saver.schedule(tenantId, proj, (st) => statuses.push(st));

    expect(statuses).toEqual(["saving"]);
    expect(saver.hasPending()).toBe(true);

    vi.advanceTimersByTime(1500);
    expect(saver.hasPending()).toBe(false);
    expect(statuses.length).toBe(2);
    expect(loadAutoSavedDraft(tenantId)?.project.title).toBe("Debounced Draft");
  });

  it("falls back safely to memory cache when localStorage is unavailable or throws", () => {
    const key = "audit_p4_safe_storage_test_key";
    safeLocalStorageSet(key, "ok_value");
    expect(safeLocalStorageGet(key)).toBe("ok_value");
  });
});
