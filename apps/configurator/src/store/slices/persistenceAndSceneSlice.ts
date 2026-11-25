import type { StoreApi } from "zustand";
import { harmonizeModuleWithProjectContext } from "../../v3/adapter/moduleHarmonizer";
import { DesignProject, createInitialProject, createDefaultWardrobeModule, evaluateProjectCompatibility, evaluateUnifiedEngineeringModel, applyApprovedRemediationProposal, migrateV3ProjectToV4, parseAndMigrateProject, SUPPORTED_PROJECT_SCHEMA_VERSION, SceneObjectInstance, CustomModuleTemplateRecord, computeAutoFillersAndTrimForProject, autoNotchModulesAroundObstacles, parseRoomPlanScanJson, alignModuleShelvesToSystem32, resolveMultiHoleSpec } from "@birim/core";
import { WARDROBE_TEMPLATES, getV4TemplateById, createKitchenLinearProject, createKitchenLProject, createKitchenUProject, V5_COMPOSITE_ASSEMBLIES, createSceneObjectInstanceFromCatalog, loadSavedCustomModuleTemplates, persistCustomModuleTemplates } from "@birim/catalog";
import { computeMultiWallModuleSnap, solveSceneObjectPlacementSnap } from "../../v3/engine/multiWallSnapAndBvhEngine";
import { getEffectiveSpaceWalls } from "../../v3/engine/kitchenSpatialEngine";
import type { ConfiguratorState } from "../useConfiguratorStore";
import { sessionUnderlayDataCache, cloneProject, getTenantProjectsStorageKey, recompute, nextHistory } from "../storeHelpers";
import { safeLocalStorageGet, safeLocalStorageSet } from "../../lib/safeStorage";

export type StoreSet = StoreApi<ConfiguratorState>["setState"];
export type StoreGet = StoreApi<ConfiguratorState>["getState"];

