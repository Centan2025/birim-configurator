import { create } from "zustand";
import {
  DesignProject,
  createInitialProject,
  validateProject,
  autoFixModuleIssues,
  ValidationIssue,
  createDefaultWardrobeModule,
  ModuleInstance,
  DesignProjectSchema,
  evaluateProjectCompatibility,
  evaluateUnifiedEngineeringModel,
  applyApprovedRemediationProposal,
  type RemediationProposal,
  migrateV3ProjectToV4,
  parseAndMigrateProject,
  getMaxSafeBayCount,
  roundIntMm,
  inferDoorSystemIdFromType,
  HandleCategory,
  SUPPORTED_PROJECT_SCHEMA_VERSION,
  ArchitecturalElement,
  WallDefinition,
  FloorPlanUnderlay,
  convertUnderlayPolylinesToWalls,
  SceneObjectInstance,
  CustomModuleTemplateRecord,
  WallFreeGapSlot,
  computeAutoFillersAndTrimForProject,
  autoNotchModulesAroundObstacles,
  parseRoomPlanScanJson,
} from "@birim/core";
import { generateBOMForProject, ManufacturingBOM } from "@birim/manufacturing";
import { calculateProjectPrice, PricingBreakdown } from "@birim/pricing";
import { computeNestingAsync } from "../workers/manufacturing-worker-client";
import {
  WARDROBE_TEMPLATES,
  getV4TemplateById,
  createKitchenLinearProject,
  createKitchenLProject,
  createKitchenUProject,
  analyzeAndAdviseSpan,
  SmartAdvisorFeedback,
  HANDLE_PROFILES,
  V5_COMPOSITE_ASSEMBLIES,
  createSceneObjectInstanceFromCatalog,
  loadSavedCustomModuleTemplates,
  persistCustomModuleTemplates,
} from "@birim/catalog";
import {
  computeMultiWallModuleSnap,
  solveSceneObjectPlacementSnap,
} from "../v3/engine/multiWallSnapAndBvhEngine";

export type ViewMode = "3d" | "2d_elevation" | "2d_plan" | "2d_section";
export type CameraPreset = "front" | "side" | "top" | "iso";
export type UserExperienceTier = "simple" | "architect" | "factory";

const sessionUnderlayDataCache = new Map<string, string>();

export interface SavedProjectMeta {
  id: string;
  title: string;
  date: string;
  priceEur: number;
}

export interface ProjectRevisionSnapshot {
  revisionId: string;
  label: string;
  version: number;
  createdAt: string;
  priceEur: number;
  cutPiecesCount: number;
  moduleCount: number;
  project: DesignProject;
}

export interface ProjectRevisionDiff {
  fromRevisionId: string;
  toRevisionId: string;
  versionDelta: number;
  moduleCountDelta: number;
  cutPiecesDelta: number;
  priceDeltaEur: number;
  addedModuleIds: string[];
  removedModuleIds: string[];
  modifiedModuleIds: string[];
}

interface ConfiguratorState {
  project: DesignProject;
  activeModuleIndex: number;
  viewMode: ViewMode;
  selectedComponentId: string | null;
  doorOpenAngleDeg: number;
  drawerOpenMm: number;
  explodedFactor: number;
  isOrthographic: boolean;
  cncXrayMode: boolean;
  studioSplitView: boolean;
  cameraPreset: CameraPreset;
  uiMode: "simple" | "technical";
  userExperienceTier: UserExperienceTier;
  activeBayIndex: number;
  autoSaveStatus: "saved" | "saving" | "unsaved";
  validationIssues: ValidationIssue[];
  bom: ManufacturingBOM;
  pricing: PricingBreakdown;
  smartAdvice: SmartAdvisorFeedback;
  history: DesignProject[];
  future: DesignProject[];
  revisions: ProjectRevisionSnapshot[];
  batchStartProject: DesignProject | null;
  selectedModuleIds: string[];
  selectedSceneObjectId: string | null;

  // Actions
  setUiMode: (mode: "simple" | "technical") => void;
  setUserExperienceTier: (tier: UserExperienceTier) => void;
  setActiveBayIndex: (idx: number) => void;
  setAutoSaveStatus: (status: "saved" | "saving" | "unsaved") => void;
  setViewMode: (mode: ViewMode) => void;
  setCameraPreset: (preset: CameraPreset) => void;
  setSelectedComponentId: (id: string | null) => void;
  setActiveModuleIndex: (index: number) => void;
  setDoorOpenAngleDeg: (angle: number) => void;
  setDrawerOpenMm: (mm: number) => void;
  setExplodedFactor: (factor: number) => void;
  toggleDoorOpen: () => void;
  toggleOrthographic: () => void;
  setOrthographic: (isOrthographic: boolean) => void;
  setCncXrayMode: (enabled: boolean) => void;
  toggleCncXrayMode: () => void;
  setStudioSplitView: (enabled: boolean) => void;
  toggleStudioSplitView: () => void;
  autoFixProjectIssues: () => number;

  // Project & Module actions
  updateProjectTitle: (title: string) => void;
  setDimensions: (width: number, height: number, depth: number) => void;
  setPlinthHeight: (plinth: number) => void;
  setMaterials: (bodyMatId?: string, doorMatId?: string) => void;
  setBayCount: (count: number) => void;
  setBayDoorType: (bayIdx: number, type: "single_left" | "single_right" | "double" | "sliding" | "open") => void;
  setBayHandleCategory: (bayIdx: number, category: HandleCategory, handleProfileId?: string) => void;

  // Interior fittings
  addShelf: (bayIdx: number) => void;
  removeShelf: (bayIdx: number, shelfId: string) => void;
  addHangingRail: (bayIdx: number) => void;
  removeHangingRail: (bayIdx: number, railId: string) => void;
  addDrawer: (bayIdx: number) => void;
  removeDrawer: (bayIdx: number, drawerId: string) => void;
  addSpecialFitting: (bayIdx: number, type: import("@birim/core").SpecialFittingConfig["type"]) => void;
  removeSpecialFitting: (bayIdx: number, fittingId: string) => void;

  // Multi-module management
  addAdjacentModule: () => void;
  duplicateActiveModule: () => void;
  removeActiveModule: () => void;
  moveActiveModule: (deltaX: number) => void;
  toggleModuleSelection: (moduleId: string, additive?: boolean) => void;
  selectAllModules: () => void;
  clearModuleSelection: () => void;
  batchMoveSelectedModules: (deltaX: number, deltaZ?: number) => void;
  batchSetSelectedModulesMaterial: (bodyMatId?: string, doorMatId?: string) => void;
  batchRemoveSelectedModules: () => void;

  // Room, Wall, Obstacle & Floorplan Underlay (WP-06)
  setRoomDimensions: (mainWallLengthMm: number, ceilingHeightMm?: number) => void;
  updateCeilingConfig: (patch: Partial<import("@birim/core").SpaceCeilingConfig>) => void;
  setFacadeGrainContinuity: (enabled: boolean) => void;
  addWallSegment: (wall: {
    name?: string;
    length: number;
    height?: number;
    thickness?: number;
    position: { x: number; y: number; z: number };
    rotationY: number;
    wallType?: WallDefinition["wallType"];
  }) => string;
  updateWallSegment: (
    wallId: string,
    patch: {
      name?: string;
      length?: number;
      height?: number;
      thickness?: number;
      position?: Partial<WallDefinition["position"]>;
      rotationY?: number;
      wallType?: WallDefinition["wallType"];
    }
  ) => void;
  removeWallSegment: (wallId: string) => void;
  addSpaceObstacle: (obstacle: Omit<ArchitecturalElement, "id"> & { id?: string }) => string;
  updateSpaceObstacle: (
    obstacleId: string,
    patch: {
      name?: string;
      rotationY?: number;
      doorSwing?: ArchitecturalElement["doorSwing"];
      position?: Partial<ArchitecturalElement["position"]>;
      dimensions?: Partial<ArchitecturalElement["dimensions"]>;
    }
  ) => void;
  removeSpaceObstacle: (obstacleId: string) => void;
  setFloorPlanUnderlay: (underlay: FloorPlanUnderlay | null) => void;
  importWallsFromUnderlay: (replaceExisting?: boolean) => number;

  // Persistence & Storage
  saveToStorage: (name?: string) => string;
  loadFromStorage: (id: string) => boolean;
  getSavedProjects: () => SavedProjectMeta[];
  exportProjectJSON: () => string;
  importProjectJSON: (jsonStr: string) => { success: boolean; error?: string };

  // Revisions & Atomic Batch Undo
  beginHistoryTransaction: () => void;
  commitHistoryTransaction: () => void;
  createRevisionSnapshot: (label?: string) => string;
  restoreRevisionSnapshot: (revisionId: string) => boolean;
  diffRevisions: (fromRevisionId: string, toRevisionId: string) => ProjectRevisionDiff | null;

  // Production approval
  approveProduction: () => { success: boolean; message: string };
  applyApprovedEngineeringFix: (proposal: RemediationProposal) => void;

  // Smart advisor
  applySmartSpan: (spanWidth: number) => void;

  // V5 Multi-Module, Fit-to-Gap, SceneObjects, Auto-Fillers & LiDAR Actions
  setSelectedSceneObjectId: (id: string | null) => void;
  appendModuleWithMultiWallSnap: (
    templateId: string,
    opts?: { wallId?: string; worldX?: number; worldZ?: number; insertBetween?: boolean }
  ) => ModuleInstance | null;
  fillWallGapWithParametricModule: (gap: WallFreeGapSlot, templateId?: string) => void;
  addCompositeAssemblyPreset: (presetId: string) => void;
  saveActiveModuleAsCustomTemplate: (name: string, familyId: import("@birim/core").ModuleFamilyId) => string;
  deleteCustomModuleTemplate: (templateId: string) => void;
  addSceneObjectFromCatalog: (
    catalogId: string,
    cursorWorld?: { x: number; z: number }
  ) => SceneObjectInstance | null;
  addCustomSceneObject: (obj: SceneObjectInstance) => void;
  updateSceneObject: (id: string, patch: Partial<SceneObjectInstance>) => void;
  duplicateSceneObject: (id: string) => void;
  removeSceneObject: (id: string) => void;
  runAutoFillersAndCrown: () => { count: number; notes: string[] };
  runAutoNotchObstacles: () => { count: number; notes: string[] };
  importRoomPlanLiDARJson: (rawJson: string) => { ok: boolean; summary: string };
  setModuleOffsetFromLeftWall: (moduleId: string, newOffsetXMm: number) => void;

  // History & Templates
  undo: () => void;
  redo: () => void;
  applyTemplate: (templateId: string) => void;
  loadLinearKitchen: () => void;
  loadLKitchen: () => void;
  loadUKitchen: () => void;
  resetToDefault: () => void;
}

