"use client";
import { solveAngledWallSnapForModule, originToModulePosition } from "../engine/angledWallSnapEngine";
import { applyValidatedDimensionsToModule } from "../components/workspace/moduleLibraryUtils";
import { useMemo, useCallback, useRef } from "react";
import { useConfiguratorStore } from "../../store/useConfiguratorStore";
import {
  DEFAULT_MATERIALS,
  registerRuntimeMaterial,
  syncProjectCustomMaterials,
  createDefaultWardrobeModule,
  type MaterialDefinition,
  type ModuleInstance,
  type ArchitecturalElement,
  calculateBayWidths,
  calculateNetInnerHeight,
  validateProject,
  calculateFourSpaceDimensions,
  evaluateProjectCompatibility,
  evaluateUnifiedEngineeringModel,
  applyApprovedRemediationProposal,
  REGIONAL_ERGONOMIC_PROFILES,
  type EngineeringValidationFinding,
  type RemediationProposal,
  type RegionErgonomicProfileId,
  computeCornerFillerAutoFix,
  type PanelCutoutConfig,
  type BayConfig,
  computeContinuousKitchenLayers,
  type DoorSystemId,
  type SlidingMountingType,
  type DoorOverlayType,
  type HandleCategory,
  type OpeningTechnology,
  calculateModulePlacement,
} from "@birim/core";
import {
  analyzeAndAdviseSpan,
  WARDROBE_TEMPLATES,
  KITCHEN_TEMPLATES,
  V4_MODULE_FAMILIES,
  V4_MODULE_TEMPLATES,
  DOOR_SYSTEM_DEFINITIONS,
  HANDLE_PROFILES,
  getAllHandleProfiles,
  OPENING_MECHANISM_DEFINITIONS,
  V4_HARDWARE_CATALOG,
  getAllHardwareProducts,
  HARDWARE_DRILLING_TEMPLATES,
  getHardwareProductById,
  getDrillingTemplateForHardware,
  selectOptimalRunnerLengthMm,
  WARDROBE_INTERIOR_WIZARDS,
  type WardrobeInteriorWizardId,
  getV4TemplateById,
  generateSmartWallLayouts,
  distributeModulesAlongWall,
  applyWardrobeInteriorWizard,
  generateKitchenComplementaryModules,
  defaultLibraryAdminStore,
} from "@birim/catalog";
import {
  generateBOMForProject,
  calculateBlumEngineeringSummary,
  generateBlumBxfXml,
  parseBlumBxfXml,
  exportAllPanelsDXF,
  exportNestingSheetsDXF,
  exportIndustrialCamZipArchive,
  exportOptiCutCutListCsv,
  exportHardwareBomCsv,
  generateNestingDiagramSvg,
  generateThermalPartLabelsHtml,
  buildBirimErpNestingBundle,
  type BirimErpNestingBuildOptions,
  type BirimErpNestingExportBundle,
} from "@birim/manufacturing";
import { calculateProjectPrice } from "@birim/pricing";
import { computeNestingAsync } from "../../workers/manufacturing-worker-client";
import {
  generateModuleGeometry,
  generateElevation2D,
  generateTopPlan2D,
  generateCrossSection2D,
} from "@birim/geometry";
import {
  validateSpatialAndKitchenEngineering,
  getEffectiveSpaceObstacles,
  getEffectiveSpaceWalls,
  getModuleOrientedFootprint,
  classifyModuleCornerFootprint,
  KITCHEN_ENGINEERING_RULE_REGISTRY,
  setActiveDraggedTemplateId,
  getActiveDraggedTemplateId,
  startModuleSilhouetteDrag,
  startAccessorySilhouetteDrag,
  type RowSnapPreviewResult,
  type SnapSlotCandidate,
} from "../engine/kitchenSpatialEngine";

export {
  DEFAULT_MATERIALS,
  WARDROBE_TEMPLATES,
  KITCHEN_TEMPLATES,
  V4_MODULE_FAMILIES,
  V4_MODULE_TEMPLATES,
  DOOR_SYSTEM_DEFINITIONS,
  HANDLE_PROFILES,
  OPENING_MECHANISM_DEFINITIONS,
  V4_HARDWARE_CATALOG,
  WARDROBE_INTERIOR_WIZARDS,
  defaultLibraryAdminStore,
  generateModuleGeometry,
  generateElevation2D,
  generateTopPlan2D,
  generateCrossSection2D,
  getModuleOrientedFootprint,
  classifyModuleCornerFootprint,
  KITCHEN_ENGINEERING_RULE_REGISTRY,
};

export {
  setActiveDraggedTemplateId,
  getActiveDraggedTemplateId,
  startModuleSilhouetteDrag,
  startAccessorySilhouetteDrag,
  type RowSnapPreviewResult,
  type SnapSlotCandidate,
};

/**
 * Computes the live 3D/2D Ghost Cabinet Silhouette and all Magnetic Snap Target Slots
 * along the wall row while dragging a module from the catalog.
 */
export function computeRowSnapPreview(
  project: ReturnType<typeof useConfiguratorStore.getState>["project"],
  templateId: string,
  dropWorldXMm?: number
): RowSnapPreviewResult | null {
  const tpl =
    getV4TemplateById(templateId) ||
    WARDROBE_TEMPLATES.find((w) => w.templateId === templateId) ||
    KITCHEN_TEMPLATES.find((k) => k.templateId === templateId);
  if (!tpl) return null;

  const previewModule = tpl.createInstance(`ghost_${templateId}`);
  const isWallCab =
    previewModule.category === "kitchen_wall" ||
    previewModule.moduleFamilyId === "fam_kitchen_wall";
  const targetY = isWallCab ? 1400 : 0;

  const sameRowMods = project.modules.filter((m) => {
    if (m.category === "complementary") return false;
    const mIsWall = m.category === "kitchen_wall" || m.moduleFamilyId === "fam_kitchen_wall";
    return mIsWall === isWallCab && (m.rotation?.y || 0) === 0;
  });

  const overlapsAt = (candX: number) =>
    sameRowMods.some(
      (m) =>
        candX < m.position.x + m.dimensions.width - 2 &&
        candX + previewModule.dimensions.width > m.position.x + 2
    );

  const rawCandidates: { x: number; label: string }[] = [
    { x: 0, label: "Duvar Başlangıcı (X: 0mm)" },
  ];
  sameRowMods.forEach((m, idx) => {
    const rightEdge = m.position.x + m.dimensions.width;
    const leftEdge = Math.max(0, m.position.x - previewModule.dimensions.width);
    rawCandidates.push({
      x: rightEdge,
      label: `${idx + 1}. Modül Sağına Sıfır Snap (X: ${rightEdge}mm)`,
    });
    if (leftEdge >= 0) {
      rawCandidates.push({
        x: leftEdge,
        label: `${idx + 1}. Modül Soluna Sıfır Snap (X: ${leftEdge}mm)`,
      });
    }
  });

  // Deduplicate by X coordinate and keep non-overlapping valid slots
  const seenX = new Set<number>();
  const validCandidates = rawCandidates.filter((c) => {
    if (c.x < 0 || overlapsAt(c.x) || seenX.has(c.x)) return false;
    seenX.add(c.x);
    return true;
  });

  let chosen = validCandidates[validCandidates.length - 1] || {
    x:
      sameRowMods.length > 0
        ? Math.max(...sameRowMods.map((m) => m.position.x + m.dimensions.width))
        : 0,
    label: "Sıra Sonuna Mıknatıslandı",
  };
  let isSnappedToSlot = true;

  if (typeof dropWorldXMm === "number" && validCandidates.length > 0) {
    let bestDist = Infinity;
    for (const cand of validCandidates) {
      const d = Math.abs(cand.x - dropWorldXMm);
      if (d < bestDist) {
        bestDist = d;
        chosen = cand;
      }
    }
    const gridX = Math.max(0, Math.round(dropWorldXMm / 50) * 50);
    if (bestDist > 240 && !overlapsAt(gridX)) {
      chosen = { x: gridX, label: `50mm Izgara Hizası (X: ${gridX}mm)` };
      isSnappedToSlot = false;
    }
  }

  previewModule.position = { x: chosen.x, y: targetY, z: 0 };

  const snapSlots: SnapSlotCandidate[] = validCandidates.map((c) => ({
    x: c.x,
    y: targetY,
    width: previewModule.dimensions.width,
    height: previewModule.dimensions.height,
    depth: previewModule.dimensions.depth,
    label: c.label,
    isActive: c.x === chosen.x && isSnappedToSlot,
  }));



  return {
    templateId,
    previewModule,
    snappedX: chosen.x,
    snappedY: targetY,
    snappedZ: 0,
    snapLabel: chosen.label,
    isSnappedToSlot,
    snapSlots,
  };
}


let adapterNestingTimer: ReturnType<typeof setTimeout> | null = null;
const cachedCompatByProject = new WeakMap<
  DesignProject,
  ReturnType<typeof evaluateProjectCompatibility>
>();
const cachedSpatialByProject = new WeakMap<
  DesignProject,
  ReturnType<typeof validateSpatialAndKitchenEngineering>
>();

const cachedUnifiedEngByProject = new WeakMap<
  DesignProject,
  ReturnType<typeof evaluateUnifiedEngineeringModel>
>();

function getMemoizedUnifiedEngineering(project: DesignProject) {
  const hit = cachedUnifiedEngByProject.get(project);
  if (hit) return hit;
  const computed = evaluateUnifiedEngineeringModel(project);
  cachedUnifiedEngByProject.set(project, computed);
  return computed;
}

function getMemoizedProjectCompatibility(project: DesignProject) {
  const hit = cachedCompatByProject.get(project);
  if (hit) return hit;
  const computed = evaluateProjectCompatibility(project);
  cachedCompatByProject.set(project, computed);
  return computed;
}

function getMemoizedSpatialValidation(project: DesignProject) {
  const hit = cachedSpatialByProject.get(project);
  if (hit) return hit;
  const computed = validateSpatialAndKitchenEngineering(project);
  cachedSpatialByProject.set(project, computed);
  return computed;
}

/** One transaction for adapter edits; derived manufacturing state cannot lag geometry. */
function commitAdapterState(patch: Partial<ReturnType<typeof useConfiguratorStore.getState>>) {
  const state = useConfiguratorStore.getState();
  if (!patch.project) { useConfiguratorStore.setState(patch); return; }
  const project = {
    ...patch.project,
    status: "draft" as const,
    version: Math.max(state.project.version + 1, patch.project.version),
    revisionId: `rev_v${Math.max(state.project.version + 1, patch.project.version)}`,
    updatedAt: new Date().toISOString(),
  };
  // Fast-path during active 2D/3D drag or resize gesture: skip heavy BOM/2D sheet nesting/pricing/validation on 60Hz mousemove!
  // commitHistoryTransaction() automatically runs full recompute(project) once on mouseup.
  if (state.batchStartProject !== null && !patch.history) {
    useConfiguratorStore.setState({
      ...patch,
      project,
      autoSaveStatus: "unsaved",
    });
    return;
  }
  const isBrowser = typeof window !== "undefined";
  const bom =
    patch.bom ?? generateBOMForProject(project, undefined, { skipSyncNesting: isBrowser });
  const pricing = patch.pricing ?? calculateProjectPrice(bom, undefined, undefined, project.sceneObjects || []);
  const validationIssues =
    patch.validationIssues ?? getMemoizedUnifiedEngineering(project).findings;
  const active = project.modules[patch.activeModuleIndex ?? state.activeModuleIndex] ?? project.modules[0] ?? createDefaultWardrobeModule("empty_fallback");
  useConfiguratorStore.setState({
    ...patch,
    project,
    bom,
    pricing,
    validationIssues,
    smartAdvice: analyzeAndAdviseSpan(active.dimensions.width, active.dimensions.height),
    autoSaveStatus: "unsaved",
    history: patch.history ?? [...state.history.slice(-50), state.project],
    future: patch.future ?? [],
  });
  if (isBrowser && bom.cutList.length > 0) {
    if (adapterNestingTimer) clearTimeout(adapterNestingTimer);
    adapterNestingTimer = setTimeout(() => {
      adapterNestingTimer = null;
      void computeNestingAsync(bom.cutList, project.version, undefined, {
        projectId: project.id,
        revisionId: project.revisionId,
      }).then((workerSheets) => {
        if (!workerSheets) return;
        const latest = useConfiguratorStore.getState();
        if (latest.project.id === project.id && latest.project.version === project.version) {
          const refreshedBom = { ...latest.bom, nestingResults: workerSheets };
          useConfiguratorStore.setState({
            bom: refreshedBom,
            pricing: calculateProjectPrice(refreshedBom, undefined, undefined, latest.project.sceneObjects || []),
          });
        }
      });
    }, 180);
  }
}

/**
 * Safe V3.1 + V4 Universal Library Adapter over the Configurator Store.
 * Includes spatial & kitchen engineering rules, 90° corner rotation support,
 * architectural obstacle management, and V4 Universal Module & Hardware Library.
 */
export interface SubDividerShelfInterval {
  label: string;
  botY: number;
  topY: number;
  height: number;
  hasConflict: boolean;
  conflictReason?: string;
}

export function getBayShelfIntervalsForSubDivider(
  bay: BayConfig,
  netInnerH: number,
  panelThickness = 18
): SubDividerShelfInterval[] {
  const T = panelThickness || 18;
  const sortedShelves = [...(bay.shelves || [])].sort((a, b) => a.elevationY - b.elevationY);
  const rawIntervals: { label: string; botY: number; topY: number }[] = [];

  if (sortedShelves.length === 0) {
    rawIntervals.push({ label: "Alt Taban ↔ Üst Tavan", botY: 0, topY: netInnerH });
  } else {
    if (sortedShelves[0].elevationY >= 60) {
      rawIntervals.push({
        label: "Alt Taban ↔ Raf 1",
        botY: 0,
        topY: sortedShelves[0].elevationY,
      });
    }
    for (let k = 0; k < sortedShelves.length - 1; k++) {
      const bY = sortedShelves[k].elevationY + (sortedShelves[k].thickness || T);
      const tY = sortedShelves[k + 1].elevationY;
      if (tY - bY >= 60) {
        rawIntervals.push({
          label: `Raf ${k + 1} ↔ Raf ${k + 2}`,
          botY: bY,
          topY: tY,
        });
      }
    }
    const lastIdx = sortedShelves.length - 1;
    const lastBotY = sortedShelves[lastIdx].elevationY + (sortedShelves[lastIdx].thickness || T);
    if (netInnerH - lastBotY >= 60) {
      rawIntervals.push({
        label: `Raf ${sortedShelves.length} ↔ Üst Tavan`,
        botY: lastBotY,
        topY: netInnerH,
      });
    }
  }

  return rawIntervals.map((iv) => {
    const height = Math.max(60, iv.topY - iv.botY);
    const hasRail = (bay.hangingRails || []).some(
      (r) => r.elevationY >= iv.botY - 12 && r.elevationY <= iv.topY + 12
    );
    if (hasRail) {
      return {
        ...iv,
        height,
        hasConflict: true,
        conflictReason: "Askılık (Elbise Borusu) var",
      };
    }
    const hasDrawer = (bay.drawers || []).some(
      (d) => d.elevationY < iv.topY - 8 && d.elevationY + d.height > iv.botY + 8
    );
    if (hasDrawer) {
      return {
        ...iv,
        height,
        hasConflict: true,
        conflictReason: "Çekmece var",
      };
    }
    const hasFitting = (bay.specialFittings || []).some(
      (f) =>
        f.type !== "led_profile" &&
        f.elevationY < iv.topY - 8 &&
        f.elevationY + (f.height || 80) > iv.botY + 8
    );
    if (hasFitting) {
      return {
        ...iv,
        height,
        hasConflict: true,
        conflictReason: "Çekmeli Aksesuar var",
      };
    }
    return {
      ...iv,
      height,
      hasConflict: false,
    };
  });
}

const EMPTY_VALIDATION_ISSUES: ReturnType<typeof useConfiguratorStore.getState>["validationIssues"] = [];
const EMPTY_REVISIONS: ReturnType<typeof useConfiguratorStore.getState>["revisions"] = [];
const EMPTY_FOUR_SPACE = calculateFourSpaceDimensions(
  createDefaultWardrobeModule("empty_scene_placeholder")
);
const LITE_COMPATIBILITY_REPORT = {
  overallStatus: "COMPATIBLE" as const,
  canApproveProduction: false,
  checkedCategoriesCount: 0,
  issues: EMPTY_VALIDATION_ISSUES,
  evidenceMatrix: {
    projectId: "",
    evaluatedAt: "",
    totalCheckedCount: 0,
    verifiedCompatibleCount: 0,
    incompatibleCount: 0,
    unverifiedPartOrOpCount: 0,
    records: [],
  },
};
const CACHED_HANDLE_PROFILES = getAllHandleProfiles();
const CACHED_HARDWARE_CATALOG = getAllHardwareProducts();

