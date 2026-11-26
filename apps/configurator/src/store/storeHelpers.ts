import { DesignProject, createInitialProject, ValidationIssue, createDefaultWardrobeModule, ModuleInstance, evaluateProjectCompatibility, evaluateUnifiedEngineeringModel, SUPPORTED_PROJECT_SCHEMA_VERSION, TENANT_BIRIM_ENTERPRISE, buildTenantScopedStorageKey, type TenantWorkspaceProfile } from "@birim/core";
import { generateBOMForProject, ManufacturingBOM } from "@birim/manufacturing";
import { calculateProjectPrice, PricingBreakdown } from "@birim/pricing";
import { computeNestingAsync } from "../workers/manufacturing-worker-client";
import { analyzeAndAdviseSpan, SmartAdvisorFeedback } from "@birim/catalog";
import { useConfiguratorStore, type LiveChangeImpactSummary } from "./useConfiguratorStore";

export const sessionUnderlayDataCache = new Map<string, string>();

/**
 * Adaptive Undo/Redo history cap based on device RAM & CPU cores so 4GB RAM / mobile
 * browsers never accumulate 50 deep DesignProject clones in memory.
 */
export function getAdaptiveMaxHistoryEntries(): number {
  if (typeof navigator === "undefined") return 40;
  const memGb = (navigator as unknown as { deviceMemory?: number }).deviceMemory;
  const cores = navigator.hardwareConcurrency || 4;
  if ((typeof memGb === "number" && memGb <= 4) || cores <= 4) {
    return 18;
  }
  if (typeof memGb === "number" && memGb <= 8) {
    return 32;
  }
  return 50;
}

export function cloneSingleModule(m: ModuleInstance): ModuleInstance {
  return {
    ...m,
    dimensions: { ...m.dimensions },
    position: { ...m.position },
    rotation: m.rotation ? { ...m.rotation } : { x: 0, y: 0, z: 0 },
    componentMaterialOverrides: m.componentMaterialOverrides
      ? { ...m.componentMaterialOverrides }
      : undefined,
    componentGrainOverrides: m.componentGrainOverrides
      ? { ...m.componentGrainOverrides }
      : undefined,
    carcass: {
      ...m.carcass,
      customCadPolygon: m.carcass.customCadPolygon
        ? m.carcass.customCadPolygon.map((pt) => ({ ...pt }))
        : undefined,
    },
    bays: m.bays.map((b) => ({
      ...b,
      door: {
        ...b.door,
        customCadPolygon: b.door.customCadPolygon
          ? b.door.customCadPolygon.map((pt) => ({ ...pt }))
          : undefined,
      },
      shelves: b.shelves.map((s) => ({ ...s })),
      drawers: b.drawers.map((d) => ({ ...d })),
      hangingRails: b.hangingRails.map((r) => ({ ...r })),
      specialFittings: b.specialFittings ? b.specialFittings.map((f) => ({ ...f })) : [],
      subDividers: b.subDividers ? b.subDividers.map((sd) => ({ ...sd })) : [],
    })),
  };
}

export function cloneProject(project: DesignProject, onlyModuleIndex?: number): DesignProject {
  const nextVersion = (project.version || 1) + 1;
  const isSingleModule =
    typeof onlyModuleIndex === "number" &&
    onlyModuleIndex >= 0 &&
    onlyModuleIndex < project.modules.length;
  return {
    ...project,
    status: "draft",
    version: nextVersion,
    schemaVersion: SUPPORTED_PROJECT_SCHEMA_VERSION,
    catalogVersion: project.catalogVersion || project.libraryVersionId || "lib_v4_0_0",
    revisionId: `rev_v${nextVersion}`,
    updatedAt: new Date().toISOString(),
    // O(1) structural sharing: tek modül mutasyonlarında space ve diğer N-1 modül referansları korunur
    space: isSingleModule
      ? project.space
      : {
          ...project.space,
          walls: project.space.walls.map((w) => ({
            ...w,
            position: { ...w.position },
            elements: w.elements
              ? w.elements.map((el) => ({
                  ...el,
                  position: { ...el.position },
                  dimensions: { ...el.dimensions },
                }))
              : [],
          })),
          elements: project.space.elements
            ? project.space.elements.map((el) => ({
                ...el,
                position: { ...el.position },
                dimensions: { ...el.dimensions },
              }))
            : [],
          floorPlanUnderlay: project.space.floorPlanUnderlay
            ? { ...project.space.floorPlanUnderlay }
            : undefined,
        },
    sceneObjects: project.sceneObjects || [],
    customModuleTemplates: project.customModuleTemplates || [],
    modules: isSingleModule
      ? project.modules.map((m, idx) => (idx === onlyModuleIndex ? cloneSingleModule(m) : m))
      : project.modules.map((m) => cloneSingleModule(m)),
  };
}


