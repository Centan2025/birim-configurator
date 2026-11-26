import type { StoreApi } from "zustand";

import type { ConfiguratorState, ProjectRevisionSnapshot } from "../useConfiguratorStore";
import { recompute, getAdaptiveMaxHistoryEntries, getDeferredCommitRecomputeTimer, setDeferredCommitRecomputeTimer } from "../storeHelpers";

export type StoreSet = StoreApi<ConfiguratorState>["setState"];
export type StoreGet = StoreApi<ConfiguratorState>["getState"];

export function createHistoryAndTransactionsSlice(set: StoreSet, get: StoreGet): Partial<ConfiguratorState> {
  return {
  beginHistoryTransaction: () => {
    const { project } = get();
    // Fast structural snapshot: avoids deep-cloning multi-MB underlay/GLB dataUrls on pointerdown
    set({
      batchStartProject: {
        ...project,
        space: {
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
        sceneObjects: project.sceneObjects ? [...project.sceneObjects] : [],
        modules: project.modules.map((m) => ({
          ...m,
          dimensions: { ...m.dimensions },
          position: { ...m.position },
          rotation: m.rotation ? { ...m.rotation } : { x: 0, y: 0, z: 0 },
          carcass: { ...m.carcass },
          bays: m.bays.map((b) => ({
            ...b,
            door: { ...b.door },
            shelves: b.shelves.map((s) => ({ ...s })),
            drawers: b.drawers.map((d) => ({ ...d })),
            hangingRails: b.hangingRails.map((r) => ({ ...r })),
            specialFittings: b.specialFittings ? b.specialFittings.map((f) => ({ ...f })) : [],
            subDividers: b.subDividers ? b.subDividers.map((sd) => ({ ...sd })) : [],
          })),
        })),
      },
    });
  },

  selectModuleBayComponent: (patch) => {
    const cur = get();
    const nextModIdx =
      typeof patch.activeModuleIndex === "number" ? patch.activeModuleIndex : cur.activeModuleIndex;
    const nextBayIdx =
      typeof patch.activeBayIndex === "number" ? patch.activeBayIndex : cur.activeBayIndex;
    const nextCompId =
      patch.selectedComponentId !== undefined ? patch.selectedComponentId : cur.selectedComponentId;
    const wantsBatch = Boolean(patch.beginBatch && !cur.batchStartProject);
    if (
      !wantsBatch &&
      nextModIdx === cur.activeModuleIndex &&
      nextBayIdx === cur.activeBayIndex &&
      nextCompId === cur.selectedComponentId
    ) {
      return;
    }
    const snapBatch = wantsBatch
      ? {
          ...cur.project,
          space: {
            ...cur.project.space,
            walls: cur.project.space.walls.map((w) => ({
              ...w,
              position: { ...w.position },
              elements: (w.elements || []).map((el) => ({
                ...el,
                position: { ...el.position },
                dimensions: { ...el.dimensions },
              })),
            })),
            elements: (cur.project.space.elements || []).map((el) => ({
              ...el,
              position: { ...el.position },
              dimensions: { ...el.dimensions },
            })),
          },
          modules: cur.project.modules.map((m) => ({
            ...m,
            position: { ...m.position },
            rotation: m.rotation ? { ...m.rotation } : undefined,
            dimensions: { ...m.dimensions },
            carcass: { ...m.carcass },
            bays: m.bays.map((b) => ({
              ...b,
              door: { ...b.door },
              shelves: b.shelves.map((s) => ({ ...s })),
              drawers: b.drawers.map((d) => ({ ...d })),
              hangingRails: b.hangingRails.map((r) => ({ ...r })),
              specialFittings: b.specialFittings ? b.specialFittings.map((f) => ({ ...f })) : [],
              subDividers: b.subDividers ? b.subDividers.map((sd) => ({ ...sd })) : [],
            })),
          })),
        }
      : cur.batchStartProject;
    set({
      activeModuleIndex: nextModIdx,
      activeBayIndex: nextBayIdx,
      selectedComponentId: nextCompId,
      ...(wantsBatch ? { batchStartProject: snapBatch } : {}),
    });
  },

  commitHistoryTransaction: () => {
    const { batchStartProject, project, history } = get();
    if (!batchStartProject) return;
    const hasChanged =
      batchStartProject.version !== project.version ||
      batchStartProject.modules !== project.modules ||
      batchStartProject.space !== project.space ||
      batchStartProject.sceneObjects !== project.sceneObjects;
    if (!hasChanged) {
      set({ batchStartProject: null });
      return;
    }
    if (typeof window !== "undefined") {
      // Zero-hitch pointerup: settle visual position immediately on this frame, then run heavy BOM/pricing/engineering off-frame!
      const settledProject = project;
      const maxHist = getAdaptiveMaxHistoryEntries();
      set({
        history: [...history.slice(-maxHist), batchStartProject],
        future: [],
        batchStartProject: null,
      });
      if (getDeferredCommitRecomputeTimer()) clearTimeout(getDeferredCommitRecomputeTimer()!);
      setDeferredCommitRecomputeTimer(setTimeout(() => {
        setDeferredCommitRecomputeTimer(null);
        const latest = get();
        if (latest.batchStartProject !== null || latest.project !== settledProject) return;
        const { validationIssues, bom, pricing, smartAdvice, lastChangeImpact } = recompute(settledProject);
        set({
          validationIssues,
          bom,
          pricing,
          smartAdvice,
        });
      }, 36));
      return;
    }
    const { validationIssues, bom, pricing, smartAdvice, lastChangeImpact } = recompute(project);
    const maxHist = getAdaptiveMaxHistoryEntries();
    set({
      history: [...history.slice(-maxHist), batchStartProject],
      future: [],
      batchStartProject: null,
      validationIssues,
      bom,
      pricing,
      smartAdvice,
      lastChangeImpact,
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
    const { validationIssues, bom, pricing, smartAdvice, lastChangeImpact } = recompute(restored);
    const maxHist = getAdaptiveMaxHistoryEntries();
    set({
      history: [...history.slice(-maxHist), project],
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
      lastChangeImpact,
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
  };
}