export function createPersistenceAndSceneSlice(set: StoreSet, get: StoreGet): Partial<ConfiguratorState> {
  return {
  saveToStorage: (name?: string) => {
    const { project, pricing, activeTenantId } = get();
    const storageKey = getTenantProjectsStorageKey(activeTenantId);
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
      const existing = JSON.parse(safeLocalStorageGet(storageKey) || "[]");
      if (!Array.isArray(existing)) throw new Error("Kayıt listesi bozuk; JSON dışa aktarımını kullanın.");
      existing.unshift({ ...saveEntry, tenantId: activeTenantId });
      const savedPrimary = safeLocalStorageSet(storageKey, JSON.stringify(existing.slice(0, 30)));
      if (!savedPrimary) {
        // QuotaExceededError fallback: cache oversized base64 underlay in session memory and compact history
        const compactProject = structuredClone(saveEntry.project);
        if (compactProject.space?.floorPlanUnderlay?.dataUrl && compactProject.space.floorPlanUnderlay.dataUrl.length > 150_000) {
          sessionUnderlayDataCache.set(saveId, compactProject.space.floorPlanUnderlay.dataUrl);
          compactProject.space.floorPlanUnderlay.dataUrl = undefined;
        }
        existing[0] = { ...saveEntry, tenantId: activeTenantId, project: compactProject };
        safeLocalStorageSet(storageKey, JSON.stringify(existing.slice(0, 12)));
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
      const storageKey = getTenantProjectsStorageKey(get().activeTenantId);
      const list = JSON.parse(safeLocalStorageGet(storageKey) || "[]");
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
      const storageKey = getTenantProjectsStorageKey(get().activeTenantId);
      const list = JSON.parse(safeLocalStorageGet(storageKey) || "[]");
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
      const { validationIssues, bom, pricing, smartAdvice, lastChangeImpact } = recompute(validProject);
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

  applyBatchProjectUpdate: (mutator, actionLabel) => {
    const { project, history, batchStartProject, activeModuleIndex, activeBayIndex } = get();
    const updated = cloneProject(project, activeModuleIndex);
    mutator(updated);
    updated.version = (updated.version || 1) + 1;
    updated.updatedAt = new Date().toISOString();
    const { validationIssues, bom, pricing, smartAdvice, lastChangeImpact } = recompute(updated);
    if (lastChangeImpact && actionLabel) {
      lastChangeImpact.actionLabel = actionLabel;
    }
    const safeModIdx = Math.max(0, Math.min(Math.max(0, updated.modules.length - 1), activeModuleIndex));
    const maxBay = Math.max(0, (updated.modules[safeModIdx]?.bays.length || 1) - 1);
    set({
      project: updated,
      activeModuleIndex: safeModIdx,
      activeBayIndex: Math.max(0, Math.min(maxBay, activeBayIndex)),
      autoSaveStatus: "unsaved",
      history: nextHistory(history, project, batchStartProject),
      future: [],
      validationIssues,
      bom,
      pricing,
      smartAdvice,
      lastChangeImpact,
    });
  },

  restoreProjectVariantSnapshot: (snapshot, label) => {
    const { project, history, batchStartProject, activeModuleIndex } = get();
    const updated = cloneProject(snapshot);
    updated.version = (project.version || 1) + 1;
    updated.updatedAt = new Date().toISOString();
    const { validationIssues, bom, pricing, smartAdvice, lastChangeImpact } = recompute(updated);
    if (lastChangeImpact && label) {
      lastChangeImpact.actionLabel = label;
    }
    const safeModIdx = Math.max(0, Math.min(Math.max(0, updated.modules.length - 1), activeModuleIndex));
    set({
      project: updated,
      activeModuleIndex: safeModIdx,
      activeBayIndex: 0,
      autoSaveStatus: "unsaved",
      history: nextHistory(history, project, batchStartProject),
      future: [],
      validationIssues,
      bom,
      pricing,
      smartAdvice,
      lastChangeImpact,
    });
  },

  applyApprovedEngineeringFix: (proposal) => {
    const { project, history, batchStartProject } = get();
    const updated = applyApprovedRemediationProposal(project, proposal);
    const { validationIssues, bom, pricing, smartAdvice, lastChangeImpact } = recompute(updated);
    set({
      project: updated,
      autoSaveStatus: "unsaved",
      history: nextHistory(history, project, batchStartProject),
      future: [],
      validationIssues,
      bom,
      pricing,
      smartAdvice,
      lastChangeImpact,
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

  setSelectedSceneObjectId: (selectedSceneObjectId) => set({ selectedSceneObjectId }),

  appendModuleWithMultiWallSnap: (templateId, opts) => {
    const { project, history, batchStartProject, activeWallId } = get();
    const updated = cloneProject(project);
    const effWalls = getEffectiveSpaceWalls(updated);
    if (effWalls.length > updated.space.walls.length) {
      updated.space.walls = effWalls.map((w) => ({ ...w, position: { ...w.position } }));
    }
    const targetWallId = opts?.wallId || activeWallId || effWalls[0]?.id || undefined;
    const solved = computeMultiWallModuleSnap(updated, templateId, {
      wallId: targetWallId,
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

    if (!templateId.startsWith("v5_")) {
      harmonizeModuleWithProjectContext(solved.moduleInstance, updated.modules, {
        mode: "append",
      });
    }
    if (resolveMultiHoleSpec(solved.moduleInstance).mode !== "none") {
      alignModuleShelvesToSystem32(solved.moduleInstance, { includeFixedShelves: true });
    }
    updated.modules.push(solved.moduleInstance);
    const { validationIssues, bom, pricing, smartAdvice, lastChangeImpact } = recompute(updated);
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
      lastChangeImpact,
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
      if (resolveMultiHoleSpec(baseNew).mode !== "none") {
        alignModuleShelvesToSystem32(baseNew, { includeFixedShelves: true });
      }
      updated.modules.push(baseNew);
    }

    const { validationIssues, bom, pricing, smartAdvice, lastChangeImpact } = recompute(updated);
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
      lastChangeImpact,
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

    const { validationIssues, bom, pricing, smartAdvice, lastChangeImpact } = recompute(updated);
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
      lastChangeImpact,
    });
  },

  saveActiveModuleAsCustomTemplate: (name, familyId) => {
    const { project, activeModuleIndex } = get();
    const updated = cloneProject(project, activeModuleIndex);
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
    const tid = get().activeTenantId;
    const merged = [rec, ...loadSavedCustomModuleTemplates(tid).filter((x) => x.templateId !== tplId)];
    persistCustomModuleTemplates(merged, tid);
    updated.customModuleTemplates = merged;
    set({ project: updated, autoSaveStatus: "unsaved" });
    return tplId;
  },

  deleteCustomModuleTemplate: (templateId) => {
    const { project } = get();
    const updated = cloneProject(project);
    const tid = get().activeTenantId;
    const nextList = (updated.customModuleTemplates || loadSavedCustomModuleTemplates(tid)).filter(
      (t) => t.templateId !== templateId
    );
    persistCustomModuleTemplates(nextList, tid);
    updated.customModuleTemplates = nextList;
    set({ project: updated });
  },

  addSceneObjectFromCatalog: (catalogId, cursorWorld) => {
    const { project, history, batchStartProject, activeWallId } = get();
    const updated = cloneProject(project);
    const effWalls = getEffectiveSpaceWalls(updated);
    if (effWalls.length > updated.space.walls.length) {
      updated.space.walls = effWalls.map((w) => ({ ...w, position: { ...w.position } }));
    }
    const solved = solveSceneObjectPlacementSnap(updated, catalogId, {
      ...(cursorWorld || {}),
      wallId: cursorWorld?.wallId || activeWallId || effWalls[0]?.id || undefined,
    });
    if (!solved) return null;
    updated.sceneObjects = [...(updated.sceneObjects || []), solved.object];
    const { validationIssues, bom, pricing, smartAdvice, lastChangeImpact } = recompute(updated);
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
      lastChangeImpact,
    });
    return solved.object;
  },

  addCustomSceneObject: (obj) => {
    const { project, history, batchStartProject } = get();
    const updated = cloneProject(project);
    const solved = solveSceneObjectPlacementSnap(updated, obj) || { object: obj };
    updated.sceneObjects = [...(updated.sceneObjects || []), solved.object];
    const { validationIssues, bom, pricing, smartAdvice, lastChangeImpact } = recompute(updated);
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
      lastChangeImpact,
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
    const { validationIssues, bom, pricing, smartAdvice, lastChangeImpact } = recompute(updated);
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
      lastChangeImpact,
    });
  },

  removeSceneObject: (id) => {
    const { project, history, batchStartProject, selectedSceneObjectId } = get();
    const updated = cloneProject(project);
    updated.sceneObjects = (updated.sceneObjects || []).filter((o) => o.id !== id);
    const { validationIssues, bom, pricing, smartAdvice, lastChangeImpact } = recompute(updated);
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
      lastChangeImpact,
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
    return { count: addedModules.length, notes: summaryNotes };
  },

  runAutoNotchObstacles: () => {
    const { project, history, batchStartProject } = get();
    const updated = cloneProject(project);
    const { updatedModules, appliedNotches } = autoNotchModulesAroundObstacles(updated);
    updated.modules = updatedModules;
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
    if (batchStartProject) {
      set({ project: updated, autoSaveStatus: "unsaved" });
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

  undo: () => {
    const { history, project, future } = get();
    if (history.length === 0) return;
    const previous = history[history.length - 1];
    const newHistory = history.slice(0, -1);
    const { validationIssues, bom, pricing, smartAdvice, lastChangeImpact } = recompute(previous);

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
      lastChangeImpact,
    });
  },

  redo: () => {
    const { future, project, history } = get();
    if (future.length === 0) return;
    const next = future[0];
    const newFuture = future.slice(1);
    const { validationIssues, bom, pricing, smartAdvice, lastChangeImpact } = recompute(next);

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
      lastChangeImpact,
    });
  },

  applyTemplate: (templateId) => {
    const tpl = WARDROBE_TEMPLATES.find((t) => t.templateId === templateId);
    if (!tpl) return;
    const { project, history } = get();
    const newMod = tpl.createInstance(`mod_${Date.now()}`);
    if (project.modules.length > 0) {
      harmonizeModuleWithProjectContext(newMod, project.modules, {
        mode: "replace",
        targetModule: project.modules[0],
      });
    }
    const nextVersion = project.version + 1;
    const updated: DesignProject = {
      ...project,
      modules: [newMod],
      version: nextVersion,
      schemaVersion: SUPPORTED_PROJECT_SCHEMA_VERSION,
      revisionId: `rev_v${nextVersion}`,
      updatedAt: new Date().toISOString(),
    };
    const { validationIssues, bom, pricing, smartAdvice, lastChangeImpact } = recompute(updated);

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
      lastChangeImpact,
      selectedComponentId: null,
    });
  },

  loadLinearKitchen: () => {
    const { project, history } = get();
    const kitchenProj = createKitchenLinearProject();
    const { validationIssues, bom, pricing, smartAdvice, lastChangeImpact } = recompute(kitchenProj);

    set({
      history: [...history.slice(-50), project],
      future: [],
      batchStartProject: null,
      project: kitchenProj,
      activeWallId: kitchenProj.space?.walls?.[0]?.id || "wall_main",
      activeModuleIndex: 0,
      validationIssues,
      bom,
      pricing,
      smartAdvice,
      lastChangeImpact,
      selectedComponentId: null,
    });
  },

  loadLKitchen: () => {
    const { project, history } = get();
    const lProj = createKitchenLProject();
    const { validationIssues, bom, pricing, smartAdvice, lastChangeImpact } = recompute(lProj);
    set({
      history: [...history.slice(-50), project],
      future: [],
      batchStartProject: null,
      project: lProj,
      activeWallId: lProj.space?.walls?.[0]?.id || "wall_main",
      activeModuleIndex: 0,
      validationIssues,
      bom,
      pricing,
      smartAdvice,
      lastChangeImpact,
      selectedComponentId: null,
    });
  },

  loadUKitchen: () => {
    const { project, history } = get();
    const uProj = createKitchenUProject();
    const { validationIssues, bom, pricing, smartAdvice, lastChangeImpact } = recompute(uProj);
    set({
      history: [...history.slice(-50), project],
      future: [],
      batchStartProject: null,
      project: uProj,
      activeWallId: uProj.space?.walls?.[0]?.id || "wall_main",
      activeModuleIndex: 0,
      validationIssues,
      bom,
      pricing,
      smartAdvice,
      lastChangeImpact,
      selectedComponentId: null,
    });
  },

  resetToDefault: () => {
    const def = createInitialProject();
    const { validationIssues, bom, pricing, smartAdvice, lastChangeImpact } = recompute(def);
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
      lastChangeImpact,
      selectedComponentId: null,
      doorOpenAngleDeg: 0,
      drawerOpenMm: 0,
      explodedFactor: 0,
    });
  },
  };
}