let activeRuntimeTenantProfile: TenantWorkspaceProfile = structuredClone(TENANT_BIRIM_ENTERPRISE);

export function getActiveRuntimeTenantProfile(): TenantWorkspaceProfile {
  return activeRuntimeTenantProfile;
}

export function setActiveRuntimeTenantProfile(profile: TenantWorkspaceProfile): void {
  activeRuntimeTenantProfile = structuredClone(profile);
}

export function buildActiveTenantSheetConfig(profile: TenantWorkspaceProfile) {
  const c = profile.construction;
  return {
    name: `${profile.brand.displayName} Standart Levha ${c.standardSheetLengthMm}x${c.standardSheetWidthMm}`,
    lengthMm: c.standardSheetLengthMm,
    widthMm: c.standardSheetWidthMm,
    trimCutMm: c.edgeTrimMarginMm,
    kerfMm: c.sawKerfMm,
  };
}

export function buildActiveTenantPricingParams(profile: TenantWorkspaceProfile) {
  if (profile.tenantId === TENANT_BIRIM_ENTERPRISE.tenantId &&
      profile.pricing.currency === "EUR" &&
      profile.pricing.dealerDiscountPercent === 0 &&
      profile.pricing.targetMarginPercent === 35 &&
      profile.pricing.wasteFactorPercent === 12) {
    return undefined;
  }
  const c = profile.construction;
  return {
    ...profile.pricing,
    standardSheetAreaM2: (c.standardSheetLengthMm * c.standardSheetWidthMm) / 1_000_000,
  };
}

export function getTenantProjectsStorageKey(tenantId: string): string {
  if (!tenantId || tenantId === TENANT_BIRIM_ENTERPRISE.tenantId) {
    return "birim_saved_projects";
  }
  return buildTenantScopedStorageKey(tenantId, "saved_projects");
}

export let storeNestingDebounceTimer: ReturnType<typeof setTimeout> | null = null;

export function scheduleBackgroundStoreNesting(project: DesignProject, bom: ManufacturingBOM): void {
  if (typeof window === "undefined" || bom.cutList.length === 0) return;
  if (storeNestingDebounceTimer) clearTimeout(storeNestingDebounceTimer);
  const targetProjectId = project.id;
  const targetVersion = project.version;
  const targetRev = project.revisionId;
  storeNestingDebounceTimer = setTimeout(() => {
    storeNestingDebounceTimer = null;
    const sheetCfg = buildActiveTenantSheetConfig(activeRuntimeTenantProfile);
    void computeNestingAsync(bom.cutList, targetVersion, sheetCfg, {
      projectId: targetProjectId,
      revisionId: targetRev,
    })
      .then((workerSheets) => {
        if (!workerSheets) return;
        const latest = useConfiguratorStore.getState();
        if (latest.project.id === targetProjectId && latest.project.version === targetVersion) {
          const refreshedBom = { ...latest.bom, nestingResults: workerSheets };
          const prcParams = buildActiveTenantPricingParams(latest.activeTenantProfile || activeRuntimeTenantProfile);
          useConfiguratorStore.setState({
            bom: refreshedBom,
            pricing: calculateProjectPrice(refreshedBom, prcParams, undefined, latest.project.sceneObjects || []),
          });
        }
      })
      .catch(() => {
        // Worker termination or transient failure: preserve last valid BOM/pricing without unhandled rejection
      });
  }, 180);
}

