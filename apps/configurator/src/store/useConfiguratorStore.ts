import { create, type StoreApi, type UseBoundStore } from "zustand";
import { DesignProject, ValidationIssue, ModuleInstance, type DrawerConfig, type RemediationProposal, HandleCategory, ArchitecturalElement, WallDefinition, FloorPlanUnderlay, SceneObjectInstance, WallFreeGapSlot, type MaterialDefinition, TENANT_BIRIM_ENTERPRISE, buildTenantScopedStorageKey, listRegisteredTenantProfiles, type SaasRoleId, type TenantWorkspaceProfile } from "@birim/core";
import { ManufacturingBOM } from "@birim/manufacturing";
import { PricingBreakdown } from "@birim/pricing";
import { SmartAdvisorFeedback } from "@birim/catalog";
import {
  initialProj,
  initIssues,
  initBom,
  initPricing,
  initAdvice,
} from "./storeHelpers";
import { createViewportAndUiSlice } from "./slices/viewportAndUiSlice";
import { createHistoryAndTransactionsSlice } from "./slices/historyAndTransactionsSlice";
import { createModuleAndInteriorSlice } from "./slices/moduleAndInteriorSlice";
import { createPersistenceAndSceneSlice } from "./slices/persistenceAndSceneSlice";
import { createMultiSelectSpaceAndTenantSlice } from "./slices/multiSelectSpaceAndTenantSlice";
import { safeLocalStorageGet } from "../lib/safeStorage";

export type ViewMode = "3d" | "2d_elevation" | "2d_plan" | "2d_section";
export type CameraPreset = "front" | "side" | "top" | "iso";
export type UserExperienceTier = "simple" | "architect" | "factory";
export type ToolbarLabelMode = "labeled" | "compact";
export type ViewportRenderStyle = "solid" | "wireframe" | "transparent" | "carcass_only" | "exploded";

export interface LiveChangeImpactSummary {
  timestampMs: number;
  actionLabel: string;
  totalPieces: number;
  piecesDelta: number;
  totalSheets: number;
  sheetsDelta: number;
  totalWithVatEur: number;
  priceDeltaEur: number;
  blockingIssueCount: number;
}

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

export interface ConfiguratorState {
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
  displayUnit: "cm" | "mm";
  activeWallId: string | null;
  setActiveWallId: (wallId: string | null) => void;
  uiMode: "simple" | "technical";
  userExperienceTier: UserExperienceTier;
  toolbarLabelMode: ToolbarLabelMode;
  viewportRenderStyle: ViewportRenderStyle;
  lastChangeImpact: LiveChangeImpactSummary | null;
  skipSmartLauncherByDefault: boolean;
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

  // Multi-Tenant SaaS State
  activeTenantId: string;
  activeTenantRole: SaasRoleId;
  activeTenantProfile: TenantWorkspaceProfile;
  availableTenants: TenantWorkspaceProfile[];
  switchActiveTenant: (tenantIdOrSlug: string, role?: SaasRoleId) => TenantWorkspaceProfile;
  setActiveTenantRole: (role: SaasRoleId) => void;
  syncTenantCatalogMaterials: (materials: MaterialDefinition[]) => number;
  updateActiveTenantProfile: (
    patch: Partial<Pick<TenantWorkspaceProfile, "construction" | "machine" | "pricing" | "brand">>
  ) => TenantWorkspaceProfile;

  // Actions
  setDisplayUnit: (unit: "cm" | "mm") => void;
  setUiMode: (mode: "simple" | "technical") => void;
  setUserExperienceTier: (tier: UserExperienceTier) => void;
  setToolbarLabelMode: (mode: ToolbarLabelMode) => void;
  setViewportRenderStyle: (style: ViewportRenderStyle) => void;
  dismissChangeImpact: () => void;
  setSkipSmartLauncherByDefault: (skip: boolean) => void;
  updateBayDrawerConfig: (bayIndex: number, drawerId: string, patch: Partial<DrawerConfig>) => void;
  setActiveBayIndex: (idx: number) => void;
  setAutoSaveStatus: (status: "saved" | "saving" | "unsaved") => void;
  setViewMode: (mode: ViewMode) => void;
  setCameraPreset: (preset: CameraPreset) => void;
  setSelectedComponentId: (id: string | null) => void;
  setActiveModuleIndex: (index: number) => void;
  setDoorOpenAngleDeg: (angle: number, animated?: boolean) => void;
  setDrawerOpenMm: (mm: number, animated?: boolean) => void;
  toggleDrawerOpen: (animated?: boolean) => void;
  setExplodedFactor: (factor: number) => void;
  toggleDoorOpen: (animated?: boolean) => void;
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
  applyHardwareProductToBay: (bayIndex: number, hardwareProductId: string, options?: { drawerId?: string; forceApply?: boolean }) => { applied: boolean; messageTr: string };
  previewHardwarePackageDelta: (packageId: string) => {
    packageId: string;
    currentTotalEur: number;
    projectedTotalEur: number;
    deltaEur: number;
    affectedDoors: number;
    affectedDrawers: number;
  };
  applyHardwarePackageToProject: (packageId: string) => { applied: boolean; messageTr: string; deltaEur: number };
  removeHardwareFromBay: (bayIndex: number, targetKind: "door" | "drawer" | "special_fitting", targetId?: string) => { removed: boolean; messageTr: string };
  setMaterials: (bodyMatId?: string, doorMatId?: string) => void;
  setBayCount: (count: number) => void;
  setBayDoorType: (bayIdx: number, type: "single_left" | "single_right" | "double" | "sliding" | "tambour" | "open") => void;
  setBayHandleCategory: (bayIdx: number, category: HandleCategory, handleProfileId?: string) => void;

