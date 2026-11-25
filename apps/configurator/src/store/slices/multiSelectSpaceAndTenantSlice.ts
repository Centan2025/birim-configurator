import type { StoreApi } from "zustand";
import { DesignProject, ArchitecturalElement, WallDefinition, convertUnderlayPolylinesToWalls, syncProjectCustomMaterials, type MaterialDefinition, applyTenantConstructionToModule, getTenantProfileByIdOrSlug, listRegisteredTenantProfiles, registerOrUpdateTenantProfile, type SaasRoleId, type TenantWorkspaceProfile, alignModuleShelvesToSystem32, resolveMultiHoleSpec } from "@birim/core";
import { resetNestingWorkerState } from "../../workers/manufacturing-worker-client";
import type { ConfiguratorState } from "../useConfiguratorStore";
import { sessionUnderlayDataCache, cloneProject, recompute, nextHistory, clearStoreNestingDebounceTimer, setActiveRuntimeTenantProfile } from "../storeHelpers";

export type StoreSet = StoreApi<ConfiguratorState>["setState"];
export type StoreGet = StoreApi<ConfiguratorState>["getState"];

export function createMultiSelectSpaceAndTenantSlice(set: StoreSet, get: StoreGet): Partial<ConfiguratorState> {
  return {
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
    const { validationIssues, bom, pricing, smartAdvice, lastChangeImpact } = recompute(updated);
    set({
      history: nextHistory(history, project, batchStartProject),
      future: [],
      project: updated,
      autoSaveStatus: "unsaved",
      validationIssues,
      bom,
      pricing,
      smartAdvice,
      lastChangeImpact,
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
    const { validationIssues, bom, pricing, smartAdvice, lastChangeImpact } = recompute(updated);
    set({
      history: nextHistory(history, project, batchStartProject),
      future: [],
      project: updated,
      autoSaveStatus: "unsaved",
      validationIssues,
      bom,
      pricing,
      smartAdvice,
      lastChangeImpact,
    });
  },

  batchRemoveSelectedModules: () => {
    const { project, selectedModuleIds, history, batchStartProject } = get();
    if (project.modules.length === 0 || selectedModuleIds.length === 0) return;
    const targetIds = new Set(selectedModuleIds);
    const updated = cloneProject(project);
    const remaining = updated.modules.filter((m) => !targetIds.has(m.id));
    updated.modules = remaining;
    const { validationIssues, bom, pricing, smartAdvice, lastChangeImpact } = recompute(updated);
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
      lastChangeImpact,
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
    const { validationIssues, bom, pricing, smartAdvice, lastChangeImpact } = recompute(updated);
    set({
      history: nextHistory(history, project, batchStartProject),
      future: [],
      project: updated,
      autoSaveStatus: "unsaved",
      validationIssues,
      bom,
      pricing,
      smartAdvice,
      lastChangeImpact,
    });
  },

  updateCarcass: (patch) => {
    const { project, activeModuleIndex, history, batchStartProject } = get();
    const updated = cloneProject(project, activeModuleIndex);
    const mod = updated.modules[activeModuleIndex] || updated.modules[0];
    if (!mod) return;
    mod.carcass = { ...mod.carcass, ...patch };
    if (
      (patch.multiHoleMode !== undefined && patch.multiHoleMode !== "none") ||
      ((patch.multiHoleEdgeMarginMm !== undefined ||
        patch.multiHoleFrontSetbackMm !== undefined) &&
        resolveMultiHoleSpec(mod).mode !== "none")
    ) {
      alignModuleShelvesToSystem32(mod, { includeFixedShelves: true });
    }
    updated.version += 1;
    updated.updatedAt = new Date().toISOString();
    const { validationIssues, bom, pricing, smartAdvice, lastChangeImpact } = recompute(updated);
    set({
      project: updated,
      history: nextHistory(history, project, batchStartProject),
      future: [],
      validationIssues,
      bom,
      pricing,
      smartAdvice,
      lastChangeImpact,
      autoSaveStatus: "unsaved",
    });
  },

  setFacadeGrainContinuity: (enabled) => {
    const { project, history, batchStartProject } = get();
    const updated = cloneProject(project);
    updated.facadeGrainContinuity = Boolean(enabled);
    updated.modules.forEach((m) => {
      m.carcass.grainContinuityMode = enabled ? "facade_continuous" : "none";
    });
    const { validationIssues, bom, pricing, smartAdvice, lastChangeImpact } = recompute(updated);
    set({
      history: nextHistory(history, project, batchStartProject),
      future: [],
      project: updated,
      autoSaveStatus: "unsaved",
      validationIssues,
      bom,
      pricing,
      smartAdvice,
      lastChangeImpact,
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
    const { validationIssues, bom, pricing, smartAdvice, lastChangeImpact } = recompute(updated);
    set({
      history: nextHistory(history, project, batchStartProject),
      future: [],
      project: updated,
      autoSaveStatus: "unsaved",
      validationIssues,
      bom,
      pricing,
      smartAdvice,
      lastChangeImpact,
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
      return wallId;
    }
    const { validationIssues, bom, pricing, smartAdvice, lastChangeImpact } = recompute(updated);
    set({
      history: nextHistory(history, project, batchStartProject),
      future: [],
      project: updated,
      autoSaveStatus: "unsaved",
      validationIssues,
      bom,
      pricing,
      smartAdvice,
      lastChangeImpact,
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
    const { validationIssues, bom, pricing, smartAdvice, lastChangeImpact } = recompute(updated);
    set({
      history: nextHistory(history, project, batchStartProject),
      future: [],
      project: updated,
      autoSaveStatus: "unsaved",
      validationIssues,
      bom,
      pricing,
      smartAdvice,
      lastChangeImpact,
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
    const { validationIssues, bom, pricing, smartAdvice, lastChangeImpact } = recompute(updated);
    set({
      history: nextHistory(history, project, batchStartProject),
      future: [],
      project: updated,
      autoSaveStatus: "unsaved",
      validationIssues,
      bom,
      pricing,
      smartAdvice,
      lastChangeImpact,
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
      doorOpenSide: obstacleInput.doorOpenSide ?? "inward",
      metadata: obstacleInput.metadata ? { ...obstacleInput.metadata } : undefined,
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
    const { validationIssues, bom, pricing, smartAdvice, lastChangeImpact } = recompute(updated);
    set({
      history: nextHistory(history, project, batchStartProject),
      future: [],
      project: updated,
      autoSaveStatus: "unsaved",
      validationIssues,
      bom,
      pricing,
      smartAdvice,
      lastChangeImpact,
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
            doorOpenSide: patch.doorOpenSide !== undefined ? patch.doorOpenSide : el.doorOpenSide,
            metadata: patch.metadata !== undefined ? { ...(el.metadata || {}), ...patch.metadata } : el.metadata,
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
    const { validationIssues, bom, pricing, smartAdvice, lastChangeImpact } = recompute(updated);
    set({
      history: nextHistory(history, project, batchStartProject),
      future: [],
      project: updated,
      autoSaveStatus: "unsaved",
      validationIssues,
      bom,
      pricing,
      smartAdvice,
      lastChangeImpact,
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
    const { validationIssues, bom, pricing, smartAdvice, lastChangeImpact } = recompute(updated);
    set({
      history: nextHistory(history, project, batchStartProject),
      future: [],
      project: updated,
      autoSaveStatus: "unsaved",
      validationIssues,
      bom,
      pricing,
      smartAdvice,
      lastChangeImpact,
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
    const { validationIssues, bom, pricing, smartAdvice, lastChangeImpact } = recompute(updated);
    set({
      history: nextHistory(history, project, batchStartProject),
      future: [],
      project: updated,
      autoSaveStatus: "unsaved",
      validationIssues,
      bom,
      pricing,
      smartAdvice,
      lastChangeImpact,
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
      return extractedWalls.length;
    }
    const { validationIssues, bom, pricing, smartAdvice, lastChangeImpact } = recompute(updated);
    set({
      history: nextHistory(history, project, batchStartProject),
      future: [],
      project: updated,
      autoSaveStatus: "unsaved",
      validationIssues,
      bom,
      pricing,
      smartAdvice,
      lastChangeImpact,
    });
    return extractedWalls.length;
  },

  switchActiveTenant: (tenantIdOrSlug: string, role?: SaasRoleId) => {
    const nextProfile = getTenantProfileByIdOrSlug(tenantIdOrSlug);
    setActiveRuntimeTenantProfile(nextProfile);

    // Full cross-tenant session & worker cache purge (Section 4.12 security contract)
    resetNestingWorkerState();
    sessionUnderlayDataCache.clear();
    clearStoreNestingDebounceTimer();

    const cur = get();
    const convertedModules = cur.project.modules.map((m) =>
      applyTenantConstructionToModule(structuredClone(m), nextProfile)
    );
    const nextProject: DesignProject = {
      ...structuredClone(cur.project),
      tenantId: nextProfile.tenantId,
      branchId: `branch_${nextProfile.slug}_hq`,
      constructionProfileId: nextProfile.construction.id,
      displayUnit: nextProfile.brand.defaultDisplayUnit,
      version: cur.project.version + 1,
      updatedAt: new Date().toISOString(),
      modules: convertedModules,
    };

    const { validationIssues, bom, pricing, smartAdvice, lastChangeImpact } = recompute(nextProject, {
      syncInitial: true,
    });
    set({
      activeTenantId: nextProfile.tenantId,
      activeTenantRole: role || cur.activeTenantRole || "org_owner",
      activeTenantProfile: structuredClone(nextProfile),
      availableTenants: listRegisteredTenantProfiles(),
      project: nextProject,
      activeModuleIndex: 0,
      activeBayIndex: 0,
      selectedComponentId: null,
      selectedModuleIds: [],
      selectedSceneObjectId: null,
      history: [],
      future: [],
      revisions: [],
      batchStartProject: null,
      autoSaveStatus: "saved",
      validationIssues,
      bom,
      pricing,
      smartAdvice,
      lastChangeImpact,
    });
    return structuredClone(nextProfile);
  },

  setActiveTenantRole: (role: SaasRoleId) => {
    set({ activeTenantRole: role });
  },

  syncTenantCatalogMaterials: (materials: MaterialDefinition[]) => {
    if (!Array.isArray(materials) || materials.length === 0) return 0;
    const cur = get();
    const existing = cur.project.customMaterials || [];
    const byId = new Map<string, MaterialDefinition>(existing.map((m) => [m.id, m]));
    let changed = false;
    for (const mat of materials) {
      if (!mat || !mat.id) continue;
      const prev = byId.get(mat.id);
      if (!prev || prev.costPerM2 !== mat.costPerM2 || prev.name !== mat.name) {
        byId.set(mat.id, mat);
        changed = true;
      }
    }
    if (!changed) return byId.size;
    const mergedList = Array.from(byId.values());
    syncProjectCustomMaterials(mergedList);
    const nextProject: DesignProject = {
      ...cur.project,
      customMaterials: mergedList,
    };
    const { validationIssues, bom, pricing, smartAdvice, lastChangeImpact } = recompute(nextProject);
    set({
      project: nextProject,
      validationIssues,
      bom,
      pricing,
      smartAdvice,
      lastChangeImpact,
    });
    return mergedList.length;
  },

  updateActiveTenantProfile: (patch) => {
    const cur = get();
    const merged: TenantWorkspaceProfile = {
      ...cur.activeTenantProfile,
      brand: { ...cur.activeTenantProfile.brand, ...(patch.brand || {}) },
      construction: {
        ...cur.activeTenantProfile.construction,
        ...(patch.construction || {}),
      },
      machine: {
        ...cur.activeTenantProfile.machine,
        ...(patch.machine || {}),
        toolNumbers: {
          ...cur.activeTenantProfile.machine.toolNumbers,
          ...(patch.machine?.toolNumbers || {}),
        },
      },
      pricing: { ...cur.activeTenantProfile.pricing, ...(patch.pricing || {}) },
    };
    const saved = registerOrUpdateTenantProfile(merged);
    setActiveRuntimeTenantProfile(saved);

    const updatedModules = patch.construction
      ? cur.project.modules.map((m) => applyTenantConstructionToModule(structuredClone(m), saved))
      : cur.project.modules;
    const nextProject: DesignProject = {
      ...cur.project,
      tenantId: saved.tenantId,
      constructionProfileId: saved.construction.id,
      displayUnit: saved.brand.defaultDisplayUnit,
      version: cur.project.version + 1,
      updatedAt: new Date().toISOString(),
      modules: updatedModules,
    };
    const { validationIssues, bom, pricing, smartAdvice, lastChangeImpact } = recompute(nextProject, {
      syncInitial: true,
    });
    set({
      activeTenantProfile: structuredClone(saved),
      availableTenants: listRegisteredTenantProfiles(),
      project: nextProject,
      validationIssues,
      bom,
      pricing,
      smartAdvice,
      lastChangeImpact,
    });
    return structuredClone(saved);
  },
  };
}