export let deferredCommitRecomputeTimer: ReturnType<typeof setTimeout> | null = null;

export function recompute(
  project: DesignProject,
  options?: { syncInitial?: boolean }
): {
  validationIssues: ValidationIssue[];
  bom: ManufacturingBOM;
  pricing: PricingBreakdown;
  smartAdvice: SmartAdvisorFeedback;
  lastChangeImpact: LiveChangeImpactSummary | null;
} {
  const compat = evaluateProjectCompatibility(project);
  const unifiedEng = evaluateUnifiedEngineeringModel(project);
  const validationIssues = unifiedEng.findings;
  project.verificationSnapshot = {
    overallStatus: !unifiedEng.canExportToCncAndSaw
      ? "INCOMPATIBLE"
      : !unifiedEng.canApproveFinalErpRelease
      ? "UNVERIFIED"
      : compat.overallStatus,
    canApproveProduction:
      compat.canApproveProduction &&
      unifiedEng.canExportToCncAndSaw &&
      unifiedEng.canApproveFinalErpRelease,
    unverifiedCount:
      Math.max(
      compat.evidenceMatrix.unverifiedPartOrOpCount,
      unifiedEng.verificationRequiredFindings.length
    ),
    evaluatedAt: compat.evidenceMatrix.evaluatedAt,
  };
  // SSR Hydration Determinism: initial store boot runs synchronous nesting on BOTH server & client
  // so initial HTML and hydrated client DOM match byte-for-byte (e.g. € 2.589,62 === € 2.589,62).
  // Subsequent interactive mutations in the browser offload nesting to the background Web Worker.
  const skipNesting = Boolean(!options?.syncInitial && typeof window !== "undefined");
  const sheetConfig =
    activeRuntimeTenantProfile.tenantId === TENANT_BIRIM_ENTERPRISE.tenantId &&
    activeRuntimeTenantProfile.construction.standardSheetLengthMm === 2800 &&
    activeRuntimeTenantProfile.construction.standardSheetWidthMm === 2070 &&
    activeRuntimeTenantProfile.construction.sawKerfMm === 4.0
      ? undefined
      : buildActiveTenantSheetConfig(activeRuntimeTenantProfile);
  const bom = generateBOMForProject(project, undefined, {
    skipSyncNesting: skipNesting,
    sheetConfig,
  });
  const pricingParams = buildActiveTenantPricingParams(activeRuntimeTenantProfile);
  const needsIndependentPricingBom = project.modules.some(
    (m) => m.includeInPricing === false || m.includeInProduction === false
  );
  const pricingBom = needsIndependentPricingBom
    ? generateBOMForProject(
        {
          ...project,
          modules: project.modules
            .filter((m) => m.includeInPricing !== false)
            .map((m) => (m.includeInProduction === false ? { ...m, includeInProduction: true } : m)),
        },
        undefined,
        { skipSyncNesting: true, sheetConfig }
      )
    : bom;
  const pricing = calculateProjectPrice(pricingBom, pricingParams, undefined, project.sceneObjects || []);
  const activeMod = project.modules[0] || createDefaultWardrobeModule();
  const smartAdvice = analyzeAndAdviseSpan(activeMod.dimensions.width, activeMod.dimensions.height);
  if (skipNesting) {
    scheduleBackgroundStoreNesting(project, bom);
  }
  let lastChangeImpact: LiveChangeImpactSummary | null = null;
  if (!options?.syncInitial && typeof useConfiguratorStore !== "undefined") {
    try {
      const prevState = useConfiguratorStore.getState();
      if (prevState && prevState.bom && prevState.pricing) {
        const prevSheets = prevState.bom.materialUsage.reduce((a, u) => a + u.estimatedSheetsCount, 0);
        const nextSheets = bom.materialUsage.reduce((a, u) => a + u.estimatedSheetsCount, 0);
        const blockingCnt = validationIssues.filter((i) => i.severity === "error").length;
        lastChangeImpact = {
          timestampMs: Date.now(),
          actionLabel: "Tasarım güncellendi",
          totalPieces: bom.summary.totalPiecesCount,
          piecesDelta: bom.summary.totalPiecesCount - prevState.bom.summary.totalPiecesCount,
          totalSheets: nextSheets,
          sheetsDelta: nextSheets - prevSheets,
          totalWithVatEur: pricing.totalWithVatEur,
          priceDeltaEur: Number((pricing.totalWithVatEur - prevState.pricing.totalWithVatEur).toFixed(2)),
          blockingIssueCount: blockingCnt,
        };
      }
    } catch {
      // Ignore during store bootstrap
    }
  }
  return { validationIssues, bom, pricing, smartAdvice, lastChangeImpact };
}

