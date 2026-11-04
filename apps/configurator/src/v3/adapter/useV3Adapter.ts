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
  const setDimensions = useConfiguratorStore((s) => s.setDimensions);
  const setPlinthHeight = useConfiguratorStore((s) => s.setPlinthHeight);
  const setMaterials = useConfiguratorStore((s) => s.setMaterials);
  const setBayCount = useConfiguratorStore((s) => s.setBayCount);
  const setBayDoorType = useConfiguratorStore((s) => s.setBayDoorType);

  const addShelf = useConfiguratorStore((s) => s.addShelf);
  const removeShelf = useConfiguratorStore((s) => s.removeShelf);
  const addHangingRail = useConfiguratorStore((s) => s.addHangingRail);
  const removeHangingRail = useConfiguratorStore((s) => s.removeHangingRail);
  const addDrawer = useConfiguratorStore((s) => s.addDrawer);
  const removeDrawer = useConfiguratorStore((s) => s.removeDrawer);
  const addSpecialFitting = useConfiguratorStore((s) => s.addSpecialFitting);
  const removeSpecialFitting = useConfiguratorStore((s) => s.removeSpecialFitting);

  const addAdjacentModule = useConfiguratorStore((s) => s.addAdjacentModule);
  const duplicateActiveModule = useConfiguratorStore((s) => s.duplicateActiveModule);
  const removeActiveModule = useConfiguratorStore((s) => s.removeActiveModule);
  const moveActiveModule = useConfiguratorStore((s) => s.moveActiveModule);

  const saveToStorage = useConfiguratorStore((s) => s.saveToStorage);
  const loadFromStorage = useConfiguratorStore((s) => s.loadFromStorage);
  const getSavedProjects = useConfiguratorStore((s) => s.getSavedProjects);
  const exportProjectJSON = useConfiguratorStore((s) => s.exportProjectJSON);
  const importProjectJSON = useConfiguratorStore((s) => s.importProjectJSON);
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
  const rotateActiveModule90 = useCallback(() => {
    const state = useConfiguratorStore.getState();
    const curProj = state.project;
    const idx = state.activeModuleIndex;
    const mod = curProj.modules[idx];
    if (!mod) return;

    const curRotY = mod.rotation?.y || 0;
    const nextRotY = (curRotY + 90) % 360;
    const nextMods = curProj.modules.map((m, i) =>
      i === idx
        ? {
            ...m,
            isCorner: nextRotY === 90 || nextRotY === 270,
            rotation: { x: 0, y: nextRotY, z: 0 },
          }
        : m
    );
    useConfiguratorStore.setState({
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

      const clampedX = Math.max(0, snappedX);
      const clampedZ = Math.max(0, snappedZ);
      if (target.position.x === clampedX && target.position.z === clampedZ) return;

      const nextMods = curProj.modules.map((m, idx) =>
        idx === modIdx
          ? { ...m, position: { ...m.position, x: clampedX, z: clampedZ } }
          : m
      );
      useConfiguratorStore.setState({
        activeModuleIndex: modIdx,
        project: { ...curProj, modules: nextMods, updatedAt: new Date().toISOString() },
      });
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
    useConfiguratorStore.setState({
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
    useConfiguratorStore.setState({
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
    useConfiguratorStore.setState({
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
  const updateObstaclePosition = useCallback((obsId: string, newX: number) => {
    const curProj = useConfiguratorStore.getState().project;
    const currentElements: ArchitecturalElement[] =
      curProj.space.elements.length > 0
        ? curProj.space.elements
        : getEffectiveSpaceObstacles(curProj);
    const updatedElements = currentElements.map((el) =>
      el.id === obsId
        ? { ...el, position: { ...el.position, x: Math.max(0, Math.round(newX)) } }
        : el
    );
    useConfiguratorStore.setState({
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
        version: (curProj.version || 1) + 1,
        updatedAt: new Date().toISOString(),
        modules: nextModules,
      };
      const nextIssues = validateProject(nextProj);
      const nextBom = generateBOMForProject(nextProj);
      const nextPricing = calculateProjectPrice(nextBom);

      useConfiguratorStore.setState({
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
  const setBayV4DoorConfig = useCallback(
    (
      bayIdx: number,
      updates: {
        doorSystemId?: DoorSystemId;
        overlayType?: DoorOverlayType;
        handleCategory?: HandleCategory;
        openingTechnology?: OpeningTechnology;
        hardwareProductId?: string;
      }
    ) => {
      commitActiveModuleUpdate((mod) => {
        const bay = mod.bays[bayIdx];
        if (!bay) return mod;
        const nextDoor = { ...bay.door, ...updates };
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

    useConfiguratorStore.setState({
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

    useConfiguratorStore.setState({
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

    useConfiguratorStore.setState({
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
    const nextModules = generateKitchenComplementaryModules(curProj.modules);
    const nextProj = {
      ...curProj,
      version: (curProj.version || 1) + 1,
      updatedAt: new Date().toISOString(),
      modules: nextModules,
    };
    const nextIssues = validateProject(nextProj);
    const nextBom = generateBOMForProject(nextProj);
    const nextPricing = calculateProjectPrice(nextBom);

    useConfiguratorStore.setState({
      history: [...state.history.slice(-15), curProj],
      future: [],
      project: nextProj,
      validationIssues: nextIssues,
      bom: nextBom,
      pricing: nextPricing,
    });
  }, []);

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
      pushHistory = true
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
          return { ...d, elevationY: y, height: h };
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
    (bayIdx: number) => {
      commitActiveModuleUpdate((mod) => {
        const bay = mod.bays[bayIdx];
        if (!bay) return mod;
        const bayWidths = calculateBayWidths(mod);
        const bayW = bayWidths[bayIdx] || 600;
        const T = mod.carcass.panelThickness || 18;
        const sortedShelves = [...bay.shelves].sort((a, b) => a.elevationY - b.elevationY);

        let elevY = 0;
        let spanH = 350;
        if (sortedShelves.length >= 2) {
          elevY = sortedShelves[0].elevationY + T;
          spanH = Math.max(120, sortedShelves[1].elevationY - elevY);
        } else if (sortedShelves.length === 1) {
          elevY = 0;
          spanH = Math.max(120, sortedShelves[0].elevationY);
        }

        const existingCount = bay.subDividers?.length || 0;
        const defaultOffsetX = Math.round(bayW / 2 - T / 2 + existingCount * 80);
        const clampedX = Math.max(50, Math.min(Math.max(80, bayW - T - 50), defaultOffsetX));

        if (!bay.subDividers) bay.subDividers = [];
        bay.subDividers.push({
          id: `subdiv_${bayIdx}_${Date.now()}`,
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
    setDimensions,
    setPlinthHeight,
    setMaterials,
    setBayCount,
    setBayDoorType,
    setBayV4DoorConfig,
    applyV4Template,
    applyWardrobeWizard,
    applySmartWallProposal,
    distributeAlongWall,
    autoGenerateKitchenComplementary,
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
    moveActiveModule,
    rotateActiveModule90,
    setModulePosition,
    updateObstaclePosition,
    setShelfElevation,
    setDrawerPlacement,
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