function cloneProject(project: DesignProject): DesignProject {
  const nextVersion = (project.version || 1) + 1;
  return {
    ...project,
    status: "draft",
    version: nextVersion,
    schemaVersion: SUPPORTED_PROJECT_SCHEMA_VERSION,
    catalogVersion: project.catalogVersion || project.libraryVersionId || "lib_v4_0_0",
    revisionId: `rev_v${nextVersion}`,
    updatedAt: new Date().toISOString(),
    space: {
      ...project.space,
      walls: project.space.walls.map((w) => ({
        ...w,
        position: { ...w.position },
        elements: w.elements ? w.elements.map((el) => ({ ...el, position: { ...el.position }, dimensions: { ...el.dimensions } })) : [],
      })),
      elements: project.space.elements
        ? project.space.elements.map((el) => ({
            ...el,
            position: { ...el.position },
            dimensions: { ...el.dimensions },
          }))
        : [],
      floorPlanUnderlay: project.space.floorPlanUnderlay
        ? structuredClone(project.space.floorPlanUnderlay)
        : undefined,
    },
    sceneObjects: (project.sceneObjects || []).map((so) => structuredClone(so)),
    customModuleTemplates: (project.customModuleTemplates || []).map((ct) => structuredClone(ct)),
    modules: project.modules.map((m) => ({
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
    })),
  };
}

let storeNestingDebounceTimer: ReturnType<typeof setTimeout> | null = null;

function scheduleBackgroundStoreNesting(project: DesignProject, bom: ManufacturingBOM) {
  if (typeof window === "undefined" || bom.cutList.length === 0) return;
  if (storeNestingDebounceTimer) clearTimeout(storeNestingDebounceTimer);
  const targetProjectId = project.id;
  const targetVersion = project.version;
  const targetRev = project.revisionId;
  storeNestingDebounceTimer = setTimeout(() => {
    storeNestingDebounceTimer = null;
    void computeNestingAsync(bom.cutList, targetVersion, undefined, {
      projectId: targetProjectId,
      revisionId: targetRev,
    }).then((workerSheets) => {
      if (!workerSheets) return;
      const latest = useConfiguratorStore.getState();
      if (latest.project.id === targetProjectId && latest.project.version === targetVersion) {
        const refreshedBom = { ...latest.bom, nestingResults: workerSheets };
        useConfiguratorStore.setState({
          bom: refreshedBom,
          pricing: calculateProjectPrice(refreshedBom, undefined, undefined, latest.project.sceneObjects || []),
        });
      }
    });
  }, 180);
}

function recompute(project: DesignProject, options?: { syncInitial?: boolean }) {
  const validationIssues = validateProject(project);
  const compat = evaluateProjectCompatibility(project);
  const unifiedEng = evaluateUnifiedEngineeringModel(project);
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
  const bom = generateBOMForProject(project, undefined, { skipSyncNesting: skipNesting });
  const pricing = calculateProjectPrice(bom, undefined, undefined, project.sceneObjects || []);
  const activeMod = project.modules[0] || createDefaultWardrobeModule();
  const smartAdvice = analyzeAndAdviseSpan(activeMod.dimensions.width, activeMod.dimensions.height);
  if (skipNesting) {
    scheduleBackgroundStoreNesting(project, bom);
  }
  return { validationIssues, bom, pricing, smartAdvice };
}

function nextHistory(history: DesignProject[], current: DesignProject, batchStartProject: DesignProject | null): DesignProject[] {
  if (batchStartProject) return history;
  return [...history.slice(-50), current];
}

const initialProj = createInitialProject();
const { validationIssues: initIssues, bom: initBom, pricing: initPricing, smartAdvice: initAdvice } = recompute(initialProj, { syncInitial: true });