  // Interior fittings
  addShelf: (bayIdx: number) => void;
  addFixedShelf: (bayIdx: number) => void;
  setShelfMountType: (
    bayIdx: number,
    shelfId: string,
    isAdjustable: boolean,
    fixedConnectorType?: "minifix_dowel" | "rafix_20"
  ) => void;
  removeShelf: (bayIdx: number, shelfId: string) => void;
  addHangingRail: (bayIdx: number) => void;
  removeHangingRail: (bayIdx: number, railId: string) => void;
  addDrawer: (bayIdx: number) => void;
  removeDrawer: (bayIdx: number, drawerId: string) => void;
  addSpecialFitting: (bayIdx: number, type: import("@birim/core").SpecialFittingConfig["type"]) => void;
  removeSpecialFitting: (bayIdx: number, fittingId: string) => void;

  // Multi-module management
  addAdjacentModule: () => void;
  addStackedTopModule: () => void;
  duplicateActiveModule: () => void;
  removeActiveModule: () => void;
  setModuleProductionAndPricingFlags: (moduleIndex: number, patch: { includeInProduction?: boolean; includeInPricing?: boolean }) => void;
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
  updateCarcass: (patch: Partial<ModuleInstance["carcass"]>) => void;
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
      doorOpenSide?: ArchitecturalElement["doorOpenSide"];
      metadata?: ArchitecturalElement["metadata"];
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
  applyBatchProjectUpdate: (
    mutator: (draft: DesignProject) => void,
    actionLabel?: string
  ) => void;
  restoreProjectVariantSnapshot: (snapshot: DesignProject, label?: string) => void;

  // Revisions & Atomic Batch Undo
  selectModuleBayComponent: (patch: {
    activeModuleIndex?: number;
    activeBayIndex?: number;
    selectedComponentId?: string | null;
    beginBatch?: boolean;
  }) => void;
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
    cursorWorld?: { x?: number; z?: number; wallId?: string }
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


export const useConfiguratorStore: UseBoundStore<StoreApi<ConfiguratorState>> = create<ConfiguratorState>()((set, get) => ({
  project: { ...initialProj, tenantId: TENANT_BIRIM_ENTERPRISE.tenantId },
  activeTenantId: TENANT_BIRIM_ENTERPRISE.tenantId,
  activeTenantRole: "org_owner",
  activeTenantProfile: structuredClone(TENANT_BIRIM_ENTERPRISE),
  availableTenants: listRegisteredTenantProfiles(),
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
  displayUnit: "cm",
  uiMode: "simple",
  userExperienceTier: "simple",
  toolbarLabelMode: "compact",
  viewportRenderStyle: "solid",
  lastChangeImpact: null,
  skipSmartLauncherByDefault:
    safeLocalStorageGet(
      buildTenantScopedStorageKey(TENANT_BIRIM_ENTERPRISE.tenantId, "skip_smart_launcher")
    ) === "1",
  activeBayIndex: 0,
  autoSaveStatus: "unsaved",
  setAutoSaveStatus: (autoSaveStatus) => set({ autoSaveStatus }),
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
  ...createViewportAndUiSlice(set, get),
  ...createHistoryAndTransactionsSlice(set, get),
  ...createModuleAndInteriorSlice(set, get),
  ...createPersistenceAndSceneSlice(set, get),
  ...createMultiSelectSpaceAndTenantSlice(set, get),
}) as ConfiguratorState);


/**
 * HMR-safe atomic selection helper for 3D & 2D viewports.
 * Guarantees zero runtime TypeError even if Next.js Fast Refresh preserves an older store singleton in memory.
 */
export function selectModuleBayComponentSafe(patch: {
  activeModuleIndex?: number;
  activeBayIndex?: number;
  selectedComponentId?: string | null;
  beginBatch?: boolean;
}): void {
  const st = useConfiguratorStore.getState();
  if (typeof st.selectModuleBayComponent === "function") {
    st.selectModuleBayComponent(patch);
    return;
  }
  const nextModIdx =
    typeof patch.activeModuleIndex === "number" ? patch.activeModuleIndex : st.activeModuleIndex;
  const nextBayIdx =
    typeof patch.activeBayIndex === "number" ? patch.activeBayIndex : st.activeBayIndex;
  const nextCompId =
    patch.selectedComponentId !== undefined ? patch.selectedComponentId : st.selectedComponentId;
  if (patch.beginBatch && !st.batchStartProject && typeof st.beginHistoryTransaction === "function") {
    st.beginHistoryTransaction();
  }
  useConfiguratorStore.setState({
    activeModuleIndex: nextModIdx,
    activeBayIndex: nextBayIdx,
    selectedComponentId: nextCompId,
    selectedModuleIds: st.project.modules[nextModIdx] ? [st.project.modules[nextModIdx].id] : [],
  });
}
