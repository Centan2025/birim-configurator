"use client";
import { useCallback } from "react";
import { useConfiguratorStore } from "../../../store/useConfiguratorStore";
import { getAdaptiveMaxHistoryEntries } from "../../../store/storeHelpers";
import { type ArchitecturalElement, type DoorSystemId, type SlidingMountingType, type DoorOverlayType, type HandleCategory } from "@birim/core";
import { generateModuleGeometry } from "@birim/geometry";
import { getEffectiveSpaceObstacles } from "../../engine/kitchenSpatialEngine";
import { commitAdapterState, EMPTY_VALIDATION_ISSUES, EMPTY_REVISIONS } from "../adapterMathAndCache";


export function useAdapterStoreAndCoreBindings(ctx: { options?: { lightweightViewport?: boolean } }) {
  const { options } = ctx;
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
        history: [...state.history.slice(-getAdaptiveMaxHistoryEntries()), curProj],
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
        history: [...state.history.slice(-getAdaptiveMaxHistoryEntries()), curProj],
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
        history: [...state.history.slice(-getAdaptiveMaxHistoryEntries()), curProj],
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
    (patch: Partial<import("@birim/core").CarcassConfig>, applyToAllModules?: boolean) => {
      const state = useConfiguratorStore.getState();
      const curProj = state.project;
      const mod = curProj.modules[state.activeModuleIndex];
      if (!mod) return;
      const nextModules = curProj.modules.map((m, idx) => {
        if (applyToAllModules) {
          if (m.category === "complementary") return m;
        } else if (idx !== state.activeModuleIndex) {
          return m;
        }
        const nextBoxSys = patch.drawerBoxSystem;
        const nextBays = nextBoxSys
          ? m.bays.map((b) => ({
              ...b,
              drawers: (b.drawers || []).map((dr) => ({
                ...dr,
                boxSystemType: nextBoxSys,
                hardwareProductId:
                  nextBoxSys === "wooden_undermount"
                    ? "hw_blum_movento_760h"
                    : nextBoxSys === "metal_box_legrabox"
                    ? dr.height >= 205
                      ? "hw_blum_legrabox_c70"
                      : "hw_blum_legrabox_m40"
                    : nextBoxSys === "metal_box_tandembox"
                    ? dr.height >= 205
                      ? "hw_blum_tandembox_d65"
                      : "hw_blum_tandembox_m30"
                    : nextBoxSys === "metal_box_avantech"
                    ? "hw_hettich_avantech_m"
                    : dr.hardwareProductId,
              })),
            }))
          : m.bays;
        return {
          ...m,
          carcass: {
            ...m.carcass,
            ...patch,
          },
          bays: nextBays,
        };
      });
      commitAdapterState({
        history: [...state.history.slice(-getAdaptiveMaxHistoryEntries()), curProj],
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
        history: [...state.history.slice(-getAdaptiveMaxHistoryEntries()), curProj],
        future: [],
        project: nextProj,
      });
    },
    []
  );

  const addShelf = useConfiguratorStore((s) => s.addShelf);
  const addFixedShelf = useConfiguratorStore((s) => s.addFixedShelf);
  const setShelfMountType = useConfiguratorStore((s) => s.setShelfMountType);
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
  const runAutoNotchObstaclesRaw = useConfiguratorStore((s) => s.runAutoNotchObstacles);
  const runAutoNotchObstacles = useCallback(() => {
    ensureObstaclesSeeded();
    return runAutoNotchObstaclesRaw();
  }, [ensureObstaclesSeeded, runAutoNotchObstaclesRaw]);
  const importRoomPlanLiDARJson = useConfiguratorStore((s) => s.importRoomPlanLiDARJson);
  const setModuleOffsetFromLeftWall = useConfiguratorStore((s) => s.setModuleOffsetFromLeftWall);

  const undo = useConfiguratorStore((s) => s.undo);
  const redo = useConfiguratorStore((s) => s.redo);
  const applyTemplate = useConfiguratorStore((s) => s.applyTemplate);
  const loadLinearKitchenBase = useConfiguratorStore((s) => s.loadLinearKitchen);
  const loadLKitchenBase = useConfiguratorStore((s) => s.loadLKitchen);
  const loadUKitchenBase = useConfiguratorStore((s) => s.loadUKitchen);
  const resetToDefault = useConfiguratorStore((s) => s.resetToDefault);

  return {
    isLite,
    project,
    activeModuleIndex,
    activeBayIndex,
    viewMode,
    selectedComponentId,
    selectedModuleIds,
    doorOpenAngleDeg,
    drawerOpenMm,
    explodedFactor,
    isOrthographic,
    cncXrayMode,
    setCncXrayMode,
    toggleCncXrayMode,
    studioSplitView,
    setStudioSplitView,
    toggleStudioSplitView,
    autoFixProjectIssues,
    cameraPreset,
    baseValidationIssues,
    bom,
    pricing,
    smartAdvice,
    canUndo,
    canRedo,
    revisions,
    setActiveModuleIndex,
    setActiveBayIndex,
    setViewMode,
    setCameraPreset,
    setSelectedComponentId,
    setDoorOpenAngleDeg,
    setDrawerOpenMm,
    setExplodedFactor,
    toggleDoorOpen,
    setOrthographic,
    updateProjectTitle,
    setPlinthHeight,
    setMaterials,
    setSelectedComponentMaterial,
    applyMaterialToSimilarComponents,
    setDoorCrossSectionProfile,
    updateCarcassConfig,
    setAdjustableLegsEnabled,
    setPlinthMaterial,
    setCountertopMaterial,
    setBayCount,
    setBayDoorType,
    setModuleSlidingMountingType,
    addShelf,
    addFixedShelf,
    setShelfMountType,
    removeShelf,
    addHangingRail,
    removeHangingRail,
    addDrawer,
    removeDrawer,
    addSpecialFittingStore,
    removeSpecialFitting,
    addAdjacentModule,
    addStackedTopModule,
    duplicateActiveModule,
    removeActiveModule,
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
    loadLinearKitchenBase,
    loadLKitchenBase,
    loadUKitchenBase,
    resetToDefault,
  };
}