export const useConfiguratorStore = create<ConfiguratorState>((set, get) => ({
  project: initialProj,
  activeModuleIndex: 0,
  viewMode: "3d",
  selectedComponentId: null,
  doorOpenAngleDeg: 0,
  drawerOpenMm: 0,
  explodedFactor: 0,
  isOrthographic: false,
  cncXrayMode: false,
  studioSplitView: false,
  cameraPreset: "iso",
  uiMode: "simple",
  userExperienceTier: "simple",
  activeBayIndex: 0,
  autoSaveStatus: "unsaved",
  validationIssues: initIssues,
  bom: initBom,
  pricing: initPricing,
  smartAdvice: initAdvice,
  history: [],
  future: [],
  revisions: [],
  batchStartProject: null,
  selectedModuleIds: initialProj.modules[0] ? [initialProj.modules[0].id] : [],
  selectedSceneObjectId: null,

  setUiMode: (uiMode) =>
    set({
      uiMode,
      userExperienceTier: uiMode === "technical" ? "architect" : "simple",
    }),
  setUserExperienceTier: (userExperienceTier) =>
    set({
      userExperienceTier,
      uiMode: userExperienceTier === "simple" ? "simple" : "technical",
    }),
  setActiveBayIndex: (activeBayIndex) => set({ activeBayIndex }),
  setAutoSaveStatus: (autoSaveStatus) => set({ autoSaveStatus }),
  setViewMode: (viewMode) => set({ viewMode }),
  setCameraPreset: (cameraPreset) => set({ cameraPreset }),
  setSelectedComponentId: (selectedComponentId) => set({ selectedComponentId }),
  setActiveModuleIndex: (activeModuleIndex) => {
    const curState = get();
    const mods = curState.project.modules;
    const clampedIdx = Math.max(0, Math.min(mods.length - 1, activeModuleIndex));
    const targetMod = mods[clampedIdx];
    if (clampedIdx === curState.activeModuleIndex) {
      set({
        selectedModuleIds: targetMod ? [targetMod.id] : [],
      });
      return;
    }
    set({
      activeModuleIndex: clampedIdx,
      activeBayIndex: 0,
      selectedComponentId: null,
      selectedModuleIds: targetMod ? [targetMod.id] : [],
    });
  },
  setDoorOpenAngleDeg: (doorOpenAngleDeg) => set({ doorOpenAngleDeg }),
  setDrawerOpenMm: (drawerOpenMm) => set({ drawerOpenMm }),
  setExplodedFactor: (explodedFactor) => set({ explodedFactor }),
  toggleOrthographic: () => set((s) => ({ isOrthographic: !s.isOrthographic })),
  setOrthographic: (isOrthographic) => set({ isOrthographic }),
  setCncXrayMode: (cncXrayMode) => set({ cncXrayMode }),
  toggleCncXrayMode: () => set((st) => ({ cncXrayMode: !st.cncXrayMode })),
  setStudioSplitView: (studioSplitView) => set({ studioSplitView }),
  toggleStudioSplitView: () => set((st) => ({ studioSplitView: !st.studioSplitView })),
  autoFixProjectIssues: () => {
    const { project, history, batchStartProject } = get();
    const next = cloneProject(project);
    let fixedTotal = 0;
    next.modules = next.modules.map((mod) => {
      const res = autoFixModuleIssues(mod, next.space.ceilingHeight);
      fixedTotal += res.appliedFixes.length;
      return res.module;
    });
    if (fixedTotal === 0) return 0;
    const { validationIssues, bom, pricing, smartAdvice } = recompute(next);
    set({
      project: next,
      validationIssues,
      bom,
      pricing,
      smartAdvice,
      autoSaveStatus: 'unsaved',
      history: nextHistory(history, project, batchStartProject),
      future: [],
    });
    return fixedTotal;
  },
  toggleDoorOpen: () => {
    const cur = get().doorOpenAngleDeg;
    set({ doorOpenAngleDeg: cur > 0 ? 0 : 75 });
  },

  beginHistoryTransaction: () => {
    const { project } = get();
    set({ batchStartProject: structuredClone(project) });
  },

  commitHistoryTransaction: () => {
    const { batchStartProject, project, history } = get();
    if (!batchStartProject) return;
    const hasChanged =
      batchStartProject.version !== project.version ||
      batchStartProject.modules !== project.modules ||
      batchStartProject.space !== project.space;
    if (!hasChanged) {
      set({ batchStartProject: null });
      return;
    }
    const { validationIssues, bom, pricing, smartAdvice } = recompute(project);
    set({
      history: [...history.slice(-50), batchStartProject],
      future: [],
      batchStartProject: null,
      validationIssues,
      bom,
      pricing,
      smartAdvice,
    });
  },

  createRevisionSnapshot: (label) => {
    const { project, pricing, bom, revisions } = get();
    const revisionId = `rev_${project.version}_${revisions.length + 1}`;
    const snap: ProjectRevisionSnapshot = {
      revisionId,
      label: label || `Revizyon v${project.version}`,
      version: project.version,
      createdAt: new Date().toISOString(),
      priceEur: pricing.totalWithVatEur,
      cutPiecesCount: bom.cutList.length,
      moduleCount: project.modules.length,
      project: structuredClone({ ...project, revisionId }),
    };
    set({ revisions: [...revisions, snap] });
    return revisionId;
  },

  restoreRevisionSnapshot: (revisionId) => {
    const { revisions, project, history } = get();
    const target = revisions.find((r) => r.revisionId === revisionId);
    if (!target) return false;
    const restored = structuredClone(target.project);
    const { validationIssues, bom, pricing, smartAdvice } = recompute(restored);
    set({
      history: [...history.slice(-50), project],
      future: [],
      project: restored,
      autoSaveStatus: "unsaved",
      activeModuleIndex: 0,
      activeBayIndex: 0,
      selectedComponentId: null,
      validationIssues,
      bom,
      pricing,
      smartAdvice,
    });
    return true;
  },

  diffRevisions: (fromRevisionId, toRevisionId) => {
    const { revisions } = get();
    const fromSnap = revisions.find((r) => r.revisionId === fromRevisionId);
    const toSnap = revisions.find((r) => r.revisionId === toRevisionId);
    if (!fromSnap || !toSnap) return null;

    const fromMap = new Map(fromSnap.project.modules.map((m) => [m.id, m]));
    const toMap = new Map(toSnap.project.modules.map((m) => [m.id, m]));

    const addedModuleIds = toSnap.project.modules.filter((m) => !fromMap.has(m.id)).map((m) => m.id);
    const removedModuleIds = fromSnap.project.modules.filter((m) => !toMap.has(m.id)).map((m) => m.id);
    const modifiedModuleIds = toSnap.project.modules
      .filter((m) => {
        const prev = fromMap.get(m.id);
        return prev && JSON.stringify(prev) !== JSON.stringify(m);
      })
      .map((m) => m.id);

    return {
      fromRevisionId,
      toRevisionId,
      versionDelta: toSnap.version - fromSnap.version,
      moduleCountDelta: toSnap.moduleCount - fromSnap.moduleCount,
      cutPiecesDelta: toSnap.cutPiecesCount - fromSnap.cutPiecesCount,
      priceDeltaEur: Number((toSnap.priceEur - fromSnap.priceEur).toFixed(2)),
      addedModuleIds,
      removedModuleIds,
      modifiedModuleIds,
    };
  },

  updateProjectTitle: (title) => {
    const current = get().project;
    const updated: DesignProject = { ...current, title, updatedAt: new Date().toISOString() };
    set({ project: updated, autoSaveStatus: "unsaved" });
  },

  setDimensions: (width, height, depth) => {
    const { project, history, activeModuleIndex, batchStartProject } = get();
    const updated = cloneProject(project);
    const mod = updated.modules[activeModuleIndex] || updated.modules[0];
    if (!mod) return;

    if (![width, height, depth].every(Number.isFinite)) return;
    const template = mod.templateId ? getV4TemplateById(mod.templateId) : undefined;
    const limits = template?.dimensionLimits;
    const clamp = (n: number, min: number, max: number) => Math.max(min, Math.min(max, n));
    const next = {
      width: roundIntMm(mod.isFixedWidth ? mod.dimensions.width : clamp(width, limits?.minW ?? 200, limits?.maxW ?? 3600)),
      height: roundIntMm(clamp(height, limits?.minH ?? 300, limits?.maxH ?? 2800)),
      depth: roundIntMm(clamp(depth, limits?.minD ?? 200, limits?.maxD ?? 950)),
    };
    const maxSafeBays = getMaxSafeBayCount(next.width, mod.carcass.panelThickness);
    if (mod.bays.length > maxSafeBays) {
      mod.bays = mod.bays.slice(0, maxSafeBays).map((b, idx) => ({ ...b, index: idx }));
    }
    const oldInner = Math.max(1, mod.dimensions.height - mod.carcass.plinthHeight - 2 * mod.carcass.panelThickness);
    const newInner = Math.max(1, next.height - mod.carcass.plinthHeight - 2 * mod.carcass.panelThickness);
    if (next.height !== mod.dimensions.height) mod.bays.forEach((b) => {
      b.shelves.forEach((s) => {
        s.elevationY = roundIntMm(clamp((s.elevationY * newInner) / oldInner, 0, Math.max(0, newInner - (s.thickness ?? mod.carcass.panelThickness))));
      });
      b.drawers.forEach((d) => {
        d.elevationY = roundIntMm(clamp((d.elevationY * newInner) / oldInner, 0, Math.max(0, newInner - d.height)));
      });
      b.hangingRails.forEach((r) => {
        r.elevationY = roundIntMm(clamp((r.elevationY * newInner) / oldInner, 0, Math.max(0, newInner - 25)));
      });
    });
    mod.dimensions = next;
    updated.updatedAt = new Date().toISOString();
    if (batchStartProject) {
      set({
        project: updated,
        autoSaveStatus: "unsaved",
      });
      return;
    }
    const { validationIssues, bom, pricing, smartAdvice } = recompute(updated);

    set({
      history: nextHistory(history, project, batchStartProject),
      future: [],
      project: updated,
      autoSaveStatus: "unsaved",
      validationIssues,
      bom,
      pricing,
      smartAdvice,
    });
  },

  setPlinthHeight: (plinth) => {
    const { project, history, activeModuleIndex, batchStartProject } = get();
    const updated = cloneProject(project);
    const mod = updated.modules[activeModuleIndex] || updated.modules[0];
    if (!mod) return;

    mod.carcass.plinthHeight = plinth;
    if (batchStartProject) {
      set({
        project: updated,
        autoSaveStatus: "unsaved",
      });
      return;
    }
    const { validationIssues, bom, pricing, smartAdvice } = recompute(updated);
    set({
      history: nextHistory(history, project, batchStartProject),
      future: [],
      project: updated,
      autoSaveStatus: "unsaved",
      validationIssues,
      bom,
      pricing,
      smartAdvice,
    });
  },

  setMaterials: (bodyMatId, doorMatId) => {
    const { project, history, activeModuleIndex, batchStartProject } = get();
    const updated = cloneProject(project);
    const mod = updated.modules[activeModuleIndex] || updated.modules[0];
    if (!mod) return;

    if (bodyMatId) mod.carcass.bodyMaterialId = bodyMatId;
    if (doorMatId) {
      mod.carcass.doorMaterialId = doorMatId;
      mod.bays.forEach((b) => { b.door.doorMaterialId = doorMatId; b.drawers.forEach((d) => { d.frontMaterialId = doorMatId; }); });
    }
    if (batchStartProject) {
      set({
        project: updated,
        autoSaveStatus: "unsaved",
      });
      return;
    }
    const { validationIssues, bom, pricing, smartAdvice } = recompute(updated);
    set({
      history: nextHistory(history, project, batchStartProject),
      future: [],
      project: updated,
      autoSaveStatus: "unsaved",
      validationIssues,
      bom,
      pricing,
      smartAdvice,
    });
  },

  setBayCount: (count) => {
    const { project, history, activeModuleIndex, batchStartProject } = get();
    if (count < 1 || count > 8) return;
    const updated = cloneProject(project);
    const mod = updated.modules[activeModuleIndex] || updated.modules[0];
    if (!mod) return;

    const currentBays = mod.bays;
    if (count > currentBays.length) {
      for (let i = currentBays.length; i < count; i++) {
        currentBays.push({
          index: i,
          door: { id: `door_${i}`, bayIndex: i, type: "single_left", softClose: true },
          shelves: [{ id: `shelf_${i}_mid`, bayIndex: i, elevationY: 900, isAdjustable: true }],
          hangingRails: [{ id: `rail_${i}_1`, bayIndex: i, elevationY: 1700 }],
          drawers: [],
          specialFittings: [],
        });
      }
    } else if (count < currentBays.length) {
      mod.bays = currentBays.slice(0, count);
    }
    if (batchStartProject) {
      set({
        project: updated,
        autoSaveStatus: "unsaved",
      });
      return;
    }
    const { validationIssues, bom, pricing, smartAdvice } = recompute(updated);
    set({
      history: nextHistory(history, project, batchStartProject),
      future: [],
      project: updated,
      autoSaveStatus: "unsaved",
      validationIssues,
      bom,
      pricing,
      smartAdvice,
    });
  },

  setBayDoorType: (bayIdx, type) => {
    const { project, history, activeModuleIndex, batchStartProject } = get();
    const updated = cloneProject(project);
    const mod = updated.modules[activeModuleIndex] || updated.modules[0];
    if (!mod || !mod.bays[bayIdx]) return;

    if (type === "sliding") {
      // Real wardrobe rule: sliding tracks span across the module; ensure at least 2 bays if >=1000mm
      mod.bays.forEach((b, idx) => {
        const curMount = b.door.slidingMountingType || "top_hung_pelmet";
        b.door.type = "sliding";
        b.door.doorSystemId =
          curMount === "inset_inside"
            ? "sliding_bottom_rolling"
            : curMount === "coplanar_flush"
            ? "sliding_coplanar"
            : "sliding_top_hung";
        b.door.slidingMountingType = curMount;
        b.door.overlayType = curMount === "inset_inside" ? "inset" : "full_overlay";
        // Rear sliding leaves use flush recessed grips so front & rear doors never collide
        if (idx % 2 === 0 && mod.bays.length > 1) {
          b.door.handleCategory = "recessed_grip";
        }
      });
      mod.isOpenFront = false;
    } else {
      // If switching away from module-wide sliding back to hinged/open, convert any sibling sliding bays cleanly too
      const wasModuleSliding = mod.bays.some((b) => b.door.type === "sliding");
      if (wasModuleSliding && mod.bays.length > 1) {
        mod.bays.forEach((b, idx) => {
          const fallbackType =
            idx === bayIdx
              ? type
              : type === "open"
              ? "open"
              : idx === 0
              ? "single_left"
              : "single_right";
          b.door.type = fallbackType;
          b.door.doorSystemId = inferDoorSystemIdFromType(fallbackType);
          b.door.overlayType = "full_overlay";
          if (b.door.handleCategory === "recessed_grip") {
            b.door.handleCategory = "bar_handle";
          }
        });
      } else {
        mod.bays[bayIdx].door.type = type;
        mod.bays[bayIdx].door.doorSystemId = inferDoorSystemIdFromType(type);
        mod.bays[bayIdx].door.overlayType = "full_overlay";
      }
      mod.isOpenFront = false;
    }
    if (batchStartProject) {
      set({
        project: updated,
        autoSaveStatus: "unsaved",
      });
      return;
    }
    const { validationIssues, bom, pricing, smartAdvice } = recompute(updated);
    set({
      history: nextHistory(history, project, batchStartProject),
      future: [],
      project: updated,
      autoSaveStatus: "unsaved",
      validationIssues,
      bom,
      pricing,
      smartAdvice,
    });
  },

  setBayHandleCategory: (bayIdx, category, handleProfileId) => {
    const { project, history, activeModuleIndex, batchStartProject } = get();
    const updated = cloneProject(project);
    const mod = updated.modules[activeModuleIndex] || updated.modules[0];
    if (!mod || !mod.bays[bayIdx]) return;

    const matchedProfile =
      (handleProfileId ? HANDLE_PROFILES.find((p) => p.id === handleProfileId) : undefined) ||
      HANDLE_PROFILES.find((p) => p.category === category);
    mod.bays[bayIdx].door.handleCategory = category;
    mod.bays[bayIdx].door.handleProfileId = matchedProfile?.id;
    if (batchStartProject) {
      set({
        project: updated,
        autoSaveStatus: "unsaved",
      });
      return;
    }
    const { validationIssues, bom, pricing, smartAdvice } = recompute(updated);
    set({
      history: nextHistory(history, project, batchStartProject),
      future: [],
      project: updated,
      autoSaveStatus: "unsaved",
      validationIssues,
      bom,
      pricing,
      smartAdvice,
    });
  },

  addShelf: (bayIdx) => {
    const { project, history, activeModuleIndex, batchStartProject } = get();
    const updated = cloneProject(project);
    const mod = updated.modules[activeModuleIndex] || updated.modules[0];
    if (!mod || !mod.bays[bayIdx]) return;

    const bay = mod.bays[bayIdx];
    const T = mod.carcass.panelThickness || 18;
    const plinthH = mod.carcass.plinthHeight ?? 100;
    const netH = Math.max(200, mod.dimensions.height - plinthH - 2 * T);
    const drawerTopY =
      bay.drawers.length > 0
        ? Math.max(...bay.drawers.map((d) => d.elevationY + d.height))
        : 0;
    const minY = Math.min(netH - 80, drawerTopY + 64);
    const maxY = Math.max(minY + 32, netH - 64);

    bay.shelves.push({
      id: `shelf_${bayIdx}_${Date.now()}`,
      bayIndex: bayIdx,
      elevationY: Math.round((minY + maxY) / 2),
      isAdjustable: true,
    });

    // Intelligently distribute all shelves in this bay evenly inside the usable cavity [drawerTopY .. netH]
    const totalShelves = bay.shelves.length;
    const usableSpan = Math.max(120, netH - drawerTopY);
    bay.shelves.forEach((sh, idx) => {
      const idealY = drawerTopY + ((idx + 1) * usableSpan) / (totalShelves + 1);
      const snappedY = Math.round(idealY / 32) * 32;
      sh.elevationY = Math.max(48, Math.min(netH - 48, snappedY));
    });

    if (batchStartProject) {
      set({
        project: updated,
        autoSaveStatus: "unsaved",
      });
      return;
    }
    const { validationIssues, bom, pricing, smartAdvice } = recompute(updated);
    set({
      history: nextHistory(history, project, batchStartProject),
      future: [],
      project: updated,
      autoSaveStatus: "unsaved",
      validationIssues,
      bom,
      pricing,
      smartAdvice,
    });
  },

  removeShelf: (bayIdx, shelfId) => {
    const { project, history, activeModuleIndex, batchStartProject } = get();
    const updated = cloneProject(project);
    const mod = updated.modules[activeModuleIndex] || updated.modules[0];
    if (!mod || !mod.bays[bayIdx]) return;

    mod.bays[bayIdx].shelves = mod.bays[bayIdx].shelves.filter((s) => s.id !== shelfId);
    if (batchStartProject) {
      set({
        project: updated,
        autoSaveStatus: "unsaved",
      });
      return;
    }
    const { validationIssues, bom, pricing, smartAdvice } = recompute(updated);
    set({
      history: nextHistory(history, project, batchStartProject),
      future: [],
      project: updated,
      autoSaveStatus: "unsaved",
      validationIssues,
      bom,
      pricing,
      smartAdvice,
    });
  },

  addHangingRail: (bayIdx) => {
    const { project, history, activeModuleIndex, batchStartProject } = get();
    const updated = cloneProject(project);
    const mod = updated.modules[activeModuleIndex] || updated.modules[0];
    if (!mod || !mod.bays[bayIdx]) return;

    const T_r = mod.carcass.panelThickness || 18;
    const plinth_r = mod.carcass.plinthHeight ?? 100;
    const netH_r = Math.max(240, mod.dimensions.height - plinth_r - 2 * T_r);
    const existingRails = mod.bays[bayIdx].hangingRails.length;
    const targetRailY =
      existingRails === 0
        ? Math.max(120, netH_r - 88)
        : Math.max(96, Math.round((netH_r * 0.48) / 32) * 32);
    mod.bays[bayIdx].hangingRails.push({
      id: `rail_${bayIdx}_${Date.now()}`,
      bayIndex: bayIdx,
      elevationY: Math.min(netH_r - 48, targetRailY),
    });

    if (batchStartProject) {
      set({
        project: updated,
        autoSaveStatus: "unsaved",
      });
      return;
    }
    const { validationIssues, bom, pricing, smartAdvice } = recompute(updated);
    set({
      history: nextHistory(history, project, batchStartProject),
      future: [],
      project: updated,
      autoSaveStatus: "unsaved",
      validationIssues,
      bom,
      pricing,
      smartAdvice,
    });
  },

  removeHangingRail: (bayIdx, railId) => {
    const { project, history, activeModuleIndex, batchStartProject } = get();
    const updated = cloneProject(project);
    const mod = updated.modules[activeModuleIndex] || updated.modules[0];
    if (!mod || !mod.bays[bayIdx]) return;

    mod.bays[bayIdx].hangingRails = mod.bays[bayIdx].hangingRails.filter((r) => r.id !== railId);
    if (batchStartProject) {
      set({
        project: updated,
        autoSaveStatus: "unsaved",
      });
      return;
    }
    const { validationIssues, bom, pricing, smartAdvice } = recompute(updated);
    set({
      history: nextHistory(history, project, batchStartProject),
      future: [],
      project: updated,
      autoSaveStatus: "unsaved",
      validationIssues,
      bom,
      pricing,
      smartAdvice,
    });
  },

  addDrawer: (bayIdx) => {
    const { project, history, activeModuleIndex, batchStartProject } = get();
    const updated = cloneProject(project);
    const mod = updated.modules[activeModuleIndex] || updated.modules[0];
    if (!mod || !mod.bays[bayIdx]) return;

    const bay = mod.bays[bayIdx];
    const T_d = mod.carcass.panelThickness || 18;
    const plinth_d = mod.carcass.plinthHeight ?? 100;
    const netH_d = Math.max(220, mod.dimensions.height - plinth_d - 2 * T_d);
    const prevTop =
      bay.drawers.length > 0
        ? Math.max(...bay.drawers.map((d) => d.elevationY + d.height))
        : 0;
    const drwH = Math.min(180, Math.max(110, Math.floor(netH_d / Math.max(2, bay.drawers.length + 1))));
    const clampedElev = Math.max(0, Math.min(netH_d - drwH, prevTop));
    bay.drawers.push({
      id: `drw_${bayIdx}_${Date.now()}`,
      bayIndex: bayIdx,
      elevationY: clampedElev,
      height: drwH,
      slideType: "soft_close",
    });

    if (batchStartProject) {
      set({
        project: updated,
        autoSaveStatus: "unsaved",
      });
      return;
    }
    const { validationIssues, bom, pricing, smartAdvice } = recompute(updated);
    set({
      history: nextHistory(history, project, batchStartProject),
      future: [],
      project: updated,
      autoSaveStatus: "unsaved",
      validationIssues,
      bom,
      pricing,
      smartAdvice,
    });
  },

  removeDrawer: (bayIdx, drawerId) => {
    const { project, history, activeModuleIndex, batchStartProject } = get();
    const updated = cloneProject(project);
    const mod = updated.modules[activeModuleIndex] || updated.modules[0];
    if (!mod || !mod.bays[bayIdx]) return;

    mod.bays[bayIdx].drawers = mod.bays[bayIdx].drawers.filter((d) => d.id !== drawerId);
    if (batchStartProject) {
      set({
        project: updated,
        autoSaveStatus: "unsaved",
      });
      return;
    }
    const { validationIssues, bom, pricing, smartAdvice } = recompute(updated);
    set({
      history: nextHistory(history, project, batchStartProject),
      future: [],
      project: updated,
      autoSaveStatus: "unsaved",
      validationIssues,
      bom,
      pricing,
      smartAdvice,
    });
  },

  addSpecialFitting: (bayIdx, type) => {
    const { project, history, activeModuleIndex, batchStartProject } = get();
    const updated = cloneProject(project);
    const mod = updated.modules[activeModuleIndex] || updated.modules[0];
    if (!mod || !mod.bays[bayIdx]) return;

    const bay = mod.bays[bayIdx];
    if (!bay.specialFittings) bay.specialFittings = [];
    const defaultHeights: Record<string, number> = {
      trouser_rack: 85,
      shoe_rack: 140,
      wire_basket: 160,
      wardrobe_lift: 840,
      jewelry_tray: 70,
      corner_lemans: 520,
      pantry_pullout: 1700,
      waste_bin: 420,
      spice_pullout: 520,
      cutlery_tray: 65,
      tie_rack: 75,
      led_profile: 20,
    };
    const defaultElevs: Record<string, number> = {
      wardrobe_lift: 1100,
      pantry_pullout: 100,
      corner_lemans: 120,
      waste_bin: 80,
      spice_pullout: 80,
      shoe_rack: 180,
      trouser_rack: 680,
      wire_basket: 420,
      jewelry_tray: 820,
      cutlery_tray: 480,
    };
    const existingCount = bay.specialFittings.length;
    const T_f = mod.carcass.panelThickness || 18;
    const plinth_f = mod.carcass.plinthHeight ?? 100;
    const netH_f = Math.max(200, mod.dimensions.height - plinth_f - 2 * T_f);
    const fitH = Math.min(netH_f - 40, defaultHeights[type] ?? 120);
    const rawFitY = defaultElevs[type] ?? (160 + existingCount * 180);
    const clampedFitY = Math.max(32, Math.min(Math.max(48, netH_f - fitH - 16), rawFitY));
    bay.specialFittings.push({
      id: `fit_${bayIdx}_${Date.now()}_${existingCount}`,
      bayIndex: bayIdx,
      elevationY: clampedFitY,
      type,
      height: fitH,
    });

    if (batchStartProject) {
      set({
        project: updated,
        autoSaveStatus: "unsaved",
      });
      return;
    }
    const { validationIssues, bom, pricing, smartAdvice } = recompute(updated);
    set({
      history: nextHistory(history, project, batchStartProject),
      future: [],
      project: updated,
      autoSaveStatus: "unsaved",
      validationIssues,
      bom,
      pricing,
      smartAdvice,
    });
  },

  removeSpecialFitting: (bayIdx, fittingId) => {
    const { project, history, activeModuleIndex, batchStartProject } = get();
    const updated = cloneProject(project);
    const mod = updated.modules[activeModuleIndex] || updated.modules[0];
    if (!mod || !mod.bays[bayIdx]) return;

    mod.bays[bayIdx].specialFittings = mod.bays[bayIdx].specialFittings.filter((f) => f.id !== fittingId);
    if (batchStartProject) {
      set({
        project: updated,
        autoSaveStatus: "unsaved",
      });
      return;
    }
    const { validationIssues, bom, pricing, smartAdvice } = recompute(updated);
    set({
      history: nextHistory(history, project, batchStartProject),
      future: [],
      project: updated,
      autoSaveStatus: "unsaved",
      validationIssues,
      bom,
      pricing,
      smartAdvice,
    });
  },

  addAdjacentModule: () => {
    const { project, history, activeModuleIndex, batchStartProject } = get();
    const updated = cloneProject(project);
    const targetMod = updated.modules[activeModuleIndex] || updated.modules[0];
    const maxRightX = updated.modules.reduce(
      (maxX, m, idx) => Math.max(maxX, (m.position?.x ?? idx * 1000) + m.dimensions.width),
      0
    );

    if (targetMod) {
      const clonedMod: ModuleInstance = JSON.parse(JSON.stringify(targetMod));
      const uid = `${Date.now()}_${updated.modules.length + 1}`;
      clonedMod.id = `mod_${uid}`;
      const baseName = targetMod.name.replace(/\s*\(Kopya\)|\s*#\d+$/g, "").trim();
      clonedMod.name = `${baseName} #${updated.modules.length + 1}`;
      clonedMod.position = {
        x: maxRightX,
        y: targetMod.position?.y ?? 0,
        z: targetMod.position?.z ?? 0,
      };
      clonedMod.bays.forEach((b, i) => {
        b.door.id = `${clonedMod.id}_door_${i}`;
        b.shelves.forEach((s, j) => {
          s.id = `${clonedMod.id}_shelf_${i}_${j}`;
        });
        b.drawers.forEach((d, j) => {
          d.id = `${clonedMod.id}_drw_${i}_${j}`;
        });
        b.hangingRails.forEach((r, j) => {
          r.id = `${clonedMod.id}_rail_${i}_${j}`;
        });
        (b.specialFittings ?? []).forEach((f, j) => {
          f.id = `${clonedMod.id}_fit_${i}_${j}`;
        });
        (b.subDividers ?? []).forEach((sd, j) => {
          sd.id = `${clonedMod.id}_subdiv_${i}_${j}`;
        });
      });
      updated.modules.push(clonedMod);
    }

    const { validationIssues, bom, pricing, smartAdvice } = recompute(updated);
    set({
      history: nextHistory(history, project, batchStartProject),
      future: [],
      project: updated,
      autoSaveStatus: "unsaved",
      activeModuleIndex: updated.modules.length - 1,
      validationIssues,
      bom,
      pricing,
      smartAdvice,
    });
  },

  duplicateActiveModule: () => {
    const { project, history, activeModuleIndex, batchStartProject } = get();
    const updated = cloneProject(project);
    const targetMod = updated.modules[activeModuleIndex] || updated.modules[0];
    if (!targetMod) return;

    const lastMod = updated.modules[updated.modules.length - 1];
    const newX = lastMod ? lastMod.position.x + lastMod.dimensions.width : 0;

    const clonedMod: ModuleInstance = JSON.parse(JSON.stringify(targetMod));
    clonedMod.id = `mod_${crypto.randomUUID()}`;
    clonedMod.bays.forEach((b, i) => {
      b.door.id = `${clonedMod.id}_door_${i}`;
      for (const items of [b.shelves, b.drawers, b.hangingRails, b.specialFittings ?? [], b.subDividers ?? []]) items.forEach((item, j) => { item.id = `${clonedMod.id}_${i}_${item.id}_${j}`; });
    });
    clonedMod.name = `${targetMod.name} (Kopya)`;
    clonedMod.position.x = newX;

    updated.modules.push(clonedMod);
    const { validationIssues, bom, pricing, smartAdvice } = recompute(updated);
    set({
      history: nextHistory(history, project, batchStartProject),
      future: [],
      project: updated,
      autoSaveStatus: "unsaved",
      activeModuleIndex: updated.modules.length - 1,
      validationIssues,
      bom,
      pricing,
      smartAdvice,
    });
  },

  removeActiveModule: () => {
    const { project, history, activeModuleIndex, batchStartProject } = get();
    if (project.modules.length === 0) return;
    const updated = cloneProject(project);
    updated.modules.splice(activeModuleIndex, 1);
    const nextIdx = Math.min(activeModuleIndex, Math.max(0, updated.modules.length - 1));

    const { validationIssues, bom, pricing, smartAdvice } = recompute(updated);
    set({
      history: nextHistory(history, project, batchStartProject),
      future: [],
      project: updated,
      autoSaveStatus: "unsaved",
      activeModuleIndex: nextIdx,
      selectedComponentId: null,
      validationIssues,
      bom,
      pricing,
      smartAdvice,
    });
  },

  moveActiveModule: (deltaX: number) => {
    const { project, history, activeModuleIndex, batchStartProject } = get();
    const updated = cloneProject(project);
    const mod = updated.modules[activeModuleIndex];
    if (!mod) return;

    mod.position.x = Math.max(0, mod.position.x + deltaX);
    if (batchStartProject) {
      set({
        project: updated,
        autoSaveStatus: "unsaved",
      });
      return;
    }
    const { validationIssues, bom, pricing, smartAdvice } = recompute(updated);
    set({
      history: nextHistory(history, project, batchStartProject),
      future: [],
      project: updated,
      autoSaveStatus: "unsaved",
      validationIssues,
      bom,
      pricing,
      smartAdvice,
    });
  },

  saveToStorage: (name?: string) => {
    const { project, pricing } = get();
    const saveId = `saved_${project.id}_${crypto.randomUUID()}`;
    const title = name || project.title;
    const saveEntry = {
      id: saveId,
      title,
      date: new Date().toISOString(),
      priceEur: pricing.totalWithVatEur,
      project: {
        ...project,
        title,
        schemaVersion: SUPPORTED_PROJECT_SCHEMA_VERSION,
        catalogVersion: project.catalogVersion || project.libraryVersionId || "lib_v4_0_0",
        revisionId: project.revisionId || `rev_v${project.version || 1}`,
      },
    };

    try {
      const existing = JSON.parse(localStorage.getItem("birim_saved_projects") || "[]");
      if (!Array.isArray(existing)) throw new Error("Kayıt listesi bozuk; JSON dışa aktarımını kullanın.");
      existing.unshift(saveEntry);
      try {
        localStorage.setItem("birim_saved_projects", JSON.stringify(existing.slice(0, 30)));
      } catch {
        // QuotaExceededError fallback: cache oversized base64 underlay in session memory and compact history
        const compactProject = structuredClone(saveEntry.project);
        if (compactProject.space?.floorPlanUnderlay?.dataUrl && compactProject.space.floorPlanUnderlay.dataUrl.length > 150_000) {
          sessionUnderlayDataCache.set(saveId, compactProject.space.floorPlanUnderlay.dataUrl);
          compactProject.space.floorPlanUnderlay.dataUrl = undefined;
        }
        existing[0] = { ...saveEntry, project: compactProject };
        localStorage.setItem("birim_saved_projects", JSON.stringify(existing.slice(0, 12)));
      }
    } catch (error) {
      set({ autoSaveStatus: "unsaved" });
      throw new Error(error instanceof Error ? `Kayıt başarısız: ${error.message}` : "Kayıt başarısız.");
    }
    set({ autoSaveStatus: "saved" });
    return saveId;
  },

  loadFromStorage: (id: string) => {
    try {
      const list = JSON.parse(localStorage.getItem("birim_saved_projects") || "[]");
      const found = list.find((item: { id: string; project: DesignProject }) => item.id === id);
      if (found && found.project) {
        const parsedRes = parseAndMigrateProject(found.project);
        if (!parsedRes.success) return false;
        const migrated = migrateV3ProjectToV4({ ...parsedRes.data, status: "draft" } as DesignProject);
        const cachedDataUrl = sessionUnderlayDataCache.get(id);
        if (cachedDataUrl && migrated.space?.floorPlanUnderlay && !migrated.space.floorPlanUnderlay.dataUrl) {
          migrated.space.floorPlanUnderlay.dataUrl = cachedDataUrl;
        }
        const { validationIssues, bom, pricing, smartAdvice } = recompute(migrated);
        set({
          project: migrated,
          autoSaveStatus: "saved",
          activeModuleIndex: 0,
          history: [],
          future: [],
          batchStartProject: null,
          validationIssues,
          bom,
          pricing,
          smartAdvice,
        });
        return true;
      }
    } catch {
      // fallback
    }
    return false;
  },

  getSavedProjects: () => {
    try {
      const list = JSON.parse(localStorage.getItem("birim_saved_projects") || "[]");
      return list.map((item: { id: string; title: string; date: string; priceEur: number }) => ({
        id: item.id,
        title: item.title,
        date: item.date,
        priceEur: item.priceEur,
      }));
    } catch {
      return [];
    }
  },

  exportProjectJSON: () => {
    const { project } = get();
    return JSON.stringify(
      {
        ...project,
        schemaVersion: SUPPORTED_PROJECT_SCHEMA_VERSION,
        catalogVersion: project.catalogVersion || project.libraryVersionId || "lib_v4_0_0",
        revisionId: project.revisionId || `rev_v${project.version || 1}`,
      },
      null,
      2
    );
  },

  importProjectJSON: (jsonStr: string) => {
    try {
      const parsed = JSON.parse(jsonStr);
      const parsedRes = parseAndMigrateProject(parsed);
      if (!parsedRes.success) {
        return { success: false, error: parsedRes.error };
      }
      const validProject = migrateV3ProjectToV4({ ...parsedRes.data, status: "draft" } as DesignProject);
      const { validationIssues, bom, pricing, smartAdvice } = recompute(validProject);
      set({
        project: validProject,
        autoSaveStatus: "unsaved",
        activeModuleIndex: 0,
        history: [],
        future: [],
        batchStartProject: null,
        validationIssues,
        bom,
        pricing,
        smartAdvice,
      });
      return { success: true };
    } catch (e: unknown) {
      return { success: false, error: e instanceof Error ? e.message : "JSON ayrıştırma hatası" };
    }
  },

  applyApprovedEngineeringFix: (proposal) => {
    const { project, history, batchStartProject } = get();
    const updated = applyApprovedRemediationProposal(project, proposal);
    const { validationIssues, bom, pricing, smartAdvice } = recompute(updated);
    set({
      project: updated,
      autoSaveStatus: "unsaved",
      history: nextHistory(history, project, batchStartProject),
      future: [],
      validationIssues,
      bom,
      pricing,
      smartAdvice,
    });
  },

  approveProduction: () => {
    const { project } = get();
    const unified = evaluateUnifiedEngineeringModel(project);
    if (!unified.canExportToCncAndSaw) {
      const firstErr = unified.blockingSafetyAndEngineeringErrors[0];
      return {
        success: false,
        message: `Üretim onayı verilemez (${unified.blockingSafetyAndEngineeringErrors.length} kritik engel): [${firstErr?.code || "HATA"}] ${firstErr?.message || ""}`,
      };
    }

    const v4Compat = evaluateProjectCompatibility(project);
    if (!v4Compat.canApproveProduction || !unified.canApproveFinalErpRelease) {
      return {
        success: false,
        message: `Üretim kontrolü tamamlanmadı (${v4Compat.overallStatus === "UNVERIFIED" || !unified.canApproveFinalErpRelease ? "Saha/Fabrika Onayı Bekliyor" : v4Compat.overallStatus}): Doğrulanmamış kuralları ve üretime etkisini görmek için Üretim Kontrolü panelini açın.`,
      };
    }

    const updated = cloneProject(project);
    updated.status = "production_approved";
    updated.updatedAt = new Date().toISOString();
    const { validationIssues: newIssues, bom, pricing, smartAdvice } = recompute(updated);

    set({
      project: updated,
      autoSaveStatus: "unsaved",
      validationIssues: newIssues,
      bom,
      pricing,
      smartAdvice,
    });

    return {
      success: true,
      message: `Tasarım versiyonu v${updated.version} başarıyla onaylandı ve üretim snapshot kilitlendi.`,
    };
  },

  applySmartSpan: (spanWidth) => {
    const { project, history, batchStartProject } = get();
    const updated = cloneProject(project);
    const mod = updated.modules[0];
    if (!mod) return;

    mod.dimensions.width = spanWidth;
    const optimalBays = Math.min(4, Math.max(1, Math.round(spanWidth / 800)));
    mod.bays = [];
    for (let i = 0; i < optimalBays; i++) {
      mod.bays.push({
        index: i,
        door: { id: `door_${i}`, bayIndex: i, type: optimalBays === 1 ? "double" : "single_left", softClose: true },
        shelves: [{ id: `shelf_${i}_top`, bayIndex: i, elevationY: 1800, isAdjustable: false }],
        hangingRails: [{ id: `rail_${i}_1`, bayIndex: i, elevationY: 1730 }],
        drawers: i === 0 ? [{ id: `drw_${i}_1`, bayIndex: i, elevationY: 0, height: 180, slideType: "soft_close" }] : [],
        specialFittings: [],
      });
    }

    if (batchStartProject) {
      set({
        project: updated,
        autoSaveStatus: "unsaved",
      });
      return;
    }
    const { validationIssues, bom, pricing, smartAdvice } = recompute(updated);
    set({
      history: nextHistory(history, project, batchStartProject),
      future: [],
      project: updated,
      autoSaveStatus: "unsaved",
      validationIssues,
      bom,
      pricing,
      smartAdvice,
    });
  },

  setSelectedSceneObjectId: (selectedSceneObjectId) => set({ selectedSceneObjectId }),

  appendModuleWithMultiWallSnap: (templateId, opts) => {
    const { project, history, batchStartProject } = get();
    const updated = cloneProject(project);
    const solved = computeMultiWallModuleSnap(updated, templateId, {
      wallId: opts?.wallId,
      worldX: opts?.worldX,
      worldZ: opts?.worldZ,
      insertBetween: opts?.insertBetween,
    });
    if (!solved) return null;

    if (solved.snap.insertBetweenShift) {
      const sh = solved.snap.insertBetweenShift;
      const targetWall = updated.space.walls.find((w) => w.id === sh.wallId) || updated.space.walls[0];
      const rad = ((targetWall?.rotationY || 0) * Math.PI) / 180;
      const tx = Math.cos(rad);
      const tz = Math.sin(rad);
      updated.modules.forEach((m) => {
        if (m.category === "complementary" || m.category === "kitchen_island") return;
        const along = (m.position.x - (targetWall?.position.x || 0)) * tx + (m.position.z - (targetWall?.position.z || 0)) * tz;
        if (along >= sh.fromAlongMm - 5) {
          m.position.x = Math.round(m.position.x + tx * sh.shiftDeltaMm);
          m.position.z = Math.round(m.position.z + tz * sh.shiftDeltaMm);
        }
      });
    }

    updated.modules.push(solved.moduleInstance);
    const { validationIssues, bom, pricing, smartAdvice } = recompute(updated);
    set({
      history: nextHistory(history, project, batchStartProject),
      future: [],
      project: updated,
      activeModuleIndex: updated.modules.length - 1,
      selectedModuleIds: [solved.moduleInstance.id],
      selectedSceneObjectId: null,
      autoSaveStatus: "unsaved",
      validationIssues,
      bom,
      pricing,
      smartAdvice,
    });
    return solved.moduleInstance;
  },

  fillWallGapWithParametricModule: (gap, templateId) => {
    const { project, history, batchStartProject } = get();
    const updated = cloneProject(project);
    const refMod = updated.modules.find((m) => m.category !== "complementary") || createDefaultWardrobeModule();

    if (gap.widthMm <= 180) {
      // Narrow gap -> insert exact wall filler panel
      const fid = `mod_gap_filler_${Date.now()}`;
      updated.modules.push({
        id: fid,
        name: `Boşluk Kör Paneli (${gap.widthMm}mm)`,
        category: "complementary",
        moduleFamilyId: "fam_complementary",
        complementaryRole: "wall_filler",
        isOpenFront: true,
        isFixedWidth: true,
        position: { x: gap.worldOriginX, y: gap.targetElevationY, z: gap.worldOriginZ },
        rotation: { x: 0, y: gap.moduleRotationYDeg, z: 0 },
        dimensions: { width: gap.widthMm, height: refMod.dimensions.height, depth: refMod.dimensions.depth },
        carcass: { ...structuredClone(refMod.carcass), backPanelType: "none" },
        bays: [{ index: 0, door: { id: `door_${fid}`, bayIndex: 0, type: "open", softClose: false }, shelves: [], hangingRails: [], drawers: [], specialFittings: [] }],
      });
    } else {
      const tpl = templateId ? getV4TemplateById(templateId) : undefined;
      const fitW = Math.min(2400, gap.widthMm);
      const baseNew = tpl
        ? tpl.createInstance(`mod_fit_${Date.now()}`)
        : structuredClone(refMod);
      baseNew.id = `mod_fit_${Date.now()}`;
      baseNew.name = `Özel Boşluk Modülü (${fitW}mm)`;
      baseNew.isFixedWidth = false;
      baseNew.dimensions.width = fitW;
      baseNew.position = { x: gap.worldOriginX, y: gap.targetElevationY, z: gap.worldOriginZ };
      baseNew.rotation = { x: 0, y: gap.moduleRotationYDeg, z: 0 };
      const idealBays = Math.max(1, Math.min(4, Math.round(fitW / 600)));
      baseNew.bays = Array.from({ length: idealBays }, (_, bIdx) => ({
        index: bIdx,
        door: {
          id: `door_${baseNew.id}_${bIdx}`,
          bayIndex: bIdx,
          type: idealBays === 1 && fitW > 620 ? "double" : bIdx % 2 === 0 ? "single_left" : "single_right",
          softClose: true,
        },
        shelves: [
          { id: `sh_${baseNew.id}_${bIdx}_0`, bayIndex: bIdx, elevationY: 380, isAdjustable: true },
          { id: `sh_${baseNew.id}_${bIdx}_1`, bayIndex: bIdx, elevationY: 760, isAdjustable: true },
        ],
        hangingRails: [],
        drawers: [],
        specialFittings: [],
      }));
      updated.modules.push(baseNew);
    }

    const { validationIssues, bom, pricing, smartAdvice } = recompute(updated);
    set({
      history: nextHistory(history, project, batchStartProject),
      future: [],
      project: updated,
      activeModuleIndex: updated.modules.length - 1,
      autoSaveStatus: "unsaved",
      validationIssues,
      bom,
      pricing,
      smartAdvice,
    });
  },

  addCompositeAssemblyPreset: (presetId) => {
    const preset = V5_COMPOSITE_ASSEMBLIES.find((p) => p.presetId === presetId);
    if (!preset) return;
    const { project, history, batchStartProject } = get();
    const updated = cloneProject(project);
    const maxRight = updated.modules
      .filter((m) => m.category !== "complementary" && (m.rotation?.y || 0) === 0)
      .reduce((mx, m) => Math.max(mx, m.position.x + m.dimensions.width), 0);
    const built = preset.buildItems(maxRight > 0 ? maxRight + 50 : 0);
    updated.modules.push(...built.modules);
    updated.sceneObjects = [...(updated.sceneObjects || []), ...built.sceneObjects];

    // Ensure main wall spans new total width
    const neededWallLen = updated.modules.reduce((mx, m) => Math.max(mx, m.position.x + m.dimensions.width + 200), 3600);
    if (updated.space.walls[0] && updated.space.walls[0].length < neededWallLen) {
      updated.space.walls[0].length = neededWallLen;
    }

    const { validationIssues, bom, pricing, smartAdvice } = recompute(updated);
    set({
      history: nextHistory(history, project, batchStartProject),
      future: [],
      project: updated,
      activeModuleIndex: Math.max(0, updated.modules.length - 1),
      autoSaveStatus: "unsaved",
      validationIssues,
      bom,
      pricing,
      smartAdvice,
    });
  },

  saveActiveModuleAsCustomTemplate: (name, familyId) => {
    const { project, activeModuleIndex } = get();
    const updated = cloneProject(project);
    const activeMod = updated.modules[activeModuleIndex] || updated.modules[0];
    const tplId = `custom_tpl_${Date.now()}`;
    const snap = structuredClone(activeMod);
    snap.position = { x: 0, y: 0, z: 0 };
    const rec: CustomModuleTemplateRecord = {
      templateId: tplId,
      name: name.trim() || activeMod.name,
      description: `${activeMod.dimensions.width}×${activeMod.dimensions.height}×${activeMod.dimensions.depth}mm özel kayıtlı şablon`,
      familyId,
      category: activeMod.category,
      createdAt: new Date().toISOString(),
      baseDimensions: { ...activeMod.dimensions },
      serializedModuleSnapshot: snap,
    };
    const merged = [rec, ...loadSavedCustomModuleTemplates().filter((x) => x.templateId !== tplId)];
    persistCustomModuleTemplates(merged);
    updated.customModuleTemplates = merged;
    set({ project: updated, autoSaveStatus: "unsaved" });
    return tplId;
  },

  deleteCustomModuleTemplate: (templateId) => {
    const { project } = get();
    const updated = cloneProject(project);
    const nextList = (updated.customModuleTemplates || loadSavedCustomModuleTemplates()).filter(
      (t) => t.templateId !== templateId
    );
    persistCustomModuleTemplates(nextList);
    updated.customModuleTemplates = nextList;
    set({ project: updated });
  },

  addSceneObjectFromCatalog: (catalogId, cursorWorld) => {
    const { project, history, batchStartProject } = get();
    const updated = cloneProject(project);
    const solved = solveSceneObjectPlacementSnap(updated, catalogId, cursorWorld);
    if (!solved) return null;
    updated.sceneObjects = [...(updated.sceneObjects || []), solved.object];
    const { validationIssues, bom, pricing, smartAdvice } = recompute(updated);
    set({
      history: nextHistory(history, project, batchStartProject),
      future: [],
      project: updated,
      selectedSceneObjectId: solved.object.id,
      autoSaveStatus: "unsaved",
      validationIssues,
      bom,
      pricing,
      smartAdvice,
    });
    return solved.object;
  },

  addCustomSceneObject: (obj) => {
    const { project, history, batchStartProject } = get();
    const updated = cloneProject(project);
    const solved = solveSceneObjectPlacementSnap(updated, obj) || { object: obj };
    updated.sceneObjects = [...(updated.sceneObjects || []), solved.object];
    const { validationIssues, bom, pricing, smartAdvice } = recompute(updated);
    set({
      history: nextHistory(history, project, batchStartProject),
      future: [],
      project: updated,
      selectedSceneObjectId: solved.object.id,
      autoSaveStatus: "unsaved",
      validationIssues,
      bom,
      pricing,
      smartAdvice,
    });
  },

  updateSceneObject: (id, patch) => {
    const { project, history, batchStartProject } = get();
    const updated = cloneProject(project);
    updated.sceneObjects = (updated.sceneObjects || []).map((so) =>
      so.id === id
        ? {
            ...so,
            ...patch,
            position: patch.position ? { ...so.position, ...patch.position } : so.position,
            rotation: patch.rotation ? { ...so.rotation, ...patch.rotation } : so.rotation,
            dimensions: patch.dimensions ? { ...so.dimensions, ...patch.dimensions } : so.dimensions,
          }
        : so
    );
    if (batchStartProject) {
      set({ project: updated, autoSaveStatus: "unsaved" });
      return;
    }
    const { validationIssues, bom, pricing, smartAdvice } = recompute(updated);
    set({
      history: nextHistory(history, project, batchStartProject),
      future: [],
      project: updated,
      autoSaveStatus: "unsaved",
      validationIssues,
      bom,
      pricing,
      smartAdvice,
    });
  },

  duplicateSceneObject: (id) => {
    const { project, history, batchStartProject } = get();
    const target = (project.sceneObjects || []).find((o) => o.id === id);
    if (!target) return;
    const updated = cloneProject(project);
    const copy = structuredClone(target);
    copy.id = `sobj_copy_${Date.now()}`;
    copy.name = `${target.name} (Kopya)`;
    copy.position.x += Math.min(600, target.dimensions.width + 60);
    updated.sceneObjects = [...(updated.sceneObjects || []), copy];
    const { validationIssues, bom, pricing, smartAdvice } = recompute(updated);
    set({
      history: nextHistory(history, project, batchStartProject),
      future: [],
      project: updated,
      selectedSceneObjectId: copy.id,
      autoSaveStatus: "unsaved",
      validationIssues,
      bom,
      pricing,
      smartAdvice,
    });
  },

  removeSceneObject: (id) => {
    const { project, history, batchStartProject, selectedSceneObjectId } = get();
    const updated = cloneProject(project);
    updated.sceneObjects = (updated.sceneObjects || []).filter((o) => o.id !== id);
    const { validationIssues, bom, pricing, smartAdvice } = recompute(updated);
    set({
      history: nextHistory(history, project, batchStartProject),
      future: [],
      project: updated,
      selectedSceneObjectId: selectedSceneObjectId === id ? null : selectedSceneObjectId,
      autoSaveStatus: "unsaved",
      validationIssues,
      bom,
      pricing,
      smartAdvice,
    });
  },

  runAutoFillersAndCrown: () => {
    const { project, history, batchStartProject } = get();
    const updated = cloneProject(project);
    const { addedModules, summaryNotes } = computeAutoFillersAndTrimForProject(updated);
    const cleaned = updated.modules.filter(
      (m) =>
        !m.id.startsWith("mod_autofiller_") &&
        !m.id.startsWith("mod_autotop_") &&
        !m.id.startsWith("mod_autovalance_")
    );
    updated.modules = [...cleaned, ...addedModules];
    const { validationIssues, bom, pricing, smartAdvice } = recompute(updated);
    set({
      history: nextHistory(history, project, batchStartProject),
      future: [],
      project: updated,
      autoSaveStatus: "unsaved",
      validationIssues,
      bom,
      pricing,
      smartAdvice,
    });
    return { count: addedModules.length, notes: summaryNotes };
  },

  runAutoNotchObstacles: () => {
    const { project, history, batchStartProject } = get();
    const updated = cloneProject(project);
    const { updatedModules, appliedNotches } = autoNotchModulesAroundObstacles(updated);
    updated.modules = updatedModules;
    const { validationIssues, bom, pricing, smartAdvice } = recompute(updated);
    set({
      history: nextHistory(history, project, batchStartProject),
      future: [],
      project: updated,
      autoSaveStatus: "unsaved",
      validationIssues,
      bom,
      pricing,
      smartAdvice,
    });
    return { count: appliedNotches.length, notes: appliedNotches };
  },

  importRoomPlanLiDARJson: (rawJson) => {
    try {
      const parsed = parseRoomPlanScanJson(rawJson);
      const { project, history, batchStartProject } = get();
      const updated = cloneProject(project);
      updated.space.walls = parsed.walls;
      updated.space.ceilingHeight = parsed.ceilingHeightMm;
      updated.space.elements = parsed.elements;

      const mappedObjs: SceneObjectInstance[] = [];
      for (const det of parsed.detectedAppliances) {
        const lower = det.category.toLowerCase();
        const catId = lower.includes("refrigerator")
          ? "obj_fridge_french_910"
          : lower.includes("stove") || lower.includes("oven")
          ? "obj_cooktop_ind_600"
          : lower.includes("dishwasher")
          ? "obj_dishwasher_600"
          : lower.includes("sink")
          ? "obj_sink_undermount_550"
          : lower.includes("sofa")
          ? "obj_birim_modular_sofa_2400"
          : lower.includes("table")
          ? "obj_birim_dining_table_1800"
          : lower.includes("television")
          ? "obj_wall_tv_65"
          : null;
        if (catId) {
          const inst = createSceneObjectInstanceFromCatalog(catId, {
            position: { x: det.xMm, y: 0, z: det.zMm },
          });
          if (inst) mappedObjs.push(inst);
        }
      }
      if (mappedObjs.length > 0) {
        updated.sceneObjects = [...(updated.sceneObjects || []), ...mappedObjs];
      }

      const { validationIssues, bom, pricing, smartAdvice } = recompute(updated);
      set({
        history: nextHistory(history, project, batchStartProject),
        future: [],
        project: updated,
        autoSaveStatus: "unsaved",
        validationIssues,
        bom,
        pricing,
        smartAdvice,
      });
      return {
        ok: true,
        summary: `LiDAR RoomPlan aktarıldı: ${parsed.walls.length} duvar, ${parsed.elements.length} kapı/pencere, ${mappedObjs.length} cihaz (Tavan: ${parsed.ceilingHeightMm}mm).`,
      };
    } catch (err) {
      return {
        ok: false,
        summary: err instanceof Error ? `RoomPlan JSON hatası: ${err.message}` : "Geçersiz JSON",
      };
    }
  },

  setModuleOffsetFromLeftWall: (moduleId, newOffsetXMm) => {
    const { project, history, batchStartProject } = get();
    const updated = cloneProject(project);
    const mod = updated.modules.find((m) => m.id === moduleId);
    if (!mod) return;
    mod.position.x = Math.max(0, Math.round(newOffsetXMm));
    const { validationIssues, bom, pricing, smartAdvice } = recompute(updated);
    set({
      history: nextHistory(history, project, batchStartProject),
      future: [],
      project: updated,
      autoSaveStatus: "unsaved",
      validationIssues,
      bom,
      pricing,
      smartAdvice,
    });
  },

  undo: () => {
    const { history, project, future } = get();
    if (history.length === 0) return;
    const previous = history[history.length - 1];
    const newHistory = history.slice(0, -1);
    const { validationIssues, bom, pricing, smartAdvice } = recompute(previous);

    set({
      project: previous,
      autoSaveStatus: "unsaved",
      activeModuleIndex: Math.min(get().activeModuleIndex, previous.modules.length - 1),
      activeBayIndex: 0,
      selectedComponentId: null,
      history: newHistory,
      future: [project, ...future],
      batchStartProject: null,
      validationIssues,
      bom,
      pricing,
      smartAdvice,
    });
  },

  redo: () => {
    const { future, project, history } = get();
    if (future.length === 0) return;
    const next = future[0];
    const newFuture = future.slice(1);
    const { validationIssues, bom, pricing, smartAdvice } = recompute(next);

    set({
      project: next,
      autoSaveStatus: "unsaved",
      activeModuleIndex: Math.min(get().activeModuleIndex, next.modules.length - 1),
      activeBayIndex: 0,
      selectedComponentId: null,
      history: [...history, project],
      future: newFuture,
      batchStartProject: null,
      validationIssues,
      bom,
      pricing,
      smartAdvice,
    });
  },

  applyTemplate: (templateId) => {
    const tpl = WARDROBE_TEMPLATES.find((t) => t.templateId === templateId);
    if (!tpl) return;
    const { project, history } = get();
    const newMod = tpl.createInstance(`mod_${Date.now()}`);
    const nextVersion = project.version + 1;
    const updated: DesignProject = {
      ...project,
      modules: [newMod],
      version: nextVersion,
      schemaVersion: SUPPORTED_PROJECT_SCHEMA_VERSION,
      revisionId: `rev_v${nextVersion}`,
      updatedAt: new Date().toISOString(),
    };
    const { validationIssues, bom, pricing, smartAdvice } = recompute(updated);

    set({
      history: [...history.slice(-50), project],
      future: [],
      batchStartProject: null,
      project: updated,
      autoSaveStatus: "unsaved",
      activeModuleIndex: 0,
      validationIssues,
      bom,
      pricing,
      smartAdvice,
      selectedComponentId: null,
    });
  },

  loadLinearKitchen: () => {
    const { project, history } = get();
    const kitchenProj = createKitchenLinearProject();
    const { validationIssues, bom, pricing, smartAdvice } = recompute(kitchenProj);

    set({
      history: [...history.slice(-50), project],
      future: [],
      batchStartProject: null,
      project: kitchenProj,
      activeModuleIndex: 0,
      validationIssues,
      bom,
      pricing,
      smartAdvice,
      selectedComponentId: null,
    });
  },

  loadLKitchen: () => {
    const { project, history } = get();
    const lProj = createKitchenLProject();
    const { validationIssues, bom, pricing, smartAdvice } = recompute(lProj);
    set({
      history: [...history.slice(-50), project],
      future: [],
      batchStartProject: null,
      project: lProj,
      activeModuleIndex: 0,
      validationIssues,
      bom,
      pricing,
      smartAdvice,
      selectedComponentId: null,
    });
  },

  loadUKitchen: () => {
    const { project, history } = get();
    const uProj = createKitchenUProject();
    const { validationIssues, bom, pricing, smartAdvice } = recompute(uProj);
    set({
      history: [...history.slice(-50), project],
      future: [],
      batchStartProject: null,
      project: uProj,
      activeModuleIndex: 0,
      validationIssues,
      bom,
      pricing,
      smartAdvice,
      selectedComponentId: null,
    });
  },

  resetToDefault: () => {
    const def = createInitialProject();
    const { validationIssues, bom, pricing, smartAdvice } = recompute(def);
    set({
      project: def,
      autoSaveStatus: "unsaved",
      activeModuleIndex: 0,
      activeBayIndex: 0,
      history: [],
      future: [],
      revisions: [],
      batchStartProject: null,
      selectedModuleIds: def.modules[0] ? [def.modules[0].id] : [],
      validationIssues,
      bom,
      pricing,
      smartAdvice,
      selectedComponentId: null,
      doorOpenAngleDeg: 0,
      drawerOpenMm: 0,
      explodedFactor: 0,
    });
  },

  toggleModuleSelection: (moduleId, additive = true) => {
    const { selectedModuleIds, project } = get();
    const modIndex = project.modules.findIndex((m) => m.id === moduleId);
    if (modIndex < 0) return;

    if (!additive) {
      set({
        selectedModuleIds: [moduleId],
        activeModuleIndex: modIndex,
        activeBayIndex: 0,
        selectedComponentId: null,
      });
      return;
    }

    const exists = selectedModuleIds.includes(moduleId);
    const nextIds = exists
      ? selectedModuleIds.filter((id) => id !== moduleId)
      : [...selectedModuleIds, moduleId];
    set({
      selectedModuleIds: nextIds.length > 0 ? nextIds : [moduleId],
      activeModuleIndex: modIndex,
    });
  },

  selectAllModules: () => {
    const { project } = get();
    set({ selectedModuleIds: project.modules.map((m) => m.id) });
  },

  clearModuleSelection: () => {
    const { project, activeModuleIndex } = get();
    const activeMod = project.modules[activeModuleIndex] || project.modules[0];
    set({ selectedModuleIds: activeMod ? [activeMod.id] : [] });
  },

  batchMoveSelectedModules: (deltaX, deltaZ = 0) => {
    const { project, selectedModuleIds, activeModuleIndex, history, batchStartProject } = get();
    const targetIds =
      selectedModuleIds.length > 0
        ? new Set(selectedModuleIds)
        : new Set([project.modules[activeModuleIndex]?.id].filter(Boolean));
    if (targetIds.size === 0) return;

    const updated = cloneProject(project);
    updated.modules.forEach((mod) => {
      if (targetIds.has(mod.id)) {
        mod.position.x = Math.round(mod.position.x + deltaX);
        mod.position.z = Math.round(mod.position.z + deltaZ);
      }
    });
    if (batchStartProject) {
      set({
        project: updated,
        autoSaveStatus: "unsaved",
      });
      return;
    }
    const { validationIssues, bom, pricing, smartAdvice } = recompute(updated);
    set({
      history: nextHistory(history, project, batchStartProject),
      future: [],
      project: updated,
      autoSaveStatus: "unsaved",
      validationIssues,
      bom,
      pricing,
      smartAdvice,
    });
  },

  batchSetSelectedModulesMaterial: (bodyMatId, doorMatId) => {
    const { project, selectedModuleIds, activeModuleIndex, history, batchStartProject } = get();
    const targetIds =
      selectedModuleIds.length > 0
        ? new Set(selectedModuleIds)
        : new Set([project.modules[activeModuleIndex]?.id].filter(Boolean));
    if (targetIds.size === 0) return;

    const updated = cloneProject(project);
    updated.modules.forEach((mod) => {
      if (targetIds.has(mod.id)) {
        if (bodyMatId) mod.carcass.bodyMaterialId = bodyMatId;
        if (doorMatId) mod.carcass.doorMaterialId = doorMatId;
      }
    });
    if (batchStartProject) {
      set({
        project: updated,
        autoSaveStatus: "unsaved",
      });
      return;
    }
    const { validationIssues, bom, pricing, smartAdvice } = recompute(updated);
    set({
      history: nextHistory(history, project, batchStartProject),
      future: [],
      project: updated,
      autoSaveStatus: "unsaved",
      validationIssues,
      bom,
      pricing,
      smartAdvice,
    });
  },

  batchRemoveSelectedModules: () => {
    const { project, selectedModuleIds, history, batchStartProject } = get();
    if (project.modules.length === 0 || selectedModuleIds.length === 0) return;
    const targetIds = new Set(selectedModuleIds);
    const updated = cloneProject(project);
    const remaining = updated.modules.filter((m) => !targetIds.has(m.id));
    updated.modules = remaining;
    const { validationIssues, bom, pricing, smartAdvice } = recompute(updated);
    set({
      history: nextHistory(history, project, batchStartProject),
      future: [],
      project: updated,
      activeModuleIndex: 0,
      selectedModuleIds: remaining[0] ? [remaining[0].id] : [],
      autoSaveStatus: "unsaved",
      validationIssues,
      bom,
      pricing,
      smartAdvice,
    });
  },

  updateCeilingConfig: (patch) => {
    const { project, history, batchStartProject } = get();
    const updated = cloneProject(project);
    const prev = updated.space.ceilingConfig || {
      enabled: false,
      ceilingType: "flat_plaster" as const,
      showIn3D: true,
      showInElevation2D: true,
    };
    updated.space.ceilingConfig = {
      ...prev,
      ...patch,
    };
    const { validationIssues, bom, pricing, smartAdvice } = recompute(updated);
    set({
      history: nextHistory(history, project, batchStartProject),
      future: [],
      project: updated,
      autoSaveStatus: "unsaved",
      validationIssues,
      bom,
      pricing,
      smartAdvice,
    });
  },

  setFacadeGrainContinuity: (enabled) => {
    const { project, history, batchStartProject } = get();
    const updated = cloneProject(project);
    updated.facadeGrainContinuity = Boolean(enabled);
    if (enabled) {
      updated.modules.forEach((m) => {
        m.carcass.grainContinuityMode = "facade_continuous";
      });
    }
    const { validationIssues, bom, pricing, smartAdvice } = recompute(updated);
    set({
      history: nextHistory(history, project, batchStartProject),
      future: [],
      project: updated,
      autoSaveStatus: "unsaved",
      validationIssues,
      bom,
      pricing,
      smartAdvice,
    });
  },

  setRoomDimensions: (mainWallLengthMm, ceilingHeightMm) => {
    const { project, history, batchStartProject } = get();
    const updated = cloneProject(project);
    const safeLen = Math.max(800, Math.min(15000, Math.round(mainWallLengthMm)));
    const safeCeil =
      ceilingHeightMm !== undefined
        ? Math.max(1800, Math.min(6000, Math.round(ceilingHeightMm)))
        : updated.space.ceilingHeight;
    updated.space.ceilingHeight = safeCeil;
    if (updated.space.walls.length === 0) {
      updated.space.walls.push({
        id: "wall_main",
        name: "Ana Duvar",
        length: safeLen,
        height: safeCeil,
        thickness: 150,
        position: { x: 0, y: 0, z: 0 },
        rotationY: 0,
        elements: [],
      });
    } else {
      updated.space.walls[0].length = safeLen;
      updated.space.walls.forEach((w) => {
        w.height = safeCeil;
      });
    }
    if (batchStartProject) {
      set({
        project: updated,
        autoSaveStatus: "unsaved",
      });
      return;
    }
    const { validationIssues, bom, pricing, smartAdvice } = recompute(updated);
    set({
      history: nextHistory(history, project, batchStartProject),
      future: [],
      project: updated,
      autoSaveStatus: "unsaved",
      validationIssues,
      bom,
      pricing,
      smartAdvice,
    });
  },

  addWallSegment: (wallInput) => {
    const { project, history, batchStartProject } = get();
    const updated = cloneProject(project);
    const wallId = `wall_${Date.now()}_${updated.space.walls.length + 1}`;
    const newWall: WallDefinition = {
      id: wallId,
      name: wallInput.name || `Duvar ${updated.space.walls.length + 1}`,
      length: Math.max(200, Math.round(wallInput.length)),
      height: wallInput.height || updated.space.ceilingHeight || 2600,
      thickness: wallInput.thickness || 150,
      position: {
        x: Math.round(wallInput.position.x),
        y: Math.round(wallInput.position.y || 0),
        z: Math.round(wallInput.position.z),
      },
      rotationY: Math.round(wallInput.rotationY),
      wallType: wallInput.wallType || "standard",
      elements: [],
    };
    updated.space.walls.push(newWall);
    if (batchStartProject) {
      set({
        project: updated,
        autoSaveStatus: "unsaved",
      });
      return;
    }
    const { validationIssues, bom, pricing, smartAdvice } = recompute(updated);
    set({
      history: nextHistory(history, project, batchStartProject),
      future: [],
      project: updated,
      autoSaveStatus: "unsaved",
      validationIssues,
      bom,
      pricing,
      smartAdvice,
    });
    return wallId;
  },

  updateWallSegment: (wallId, patch) => {
    const { project, history, batchStartProject } = get();
    const updated = cloneProject(project);
    const targetIdx = updated.space.walls.findIndex((w) => w.id === wallId);
    if (targetIdx < 0) return;

    const current = updated.space.walls[targetIdx];
    updated.space.walls[targetIdx] = {
      ...current,
      name: patch.name ?? current.name,
      length:
        patch.length !== undefined
          ? Math.max(200, Math.min(15000, Math.round(patch.length)))
          : current.length,
      height:
        patch.height !== undefined
          ? Math.max(1800, Math.min(6000, Math.round(patch.height)))
          : current.height,
      thickness:
        patch.thickness !== undefined
          ? Math.max(50, Math.min(600, Math.round(patch.thickness)))
          : current.thickness,
      position: {
        x:
          patch.position?.x !== undefined
            ? Math.round(patch.position.x)
            : current.position.x,
        y:
          patch.position?.y !== undefined
            ? Math.round(patch.position.y)
            : current.position.y,
        z:
          patch.position?.z !== undefined
            ? Math.round(patch.position.z)
            : current.position.z,
      },
      rotationY:
        patch.rotationY !== undefined
          ? ((Math.round(patch.rotationY) % 360) + 360) % 360
          : current.rotationY,
      wallType: patch.wallType ?? current.wallType,
    };

    if (batchStartProject) {
      set({
        project: updated,
        autoSaveStatus: "unsaved",
      });
      return;
    }
    const { validationIssues, bom, pricing, smartAdvice } = recompute(updated);
    set({
      history: nextHistory(history, project, batchStartProject),
      future: [],
      project: updated,
      autoSaveStatus: "unsaved",
      validationIssues,
      bom,
      pricing,
      smartAdvice,
    });
  },

  removeWallSegment: (wallId) => {
    const { project, history, batchStartProject } = get();
    if (project.space.walls.length <= 1) return;
    const updated = cloneProject(project);
    const remaining = updated.space.walls.filter((w) => w.id !== wallId);
    if (remaining.length === 0) return;
    updated.space.walls = remaining;
    if (batchStartProject) {
      set({
        project: updated,
        autoSaveStatus: "unsaved",
      });
      return;
    }
    const { validationIssues, bom, pricing, smartAdvice } = recompute(updated);
    set({
      history: nextHistory(history, project, batchStartProject),
      future: [],
      project: updated,
      autoSaveStatus: "unsaved",
      validationIssues,
      bom,
      pricing,
      smartAdvice,
    });
  },

  addSpaceObstacle: (obstacleInput) => {
    const { project, history, batchStartProject } = get();
    const updated = cloneProject(project);
    const obstacleId =
      obstacleInput.id || `arch_${obstacleInput.type}_${Date.now()}`;
    const newObstacle: ArchitecturalElement = {
      id: obstacleId,
      type: obstacleInput.type,
      name: obstacleInput.name,
      rotationY: obstacleInput.rotationY ?? 0,
      doorSwing: obstacleInput.doorSwing ?? "left",
      position: { ...obstacleInput.position },
      dimensions: { ...obstacleInput.dimensions },
    };
    updated.space.elements = [...(updated.space.elements || []), newObstacle];
    if (batchStartProject) {
      set({
        project: updated,
        autoSaveStatus: "unsaved",
      });
      return obstacleId;
    }
    const { validationIssues, bom, pricing, smartAdvice } = recompute(updated);
    set({
      history: nextHistory(history, project, batchStartProject),
      future: [],
      project: updated,
      autoSaveStatus: "unsaved",
      validationIssues,
      bom,
      pricing,
      smartAdvice,
    });
    return obstacleId;
  },

  updateSpaceObstacle: (obstacleId, patch) => {
    const { project, history, batchStartProject } = get();
    const updated = cloneProject(project);
    updated.space.elements = (updated.space.elements || []).map((el) =>
      el.id === obstacleId
        ? {
            ...el,
            name: patch.name ?? el.name,
            rotationY: patch.rotationY !== undefined ? patch.rotationY : el.rotationY,
            doorSwing: patch.doorSwing !== undefined ? patch.doorSwing : el.doorSwing,
            position: patch.position
              ? { ...el.position, ...patch.position }
              : el.position,
            dimensions: patch.dimensions
              ? { ...el.dimensions, ...patch.dimensions }
              : el.dimensions,
          }
        : el
    );
    if (batchStartProject) {
      set({
        project: updated,
        autoSaveStatus: "unsaved",
      });
      return;
    }
    const { validationIssues, bom, pricing, smartAdvice } = recompute(updated);
    set({
      history: nextHistory(history, project, batchStartProject),
      future: [],
      project: updated,
      autoSaveStatus: "unsaved",
      validationIssues,
      bom,
      pricing,
      smartAdvice,
    });
  },

  removeSpaceObstacle: (obstacleId) => {
    const { project, history, batchStartProject } = get();
    const updated = cloneProject(project);
    updated.space.elements = (updated.space.elements || []).filter(
      (el) => el.id !== obstacleId
    );
    if (batchStartProject) {
      set({
        project: updated,
        autoSaveStatus: "unsaved",
      });
      return;
    }
    const { validationIssues, bom, pricing, smartAdvice } = recompute(updated);
    set({
      history: nextHistory(history, project, batchStartProject),
      future: [],
      project: updated,
      autoSaveStatus: "unsaved",
      validationIssues,
      bom,
      pricing,
      smartAdvice,
    });
  },

  setFloorPlanUnderlay: (underlay) => {
    const { project, history, batchStartProject } = get();
    const updated = cloneProject(project);
    updated.space.floorPlanUnderlay = underlay ?? undefined;
    if (batchStartProject) {
      set({
        project: updated,
        autoSaveStatus: "unsaved",
      });
      return;
    }
    const { validationIssues, bom, pricing, smartAdvice } = recompute(updated);
    set({
      history: nextHistory(history, project, batchStartProject),
      future: [],
      project: updated,
      autoSaveStatus: "unsaved",
      validationIssues,
      bom,
      pricing,
      smartAdvice,
    });
  },

  importWallsFromUnderlay: (replaceExisting = false) => {
    const { project, history, batchStartProject } = get();
    const underlay = project.space.floorPlanUnderlay;
    if (!underlay || !underlay.polylines || underlay.polylines.length === 0) return 0;

    const extractedWalls = convertUnderlayPolylinesToWalls(
      underlay,
      project.space.ceilingHeight || 2600
    );
    if (extractedWalls.length === 0) return 0;

    const updated = cloneProject(project);
    updated.space.walls = replaceExisting
      ? extractedWalls
      : [...updated.space.walls, ...extractedWalls];
    if (batchStartProject) {
      set({
        project: updated,
        autoSaveStatus: "unsaved",
      });
      return;
    }
    const { validationIssues, bom, pricing, smartAdvice } = recompute(updated);
    set({
      history: nextHistory(history, project, batchStartProject),
      future: [],
      project: updated,
      autoSaveStatus: "unsaved",
      validationIssues,
      bom,
      pricing,
      smartAdvice,
    });
    return extractedWalls.length;
  },
}));
