import { useMemo, useCallback } from "react";
import { useConfiguratorStore } from "../../store/useConfiguratorStore";
import {
  DEFAULT_MATERIALS,
  MaterialDefinition,
  ModuleInstance,
  ArchitecturalElement,
  calculateBayWidths,
  calculateNetInnerHeight,
  validateProject,
  calculateFourSpaceDimensions,
  evaluateProjectCompatibility,
  DoorSystemId,
  DoorOverlayType,
  HandleCategory,
  OpeningTechnology,
} from "@birim/core";
import {
  analyzeAndAdviseSpan,
  WARDROBE_TEMPLATES,
  KITCHEN_TEMPLATES,
  V4_MODULE_FAMILIES,
  V4_MODULE_TEMPLATES,
  DOOR_SYSTEM_DEFINITIONS,
  HANDLE_PROFILES,
  OPENING_MECHANISM_DEFINITIONS,
  V4_HARDWARE_CATALOG,
  WARDROBE_INTERIOR_WIZARDS,
  WardrobeInteriorWizardId,
  getV4TemplateById,
  generateSmartWallLayouts,
  distributeModulesAlongWall,
  applyWardrobeInteriorWizard,
  generateKitchenComplementaryModules,
  defaultLibraryAdminStore,
} from "@birim/catalog";
import { generateBOMForProject } from "@birim/manufacturing";
import { calculateProjectPrice } from "@birim/pricing";
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
  KITCHEN_ENGINEERING_RULE_REGISTRY,
  setActiveDraggedTemplateId,
  getActiveDraggedTemplateId,
  startModuleSilhouetteDrag,
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
  KITCHEN_ENGINEERING_RULE_REGISTRY,
};