export function nextHistory(history: DesignProject[], current: DesignProject, batchStartProject: DesignProject | null): DesignProject[] {
  if (batchStartProject) return history;
  return [...history.slice(-getAdaptiveMaxHistoryEntries()), current];
}

export const initialProj = createInitialProject();
const initRecomputed = recompute(initialProj, { syncInitial: true });
export const initIssues = initRecomputed.validationIssues;
export const initBom = initRecomputed.bom;
export const initPricing = initRecomputed.pricing;
export const initAdvice = initRecomputed.smartAdvice;

// Global Raf references for smooth door and drawer open/close animations
// rAF holders managed via helpers
let activeDoorAnimRaf: number | null = null;
let activeDrawerAnimRaf: number | null = null;

export function animateValueTransition(
  startVal: number,
  targetVal: number,
  durationMs = 380,
  onUpdate: (val: number) => void,
  getRafHolder: () => number | null,
  setRafHolder: (raf: number | null) => void
) {
  if (typeof window === "undefined" || typeof requestAnimationFrame === "undefined") {
    onUpdate(targetVal);
    return;
  }
  const curRaf = getRafHolder();
  if (curRaf !== null) {
    cancelAnimationFrame(curRaf);
    setRafHolder(null);
  }
  if (Math.abs(startVal - targetVal) < 0.5) {
    onUpdate(targetVal);
    return;
  }

  const startTime = performance.now();
  // Smooth cubic ease-out for swift, crisp response
  const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3);

  const step = (now: number) => {
    const elapsed = now - startTime;
    const progress = Math.min(1, Math.max(0, elapsed / durationMs));
    const eased = easeOutCubic(progress);
    const currentVal = Math.round(startVal + (targetVal - startVal) * eased);
    onUpdate(currentVal);

    if (progress < 1) {
      setRafHolder(requestAnimationFrame(step));
    } else {
      setRafHolder(null);
      onUpdate(targetVal);
    }
  };

  setRafHolder(requestAnimationFrame(step));
}


export function cloneProjectForSingleModule(project: DesignProject, targetModIndex: number): DesignProject {
  const safeIdx = project.modules[targetModIndex] ? targetModIndex : 0;
  return cloneProject(project, safeIdx);
}

export function getActiveDoorAnimRaf(): number | null { return activeDoorAnimRaf; }
export function setActiveDoorAnimRaf(raf: number | null): void { activeDoorAnimRaf = raf; }
export function getActiveDrawerAnimRaf(): number | null { return activeDrawerAnimRaf; }
export function setActiveDrawerAnimRaf(raf: number | null): void { activeDrawerAnimRaf = raf; }
export function clearStoreNestingDebounceTimer(): void {
  if (storeNestingDebounceTimer) {
    clearTimeout(storeNestingDebounceTimer);
    storeNestingDebounceTimer = null;
  }
}
export function getDeferredCommitRecomputeTimer() { return deferredCommitRecomputeTimer; }
export function setDeferredCommitRecomputeTimer(t: ReturnType<typeof setTimeout> | null): void {
  deferredCommitRecomputeTimer = t;
}