export function useV3Adapter(options?: { lightweightViewport?: boolean }) {
  const isLite = Boolean(options?.lightweightViewport);
  const project = useConfiguratorStore((s) => s.project);
  const activeModuleIndex = useConfiguratorStore((s) => s.activeModuleIndex);
  const activeBayIndex = useConfiguratorStore((s) => s.activeBayIndex);
  const viewMode = useConfiguratorStore((s) => s.viewMode);
  const selectedComponentId = useConfiguratorStore((s) => s.selectedComponentId);
  const selectedModuleIds = useConfiguratorStore((s) => s.selectedModuleIds);
  const doorOpenAngleDeg = useConfiguratorStore((s) => s.doorOpenAngleDeg);
  const drawerOpenMm = useConfiguratorStore((s) => s.drawerOpenMm);
  const explodedFactor = useConfiguratorStore((s) => s.explodedFactor);
  const isOrthographic = useConfiguratorStore((s) => s.isOrthographic);
  const cncXrayMode = useConfiguratorStore((s) => s.cncXrayMode);
  const setCncXrayMode = useConfiguratorStore((s) => s.setCncXrayMode);
  const toggleCncXrayMode = useConfiguratorStore((s) => s.toggleCncXrayMode);
  const studioSplitView = useConfiguratorStore((s) => s.studioSplitView);
  const setStudioSplitView = useConfiguratorStore((s) => s.setStudioSplitView);
  const toggleStudioSplitView = useConfiguratorStore((s) => s.toggleStudioSplitView);
  const autoFixProjectIssues = useConfiguratorStore((s) => s.autoFixProjectIssues);
  const cameraPreset = useConfiguratorStore((s) => s.cameraPreset);
  const baseValidationIssues = useConfiguratorStore((s) =>
    isLite ? EMPTY_VALIDATION_ISSUES : s.validationIssues
  );
  const bom = useConfiguratorStore((s) => (isLite ? null : s.bom)) as ReturnType<
    typeof useConfiguratorStore.getState
  >["bom"];
  const pricing = useConfiguratorStore((s) => (isLite ? null : s.pricing)) as ReturnType<
    typeof useConfiguratorStore.getState
  >["pricing"];
  const smartAdvice = useConfiguratorStore((s) => (isLite ? null : s.smartAdvice)) as ReturnType<
    typeof useConfiguratorStore.getState
  >["smartAdvice"];
  const canUndo = useConfiguratorStore((s) => (isLite ? false : s.history.length > 0));
  const canRedo = useConfiguratorStore((s) => (isLite ? false : s.future.length > 0));
  const revisions = useConfiguratorStore((s) => (isLite ? EMPTY_REVISIONS : s.revisions));

  // Store Actions
  const setActiveModuleIndex = useConfiguratorStore((s) => s.setActiveModuleIndex);
  const setActiveBayIndex = useConfiguratorStore((s) => s.setActiveBayIndex);
  const setViewMode = useConfiguratorStore((s) => s.setViewMode);
  const setCameraPreset = useConfiguratorStore((s) => s.setCameraPreset);
  const setSelectedComponentId = useConfiguratorStore((s) => s.setSelectedComponentId);
  const setDoorOpenAngleDeg = useConfiguratorStore((s) => s.setDoorOpenAngleDeg);
  const setDrawerOpenMm = useConfiguratorStore((s) => s.setDrawerOpenMm);
  const setExplodedFactor = useConfiguratorStore((s) => s.setExplodedFactor);
  const toggleDoorOpen = useConfiguratorStore((s) => s.toggleDoorOpen);
  const setOrthographic = useConfiguratorStore((s) => s.setOrthographic);

  const updateProjectTitle = useConfiguratorStore((s) => s.updateProjectTitle);
  const setDimensionsRaw = useConfiguratorStore((s) => s.setDimensions);
  const setPlinthHeight = useConfiguratorStore((s) => s.setPlinthHeight);
  const setMaterials = useConfiguratorStore((s) => s.setMaterials);

  /**
   * Override the material of a single selected component (e.g. 1 door leaf, 1 shelf, 1 side panel, 1 drawer front)
   * without changing the rest of the cabinet! Pass null to reset back to the cabinet default.
   */
  const setSelectedComponentMaterial = useCallback(
    (materialId: string | null, explicitComponentId?: string) => {
      const state = useConfiguratorStore.getState();
      const compId = explicitComponentId || state.selectedComponentId;
      if (!compId) return;
      const curProj = state.project;
      const nextModules = curProj.modules.map((m, idx) => {
        if (idx !== state.activeModuleIndex && !compId.startsWith(m.id)) return m;
        const nextOverrides = { ...(m.componentMaterialOverrides || {}) };
        if (materialId === null) {
          delete nextOverrides[compId];
        } else {
          nextOverrides[compId] = materialId;
        }
        return {
          ...m,
          componentMaterialOverrides: nextOverrides,
        };
      });
      commitAdapterState({
        history: [...state.history.slice(-50), curProj],
        future: [],
        project: {
          ...curProj,
          modules: nextModules,
          updatedAt: new Date().toISOString(),
        },
      });
    },
    []
  );

  /**
   * Change the Countertop / Backsplash / Waterfall material (Neolith, Dekton, Belenco, Çimstone, Natural Marble)
   * across all kitchen base/corner cabinets and attached worktop/backsplash/waterfall modules!
   */
  /**
   * Applies a material either to:
   * - `"single"`: only the targeted component (`componentMaterialOverrides[compId]`),
   * - `"module_similar"`: all components of the same functional family (all doors, all drawer fronts, all shelves, all dividers, all carcass panels, all plinths, or all end panels) in the active module,
   * - `"project_similar"`: all components of that same functional family across EVERY module in the project!
   */
  const applyMaterialToSimilarComponents = useCallback(
    (
      materialId: string | null,
      explicitComponentId?: string | null,
      scope: "single" | "module_similar" | "project_similar" = "single"
    ) => {
      const state = useConfiguratorStore.getState();
      const curProj = state.project;
      const compId = explicitComponentId ?? state.selectedComponentId;
      if (!compId) return;

      if (scope === "single") {
        setSelectedComponentMaterial(materialId, compId);
        return;
      }

      const activeMod = curProj.modules[state.activeModuleIndex] || curProj.modules[0];
      if (!activeMod) return;
      const activeGeo = generateModuleGeometry(activeMod, { doorOpenAngleDeg: 0 });
      const targetComp =
        activeGeo.components.find((c) => c.id === compId) ||
        curProj.modules
          .flatMap((m) => generateModuleGeometry(m, { doorOpenAngleDeg: 0 }).components)
          .find((c) => c.id === compId);

      const inferFamily = (role: string, idStr: string) => {
        if (role.startsWith("door") || idStr.includes("_leaf_") || idStr.includes("_door")) return "doors";
        if (role === "drawer_front" || idStr.endsWith("_front")) return "drawer_fronts";
        if (role === "shelf") return "shelves";
        if (role === "carcass_divider" || role === "carcass_sub_divider" || role === "sub_divider") return "dividers";
        if (role === "plinth") return "plinths";
        if (role === "end_panel") return "end_panels";
        if (role === "countertop") return "countertops";
        return "carcass";
      };

      const family = inferFamily(targetComp?.role || "", compId);
      const nextModules = curProj.modules.map((m, idx) => {
        if (scope === "module_similar" && idx !== state.activeModuleIndex && !compId.startsWith(m.id)) {
          return m;
        }
        const mGeo = generateModuleGeometry(m, { doorOpenAngleDeg: 0 });
        const nextOverrides = { ...(m.componentMaterialOverrides || {}) };
        const matchingCompIds = mGeo.components
          .filter((c) => inferFamily(c.role, c.id) === family)
          .map((c) => c.id);

        if (family === "doors") {
          matchingCompIds.forEach((cid) => {
            delete nextOverrides[cid];
          });
          return {
            ...m,
            carcass: {
              ...m.carcass,
              doorMaterialId: materialId || m.carcass.doorMaterialId,
            },
            bays: m.bays.map((b) => ({
              ...b,
              door: {
                ...b.door,
                doorMaterialId: materialId || undefined,
              },
            })),
            componentMaterialOverrides: nextOverrides,
          };
        }

        if (family === "drawer_fronts") {
          matchingCompIds.forEach((cid) => {
            if (materialId === null) delete nextOverrides[cid];
            else nextOverrides[cid] = materialId;
          });
          return {
            ...m,
            bays: m.bays.map((b) => ({
              ...b,
              drawers: b.drawers.map((d) => ({
                ...d,
                frontMaterialId: materialId || undefined,
              })),
            })),
            componentMaterialOverrides: nextOverrides,
          };
        }

        if (family === "carcass") {
          matchingCompIds.forEach((cid) => {
            delete nextOverrides[cid];
          });
          return {
            ...m,
            carcass: {
              ...m.carcass,
              bodyMaterialId: materialId || m.carcass.bodyMaterialId,
            },
            componentMaterialOverrides: nextOverrides,
          };
        }

        if (family === "plinths") {
          matchingCompIds.forEach((cid) => {
            delete nextOverrides[cid];
          });
          return {
            ...m,
            carcass: {
              ...m.carcass,
              plinthMaterialId: materialId || undefined,
            },
            componentMaterialOverrides: nextOverrides,
          };
        }

        if (family === "countertops" && materialId) {
          return {
            ...m,
            carcass: {
              ...m.carcass,
              countertopMaterialId: materialId,
            },
          };
        }

        // Shelves, dividers, or end_panels: apply override across all matching parts!
        matchingCompIds.forEach((cid) => {
          if (materialId === null) delete nextOverrides[cid];
          else nextOverrides[cid] = materialId;
        });
        return {
          ...m,
          componentMaterialOverrides: nextOverrides,
        };
      });

      commitAdapterState({
        history: [...state.history.slice(-50), curProj],
        future: [],
        project: {
          ...curProj,
          modules: nextModules,
          updatedAt: new Date().toISOString(),
        },
      });
    },
    [setSelectedComponentMaterial]
  );

  const setDoorCrossSectionProfile = useCallback(
    (
      profile: import("@birim/core").DoorCrossSectionProfile,
      customCadProfileName?: string | null,
      customCadPolygon?: { x: number; y: number }[]
    ) => {
      const state = useConfiguratorStore.getState();
      const curProj = state.project;
      const mod = curProj.modules[state.activeModuleIndex];
      if (!mod) return;
      const nextModules = curProj.modules.map((m, idx) => {
        if (idx !== state.activeModuleIndex) return m;
        const isSolidProfile =
          profile === "flat_slab" ||
          profile === "shaker_frame" ||
          profile === "fluted_ribbed" ||
          profile === "bevel_45" ||
          profile === "j_pull_bevel" ||
          profile === "cove_arch" ||
          profile === "custom_cad_profile";
        const curDoorMat = m.carcass.doorMaterialId;
        const nextDoorMat =
          isSolidProfile && (curDoorMat === "mat_smoked_glass" || curDoorMat === "mat_bronze_mirror")
            ? "mat_veneer_oak"
            : curDoorMat;
        const cleanedOverrides = { ...(m.componentMaterialOverrides || {}) };
        if (isSolidProfile) {
          Object.keys(cleanedOverrides).forEach((k) => {
            if (
              cleanedOverrides[k] === "mat_smoked_glass" ||
              cleanedOverrides[k] === "mat_bronze_mirror"
            ) {
              delete cleanedOverrides[k];
            }
          });
        }
        return {
          ...m,
          carcass: {
            ...m.carcass,
            doorMaterialId: nextDoorMat,
            crossSectionProfile: profile,
            customCadProfileName: customCadProfileName ?? m.carcass.customCadProfileName,
            customCadPolygon: customCadPolygon ?? m.carcass.customCadPolygon,
          },
          componentMaterialOverrides: cleanedOverrides,
          bays: m.bays.map((b) => ({
            ...b,
            door: {
              ...b.door,
              isGlassFramed: profile === "glass_frame",
              doorMaterialId:
                isSolidProfile &&
                (b.door.doorMaterialId === "mat_smoked_glass" ||
                  b.door.doorMaterialId === "mat_bronze_mirror")
                  ? undefined
                  : b.door.doorMaterialId,
              crossSectionProfile: profile,
              customCadProfileName: customCadProfileName ?? b.door.customCadProfileName,
              customCadPolygon: customCadPolygon ?? b.door.customCadPolygon,
            },
          })),
        };
      });
      commitAdapterState({
        history: [...state.history.slice(-50), curProj],
        future: [],
        project: {
          ...curProj,
          modules: nextModules,
          updatedAt: new Date().toISOString(),
        },
      });
    },
    []
  );


  /**
   * Updates supported CarcassConfig properties (panelThickness, backPanelThickness, backPanelType,
   * edgeBandThickness, jointType, doorPerimeterGap, plinthHeight, hasAdjustableLegs, etc.)
   * on the active module and triggers full parametric 3D geometry, BOM, pricing, and validation recomputation.
   */
  const updateCarcassConfig = useCallback(
    (patch: Partial<import("@birim/core").CarcassConfig>) => {
      const state = useConfiguratorStore.getState();
      const curProj = state.project;
      const mod = curProj.modules[state.activeModuleIndex];
      if (!mod) return;
      const nextModules = curProj.modules.map((m, idx) => {
        if (idx !== state.activeModuleIndex) return m;
        return {
          ...m,
          carcass: {
            ...m.carcass,
            ...patch,
          },
        };
      });
      commitAdapterState({
        history: [...state.history.slice(-50), curProj],
        future: [],
        project: {
          ...curProj,
          modules: nextModules,
          updatedAt: new Date().toISOString(),
        },
      });
    },
    []
  );

  const setAdjustableLegsEnabled = useCallback((enabled: boolean) => {
    const state = useConfiguratorStore.getState();
    const curProj = state.project;
    const mod = curProj.modules[state.activeModuleIndex];
    if (!mod) return;
    const nextPlinthH = enabled && (mod.carcass.plinthHeight ?? 0) === 0 ? 100 : mod.carcass.plinthHeight;
    const nextModules = curProj.modules.map((m, idx) =>
      idx === state.activeModuleIndex
        ? {
            ...m,
            carcass: {
              ...m.carcass,
              hasAdjustableLegs: enabled,
              plinthHeight: nextPlinthH,
            },
          }
        : m
    );
    commitAdapterState({
      history: [...state.history.slice(-50), curProj],
      future: [],
      project: {
        ...curProj,
        modules: nextModules,
        updatedAt: new Date().toISOString(),
      },
    });
  }, []);

  const setPlinthMaterial = useCallback((materialId: string) => {
    const state = useConfiguratorStore.getState();
    const curProj = state.project;
    const mod = curProj.modules[state.activeModuleIndex];
    if (!mod) return;
    const nextOverrides = { ...(mod.componentMaterialOverrides || {}), __plinth__: materialId };
    const nextModules = curProj.modules.map((m, idx) =>
      idx === state.activeModuleIndex
        ? {
            ...m,
            carcass: { ...m.carcass, plinthMaterialId: materialId },
            componentMaterialOverrides: nextOverrides,
          }
        : m
    );
    commitAdapterState({
      history: [...state.history.slice(-50), curProj],
      future: [],
      project: {
        ...curProj,
        modules: nextModules,
        updatedAt: new Date().toISOString(),
      },
    });
  }, []);

  const setCountertopMaterial = useCallback((materialId: string) => {
    const state = useConfiguratorStore.getState();
    const curProj = state.project;
    const nextModules = curProj.modules.map((m) => {
      const isWorktopComp =
        m.category === "complementary" &&
        (m.complementaryRole === "countertop" ||
          m.complementaryRole === "backsplash" ||
          m.complementaryRole === "waterfall_edge" ||
          m.id.includes("__worktop") ||
          m.id.includes("__backsplash") ||
          m.id.includes("__waterfall"));
      return {
        ...m,
        carcass: {
          ...m.carcass,
          countertopMaterialId: materialId,
          ...(isWorktopComp ? { bodyMaterialId: materialId, doorMaterialId: materialId } : {}),
        },
      };
    });
    commitAdapterState({
      history: [...state.history.slice(-50), curProj],
      future: [],
      project: {
        ...curProj,
        modules: nextModules,
        updatedAt: new Date().toISOString(),
      },
    });
  }, []);
  const setBayCount = useConfiguratorStore((s) => s.setBayCount);
  const setBayDoorType = useConfiguratorStore((s) => s.setBayDoorType);

  const setModuleSlidingMountingType = useCallback(
    (mountingType: SlidingMountingType) => {
      const state = useConfiguratorStore.getState();
      const curProj = state.project;
      const modIdx = state.activeModuleIndex;
      const mod = curProj.modules[modIdx];
      if (!mod) return;
      const nextModules = curProj.modules.map((m, idx) => {
        if (idx !== modIdx) return m;
        return {
          ...m,
          isOpenFront: false,
          bays: m.bays.map((b, bIdx) => ({
            ...b,
            door: {
              ...b.door,
              type: "sliding" as const,
              doorSystemId: (mountingType === "inset_inside"
                ? "sliding_bottom_rolling"
                : mountingType === "coplanar_flush"
                ? "sliding_coplanar"
                : "sliding_top_hung") as DoorSystemId,
              slidingMountingType: mountingType,
              overlayType: (mountingType === "inset_inside" ? "inset" : "full_overlay") as DoorOverlayType,
              handleCategory:
                bIdx % 2 === 0 && m.bays.length > 1
                  ? ("recessed_grip" as HandleCategory)
                  : b.door.handleCategory || ("bar_handle" as HandleCategory),
            },
          })),
        };
      });
      const nextProj = {
        ...curProj,
        version: (curProj.version || 1) + 1,
        modules: nextModules,
        updatedAt: new Date().toISOString(),
      };
      commitAdapterState({
        history: [...state.history.slice(-50), curProj],
        future: [],
        project: nextProj,
      });
    },
    []
  );

  const addShelf = useConfiguratorStore((s) => s.addShelf);
  const removeShelf = useConfiguratorStore((s) => s.removeShelf);
  const addHangingRail = useConfiguratorStore((s) => s.addHangingRail);
  const removeHangingRail = useConfiguratorStore((s) => s.removeHangingRail);
  const addDrawer = useConfiguratorStore((s) => s.addDrawer);
  const removeDrawer = useConfiguratorStore((s) => s.removeDrawer);
  const addSpecialFittingStore = useConfiguratorStore((s) => s.addSpecialFitting);
  const removeSpecialFitting = useConfiguratorStore((s) => s.removeSpecialFitting);

  const addAdjacentModule = useConfiguratorStore((s) => s.addAdjacentModule);
  const addStackedTopModule = useConfiguratorStore((s) => s.addStackedTopModule);
  const duplicateActiveModule = useConfiguratorStore((s) => s.duplicateActiveModule);
  const removeActiveModule = useConfiguratorStore((s) => s.removeActiveModule);
  const moveActiveModule = useConfiguratorStore((s) => s.moveActiveModule);
  const toggleModuleSelection = useConfiguratorStore((s) => s.toggleModuleSelection);
  const selectAllModules = useConfiguratorStore((s) => s.selectAllModules);
  const clearModuleSelection = useConfiguratorStore((s) => s.clearModuleSelection);
  const batchMoveSelectedModules = useConfiguratorStore((s) => s.batchMoveSelectedModules);
  const batchSetSelectedModulesMaterial = useConfiguratorStore((s) => s.batchSetSelectedModulesMaterial);
  const batchRemoveSelectedModules = useConfiguratorStore((s) => s.batchRemoveSelectedModules);

  const setRoomDimensions = useConfiguratorStore((s) => s.setRoomDimensions);
  const updateCeilingConfig = useConfiguratorStore((s) => s.updateCeilingConfig);
  const setFacadeGrainContinuity = useConfiguratorStore((s) => s.setFacadeGrainContinuity);
  const addWallSegment = useConfiguratorStore((s) => s.addWallSegment);
  const updateWallSegment = useConfiguratorStore((s) => s.updateWallSegment);
  const removeWallSegment = useConfiguratorStore((s) => s.removeWallSegment);
  const addSpaceObstacleRaw = useConfiguratorStore((s) => s.addSpaceObstacle);
  const updateSpaceObstacleRaw = useConfiguratorStore((s) => s.updateSpaceObstacle);
  const removeSpaceObstacleRaw = useConfiguratorStore((s) => s.removeSpaceObstacle);

  const ensureObstaclesSeeded = useCallback(() => {
    const curProj = useConfiguratorStore.getState().project;
    if (!curProj.space.elements || curProj.space.elements.length === 0) {
      const seeded = getEffectiveSpaceObstacles(curProj);
      useConfiguratorStore.setState({
        project: {
          ...curProj,
          space: { ...curProj.space, elements: seeded },
        },
      });
    }
  }, []);

  const addSpaceObstacle = useCallback(
    (obsInput: Parameters<typeof addSpaceObstacleRaw>[0]) => {
      ensureObstaclesSeeded();
      return addSpaceObstacleRaw(obsInput);
    },
    [ensureObstaclesSeeded, addSpaceObstacleRaw]
  );

  const updateSpaceObstacle = useCallback(
    (obsId: string, patch: Partial<ArchitecturalElement>) => {
      ensureObstaclesSeeded();
      updateSpaceObstacleRaw(obsId, patch);
    },
    [ensureObstaclesSeeded, updateSpaceObstacleRaw]
  );

  const removeSpaceObstacle = useCallback(
    (obsId: string) => {
      const state = useConfiguratorStore.getState();
      const curProj = state.project;
      const baseList =
        curProj.space.elements && curProj.space.elements.length > 0
          ? curProj.space.elements
          : getEffectiveSpaceObstacles(curProj);
      const remaining = baseList.filter((el) => el.id !== obsId);
      commitAdapterState({
        project: {
          ...curProj,
          space: {
            ...curProj.space,
            elements: remaining,
            wizardCleanRoom: true,
          } as typeof curProj.space,
        },
      });
    },
    []
  );
  const setFloorPlanUnderlay = useConfiguratorStore((s) => s.setFloorPlanUnderlay);
  const importWallsFromUnderlay = useConfiguratorStore((s) => s.importWallsFromUnderlay);

  const saveToStorage = useConfiguratorStore((s) => s.saveToStorage);
  const loadFromStorage = useConfiguratorStore((s) => s.loadFromStorage);
  const getSavedProjects = useConfiguratorStore((s) => s.getSavedProjects);
  const exportProjectJSON = useConfiguratorStore((s) => s.exportProjectJSON);
  const importProjectJSON = useConfiguratorStore((s) => s.importProjectJSON);
  const beginHistoryTransaction = useConfiguratorStore((s) => s.beginHistoryTransaction);
  const commitHistoryTransaction = useConfiguratorStore((s) => s.commitHistoryTransaction);
  const createRevisionSnapshot = useConfiguratorStore((s) => s.createRevisionSnapshot);
  const restoreRevisionSnapshot = useConfiguratorStore((s) => s.restoreRevisionSnapshot);
  const diffRevisions = useConfiguratorStore((s) => s.diffRevisions);
  const approveProduction = useConfiguratorStore((s) => s.approveProduction);
  const applySmartSpan = useConfiguratorStore((s) => s.applySmartSpan);

  const selectedSceneObjectId = useConfiguratorStore((s) => s.selectedSceneObjectId);
  const setSelectedSceneObjectId = useConfiguratorStore((s) => s.setSelectedSceneObjectId);
  const appendModuleWithMultiWallSnap = useConfiguratorStore((s) => s.appendModuleWithMultiWallSnap);
  const fillWallGapWithParametricModule = useConfiguratorStore((s) => s.fillWallGapWithParametricModule);
  const addCompositeAssemblyPreset = useConfiguratorStore((s) => s.addCompositeAssemblyPreset);
  const saveActiveModuleAsCustomTemplate = useConfiguratorStore((s) => s.saveActiveModuleAsCustomTemplate);
  const deleteCustomModuleTemplate = useConfiguratorStore((s) => s.deleteCustomModuleTemplate);
  const addSceneObjectFromCatalog = useConfiguratorStore((s) => s.addSceneObjectFromCatalog);
  const addCustomSceneObject = useConfiguratorStore((s) => s.addCustomSceneObject);
  const updateSceneObject = useConfiguratorStore((s) => s.updateSceneObject);
  const duplicateSceneObject = useConfiguratorStore((s) => s.duplicateSceneObject);
  const removeSceneObject = useConfiguratorStore((s) => s.removeSceneObject);
  const runAutoFillersAndCrown = useConfiguratorStore((s) => s.runAutoFillersAndCrown);
  const runAutoNotchObstacles = useConfiguratorStore((s) => s.runAutoNotchObstacles);
  const importRoomPlanLiDARJson = useConfiguratorStore((s) => s.importRoomPlanLiDARJson);
  const setModuleOffsetFromLeftWall = useConfiguratorStore((s) => s.setModuleOffsetFromLeftWall);

  const undo = useConfiguratorStore((s) => s.undo);
  const redo = useConfiguratorStore((s) => s.redo);
  const applyTemplate = useConfiguratorStore((s) => s.applyTemplate);
  const loadLinearKitchenBase = useConfiguratorStore((s) => s.loadLinearKitchen);
  const loadLKitchenBase = useConfiguratorStore((s) => s.loadLKitchen);
  const loadUKitchenBase = useConfiguratorStore((s) => s.loadUKitchen);
  const resetToDefault = useConfiguratorStore((s) => s.resetToDefault);

  const emptyFallbackModule = useMemo(
    () => createDefaultWardrobeModule("empty_scene_placeholder"),
    []
  );
  const activeModule: ModuleInstance =
    project.modules[activeModuleIndex] || project.modules[0] || emptyFallbackModule;
  const safeBayIndex = Math.min(
    activeBayIndex,
    Math.max(0, (activeModule?.bays.length || 1) - 1)
  );
  const activeBay = activeModule?.bays[safeBayIndex] || activeModule?.bays[0];

  const bodyMaterial: MaterialDefinition =
    DEFAULT_MATERIALS.find((m) => m.id === activeModule?.carcass.bodyMaterialId) ||
    DEFAULT_MATERIALS[0];
  const doorMaterial: MaterialDefinition =
    DEFAULT_MATERIALS.find((m) => m.id === activeModule?.carcass.doorMaterialId) ||
    DEFAULT_MATERIALS[2];

  // V4 4-space dimensions & universal compatibility evaluation
  const fourSpaceDimensions = useMemo(
    () => (isLite ? EMPTY_FOUR_SPACE : calculateFourSpaceDimensions(activeModule)),
    [isLite, activeModule]
  );
  const batchStartProject = useConfiguratorStore((s) => s.batchStartProject);
  const isDraggingActive = batchStartProject !== null;

  // Structural signature for space so module drags never invalidate spaceWalls / spaceObstacles references
  const spaceSignature = useMemo(() => {
    const wKey = (project.space?.walls || [])
      .map((w) => `${w.id}:${w.length}:${w.height}:${w.thickness}:${w.position.x}:${w.position.y}:${w.position.z}:${w.rotationY}:${w.wallType || ""}`)
      .join("|");
    const eKey = (project.space?.elements || [])
      .map((e) => `${e.id}:${e.type}:${e.position.x}:${e.position.y}:${e.position.z}:${e.dimensions.width}:${e.dimensions.height}:${e.dimensions.depth}:${e.rotationY || 0}:${e.doorSwing || ""}`)
      .join("|");
    return `${project.space?.ceilingHeight || 2600}__${wKey}__${eKey}`;
  }, [project.space]);

  const v4CompatibilityReport = useMemo(
    () =>
      isLite || isDraggingActive
        ? LITE_COMPATIBILITY_REPORT
        : getMemoizedProjectCompatibility(project),
    [isLite, isDraggingActive, project]
  );

  const lastSettledEngineeringRef = useRef<ReturnType<typeof evaluateUnifiedEngineeringModel> | null>(
    null
  );
  const unifiedEngineeringReport = useMemo(() => {
    if (isDraggingActive && lastSettledEngineeringRef.current) {
      return lastSettledEngineeringRef.current;
    }
    const fresh = getMemoizedUnifiedEngineering(project);
    lastSettledEngineeringRef.current = fresh;
    return fresh;
  }, [isDraggingActive, project]);

  const ergonomicProfileId: RegionErgonomicProfileId =
    project.ergonomicProfileId || "TR_RESIDENTIAL";

  const setErgonomicProfileId = useCallback(
    (profileId: RegionErgonomicProfileId) => {
      commitAdapterState({
        project: {
          ...project,
          ergonomicProfileId: profileId,
        },
      });
    },
    [project]
  );

  const applyApprovedEngineeringFix = useCallback(
    (proposal: RemediationProposal) => {
      const nextProj = applyApprovedRemediationProposal(project, proposal);
      commitAdapterState({ project: nextProj });
    },
    [project]
  );

  // Spatial obstacles & walls memoized by spaceSignature so cabinet drags never rebuild 3D room architecture
  const spaceObstacles = useMemo(
    () => getEffectiveSpaceObstacles(project),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [spaceSignature]
  );
  const spaceWalls = useMemo(
    () => getEffectiveSpaceWalls(project),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [spaceSignature]
  );
  const spatialIssues = useMemo(
    () => (isLite || isDraggingActive ? EMPTY_VALIDATION_ISSUES : getMemoizedSpatialValidation(project)),
    [isLite, isDraggingActive, project]
  );

  const validationIssues = useMemo(() => {
    if (isLite) return EMPTY_VALIDATION_ISSUES;
    const seen = new Set<string>();
    const combined = [
      ...baseValidationIssues,
      ...spatialIssues,
      ...v4CompatibilityReport.issues,
      ...unifiedEngineeringReport.findings,
    ];
    return combined.filter((item) => {
      const k = `${item.code}_${item.targetId || ""}`;
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    });
  }, [
    isLite,
    baseValidationIssues,
    spatialIssues,
    v4CompatibilityReport.issues,
    unifiedEngineeringReport.findings,
  ]);

  /**
   * Fast component selection handler
   */
  const handleComponentSelect = useCallback(
    (compId: string | null, explicitModuleIndex?: number) => {
      setSelectedComponentId(compId);
      if (!compId) return;

      const curProj = useConfiguratorStore.getState().project;
      const curModIdx = useConfiguratorStore.getState().activeModuleIndex;

      if (
        typeof explicitModuleIndex === "number" &&
        explicitModuleIndex >= 0 &&
        explicitModuleIndex < curProj.modules.length
      ) {
        if (explicitModuleIndex !== curModIdx) {
          setActiveModuleIndex(explicitModuleIndex);
        }
        const targetMod = curProj.modules[explicitModuleIndex];
        if (targetMod) {
          const breakdown = generateModuleGeometry(targetMod);
          const foundComp = breakdown.components.find((c) => c.id === compId);
          if (foundComp && typeof foundComp.bayIndex === "number") {
            setActiveBayIndex(foundComp.bayIndex);
          }
        }
        return;
      }

      // Match by longest module.id prefix first so "mod_10" never falsely matches "mod_1"
      const indexedMods = curProj.modules
        .map((mod, mIdx) => ({ mod, mIdx }))
        .sort((a, b) => b.mod.id.length - a.mod.id.length);

      for (const { mod, mIdx } of indexedMods) {
        if (compId === mod.id || compId.startsWith(`${mod.id}_`)) {
          if (mIdx !== curModIdx) {
            setActiveModuleIndex(mIdx);
          }
          const breakdown = generateModuleGeometry(mod);
          const foundComp = breakdown.components.find((c) => c.id === compId);
          if (foundComp && typeof foundComp.bayIndex === "number") {
            setActiveBayIndex(foundComp.bayIndex);
          }
          return;
        }
      }

      for (let mIdx = 0; mIdx < curProj.modules.length; mIdx++) {
        const mod = curProj.modules[mIdx];
        const breakdown = generateModuleGeometry(mod);
        const foundComp = breakdown.components.find((c) => c.id === compId);
        if (foundComp) {
          if (mIdx !== curModIdx) {
            setActiveModuleIndex(mIdx);
          }
          if (typeof foundComp.bayIndex === "number") {
            setActiveBayIndex(foundComp.bayIndex);
          }
          break;
        }
      }
    },
    [setSelectedComponentId, setActiveModuleIndex, setActiveBayIndex]
  );

  /**
   * Rotate active module by 90 degrees (for L / U corner return cabinets)
   */
  const snapModuleToAngledWall = useCallback((targetModIdx?: number, forceWallId?: string) => {
    const state = useConfiguratorStore.getState();
    const curProj = state.project;
    const idx = typeof targetModIdx === "number" ? targetModIdx : state.activeModuleIndex;
    const mod = curProj.modules[idx];
    if (!mod) return null;
    const walls = getEffectiveSpaceWalls(curProj);
    const angledWalls = walls.filter((w) => ((w.rotationY || 0) % 90 + 90) % 90 !== 0);
    const candidateWalls = !forceWallId && angledWalls.length > 0 ? angledWalls : walls;
    const sol = solveAngledWallSnapForModule({
      mod,
      modIdx: idx,
      candidatePosX: mod.position.x,
      candidatePosZ: mod.position.z,
      walls: candidateWalls,
      allModules: curProj.modules,
      maxPerpSnapDistMm: 99999,
      forceWallId,
    });
    if (!sol) return null;
    const nextMods = curProj.modules.map((m, i) =>
      i === idx
        ? {
            ...m,
            position: { ...m.position, x: sol.snappedPositionX, z: sol.snappedPositionZ },
            rotation: { x: 0, y: sol.moduleRotationYDeg, z: 0 },
          }
        : m
    );
    commitAdapterState({
      history: [...state.history.slice(-50), curProj],
      future: [],
      activeModuleIndex: idx,
      project: { ...curProj, modules: nextMods, updatedAt: new Date().toISOString() },
    });
    return sol;
  }, []);

  const addKitchenIslandUnit = useCallback(
    (spec: {
      widthMm: number;
      depthMm: number;
      heightMm: number;
      aisleClearanceMm: number;
      barOverhangMm: number;
      waterfallLeft: boolean;
      waterfallRight: boolean;
      countertopMaterialId: string;
    }) => {
      const state = useConfiguratorStore.getState();
      const curProj = state.project;
      const baseMods = curProj.modules.filter((m) => m.category !== "complementary" && m.category !== "kitchen_island");
      const frontRowDepth = baseMods.length > 0 ? Math.max(...baseMods.map((m) => m.position.z + m.dimensions.depth)) : 600;
      const centerRowX =
        baseMods.length > 0
          ? Math.round(
              (Math.min(...baseMods.map((m) => m.position.x)) +
                Math.max(...baseMods.map((m) => m.position.x + m.dimensions.width)) -
                spec.widthMm) *
                0.5
            )
          : 600;
      const bayCnt = Math.max(2, Math.min(4, Math.round(spec.widthMm / 600)));
      const refMod = baseMods[0] || createDefaultWardrobeModule("isl_seed");
      const islId = `mod_island_${Date.now().toString().slice(-5)}`;
      const islandMod: ModuleInstance = {
        ...structuredClone(refMod),
        id: islId,
        name: `Şelale Tezgâhlı Ada Mutfak (${Math.round(spec.widthMm / 10)}×${Math.round(spec.depthMm / 10)} cm)`,
        category: "kitchen_island",
        moduleFamilyId: "fam_kitchen_base",
        position: {
          x: Math.max(100, centerRowX),
          y: 0,
          z: frontRowDepth + Math.max(850, spec.aisleClearanceMm),
        },
        rotation: { x: 0, y: 0, z: 0 },
        dimensions: {
          width: spec.widthMm,
          height: spec.heightMm,
          depth: spec.depthMm,
        },
        carcass: {
          ...structuredClone(refMod.carcass),
          plinthHeight: 100,
          topConstruction: "stretcher_90mm",
          countertopMaterialId: spec.countertopMaterialId,
        },
        islandCountertopConfig: {
          barOverhangMm: spec.barOverhangMm,
          waterfallLeft: spec.waterfallLeft,
          waterfallRight: spec.waterfallRight,
          countertopMaterialId: spec.countertopMaterialId,
        },
        bays: Array.from({ length: bayCnt }, (_, bIdx) => ({
          index: bIdx,
          shelves: [{ id: `${islId}_sh_${bIdx}`, bayIndex: bIdx, elevationY: 340, isFixed: false }],
          drawers:
            bIdx === 0
              ? [
                  { id: `${islId}_drw_${bIdx}_0`, bayIndex: bIdx, elevationY: 0, height: 280 },
                  { id: `${islId}_drw_${bIdx}_1`, bayIndex: bIdx, elevationY: 284, height: 280 },
                ]
              : [],
          hangingRails: [],
          specialFittings: [],
          door: {
            id: `${islId}_door_${bIdx}`,
            type: bIdx === 0 ? "open" : "single_left",
            doorSystemId: bIdx === 0 ? "open" : "hinged_single",
            softClose: true,
            handleCategory: "gola_profile",
          },
        })),
      };
      const nextMods = [...curProj.modules, islandMod];
      commitAdapterState({
        history: [...state.history.slice(-50), curProj],
        future: [],
        activeModuleIndex: nextMods.length - 1,
        project: { ...curProj, modules: nextMods, updatedAt: new Date().toISOString() },
      });
    },
    []
  );

  const addOrUpdateAttachedTable = useCallback(
    (spec: {
      anchorModuleIndex: number;
      attachSide: "right_end" | "left_end" | "front_center_t" | "front_right_corner";
      angleDeg: number;
      lengthMm: number;
      widthMm: number;
      tableHeightMm: number;
      legStyle: "waterfall_slab" | "metal_u_frame" | "pedestal_column";
      topMaterialId: string;
    }) => {
      const state = useConfiguratorStore.getState();
      const curProj = state.project;
      const anchor = curProj.modules[spec.anchorModuleIndex] || curProj.modules[state.activeModuleIndex] || curProj.modules[0];
      if (!anchor) return;

      const anchorPlace = calculateModulePlacement(anchor);
      const aRotRad = anchorPlace.rotationYRad;
      const cosA = Math.cos(aRotRad);
      const sinA = Math.sin(aRotRad);
      const toWorld = (lx: number, lz: number) => ({
        x: anchorPlace.origin.x + lx * cosA + lz * sinA,
        z: anchorPlace.origin.z - lx * sinA + lz * cosA,
      });

      let pivotLocal = { x: anchor.dimensions.width - 40, z: anchor.dimensions.depth * 0.5 };
      // Compute outward plan heading (0° = +X right, +90° = +Z forward into room, 180° = -X left)
      let localPlanHeadingDeg = spec.angleDeg;
      if (spec.attachSide === "left_end") {
        pivotLocal = { x: 40, z: anchor.dimensions.depth * 0.5 };
        localPlanHeadingDeg = 180 - spec.angleDeg;
      } else if (spec.attachSide === "front_center_t") {
        pivotLocal = { x: anchor.dimensions.width * 0.5, z: anchor.dimensions.depth - 40 };
        localPlanHeadingDeg =
          spec.angleDeg === 90 || spec.angleDeg === 0 ? 90 : 90 - spec.angleDeg;
      } else if (spec.attachSide === "front_right_corner") {
        pivotLocal = { x: anchor.dimensions.width - 60, z: anchor.dimensions.depth - 60 };
        localPlanHeadingDeg = spec.angleDeg;
      }

      const pivotWorld = toWorld(pivotLocal.x, pivotLocal.z);
      // In Three.js Y-up (`x_w = cos(rotY), z_w = -sin(rotY)`), `rotY = -planHeadingDeg`
      const totalModRotDeg = ((((anchor.rotation?.y || 0) - localPlanHeadingDeg) % 360) + 360) % 360;
      const betaRad = (totalModRotDeg * Math.PI) / 180;
      const originX = pivotWorld.x - (spec.widthMm * 0.5) * Math.sin(betaRad);
      const originZ = pivotWorld.z - (spec.widthMm * 0.5) * Math.cos(betaRad);
      const tblPos = originToModulePosition(
        spec.lengthMm,
        spec.widthMm,
        totalModRotDeg,
        originX,
        originZ
      );

      const existingTableId = `comp_table_${anchor.id}`;
      const refCarcass = structuredClone(anchor.carcass);
      const tableMod: ModuleInstance = {
        id: existingTableId,
        name: `Açılı Masa (${spec.angleDeg}° • ${Math.round(spec.lengthMm / 10)}×${Math.round(spec.widthMm / 10)} cm)`,
        category: "complementary",
        complementaryRole: "attached_table",
        position: { x: tblPos.x, y: 0, z: tblPos.z },
        rotation: { x: 0, y: totalModRotDeg, z: 0 },
        dimensions: {
          width: spec.lengthMm,
          height: spec.tableHeightMm,
          depth: spec.widthMm,
        },
        bays: [],
        carcass: {
          ...refCarcass,
          countertopMaterialId: spec.topMaterialId,
          doorMaterialId: spec.topMaterialId,
          bodyMaterialId: spec.topMaterialId,
        },
        attachedTableConfig: {
          anchorModuleId: anchor.id,
          angleDeg: spec.angleDeg,
          legStyle: spec.legStyle,
          topThicknessMm: 40,
        },
      };

      const filtered = curProj.modules.filter((m) => m.id !== existingTableId);
      const nextMods = [...filtered, tableMod];
      commitAdapterState({
        history: [...state.history.slice(-50), curProj],
        future: [],
        activeModuleIndex: nextMods.length - 1,
        project: { ...curProj, modules: nextMods, updatedAt: new Date().toISOString() },
      });
    },
    []
  );

  const rotateActiveModule90 = useCallback((deltaDeg = 90) => {
    const state = useConfiguratorStore.getState();
    const curProj = state.project;
    const idx = state.activeModuleIndex;
    const mod = curProj.modules[idx];
    if (!mod) return;

    const delta = typeof deltaDeg === "number" ? deltaDeg : 90;
    const curRotY = mod.rotation?.y || 0;
    const nextRotY = (((curRotY + delta) % 360) + 360) % 360;
    // Preserve world center when rotating freestanding / table / island modules so they rotate in place cleanly!
    const curPlace = calculateModulePlacement(mod);
    const curRad = curPlace.rotationYRad;
    const worldCenterX =
      curPlace.origin.x +
      (mod.dimensions.width * 0.5) * Math.cos(curRad) +
      (mod.dimensions.depth * 0.5) * Math.sin(curRad);
    const worldCenterZ =
      curPlace.origin.z -
      (mod.dimensions.width * 0.5) * Math.sin(curRad) +
      (mod.dimensions.depth * 0.5) * Math.cos(curRad);
    const nextRad = (nextRotY * Math.PI) / 180;
    const nextOriginX =
      worldCenterX -
      (mod.dimensions.width * 0.5) * Math.cos(nextRad) -
      (mod.dimensions.depth * 0.5) * Math.sin(nextRad);
    const nextOriginZ =
      worldCenterZ +
      (mod.dimensions.width * 0.5) * Math.sin(nextRad) -
      (mod.dimensions.depth * 0.5) * Math.cos(nextRad);
    const centeredPos = originToModulePosition(
      mod.dimensions.width,
      mod.dimensions.depth,
      nextRotY,
      nextOriginX,
      nextOriginZ
    );
    const isFreeOrTable =
      mod.complementaryRole === "attached_table" ||
      mod.category === "kitchen_island" ||
      Boolean(mod.carcass.hullShape && mod.carcass.hullShape !== "rectangular");

    const nextMods = curProj.modules.map((m, i) =>
      i === idx
        ? {
            ...m,
            position: isFreeOrTable
              ? { ...m.position, x: centeredPos.x, z: centeredPos.z }
              : m.position,
            rotation: { x: 0, y: nextRotY, z: 0 },
            attachedTableConfig: m.attachedTableConfig
              ? {
                  ...m.attachedTableConfig,
                  angleDeg: ((((360 - nextRotY) % 360) + 360) % 360),
                }
              : m.attachedTableConfig,
          }
        : m
    );
    commitAdapterState({
      history: [...state.history.slice(-50), curProj],
      future: [],
      project: { ...curProj, modules: nextMods, updatedAt: new Date().toISOString() },
    });
  }, []);

  /**
   * Move a specific module to an exact X, Z position in the room (with optional snap)
   */
  const setModulePosition = useCallback(
    (modIdx: number, x: number, z: number, snapMm = 50, y?: number) => {
      const snappedX = snapMm > 0 ? Math.round(x / snapMm) * snapMm : Math.round(x);
      const snappedZ = snapMm > 0 ? Math.round(z / snapMm) * snapMm : Math.round(z);
      const curState = useConfiguratorStore.getState();
      const curProj = curState.project;
      const target = curProj.modules[modIdx];
      if (!target) return;

      const attachedPrefix = `comp_att_${target.id}__`;
      const leftAttWidth = curProj.modules
        .filter(
          (m) =>
            m.id === `${attachedPrefix}panel_left` || m.id === `${attachedPrefix}filler_left`
        )
        .reduce((maxW, m) => Math.max(maxW, m.dimensions.width), 0);
      const clampedX = Math.max(leftAttWidth, snappedX);
      const clampedZ = Math.max(0, snappedZ);
      const clampedY =
        typeof y === "number"
          ? Math.max(0, snapMm > 0 ? Math.round(y / snapMm) * snapMm : Math.round(y))
          : target.position.y;
      const dx = clampedX - target.position.x;
      const dz = clampedZ - target.position.z;
      const dy = clampedY - target.position.y;
      if (dx === 0 && dz === 0 && dy === 0) return;
      const nextMods = curProj.modules.map((m, idx) => {
        if (idx === modIdx) {
          return { ...m, position: { ...m.position, x: clampedX, y: clampedY, z: clampedZ } };
        }
        if (m.category === "complementary" && m.id.startsWith(attachedPrefix)) {
          return {
            ...m,
            position: {
              ...m.position,
              x: Math.max(0, m.position.x + dx),
              y: Math.max(0, m.position.y + dy),
              z: Math.max(0, m.position.z + dz),
            },
          };
        }
        return m;
      });
      commitAdapterState({
        activeModuleIndex: modIdx,
        selectedModuleIds: nextMods[modIdx] ? [nextMods[modIdx].id] : [],
        project: { ...curProj, modules: nextMods, updatedAt: new Date().toISOString() },
      });
    },
    []
  );

  /**
   * Swaps a module with its immediate left or right neighbor in the same row,
   * recalculating their X coordinates so they exchange places cleanly with zero overlap.
   */
  
  /**
   * Parametrically resizes a module from its edge handles in 2D Plan or 2D Elevation,
   * stretching internal shelves/rails/drawers AND automatically adapting bay count (Ara Dikme)
   * and door count (1 -> 2 -> 3 -> 4 -> 5 -> 6 Kapak) according to EN 1116 / Blum structural limits!
   */
  const resizeModuleParametric = useCallback(
    (
      modIdx: number,
      newWidthMm: number,
      newPositionX?: number,
      newDepthMm?: number,
      newHeightMm?: number,
      newPositionZ?: number,
      newPositionY?: number
    ): { bayCount: number; totalLeafCount: number; shelfCount: number } | null => {
      const curState = useConfiguratorStore.getState();
      const curProj = curState.project;
      const target = curProj.modules[modIdx];
      if (!target) return null;

      const oldH = target.dimensions.height;
      const clampedW = Math.max(300, Math.min(3600, Math.round(newWidthMm / 10) * 10));
      const clampedD =
        typeof newDepthMm === "number"
          ? Math.max(250, Math.min(900, Math.round(newDepthMm / 10) * 10))
          : target.dimensions.depth;
      const clampedH =
        typeof newHeightMm === "number"
          ? Math.max(350, Math.min(2800, Math.round(newHeightMm / 10) * 10))
          : target.dimensions.height;
      const leftAttW = curProj.modules
        .filter(
          (m) =>
            m.id === `comp_att_${target.id}__panel_left` ||
            m.id === `comp_att_${target.id}__filler_left`
        )
        .reduce((maxW, m) => Math.max(maxW, m.dimensions.width), 0);
      const clampedX =
        typeof newPositionX === "number"
          ? Math.max(leftAttW, Math.round(newPositionX / 10) * 10)
          : Math.max(leftAttW, target.position.x);
      const clampedZ =
        typeof newPositionZ === "number"
          ? Math.max(0, Math.round(newPositionZ / 10) * 10)
          : target.position.z;
      const clampedY =
        typeof newPositionY === "number"
          ? Math.max(0, Math.round(newPositionY / 10) * 10)
          : target.position.y;

      if (
        target.dimensions.width === clampedW &&
        target.dimensions.depth === clampedD &&
        target.dimensions.height === clampedH &&
        target.position.x === clampedX &&
        target.position.z === clampedZ &&
        target.position.y === clampedY
      ) {
        return null;
      }

      const nextMod: ModuleInstance = JSON.parse(JSON.stringify(target));
      nextMod.dimensions.width = clampedW;
      nextMod.dimensions.depth = clampedD;
      nextMod.dimensions.height = clampedH;
      nextMod.position.x = clampedX;
      nextMod.position.z = clampedZ;
      nextMod.position.y = clampedY;

      // Parametric Height Adaptation: scale/redistribute shelves, rails, and sub-dividers when height (H) changes
      if (clampedH !== oldH && nextMod.category !== "complementary") {
        const T_p = nextMod.carcass.panelThickness || 18;
        const plinth = nextMod.carcass.plinthHeight || 0;
        const oldNetH = Math.max(160, oldH - plinth - 2 * T_p);
        const newNetH = Math.max(160, clampedH - plinth - 2 * T_p);
        const hRatio = newNetH / oldNetH;

        nextMod.bays.forEach((b, bIdx) => {
          const maxDrawerTop =
            b.drawers.length > 0
              ? Math.max(...b.drawers.map((d) => d.elevationY + d.height)) + T_p
              : 0;
          const usableShelfZoneH = Math.max(120, newNetH - maxDrawerTop);

          // If bay has hanging rails, keep top rail near top of cabinet and scale lower rails
          if (b.hangingRails && b.hangingRails.length > 0) {
            b.hangingRails.forEach((r, rIdx) => {
              if (rIdx === b.hangingRails.length - 1) {
                r.elevationY = Math.max(300, Math.min(newNetH - 60, newNetH - 90));
              } else {
                r.elevationY = Math.max(
                  250,
                  Math.min(newNetH - 120, Math.round((r.elevationY * hRatio) / 10) * 10)
                );
              }
            });
          }

          // Parametric Shelf Count & Equal Distribution when no hanging rail occupies the bay
          if ((!b.hangingRails || b.hangingRails.length === 0) && b.shelves.length > 0) {
            const targetShelfCount = Math.max(
              1,
              Math.min(7, Math.floor(usableShelfZoneH / 360))
            );
            while (b.shelves.length < targetShelfCount) {
              const sIdx = b.shelves.length;
              b.shelves.push({
                id: `${nextMod.id}_shelf_${bIdx}_${sIdx}_${Date.now()}`,
                bayIndex: bIdx,
                elevationY: Math.round(maxDrawerTop + usableShelfZoneH * 0.5),
                thickness: T_p,
                isAdjustable: true,
              });
            }
            if (b.shelves.length > targetShelfCount && targetShelfCount >= 1) {
              b.shelves = b.shelves.slice(0, targetShelfCount);
            }
            const cnt = b.shelves.length;
            const stepY = usableShelfZoneH / (cnt + 1);
            b.shelves.forEach((s, sIdx) => {
              s.elevationY = Math.max(
                60,
                Math.min(
                  newNetH - 60,
                  Math.round((maxDrawerTop + stepY * (sIdx + 1)) / 10) * 10
                )
              );
            });
          } else if (b.shelves.length > 0) {
            b.shelves.forEach((s) => {
              s.elevationY = Math.max(
                60,
                Math.min(newNetH - 60, Math.round((s.elevationY * hRatio) / 10) * 10)
              );
            });
          }

          // Scale subDividers proportionally to newNetH
          if (b.subDividers && b.subDividers.length > 0) {
            b.subDividers.forEach((sd) => {
              sd.elevationY = Math.max(
                0,
                Math.min(newNetH - 80, Math.round((sd.elevationY * hRatio) / 10) * 10)
              );
              sd.height = Math.max(
                80,
                Math.min(newNetH - sd.elevationY, Math.round((sd.height * hRatio) / 10) * 10)
              );
            });
          }
        });
      }

      if (nextMod.category !== "complementary") {
        const T = nextMod.carcass.panelThickness || 18;
        const firstBay = nextMod.bays[0];
        const isPureDrawerStack =
          nextMod.bays.every((b) => (b.door.type === "open" || b.door.doorSystemId === "open") && b.drawers.length > 0);
        const isOpenWalkIn =
          Boolean(nextMod.isOpenFront) ||
          nextMod.bays.every((b) => b.door.type === "open" && b.drawers.length === 0);
        const isSliding = nextMod.bays.some(
          (b) =>
            b.door.type === "sliding" ||
            b.door.doorSystemId === "sliding_top_hung" ||
            b.door.doorSystemId === "sliding_bottom_rolling"
        );
        const isLift = nextMod.bays.some((b) => b.door.doorSystemId?.startsWith("lift_"));

        let targetBayCount = nextMod.bays.length;
        let bayDoorPlan: ("single_left" | "single_right" | "double" | "sliding" | "open")[] = [];

        if (isSliding) {
          targetBayCount = clampedW > 2000 ? 3 : 2;
          bayDoorPlan = Array.from({ length: targetBayCount }, () => "sliding");
        } else if (isPureDrawerStack || isOpenWalkIn || isLift) {
          targetBayCount = clampedW > 2700 ? 4 : clampedW > 1800 ? 3 : clampedW > 1000 ? 2 : 1;
          bayDoorPlan = Array.from({ length: targetBayCount }, () =>
            isPureDrawerStack || isOpenWalkIn ? "open" : (firstBay?.door.type as any) || "single_left"
          );
        } else {
          // Hinged Wardrobe / Kitchen Cabinet Structural Door & Divider Progression:
          // <= 600mm: 1 Bay, 1 Single Door
          // 610..1150mm: 1 Bay, 1 Double Door (2 leaves)
          // 1160..1650mm: 2 Bays (1 Ara Dikme), 3 Doors (Left: Single 1/3, Right: Double 2/3)
          // 1660..2250mm: 2 Bays (1 Ara Dikme), 4 Doors (Left: Double, Right: Double)
          // 2260..2750mm: 3 Bays (2 Ara Dikme), 5 Doors (Double + Single + Double)
          // > 2750mm: 3 Bays (2 Ara Dikme), 6 Doors (Double + Double + Double)
          if (clampedW <= 600) {
            targetBayCount = 1;
            const curDType = firstBay?.door?.type;
            bayDoorPlan = [
              curDType === "double" && clampedW >= 500
                ? "double"
                : curDType === "single_right"
                ? "single_right"
                : "single_left",
            ];
          } else if (clampedW <= 1150) {
            targetBayCount = 1;
            bayDoorPlan = ["double"];
          } else if (clampedW <= 1650) {
            targetBayCount = 2;
            bayDoorPlan = ["single_left", "double"];
          } else if (clampedW <= 2250) {
            targetBayCount = 2;
            bayDoorPlan = ["double", "double"];
          } else if (clampedW <= 2750) {
            targetBayCount = 3;
            bayDoorPlan = ["double", "single_left", "double"];
          } else {
            targetBayCount = 3;
            bayDoorPlan = ["double", "double", "double"];
          }
        }

        // Add or remove bays to match targetBayCount while preserving/cloning shelves & rails
        while (nextMod.bays.length < targetBayCount) {
          const newIdx = nextMod.bays.length;
          const srcBay = nextMod.bays[nextMod.bays.length - 1] || nextMod.bays[0];
          const clonedBay = JSON.parse(JSON.stringify(srcBay));
          clonedBay.index = newIdx;
          clonedBay.customWidth = undefined;
          clonedBay.door.id = `${nextMod.id}_door_${newIdx}`;
          clonedBay.door.bayIndex = newIdx;
          clonedBay.shelves = (clonedBay.shelves || []).map((s: any, si: number) => ({
            ...s,
            id: `${nextMod.id}_shelf_${newIdx}_${si}`,
            bayIndex: newIdx,
          }));
          clonedBay.hangingRails = (clonedBay.hangingRails || []).map((r: any, ri: number) => ({
            ...r,
            id: `${nextMod.id}_rail_${newIdx}_${ri}`,
            bayIndex: newIdx,
          }));
          clonedBay.drawers = (clonedBay.drawers || []).map((d: any, di: number) => ({
            ...d,
            id: `${nextMod.id}_drw_${newIdx}_${di}`,
            bayIndex: newIdx,
          }));
          clonedBay.specialFittings = [];
          nextMod.bays.push(clonedBay);
        }
        if (nextMod.bays.length > targetBayCount) {
          nextMod.bays = nextMod.bays.slice(0, targetBayCount);
        }

        // Apply door types & proportional bay widths (e.g. 1/3 + 2/3 for 3-door wardrobe!)
        const availInnerW = Math.max(100, clampedW - (targetBayCount + 1) * T);
        nextMod.bays.forEach((b, bIdx) => {
          b.index = bIdx;
          const plannedDoor = bayDoorPlan[bIdx];
          if (plannedDoor && !isLift && !isPureDrawerStack && !isOpenWalkIn) {
            b.door.type = plannedDoor;
            b.door.doorSystemId =
              plannedDoor === "double"
                ? "hinged_double"
                : plannedDoor === "sliding"
                ? "sliding_top_hung"
                : plannedDoor === "open"
                ? "open"
                : "hinged_single";
          }
          // Set proportional customWidth when mixing single (1 leaf) and double (2 leaves) bays
          if (!isSliding && !isPureDrawerStack && !isOpenWalkIn && !isLift) {
            const totalLeaves = bayDoorPlan.reduce(
              (sum, dt) => sum + (dt === "double" ? 2 : 1),
              0
            );
            const myLeaves = plannedDoor === "double" ? 2 : 1;
            if (bIdx < targetBayCount - 1 && totalLeaves > targetBayCount) {
              b.customWidth = Math.round((availInnerW * myLeaves) / totalLeaves);
            } else {
              b.customWidth = undefined;
            }
          } else {
            b.customWidth = undefined;
          }
        });
      }

      const attachedPrefix = `comp_att_${target.id}__`;
      const nextMods = curProj.modules.map((m, i) => {
        if (i === modIdx) return nextMod;
        if (m.category === "complementary" && m.id.startsWith(attachedPrefix)) {
          const suffix = m.id.slice(attachedPrefix.length);
          const upd = { ...m, position: { ...m.position }, dimensions: { ...m.dimensions } };
          if (suffix.startsWith("panel_left")) {
            upd.position.x = Math.max(0, clampedX - upd.dimensions.width);
            upd.position.y = clampedY;
            upd.position.z = clampedZ;
            upd.dimensions.height = clampedH;
            upd.dimensions.depth = clampedD + 20;
          } else if (suffix.startsWith("panel_right")) {
            upd.position.x = clampedX + clampedW;
            upd.position.y = clampedY;
            upd.position.z = clampedZ;
            upd.dimensions.height = clampedH;
            upd.dimensions.depth = clampedD + 20;
          } else if (suffix.startsWith("crown_top")) {
            upd.position.x = clampedX;
            upd.position.y = clampedY + clampedH;
            upd.position.z = clampedZ;
            upd.dimensions.width = clampedW;
          } else if (suffix.startsWith("worktop")) {
            upd.position.x = clampedX;
            upd.position.y = clampedY + clampedH;
            upd.position.z = clampedZ;
            upd.dimensions.width = clampedW;
            upd.dimensions.depth = clampedD + 20;
          } else if (suffix.startsWith("backsplash")) {
            upd.position.x = clampedX;
            upd.position.y = clampedY + clampedH + 38;
            upd.position.z = clampedZ;
            upd.dimensions.width = clampedW;
          } else if (suffix.startsWith("plinth_front")) {
            upd.position.x = clampedX;
            upd.position.y = clampedY;
            upd.position.z = clampedZ + Math.max(0, clampedD - 32);
            upd.dimensions.width = clampedW;
          } else if (suffix.startsWith("waterfall_right")) {
            upd.position.x = clampedX + clampedW;
            upd.position.y = clampedY;
            upd.position.z = clampedZ;
            upd.dimensions.height = clampedH + 38;
            upd.dimensions.depth = clampedD + 20;
          } else if (suffix.startsWith("filler_left")) {
            upd.position.x = Math.max(0, clampedX - upd.dimensions.width);
            upd.position.y = clampedY;
            upd.position.z = clampedZ;
            upd.dimensions.height = clampedH;
          }
          return upd;
        }
        return m;
      });
      commitAdapterState({
        activeModuleIndex: modIdx,
        project: { ...curProj, modules: nextMods, updatedAt: new Date().toISOString() },
      });

      const totalLeafCount = nextMod.bays.reduce(
        (s, b) => s + (b.door.type === "double" ? 2 : b.door.type === "open" ? 0 : 1),
        0
      );
      return { bayCount: nextMod.bays.length, totalLeafCount, shelfCount: nextMod.bays[0]?.shelves.length || 0 };
    },
    []
  );

  const swapModuleWithNeighbor = useCallback(
    (modIdx: number, direction: "left" | "right"): { swappedWithName: string } | null => {
      const curState = useConfiguratorStore.getState();
      const curProj = curState.project;
      const target = curProj.modules[modIdx];
      if (!target) return null;

      const isWallCab =
        target.category === "kitchen_wall" || target.moduleFamilyId === "fam_kitchen_wall";
      const sameRowIndices = curProj.modules
        .map((m, idx) => ({ m, idx }))
        .filter(({ m }) => {
          if (m.category === "complementary") return false;
          const mIsWall = m.category === "kitchen_wall" || m.moduleFamilyId === "fam_kitchen_wall";
          return mIsWall === isWallCab && (m.rotation?.y || 0) === (target.rotation?.y || 0);
        })
        .sort((a, b) => a.m.position.x - b.m.position.x || a.idx - b.idx);

      const posInRow = sameRowIndices.findIndex((item) => item.idx === modIdx);
      if (posInRow < 0) return null;
      const neighborPos = direction === "left" ? posInRow - 1 : posInRow + 1;
      if (neighborPos < 0 || neighborPos >= sameRowIndices.length) return null;

      const neighborEntry = sameRowIndices[neighborPos];
      const a = target;
      const b = neighborEntry.m;

      const minX = Math.min(a.position.x, b.position.x);
      const nextMods = JSON.parse(JSON.stringify(curProj.modules)) as ModuleInstance[];

      if (direction === "left") {
        // target moves to minX, neighbor moves right of target
        nextMods[modIdx].position.x = minX;
        nextMods[neighborEntry.idx].position.x = minX + a.dimensions.width;
      } else {
        // neighbor moves to minX, target moves right of neighbor
        nextMods[neighborEntry.idx].position.x = minX;
        nextMods[modIdx].position.x = minX + b.dimensions.width;
      }

      // Also swap their array order so tab numbers (1, 2, 3...) match left-to-right visual order
      const tempMod = nextMods[modIdx];
      nextMods[modIdx] = nextMods[neighborEntry.idx];
      nextMods[neighborEntry.idx] = tempMod;

      commitAdapterState({
        history: [...curState.history.slice(-50), curProj],
        future: [],
        activeModuleIndex: neighborEntry.idx,
        project: { ...curProj, modules: nextMods, updatedAt: new Date().toISOString() },
      });

      return { swappedWithName: b.name };
    },
    []
  );

  /**
   * Called on mouseUp after dragging a module: if the dragged module was dropped overlapping
   * another module in the same row, automatically swaps their positions & resolves the overlap!
   */
  const finishModuleDragWithSmartSwap = useCallback(
    (_modIdx: number, _startModX: number): string | null => {
      // Never auto-shift or teleport untouched modules on drag end in 2D Plan!
      // Users can freely position modules anywhere in X/Z without other cabinets jumping.
      return null;
    },
    []
  );


  /**
   * Enhanced L-Kitchen loader with proper 90° rotated corner return arm & architectural fixtures
   */
  const loadLKitchen = useCallback(() => {
    loadLKitchenBase();
    const curProj = useConfiguratorStore.getState().project;
    const enhancedModules = curProj.modules.map((m) => {
      if (m.id === "l_arm") {
        return {
          ...m,
          isCorner: false,
          position: { x: 0, y: 0, z: 900 },
          rotation: { x: 0, y: 90, z: 0 },
        };
      }
      return m;
    });
    commitAdapterState({
      project: {
        ...curProj,
        modules: enhancedModules,
        space: {
          ...curProj.space,
          elements: getEffectiveSpaceObstacles(curProj),
        },
      },
    });
  }, [loadLKitchenBase]);

  /**
   * Enhanced U-Kitchen loader with 90° rotated left and right return arms
   */
  const loadUKitchen = useCallback(() => {
    loadUKitchenBase();
    const curProj = useConfiguratorStore.getState().project;
    const enhancedModules = curProj.modules.map((m) => {
      if (m.id === "u_arm_left") {
        return {
          ...m,
          isCorner: false,
          position: { x: 0, y: 0, z: 900 },
          rotation: { x: 0, y: 90, z: 0 },
        };
      }
      if (m.id === "u_arm_right") {
        return {
          ...m,
          isCorner: false,
          position: { x: 2220, y: 0, z: 900 },
          rotation: { x: 0, y: 270, z: 0 },
        };
      }
      return m;
    });
    commitAdapterState({
      project: {
        ...curProj,
        modules: enhancedModules,
        space: {
          ...curProj.space,
          walls: getEffectiveSpaceWalls(curProj),
          elements: getEffectiveSpaceObstacles(curProj),
        },
      },
    });
  }, [loadUKitchenBase]);

  /**
   * Enhanced Linear Kitchen loader with architectural fixtures (Window, Plumbing, Column)
   */
  const loadLinearKitchen = useCallback(() => {
    loadLinearKitchenBase();
    const curProj = useConfiguratorStore.getState().project;
    commitAdapterState({
      project: {
        ...curProj,
        space: {
          ...curProj.space,
          elements: getEffectiveSpaceObstacles(curProj),
        },
      },
    });
  }, [loadLinearKitchenBase]);

  /**
   * Add or update an architectural obstacle (Window, Column, Plumbing) in the room
   */
  const updateObstaclePosition = useCallback((obsId: string, newX: number, newZ?: number, newY?: number) => {
    const state = useConfiguratorStore.getState();
    const curProj = state.project;
    const currentElements: ArchitecturalElement[] =
      curProj.space.elements.length > 0
        ? curProj.space.elements
        : getEffectiveSpaceObstacles(curProj);
    const updatedElements = currentElements.map((el) =>
      el.id === obsId
        ? {
            ...el,
            position: {
              ...el.position,
              x: Math.max(0, Math.round(newX)),
              y: typeof newY === "number" ? Math.max(0, Math.round(newY)) : el.position.y,
              z: typeof newZ === "number" ? Math.max(0, Math.round(newZ)) : el.position.z,
            },
          }
        : el
    );
    commitAdapterState({
      history: state.batchStartProject ? state.history : [...state.history.slice(-50), curProj],
      future: state.batchStartProject ? state.future : [],
      project: {
        ...curProj,
        space: { ...curProj.space, elements: updatedElements },
        updatedAt: new Date().toISOString(),
      },
    });
  }, []);

  /**
   * Commit a modified ModuleInstance and recompute BOM, pricing & validation
   */
  const commitActiveModuleUpdate = useCallback(
    (updater: (mod: ModuleInstance) => ModuleInstance, pushHistory = true) => {
      const state = useConfiguratorStore.getState();
      const curProj = state.project;
      const modIdx = state.activeModuleIndex;
      const targetMod = curProj.modules[modIdx] || curProj.modules[0];
      if (!targetMod) return;

      const updatedMod = updater({
        ...targetMod,
        dimensions: { ...targetMod.dimensions },
        position: { ...targetMod.position },
        rotation: targetMod.rotation ? { ...targetMod.rotation } : { x: 0, y: 0, z: 0 },
        componentMaterialOverrides: targetMod.componentMaterialOverrides
          ? { ...targetMod.componentMaterialOverrides }
          : undefined,
        componentGrainOverrides: targetMod.componentGrainOverrides
          ? { ...targetMod.componentGrainOverrides }
          : undefined,
        carcass: {
          ...targetMod.carcass,
          customCadPolygon: targetMod.carcass.customCadPolygon
            ? targetMod.carcass.customCadPolygon.map((pt) => ({ ...pt }))
            : undefined,
        },
        bays: targetMod.bays.map((b) => ({
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
      });

      const nextModules = curProj.modules.map((m, idx) =>
        idx === modIdx ? updatedMod : m
      );
      const nextProj = {
        ...curProj,
        status: "draft" as const,
        version: (curProj.version || 1) + 1,
        updatedAt: new Date().toISOString(),
        modules: nextModules,
      };
      if (!pushHistory) {
        // Fast path during live 3D/2D dragging: update geometry at 60 FPS without blocking on CNC nesting/BOM
        commitAdapterState({
          project: nextProj,
        });
        if (typeof window !== "undefined") {
          const w = window as unknown as {
            __birimLiveDragBomTimer?: ReturnType<typeof setTimeout>;
          };
          if (w.__birimLiveDragBomTimer) clearTimeout(w.__birimLiveDragBomTimer);
          w.__birimLiveDragBomTimer = setTimeout(() => {
            const latestProj = useConfiguratorStore.getState().project;
            const dBom = generateBOMForProject(latestProj, undefined, { skipSyncNesting: true });
            commitAdapterState({
              validationIssues: validateProject(latestProj),
              bom: dBom,
              pricing: calculateProjectPrice(dBom),
            });
          }, 180);
        }
        return;
      }

      if (typeof window !== "undefined") {
        const w = window as unknown as {
          __birimLiveDragBomTimer?: ReturnType<typeof setTimeout>;
        };
        if (w.__birimLiveDragBomTimer) clearTimeout(w.__birimLiveDragBomTimer);
      }

      commitAdapterState({
        history: [...state.history.slice(-50), curProj],
        future: [],
        project: nextProj,
      });
    },
    []
  );

  /**
   * V4: Update Door System, Overlay, Handle Category, Opening Technology, or Hardware Product SKU on a bay
   */
  /**
   * 1-Click Door Opening Direction Flip (Sol Açılır <-> Sağ Açılır <-> Çift Kapak)
   */
  const flipActiveDoorDirection = useCallback(
    (bayIdx?: number) => {
      commitActiveModuleUpdate((mod) => {
        const targetBayIdx =
          typeof bayIdx === "number"
            ? bayIdx
            : Math.min(useConfiguratorStore.getState().activeBayIndex, mod.bays.length - 1);
        const bay = mod.bays[targetBayIdx];
        if (!bay || !bay.door) return mod;
        const curType = bay.door.type;
        if (curType === "single_left") {
          bay.door = { ...bay.door, type: "single_right", doorSystemId: "hinged_single" };
        } else if (curType === "single_right") {
          bay.door = { ...bay.door, type: "single_left", doorSystemId: "hinged_single" };
        } else if (curType === "inset_left") {
          bay.door = { ...bay.door, type: "inset_right", doorSystemId: "hinged_inset" };
        } else if (curType === "inset_right") {
          bay.door = { ...bay.door, type: "inset_left", doorSystemId: "hinged_inset" };
        } else if (curType === "half_overlay_left") {
          bay.door = { ...bay.door, type: "half_overlay_right", doorSystemId: "hinged_overlay_variant" };
        } else if (curType === "half_overlay_right") {
          bay.door = { ...bay.door, type: "half_overlay_left", doorSystemId: "hinged_overlay_variant" };
        } else {
          // If currently double or other, switch to single_right so user immediately sees single-right opening, then next click flips to single_left
          bay.door = { ...bay.door, type: "single_right", doorSystemId: "hinged_single" };
          mod.isOpenFront = false;
        }
        return mod;
      }, true);
    },
    [commitActiveModuleUpdate]
  );

  const setBayV4DoorConfig = useCallback(
    (
      bayIdx: number,
      updates: {
        doorSystemId?: DoorSystemId;
        overlayType?: DoorOverlayType;
        handleCategory?: HandleCategory;
        handleProfileId?: string;
        handleMaterialId?: string;
        handleOrientation?: "auto" | "vertical" | "horizontal";
        handleOffsetY?: number;
        handleEdgeInsetX?: number;
        handleLengthMm?: number;
        openingTechnology?: OpeningTechnology;
        hardwareProductId?: string;
        hingeCount?: number;
        hingeBottomOffsetMm?: number;
        hingeTopOffsetMm?: number;
        crossSectionProfile?: import("@birim/core").DoorCrossSectionProfile;
        doorMaterialId?: string;
        doorThicknessMm?: number;
        doorEdgeBandThicknessMm?: number;
        softClose?: boolean;
        isGlassFramed?: boolean;
      }
    ) => {
      commitActiveModuleUpdate((mod) => {
        const bay = mod.bays[bayIdx];
        if (!bay) return mod;
        const nextDoor = { ...bay.door, ...updates };
        if (updates.handleCategory && updates.handleProfileId === undefined) {
          nextDoor.handleProfileId = bay.door.handleProfileId;
        }
        if (typeof updates.softClose === "boolean" && !updates.openingTechnology) {
          nextDoor.openingTechnology = updates.softClose ? "soft_close" : "manual_standard";
        }
        if (updates.openingTechnology && updates.softClose === undefined) {
          nextDoor.softClose =
            updates.openingTechnology === "soft_close" ||
            updates.openingTechnology === "push_to_open_soft_close" ||
            updates.openingTechnology === "sliding_damped";
        }
        if (updates.doorSystemId) {
          mod.isOpenFront = updates.doorSystemId === "open";
          const types: Partial<Record<DoorSystemId, typeof nextDoor.type>> = { open: "open", hinged_single: "single_left", hinged_double: "double", hinged_inset: "inset_left", hinged_overlay_variant: "half_overlay_left", sliding_top_hung: "sliding", sliding_bottom_rolling: "sliding_bottom", lift_up_stay: "lift_up_stay", lift_parallel: "lift_parallel", lift_bi_fold: "lift_bi_fold", folding_side: "folding", pocket_retractable: "pocket", tambour_roller: "tambour" };
          nextDoor.type = types[updates.doorSystemId] ?? "single_left";
          nextDoor.overlayType = updates.doorSystemId === "hinged_inset" ? "inset" : updates.doorSystemId === "hinged_overlay_variant" ? "half_overlay" : "full_overlay";
        }
        if (updates.doorSystemId) {
          if (updates.doorSystemId === "hinged_double") nextDoor.type = "double";
          else if (updates.doorSystemId === "hinged_single") nextDoor.type = bay.door.type === "single_right" ? "single_right" : "single_left";
          else if (
            updates.doorSystemId === "sliding_top_hung" ||
            updates.doorSystemId === "sliding_bottom_rolling"
          ) {
            nextDoor.type = "sliding";
          } else if (updates.doorSystemId === "hinged_inset") {
            nextDoor.overlayType = "inset";
          } else if (updates.doorSystemId === "hinged_overlay_variant") {
            nextDoor.overlayType = "half_overlay";
          }
        }
        if (updates.handleCategory === "handleless_plain") {
          nextDoor.handleType = "push_to_open";
        } else if (updates.handleCategory === "gola_profile" || updates.handleCategory === "j_pull") {
          nextDoor.handleType = "integrated_profile";
        } else if (updates.handleCategory) {
          nextDoor.handleType = "standard";
        }
        bay.door = nextDoor;
        return mod;
      }, true);
    },
    [commitActiveModuleUpdate]
  );

  const copyDoorConfigToAllBays = useCallback(
    (sourceBayIdx?: number) => {
      commitActiveModuleUpdate((mod) => {
        const srcIdx =
          typeof sourceBayIdx === "number"
            ? sourceBayIdx
            : Math.min(useConfiguratorStore.getState().activeBayIndex, mod.bays.length - 1);
        const srcBay = mod.bays[srcIdx];
        if (!srcBay || !srcBay.door) return mod;
        const srcDoor = srcBay.door;
        mod.bays = mod.bays.map((b) => ({
          ...b,
          door: {
            ...b.door,
            crossSectionProfile: srcDoor.crossSectionProfile,
            isGlassFramed: srcDoor.isGlassFramed,
            handleCategory: srcDoor.handleCategory,
            handleProfileId: srcDoor.handleProfileId,
            handleMaterialId: srcDoor.handleMaterialId,
            handleOrientation: srcDoor.handleOrientation,
            handleOffsetY: srcDoor.handleOffsetY,
            handleEdgeInsetX: srcDoor.handleEdgeInsetX,
            handleLengthMm: srcDoor.handleLengthMm,
            handleType: srcDoor.handleType,
            doorMaterialId: srcDoor.doorMaterialId,
            doorThicknessMm: srcDoor.doorThicknessMm,
            doorEdgeBandThicknessMm: srcDoor.doorEdgeBandThicknessMm,
            softClose: srcDoor.softClose,
            openingTechnology: srcDoor.openingTechnology,
            overlayType: srcDoor.overlayType,
          },
        }));
        if (srcDoor.crossSectionProfile) {
          const isSolid =
            srcDoor.crossSectionProfile !== "glass_frame" &&
            srcDoor.crossSectionProfile !== "mirror_door";
          if (
            isSolid &&
            (mod.carcass.doorMaterialId === "mat_smoked_glass" ||
              mod.carcass.doorMaterialId === "mat_bronze_mirror")
          ) {
            mod.carcass.doorMaterialId = "mat_veneer_oak";
          }
          if (isSolid) {
            mod.bays.forEach((bayItem) => {
              if (
                bayItem.door.doorMaterialId === "mat_smoked_glass" ||
                bayItem.door.doorMaterialId === "mat_bronze_mirror"
              ) {
                delete bayItem.door.doorMaterialId;
              }
            });
          }
        }
        if (srcDoor.crossSectionProfile) {
          mod.carcass.crossSectionProfile = srcDoor.crossSectionProfile;
        }
        if (srcDoor.doorMaterialId) {
          mod.carcass.doorMaterialId = srcDoor.doorMaterialId;
        }
        if (srcDoor.doorThicknessMm) {
          mod.carcass.doorThickness = srcDoor.doorThicknessMm;
        }
        if (mod.componentMaterialOverrides) {
          const nextOv = { ...mod.componentMaterialOverrides };
          Object.keys(nextOv).forEach((k) => {
            if (k.includes("door")) {
              delete nextOv[k];
            }
          });
          mod.componentMaterialOverrides = nextOv;
        }
        return mod;
      }, true);
    },
    [commitActiveModuleUpdate]
  );

  /**
   * V4: Instantiate any of the 92 V4 Parametric Module Templates
   */
  const dropV4TemplateWithSnap = useCallback(
    (
      templateId: string,
      dropWorldXMm?: number,
      customDimensions?: { width?: number; height?: number; depth?: number }
    ): { placedName: string; snappedX: number; snappedY: number; snapLabel: string } | null => {
      const tpl =
        getV4TemplateById(templateId) ||
        WARDROBE_TEMPLATES.find((w) => w.templateId === templateId) ||
        KITCHEN_TEMPLATES.find((k) => k.templateId === templateId);
      if (!tpl) return null;

      const state = useConfiguratorStore.getState();
      const curProj = state.project;
      const baseMod = tpl.createInstance(`mod_${Date.now()}`);
      const newMod = "dimensionLimits" in tpl
        ? applyValidatedDimensionsToModule(baseMod, tpl, customDimensions)
        : baseMod;
      const activeMod = curProj.modules[state.activeModuleIndex] || curProj.modules.find((m) => m.category !== "complementary") || curProj.modules[0];

      // Object-Linked Complementary Module Placement: attach directly to the selected parent cabinet!
      if ((newMod.category === "complementary" || newMod.moduleFamilyId === "fam_complementary") && activeMod) {
        const parentMod = activeMod.category === "complementary"
          ? (curProj.modules.find((m) => m.category !== "complementary") || activeMod)
          : activeMod;
        const codeUpper = (tpl.code || tpl.id || "").toUpperCase();
        const nameLower = (tpl.name || newMod.name || "").toLowerCase();
        const pX = parentMod.position.x;
        const pY = parentMod.position.y;
        const pZ = parentMod.position.z;
        const pW = parentMod.dimensions.width;
        const pH = parentMod.dimensions.height;
        const pD = parentMod.dimensions.depth;
        const rotY = parentMod.rotation?.y || 0;

        let attachKey = `custom_${Date.now()}`;
        let snapDesc = `${parentMod.name} modülüne entegre edildi`;

        if (codeUpper.includes("PNL") || nameLower.includes("bitiş paneli") || nameLower.includes("yan panel")) {
          const hasLeft = curProj.modules.some((m) => m.id === `comp_att_${parentMod.id}__panel_left`);
          if (!hasLeft && pX >= 18) {
            attachKey = "panel_left";
            newMod.name = `${parentMod.name} — Sol Yan Bitiş Paneli`;
            newMod.dimensions = { width: 18, height: pH, depth: pD + 20 };
            newMod.position = { x: pX - 18, y: pY, z: pZ };
            snapDesc = `${parentMod.name} Sol Yanına Sıfır Entegre Edildi`;
          } else {
            attachKey = "panel_right";
            newMod.name = `${parentMod.name} — Sağ Yan Bitiş Paneli`;
            newMod.dimensions = { width: 18, height: pH, depth: pD + 20 };
            newMod.position = { x: pX + pW, y: pY, z: pZ };
            snapDesc = `${parentMod.name} Sağ Yanına Sıfır Entegre Edildi`;
          }
        } else if (codeUpper.includes("FLR") || nameLower.includes("kör dolgu") || nameLower.includes("köşe dolgu")) {
          attachKey = "filler_left";
          newMod.name = `${parentMod.name} — Yan Kör Dolgu Çıtası`;
          newMod.dimensions = { width: newMod.dimensions.width || 50, height: pH, depth: 18 };
          newMod.position = { x: pX + pW, y: pY, z: pZ + Math.max(0, pD - 18) };
          snapDesc = `${parentMod.name} Yanına Dolgu Çıtası Olarak Bağlandı`;
        } else if (codeUpper.includes("CRN") || codeUpper.includes("LGT") || nameLower.includes("taç") || nameLower.includes("alın") || nameLower.includes("ışık bandı")) {
          attachKey = "crown_top";
          newMod.name = `${parentMod.name} — Üst Taç / Işık Bandı`;
          newMod.dimensions = { width: pW, height: newMod.dimensions.height || 60, depth: newMod.dimensions.depth || 40 };
          newMod.position = { x: pX, y: pY + pH, z: pZ };
          snapDesc = `${parentMod.name} Üst Kotuna (Y: ${pY + pH}mm) Bağlandı`;
        } else if (codeUpper.includes("BKS") || nameLower.includes("backsplash") || nameLower.includes("tezgâh arası")) {
          attachKey = "backsplash";
          newMod.name = `${parentMod.name} — Tezgâh Arası Backsplash Paneli`;
          newMod.dimensions = { width: pW, height: 600, depth: 18 };
          newMod.position = { x: pX, y: pY + pH + 38, z: pZ };
          snapDesc = `${parentMod.name} Tezgâh Üstüne (W: ${pW}mm) Bağlandı`;
        } else if (codeUpper.includes("WTF") || nameLower.includes("şelale")) {
          attachKey = "waterfall_right";
          newMod.name = `${parentMod.name} — Şelale (Waterfall) Yan Tezgâh İnişi`;
          newMod.dimensions = { width: 38, height: pH + 38, depth: pD + 20 };
          newMod.position = { x: pX + pW, y: pY, z: pZ };
          snapDesc = `${parentMod.name} Sağ Yanına Şelale Tezgâh Olarak Bağlandı`;
        } else if (codeUpper.includes("WKT") || codeUpper.includes("BAR") || nameLower.includes("tezgâh") || nameLower.includes("bar")) {
          attachKey = "worktop";
          newMod.name = `${parentMod.name} — Üst Kuvars Tezgâh Plakası`;
          newMod.dimensions = { width: pW, height: 38, depth: pD + 20 };
          newMod.position = { x: pX, y: pY + pH, z: pZ };
          snapDesc = `${parentMod.name} Üstüne (W: ${pW}mm) Tezgâh Olarak Bağlandı`;
        } else if (codeUpper.includes("PLN") || nameLower.includes("baza")) {
          attachKey = "plinth_front";
          newMod.name = `${parentMod.name} — Ön Baza Bandı`;
          newMod.dimensions = { width: pW, height: parentMod.carcass.plinthHeight || 100, depth: 18 };
          newMod.position = { x: pX, y: pY, z: pZ + Math.max(0, pD - 45) };
          snapDesc = `${parentMod.name} Alt Bazasına (W: ${pW}mm) Bağlandı`;
        } else {
          newMod.position = { x: pX + pW, y: pY, z: pZ };
        }

        newMod.id = `comp_att_${parentMod.id}__${attachKey}`;
        newMod.rotation = { x: 0, y: rotY, z: 0 };
        if (attachKey !== "worktop" && attachKey !== "backsplash" && attachKey !== "waterfall_right") {
        newMod.carcass = {
          ...newMod.carcass,
          bodyMaterialId: parentMod.carcass.doorMaterialId || parentMod.carcass.bodyMaterialId,
          doorMaterialId: parentMod.carcass.doorMaterialId || parentMod.carcass.bodyMaterialId,
        };
      }

        const filteredMods = curProj.modules.filter((m) => m.id !== newMod.id);
        const nextModules = [...filteredMods, newMod];
        const nextProj = {
          ...curProj,
          version: (curProj.version || 1) + 1,
          updatedAt: new Date().toISOString(),
          modules: nextModules,
        };
        commitAdapterState({
          history: [...state.history.slice(-50), curProj],
          future: [],
          project: nextProj,

        });
        return {
          placedName: newMod.name,
          snappedX: newMod.position.x,
          snappedY: newMod.position.y,
          snapLabel: snapDesc,
        };
      }

      const isWallCab =
        newMod.category === "kitchen_wall" || newMod.moduleFamilyId === "fam_kitchen_wall";
      const targetY = isWallCab ? 1400 : 0;
      const targetTopY = targetY + newMod.dimensions.height;

      const sameRowMods = curProj.modules.filter((m) => {
        if (m.category === "complementary") return false;
        const mIsWall = m.category === "kitchen_wall" || m.moduleFamilyId === "fam_kitchen_wall";
        return mIsWall === isWallCab && (m.rotation?.y || 0) === 0;
      });

      // Check 3D vertical Y-range overlap so wall cabinets snap beside tall wardrobes instead of burying into them,
      // while still allowing wall cabinets above 720-860mm kitchen base cabinets.
      const yOverlappingMods = curProj.modules.filter((m) => {
        if (m.category === "complementary" || (m.rotation?.y || 0) !== 0) return false;
        const mTopY = m.position.y + m.dimensions.height;
        return m.position.y < targetTopY - 2 && mTopY > targetY + 2;
      });

      const overlapsAt = (candX: number) =>
        yOverlappingMods.some(
          (m) =>
            candX < m.position.x + m.dimensions.width - 2 &&
            candX + newMod.dimensions.width > m.position.x + 2
        );

      const snapCandidates: { x: number; label: string }[] = [
        { x: 0, label: "Duvar Başlangıcı (X: 0mm)" },
      ];
      yOverlappingMods.forEach((m, idx) => {
        const rightEdge = m.position.x + m.dimensions.width;
        const leftEdge = Math.max(0, m.position.x - newMod.dimensions.width);
        snapCandidates.push({
          x: rightEdge,
          label: `${idx + 1}. Modülün Sağına Sıfır Bitişik (X: ${rightEdge}mm)`,
        });
        snapCandidates.push({
          x: leftEdge,
          label: `${idx + 1}. Modülün Soluna Sıfır Bitişik (X: ${leftEdge}mm)`,
        });
      });

      const validCandidates = snapCandidates.filter((c) => c.x >= 0 && !overlapsAt(c.x));
      let chosen = validCandidates[validCandidates.length - 1] || {
        x:
          yOverlappingMods.length > 0
            ? Math.max(...yOverlappingMods.map((m) => m.position.x + m.dimensions.width))
            : 0,
        label: "Sıra Sonuna Mıknatıslandı",
      };

      if (typeof dropWorldXMm === "number" && validCandidates.length > 0) {
        let bestDist = Infinity;
        for (const cand of validCandidates) {
          const d = Math.abs(cand.x - dropWorldXMm);
          if (d < bestDist) {
            bestDist = d;
            chosen = cand;
          }
        }
        const gridX = Math.max(0, Math.round(dropWorldXMm / 50) * 50);
        if (bestDist > 240 && !overlapsAt(gridX)) {
          chosen = { x: gridX, label: `50mm Izgara Hizası (X: ${gridX}mm)` };
        }
      }

      let shiftedExisting = curProj.modules;
      if (
        newMod.isCorner &&
        (dropWorldXMm === undefined || dropWorldXMm <= 450) &&
        !sameRowMods.some((m) => m.isCorner && m.position.x === 0)
      ) {
        chosen = { x: 0, label: "Oda Başlangıç Köşesi (X: 0mm, Z: 0mm)" };
        if (overlapsAt(0)) {
          const shiftBy = newMod.dimensions.width;
          shiftedExisting = curProj.modules.map((m) => {
            const mIsWall = m.category === "kitchen_wall" || m.moduleFamilyId === "fam_kitchen_wall";
            if (mIsWall === isWallCab && (m.rotation?.y || 0) === 0) {
              return {
                ...m,
                position: { ...m.position, x: m.position.x + shiftBy },
              };
            }
            return m;
          });
        }
      }

      newMod.position = { x: chosen.x, y: targetY, z: 0 };
      const nextModules = [...shiftedExisting, newMod];
      const nextProj = {
        ...curProj,
        version: (curProj.version || 1) + 1,
        updatedAt: new Date().toISOString(),
        modules: nextModules,
      };

      commitAdapterState({
        history: [...state.history.slice(-50), curProj],
        future: [],
        project: nextProj,
        activeModuleIndex: nextModules.length - 1,
        selectedModuleIds: [newMod.id],
        activeBayIndex: 0,
        doorOpenAngleDeg: 0,
        drawerOpenMm: 0,
      });

      return {
        placedName: newMod.name,
        snappedX: chosen.x,
        snappedY: targetY,
        snapLabel: chosen.label,
      };
    },
    []
  );

  const applyV4Template = useCallback(
    (
      templateId: string,
      appendToProject = false,
      customDimensions?: { width?: number; height?: number; depth?: number }
    ) => {
      const tpl = getV4TemplateById(templateId);
      if (!tpl) return;
      const state = useConfiguratorStore.getState();
      const curProj = state.project;
      const lastMod = curProj.modules[curProj.modules.length - 1];
      const newMod = applyValidatedDimensionsToModule(
        tpl.createInstance(`mod_${Date.now()}`),
        tpl,
        customDimensions
      );

    let nextModules: ModuleInstance[];
    let targetIndex = 0;

    if (appendToProject || curProj.modules.length === 0) {
      const nextX = lastMod ? lastMod.position.x + lastMod.dimensions.width : 0;
      newMod.position = { ...newMod.position, x: nextX };
      nextModules = [...curProj.modules, newMod];
      targetIndex = nextModules.length - 1;
    } else {
      targetIndex = Math.max(0, Math.min(curProj.modules.length - 1, state.activeModuleIndex ?? 0));
      const targetMod = curProj.modules[targetIndex];
      newMod.id = targetMod.id;
      // Retain horizontal X and Z placement, but determine Y (elevation) based on new template family:
      // Wall cabinets sit at wall elevation (1450 or previous if already wall), base/tall/wardrobe sit on floor (0).
      const newY =
        tpl.familyId === "fam_kitchen_wall"
          ? targetMod.moduleFamilyId === "fam_kitchen_wall"
            ? targetMod.position.y
            : 1450
          : 0;
      newMod.position = {
        ...newMod.position,
        x: targetMod.position.x,
        y: newY,
        z: targetMod.position.z,
      };
      nextModules = curProj.modules.map((m, idx) => (idx === targetIndex ? newMod : m));
    }

    const nextProj = {
      ...curProj,
      version: (curProj.version || 1) + 1,
      updatedAt: new Date().toISOString(),
      modules: nextModules,
    };

    commitAdapterState({
      history: [...state.history.slice(-50), curProj],
      future: [],
      project: nextProj,
      activeModuleIndex: targetIndex,
      activeBayIndex: 0,
      doorOpenAngleDeg: 0,
      drawerOpenMm: 0,
    });
  }, []);

  /**
   * Object-Linked Complementary Attachment: attaches or toggles a specific complementary part
   * (left/right end panel, top crown, filler strip, worktop, backsplash, waterfall, plinth)
   * directly on the currently selected cabinet so it matches its dimensions and moves with it!
   */
  const attachComplementaryToActiveModule = useCallback(
    (
      compType:
        | "panel_left"
        | "panel_right"
        | "crown_top"
        | "filler_left"
        | "worktop"
        | "backsplash"
        | "waterfall_right"
        | "plinth_front"
    ) => {
      const state = useConfiguratorStore.getState();
      const curProj = state.project;
      const activeMod =
        curProj.modules[state.activeModuleIndex] ||
        curProj.modules.find((m) => m.category !== "complementary");
      if (!activeMod) return;
      const parentMod =
        activeMod.category === "complementary"
          ? curProj.modules.find((m) => m.category !== "complementary") || activeMod
          : activeMod;

      const targetId = `comp_att_${parentMod.id}__${compType}`;
      const existingIdx = curProj.modules.findIndex((m) => m.id === targetId);
      if (existingIdx >= 0) {
        const removedComp = curProj.modules[existingIdx];
        const isLeftPiece = compType === "panel_left" || compType === "filler_left";
        const shiftBackLeft =
          isLeftPiece &&
          removedComp.position.x === 0 &&
          Math.abs(parentMod.position.x - removedComp.dimensions.width) <= 2
            ? removedComp.dimensions.width
            : 0;

        const nextModules = curProj.modules
          .filter((m) => m.id !== targetId)
          .map((m) => {
            if (shiftBackLeft > 0 && m.position.x >= parentMod.position.x) {
              return {
                ...m,
                position: { ...m.position, x: Math.max(0, m.position.x - shiftBackLeft) },
              };
            }
            return m;
          });
        const nextProj = {
          ...curProj,
          version: (curProj.version || 1) + 1,
          updatedAt: new Date().toISOString(),
          modules: nextModules,
        };
        commitAdapterState({
          history: [...state.history.slice(-50), curProj],
          future: [],
          project: nextProj,

        });
        return;
      }

      const tplMap: Record<string, string> = {
        panel_left: "tpl_cm_05_end_panel",
        panel_right: "tpl_cm_05_end_panel",
        filler_left: "tpl_cm_04_wall_filler",
        crown_top: "tpl_cm_12_crown_molding",
        worktop: "tpl_cm_09_countertop",
        backsplash: "tpl_cm_11_backsplash",
        waterfall_right: "tpl_cm_10_waterfall_edge",
        plinth_front: "tpl_cm_01_plinth_strip",
      };
      const tpl = getV4TemplateById(tplMap[compType] || "tpl_cm_05_end_panel");
      if (!tpl) return;

      const newMod = tpl.createInstance(targetId);
      const isLeftAttach = compType === "panel_left" || compType === "filler_left";
      const leftAttachW = compType === "panel_left" ? 18 : compType === "filler_left" ? 50 : 0;

      // If parentMod is snapped to the left wall (pX < leftAttachW) or flush against a left cabinet,
      // shift parentMod (and same-row right modules + their attached parts) right by shiftRightMm so the left panel sits OUTSIDE the cabinet!
      let shiftRightMm = 0;
      if (isLeftAttach) {
        const hasLeftCollision = curProj.modules.some(
          (other) =>
            other.id !== parentMod.id &&
            other.category !== "complementary" &&
            Math.abs(other.position.y - parentMod.position.y) < 300 &&
            parentMod.position.x - leftAttachW < other.position.x + other.dimensions.width - 1 &&
            parentMod.position.x > other.position.x
        );
        if (parentMod.position.x < leftAttachW) {
          shiftRightMm = leftAttachW - parentMod.position.x;
        } else if (hasLeftCollision) {
          shiftRightMm = leftAttachW;
        }
      }

      const updatedBaseModules =
        shiftRightMm > 0
          ? curProj.modules.map((m) => {
              if (
                m.id === parentMod.id ||
                m.id.startsWith(`comp_att_${parentMod.id}__`) ||
                (m.position.x >= parentMod.position.x &&
                  Math.abs(m.position.y - parentMod.position.y) < 400)
              ) {
                return {
                  ...m,
                  position: { ...m.position, x: m.position.x + shiftRightMm },
                };
              }
              return m;
            })
          : curProj.modules;

      const pX = parentMod.position.x + shiftRightMm;
      const pY = parentMod.position.y;
      const pZ = parentMod.position.z;
      const pW = parentMod.dimensions.width;
      const pH = parentMod.dimensions.height;
      const pD = parentMod.dimensions.depth;

      if (compType === "panel_left") {
        newMod.name = `${parentMod.name} — Sol Yan Bitiş Paneli`;
        newMod.dimensions = { width: 18, height: pH, depth: pD + 20 };
        newMod.position = { x: pX - 18, y: pY, z: pZ };
      } else if (compType === "panel_right") {
        newMod.name = `${parentMod.name} — Sağ Yan Bitiş Paneli`;
        newMod.dimensions = { width: 18, height: pH, depth: pD + 20 };
        newMod.position = { x: pX + pW, y: pY, z: pZ };
      } else if (compType === "filler_left") {
        newMod.name = `${parentMod.name} — Duvar Kör Dolgu Çıtası (50mm)`;
        newMod.dimensions = { width: 50, height: pH, depth: 18 };
        newMod.position = { x: pX - 50, y: pY, z: pZ + Math.max(0, pD - 18) };
      } else if (compType === "crown_top") {
        newMod.name = `${parentMod.name} — Üst Taç / Alın Çıtası`;
        newMod.dimensions = { width: pW, height: 60, depth: 40 };
        newMod.position = { x: pX, y: pY + pH, z: pZ };
      } else if (compType === "worktop") {
        newMod.name = `${parentMod.name} — Üst Kuvars Tezgâh (38mm)`;
        newMod.dimensions = { width: pW, height: 38, depth: pD + 20 };
        newMod.position = { x: pX, y: pY + pH, z: pZ };
      } else if (compType === "backsplash") {
        newMod.name = `${parentMod.name} — Tezgâh Arası Backsplash`;
        newMod.dimensions = { width: pW, height: 600, depth: 18 };
        newMod.position = { x: pX, y: pY + pH + 38, z: pZ };
      } else if (compType === "waterfall_right") {
        newMod.name = `${parentMod.name} — Şelale Yan Tezgâh İnişi`;
        newMod.dimensions = { width: 38, height: pH + 38, depth: pD + 20 };
        newMod.position = { x: pX + pW, y: pY, z: pZ };
      } else if (compType === "plinth_front") {
        newMod.name = `${parentMod.name} — Baza Ön Bandı`;
        newMod.dimensions = { width: pW, height: parentMod.carcass.plinthHeight || 100, depth: 18 };
        newMod.position = { x: pX, y: pY, z: pZ + Math.max(0, pD - 32) };
      }

      newMod.rotation = { x: 0, y: parentMod.rotation?.y || 0, z: 0 };
      if (compType !== "worktop" && compType !== "backsplash" && compType !== "waterfall_right") {
        newMod.carcass = {
          ...newMod.carcass,
          bodyMaterialId: parentMod.carcass.doorMaterialId || parentMod.carcass.bodyMaterialId,
          doorMaterialId: parentMod.carcass.doorMaterialId || parentMod.carcass.bodyMaterialId,
        };
      }

      const nextModules = [...updatedBaseModules, newMod];
      const nextProj = {
        ...curProj,
        version: (curProj.version || 1) + 1,
        updatedAt: new Date().toISOString(),
        modules: nextModules,
      };
      commitAdapterState({
        history: [...state.history.slice(-50), curProj],
        future: [],
        project: nextProj,

      });
    },
    []
  );

  /**
   * V4: Apply Wardrobe Interior Wizard to active module
   */
  const applyWardrobeWizard = useCallback(
    (wizardId: WardrobeInteriorWizardId) => {
      commitActiveModuleUpdate((mod) => applyWardrobeInteriorWizard(mod, wizardId), true);
    },
    [commitActiveModuleUpdate]
  );

  /**
   * V4: Apply Smart Wall Layout Proposal (e.g., 3600mm wall -> 4-carcass / 3-carcass / mixed)
   */
  const applySmartWallProposal = useCallback((proposalId: string, wallSpanMm = 3600) => {
    const state = useConfiguratorStore.getState();
    const curProj = state.project;
    const mod = curProj.modules[0];
    const isKitchen = mod?.category?.startsWith("kitchen");
    const proposals = generateSmartWallLayouts(
      wallSpanMm,
      mod?.dimensions.height || 2200,
      mod?.dimensions.depth || 600,
      isKitchen ? "kitchen" : "wardrobe"
    );
    const chosen = proposals.find((p) => p.id === proposalId) || proposals[0];
    if (!chosen) return;

    const nextProj = {
      ...curProj,
      version: (curProj.version || 1) + 1,
      updatedAt: new Date().toISOString(),
      modules: chosen.buildModules(),
    };

    commitAdapterState({
      history: [...state.history.slice(-50), curProj],
      future: [],
      project: nextProj,
      activeModuleIndex: 0,
      activeBayIndex: 0,
    });
  }, []);

  /**
   * V4: Distribute current modules evenly along wall
   */
  const distributeAlongWall = useCallback(() => {
    const state = useConfiguratorStore.getState();
    const curProj = state.project;
    const wallLen = getEffectiveSpaceWalls(curProj)[0]?.length || 3600;
    const { updatedModules } = distributeModulesAlongWall(curProj.modules, wallLen);
    const nextProj = {
      ...curProj,
      version: (curProj.version || 1) + 1,
      updatedAt: new Date().toISOString(),
      modules: updatedModules,
    };

    commitAdapterState({
      history: [...state.history.slice(-50), curProj],
      future: [],
      project: nextProj,
    });
  }, []);

  /**
   * V4: Auto-generate Complementary Kitchen Modules (Countertop, Backsplash, End Panel)
   */
  const autoGenerateKitchenComplementary = useCallback(() => {
    const state = useConfiguratorStore.getState();
    const curProj = state.project;
    const wallLen = getEffectiveSpaceWalls(curProj)[0]?.length || 3600;
    const nextModules = generateKitchenComplementaryModules(curProj.modules, wallLen);
    const nextProj = {
      ...curProj,
      version: (curProj.version || 1) + 1,
      updatedAt: new Date().toISOString(),
      modules: nextModules,
    };

    commitAdapterState({
      history: [...state.history.slice(-50), curProj],
      future: [],
      project: nextProj,
    });
  }, []);

  /**
   * One-Click Project Budget / Segment Switcher (Ekonomik <-> Standart <-> Premium + LED)
   */
  const applyProjectSegmentPreset = useCallback(
    (segment: "economy" | "standard" | "premium") => {
      const state = useConfiguratorStore.getState();
      const curProj = state.project;
      const presetMap = {
        economy: {
          bodyMat: "mat_melamine_white",
          doorMat: "mat_ke_safir_mese",
          runnerId: "hw_blum_tandembox_m30",
          hingeId: "hw_salice_c7p6ae9",
          addLed: false,
        },
        standard: {
          bodyMat: "mat_veneer_oak",
          doorMat: "mat_ye_kasmir_gri",
          runnerId: "hw_blum_movento_760h",
          hingeId: "hw_blum_71b3550",
          addLed: false,
        },
        premium: {
          bodyMat: "mat_ke_mattplus_vizon",
          doorMat: "mat_lacquer_sage",
          runnerId: "hw_blum_legrabox_m40",
          hingeId: "hw_blum_71b7550",
          addLed: true,
        },
      }[segment];

      const nextModules = curProj.modules.map((mod) => {
        if (mod.category === "complementary") return mod;
        const nextBays = mod.bays.map((b, bIdx) => {
          const nextDrawers = b.drawers.map((d) => ({
            ...d,
            hardwareProductId: presetMap.runnerId,
          }));
          let nextFittings = [...(b.specialFittings || [])];
          if (presetMap.addLed && !nextFittings.some((f) => f.type.startsWith("led_"))) {
            nextFittings.push({
              id: `fit_led_${mod.id}_${bIdx}`,
              bayIndex: bIdx,
              elevationY: Math.max(400, mod.dimensions.height - 220),
              type: "led_profile",
              height: 20,
            });
          } else if (!presetMap.addLed) {
            nextFittings = nextFittings.filter((f) => !f.id.startsWith("fit_led_"));
          }
          return {
            ...b,
            drawers: nextDrawers,
            specialFittings: nextFittings,
            door: {
              ...b.door,
              hardwareProductId:
                b.door.doorSystemId?.startsWith("sliding") ||
                b.door.doorSystemId?.startsWith("lift")
                  ? b.door.hardwareProductId
                  : presetMap.hingeId,
            },
          };
        });
        return {
          ...mod,
          carcass: {
            ...mod.carcass,
            bodyMaterialId: presetMap.bodyMat,
            doorMaterialId: presetMap.doorMat,
          },
          bays: nextBays,
        };
      });

      commitAdapterState({
        project: {
          ...curProj,
          modules: nextModules,
        },
      });
    },
    []
  );

  /**
   * V4 Guided Step-by-Step Wizard Atomic Builder:
   * Builds a 100% collision-free, non-overlapping multi-module wall layout in one atomic state commit.
   */
  const applyGuidedWizardLayout = useCallback(
    (wiz: {
      spaceCategory: "wardrobe" | "walkin" | "kitchen" | "living";
      roomShape: "rectangular" | "l_shape" | "u_shape";
      wallWidthMm: number;
      targetHeightMm: number;
      targetDepthMm: number;
      autoFiller50Mm: boolean;
      interiorFocus: "hanging" | "balanced" | "shelves";
      doorStyle: "hinged" | "sliding" | "glass" | "open";
      conceptTier: "eco" | "smart" | "signature";
      colorSwatchId?: string;
      addLed: boolean;
      addTrouserRack: boolean;
      addJewelryTray: boolean;
    }) => {
      const state = useConfiguratorStore.getState();
      const curProj = state.project;

      const safeWallW = Math.max(1200, Math.min(6000, Math.round(wiz.wallWidthMm)));
      const fillerEach = wiz.autoFiller50Mm && safeWallW >= 1400 ? 50 : 0;
      const usableSpan = Math.max(800, safeWallW - fillerEach * 2);
      const effHeight =
        wiz.spaceCategory === "kitchen"
          ? 900
          : Math.max(1800, Math.min(2700, Math.round(wiz.targetHeightMm)));
      const effDepth = Math.max(350, Math.min(700, Math.round(wiz.targetDepthMm)));
      const ceilH = Math.max(2550, effHeight + 150);

      // Material mapping by selected color swatch & concept tier
      const swatchMatMap: Record<string, { body: string; door: string }> = {
        cashmere: { body: "mat_veneer_oak", door: "mat_ye_kasmir_gri" },
        white: { body: "mat_melamine_white", door: "mat_melamine_white" },
        oak: { body: "mat_ke_safir_mese", door: "mat_veneer_oak" },
        walnut: { body: "mat_ke_mattplus_vizon", door: "mat_veneer_walnut" },
        anthracite: { body: "mat_mdf_anthracite", door: "mat_lacquer_anthracite" },
      };
      const chosenMats =
        (wiz.colorSwatchId && swatchMatMap[wiz.colorSwatchId]) ||
        (wiz.conceptTier === "eco"
          ? swatchMatMap.white
          : wiz.conceptTier === "signature"
          ? swatchMatMap.walnut
          : swatchMatMap.cashmere);

      const modCount =
        usableSpan < 1300 ? 1 : usableSpan < 2200 ? 2 : usableSpan < 3300 ? 3 : 4;
      const baseUnitW = Math.floor(usableSpan / modCount / 10) * 10;
      const remW = usableSpan - baseUnitW * modCount;

      let curX = fillerEach;
      const builtModules: ModuleInstance[] = [];

      for (let i = 0; i < modCount; i++) {
        const thisW = i === modCount - 1 ? baseUnitW + remW : baseUnitW;
        const tplId =
          wiz.spaceCategory === "kitchen"
            ? i === 0
              ? "tpl_kb_08_sink_base"
              : i === 1
              ? "tpl_kb_05_three_drawers"
              : "tpl_kb_02_double_door"
            : i % 2 === 1 && wiz.interiorFocus !== "hanging"
            ? "tpl_wd_12_mixed_organizer"
            : "tpl_wd_02_two_door";

        const tpl =
          getV4TemplateById(tplId) ||
          WARDROBE_TEMPLATES[0];
        const modTitle =
          wiz.spaceCategory === "kitchen"
            ? i === 0
              ? "Eviye Alt Dolabı"
              : i === 1
              ? "Çekmeceli Ocak Altı"
              : `Hazırlık Dolabı #${i + 1}`
            : wiz.spaceCategory === "living"
            ? `Vitrin & Depolama #${i + 1}`
            : wiz.spaceCategory === "walkin"
            ? `Giyinme Ünitesi #${i + 1}`
            : `Gardırop Gövde #${i + 1}`;

        const m = tpl
          ? tpl.createInstance(`mod_wiz_${Date.now()}_${i + 1}`, modTitle)
          : createDefaultWardrobeModule(`mod_wiz_${Date.now()}_${i + 1}`);

        m.name = modTitle;
        m.position = { x: curX, y: 0, z: 0 };
        m.rotation = { x: 0, y: 0, z: 0 };
        m.dimensions = { width: thisW, height: effHeight, depth: effDepth };
        m.isOpenFront = wiz.doorStyle === "open";
        m.carcass = {
          ...m.carcass,
          bodyMaterialId: chosenMats.body,
          doorMaterialId: chosenMats.door,
          ledLightingEnabled: wiz.addLed,
          ledColorTempK: 3000,
        };

        // Configure bays cleanly for `thisW` without any customWidth mismatch
        const targetBayCount = thisW >= 750 ? 2 : 1;
        while (m.bays.length < targetBayCount) {
          m.bays.push(JSON.parse(JSON.stringify(m.bays[0])));
        }
        if (m.bays.length > targetBayCount) {
          m.bays = m.bays.slice(0, targetBayCount);
        }

        const T = m.carcass.panelThickness || 18;
        const plinthH = m.carcass.plinthHeight ?? 100;
        const netH = Math.max(400, effHeight - plinthH - 2 * T);
        const topShelfY = Math.round((netH - 360) / 32) * 32;
        const railHighY = Math.max(400, topShelfY - 64);

        m.bays = m.bays.map((b, bIdx) => {
          const isSingleBayMod = targetBayCount === 1;
          const nextDoorType =
            wiz.doorStyle === "open"
              ? ("open" as const)
              : wiz.doorStyle === "sliding"
              ? ("sliding" as const)
              : isSingleBayMod
              ? ("double" as const)
              : bIdx === 0
              ? ("single_left" as const)
              : ("single_right" as const);

          const nextDoorSys =
            wiz.doorStyle === "open"
              ? ("open" as const)
              : wiz.doorStyle === "sliding"
              ? ("sliding_top_hung" as const)
              : isSingleBayMod
              ? ("hinged_double" as const)
              : ("hinged_single" as const);

          let nextShelves = b.shelves || [];
          let nextRails = b.hangingRails || [];
          let nextDrawers = b.drawers || [];
          const nextFittings: typeof b.specialFittings = [];

          if (wiz.spaceCategory !== "kitchen") {
            if (wiz.interiorFocus === "hanging") {
              nextShelves = [
                { id: `sh_${m.id}_${bIdx}_top`, bayIndex: bIdx, elevationY: topShelfY, isAdjustable: false },
              ];
              nextRails = [
                { id: `rl_${m.id}_${bIdx}_1`, bayIndex: bIdx, elevationY: railHighY },
              ];
              nextDrawers = [];
            } else if (wiz.interiorFocus === "shelves") {
              const stepS = Math.floor(netH / 5 / 32) * 32;
              nextShelves = [1, 2, 3, 4].map((sIdx) => ({
                id: `sh_${m.id}_${bIdx}_${sIdx}`,
                bayIndex: bIdx,
                elevationY: Math.max(256, stepS * sIdx),
                isAdjustable: true,
              }));
              nextRails = [];
              nextDrawers =
                bIdx === 0
                  ? [
                      { id: `drw_${m.id}_${bIdx}_1`, bayIndex: bIdx, height: 192, elevationY: 0, slideType: "soft_close" as const, frontMaterialId: chosenMats.door },
                      { id: `drw_${m.id}_${bIdx}_2`, bayIndex: bIdx, height: 192, elevationY: 195, slideType: "soft_close" as const, frontMaterialId: chosenMats.door },
                    ]
                  : [];
            } else {
              // Balanced family layout: Bay 0 = Top Shelf + Hanging Rail, Bay 1 = Shelves + 2 Bottom Drawers
              if (bIdx === 0) {
                nextShelves = [
                  { id: `sh_${m.id}_${bIdx}_top`, bayIndex: bIdx, elevationY: topShelfY, isAdjustable: false },
                ];
                nextRails = [
                  { id: `rl_${m.id}_${bIdx}_1`, bayIndex: bIdx, elevationY: railHighY },
                ];
                nextDrawers = [];
              } else {
                nextDrawers = [
                  { id: `drw_${m.id}_${bIdx}_1`, bayIndex: bIdx, height: 192, elevationY: 0, slideType: "soft_close" as const, frontMaterialId: chosenMats.door },
                  { id: `drw_${m.id}_${bIdx}_2`, bayIndex: bIdx, height: 192, elevationY: 195, slideType: "soft_close" as const, frontMaterialId: chosenMats.door },
                ];
                nextShelves = [
                  { id: `sh_${m.id}_${bIdx}_1`, bayIndex: bIdx, elevationY: 448, isAdjustable: true },
                  { id: `sh_${m.id}_${bIdx}_2`, bayIndex: bIdx, elevationY: 896, isAdjustable: true },
                  { id: `sh_${m.id}_${bIdx}_3`, bayIndex: bIdx, elevationY: 1344, isAdjustable: true },
                  { id: `sh_${m.id}_${bIdx}_4`, bayIndex: bIdx, elevationY: topShelfY, isAdjustable: false },
                ].filter((s) => s.elevationY < netH - 160);
                nextRails = [];
              }
            }

            if (wiz.addLed) {
              nextFittings.push({
                id: `fit_led_${m.id}_${bIdx}`,
                bayIndex: bIdx,
                elevationY: Math.max(400, netH - 48),
                type: "led_profile",
                height: 20,
              });
            }
            if (wiz.addTrouserRack && i === 0 && bIdx === 0) {
              nextFittings.push({
                id: `fit_tr_${m.id}_${bIdx}`,
                bayIndex: bIdx,
                elevationY: 640,
                type: "trouser_rack",
                height: 85,
              });
            }
            if (wiz.addJewelryTray && i === 0 && bIdx === m.bays.length - 1) {
              nextFittings.push({
                id: `fit_jw_${m.id}_${bIdx}`,
                bayIndex: bIdx,
                elevationY: 512,
                type: "jewelry_tray",
                height: 70,
              });
            }
          }

          return {
            ...b,
            index: bIdx,
            customWidth: undefined,
            shelves: nextShelves,
            hangingRails: nextRails,
            drawers: nextDrawers,
            specialFittings: nextFittings,
            door: {
              ...b.door,
              id: `door_${m.id}_${bIdx}`,
              bayIndex: bIdx,
              type: nextDoorType,
              doorSystemId: nextDoorSys,
              doorMaterialId: wiz.doorStyle === "glass" ? "mat_smoked_glass" : chosenMats.door,
              isGlassFramed: wiz.doorStyle === "glass",
              crossSectionProfile: wiz.doorStyle === "glass" ? "glass_frame" : "flat_18",
            },
          };
        });

        builtModules.push(m);
        curX += thisW;
      }

      // Add 90-degree return wing modules when L-Shape or U-Shape is selected (with 50mm corner clearance)
      if (wiz.roomShape === "l_shape" || wiz.roomShape === "u_shape") {
        const returnStartZ = effDepth + 50;
        const returnModW = 1000;
        const baseRef = builtModules[0];
        if (baseRef) {
          const leftWing: ModuleInstance = JSON.parse(JSON.stringify(baseRef));
          leftWing.id = `mod_wiz_left_${Date.now()}`;
          leftWing.name =
            wiz.spaceCategory === "kitchen" ? "Sol Dönüş Dolabı" : "Sol Köşe Dönüş Ünitesi";
          leftWing.dimensions = { width: returnModW, height: effHeight, depth: effDepth };
          leftWing.position = { x: 0, y: 0, z: returnStartZ + returnModW };
          leftWing.rotation = { x: 0, y: 90, z: 0 };
          leftWing.bays = leftWing.bays.map((b, bIdx) => ({
            ...b,
            id: undefined,
            door: { ...b.door, id: `door_${leftWing.id}_${bIdx}` },
            shelves: b.shelves.map((s, sI) => ({ ...s, id: `sh_${leftWing.id}_${bIdx}_${sI}` })),
            hangingRails: b.hangingRails.map((r, rI) => ({ ...r, id: `rl_${leftWing.id}_${bIdx}_${rI}` })),
            drawers: b.drawers.map((d, dI) => ({ ...d, id: `drw_${leftWing.id}_${bIdx}_${dI}` })),
            specialFittings: (b.specialFittings || []).map((f, fI) => ({
              ...f,
              id: `fit_${leftWing.id}_${bIdx}_${fI}`,
            })),
          })) as typeof leftWing.bays;
          builtModules.push(leftWing);

          if (wiz.roomShape === "u_shape") {
            const rightWing: ModuleInstance = JSON.parse(JSON.stringify(baseRef));
            rightWing.id = `mod_wiz_right_${Date.now()}`;
            rightWing.name =
              wiz.spaceCategory === "kitchen" ? "Sağ Dönüş Dolabı" : "Sağ Köşe Dönüş Ünitesi";
            rightWing.dimensions = { width: returnModW, height: effHeight, depth: effDepth };
            rightWing.position = { x: safeWallW, y: 0, z: returnStartZ };
            rightWing.rotation = { x: 0, y: 270, z: 0 };
            rightWing.bays = rightWing.bays.map((b, bIdx) => ({
              ...b,
              door: { ...b.door, id: `door_${rightWing.id}_${bIdx}` },
              shelves: b.shelves.map((s, sI) => ({ ...s, id: `sh_${rightWing.id}_${bIdx}_${sI}` })),
              hangingRails: b.hangingRails.map((r, rI) => ({ ...r, id: `rl_${rightWing.id}_${bIdx}_${rI}` })),
              drawers: b.drawers.map((d, dI) => ({ ...d, id: `drw_${rightWing.id}_${bIdx}_${dI}` })),
              specialFittings: (b.specialFittings || []).map((f, fI) => ({
                ...f,
                id: `fit_${rightWing.id}_${bIdx}_${fI}`,
              })),
            })) as typeof rightWing.bays;
            builtModules.push(rightWing);
          }
        }
      }

      // Build clean room walls matching roomShape and safeWallW
      const nextWalls = [
        {
          id: "wall_main",
          name: "Ana Duvar",
          length: safeWallW,
          height: ceilH,
          thickness: 150,
          position: { x: 0, y: 0, z: 0 },
          rotationY: 0,
          elements: [],
        },
        ...(wiz.roomShape === "l_shape" || wiz.roomShape === "u_shape"
          ? [
              {
                id: "wall_left_return",
                name: "Sol Yan Duvar",
                length: 2200,
                height: ceilH,
                thickness: 150,
                position: { x: 0, y: 0, z: 0 },
                rotationY: 90,
                elements: [],
              },
            ]
          : []),
        ...(wiz.roomShape === "u_shape"
          ? [
              {
                id: "wall_right_return",
                name: "Sağ Yan Duvar",
                length: 2200,
                height: ceilH,
                thickness: 150,
                position: { x: safeWallW, y: 0, z: 0 },
                rotationY: 90,
                elements: [],
              },
            ]
          : []),
      ];

      const nextSpace = {
        ...curProj.space,
        type: wiz.spaceCategory === "kitchen" ? ("kitchen_straight" as const) : ("wardrobe_zone" as const),
        ceilingHeight: ceilH,
        walls: nextWalls,
        elements: [],
        wizardCleanRoom: true,
      } as typeof curProj.space;

      const nextProj = {
        ...curProj,
        version: (curProj.version || 1) + 1,
        updatedAt: new Date().toISOString(),
        space: nextSpace,
        modules: builtModules,
      };

      commitAdapterState({
        history: [...state.history.slice(-50), curProj],
        future: [],
        project: nextProj,
        activeModuleIndex: 0,
        activeBayIndex: 0,
        selectedComponentId: null,
      });
    },
    []
  );

  /**
   * Update Shelf Elevation Y (in mm from inner bottom panel) by manual drag or exact numeric input
   */
  /**
   * Adds an interior accessory/item (shelf, drawer, rail, special fitting) into the specified bay
   * at an exact elevation Y (mm from bottom) with System 32 / logical boundary clamping.
   */
  /**
   * Splits the specified bay (activeBayIndex) of the active module into 2 equal sub-bays
   * by inserting a full-height vertical divider (Ara Dikme) right down its center,
   * preserving all shelves, rails, drawers, and doors on both halves!
   */
  const splitBayIntoTwo = useCallback(
    (bayIdx?: number) => {
      commitActiveModuleUpdate((mod) => {
        if (mod.bays.length >= 8) return mod;
        const st = useConfiguratorStore.getState();
        const safeBayIdx = Math.max(
          0,
          Math.min(mod.bays.length - 1, typeof bayIdx === "number" ? bayIdx : st.activeBayIndex)
        );
        const targetBay = mod.bays[safeBayIdx];
        if (!targetBay) return mod;

        const T = mod.carcass.panelThickness || 18;
        const currentWidths = calculateBayWidths(mod);
        const origBayW = currentWidths[safeBayIdx] || 600;
        const halfW = Math.max(120, Math.floor((origBayW - T) / 2));

        // Create Left & Right halves from the selected bay so interior items are preserved in both
        const leftBay: typeof targetBay = JSON.parse(JSON.stringify(targetBay));
        const rightBay: typeof targetBay = JSON.parse(JSON.stringify(targetBay));

        // Adjust widths if other bays exist so only the selected bay is split in two!
        if (mod.bays.length > 1) {
          mod.bays.forEach((b, i) => {
            if (i !== safeBayIdx && typeof b.customWidth !== "number") {
              b.customWidth = currentWidths[i];
            }
          });
          leftBay.customWidth = halfW;
          rightBay.customWidth = Math.max(120, origBayW - T - halfW);
        } else {
          leftBay.customWidth = undefined;
          rightBay.customWidth = undefined;
        }

        // Adjust doors for split bays: if it was double door, each half gets a single door (left & right)
        if (targetBay.door.type === "double" || targetBay.door.doorSystemId === "hinged_double") {
          leftBay.door.type = "single_left";
          leftBay.door.doorSystemId = "hinged_single";
          rightBay.door.type = "single_right";
          rightBay.door.doorSystemId = "hinged_single";
        }

        const nextBays = [
          ...mod.bays.slice(0, safeBayIdx),
          leftBay,
          rightBay,
          ...mod.bays.slice(safeBayIdx + 1),
        ];

        // Re-index all bays and give unique IDs to cloned items
        nextBays.forEach((b, idx) => {
          b.index = idx;
          b.door.id = `${mod.id}_door_${idx}`;
          b.door.bayIndex = idx;
          b.shelves = (b.shelves || []).map((s, si) => ({
            ...s,
            id: `${mod.id}_shelf_${idx}_${si}_${Date.now()}`,
            bayIndex: idx,
          }));
          b.hangingRails = (b.hangingRails || []).map((r, ri) => ({
            ...r,
            id: `${mod.id}_rail_${idx}_${ri}_${Date.now()}`,
            bayIndex: idx,
          }));
          b.drawers = (b.drawers || []).map((d, di) => ({
            ...d,
            id: `${mod.id}_drw_${idx}_${di}_${Date.now()}`,
            bayIndex: idx,
          }));
          b.specialFittings = (b.specialFittings || []).map((f, fi) => ({
            ...f,
            id: `${mod.id}_fit_${idx}_${fi}_${Date.now()}`,
            bayIndex: idx,
          }));
          b.subDividers = (b.subDividers || []).map((sd, sdi) => ({
            ...sd,
            id: `${mod.id}_subdiv_${idx}_${sdi}_${Date.now()}`,
            bayIndex: idx,
            offsetX: Math.min(Math.max(40, halfW - 40), Math.round(sd.offsetX * 0.5)),
          }));
        });

        mod.bays = nextBays;
        return mod;
      }, true);
    },
    [commitActiveModuleUpdate]
  );

  const addInteriorItemAtElevation = useCallback(
    (
      bayIdx: number,
      itemKind: string,
      elevationY: number,
      options?: { drawerHeight?: number; isInternal?: boolean; offsetX?: number }
    ) => {
      commitActiveModuleUpdate((mod) => {
        const netH = calculateNetInnerHeight(mod);
        const safeBayIdx = Math.max(0, Math.min(mod.bays.length - 1, bayIdx));
        const bay = mod.bays[safeBayIdx];
        if (!bay) return mod;

        // Logical System 32 grid snap (multiples of 32mm)
        const snappedY = Math.round(elevationY / 32) * 32;

        // Helper to avoid exact vertical collision with existing shelves/rails/fittings
        const resolveCollisionFreeY = (targetY: number, minGap = 96, minY = 64, maxY = netH - 64): number => {
          const occupied = [
            ...(bay.shelves || []).map((s) => s.elevationY),
            ...(bay.hangingRails || []).map((r) => r.elevationY),
            ...(bay.specialFittings || []).map((f) => f.elevationY),
          ];
          let candidate = Math.max(minY, Math.min(maxY, targetY));
          for (let step = 0; step <= 12; step++) {
            const offset = step * 32;
            for (const dir of [1, -1]) {
              const testY = Math.max(minY, Math.min(maxY, candidate + dir * offset));
              if (!occupied.some((oy) => Math.abs(oy - testY) < minGap)) {
                return testY;
              }
            }
          }
          return candidate;
        };

        // Case 0A: Full-Height Ara Dikme (Splits the target bay into 2 sub-bays!)
        if (
          itemKind === "lib_carcass_divider" ||
          itemKind === "carcass_divider" ||
          itemKind === "ara_dikme"
        ) {
          if (mod.bays.length >= 8) return mod;
          const T = mod.carcass.panelThickness || 18;
          const currentWidths = calculateBayWidths(mod);
          const origBayW = currentWidths[safeBayIdx] || 600;
          const halfW =
            typeof options?.offsetX === "number"
              ? Math.max(120, Math.min(origBayW - T - 120, Math.round(options.offsetX)))
              : Math.max(120, Math.floor((origBayW - T) / 2));

          const leftBay: typeof bay = JSON.parse(JSON.stringify(bay));
          const rightBay: typeof bay = JSON.parse(JSON.stringify(bay));

          if (mod.bays.length > 1 || typeof options?.offsetX === "number") {
            mod.bays.forEach((b, i) => {
              if (i !== safeBayIdx && typeof b.customWidth !== "number") {
                b.customWidth = currentWidths[i];
              }
            });
            leftBay.customWidth = halfW;
            rightBay.customWidth = Math.max(120, origBayW - T - halfW);
          }

          if (bay.door.type === "double" || bay.door.doorSystemId === "hinged_double") {
            leftBay.door.type = "single_left";
            leftBay.door.doorSystemId = "hinged_single";
            rightBay.door.type = "single_right";
            rightBay.door.doorSystemId = "hinged_single";
          }

          const nextBays = [
            ...mod.bays.slice(0, safeBayIdx),
            leftBay,
            rightBay,
            ...mod.bays.slice(safeBayIdx + 1),
          ];
          nextBays.forEach((b, idx) => {
            b.index = idx;
            b.door.id = `${mod.id}_door_${idx}`;
            b.door.bayIndex = idx;
            b.shelves = (b.shelves || []).map((s, si) => ({
              ...s,
              id: `${mod.id}_shelf_${idx}_${si}_${Date.now()}`,
              bayIndex: idx,
            }));
            b.hangingRails = (b.hangingRails || []).map((r, ri) => ({
              ...r,
              id: `${mod.id}_rail_${idx}_${ri}_${Date.now()}`,
              bayIndex: idx,
            }));
            b.drawers = (b.drawers || []).map((d, di) => ({
              ...d,
              id: `${mod.id}_drw_${idx}_${di}_${Date.now()}`,
              bayIndex: idx,
            }));
          });
          mod.bays = nextBays;
          return mod;
        }

        // Case 0B: Raf Arası Dikme (Sub-Divider spanning automatically between shelves — NEVER inside an interval with a Hanging Rail / Drawer!)
        if (
          itemKind === "lib_sub_divider" ||
          itemKind === "sub_divider" ||
          itemKind === "raf_arasi_dikme"
        ) {
          const T = mod.carcass.panelThickness || 18;
          const bayWidths = calculateBayWidths(mod);
          const bayW = bayWidths[safeBayIdx] || 600;
          const intervals = getBayShelfIntervalsForSubDivider(bay, netH, T);
          const hoveredIv =
            intervals.find((iv) => elevationY >= iv.botY - 24 && elevationY <= iv.topY + 24) ||
            intervals.reduce(
              (best, iv) =>
                !best ||
                Math.abs((iv.botY + iv.topY) / 2 - elevationY) <
                  Math.abs((best.botY + best.topY) / 2 - elevationY)
                  ? iv
                  : best,
              null as SubDividerShelfInterval | null
            );

          // If the target interval has a hanging rail, drawer, or pull-out fitting, find the nearest conflict-free shelf interval;
          // if NO conflict-free shelf interval exists in this bay, refuse to place the sub-divider on top of the hanging rail!
          let chosenIv: SubDividerShelfInterval | null = hoveredIv;
          if (!chosenIv || chosenIv.hasConflict) {
            const freeIntervals = intervals.filter((iv) => !iv.hasConflict);
            if (freeIntervals.length === 0) {
              return mod;
            }
            chosenIv = freeIntervals.reduce((best, iv) =>
              Math.abs((iv.botY + iv.topY) / 2 - elevationY) <
              Math.abs((best.botY + best.topY) / 2 - elevationY)
                ? iv
                : best
            );
          }

          const botY = chosenIv.botY;
          const spanH = Math.max(80, chosenIv.height);
          const existingInSpan = (bay.subDividers || []).filter(
            (sd) => Math.abs(sd.elevationY - botY) <= 15
          ).length;
          const rawX =
            typeof options?.offsetX === "number"
              ? options.offsetX
              : Math.round(
                  bayW / 2 -
                    T / 2 +
                    (existingInSpan % 2 === 1 ? 90 : existingInSpan > 0 ? -90 : 0)
                );
          const clampedX = Math.max(48, Math.min(Math.max(80, bayW - T - 48), Math.round(rawX / 10) * 10));

          bay.subDividers = bay.subDividers || [];
          bay.subDividers.push({
            id: `subdiv_${safeBayIdx}_${Date.now()}_${bay.subDividers.length}`,
            bayIndex: safeBayIdx,
            offsetX: clampedX,
            elevationY: botY,
            height: spanH,
            thickness: T,
          });
          return mod;
        }

        if (itemKind === "lib_shelf" || itemKind === "shelf") {
          const clampedY = resolveCollisionFreeY(snappedY, 96, 64, netH - 64);
          bay.shelves = bay.shelves || [];
          bay.shelves.push({
            id: `shelf_${safeBayIdx}_${Date.now()}`,
            bayIndex: safeBayIdx,
            elevationY: clampedY,
            isAdjustable: true,
          });
        } else if (
          itemKind === "lib_drawer" ||
          itemKind === "drawer" ||
          itemKind === "lib_internal_drawer" ||
          itemKind === "internal_drawer"
        ) {
          const isInternal = itemKind.includes("internal") || !!options?.isInternal;
          const h = options?.drawerHeight || (isInternal ? 140 : 180);
          bay.drawers = bay.drawers || [];
          // Smart stacking: if dropped near the bottom or overlapping an existing drawer, stack neatly on top of the highest drawer or at snappedY
          let clampedY = Math.max(0, Math.min(netH - h, snappedY));
          const hasOverlap = bay.drawers.some(
            (d) => clampedY < d.elevationY + d.height && clampedY + h > d.elevationY
          );
          if (hasOverlap || clampedY < 96) {
            const topOfStack = bay.drawers.reduce(
              (maxTop, d) => Math.max(maxTop, d.elevationY + d.height),
              0
            );
            if (topOfStack + h <= netH) {
              clampedY = topOfStack;
            }
          }
          const optNl = Math.min(
            600,
            Math.max(270, Math.floor((mod.dimensions.depth - 28) / 50) * 50)
          );
          bay.drawers.push({
            id: `drw_${safeBayIdx}_${Date.now()}`,
            bayIndex: safeBayIdx,
            elevationY: clampedY,
            height: h,
            slideType: "soft_close",
            isInternal,
            hardwareProductId: isInternal
              ? "hw_blum_legrabox_m40"
              : "hw_blum_legrabox_c70",
            nominalLengthMm: optNl,
          });
        } else if (
          itemKind === "lib_rail" ||
          itemKind === "rail" ||
          itemKind === "hanging_rail"
        ) {
          // Logical wardrobe hanging zone: at least 350mm, and if dropped near top, place 80mm below top shelf/panel
          const clampedY = resolveCollisionFreeY(snappedY, 128, 320, netH - 64);
          bay.hangingRails = bay.hangingRails || [];
          bay.hangingRails.push({
            id: `rail_${safeBayIdx}_${Date.now()}`,
            bayIndex: safeBayIdx,
            elevationY: clampedY,
          });
        } else {
          // Special fittings: trouser_rack, shoe_rack, wire_basket, jewelry_tray, tie_rack, belt_rack, wardrobe_lift, led_profile
          let fittingType: import("@birim/core").SpecialFittingConfig["type"] = "trouser_rack";
          if (itemKind.includes("trouser")) fittingType = "trouser_rack";
          else if (itemKind.includes("shoe")) fittingType = "shoe_rack";
          else if (itemKind.includes("wire")) fittingType = "wire_basket";
          else if (itemKind.includes("jewelry")) fittingType = "jewelry_tray";
          else if (itemKind.includes("tie")) fittingType = "tie_rack";
          else if (itemKind.includes("belt")) fittingType = "belt_rack";
          else if (itemKind.includes("lift")) fittingType = "wardrobe_lift";
          else if (itemKind.includes("led")) fittingType = "led_profile";

          const clampedY = resolveCollisionFreeY(snappedY, 96, 64, netH - 64);
          bay.specialFittings = bay.specialFittings || [];
          bay.specialFittings.push({
            id: `fit_${fittingType}_${safeBayIdx}_${Date.now()}`,
            bayIndex: safeBayIdx,
            elevationY: clampedY,
            type: fittingType,
            height: fittingType === "wardrobe_lift" ? 850 : 120,
          });
        }
        return mod;
      }, true);
    },
    [commitActiveModuleUpdate]
  );

  const setShelfElevation = useCallback(
    (bayIdx: number, shelfId: string, elevationY: number, pushHistory = true) => {
      commitActiveModuleUpdate((mod) => {
        const netH = calculateNetInnerHeight(mod);
        const T = mod.carcass.panelThickness || 18;
        const clampedY = Math.max(60, Math.min(Math.max(100, netH - 60), Math.round(elevationY)));
        const bay = mod.bays[bayIdx];
        if (!bay) return mod;
        bay.shelves = bay.shelves.map((s) =>
          s.id === shelfId ? { ...s, elevationY: clampedY } : s
        );
        // Automatically re-snap any sub-dividers in this bay so they stay flush between shelves
        if (bay.subDividers && bay.subDividers.length > 0) {
          const ivs = getBayShelfIntervalsForSubDivider(bay, netH, T);
          const freeIvs = ivs.filter((iv) => !iv.hasConflict);
          const pool = freeIvs.length > 0 ? freeIvs : ivs;
          if (pool.length > 0) {
            bay.subDividers = bay.subDividers.map((sd) => {
              const midY = sd.elevationY + sd.height / 2;
              const best = pool.reduce((b, iv) =>
                Math.abs((iv.botY + iv.topY) / 2 - midY) < Math.abs((b.botY + b.topY) / 2 - midY)
                  ? iv
                  : b
              );
              return { ...sd, elevationY: best.botY, height: best.height };
            });
          }
        }
        return mod;
      }, pushHistory);
    },
    [commitActiveModuleUpdate]
  );

  /**
   * Update Drawer Elevation Y and/or Front Height (in mm) by manual drag or exact numeric input
   */
  const setDrawerPlacement = useCallback(
    (
      bayIdx: number,
      drawerId: string,
      newElevationY?: number,
      newHeight?: number,
      pushHistory = true,
      hardwareUpdates?: {
        hardwareProductId?: string;
        nominalLengthMm?: number;
        isInternal?: boolean;
      }
    ) => {
      commitActiveModuleUpdate((mod) => {
        const netH = calculateNetInnerHeight(mod);
        const bay = mod.bays[bayIdx];
        if (!bay) return mod;
        bay.drawers = bay.drawers.map((d) => {
          if (d.id !== drawerId) return d;
          const h =
            typeof newHeight === "number"
              ? Math.max(100, Math.min(420, Math.round(newHeight)))
              : d.height;
          const y =
            typeof newElevationY === "number"
              ? Math.max(0, Math.min(Math.max(0, netH - h), Math.round(newElevationY)))
              : d.elevationY;
          return {
            ...d,
            elevationY: y,
            height: h,
            ...(hardwareUpdates || {}),
          };
        });
        return mod;
      }, pushHistory);
    },
    [commitActiveModuleUpdate]
  );

  const addSpecialFitting = useCallback(
    (
      bayIdx: number,
      fittingType: import("@birim/core").SpecialFittingConfig["type"]
    ) => {
      if (fittingType.startsWith("led_")) {
        // Multi-door / multi-bay cabinets: add recessed LED across ALL bays of the module!
        commitActiveModuleUpdate((mod) => {
          const netH = calculateNetInnerHeight(mod);
          const bayWidths = calculateBayWidths(mod);
          mod.bays.forEach((b, bIdx) => {
            b.specialFittings = b.specialFittings || [];
            if (!b.specialFittings.some((f) => f.type === fittingType)) {
              const bw = bayWidths[bIdx] || 500;
              b.specialFittings.push({
                id: `fit_${fittingType}_${mod.id}_${bIdx}_${Date.now()}`,
                bayIndex: bIdx,
                elevationY:
                  fittingType === "led_rod_strip"
                    ? Math.max(300, netH - 120)
                    : fittingType === "led_profile"
                    ? Math.max(200, netH - 20)
                    : 20,
                type: fittingType,
                height: fittingType === "led_vertical_strip" ? Math.max(160, netH - 24) : 16,
                width: fittingType === "led_vertical_strip" ? 14 : Math.max(60, bw - 12),
                depth: fittingType === "led_vertical_strip" ? 75 : 18,
              });
            }
          });
          return mod;
        }, true);
        return;
      }
      addSpecialFittingStore(bayIdx, fittingType);
    },
    [commitActiveModuleUpdate, addSpecialFittingStore]
  );

  const setSpecialFittingPlacement = useCallback(
    (
      bayIdx: number,
      fittingId: string,
      updates: { elevationY?: number; height?: number; width?: number; depth?: number },
      pushHistory = true
    ) => {
      commitActiveModuleUpdate((mod) => {
        const netH = calculateNetInnerHeight(mod);
        const bay = mod.bays[bayIdx];
        if (!bay || !bay.specialFittings) return mod;
        const targetFit = bay.specialFittings.find((f) => f.id === fittingId);
        const isLed = targetFit?.type.startsWith("led_");
        mod.bays.forEach((b, bIdx) => {
          if (!b.specialFittings) return;
          b.specialFittings = b.specialFittings.map((f) => {
            if (bIdx === bayIdx ? f.id !== fittingId : !(isLed && f.type === targetFit?.type)) {
              return f;
            }
            const nextH =
              typeof updates.height === "number"
                ? Math.max(4, Math.min(netH, Math.round(updates.height)))
                : f.height;
            const nextY =
              typeof updates.elevationY === "number"
                ? Math.max(0, Math.min(Math.max(0, netH - nextH), Math.round(updates.elevationY)))
                : f.elevationY;
            const nextW =
              typeof updates.width === "number"
                ? Math.max(6, Math.min(2400, Math.round(updates.width)))
                : f.width;
            const nextD =
              typeof updates.depth === "number"
                ? Math.max(6, Math.min(850, Math.round(updates.depth)))
                : f.depth;
            return { ...f, elevationY: nextY, height: nextH, width: nextW, depth: nextD };
          });
        });
        return mod;
      }, pushHistory);
    },
    [commitActiveModuleUpdate]
  );

  /**
   * Update Hanging Rail Elevation Y (in mm from inner bottom panel)
   */
  const setHangingRailElevation = useCallback(
    (bayIdx: number, railId: string, elevationY: number, pushHistory = true) => {
      commitActiveModuleUpdate((mod) => {
        const netH = calculateNetInnerHeight(mod);
        const clampedY = Math.max(300, Math.min(Math.max(400, netH - 40), Math.round(elevationY)));
        const bay = mod.bays[bayIdx];
        if (!bay) return mod;
        bay.hangingRails = bay.hangingRails.map((r) =>
          r.id === railId ? { ...r, elevationY: clampedY } : r
        );
        return mod;
      }, pushHistory);
    },
    [commitActiveModuleUpdate]
  );

  /**
   * Update Bay Custom Width (in mm) or reset all bays to equal widths, or drag intermediate divider
   */
  const setBayCustomWidth = useCallback(
    (bayIdx: number, newWidthMm: number | null, pushHistory = true) => {
      commitActiveModuleUpdate((mod) => {
        if (mod.bays.length < 2) return mod;
        if (newWidthMm === null) {
          mod.bays = mod.bays.map((b) => ({ ...b, customWidth: undefined }));
          return mod;
        }
        const currentWidths = calculateBayWidths(mod);
        const targetBay = mod.bays[bayIdx];
        if (!targetBay) return mod;

        const neighborIdx = bayIdx < mod.bays.length - 1 ? bayIdx + 1 : bayIdx - 1;
        const pairTotal = (currentWidths[bayIdx] || 0) + (currentWidths[neighborIdx] || 0);
        const minBayW = 220;
        const clampedW = Math.max(
          minBayW,
          Math.min(Math.max(minBayW, pairTotal - minBayW), Math.round(newWidthMm))
        );
        const neighborW = Math.max(minBayW, pairTotal - clampedW);

        mod.bays = mod.bays.map((b, i) => {
          if (i === bayIdx) return { ...b, customWidth: clampedW };
          if (i === neighborIdx) return { ...b, customWidth: neighborW };
          return { ...b, customWidth: currentWidths[i] };
        });
        return mod;
      }, pushHistory);
    },
    [commitActiveModuleUpdate]
  );

  /**
   * Move an internal element (Shelf, Drawer, Hanging Rail) between bays (Left/Right Bay transfer)
   */
  const moveInteriorItemToBay = useCallback(
    (
      itemType: "shelf" | "drawer" | "rail",
      fromBayIdx: number,
      itemId: string,
      toBayIdx: number
    ) => {
      if (fromBayIdx === toBayIdx) return;
      commitActiveModuleUpdate((mod) => {
        const srcBay = mod.bays[fromBayIdx];
        const dstBay = mod.bays[toBayIdx];
        if (!srcBay || !dstBay) return mod;

        if (itemType === "shelf") {
          const item = srcBay.shelves.find((s) => s.id === itemId);
          if (!item) return mod;
          srcBay.shelves = srcBay.shelves.filter((s) => s.id !== itemId);
          dstBay.shelves.push({ ...item, bayIndex: toBayIdx });
        } else if (itemType === "drawer") {
          const item = srcBay.drawers.find((d) => d.id === itemId);
          if (!item) return mod;
          srcBay.drawers = srcBay.drawers.filter((d) => d.id !== itemId);
          dstBay.drawers.push({ ...item, bayIndex: toBayIdx });
        } else if (itemType === "rail") {
          const item = srcBay.hangingRails.find((r) => r.id === itemId);
          if (!item) return mod;
          srcBay.hangingRails = srcBay.hangingRails.filter((r) => r.id !== itemId);
          dstBay.hangingRails.push({ ...item, bayIndex: toBayIdx });
        }
        return mod;
      }, true);
      setActiveBayIndex(toBayIdx);
    },
    [commitActiveModuleUpdate, setActiveBayIndex]
  );

  /**
   * Add a partial vertical sub-divider (Raf Arası Dikme) automatically spanning between shelves
   */
  const addSubDivider = useCallback(
    (bayIdx: number, customSpan?: { elevationY: number; height: number; offsetX?: number }) => {
      commitActiveModuleUpdate((mod) => {
        const bay = mod.bays[bayIdx];
        if (!bay) return mod;
        const bayWidths = calculateBayWidths(mod);
        const bayW = bayWidths[bayIdx] || 600;
        const netH = calculateNetInnerHeight(mod);
        const T = mod.carcass.panelThickness || 18;
        const intervals = getBayShelfIntervalsForSubDivider(bay, netH, T);
        const freeIntervals = intervals.filter((iv) => !iv.hasConflict);

        let elevY = 0;
        let spanH = Math.min(350, netH);
        if (customSpan && typeof customSpan.elevationY === "number" && typeof customSpan.height === "number") {
          elevY = Math.max(0, Math.round(customSpan.elevationY));
          spanH = Math.max(60, Math.min(netH - elevY, Math.round(customSpan.height)));
          // Ensure customSpan does not collide with a hanging rail or drawer
          const customMidY = elevY + spanH / 2;
          const matchingIv = intervals.find((iv) => customMidY >= iv.botY && customMidY <= iv.topY);
          if (matchingIv?.hasConflict) {
            if (freeIntervals.length === 0) return mod;
            elevY = freeIntervals[0].botY;
            spanH = freeIntervals[0].height;
          }
        } else {
          if (freeIntervals.length === 0) {
            // No conflict-free shelf interval exists in this bay (e.g. hanging rail occupies the bay)
            return mod;
          }
          // Prefer a conflict-free interval that does not yet have a sub-divider, or the first conflict-free interval
          const unoccupiedFreeIv =
            freeIntervals.find(
              (iv) => !(bay.subDividers || []).some((sd) => Math.abs(sd.elevationY - iv.botY) <= 15)
            ) || freeIntervals[0];
          elevY = unoccupiedFreeIv.botY;
          spanH = Math.max(80, unoccupiedFreeIv.height);
        }

        const existingInSameSpan = (bay.subDividers || []).filter(
          (sd) => Math.abs(sd.elevationY - elevY) <= 15
        ).length;
        const defaultOffsetX =
          typeof customSpan?.offsetX === "number"
            ? customSpan.offsetX
            : Math.round(bayW / 2 - T / 2 + (existingInSameSpan % 2 === 1 ? 90 : existingInSameSpan > 0 ? -90 : 0));
        const clampedX = Math.max(50, Math.min(Math.max(80, bayW - T - 50), defaultOffsetX));

        if (!bay.subDividers) bay.subDividers = [];
        bay.subDividers.push({
          id: `subdiv_${bayIdx}_${Date.now()}_${bay.subDividers.length}`,
          bayIndex: bayIdx,
          offsetX: clampedX,
          elevationY: elevY,
          height: spanH,
          thickness: T,
        });
        return mod;
      }, true);
    },
    [commitActiveModuleUpdate]
  );

  /**
   * Update a partial vertical sub-divider's horizontal offsetX, bottom elevationY, span height, or targetMidY (vertical drag across shelf intervals!)
   */
  const setSubDividerPlacement = useCallback(
    (
      bayIdx: number,
      subDividerId: string,
      updates: { offsetX?: number; elevationY?: number; height?: number; targetMidY?: number },
      pushHistory = true
    ) => {
      commitActiveModuleUpdate((mod) => {
        const bay = mod.bays[bayIdx];
        if (!bay || !bay.subDividers) return mod;
        const bayWidths = calculateBayWidths(mod);
        const bayW = bayWidths[bayIdx] || 600;
        const netH = calculateNetInnerHeight(mod);
        const T = mod.carcass.panelThickness || 18;
        const intervals = getBayShelfIntervalsForSubDivider(bay, netH, T);
        const freeIntervals = intervals.filter((iv) => !iv.hasConflict);

        bay.subDividers = bay.subDividers.map((sd) => {
          if (sd.id !== subDividerId) return sd;
          const nextX =
            typeof updates.offsetX === "number"
              ? Math.max(40, Math.min(Math.max(60, bayW - T - 40), Math.round(updates.offsetX)))
              : sd.offsetX;

          // If targetMidY is provided (user is dragging the sub-divider vertically in 2D Elevation or 3D),
          // snap it to the conflict-free shelf interval containing or nearest to targetMidY!
          if (typeof updates.targetMidY === "number" && freeIntervals.length > 0) {
            const midY = updates.targetMidY;
            const containingIv = freeIntervals.find(
              (iv) => midY >= iv.botY - 18 && midY <= iv.topY + 18
            );
            const bestIv =
              containingIv ||
              freeIntervals.reduce((best, iv) =>
                Math.abs((iv.botY + iv.topY) / 2 - midY) <
                Math.abs((best.botY + best.topY) / 2 - midY)
                  ? iv
                  : best
              );
            return {
              ...sd,
              offsetX: nextX,
              elevationY: bestIv.botY,
              height: Math.max(80, bestIv.height),
            };
          }

          let nextH =
            typeof updates.height === "number"
              ? Math.max(80, Math.min(netH, Math.round(updates.height)))
              : sd.height;
          let nextY =
            typeof updates.elevationY === "number"
              ? Math.max(0, Math.min(Math.max(0, netH - nextH), Math.round(updates.elevationY)))
              : sd.elevationY;

          // Prevent manual Y input from placing the sub-divider inside an interval with a hanging rail or drawer
          const checkMidY = nextY + nextH / 2;
          const hitConflict = intervals.find(
            (iv) => iv.hasConflict && checkMidY >= iv.botY && checkMidY <= iv.topY
          );
          if (hitConflict && freeIntervals.length > 0) {
            const nearestFree = freeIntervals.reduce((best, iv) =>
              Math.abs((iv.botY + iv.topY) / 2 - checkMidY) <
              Math.abs((best.botY + best.topY) / 2 - checkMidY)
                ? iv
                : best
            );
            nextY = nearestFree.botY;
            nextH = Math.max(80, nearestFree.height);
          }

          return { ...sd, offsetX: nextX, elevationY: nextY, height: nextH };
        });
        return mod;
      }, pushHistory);
    },
    [commitActiveModuleUpdate]
  );

  /**
   * Remove a partial vertical sub-divider
   */
  const removeSubDivider = useCallback(
    (bayIdx: number, subDividerId: string) => {
      commitActiveModuleUpdate((mod) => {
        const bay = mod.bays[bayIdx];
        if (!bay || !bay.subDividers) return mod;
        bay.subDividers = bay.subDividers.filter((sd) => sd.id !== subDividerId);
        return mod;
      }, true);
    },
    [commitActiveModuleUpdate]
  );

  /**
   * Remove module at a specific index (keeps at least 1 module in the project)
   */

  /**
   * Apply an instant interior layout preset to ONLY the selected compartment (bayIdx)
   * for the 3D Wardrobe Compartment Workflow (Shelves, Double Rail, Rail+Drawers, Trouser Rack, Shoe Tower).
   */
  const applyBayInteriorPreset = useCallback(
    (
      bayIdx: number,
      presetId:
        | "shelves_5"
        | "rail_double"
        | "rail_drawers_3"
        | "rail_trouser"
        | "shoe_tower"
        | "shirt_shelf"
        | "dress_drawer"
        | "mixed_combo"
    ) => {
      commitActiveModuleUpdate((mod) => {
        const bay = mod.bays[bayIdx];
        if (!bay) return mod;
        const netH = calculateNetInnerHeight(mod);
        const bayWidths = calculateBayWidths(mod);
        const bw = bayWidths[bayIdx] || 550;

        bay.shelves = [];
        bay.drawers = [];
        bay.hangingRails = [];
        bay.specialFittings = (bay.specialFittings || []).filter((f) => f.type.startsWith("led_"));

        if (presetId === "shelves_5") {
          const count = 5;
          const step = Math.round(netH / (count + 1));
          for (let i = 1; i <= count; i++) {
            bay.shelves.push({
              id: `${mod.id}_b${bayIdx}_sh_${i}_${Date.now()}`,
              bayIndex: bayIdx,
              elevationY: Math.min(netH - 80, Math.max(80, i * step)),
              isAdjustable: i !== 2,
            });
          }
        } else if (presetId === "rail_double") {
          const midShelfY = Math.round(netH * 0.5);
          const topShelfY = Math.min(netH - 180, Math.round(netH * 0.86));
          bay.shelves.push(
            {
              id: `${mod.id}_b${bayIdx}_sh_mid_${Date.now()}`,
              bayIndex: bayIdx,
              elevationY: midShelfY,
              isAdjustable: false,
            },
            {
              id: `${mod.id}_b${bayIdx}_sh_top_${Date.now()}`,
              bayIndex: bayIdx,
              elevationY: topShelfY,
              isAdjustable: true,
            }
          );
          bay.hangingRails.push(
            {
              id: `${mod.id}_b${bayIdx}_rail_low_${Date.now()}`,
              bayIndex: bayIdx,
              elevationY: Math.max(320, midShelfY - 70),
            },
            {
              id: `${mod.id}_b${bayIdx}_rail_high_${Date.now()}`,
              bayIndex: bayIdx,
              elevationY: Math.max(400, topShelfY - 70),
            }
          );
        } else if (presetId === "rail_drawers_3") {
          const drwH = 180;
          for (let i = 0; i < 3; i++) {
            bay.drawers.push({
              id: `${mod.id}_b${bayIdx}_drw_${i}_${Date.now()}`,
              bayIndex: bayIdx,
              elevationY: i * drwH,
              height: drwH,
              slideType: "soft_close",
              hardwareProductId: "hw_blum_legrabox_m40",
            });
          }
          const coverShelfY = 3 * drwH + 18;
          const topShelfY = Math.min(netH - 180, Math.round(netH * 0.84));
          bay.shelves.push(
            {
              id: `${mod.id}_b${bayIdx}_sh_cov_${Date.now()}`,
              bayIndex: bayIdx,
              elevationY: coverShelfY,
              isAdjustable: false,
            },
            {
              id: `${mod.id}_b${bayIdx}_sh_top_${Date.now()}`,
              bayIndex: bayIdx,
              elevationY: topShelfY,
              isAdjustable: true,
            }
          );
          bay.hangingRails.push({
            id: `${mod.id}_b${bayIdx}_rail_main_${Date.now()}`,
            bayIndex: bayIdx,
            elevationY: Math.max(400, topShelfY - 70),
          });
        } else if (presetId === "rail_trouser") {
          const midShelfY = Math.round(netH * 0.42);
          const topShelfY = Math.min(netH - 180, Math.round(netH * 0.84));
          bay.shelves.push(
            {
              id: `${mod.id}_b${bayIdx}_sh_mid_${Date.now()}`,
              bayIndex: bayIdx,
              elevationY: midShelfY,
              isAdjustable: false,
            },
            {
              id: `${mod.id}_b${bayIdx}_sh_top_${Date.now()}`,
              bayIndex: bayIdx,
              elevationY: topShelfY,
              isAdjustable: true,
            }
          );
          bay.hangingRails.push({
            id: `${mod.id}_b${bayIdx}_rail_top_${Date.now()}`,
            bayIndex: bayIdx,
            elevationY: Math.max(400, topShelfY - 70),
          });
          bay.specialFittings.push({
            id: `fit_trouser_rack_${mod.id}_${bayIdx}_${Date.now()}`,
            bayIndex: bayIdx,
            type: "trouser_rack",
            elevationY: Math.max(120, midShelfY - 120),
            height: 90,
            width: Math.max(200, bw - 36),
            depth: Math.max(300, mod.dimensions.depth - 80),
          });
        } else if (presetId === "shoe_tower") {
          for (let i = 0; i < 3; i++) {
            bay.specialFittings.push({
              id: `fit_shoe_rack_${mod.id}_${bayIdx}_${i}_${Date.now()}`,
              bayIndex: bayIdx,
              type: "shoe_rack",
              elevationY: 120 + i * 220,
              height: 110,
              width: Math.max(200, bw - 36),
              depth: Math.max(300, mod.dimensions.depth - 80),
            });
          }
          const startShelfY = 820;
          const topCount = 3;
          const step = Math.round((netH - startShelfY) / (topCount + 1));
          for (let i = 1; i <= topCount; i++) {
            bay.shelves.push({
              id: `${mod.id}_b${bayIdx}_sh_shoe_${i}_${Date.now()}`,
              bayIndex: bayIdx,
              elevationY: Math.min(netH - 80, startShelfY + i * step),
              isAdjustable: i !== 1,
            });
          }
        } else if (presetId === "shirt_shelf") {
          // Gömlek + Raf: Üst askılık + 3 alt istif rafı
          const topShelfY = Math.min(netH - 180, Math.round(netH * 0.85));
          const midShelfY = Math.round(netH * 0.44);
          bay.shelves.push(
            {
              id: `${mod.id}_b${bayIdx}_sh_shirt_1_${Date.now()}`,
              bayIndex: bayIdx,
              elevationY: Math.round(midShelfY * 0.35),
              isAdjustable: true,
            },
            {
              id: `${mod.id}_b${bayIdx}_sh_shirt_2_${Date.now()}`,
              bayIndex: bayIdx,
              elevationY: Math.round(midShelfY * 0.68),
              isAdjustable: true,
            },
            {
              id: `${mod.id}_b${bayIdx}_sh_shirt_3_${Date.now()}`,
              bayIndex: bayIdx,
              elevationY: midShelfY,
              isAdjustable: false,
            },
            {
              id: `${mod.id}_b${bayIdx}_sh_shirt_top_${Date.now()}`,
              bayIndex: bayIdx,
              elevationY: topShelfY,
              isAdjustable: true,
            }
          );
          bay.hangingRails.push({
            id: `${mod.id}_b${bayIdx}_rail_shirt_${Date.now()}`,
            bayIndex: bayIdx,
            elevationY: Math.max(400, topShelfY - 65),
          });
        } else if (presetId === "dress_drawer") {
          // Elbise + Çekmece: Uzun elbise askılığı + 2 alt çekmece + üst raf
          const drwH = 200;
          for (let i = 0; i < 2; i++) {
            bay.drawers.push({
              id: `${mod.id}_b${bayIdx}_drw_dress_${i}_${Date.now()}`,
              bayIndex: bayIdx,
              elevationY: i * drwH,
              height: drwH,
              slideType: "soft_close",
              hardwareProductId: "hw_blum_legrabox_m40",
            });
          }
          const coverShelfY = 2 * drwH + 18;
          const topShelfY = Math.min(netH - 180, Math.round(netH * 0.85));
          bay.shelves.push(
            {
              id: `${mod.id}_b${bayIdx}_sh_dress_cov_${Date.now()}`,
              bayIndex: bayIdx,
              elevationY: coverShelfY,
              isAdjustable: false,
            },
            {
              id: `${mod.id}_b${bayIdx}_sh_dress_top_${Date.now()}`,
              bayIndex: bayIdx,
              elevationY: topShelfY,
              isAdjustable: true,
            }
          );
          bay.hangingRails.push({
            id: `${mod.id}_b${bayIdx}_rail_dress_${Date.now()}`,
            bayIndex: bayIdx,
            elevationY: Math.max(500, topShelfY - 65),
          });
        } else if (presetId === "mixed_combo") {
          // Karma Düzen: Üst raf + Askılık + Pantolonluk + Alt çekmece
          const drwH = 200;
          bay.drawers.push({
            id: `${mod.id}_b${bayIdx}_drw_mix_0_${Date.now()}`,
            bayIndex: bayIdx,
            elevationY: 0,
            height: drwH,
            slideType: "soft_close",
            hardwareProductId: "hw_blum_legrabox_m40",
          });
          const coverShelfY = drwH + 18;
          const midShelfY = Math.round(netH * 0.46);
          const topShelfY = Math.min(netH - 180, Math.round(netH * 0.85));
          bay.shelves.push(
            {
              id: `${mod.id}_b${bayIdx}_sh_mix_cov_${Date.now()}`,
              bayIndex: bayIdx,
              elevationY: coverShelfY,
              isAdjustable: false,
            },
            {
              id: `${mod.id}_b${bayIdx}_sh_mix_mid_${Date.now()}`,
              bayIndex: bayIdx,
              elevationY: midShelfY,
              isAdjustable: false,
            },
            {
              id: `${mod.id}_b${bayIdx}_sh_mix_top_${Date.now()}`,
              bayIndex: bayIdx,
              elevationY: topShelfY,
              isAdjustable: true,
            }
          );
          bay.hangingRails.push({
            id: `${mod.id}_b${bayIdx}_rail_mix_${Date.now()}`,
            bayIndex: bayIdx,
            elevationY: Math.max(450, topShelfY - 65),
          });
          bay.specialFittings.push({
            id: `fit_trouser_rack_${mod.id}_${bayIdx}_${Date.now()}`,
            bayIndex: bayIdx,
            type: "trouser_rack",
            elevationY: Math.max(coverShelfY + 110, midShelfY - 110),
            height: 90,
            width: Math.max(200, bw - 36),
            depth: Math.max(300, mod.dimensions.depth - 80),
          });
        }
        return mod;
      }, true);
    },
    [commitActiveModuleUpdate]
  );

  /**
   * Toggle visibility (isHidden) of an individual interior component in 3D while preserving its data
   */
  const toggleInteriorItemHidden = useCallback(
    (
      bayIdx: number,
      kind: "shelf" | "rail" | "drawer" | "fitting",
      itemId: string
    ) => {
      commitActiveModuleUpdate((mod) => {
        const bay = mod.bays[bayIdx];
        if (!bay) return mod;
        if (kind === "shelf") {
          bay.shelves = bay.shelves.map((s) =>
            s.id === itemId ? { ...s, isHidden: !s.isHidden } : s
          );
        } else if (kind === "rail") {
          bay.hangingRails = bay.hangingRails.map((r) =>
            r.id === itemId ? { ...r, isHidden: !r.isHidden } : r
          );
        } else if (kind === "drawer") {
          bay.drawers = bay.drawers.map((d) =>
            d.id === itemId ? { ...d, isHidden: !d.isHidden } : d
          );
        } else if (kind === "fitting") {
          bay.specialFittings = (bay.specialFittings || []).map((f) =>
            f.id === itemId ? { ...f, isHidden: !f.isHidden } : f
          );
        }
        return mod;
      }, true);
    },
    [commitActiveModuleUpdate]
  );

  /**
   * Update thickness of a specific shelf or all shelves in the selected compartment (18 / 22 / 25 / 36 mm)
   */
  const setShelfThickness = useCallback(
    (bayIdx: number, shelfId: string | "all", thicknessMm: number) => {
      const clampedT = [18, 22, 25, 36].includes(thicknessMm) ? thicknessMm : 18;
      commitActiveModuleUpdate((mod) => {
        const bay = mod.bays[bayIdx];
        if (!bay) return mod;
        bay.shelves = bay.shelves.map((s) =>
          shelfId === "all" || s.id === shelfId ? { ...s, thickness: clampedT } : s
        );
        return mod;
      }, true);
    },
    [commitActiveModuleUpdate]
  );

  /**
   * Equalize all bay widths AND distribute shelves evenly across the usable vertical span of the selected bay
   */
  const equalizeBaysAndShelves = useCallback(
    (bayIdx?: number) => {
      commitActiveModuleUpdate((mod) => {
        const netH = calculateNetInnerHeight(mod);
        const T_p = mod.carcass.panelThickness || 18;
        mod.bays = mod.bays.map((b, idx) => {
          const nextBay = { ...b, customWidth: undefined };
          if ((typeof bayIdx !== "number" || idx === bayIdx) && nextBay.shelves.length > 0) {
            const maxDrawerTop =
              nextBay.drawers.length > 0
                ? Math.max(...nextBay.drawers.map((d) => d.elevationY + d.height)) + T_p
                : 0;
            const usableH = Math.max(160, netH - maxDrawerTop);
            const cnt = nextBay.shelves.length;
            const stepY = usableH / (cnt + 1);
            const sorted = [...nextBay.shelves].sort((a, z) => a.elevationY - z.elevationY);
            sorted.forEach((s, sIdx) => {
              s.elevationY = Math.max(
                60,
                Math.min(netH - 60, Math.round((maxDrawerTop + stepY * (sIdx + 1)) / 10) * 10)
              );
            });
            nextBay.shelves = sorted;
          }
          return nextBay;
        });
        return mod;
      }, true);
    },
    [commitActiveModuleUpdate]
  );

  /**
   * Add an internal pull-out drawer (İç Çekmece — behind hinged/sliding doors) in the selected bay
   */
  const addInternalDrawer = useCallback(
    (bayIdx: number, heightMm = 140) => {
      commitActiveModuleUpdate((mod) => {
        const bay = mod.bays[bayIdx];
        if (!bay) return mod;
        const netH = calculateNetInnerHeight(mod);
        const T_p = mod.carcass.panelThickness || 18;
        const clampedH = Math.max(80, Math.min(240, Math.round(heightMm)));
        const maxTop =
          bay.drawers.length > 0
            ? Math.max(...bay.drawers.map((d) => d.elevationY + d.height))
            : 0;
        if (maxTop + clampedH > netH - 120) return mod;
        bay.drawers.push({
          id: `${mod.id}_b${bayIdx}_intdrw_${bay.drawers.length}_${Date.now()}`,
          bayIndex: bayIdx,
          elevationY: maxTop,
          height: clampedH,
          slideType: "soft_close",
          isInternal: true,
          hardwareProductId: "hw_blum_legrabox_m40",
        });
        const newCoverY = maxTop + clampedH + 4;
        const hasCoverShelf = bay.shelves.some(
          (s) => Math.abs(s.elevationY - newCoverY) <= 35
        );
        if (!hasCoverShelf && newCoverY < netH - 120) {
          bay.shelves.push({
            id: `${mod.id}_b${bayIdx}_intcov_${Date.now()}`,
            bayIndex: bayIdx,
            elevationY: newCoverY,
            thickness: T_p,
            isAdjustable: false,
          });
        }
        return mod;
      }, true);
    },
    [commitActiveModuleUpdate]
  );

  /**
   * Merge a bay into its neighbor by removing the vertical divider while KEEPING outer cabinet width constant.
   * Automatically upgrades single hinged doors to double doors if the merged span exceeds 650 mm.
   */
  const removeBayAt = useCallback(
    (bayIdx: number) => {
      commitActiveModuleUpdate((mod) => {
        if (mod.bays.length <= 1) return mod;
        const targetIdx = Math.max(0, Math.min(mod.bays.length - 1, bayIdx));
        mod.bays.splice(targetIdx, 1);
        mod.bays = mod.bays.map((b, idx) => ({
          ...b,
          index: idx,
          customWidth: undefined,
          door: { ...b.door, bayIndex: idx, id: `${mod.id}_door_${idx}` },
          shelves: (b.shelves || []).map((s) => ({ ...s, bayIndex: idx })),
          hangingRails: (b.hangingRails || []).map((r) => ({ ...r, bayIndex: idx })),
          drawers: (b.drawers || []).map((d) => ({ ...d, bayIndex: idx })),
          specialFittings: (b.specialFittings || []).map((f) => ({ ...f, bayIndex: idx })),
          subDividers: (b.subDividers || []).map((sd) => ({ ...sd, bayIndex: idx })),
        }));
        const postFourSpace = calculateFourSpaceDimensions(mod);
        mod.bays = mod.bays.map((b, idx) => {
          const newClearW = postFourSpace.usableInternal.bayClearWidthsMm[idx] || 600;
          const dType = b.door?.type;
          if (newClearW > 650 && (dType === "single_left" || dType === "single_right")) {
            return {
              ...b,
              door: {
                ...b.door,
                type: "double",
                doorSystemId: "hinged_double",
              },
            };
          }
          return b;
        });
        return mod;
      }, true);
      setSelectedComponentId(null);
      const st = useConfiguratorStore.getState();
      const mod = st.project.modules[st.activeModuleIndex];
      if (mod) {
        setActiveBayIndex(Math.max(0, Math.min(bayIdx, mod.bays.length - 1)));
      }
    },
    [commitActiveModuleUpdate, setActiveBayIndex, setSelectedComponentId]
  );

  /**
   * Remove a specific bay/compartment AND shrink the cabinet's outer width by that bay's clear width + 1 divider thickness.
   * Preserves the widths and door configurations of all remaining compartments.
   */
  const removeBayAndShrinkModule = useCallback(
    (bayIdx: number) => {
      commitActiveModuleUpdate((mod) => {
        if (mod.bays.length <= 1) return mod;
        const targetIdx = Math.max(0, Math.min(mod.bays.length - 1, bayIdx));
        const preFourSpace = calculateFourSpaceDimensions(mod);
        const clearWidths = preFourSpace.usableInternal.bayClearWidthsMm;
        const panelT = mod.carcass.panelThickness || 18;
        const removedClearW =
          clearWidths[targetIdx] ||
          Math.max(300, Math.round((mod.dimensions.width - (mod.bays.length + 1) * panelT) / mod.bays.length));
        const remainingClearWidths = clearWidths.filter((_, i) => i !== targetIdx);

        mod.bays.splice(targetIdx, 1);
        const nextOuterWidth = Math.max(
          350,
          Math.round(mod.dimensions.width - (removedClearW + panelT))
        );
        mod.dimensions.width = nextOuterWidth;

        const singleRemaining = mod.bays.length === 1;
        mod.bays = mod.bays.map((b, idx) => ({
          ...b,
          index: idx,
          customWidth: singleRemaining ? undefined : remainingClearWidths[idx],
          door: { ...b.door, bayIndex: idx, id: `${mod.id}_door_${idx}` },
          shelves: (b.shelves || []).map((s) => ({ ...s, bayIndex: idx })),
          hangingRails: (b.hangingRails || []).map((r) => ({ ...r, bayIndex: idx })),
          drawers: (b.drawers || []).map((d) => ({ ...d, bayIndex: idx })),
          specialFittings: (b.specialFittings || []).map((f) => ({ ...f, bayIndex: idx })),
          subDividers: (b.subDividers || []).map((sd) => ({ ...sd, bayIndex: idx })),
        }));
        return mod;
      }, true);
      setSelectedComponentId(null);
      const st = useConfiguratorStore.getState();
      const mod = st.project.modules[st.activeModuleIndex];
      if (mod) {
        setActiveBayIndex(Math.max(0, Math.min(bayIdx, mod.bays.length - 1)));
      }
    },
    [commitActiveModuleUpdate, setActiveBayIndex, setSelectedComponentId]
  );

  /**
   * Convert a wide double-door compartment (e.g. 1171 mm in a 3-door 180 cm wardrobe) into a single-door compartment
   * and narrow the cabinet's outer width by half of that compartment's clear width (e.g. 180 cm -> 121 cm, 3 doors -> 2 doors).
   */
  const shrinkDoubleBayToSingle = useCallback(
    (bayIdx: number) => {
      commitActiveModuleUpdate((mod) => {
        const targetIdx = Math.max(0, Math.min(mod.bays.length - 1, bayIdx));
        const targetBay = mod.bays[targetIdx];
        if (!targetBay) return mod;
        const preFourSpace = calculateFourSpaceDimensions(mod);
        const clearWidths = preFourSpace.usableInternal.bayClearWidthsMm;
        const curClearW = clearWidths[targetIdx] || 900;
        if (curClearW < 760) return mod;

        const nextBayClearW = Math.max(400, Math.round(curClearW * 0.5));
        const deltaW = curClearW - nextBayClearW;
        mod.dimensions.width = Math.max(400, Math.round(mod.dimensions.width - deltaW));

        const singleRemaining = mod.bays.length === 1;
        const preferredLeaf: "single_left" | "single_right" =
          targetIdx === 0 && mod.bays.length > 1 ? "single_left" : "single_right";

        mod.bays = mod.bays.map((b, idx) => {
          if (idx !== targetIdx) {
            return {
              ...b,
              customWidth: singleRemaining ? undefined : clearWidths[idx],
            };
          }
          return {
            ...b,
            customWidth: singleRemaining ? undefined : nextBayClearW,
            door: {
              ...b.door,
              type: b.door.type === "open" ? "open" : preferredLeaf,
              doorSystemId: b.door.type === "open" ? "open" : "hinged_single",
            },
          };
        });
        return mod;
      }, true);
      setSelectedComponentId(null);
    },
    [commitActiveModuleUpdate, setSelectedComponentId]
  );

  /**
   * Screen 5 (Donanım ve Mekanizmalar): Update Hinge Hardware SKU across active bay or all hinged bays,
   * automatically syncing drilling template and door thickness compatibility.
   */
  const setModuleHingeHardware = useCallback(
    (
      hardwareProductId: string,
      applyAllBays = true,
      softCloseOverride?: boolean
    ): { ok: boolean; error?: string } => {
      const st = useConfiguratorStore.getState();
      const mod = st.project.modules[st.activeModuleIndex] || st.project.modules[0];
      if (!mod) return { ok: false, error: "Aktif modül bulunamadı." };

      const hw = getHardwareProductById(hardwareProductId);
      const T_door =
        mod.bays[safeBayIndex]?.door.doorThicknessMm || mod.carcass.doorThickness || 18;
      if (hw?.doorThicknessLimitsMm) {
        const [minT, maxT] = hw.doorThicknessLimitsMm;
        if (T_door < minT || T_door > maxT) {
          return {
            ok: false,
            error: `"${hw.name}" menteşesi ${minT}–${maxT} mm kapak kalınlığını destekler (Mevcut kapak kalınlığı: ${T_door} mm). Lütfen kalın kapak menteşesi (95° / 165°) seçin veya kapak kalınlığını güncelleyin.`,
          };
        }
      }

      const drillTpl = getDrillingTemplateForHardware(hardwareProductId);
      commitActiveModuleUpdate((nextMod) => {
        nextMod.carcass.hingeDrillingTemplateId = drillTpl.id;
        nextMod.bays = nextMod.bays.map((b, bIdx) => {
          if (!applyAllBays && bIdx !== safeBayIndex) return b;
          const dSys = b.door.doorSystemId || "hinged_single";
          if (!dSys.startsWith("hinged")) return b;
          const nextSoftClose =
            typeof softCloseOverride === "boolean" ? softCloseOverride : b.door.softClose;
          return {
            ...b,
            door: {
              ...b.door,
              hardwareProductId,
              softClose: nextSoftClose,
              openingTechnology: nextSoftClose ? "soft_close" : "manual_standard",
            },
          };
        });
        return nextMod;
      }, true);
      return { ok: true };
    },
    [commitActiveModuleUpdate, safeBayIndex]
  );

  /**
   * Screen 5 (Donanım ve Mekanizmalar): Update Drawer Runner Hardware SKU and Nominal Length (NL)
   * with strict inner depth clearance validation (NL <= usableInnerDepthMm - 10).
   */
  const setModuleDrawerRunnerHardware = useCallback(
    (
      hardwareProductId: string,
      nominalLengthMm?: number,
      applyAllBays = true,
      slideTypeOverride?: import("@birim/core").DrawerConfig["slideType"]
    ): { ok: boolean; error?: string; appliedNlMm?: number } => {
      const st = useConfiguratorStore.getState();
      const mod = st.project.modules[st.activeModuleIndex] || st.project.modules[0];
      if (!mod) return { ok: false, error: "Aktif modül bulunamadı." };

      const fourSpace = calculateFourSpaceDimensions(mod);
      const netInnerDepth = fourSpace.usableInternal.netInnerDepthMm;
      const maxAllowedNl = netInnerDepth - 10;
      const targetNl =
        typeof nominalLengthMm === "number"
          ? nominalLengthMm
          : selectOptimalRunnerLengthMm(netInnerDepth);

      if (targetNl > maxAllowedNl) {
        return {
          ok: false,
          error: `Seçilen ray uzunluğu (NL ${targetNl} mm), modül net iç derinliğine (${netInnerDepth} mm, maks. izin verilen NL ${maxAllowedNl} mm) sığmıyor! Lütfen ≤ ${selectOptimalRunnerLengthMm(netInnerDepth)} mm ray seçin veya dolap derinliğini artırın.`,
        };
      }

      const drillingSetId = hardwareProductId.includes("hettich")
        ? "hettich_avantech"
        : hardwareProductId.includes("tandembox")
        ? "blum_tandembox"
        : hardwareProductId.includes("movento")
        ? "blum_movento"
        : "blum_legrabox";

      commitActiveModuleUpdate((nextMod) => {
        nextMod.carcass.drawerDrillingSetId = drillingSetId;
        nextMod.bays = nextMod.bays.map((b, bIdx) => {
          if (!applyAllBays && bIdx !== safeBayIndex) return b;
          return {
            ...b,
            drawers: b.drawers.map((d) => ({
              ...d,
              hardwareProductId,
              nominalLengthMm: targetNl,
              slideType: slideTypeOverride || d.slideType || "soft_close",
            })),
          };
        });
        return nextMod;
      }, true);
      return { ok: true, appliedNlMm: targetNl };
    },
    [commitActiveModuleUpdate, safeBayIndex]
  );

  /**
   * Screen 5 (Donanım ve Mekanizmalar): Toggle Cabinet LED Lighting on/off across the module
   * and update LED profile type, color temperature (3000K / 4000K), or sensor type.
   */
  const toggleModuleLedLighting = useCallback(
    (
      enabled: boolean,
      options?: {
        ledType?: "led_profile" | "led_vertical_strip" | "led_rod_strip" | "full_showcase";
        colorTempK?: 2700 | 3000 | 4000;
        sensorType?: "ir_door" | "pir_motion" | "manual_switch";
        dimmerPct?: number;
        frontSetbackMm?: number;
        shelfSetbackMm?: number;
        alignShelfAndSide?: boolean;
        channelWidthMm?: number;
        channelDepthMm?: number;
      }
    ) => {
      commitActiveModuleUpdate((mod) => {
        mod.carcass.ledLightingEnabled = enabled;
        if (options?.colorTempK) {
          mod.carcass.ledColorTempK = options.colorTempK;
        } else if (!mod.carcass.ledColorTempK) {
          mod.carcass.ledColorTempK = 3000;
        }
        if (options?.sensorType) {
          mod.carcass.ledSensorType = options.sensorType;
        } else if (!mod.carcass.ledSensorType) {
          mod.carcass.ledSensorType = "ir_door";
        }
        if (typeof options?.dimmerPct === "number") {
          mod.carcass.ledDimmerPct = options.dimmerPct;
        } else if (typeof mod.carcass.ledDimmerPct !== "number") {
          mod.carcass.ledDimmerPct = 100;
        }

        const pThick = mod.carcass.panelThickness || 18;
        const maxSafeSetback = Math.max(60, mod.dimensions.depth - 45);
        if (typeof options?.alignShelfAndSide === "boolean") {
          mod.carcass.ledAlignShelfAndSide = options.alignShelfAndSide;
        } else if (typeof mod.carcass.ledAlignShelfAndSide !== "boolean") {
          mod.carcass.ledAlignShelfAndSide = true;
        }
        if (typeof options?.frontSetbackMm === "number") {
          mod.carcass.ledFrontSetbackMm = Math.max(35, Math.min(maxSafeSetback, Math.round(options.frontSetbackMm)));
        } else if (typeof mod.carcass.ledFrontSetbackMm !== "number") {
          mod.carcass.ledFrontSetbackMm = 75;
        }
        if (typeof options?.shelfSetbackMm === "number") {
          mod.carcass.ledShelfSetbackMm = Math.max(35, Math.min(maxSafeSetback, Math.round(options.shelfSetbackMm)));
        } else if (typeof mod.carcass.ledShelfSetbackMm !== "number") {
          mod.carcass.ledShelfSetbackMm = mod.carcass.ledFrontSetbackMm;
        }
        if (mod.carcass.ledAlignShelfAndSide) {
          mod.carcass.ledShelfSetbackMm = mod.carcass.ledFrontSetbackMm;
        }
        if (typeof options?.channelWidthMm === "number") {
          mod.carcass.ledChannelWidthMm = Math.max(6, Math.min(32, Math.round(options.channelWidthMm)));
        } else if (typeof mod.carcass.ledChannelWidthMm !== "number") {
          mod.carcass.ledChannelWidthMm = 12;
        }
        if (typeof options?.channelDepthMm === "number") {
          mod.carcass.ledChannelDepthMm = Math.max(4, Math.min(Math.max(5, pThick - 4), Math.round(options.channelDepthMm)));
        } else if (typeof mod.carcass.ledChannelDepthMm !== "number") {
          mod.carcass.ledChannelDepthMm = 8;
        }

        const existingMode = mod.carcass.ledPlacementMode;
        const fallbackType =
          existingMode === "full_showcase"
            ? "full_showcase"
            : existingMode === "vertical_sides"
            ? "led_vertical_strip"
            : existingMode === "hanging_rod"
            ? "led_rod_strip"
            : "led_profile";
        const targetType = options?.ledType || fallbackType;
        mod.carcass.ledPlacementMode =
          targetType === "full_showcase"
            ? "full_showcase"
            : targetType === "led_vertical_strip"
            ? "vertical_sides"
            : targetType === "led_rod_strip"
            ? "hanging_rod"
            : "shelf_underside";

        const netH = calculateNetInnerHeight(mod);
        const bayWidths = calculateBayWidths(mod);
        const nowStamp = Date.now();
        const chanW = mod.carcass.ledChannelWidthMm;
        const sideSetback = mod.carcass.ledFrontSetbackMm;
        const shelfSetback = mod.carcass.ledAlignShelfAndSide
          ? sideSetback
          : mod.carcass.ledShelfSetbackMm;

        mod.bays.forEach((b, bIdx) => {
          b.specialFittings = (b.specialFittings || []).filter(
            (f) => !f.type.startsWith("led_")
          );
          if (enabled) {
            const bw = bayWidths[bIdx] || 550;
            if (targetType === "led_profile" || targetType === "full_showcase") {
              b.specialFittings.push({
                id: `fit_led_profile_${mod.id}_${bIdx}_${nowStamp}`,
                bayIndex: bIdx,
                type: "led_profile",
                elevationY: Math.max(200, netH - 20),
                height: mod.carcass.ledChannelDepthMm,
                width: Math.max(60, bw - 12),
                depth: shelfSetback,
              });
            }
            if (targetType === "led_vertical_strip" || targetType === "full_showcase") {
              b.specialFittings.push({
                id: `fit_led_vert_${mod.id}_${bIdx}_${nowStamp}`,
                bayIndex: bIdx,
                type: "led_vertical_strip",
                elevationY: 20,
                height: Math.max(160, netH - 24),
                width: chanW,
                depth: sideSetback,
              });
            }
            if (targetType === "led_rod_strip") {
              const topRailY =
                b.hangingRails && b.hangingRails.length > 0
                  ? Math.max(...b.hangingRails.map((r) => r.elevationY))
                  : Math.max(300, netH - 120);
              b.specialFittings.push({
                id: `fit_led_rod_${mod.id}_${bIdx}_${nowStamp}`,
                bayIndex: bIdx,
                type: "led_rod_strip",
                elevationY: topRailY - 8,
                height: 16,
                width: Math.max(60, bw - 12),
                depth: 18,
              });
            }
          }
        });
        return mod;
      }, true);

      // If turning interior LED ON while solid doors are completely closed, gently open doors to 75°
      // so the user immediately sees the warm interior LED illumination in 3D!
      if (enabled) {
        const curState = useConfiguratorStore.getState();
        const curMod = curState.project.modules[curState.activeModuleIndex];
        const allClosedOpaque =
          curMod &&
          !curMod.isOpenFront &&
          curState.doorOpenAngleDeg < 5 &&
          curMod.bays.every(
            (b) =>
              b.door.type !== "open" &&
              !b.door.isGlassFramed &&
              b.door.crossSectionProfile !== "glass_frame"
          );
        if (allClosedOpaque) {
          setDoorOpenAngleDeg(75);
        }
      }
    },
    [commitActiveModuleUpdate, setDoorOpenAngleDeg]
  );

  /**
   * Restore a saved bays snapshot if the user cancels a live interior template preview
   */
  const restoreModuleBaysSnapshot = useCallback(
    (baysSnapshot: import("@birim/core").BayConfig[]) => {
      commitActiveModuleUpdate((mod) => {
        mod.bays = JSON.parse(JSON.stringify(baysSnapshot));
        return mod;
      }, false);
    },
    [commitActiveModuleUpdate]
  );

  /**
   * Screen 6 (Malzeme ve Yüzeyler): Assign a catalog material to a specific scope
   * (all_module, carcass, doors, drawers, plinth, back, selected_part, or same_material_parts)
   * with technical compatibility validation and affected part count calculation.
   */
  const applyMaterialByTargetScope = useCallback(
    (
      scope:
        | "all_module"
        | "carcass"
        | "doors"
        | "drawers"
        | "plinth"
        | "back"
        | "countertop"
        | "selected_part"
        | "same_material_parts",
      materialId: string,
      targetCompId?: string,
      pushHistory = true
    ): { ok: boolean; affectedCount: number; error?: string } => {
      const matDef = DEFAULT_MATERIALS.find((m) => m.id === materialId);
      if (!matDef) {
        return { ok: false, affectedCount: 0, error: "Geçersiz katalog malzemesi." };
      }

      const st = useConfiguratorStore.getState();
      const mod = st.project.modules[st.activeModuleIndex] || st.project.modules[0];
      if (!mod) return { ok: false, affectedCount: 0, error: "Aktif modül bulunamadı." };

      const resolvedTargetId = targetCompId || st.selectedComponentId || undefined;
      const geo = generateModuleGeometry(mod);
      const targetComp = resolvedTargetId
        ? geo.components.find((c) => c.id === resolvedTargetId)
        : undefined;

      // Technical Surface Compatibility Guard (FAZ 3):
      // Heavy stone/marble slabs (2400 kg/m³) cannot be applied to hinged/sliding doors, drawers, or 8mm back panels!
      const isDoorOrDrawerScope =
        scope === "doors" ||
        scope === "drawers" ||
        scope === "back" ||
        (scope === "selected_part" &&
          targetComp &&
          (targetComp.role.includes("door") ||
            targetComp.role === "drawer_front" ||
            targetComp.role === "carcass_back"));
      if (matDef.category === "stone" && isDoorOrDrawerScope) {
        return {
          ok: false,
          affectedCount: 0,
          error: `"${matDef.name}" (${matDef.densityKgPerM3 || 2400} kg/m³ taş/kuvars levha) ağırlık ve menteşe sınırları nedeniyle kapak, çekmece veya arkalık panellerine atanamaz. Yalnızca tezgâh veya üst tabla yüzeylerinde kullanılabilir.`,
        };
      }
      if (
        (matDef.category === "glass" || matDef.category === "mirror") &&
        (scope === "carcass" || scope === "plinth" || scope === "back")
      ) {
        return {
          ok: false,
          affectedCount: 0,
          error: `"${matDef.name}" taşıyıcı gövde dikmesi, kaide veya arkalık olarak kullanılamaz; yalnızca kapak yüzeylerine atanabilir.`,
        };
      }

      let affectedCount = 0;

      commitActiveModuleUpdate((nextMod) => {
        if (!nextMod.componentMaterialOverrides) {
          nextMod.componentMaterialOverrides = {};
        }
        const overrides = { ...nextMod.componentMaterialOverrides };

        if (scope === "all_module") {
          const panelMatId =
            matDef.category === "glass" || matDef.category === "mirror" || matDef.category === "stone"
              ? nextMod.carcass.bodyMaterialId
              : materialId;
          nextMod.carcass.bodyMaterialId = panelMatId;
          nextMod.carcass.doorMaterialId = materialId;
          nextMod.carcass.plinthMaterialId = panelMatId;
          nextMod.edgeBandMaterialId = panelMatId;
          nextMod.bays = nextMod.bays.map((b) => ({
            ...b,
            door: { ...b.door, doorMaterialId: materialId },
            drawers: b.drawers.map((d) => ({ ...d, frontMaterialId: materialId })),
          }));
          nextMod.componentMaterialOverrides = {};
          affectedCount = geo.components.filter((c) => c.isManufacturablePanel !== false).length;
        } else if (scope === "carcass") {
          nextMod.carcass.bodyMaterialId = materialId;
          geo.components.forEach((c) => {
            if (
              c.role === "carcass_side_left" ||
              c.role === "carcass_side_right" ||
              c.role === "carcass_top" ||
              c.role === "carcass_bottom" ||
              c.role === "carcass_divider" ||
              c.role === "carcass_sub_divider" ||
              c.role === "shelf"
            ) {
              delete overrides[c.id];
              affectedCount++;
            }
          });
          nextMod.componentMaterialOverrides = overrides;
        } else if (scope === "doors") {
          nextMod.carcass.doorMaterialId = materialId;
          nextMod.bays = nextMod.bays.map((b) => ({
            ...b,
            door: { ...b.door, doorMaterialId: materialId },
          }));
          geo.components.forEach((c) => {
            if (c.role === "door_left" || c.role === "door_right") {
              delete overrides[c.id];
              affectedCount++;
            }
          });
          nextMod.componentMaterialOverrides = overrides;
        } else if (scope === "drawers") {
          nextMod.bays = nextMod.bays.map((b) => ({
            ...b,
            drawers: b.drawers.map((d) => {
              overrides[`${d.id}_front`] = materialId;
              affectedCount++;
              return { ...d, frontMaterialId: materialId };
            }),
          }));
          nextMod.componentMaterialOverrides = overrides;
        } else if (scope === "plinth") {
          nextMod.carcass.plinthMaterialId = materialId;
          overrides.__plinth__ = materialId;
          geo.components.forEach((c) => {
            if (c.role === "plinth") {
              overrides[c.id] = materialId;
              affectedCount++;
            }
          });
          if (affectedCount === 0) affectedCount = 1;
          nextMod.componentMaterialOverrides = overrides;
        } else if (scope === "back") {
          geo.components.forEach((c) => {
            if (c.role === "carcass_back") {
              overrides[c.id] = materialId;
              affectedCount++;
            }
          });
          if (affectedCount === 0) {
            overrides[`${nextMod.id}_back`] = materialId;
            affectedCount = 1;
          }
          nextMod.componentMaterialOverrides = overrides;
        } else if (scope === "countertop") {
          nextMod.carcass.countertopMaterialId = materialId;
          geo.components.forEach((c) => {
            if (c.role === "countertop") {
              overrides[c.id] = materialId;
              affectedCount++;
            }
          });
          if (affectedCount === 0) affectedCount = 1;
          nextMod.componentMaterialOverrides = overrides;
        } else if (scope === "selected_part" && resolvedTargetId) {
          overrides[resolvedTargetId] = materialId;
          if (resolvedTargetId.endsWith("_plinth")) {
            nextMod.carcass.plinthMaterialId = materialId;
            overrides.__plinth__ = materialId;
          }
          affectedCount = 1;
          nextMod.componentMaterialOverrides = overrides;
        } else if (scope === "same_material_parts") {
          const refMatId =
            (targetComp &&
              (overrides[targetComp.id] || targetComp.materialId)) ||
            nextMod.carcass.doorMaterialId;
          geo.components.forEach((c) => {
            if (c.isManufacturablePanel === false) return;
            const curCompMat = overrides[c.id] || c.materialId;
            if (curCompMat === refMatId) {
              overrides[c.id] = materialId;
              affectedCount++;
            }
          });
          if (nextMod.carcass.bodyMaterialId === refMatId) {
            nextMod.carcass.bodyMaterialId = materialId;
          }
          if (nextMod.carcass.doorMaterialId === refMatId) {
            nextMod.carcass.doorMaterialId = materialId;
          }
          nextMod.componentMaterialOverrides = overrides;
        }

        return nextMod;
      }, pushHistory);

      return { ok: true, affectedCount };
    },
    [commitActiveModuleUpdate]
  );

  /**
   * Screen 6 (FAZ 4): Update grain direction (Dikey / Yatay / Özel), surface finish (Mat / Yarı Mat / Parlak),
   * edgeband material/thickness, and panel/door thickness on the active module.
   */
  const setModuleMaterialDetails = useCallback(
    (updates: {
      grainDirection?: "lengthwise" | "crosswise" | "custom";
      grainTargetKey?: string;
      surfaceFinishOverride?: "matte" | "satin" | "gloss";
      edgeBandMaterialId?: string;
      edgeBandThickness?: number;
      doorThickness?: number;
      panelThickness?: number;
    }) => {
      commitActiveModuleUpdate((mod) => {
        if (updates.grainDirection) {
          if (!mod.componentGrainOverrides) mod.componentGrainOverrides = {};
          const key = updates.grainTargetKey || "__all__";
          mod.componentGrainOverrides = {
            ...mod.componentGrainOverrides,
            [key]: updates.grainDirection,
          };
        }
        if (updates.surfaceFinishOverride) {
          mod.surfaceFinishOverride = updates.surfaceFinishOverride;
        }
        if (updates.edgeBandMaterialId) {
          mod.edgeBandMaterialId = updates.edgeBandMaterialId;
        }
        if (typeof updates.edgeBandThickness === "number") {
          mod.carcass.edgeBandThickness = updates.edgeBandThickness;
        }
        if (typeof updates.doorThickness === "number") {
          mod.carcass.doorThickness = updates.doorThickness;
          mod.bays = mod.bays.map((b) => ({
            ...b,
            door: { ...b.door, doorThicknessMm: updates.doorThickness },
          }));
        }
        if (typeof updates.panelThickness === "number") {
          mod.carcass.panelThickness = updates.panelThickness;
        }
        return mod;
      }, true);
    },
    [commitActiveModuleUpdate]
  );

  /**
   * Screen 6: Clear all individual component material & grain overrides on the active module
   */
  const resetModuleMaterialOverrides = useCallback(() => {
    commitActiveModuleUpdate((mod) => {
      mod.componentMaterialOverrides = {};
      mod.componentGrainOverrides = {};
      mod.surfaceFinishOverride = undefined;
      return mod;
    }, true);
  }, [commitActiveModuleUpdate]);

  /**
   * Screen 6 (FAZ 5 & FAZ 6): Restore a saved material state snapshot when canceling a live material variation preview
   * in either Studio or Showroom mode so unconfirmed previews never mutate the saved project/BOM!
   */
  const restoreModuleMaterialSnapshot = useCallback(
    (snapshot: {
      carcass: import("@birim/core").CarcassConfig;
      bays: import("@birim/core").BayConfig[];
      componentMaterialOverrides?: Record<string, string>;
      componentGrainOverrides?: Record<string, "lengthwise" | "crosswise" | "custom">;
      surfaceFinishOverride?: "matte" | "satin" | "gloss";
      edgeBandMaterialId?: string;
    }) => {
      commitActiveModuleUpdate((mod) => {
        mod.carcass = JSON.parse(JSON.stringify(snapshot.carcass));
        mod.bays = JSON.parse(JSON.stringify(snapshot.bays));
        mod.componentMaterialOverrides = snapshot.componentMaterialOverrides
          ? { ...snapshot.componentMaterialOverrides }
          : {};
        mod.componentGrainOverrides = snapshot.componentGrainOverrides
          ? { ...snapshot.componentGrainOverrides }
          : {};
        mod.surfaceFinishOverride = snapshot.surfaceFinishOverride;
        mod.edgeBandMaterialId = snapshot.edgeBandMaterialId;
        return mod;
      }, false);
    },
    [commitActiveModuleUpdate]
  );

  const removeModuleAt = useCallback((modIdx: number) => {
    const state = useConfiguratorStore.getState();
    if (state.project.modules.length === 0) return;
    if (modIdx < 0 || modIdx >= state.project.modules.length) return;
    const updated = JSON.parse(JSON.stringify(state.project));
    updated.modules.splice(modIdx, 1);
    const nextIdx =
      state.activeModuleIndex === modIdx
        ? Math.min(modIdx, Math.max(0, updated.modules.length - 1))
        : state.activeModuleIndex > modIdx
        ? state.activeModuleIndex - 1
        : state.activeModuleIndex;
    commitAdapterState({
      project: updated,
      activeModuleIndex: nextIdx,
      selectedComponentId: null,
    });
  }, []);

  /**
   * Remove currently selected interior item (shelf, drawer, hanging rail, fitting, or sub-divider)
   */
  const removeSelectedInteriorComponent = useCallback((): boolean => {
    const state = useConfiguratorStore.getState();
    const selId = state.selectedComponentId;
    if (!selId) return false;
    const mod = state.project.modules[state.activeModuleIndex] || state.project.modules[0];
    if (!mod) return false;

    for (let bIdx = 0; bIdx < mod.bays.length; bIdx++) {
      const bay = mod.bays[bIdx];
      const shelfMatch = bay.shelves.find(
        (s, sIdx) => s.id === selId || `${mod.id}_bay_${bIdx}_shelf_${sIdx}` === selId
      );
      if (shelfMatch) {
        removeShelf(bIdx, shelfMatch.id);
        setSelectedComponentId(null);
        return true;
      }

      const drawerMatch = bay.drawers.find(
        (d) => selId === d.id || selId.startsWith(`${d.id}_`)
      );
      if (drawerMatch) {
        removeDrawer(bIdx, drawerMatch.id);
        setSelectedComponentId(null);
        return true;
      }

      const railMatch = bay.hangingRails.find(
        (r, rIdx) => r.id === selId || `${mod.id}_bay_${bIdx}_rail_${rIdx}` === selId
      );
      if (railMatch) {
        removeHangingRail(bIdx, railMatch.id);
        setSelectedComponentId(null);
        return true;
      }

      const fitMatch = (bay.specialFittings || []).find(
        (f, fIdx) => f.id === selId || `${mod.id}_bay_${bIdx}_fit_${fIdx}` === selId
      );
      if (fitMatch) {
        removeSpecialFitting(bIdx, fitMatch.id);
        setSelectedComponentId(null);
        return true;
      }

      const subDivMatch = (bay.subDividers || []).find(
        (sd, sdIdx) => sd.id === selId || `${mod.id}_bay_${bIdx}_subdiv_${sdIdx}` === selId
      );
      if (subDivMatch) {
        removeSubDivider(bIdx, subDivMatch.id);
        setSelectedComponentId(null);
        return true;
      }
    }
    return false;
  }, [
    removeShelf,
    removeDrawer,
    removeHangingRail,
    removeSpecialFitting,
    removeSubDivider,
    setSelectedComponentId,
  ]);

  /**
   * Smart CAD Delete Hierarchy for Delete / Backspace key & HUD Delete button:
   * - Instant 0-click deletion for interior parts (shelf, drawer, rail, fitting, sub-divider) & vertical dividers.
   * - Returns an inline intent-choice prompt when a Door or Structural Carcass Panel is selected so the user
   *   can pick in 1 click between Removing Door (Open Bay), Deleting Compartment (Shrink), or Deleting Entire Module.
   */
  const deleteActiveSelectionSmart = useCallback(():
    | { action: "executed"; ok: boolean; message: string }
    | {
        action: "prompt";
        kind: "door" | "structural";
        partName: string;
        bayIndex: number;
        canRemoveDoor: boolean;
        canDeleteBay: boolean;
        canShrinkDouble: boolean;
        canDeleteModule: boolean;
        shrunkOuterCm: number;
        halfShrunkOuterCm: number;
      } => {
    const state = useConfiguratorStore.getState();
    const selId = state.selectedComponentId;
    const mod = state.project.modules[state.activeModuleIndex] || state.project.modules[0];
    if (!mod) {
      return { action: "executed", ok: false, message: "Aktif modül bulunamadı." };
    }

    if (selId) {
      const bd = generateModuleGeometry(mod, { doorOpenAngleDeg: 0 });
      const selPart = bd.components.find((c) => c.id === selId);
      const partName = selPart ? selPart.label.split(" (")[0] : "Seçili parça";
      const role = selPart?.role || "";

      // 1. Removable interior component (shelf, drawer, rail, fitting, sub-divider) -> INSTANT DELETE
      if (removeSelectedInteriorComponent()) {
        return {
          action: "executed",
          ok: true,
          message: `"${partName}" silindi (Ctrl+Z ile geri al).`,
        };
      }

      // 2. Vertical carcass divider -> INSTANT MERGE
      if (role === "carcass_divider") {
        if (mod.bays.length > 1) {
          const bIdx =
            typeof selPart?.bayIndex === "number"
              ? Math.max(0, Math.min(mod.bays.length - 1, selPart.bayIndex))
              : Math.max(0, Math.min(mod.bays.length - 1, state.activeBayIndex));
          removeBayAt(bIdx);
          return {
            action: "executed",
            ok: true,
            message: "Ara dikme kaldırıldı ve komşu bölmeler birleştirildi (Ctrl+Z ile geri al).",
          };
        }
        return {
          action: "executed",
          ok: false,
          message: "Tek bölmeli dolapta silinecek ara dikme yok.",
        };
      }

      const bIdx =
        typeof selPart?.bayIndex === "number"
          ? Math.max(0, Math.min(mod.bays.length - 1, selPart.bayIndex))
          : Math.max(0, Math.min(mod.bays.length - 1, state.activeBayIndex));
      const fourSpace = calculateFourSpaceDimensions(mod);
      const bayClearW = fourSpace.usableInternal.bayClearWidthsMm[bIdx] || 600;
      const panelT = mod.carcass.panelThickness || 18;
      const shrunkOuterCm = Math.max(
        35,
        Math.round((mod.dimensions.width - (bayClearW + panelT)) / 10)
      );
      const halfShrunkOuterCm = Math.max(
        40,
        Math.round((mod.dimensions.width - Math.round(bayClearW * 0.5)) / 10)
      );
      const targetBay = mod.bays[bIdx];
      const canDeleteBay = mod.bays.length > 1;
      const canShrinkDouble =
        targetBay?.door?.type === "double" && bayClearW >= 760;
      const canDeleteModule = state.project.modules.length > 1;

      // 3. Door leaf or hinge -> SMART 1-LINE INTENT BAR
      if (
        role === "door_left" ||
        role === "door_right" ||
        role === "door_hinge" ||
        selId.includes("_door_")
      ) {
        const canRemoveDoor = targetBay?.door?.type !== "open";
        if (canRemoveDoor || canDeleteBay || canShrinkDouble || canDeleteModule) {
          return {
            action: "prompt",
            kind: "door",
            partName,
            bayIndex: bIdx,
            canRemoveDoor,
            canDeleteBay,
            canShrinkDouble,
            canDeleteModule,
            shrunkOuterCm,
            halfShrunkOuterCm,
          };
        }
        return {
          action: "executed",
          ok: false,
          message: "Bu bölmede zaten kapak bulunmuyor.",
        };
      }

      // 4. Structural outer carcass panel (top, bottom, sides, back, plinth, countertop) -> SMART 1-LINE INTENT BAR
      if (canDeleteBay || canShrinkDouble || canDeleteModule) {
        return {
          action: "prompt",
          kind: "structural",
          partName,
          bayIndex: bIdx,
          canRemoveDoor: false,
          canDeleteBay,
          canShrinkDouble,
          canDeleteModule,
          shrunkOuterCm,
          halfShrunkOuterCm,
        };
      }

      return {
        action: "executed",
        ok: false,
        message: `"${partName}" taşıyıcı ana gövde panelidir, tek başına silinemez.`,
      };
    }

    // 5. No sub-component selected -> module-level deletion if multiple modules exist
    if (state.project.modules.length > 1) {
      const modName = mod.name || "Modül";
      removeActiveModule();
      return {
        action: "executed",
        ok: true,
        message: `"${modName}" sahneden kaldırıldı (Ctrl+Z ile geri al).`,
      };
    }

    return {
      action: "executed",
      ok: false,
      message: "Sahnede tek modül var; silmek için önce bir iç parça veya bölme seçin.",
    };
  }, [
    removeSelectedInteriorComponent,
    removeBayAt,
    removeActiveModule,
  ]);


  /**
   * Screen 7 (FAZ 3, 5, 8, 11 & 12): Axis-aware spatial clearance & room metrics calculator.
   * Never subtracts rotated/off-axis modules from the wrong wall!
   */
  const computeWallAndModuleClearances = useCallback(
    (explicitModIdx?: number) => {
      const curState = useConfiguratorStore.getState();
      const curProj = curState.project;
      const targetIdx =
        typeof explicitModIdx === "number" ? explicitModIdx : curState.activeModuleIndex;
      const walls = getEffectiveSpaceWalls(curProj);
      const mainWall = walls[0] || {
        id: "wall_main",
        name: "Ana Duvar",
        length: 3600,
        height: curProj.space.ceilingHeight || 2700,
        thickness: 200,
        position: { x: 0, y: 0, z: 0 },
        rotationY: 0,
        wallType: "standard" as const,
        elements: [],
      };
      const sideWalls = walls.filter((w) => w.rotationY === 90 || w.rotationY === 270);
      const roomDepthMm =
        sideWalls.length > 0
          ? Math.max(...sideWalls.map((w) => w.length))
          : 2700;
      const roomWidthMm = mainWall.length || 3600;
      const roomHeightMm = curProj.space.ceilingHeight || mainWall.height || 2700;
      const roomAreaM2 = Number(((roomWidthMm * roomDepthMm) / 1_000_000).toFixed(2));

      const allFootprints = curProj.modules.map((m, idx) =>
        getModuleOrientedFootprint(m, idx)
      );
      const targetMod = curProj.modules[targetIdx] || curProj.modules[0];
      const targetFp =
        allFootprints[targetIdx] ||
        allFootprints[0] || {
          moduleId: "empty",
          moduleIndex: 0,
          name: "Modül Yok",
          category: "wardrobe" as const,
          x: 0,
          z: 0,
          planWidth: 0,
          planDepth: 0,
          yBottom: 0,
          yTop: 2200,
          rotationY: 0,
          rawWidth: 0,
          rawHeight: 2200,
          rawDepth: 600,
          isCorner: false,
          isOpenFront: false,
          cornerType: "none" as const,
          wingDepthMm: 600,
        };

      const rotY = (((targetFp.rotationY || 0) % 360) + 360) % 360;
      const isSideAxis = rotY === 90 || rotY === 270;

      if (!isSideAxis) {
        // Horizontal wall (X-axis)
        const horizWalls = walls.filter((w) => w.rotationY === 0 || w.rotationY === 180);
        const hostWall =
          horizWalls.sort(
            (a, b) => Math.abs(a.position.z - targetFp.z) - Math.abs(b.position.z - targetFp.z)
          )[0] || mainWall;

        const wallStart = hostWall.position.x;
        const wallEnd = hostWall.position.x + hostWall.length;

        // Check if any structural column on the same wall restricts the right or left usable bound
        const obstacles = getEffectiveSpaceObstacles(curProj);
        let effectiveLeftBound = wallStart;
        let effectiveRightBound = wallEnd;
        obstacles.forEach((obs) => {
          if (obs.type === "column" || obs.type === "protrusion") {
            const zDist = Math.abs(obs.position.z - hostWall.position.z);
            if (zDist <= 350) {
              const ox1 = obs.position.x;
              const ox2 = obs.position.x + obs.dimensions.width;
              if (ox2 <= targetFp.x + 5 && ox2 > effectiveLeftBound) {
                effectiveLeftBound = ox2;
              }
              if (ox1 >= targetFp.x + targetFp.planWidth - 5 && ox1 < effectiveRightBound) {
                effectiveRightBound = ox1;
              }
            }
          }
        });

        const leftClearanceMm = Math.max(0, Math.round(targetFp.x - wallStart));
        const rightClearanceMm = Math.max(
          0,
          Math.round(wallEnd - (targetFp.x + targetFp.planWidth))
        );
        const rightClearanceToObstacleMm = Math.max(
          0,
          Math.round(effectiveRightBound - (targetFp.x + targetFp.planWidth))
        );
        const backWallDistanceMm = Math.max(0, Math.round(targetFp.z - hostWall.position.z));

        const sameWallFootprints = allFootprints.filter(
          (f) =>
            f.category !== "complementary" &&
            (f.rotationY === 0 || f.rotationY === 180) &&
            Math.abs(f.z - targetFp.z) <= 120
        );
        const totalModuleLengthOnWallMm = sameWallFootprints.reduce(
          (sum, f) => sum + f.planWidth,
          0
        );
        const remainingWallClearanceMm = Math.max(
          0,
          Math.round(hostWall.length - totalModuleLengthOnWallMm)
        );

        const alignmentMode: "left" | "center" | "right" | "custom" =
          leftClearanceMm <= 5
            ? "left"
            : rightClearanceMm <= 5
            ? "right"
            : Math.abs(leftClearanceMm - rightClearanceMm) <= 20
            ? "center"
            : "custom";

        return {
          hostWallId: hostWall.id,
          hostWallName: hostWall.name || "Ana Duvar",
          hostWallNetLengthMm: hostWall.length,
          hostWallThicknessMm: hostWall.thickness || 200,
          hostWallHeightMm: hostWall.height || roomHeightMm,
          hostWallType: hostWall.wallType || "standard",
          axis: "X" as const,
          isRotatedSideWall: false,
          moduleSpanMm: targetFp.planWidth,
          moduleDepthMm: targetFp.planDepth,
          moduleHeightMm: targetFp.rawHeight,
          leftClearanceMm,
          rightClearanceMm,
          rightClearanceToObstacleMm,
          backWallDistanceMm,
          totalModuleLengthOnWallMm,
          remainingWallClearanceMm,
          alignmentMode,
          roomWidthMm,
          roomDepthMm,
          roomHeightMm,
          roomAreaM2,
          plinthHeightMm: targetMod?.carcass?.plinthHeight ?? 60,
        };
      } else {
        // Rotated 90° / 270° module on a vertical Side Wall (Z-axis)
        const isRightSide = targetFp.x > roomWidthMm * 0.5;
        const matchedSideWall =
          sideWalls.sort(
            (a, b) => Math.abs(a.position.x - targetFp.x) - Math.abs(b.position.x - targetFp.x)
          )[0] || {
            id: isRightSide ? "wall_side_right" : "wall_side_left",
            name: isRightSide ? "Sağ Yan Duvar" : "Sol Yan Duvar",
            length: roomDepthMm,
            height: roomHeightMm,
            thickness: mainWall.thickness || 200,
            position: { x: isRightSide ? roomWidthMm : 0, y: 0, z: 0 },
            rotationY: 90,
            wallType: "standard" as const,
            elements: [],
          };

        const wallStartZ = matchedSideWall.position.z;
        const wallEndZ = matchedSideWall.position.z + matchedSideWall.length;
        const leftClearanceMm = Math.max(0, Math.round(targetFp.z - wallStartZ));
        const rightClearanceMm = Math.max(
          0,
          Math.round(wallEndZ - (targetFp.z + targetFp.planDepth))
        );
        const backWallDistanceMm = isRightSide
          ? Math.max(0, Math.round(roomWidthMm - (targetFp.x + targetFp.planWidth)))
          : Math.max(0, Math.round(targetFp.x - matchedSideWall.position.x));

        const sameSideFootprints = allFootprints.filter(
          (f) =>
            f.category !== "complementary" &&
            (f.rotationY === 90 || f.rotationY === 270) &&
            Math.abs(f.x - targetFp.x) <= 650
        );
        const totalModuleLengthOnWallMm = sameSideFootprints.reduce(
          (sum, f) => sum + f.planDepth,
          0
        );
        const remainingWallClearanceMm = Math.max(
          0,
          Math.round(matchedSideWall.length - totalModuleLengthOnWallMm)
        );

        const alignmentMode: "left" | "center" | "right" | "custom" =
          leftClearanceMm <= 5
            ? "left"
            : rightClearanceMm <= 5
            ? "right"
            : Math.abs(leftClearanceMm - rightClearanceMm) <= 20
            ? "center"
            : "custom";

        return {
          hostWallId: matchedSideWall.id,
          hostWallName: matchedSideWall.name || (isRightSide ? "Sağ Yan Duvar" : "Sol Yan Duvar"),
          hostWallNetLengthMm: matchedSideWall.length,
          hostWallThicknessMm: matchedSideWall.thickness || 200,
          hostWallHeightMm: matchedSideWall.height || roomHeightMm,
          hostWallType: matchedSideWall.wallType || "standard",
          axis: "Z" as const,
          isRotatedSideWall: true,
          moduleSpanMm: targetFp.planDepth,
          moduleDepthMm: targetFp.planWidth,
          moduleHeightMm: targetFp.rawHeight,
          leftClearanceMm,
          rightClearanceMm,
          rightClearanceToObstacleMm: rightClearanceMm,
          backWallDistanceMm,
          totalModuleLengthOnWallMm,
          remainingWallClearanceMm,
          alignmentMode,
          roomWidthMm,
          roomDepthMm,
          roomHeightMm,
          roomAreaM2,
          plinthHeightMm: targetMod?.carcass?.plinthHeight ?? 60,
        };
      }
    },
    []
  );

  const activeSpatialMetrics = useMemo(
    () => computeWallAndModuleClearances(activeModuleIndex),
    [computeWallAndModuleClearances, activeModuleIndex, project]
  );

  /**
   * Screen 7 (FAZ 2, 4 & 8): Align active module along its host wall
   * ("left" | "center" | "right" | "flush_back" | "custom_left" | "custom_right")
   */
  const alignActiveModuleOnWall = useCallback(
    (
      alignment: "left" | "center" | "right" | "flush_back" | "custom_left" | "custom_right",
      customGapMm = 0
    ) => {
      const curState = useConfiguratorStore.getState();
      const curProj = curState.project;
      const modIdx = curState.activeModuleIndex;
      const target = curProj.modules[modIdx];
      if (!target) return;

      const metrics = computeWallAndModuleClearances(modIdx);
      const fp = getModuleOrientedFootprint(target, modIdx);
      const safeGap = Math.max(0, Math.round(customGapMm));

      let nextX = target.position.x;
      let nextZ = target.position.z;

      if (!metrics.isRotatedSideWall) {
        const wallLen = metrics.hostWallNetLengthMm;
        if (alignment === "left") {
          nextX = 0;
        } else if (alignment === "center") {
          nextX = Math.max(0, Math.round((wallLen - fp.planWidth) / 2));
        } else if (alignment === "right") {
          nextX = Math.max(0, Math.round(wallLen - fp.planWidth));
        } else if (alignment === "flush_back") {
          nextZ = 0;
        } else if (alignment === "custom_left") {
          nextX = Math.max(0, Math.min(wallLen - fp.planWidth, safeGap));
        } else if (alignment === "custom_right") {
          nextX = Math.max(0, wallLen - fp.planWidth - safeGap);
        }
      } else {
        const wallLenZ = metrics.hostWallNetLengthMm;
        if (alignment === "left") {
          nextZ = 0;
        } else if (alignment === "center") {
          nextZ = Math.max(0, Math.round((wallLenZ - fp.planDepth) / 2));
        } else if (alignment === "right") {
          nextZ = Math.max(0, Math.round(wallLenZ - fp.planDepth));
        } else if (alignment === "flush_back") {
          nextX = fp.x > metrics.roomWidthMm * 0.5 ? Math.max(0, metrics.roomWidthMm - fp.planWidth) : 0;
        } else if (alignment === "custom_left") {
          nextZ = Math.max(0, Math.min(wallLenZ - fp.planDepth, safeGap));
        } else if (alignment === "custom_right") {
          nextZ = Math.max(0, wallLenZ - fp.planDepth - safeGap);
        }
      }

      setModulePosition(modIdx, nextX, nextZ, 1);
    },
    [computeWallAndModuleClearances, setModulePosition]
  );

  /**
   * Screen 7 (FAZ 4): Distribute modules along the main wall with an explicit gap (mm) or equal spacing
   */
  const distributeModulesWithGap = useCallback((gapMm?: number) => {
    const curState = useConfiguratorStore.getState();
    const curProj = curState.project;
    const wallLen = curProj.space.walls[0]?.length || 3600;
    const nextMods = JSON.parse(JSON.stringify(curProj.modules)) as ModuleInstance[];
    const mainRowIndices = nextMods
      .map((m, i) => ({ m, i }))
      .filter(
        ({ m }) =>
          m.category !== "complementary" &&
          m.category !== "kitchen_wall" &&
          (m.rotation?.y || 0) === 0
      )
      .sort((a, b) => a.m.position.x - b.m.position.x);

    if (mainRowIndices.length === 0) return;

    if (typeof gapMm === "number" && gapMm >= 0) {
      let curX = 0;
      mainRowIndices.forEach(({ i }) => {
        nextMods[i].position.x = curX;
        curX += nextMods[i].dimensions.width + Math.round(gapMm);
      });
    } else {
      const totalModW = mainRowIndices.reduce(
        (sum, { m }) => sum + m.dimensions.width,
        0
      );
      const freeSpace = Math.max(0, wallLen - totalModW);
      const stepGap =
        mainRowIndices.length > 1
          ? Math.round(freeSpace / (mainRowIndices.length + 1))
          : Math.round(freeSpace / 2);
      let curX = stepGap;
      mainRowIndices.forEach(({ i }) => {
        nextMods[i].position.x = curX;
        curX += nextMods[i].dimensions.width + stepGap;
      });
    }

    commitAdapterState({
      history: [...curState.history.slice(-50), curProj],
      future: [],
      project: { ...curProj, modules: nextMods, updatedAt: new Date().toISOString() },
    });
  }, []);

  /**
   * Screen 7 (FAZ 3): Apply Ready Room Shape Presets ("rectangular" | "l_shape" | "u_shape")
   * while preserving existing furniture modules and updating 2D + 3D room walls.
   */
  const applyRoomShapePreset = useCallback(
    (
      shape: "rectangular" | "l_shape" | "u_shape",
      options?: {
        mainLengthMm?: number;
        sideLengthMm?: number;
        ceilingHeightMm?: number;
        thicknessMm?: number;
        wallType?: import("@birim/core").WallDefinition["wallType"];
      }
    ) => {
      const curState = useConfiguratorStore.getState();
      const curProj = curState.project;
      const existingMain = curProj.space.walls[0];
      const mainLen = options?.mainLengthMm || existingMain?.length || 3600;
      const sideLen = options?.sideLengthMm || 2700;
      const ceilH = options?.ceilingHeightMm || curProj.space.ceilingHeight || 2700;
      const thick = options?.thicknessMm || existingMain?.thickness || 200;
      const wType = options?.wallType || existingMain?.wallType || "standard";

      let nextWalls: import("@birim/core").WallDefinition[] = [];
      if (shape === "rectangular") {
        nextWalls = [
          {
            id: "wall_main",
            name: "Ana Duvar",
            length: mainLen,
            height: ceilH,
            thickness: thick,
            position: { x: 0, y: 0, z: 0 },
            rotationY: 0,
            wallType: wType,
            elements: [],
          },
          {
            id: "wall_side_left",
            name: "Sol Yan Duvar",
            length: sideLen,
            height: ceilH,
            thickness: thick,
            position: { x: 0, y: 0, z: 0 },
            rotationY: 90,
            wallType: wType,
            elements: [],
          },
          {
            id: "wall_side_right",
            name: "Sağ Yan Duvar",
            length: sideLen,
            height: ceilH,
            thickness: thick,
            position: { x: mainLen, y: 0, z: 0 },
            rotationY: 90,
            wallType: wType,
            elements: [],
          },
        ];
      } else if (shape === "l_shape") {
        nextWalls = [
          {
            id: "wall_main",
            name: "Ana Duvar",
            length: mainLen,
            height: ceilH,
            thickness: thick,
            position: { x: 0, y: 0, z: 0 },
            rotationY: 0,
            wallType: wType,
            elements: [],
          },
          {
            id: "wall_side_left",
            name: "Sol Yan Duvar (L Kolu)",
            length: sideLen,
            height: ceilH,
            thickness: thick,
            position: { x: 0, y: 0, z: 0 },
            rotationY: 90,
            wallType: wType,
            elements: [],
          },
          {
            id: "wall_l_inner_step",
            name: "L İç Dönüş Duvarı",
            length: Math.round(mainLen * 0.5),
            height: ceilH,
            thickness: thick,
            position: { x: Math.round(mainLen * 0.5), y: 0, z: Math.round(sideLen * 0.55) },
            rotationY: 0,
            wallType: wType,
            elements: [],
          },
          {
            id: "wall_side_right",
            name: "Sağ Kısa Duvar",
            length: Math.round(sideLen * 0.55),
            height: ceilH,
            thickness: thick,
            position: { x: mainLen, y: 0, z: 0 },
            rotationY: 90,
            wallType: wType,
            elements: [],
          },
        ];
      } else {
        // u_shape
        nextWalls = [
          {
            id: "wall_main",
            name: "Ana Duvar",
            length: mainLen,
            height: ceilH,
            thickness: thick,
            position: { x: 0, y: 0, z: 0 },
            rotationY: 0,
            wallType: wType,
            elements: [],
          },
          {
            id: "wall_side_left",
            name: "Sol Dönüş Duvarı",
            length: sideLen,
            height: ceilH,
            thickness: thick,
            position: { x: 0, y: 0, z: 0 },
            rotationY: 90,
            wallType: wType,
            elements: [],
          },
          {
            id: "wall_side_right",
            name: "Sağ Dönüş Duvarı",
            length: sideLen,
            height: ceilH,
            thickness: thick,
            position: { x: mainLen, y: 0, z: 0 },
            rotationY: 90,
            wallType: wType,
            elements: [],
          },
          {
            id: "wall_u_front_left",
            name: "Ön Sol Kapanış",
            length: Math.round(mainLen * 0.3),
            height: ceilH,
            thickness: thick,
            position: { x: 0, y: 0, z: sideLen },
            rotationY: 0,
            wallType: wType,
            elements: [],
          },
          {
            id: "wall_u_front_right",
            name: "Ön Sağ Kapanış",
            length: Math.round(mainLen * 0.3),
            height: ceilH,
            thickness: thick,
            position: { x: Math.round(mainLen * 0.7), y: 0, z: sideLen },
            rotationY: 0,
            wallType: wType,
            elements: [],
          },
        ];
      }

      const nextProj: import("@birim/core").DesignProject = {
        ...curProj,
        space: {
          ...curProj.space,
          ceilingHeight: ceilH,
          walls: nextWalls,
        },
        updatedAt: new Date().toISOString(),
      };

      commitAdapterState({
        history: [...curState.history.slice(-50), curProj],
        future: [],
        project: nextProj,
        validationIssues: validateProject(nextProj),
      });
    },
    []
  );

  /**
   * Screen 7 (FAZ 3): Update wall settings (thickness, height, wallType) across room walls
   */
  const setAllWallsSettings = useCallback(
    (patch: {
      thickness?: number;
      height?: number;
      wallType?: import("@birim/core").WallDefinition["wallType"];
      targetWallId?: string;
    }) => {
      const curState = useConfiguratorStore.getState();
      const curProj = curState.project;
      const baseWalls =
        curProj.space.walls.length > 0
          ? curProj.space.walls
          : getEffectiveSpaceWalls(curProj);
      const nextCeilH =
        typeof patch.height === "number"
          ? Math.max(1800, Math.min(6000, Math.round(patch.height)))
          : curProj.space.ceilingHeight || 2700;

      const nextWalls = baseWalls.map((w) => {
        if (patch.targetWallId && w.id !== patch.targetWallId) {
          return typeof patch.height === "number" ? { ...w, height: nextCeilH } : w;
        }
        return {
          ...w,
          thickness:
            typeof patch.thickness === "number"
              ? Math.max(50, Math.min(600, Math.round(patch.thickness)))
              : w.thickness,
          height: nextCeilH,
          wallType: patch.wallType ?? w.wallType ?? "standard",
        };
      });

      const nextProj: import("@birim/core").DesignProject = {
        ...curProj,
        space: {
          ...curProj.space,
          ceilingHeight: nextCeilH,
          walls: nextWalls,
        },
        updatedAt: new Date().toISOString(),
      };

      commitAdapterState({
        history: [...curState.history.slice(-50), curProj],
        future: [],
        project: nextProj,
        validationIssues: validateProject(nextProj),
      });
    },
    []
  );


  /**
   * Blum Cabinet Configurator (E-SERVICES) live engineering summary for activeModule
   */
  const activeBlumEngineering = useMemo(
    () => (!isLite && activeModule ? calculateBlumEngineeringSummary(activeModule) : null),
    [isLite, activeModule]
  );

  /**
   * Generates a Blum Exchange Format (.bxf / XML) string for the current project & BOM
   */
  const exportBlumBxfString = useCallback((): string => {
    const curState = useConfiguratorStore.getState();
    return generateBlumBxfXml(curState.project, curState.bom);
  }, []);

  /**
   * Imports a Blum .bxf / XML file and creates/updates the module in the project
   */
  const importBlumBxfFile = useCallback(
    (xmlText: string, appendToProject = false): { ok: boolean; name?: string; error?: string } => {
      const parsed = parseBlumBxfXml(xmlText);
      if (!parsed) {
        return { ok: false, error: "Geçersiz veya okunamayan Blum BXF / XML dosyası." };
      }
      const curState = useConfiguratorStore.getState();
      const curProj = curState.project;
      const newMod = parsed.createdModule;
      if (appendToProject && curProj.modules.length > 0) {
        const maxRight = Math.max(
          0,
          ...curProj.modules
            .filter((m) => m.category !== "complementary" && (m.rotation?.y || 0) === 0)
            .map((m) => m.position.x + m.dimensions.width)
        );
        newMod.position = { x: maxRight, y: 0, z: 0 };
      }
      const nextModules = appendToProject
        ? [...curProj.modules, newMod]
        : curProj.modules.map((m, idx) => (idx === curState.activeModuleIndex ? newMod : m));
      const nextProj = {
        ...curProj,
        version: (curProj.version || 1) + 1,
        updatedAt: new Date().toISOString(),
        modules: nextModules,
      };
      commitAdapterState({
        history: [...curState.history.slice(-50), curProj],
        future: [],
        project: nextProj,
        activeModuleIndex: appendToProject ? nextModules.length - 1 : curState.activeModuleIndex,
        selectedModuleIds: [newMod.id],
      });
      return { ok: true, name: parsed.name };
    },
    []
  );

  /**
   * 1-Click Blum Cabinet Applications (SPACE TOWER, AVENTOS HF top, LEGRABOX pure, 155° Zero-Protrusion)
   */
  const applyBlumQuickWizardPreset = useCallback(
    (
      presetId:
        | "blum_space_tower"
        | "blum_aventos_wall"
        | "blum_legrabox_base"
        | "blum_155_wardrobe"
    ) => {
      commitActiveModuleUpdate((mod) => {
        const bIdx = Math.min(
          useConfiguratorStore.getState().activeBayIndex,
          Math.max(0, mod.bays.length - 1)
        );
        const bay = mod.bays[bIdx] || mod.bays[0];
        if (!bay) return mod;

        if (presetId === "blum_space_tower") {
          // SPACE TOWER: 155° Zero-Protrusion CLIP top BLUMOTION (71B7550) + 4 Internal LEGRABOX drawers
          mod.carcass.hingeDrillingTemplateId = "tpl_drill_blum_155_zero";
          mod.carcass.drawerDrillingSetId = "blum_legrabox";
          bay.door = {
            ...bay.door,
            doorSystemId: bay.door.type === "double" ? "hinged_double" : "hinged_single",
            hardwareProductId: "hw_blum_71b7550",
            openingTechnology: "soft_close",
            softClose: true,
          };
          const optNl = Math.min(
            600,
            Math.max(270, Math.floor((mod.dimensions.depth - 28) / 50) * 50)
          );
          bay.drawers = [0, 1, 2, 3].map((dIdx) => ({
            id: `${mod.id}_spacetower_${bIdx}_${dIdx}_${Date.now()}`,
            bayIndex: bIdx,
            elevationY: dIdx * 280,
            height: 180,
            slideType: "soft_close" as const,
            isInternal: true,
            hardwareProductId: "hw_blum_legrabox_m40",
            nominalLengthMm: optNl,
          }));
        } else if (presetId === "blum_aventos_wall") {
          // AVENTOS HF top Bi-Fold Lift System (for wall/upper cabinets)
          if (mod.dimensions.height > 1040) {
            mod.dimensions.height = 780;
            mod.dimensions.depth = 350;
            mod.carcass.plinthHeight = 0;
          }
          bay.door = {
            ...bay.door,
            type: "lift_bi_fold",
            doorSystemId: "lift_bi_fold",
            hardwareProductId: "hw_blum_aventos_hf_25",
            openingTechnology: "soft_close",
            softClose: true,
          };
        } else if (presetId === "blum_legrabox_base") {
          // LEGRABOX pure 3-drawer stack
          mod.carcass.drawerDrillingSetId = "blum_legrabox";
          const optNl = Math.min(
            600,
            Math.max(270, Math.floor((mod.dimensions.depth - 28) / 50) * 50)
          );
          bay.drawers = [
            {
              id: `${mod.id}_lgb_${bIdx}_0_${Date.now()}`,
              bayIndex: bIdx,
              elevationY: 0,
              height: 240,
              slideType: "soft_close",
              isInternal: false,
              hardwareProductId: "hw_blum_legrabox_m40",
              nominalLengthMm: optNl,
            },
            {
              id: `${mod.id}_lgb_${bIdx}_1_${Date.now()}`,
              bayIndex: bIdx,
              elevationY: 258,
              height: 180,
              slideType: "soft_close",
              isInternal: false,
              hardwareProductId: "hw_blum_legrabox_m40",
              nominalLengthMm: optNl,
            },
            {
              id: `${mod.id}_lgb_${bIdx}_2_${Date.now()}`,
              bayIndex: bIdx,
              elevationY: 456,
              height: 140,
              slideType: "soft_close",
              isInternal: false,
              hardwareProductId: "hw_blum_legrabox_m40",
              nominalLengthMm: optNl,
            },
          ];
        } else if (presetId === "blum_155_wardrobe") {
          // CLIP top BLUMOTION 155° + TANDEMBOX antaro + Hanging Rail
          mod.carcass.hingeDrillingTemplateId = "tpl_drill_blum_155_zero";
          mod.carcass.drawerDrillingSetId = "blum_tandembox";
          bay.door = {
            ...bay.door,
            hardwareProductId: "hw_blum_71b7550",
            openingTechnology: "soft_close",
            softClose: true,
          };
        }
        return mod;
      }, true);
    },
    [commitActiveModuleUpdate]
  );


  /**
   * Generates a complete AutoCAD DXF string of all cutlist panels + CNC holes
   */
  const exportAllPanelsDxfString = useCallback((): string => {
    const curState = useConfiguratorStore.getState();
    return exportAllPanelsDXF(curState.bom);
  }, []);

  /**
   * Generates a 2800x2070mm 2D sheet nesting layout DXF string
   */
  const exportNestingDxfString = useCallback((): string => {
    const curState = useConfiguratorStore.getState();
    return exportNestingSheetsDXF(curState.bom);
  }, []);

  /**
   * V5.5: Generates a 100% Birim Portal ERP compatible Nesting Bundle
   * (nesting_projects + nesting_sheets + nesting_parts + nesting_placements + Selco CSV + CNC G-Code)
   */
  const exportErpNestingBundle = useCallback(
    (options?: BirimErpNestingBuildOptions): BirimErpNestingExportBundle => {
      const curState = useConfiguratorStore.getState();
      const matMap = new Map(DEFAULT_MATERIALS.map((m) => [m.id, m]));
      return buildBirimErpNestingBundle(curState.project, curState.bom, matMap, options);
    },
    []
  );

  const exportErpNestingJsonString = useCallback(
    (options?: BirimErpNestingBuildOptions): string => {
      return JSON.stringify(exportErpNestingBundle(options), null, 2);
    },
    [exportErpNestingBundle]
  );

  const exportErpSelcoCsvString = useCallback(
    (options?: BirimErpNestingBuildOptions): string => {
      return exportErpNestingBundle(options).combined_selco_csv;
    },
    [exportErpNestingBundle]
  );

  const exportErpGCodeString = useCallback(
    (options?: BirimErpNestingBuildOptions): string => {
      return exportErpNestingBundle(options).combined_cnc_gcode;
    },
    [exportErpNestingBundle]
  );
  /**
   * V4.6: Updates parametric CNC utility cutouts (sockets, grommets, plumbing, baseboard notches) on active module
   */
  const setModuleUtilityCutouts = useCallback(
    (nextCutouts: PanelCutoutConfig[]) => {
      commitActiveModuleUpdate((mod) => {
        mod.utilityCutouts = nextCutouts.map((c) => ({ ...c }));
        return mod;
      }, true);
    },
    [commitActiveModuleUpdate]
  );

  /**
   * V4.6: Resolves 90-degree corner door/drawer sweep collisions by shifting colliding runs >= 50mm
   * and inserting parametric corner filler strips (`tpl_cm_04_wall_filler`).
   */
  const autoResolveCornerCollisions = useCallback(() => {
    const state = useConfiguratorStore.getState();
    const curProj = state.project;
    const { adjustedModules, resolvedCount, insertedFillerSpecs } = computeCornerFillerAutoFix(
      curProj.modules,
      50
    );
    if (resolvedCount === 0) return 0;

    const fillerTpl = getV4TemplateById("tpl_cm_04_wall_filler");
    const fillerMods = insertedFillerSpecs.map((spec, idx) => {
      const fMod = fillerTpl
        ? fillerTpl.createInstance(`mod_corner_filler_${Date.now()}_${idx}`)
        : createDefaultWardrobeModule(`mod_corner_filler_${Date.now()}_${idx}`);
      fMod.name = `Köşe Kör Çıta (${spec.widthMm} mm)`;
      fMod.category = "complementary";
      fMod.complementaryRole = "wall_filler";
      fMod.isOpenFront = true;
      fMod.position = { ...spec.position };
      fMod.rotation = { x: 0, y: spec.rotationY, z: 0 };
      fMod.dimensions = {
        width: spec.widthMm,
        height: spec.heightMm,
        depth: spec.depthMm,
      };
      return fMod;
    });

    commitAdapterState({
      project: {
        ...curProj,
        modules: [...adjustedModules, ...fillerMods],
      },
    });
    return resolvedCount;
  }, []);

  /**
   * Atomically creates or replaces the active cabinet with given dimensions, bay count, door style,
   * interior focus, and materials in a SINGLE history commit with zero setTimeout race conditions.
   */
  const applyQuickCabinetAtomic = useCallback(
    (spec: {
      templateId?: string;
      width: number;
      height: number;
      depth: number;
      bays: number;
      doorType: "hinged" | "sliding" | "open";
      interior: "balanced" | "hanging" | "shelves" | "drawers";
      bodyMaterialId?: string;
      doorMaterialId?: string;
      replaceAll?: boolean;
    }) => {
      const state = useConfiguratorStore.getState();
      const curProj = state.project;
      const tpl = getV4TemplateById(spec.templateId || "tpl_wd_02_two_door") || V4_MODULE_TEMPLATES[0];
      const baseMod = tpl ? tpl.createInstance(`mod_${Date.now()}`) : createDefaultWardrobeModule(`mod_${Date.now()}`);

      const T = baseMod.carcass.panelThickness || 18;
      const safeW = Math.max(300, Math.min(3600, Math.round(spec.width)));
      const safeH = Math.max(400, Math.min(2800, Math.round(spec.height)));
      const safeD = Math.max(250, Math.min(900, Math.round(spec.depth)));
      const maxSafeBays = Math.max(1, Math.floor((safeW - T) / (120 + T)));
      const safeBays = Math.max(1, Math.min(maxSafeBays, Math.round(spec.bays)));
      const plinthH = baseMod.carcass.plinthHeight ?? 80;
      const netH = Math.max(320, safeH - plinthH - 2 * T);

      const bodyMat = spec.bodyMaterialId || baseMod.carcass.bodyMaterialId || "mat_melamine_white";
      const doorMat = spec.doorMaterialId || baseMod.carcass.doorMaterialId || "mat_veneer_oak";

      baseMod.dimensions = { width: safeW, height: safeH, depth: safeD };
      baseMod.isOpenFront = spec.doorType === "open";
      baseMod.bodyMaterialId = bodyMat;
      baseMod.doorMaterialId = doorMat;
      baseMod.carcass = {
        ...baseMod.carcass,
        bodyMaterialId: bodyMat,
        doorMaterialId: doorMat,
      };

      const topShelfY = Math.max(256, Math.min(netH - 160, Math.round((netH - 340) / 32) * 32));
      const nextBays: ModuleInstance["bays"] = [];

      for (let bIdx = 0; bIdx < safeBays; bIdx++) {
        const doorKind =
          spec.doorType === "open"
            ? ("open" as const)
            : spec.doorType === "sliding"
            ? ("sliding" as const)
            : safeBays === 1 && safeW >= 750
            ? ("double" as const)
            : bIdx % 2 === 0
            ? ("single_left" as const)
            : ("single_right" as const);
        const doorSys =
          spec.doorType === "open"
            ? ("open" as const)
            : spec.doorType === "sliding"
            ? ("sliding_top_hung" as const)
            : doorKind === "double"
            ? ("hinged_double" as const)
            : ("hinged_single" as const);

        const shelves: ModuleInstance["bays"][number]["shelves"] = [];
        const drawers: ModuleInstance["bays"][number]["drawers"] = [];
        const hangingRails: ModuleInstance["bays"][number]["hangingRails"] = [];

        const modeForBay =
          spec.interior === "balanced"
            ? bIdx === 0
              ? "hanging"
              : bIdx === safeBays - 1 && safeBays >= 2
              ? "drawers"
              : "shelves"
            : spec.interior;

        if (modeForBay === "hanging") {
          shelves.push({
            id: `${baseMod.id}_b${bIdx}_sh_top`,
            bayIndex: bIdx,
            elevationY: topShelfY,
            isAdjustable: false,
          });
          hangingRails.push({
            id: `${baseMod.id}_b${bIdx}_rail_main`,
            bayIndex: bIdx,
            elevationY: Math.max(320, topShelfY - 64),
          });
        } else if (modeForBay === "shelves") {
          const count = Math.max(2, Math.min(5, Math.floor(netH / 380)));
          const step = Math.max(160, Math.floor(netH / (count + 1) / 32) * 32);
          for (let s = 1; s <= count; s++) {
            shelves.push({
              id: `${baseMod.id}_b${bIdx}_sh_${s}`,
              bayIndex: bIdx,
              elevationY: Math.min(netH - 96, s * step),
              isAdjustable: s !== Math.ceil(count / 2),
            });
          }
        } else {
          const drwCount = netH >= 900 ? 3 : 2;
          const drwH = 192;
          for (let d = 0; d < drwCount; d++) {
            drawers.push({
              id: `${baseMod.id}_b${bIdx}_drw_${d}`,
              bayIndex: bIdx,
              elevationY: d * (drwH + 3),
              height: drwH,
              slideType: "soft_close",
              hardwareProductId: "hw_blum_legrabox_m40",
              frontMaterialId: doorMat,
            });
          }
          const coverY = drwCount * (drwH + 3) + 16;
          if (coverY < netH - 160) {
            shelves.push({
              id: `${baseMod.id}_b${bIdx}_sh_cov`,
              bayIndex: bIdx,
              elevationY: coverY,
              isAdjustable: false,
            });
          }
          if (topShelfY > coverY + 280) {
            shelves.push({
              id: `${baseMod.id}_b${bIdx}_sh_top`,
              bayIndex: bIdx,
              elevationY: topShelfY,
              isAdjustable: true,
            });
            hangingRails.push({
              id: `${baseMod.id}_b${bIdx}_rail_up`,
              bayIndex: bIdx,
              elevationY: Math.max(coverY + 180, topShelfY - 64),
            });
          }
        }

        nextBays.push({
          index: bIdx,
          shelves,
          drawers,
          hangingRails,
          specialFittings: [],
          subDividers: [],
          door: {
            id: `${baseMod.id}_door_${bIdx}`,
            bayIndex: bIdx,
            type: doorKind,
            doorSystemId: doorSys,
            openingTechnology: "soft_close",
            softClose: true,
            handleCategory: "linear_bar",
            doorMaterialId: doorMat,
          },
        });
      }
      baseMod.bays = nextBays;

      let nextModules: ModuleInstance[];
      let nextActiveIdx = 0;
      if (spec.replaceAll || curProj.modules.length === 0) {
        baseMod.position = { x: 0, y: 0, z: 0 };
        nextModules = [baseMod];
        nextActiveIdx = 0;
      } else {
        const curIdx = Math.min(state.activeModuleIndex, curProj.modules.length - 1);
        const prevMod = curProj.modules[curIdx];
        baseMod.position = prevMod ? { ...prevMod.position } : { x: 0, y: 0, z: 0 };
        baseMod.rotation = prevMod?.rotation ? { ...prevMod.rotation } : { x: 0, y: 0, z: 0 };
        nextModules = curProj.modules.map((m, idx) => (idx === curIdx ? baseMod : m));
        nextActiveIdx = curIdx;
      }

      commitAdapterState({
        project: {
          ...curProj,
          modules: nextModules,
        },
        activeModuleIndex: nextActiveIdx,
        activeBayIndex: 0,
        selectedComponentId: null,
        selectedModuleIds: [baseMod.id],
      });
    },
    []
  );


  const continuousKitchenLayers = useMemo(
    () => (isLite || isDraggingActive ? [] : computeContinuousKitchenLayers(project)),
    [isLite, isDraggingActive, project]
  );

  const exportCamZipBytes = useCallback(
    () => exportIndustrialCamZipArchive(project, bom),
    [project, bom]
  );
  const exportOptiCutCsvString = useCallback(() => {
    const matMap = new Map(DEFAULT_MATERIALS.map((m) => [m.id, m]));
    return exportOptiCutCutListCsv(bom, matMap);
  }, [bom]);
  const exportHardwareBomCsvString = useCallback(
    () => exportHardwareBomCsv(bom),
    [bom]
  );
  const exportNestingSvgString = useCallback(
    () => generateNestingDiagramSvg(bom),
    [bom]
  );
  const exportThermalLabelsHtmlString = useCallback(() => {
    const matMap = new Map(DEFAULT_MATERIALS.map((m) => [m.id, m]));
    return generateThermalPartLabelsHtml(project, bom, matMap);
  }, [project, bom]);


  const addCustomMaterialToProject = useCallback(
    (matInput: {
      name: string;
      decorCode?: string;
      category: import("@birim/core").MaterialDefinition["category"];
      colorHex: string;
      roughness: number;
      costPerM2: number;
      textureUrl?: string;
      hasGrain?: boolean;
    }) => {
      const state = useConfiguratorStore.getState();
      const curProj = state.project;
      const newMat: import("@birim/core").MaterialDefinition = {
        id: `mat_custom_${Date.now()}`,
        name: matInput.name.trim() || "Özel Tasarım Yüzey",
        brand: "Birim Özel Koleksiyon",
        decorCode: matInput.decorCode?.trim() || "BRM-OZEL",
        category: matInput.category,
        thickness: 18,
        densityKgPerM3: 740,
        colorHex: matInput.colorHex || "#d6d1c7",
        roughness: matInput.roughness,
        metalness: matInput.category === "metal" ? 0.88 : 0.04,
        textureUrl: matInput.textureUrl,
        costPerM2: Math.max(5, Number(matInput.costPerM2) || 65),
        edgeBandCostPerM: 3.5,
        hasGrain: Boolean(matInput.hasGrain || matInput.textureUrl || matInput.category === "wood"),
      };
      registerRuntimeMaterial(newMat);
      try {
        if (typeof window !== "undefined") {
          const prev = JSON.parse(localStorage.getItem("birim_custom_materials_v5") || "[]");
          const nextArr = [newMat, ...(Array.isArray(prev) ? prev : [])].slice(0, 40);
          localStorage.setItem("birim_custom_materials_v5", JSON.stringify(nextArr));
        }
      } catch {
        // Ignore quota errors
      }
      const nextCustomMats = [newMat, ...(curProj.customMaterials || [])];
      commitAdapterState({
        history: [...state.history.slice(-50), curProj],
        future: [],
        project: {
          ...curProj,
          customMaterials: nextCustomMats,
          updatedAt: new Date().toISOString(),
        },
      });
      return newMat;
    },
    []
  );

  const addCustomCapsuleModule = useCallback(
    (spec: {
      kind: "capsule_bar" | "capsule_table";
      name?: string;
      widthMm: number;
      heightMm: number;
      depthMm: number;
      cornerRadiusMm?: number;
      tambourSlatPitchMm?: number;
      bodyMaterialId?: string;
      topMaterialId?: string;
    }) => {
      const state = useConfiguratorStore.getState();
      const curProj = state.project;
      const id = `mod_cap_${Date.now()}`;
      const w = Math.max(700, Math.min(3600, Math.round(spec.widthMm)));
      const d = Math.max(360, Math.min(1200, Math.round(spec.depthMm)));
      const h = Math.max(450, Math.min(2400, Math.round(spec.heightMm)));
      const r = Math.max(40, Math.min(Math.floor(d / 2), Math.round(spec.cornerRadiusMm ?? d / 2)));
      const isTable = spec.kind === "capsule_table";

      // Place cleanly in front of wall or beside existing modules
      const maxRightX = curProj.modules.reduce(
        (acc, m) => Math.max(acc, m.position.x + m.dimensions.width),
        0
      );

      const newMod: import("@birim/core").ModuleInstance = {
        id,
        name:
          spec.name?.trim() ||
          (isTable ? "Birim Kapsül Tasarım Masa" : "Birim Kapsül Tamburlu Bar Dolabı"),
        category: isTable ? "kitchen_island" : "wardrobe",
        moduleFamilyId: isTable ? "fam_kitchen_base" : "fam_wardrobe",
        templateId: isTable ? "v5_capsule_dining_table_220" : "v5_capsule_bar_cabinet_120",
        position: isTable
          ? { x: Math.max(200, Math.round(maxRightX * 0.25)), y: 0, z: 1250 }
          : { x: maxRightX + 80, y: 0, z: 40 },
        dimensions: { width: w, height: h, depth: d },
        isOpenFront: isTable,
        carcass: {
          panelThickness: 18,
          backPanelThickness: 8,
          backPanelType: isTable ? "none" : "grooved",
          hullShape: isTable ? "capsule_table" : "capsule_stadium",
          cornerRadiusMm: r,
          tambourSlatPitchMm: spec.tambourSlatPitchMm || 24,
          plinthHeight: isTable ? 0 : 210,
          doorPerimeterGap: 2,
          edgeBandThickness: isTable ? 2 : 1,
          bodyMaterialId: spec.bodyMaterialId || "mat_veneer_walnut",
          doorMaterialId: spec.bodyMaterialId || "mat_veneer_walnut",
          countertopMaterialId:
            spec.topMaterialId || (isTable ? "mat_veneer_walnut" : "mat_quartz_calacatta"),
          plinthMaterialId: "mat_metal_brass",
          crossSectionProfile: isTable ? "bevel_45" : "fluted_ribbed",
          jointType: isTable ? "miter_45" : "minifix_dowel",
          ledLightingEnabled: !isTable,
          ledColorTempK: 2700,
          ledPlacementMode: "shelf_underside",
        },
        bays: [
          {
            index: 0,
            door: {
              id: `door_${id}_0`,
              bayIndex: 0,
              type: isTable ? "open" : "tambour",
              doorSystemId: isTable ? "open" : "tambour_roller",
              crossSectionProfile: isTable ? "bevel_45" : "fluted_ribbed",
              softClose: !isTable,
            },
            shelves: isTable
              ? []
              : [
                  { id: `sh_${id}_0_0`, bayIndex: 0, elevationY: Math.round((h - 240) * 0.36), isAdjustable: true },
                  { id: `sh_${id}_0_1`, bayIndex: 0, elevationY: Math.round((h - 240) * 0.68), isAdjustable: true, isGlass: true },
                ],
            hangingRails: [],
            drawers: [],
            specialFittings: [],
          },
        ],
      };

      const nextModules = [...curProj.modules, newMod];
      commitAdapterState({
        history: [...state.history.slice(-50), curProj],
        future: [],
        activeModuleIndex: nextModules.length - 1,
        project: {
          ...curProj,
          modules: nextModules,
          updatedAt: new Date().toISOString(),
        },
      });
      return newMod;
    },
    []
  );

  return {
    project,
    addCustomMaterialToProject,
    addCustomCapsuleModule,
    activeBlumEngineering,
    exportBlumBxfString,
    exportAllPanelsDxfString,
    exportNestingDxfString,
    exportErpNestingBundle,
    exportErpNestingJsonString,
    exportErpSelcoCsvString,
    exportErpGCodeString,
    importBlumBxfFile,
    applyBlumQuickWizardPreset,
    activeSpatialMetrics,
    computeWallAndModuleClearances,
    alignActiveModuleOnWall,
    distributeModulesWithGap,
    applyRoomShapePreset,
    setAllWallsSettings,
    activeModule,
    activeModuleIndex,
    activeBay,
    activeBayIndex: safeBayIndex,
    bodyMaterial,
    doorMaterial,
    viewMode,
    selectedComponentId,
    selectedModuleIds,
    doorOpenAngleDeg,
    drawerOpenMm,
    explodedFactor,
    isOrthographic,
    cameraPreset,
    validationIssues,
    v4CompatibilityReport,
    fourSpaceDimensions,
    spaceObstacles,
    spaceWalls,
    bom,
    pricing,
    smartAdvice,
    revisions,
    canUndo,
    canRedo,

    // V4 Catalog Data
    v4ModuleFamilies: V4_MODULE_FAMILIES,
    v4ModuleTemplates: V4_MODULE_TEMPLATES,
    doorSystemDefinitions: DOOR_SYSTEM_DEFINITIONS,
    handleProfiles: CACHED_HANDLE_PROFILES,
    openingMechanisms: OPENING_MECHANISM_DEFINITIONS,
    hardwareCatalog: CACHED_HARDWARE_CATALOG,
    drillingTemplates: HARDWARE_DRILLING_TEMPLATES,
    wardrobeWizards: WARDROBE_INTERIOR_WIZARDS,
    libraryAdminStore: defaultLibraryAdminStore,

    // Actions
    setActiveModuleIndex,
    setActiveBayIndex,
    setViewMode,
    setCameraPreset,
    setSelectedComponentId: handleComponentSelect,
    setDoorOpenAngleDeg,
    setDrawerOpenMm,
    setExplodedFactor,
    toggleDoorOpen,
    setOrthographic,
    cncXrayMode,
    setCncXrayMode,
    toggleCncXrayMode,
    studioSplitView,
    setStudioSplitView,
    toggleStudioSplitView,
    autoFixProjectIssues,
    continuousKitchenLayers,
    exportCamZipBytes,
    exportOptiCutCsvString,
    exportHardwareBomCsvString,
    exportNestingSvgString,
    exportThermalLabelsHtmlString,
    updateProjectTitle,
    setDimensions: (w: number, h: number, d: number) => {
      const st = useConfiguratorStore.getState();
      resizeModuleParametric(st.activeModuleIndex, w, undefined, d, h);
    },
    setPlinthHeight,
    setMaterials,
    setSelectedComponentMaterial,
    applyMaterialToSimilarComponents,
    setCountertopMaterial,
    setPlinthMaterial,
    setDoorCrossSectionProfile,
    setAdjustableLegsEnabled,
    updateCarcassConfig,
    setBayCount,
    setBayDoorType,
    setModuleSlidingMountingType,
    flipActiveDoorDirection,
    setBayV4DoorConfig,
    applyV4Template,
    dropV4TemplateWithSnap,
    applyWardrobeWizard,
    applyBayInteriorPreset,
    restoreModuleBaysSnapshot,
    applyMaterialByTargetScope,
    setModuleMaterialDetails,
    resetModuleMaterialOverrides,
    restoreModuleMaterialSnapshot,
    toggleInteriorItemHidden,
    setShelfThickness,
    equalizeBaysAndShelves,
    addInternalDrawer,
    removeBayAt,
    removeBayAndShrinkModule,
    shrinkDoubleBayToSingle,
    setModuleHingeHardware,
    setModuleDrawerRunnerHardware,
    toggleModuleLedLighting,
    applySmartWallProposal,
    distributeAlongWall,
    autoGenerateKitchenComplementary,
    attachComplementaryToActiveModule,
    applyProjectSegmentPreset,
    applyGuidedWizardLayout,
    applyQuickCabinetAtomic,
    setModuleUtilityCutouts,
    autoResolveCornerCollisions,
    addShelf,
    removeShelf,
    addHangingRail,
    removeHangingRail,
    addDrawer,
    removeDrawer,
    addSpecialFitting,
    removeSpecialFitting,
    addAdjacentModule,
    addStackedTopModule,
    duplicateActiveModule,
    removeActiveModule,
    removeModuleAt,
    removeSelectedInteriorComponent,
    deleteActiveSelectionSmart,
    moveActiveModule,
    toggleModuleSelection,
    selectAllModules,
    clearModuleSelection,
    batchMoveSelectedModules,
    batchSetSelectedModulesMaterial,
    batchRemoveSelectedModules,
    setRoomDimensions,
    updateCeilingConfig,
    setFacadeGrainContinuity,
    addWallSegment,
    updateWallSegment,
    removeWallSegment,
    addSpaceObstacle,
    updateSpaceObstacle,
    removeSpaceObstacle,
    setFloorPlanUnderlay,
    importWallsFromUnderlay,
    rotateActiveModule90,
    snapModuleToAngledWall,
    addKitchenIslandUnit,
    addOrUpdateAttachedTable,
    setModulePosition,
    resizeModuleParametric,
    swapModuleWithNeighbor,
    finishModuleDragWithSmartSwap,
    updateObstaclePosition,
    splitBayIntoTwo,
    addInteriorItemAtElevation,
    setShelfElevation,
    setDrawerPlacement,
    setSpecialFittingPlacement,
    setHangingRailElevation,
    setBayCustomWidth,
    moveInteriorItemToBay,
    addSubDivider,
    setSubDividerPlacement,
    removeSubDivider,
    saveToStorage,
    loadFromStorage,
    getSavedProjects,
    exportProjectJSON,
    importProjectJSON,
    beginHistoryTransaction,
    commitHistoryTransaction,
    createRevisionSnapshot,
    restoreRevisionSnapshot,
    diffRevisions,
    approveProduction,
    applySmartSpan,
    selectedSceneObjectId,
    setSelectedSceneObjectId,
    appendModuleWithMultiWallSnap,
    fillWallGapWithParametricModule,
    addCompositeAssemblyPreset,
    saveActiveModuleAsCustomTemplate,
    deleteCustomModuleTemplate,
    addSceneObjectFromCatalog,
    addCustomSceneObject,
    updateSceneObject,
    duplicateSceneObject,
    removeSceneObject,
    runAutoFillersAndCrown,
    runAutoNotchObstacles,
    importRoomPlanLiDARJson,
    setModuleOffsetFromLeftWall,
    undo,
    redo,
    applyTemplate,
    loadLinearKitchen,
    loadLKitchen,
    loadUKitchen,
    resetToDefault,
    unifiedEngineeringReport,
    ergonomicProfileId,
    setErgonomicProfileId,
    applyApprovedEngineeringFix,
    regionalErgonomicProfiles: REGIONAL_ERGONOMIC_PROFILES,
  };
}

export type { EngineeringValidationFinding, RemediationProposal, RegionErgonomicProfileId };