export {
  setActiveDraggedTemplateId,
  getActiveDraggedTemplateId,
  startModuleSilhouetteDrag,
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


/** One transaction for adapter edits; derived manufacturing state cannot lag geometry. */
function commitAdapterState(patch: Partial<ReturnType<typeof useConfiguratorStore.getState>>) {
  const state = useConfiguratorStore.getState();
  if (!patch.project) { useConfiguratorStore.setState(patch); return; }
  const project = { ...patch.project, status: "draft" as const, version: Math.max(state.project.version + 1, patch.project.version), updatedAt: new Date().toISOString() };
  const bom = generateBOMForProject(project);
  const active = project.modules[patch.activeModuleIndex ?? state.activeModuleIndex] ?? project.modules[0];
  useConfiguratorStore.setState({ ...patch, project, bom, pricing: calculateProjectPrice(bom), validationIssues: validateProject(project),
    smartAdvice: analyzeAndAdviseSpan(active.dimensions.width, active.dimensions.height), autoSaveStatus: "unsaved",
    history: patch.history ?? [...state.history.slice(-15), state.project], future: patch.future ?? [],
  });
}

/**
 * Safe V3.1 + V4 Universal Library Adapter over the Configurator Store.
 * Includes spatial & kitchen engineering rules, 90° corner rotation support,
 * architectural obstacle management, and V4 Universal Module & Hardware Library.
 */
export function useV3Adapter() {
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
  const cameraPreset = useConfiguratorStore((s) => s.cameraPreset);
  const baseValidationIssues = useConfiguratorStore((s) => s.validationIssues);
  const bom = useConfiguratorStore((s) => s.bom);
  const pricing = useConfiguratorStore((s) => s.pricing);
  const smartAdvice = useConfiguratorStore((s) => s.smartAdvice);
  const history = useConfiguratorStore((s) => s.history);
  const future = useConfiguratorStore((s) => s.future);
  const revisions = useConfiguratorStore((s) => s.revisions);

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
        history: [...state.history.slice(-15), curProj],
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
  const setPlinthMaterial = useCallback((materialId: string) => {
    const state = useConfiguratorStore.getState();
    const curProj = state.project;
    const mod = curProj.modules[state.activeModuleIndex];
    if (!mod) return;
    const nextOverrides = { ...(mod.componentMaterialOverrides || {}), __plinth__: materialId };
    const nextModules = curProj.modules.map((m, idx) =>
      idx === state.activeModuleIndex ? { ...m, componentMaterialOverrides: nextOverrides } : m
    );
    commitAdapterState({
      history: [...state.history.slice(-15), curProj],
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
      history: [...state.history.slice(-15), curProj],
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

  const addShelf = useConfiguratorStore((s) => s.addShelf);
  const removeShelf = useConfiguratorStore((s) => s.removeShelf);
  const addHangingRail = useConfiguratorStore((s) => s.addHangingRail);
  const removeHangingRail = useConfiguratorStore((s) => s.removeHangingRail);
  const addDrawer = useConfiguratorStore((s) => s.addDrawer);
  const removeDrawer = useConfiguratorStore((s) => s.removeDrawer);
  const addSpecialFittingStore = useConfiguratorStore((s) => s.addSpecialFitting);
  const removeSpecialFitting = useConfiguratorStore((s) => s.removeSpecialFitting);

  const addAdjacentModule = useConfiguratorStore((s) => s.addAdjacentModule);
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
          space: { ...curProj.space, elements: remaining },
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

  const undo = useConfiguratorStore((s) => s.undo);
  const redo = useConfiguratorStore((s) => s.redo);
  const applyTemplate = useConfiguratorStore((s) => s.applyTemplate);
  const loadLinearKitchenBase = useConfiguratorStore((s) => s.loadLinearKitchen);
  const loadLKitchenBase = useConfiguratorStore((s) => s.loadLKitchen);
  const loadUKitchenBase = useConfiguratorStore((s) => s.loadUKitchen);
  const resetToDefault = useConfiguratorStore((s) => s.resetToDefault);

  const activeModule: ModuleInstance =
    project.modules[activeModuleIndex] || project.modules[0];
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
    () => (activeModule ? calculateFourSpaceDimensions(activeModule) : null),
    [activeModule]
  );
  const v4CompatibilityReport = useMemo(
    () => evaluateProjectCompatibility(project),
    [project]
  );

  // Spatial obstacles & walls
  const spaceObstacles = useMemo(() => getEffectiveSpaceObstacles(project), [project]);
  const spaceWalls = useMemo(() => getEffectiveSpaceWalls(project), [project]);
  const spatialIssues = useMemo(
    () => validateSpatialAndKitchenEngineering(project),
    [project]
  );

  const validationIssues = useMemo(() => {
    const seen = new Set<string>();
    const combined = [...baseValidationIssues, ...spatialIssues, ...v4CompatibilityReport.issues];
    return combined.filter((item) => {
      const k = `${item.code}_${item.targetId || ""}`;
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    });
  }, [baseValidationIssues, spatialIssues, v4CompatibilityReport.issues]);

  /**
   * Fast component selection handler
   */
  const handleComponentSelect = useCallback(
    (compId: string | null) => {
      setSelectedComponentId(compId);
      if (!compId) return;

      const curProj = useConfiguratorStore.getState().project;
      const curModIdx = useConfiguratorStore.getState().activeModuleIndex;
      for (let mIdx = 0; mIdx < curProj.modules.length; mIdx++) {
        const mod = curProj.modules[mIdx];
        if (compId.startsWith(mod.id) || compId.includes(`_${mIdx}_`)) {
          if (mIdx !== curModIdx) {
            setActiveModuleIndex(mIdx);
          }
          return;
        }
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
  const rotateActiveModule90 = useCallback((deltaDeg = 90) => {
    const state = useConfiguratorStore.getState();
    const curProj = state.project;
    const idx = state.activeModuleIndex;
    const mod = curProj.modules[idx];
    if (!mod) return;

    const delta = typeof deltaDeg === "number" ? deltaDeg : 90;
    const curRotY = mod.rotation?.y || 0;
    const nextRotY = (((curRotY + delta) % 360) + 360) % 360;
    const nextMods = curProj.modules.map((m, i) =>
      i === idx
        ? {
            ...m,
            rotation: { x: 0, y: nextRotY, z: 0 },
          }
        : m
    );
    commitAdapterState({
      history: [...state.history.slice(-15), curProj],
      future: [],
      project: { ...curProj, modules: nextMods, updatedAt: new Date().toISOString() },
    });
  }, []);

  /**
   * Move a specific module to an exact X, Z position in the room (with optional snap)
   */
  const setModulePosition = useCallback(
    (modIdx: number, x: number, z: number, snapMm = 50) => {
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
      const dx = clampedX - target.position.x;
      const dz = clampedZ - target.position.z;
      if (dx === 0 && dz === 0) return;
      const nextMods = curProj.modules.map((m, idx) => {
        if (idx === modIdx) {
          return { ...m, position: { ...m.position, x: clampedX, z: clampedZ } };
        }
        if (m.category === "complementary" && m.id.startsWith(attachedPrefix)) {
          return {
            ...m,
            position: {
              ...m.position,
              x: Math.max(0, m.position.x + dx),
              z: Math.max(0, m.position.z + dz),
            },
          };
        }
        return m;
      });
      commitAdapterState({
        activeModuleIndex: modIdx,
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
            bayDoorPlan = ["single_left"];
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
        history: [...curState.history.slice(-15), curProj],
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
    (modIdx: number, startModX: number): string | null => {
      const curState = useConfiguratorStore.getState();
      const curProj = curState.project;
      const dragged = curProj.modules[modIdx];
      if (!dragged || dragged.category === "complementary") return null;

      const isWallCab =
        dragged.category === "kitchen_wall" || dragged.moduleFamilyId === "fam_kitchen_wall";
      const dragW = dragged.dimensions.width;
      const dragCenter = dragged.position.x + dragW / 2;

      // Find if dragged module overlaps any same-row module by more than 25% of width
      for (let i = 0; i < curProj.modules.length; i++) {
        if (i === modIdx) continue;
        const other = curProj.modules[i];
        if (other.category === "complementary") continue;
        const oIsWall =
          other.category === "kitchen_wall" || other.moduleFamilyId === "fam_kitchen_wall";
        if (oIsWall !== isWallCab || (other.rotation?.y || 0) !== (dragged.rotation?.y || 0)) {
          continue;
        }
        const otherW = other.dimensions.width;
        const overlap =
          Math.min(dragged.position.x + dragW, other.position.x + otherW) -
          Math.max(dragged.position.x, other.position.x);

        if (overlap > Math.min(dragW, otherW) * 0.22) {
          const nextMods = JSON.parse(JSON.stringify(curProj.modules)) as ModuleInstance[];
          // Determine whether user dragged from left-to-right or right-to-left
          if (startModX <= other.position.x) {
            const baseLeft = startModX;
            nextMods[i].position.x = baseLeft;
            nextMods[modIdx].position.x = baseLeft + otherW;
          } else {
            const baseLeft = other.position.x;
            nextMods[modIdx].position.x = baseLeft;
            nextMods[i].position.x = baseLeft + dragW;
          }
          // Swap array order if needed so visual left-to-right matches index
          if (
            (modIdx < i && nextMods[modIdx].position.x > nextMods[i].position.x) ||
            (modIdx > i && nextMods[modIdx].position.x < nextMods[i].position.x)
          ) {
            const tmp = nextMods[modIdx];
            nextMods[modIdx] = nextMods[i];
            nextMods[i] = tmp;
            commitAdapterState({
              activeModuleIndex: i,
              project: { ...curProj, modules: nextMods, updatedAt: new Date().toISOString() },
            });
          } else {
            commitAdapterState({
              activeModuleIndex: modIdx,
              project: { ...curProj, modules: nextMods, updatedAt: new Date().toISOString() },
            });
          }
          return `🔄 "${dragged.name}" ile "${other.name}" otomatik yer değiştirdi`;
        }
      }
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
          isCorner: true,
          cornerAngleDeg: 90,
          position: { x: 0, y: 0, z: 650 },
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
          isCorner: true,
          cornerAngleDeg: 90,
          position: { x: 0, y: 0, z: 650 },
          rotation: { x: 0, y: 90, z: 0 },
        };
      }
      if (m.id === "u_arm_right") {
        return {
          ...m,
          isCorner: true,
          cornerAngleDeg: 270,
          position: { x: 1820, y: 0, z: 650 },
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
      history: state.batchStartProject ? state.history : [...state.history.slice(-15), curProj],
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
        carcass: { ...targetMod.carcass },
        bays: targetMod.bays.map((b) => ({
          ...b,
          door: { ...b.door },
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
      const nextIssues = validateProject(nextProj);
      const nextBom = generateBOMForProject(nextProj);
      const nextPricing = calculateProjectPrice(nextBom);

      commitAdapterState({
        history: pushHistory ? [...state.history.slice(-15), curProj] : state.history,
        future: pushHistory ? [] : state.future,
        project: nextProj,
        validationIssues: nextIssues,
        bom: nextBom,
        pricing: nextPricing,
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
        openingTechnology?: OpeningTechnology;
        hardwareProductId?: string;
        hingeCount?: number;
        hingeBottomOffsetMm?: number;
        hingeTopOffsetMm?: number;
      }
    ) => {
      commitActiveModuleUpdate((mod) => {
        const bay = mod.bays[bayIdx];
        if (!bay) return mod;
        const nextDoor = { ...bay.door, ...updates };
        if (updates.handleCategory) nextDoor.handleProfileId = undefined;
        if (updates.doorSystemId) {
          mod.isOpenFront = updates.doorSystemId === "open";
          const types: Partial<Record<DoorSystemId, typeof nextDoor.type>> = { open: "open", hinged_single: "single_left", hinged_double: "double", hinged_inset: "inset_left", hinged_overlay_variant: "half_overlay_left", sliding_top_hung: "sliding", sliding_bottom_rolling: "sliding_bottom", lift_up_stay: "lift_up_stay", lift_parallel: "lift_parallel", lift_bi_fold: "lift_bi_fold", folding_side: "folding", pocket_retractable: "pocket", tambour_roller: "tambour" };
          nextDoor.type = types[updates.doorSystemId] ?? "single_left";
          nextDoor.overlayType = updates.doorSystemId === "hinged_inset" ? "inset" : updates.doorSystemId === "hinged_overlay_variant" ? "half_overlay" : "full_overlay";
        }
        if (updates.doorSystemId) {
          if (updates.doorSystemId === "hinged_double") nextDoor.type = "double";
          else if (updates.doorSystemId === "hinged_single") nextDoor.type = "single_left";
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

  /**
   * V4: Instantiate any of the 92 V4 Parametric Module Templates
   */
  const dropV4TemplateWithSnap = useCallback(
    (
      templateId: string,
      dropWorldXMm?: number
    ): { placedName: string; snappedX: number; snappedY: number; snapLabel: string } | null => {
      const tpl =
        getV4TemplateById(templateId) ||
        WARDROBE_TEMPLATES.find((w) => w.templateId === templateId) ||
        KITCHEN_TEMPLATES.find((k) => k.templateId === templateId);
      if (!tpl) return null;

      const state = useConfiguratorStore.getState();
      const curProj = state.project;
      const newMod = tpl.createInstance(`mod_${Date.now()}`);
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
        if (compType !== "worktop" && compType !== "backsplash" && compType !== "waterfall_right") {
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
          history: [...state.history.slice(-15), curProj],
          future: [],
          project: nextProj,
          validationIssues: validateProject(nextProj),
          bom: generateBOMForProject(nextProj),
          pricing: calculateProjectPrice(generateBOMForProject(nextProj)),
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

      const sameRowMods = curProj.modules.filter((m) => {
        if (m.category === "complementary") return false;
        const mIsWall = m.category === "kitchen_wall" || m.moduleFamilyId === "fam_kitchen_wall";
        return mIsWall === isWallCab && (m.rotation?.y || 0) === 0;
      });

      const overlapsAt = (candX: number) =>
        sameRowMods.some(
          (m) =>
            candX < m.position.x + m.dimensions.width - 2 &&
            candX + newMod.dimensions.width > m.position.x + 2
        );

      const snapCandidates: { x: number; label: string }[] = [
        { x: 0, label: "Duvar Başlangıcı (X: 0mm)" },
      ];
      sameRowMods.forEach((m, idx) => {
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
          sameRowMods.length > 0
            ? Math.max(...sameRowMods.map((m) => m.position.x + m.dimensions.width))
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

      newMod.position = { x: chosen.x, y: targetY, z: 0 };
      const nextModules = [...curProj.modules, newMod];
      const nextProj = {
        ...curProj,
        version: (curProj.version || 1) + 1,
        updatedAt: new Date().toISOString(),
        modules: nextModules,
      };
      const nextIssues = validateProject(nextProj);
      const nextBom = generateBOMForProject(nextProj);
      const nextPricing = calculateProjectPrice(nextBom);

      commitAdapterState({
        history: [...state.history.slice(-15), curProj],
        future: [],
        project: nextProj,
        activeModuleIndex: nextModules.length - 1,
        activeBayIndex: 0,
        validationIssues: nextIssues,
        bom: nextBom,
        pricing: nextPricing,
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

  const applyV4Template = useCallback((templateId: string, appendToProject = false) => {
    const tpl = getV4TemplateById(templateId);
    if (!tpl) return;
    const state = useConfiguratorStore.getState();
    const curProj = state.project;
    const lastMod = curProj.modules[curProj.modules.length - 1];
    const nextX = appendToProject && lastMod ? lastMod.position.x + lastMod.dimensions.width : 0;
    const newMod = tpl.createInstance(`mod_${Date.now()}`);
    newMod.position = { ...newMod.position, x: nextX };

    const nextModules = appendToProject ? [...curProj.modules, newMod] : [newMod];
    const nextProj = {
      ...curProj,
      version: (curProj.version || 1) + 1,
      updatedAt: new Date().toISOString(),
      modules: nextModules,
    };
    const nextIssues = validateProject(nextProj);
    const nextBom = generateBOMForProject(nextProj);
    const nextPricing = calculateProjectPrice(nextBom);

    commitAdapterState({
      history: [...state.history.slice(-15), curProj],
      future: [],
      project: nextProj,
      activeModuleIndex: nextModules.length - 1,
      activeBayIndex: 0,
      validationIssues: nextIssues,
      bom: nextBom,
      pricing: nextPricing,
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
          history: [...state.history.slice(-15), curProj],
          future: [],
          project: nextProj,
          validationIssues: validateProject(nextProj),
          bom: generateBOMForProject(nextProj),
          pricing: calculateProjectPrice(generateBOMForProject(nextProj)),
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
        history: [...state.history.slice(-15), curProj],
        future: [],
        project: nextProj,
        validationIssues: validateProject(nextProj),
        bom: generateBOMForProject(nextProj),
        pricing: calculateProjectPrice(generateBOMForProject(nextProj)),
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
    const nextIssues = validateProject(nextProj);
    const nextBom = generateBOMForProject(nextProj);
    const nextPricing = calculateProjectPrice(nextBom);

    commitAdapterState({
      history: [...state.history.slice(-15), curProj],
      future: [],
      project: nextProj,
      activeModuleIndex: 0,
      activeBayIndex: 0,
      validationIssues: nextIssues,
      bom: nextBom,
      pricing: nextPricing,
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
    const nextIssues = validateProject(nextProj);
    const nextBom = generateBOMForProject(nextProj);
    const nextPricing = calculateProjectPrice(nextBom);

    commitAdapterState({
      history: [...state.history.slice(-15), curProj],
      future: [],
      project: nextProj,
      validationIssues: nextIssues,
      bom: nextBom,
      pricing: nextPricing,
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
    const nextIssues = validateProject(nextProj);
    const nextBom = generateBOMForProject(nextProj);
    const nextPricing = calculateProjectPrice(nextBom);

    commitAdapterState({
      history: [...state.history.slice(-15), curProj],
      future: [],
      project: nextProj,
      validationIssues: nextIssues,
      bom: nextBom,
      pricing: nextPricing,
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
   * Update Shelf Elevation Y (in mm from inner bottom panel) by manual drag or exact numeric input
   */
  const setShelfElevation = useCallback(
    (bayIdx: number, shelfId: string, elevationY: number, pushHistory = true) => {
      commitActiveModuleUpdate((mod) => {
        const netH = calculateNetInnerHeight(mod);
        const clampedY = Math.max(60, Math.min(Math.max(100, netH - 60), Math.round(elevationY)));
        const bay = mod.bays[bayIdx];
        if (!bay) return mod;
        bay.shelves = bay.shelves.map((s) =>
          s.id === shelfId ? { ...s, elevationY: clampedY } : s
        );
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
        const sortedShelves = [...bay.shelves].sort((a, b) => a.elevationY - b.elevationY);

        let elevY = 0;
        let spanH = Math.min(350, netH);
        if (customSpan && typeof customSpan.elevationY === "number" && typeof customSpan.height === "number") {
          elevY = Math.max(0, Math.round(customSpan.elevationY));
          spanH = Math.max(60, Math.min(netH - elevY, Math.round(customSpan.height)));
        } else if (sortedShelves.length >= 2) {
          elevY = sortedShelves[0].elevationY + T;
          spanH = Math.max(120, sortedShelves[1].elevationY - elevY);
        } else if (sortedShelves.length === 1) {
          elevY = 0;
          spanH = Math.max(120, sortedShelves[0].elevationY);
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
   * Update a partial vertical sub-divider's horizontal offsetX, bottom elevationY, or span height
   */
  const setSubDividerPlacement = useCallback(
    (
      bayIdx: number,
      subDividerId: string,
      updates: { offsetX?: number; elevationY?: number; height?: number },
      pushHistory = true
    ) => {
      commitActiveModuleUpdate((mod) => {
        const bay = mod.bays[bayIdx];
        if (!bay || !bay.subDividers) return mod;
        const bayWidths = calculateBayWidths(mod);
        const bayW = bayWidths[bayIdx] || 600;
        const netH = calculateNetInnerHeight(mod);
        const T = mod.carcass.panelThickness || 18;

        bay.subDividers = bay.subDividers.map((sd) => {
          if (sd.id !== subDividerId) return sd;
          const nextX =
            typeof updates.offsetX === "number"
              ? Math.max(40, Math.min(Math.max(60, bayW - T - 40), Math.round(updates.offsetX)))
              : sd.offsetX;
          const nextH =
            typeof updates.height === "number"
              ? Math.max(80, Math.min(netH, Math.round(updates.height)))
              : sd.height;
          const nextY =
            typeof updates.elevationY === "number"
              ? Math.max(0, Math.min(Math.max(0, netH - nextH), Math.round(updates.elevationY)))
              : sd.elevationY;
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
  const removeModuleAt = useCallback((modIdx: number) => {
    const state = useConfiguratorStore.getState();
    if (state.project.modules.length <= 1) return;
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

  return {
    project,
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
    canUndo: history.length > 0,
    canRedo: future.length > 0,

    // V4 Catalog Data
    v4ModuleFamilies: V4_MODULE_FAMILIES,
    v4ModuleTemplates: V4_MODULE_TEMPLATES,
    doorSystemDefinitions: DOOR_SYSTEM_DEFINITIONS,
    handleProfiles: HANDLE_PROFILES,
    openingMechanisms: OPENING_MECHANISM_DEFINITIONS,
    hardwareCatalog: V4_HARDWARE_CATALOG,
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
    updateProjectTitle,
    setDimensions: (w: number, h: number, d: number) => {
      const st = useConfiguratorStore.getState();
      resizeModuleParametric(st.activeModuleIndex, w, undefined, d, h);
    },
    setPlinthHeight,
    setMaterials,
    setSelectedComponentMaterial,
    setCountertopMaterial,
    setPlinthMaterial,
    setBayCount,
    setBayDoorType,
    flipActiveDoorDirection,
    setBayV4DoorConfig,
    applyV4Template,
    dropV4TemplateWithSnap,
    applyWardrobeWizard,
    applySmartWallProposal,
    distributeAlongWall,
    autoGenerateKitchenComplementary,
    attachComplementaryToActiveModule,
    applyProjectSegmentPreset,
    addShelf,
    removeShelf,
    addHangingRail,
    removeHangingRail,
    addDrawer,
    removeDrawer,
    addSpecialFitting,
    removeSpecialFitting,
    addAdjacentModule,
    duplicateActiveModule,
    removeActiveModule,
    removeModuleAt,
    removeSelectedInteriorComponent,
    moveActiveModule,
    toggleModuleSelection,
    selectAllModules,
    clearModuleSelection,
    batchMoveSelectedModules,
    batchSetSelectedModulesMaterial,
    batchRemoveSelectedModules,
    setRoomDimensions,
    addWallSegment,
    updateWallSegment,
    removeWallSegment,
    addSpaceObstacle,
    updateSpaceObstacle,
    removeSpaceObstacle,
    setFloorPlanUnderlay,
    importWallsFromUnderlay,
    rotateActiveModule90,
    setModulePosition,
    resizeModuleParametric,
    swapModuleWithNeighbor,
    finishModuleDragWithSmartSwap,
    updateObstaclePosition,
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
    undo,
    redo,
    applyTemplate,
    loadLinearKitchen,
    loadLKitchen,
    loadUKitchen,
    resetToDefault,
  };
}
