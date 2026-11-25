import type { StoreApi } from "zustand";
import { autoFixModuleIssues, TENANT_BIRIM_ENTERPRISE, buildTenantScopedStorageKey } from "@birim/core";
import type { ConfiguratorState } from "../useConfiguratorStore";
import { cloneProject, cloneProjectForSingleModule, recompute, nextHistory, animateValueTransition, getActiveDoorAnimRaf, setActiveDoorAnimRaf, getActiveDrawerAnimRaf, setActiveDrawerAnimRaf } from "../storeHelpers";

export type StoreSet = StoreApi<ConfiguratorState>["setState"];
export type StoreGet = StoreApi<ConfiguratorState>["getState"];

export function createViewportAndUiSlice(set: StoreSet, get: StoreGet): Partial<ConfiguratorState> {
  return {
  activeWallId: "wall_main",
  setActiveWallId: (activeWallId) => set({ activeWallId }),

  setDisplayUnit: (displayUnit) => {
    if (typeof window !== "undefined") {
      try {
        window.localStorage.setItem("birim_elev_unit", displayUnit);
      } catch {
        // ignore storage quota
      }
    }
    set((st) => ({
      displayUnit,
      project: { ...st.project, displayUnit },
    }));
  },
  setUiMode: (uiMode) =>
    set({
      uiMode,
      userExperienceTier: uiMode === "technical" ? "architect" : "simple",
    }),
  setUserExperienceTier: (userExperienceTier) =>
    set({
      userExperienceTier,
      uiMode: userExperienceTier === "simple" ? "simple" : "technical",
      toolbarLabelMode: userExperienceTier === "simple" ? "labeled" : "compact",
    }),
  setToolbarLabelMode: (toolbarLabelMode) => set({ toolbarLabelMode }),
  setViewportRenderStyle: (viewportRenderStyle) =>
    set((st) => ({
      viewportRenderStyle,
      explodedFactor:
        viewportRenderStyle === "exploded"
          ? Math.max(0.55, st.explodedFactor || 0.65)
          : st.viewportRenderStyle === "exploded"
          ? 0
          : st.explodedFactor,
      cncXrayMode: viewportRenderStyle === "transparent" ? true : viewportRenderStyle === "solid" ? false : st.cncXrayMode,
    })),
  dismissChangeImpact: () => set({ lastChangeImpact: null }),
  setSkipSmartLauncherByDefault: (skip) => {
    const tid = get().activeTenantId || TENANT_BIRIM_ENTERPRISE.tenantId;
    if (typeof window !== "undefined") {
      try {
        window.localStorage.setItem(buildTenantScopedStorageKey(tid, "skip_smart_launcher"), skip ? "1" : "0");
      } catch {
        // Ignore quota errors
      }
    }
    set({ skipSmartLauncherByDefault: skip });
  },
  updateBayDrawerConfig: (bayIndex, drawerId, patch) => {
    const { project, history, activeModuleIndex, batchStartProject } = get();
    const updated = cloneProjectForSingleModule(project, activeModuleIndex);
    const mod = updated.modules[activeModuleIndex] || updated.modules[0];
    if (!mod || !mod.bays[bayIndex]) return;
    mod.bays[bayIndex].drawers = mod.bays[bayIndex].drawers.map((d) =>
      d.id === drawerId ? { ...d, ...patch } : d
    );
    if (batchStartProject !== null) {
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
  setDoorOpenAngleDeg: (doorOpenAngleDeg, animated = false) => {
    if (doorOpenAngleDeg < 55 && get().drawerOpenMm > 0) {
      const hasCoveredInternalDrawers = get().project.modules.some((m) =>
        m.bays.some(
          (b) =>
            b.drawers.some((d) => !d.isHidden) &&
            (b.drawers.some((d) => !d.isHidden && Boolean(d.isInternal)) ||
              b.door?.type === "sliding" ||
              b.door?.type === "sliding_bottom" ||
              String(b.door?.doorSystemId || "").startsWith("sliding"))
        )
      );
      if (hasCoveredInternalDrawers) {
        get().setDrawerOpenMm(0, animated);
      }
    }
    if (!animated) {
      if (getActiveDoorAnimRaf() !== null) { cancelAnimationFrame(getActiveDoorAnimRaf()!); setActiveDoorAnimRaf(null); }
      set({ doorOpenAngleDeg });
      return;
    }
    const current = get().doorOpenAngleDeg;
    // Closing door is snappier, opening is smooth
    const isClosing = doorOpenAngleDeg < current;
    let lastCommittedDeg = Math.round(current);
    animateValueTransition(
      current,
      doorOpenAngleDeg,
      isClosing ? 220 : 260,
      (val) => {
        const rounded = val === doorOpenAngleDeg ? doorOpenAngleDeg : Math.round(val / 2) * 2;
        if (rounded !== lastCommittedDeg || val === doorOpenAngleDeg) {
          lastCommittedDeg = rounded;
          set({ doorOpenAngleDeg: rounded });
        }
      },
      getActiveDoorAnimRaf,
      (raf) => {
        setActiveDoorAnimRaf(raf);
      }
    );
  },
  setDrawerOpenMm: (drawerOpenMm, animated = false) => {
    if (!animated) {
      if (getActiveDrawerAnimRaf() !== null) { cancelAnimationFrame(getActiveDrawerAnimRaf()!); setActiveDrawerAnimRaf(null); }
      set({ drawerOpenMm });
      return;
    }
    const current = get().drawerOpenMm;
    // Realistic heavier drawer gliding motion (slower and softer damping)
    animateValueTransition(
      current,
      drawerOpenMm,
      480,
      (val) => set({ drawerOpenMm: val }),
      getActiveDrawerAnimRaf,
      (raf) => {
        setActiveDrawerAnimRaf(raf);
      }
    );
  },
  toggleDrawerOpen: (animated = true) => {
    const cur = get().drawerOpenMm;
    const targetMm = cur > 10 ? 0 : 280;
    if (!animated) {
      if (getActiveDrawerAnimRaf() !== null) { cancelAnimationFrame(getActiveDrawerAnimRaf()!); setActiveDrawerAnimRaf(null); }
      set({ drawerOpenMm: targetMm });
      return;
    }
    animateValueTransition(
      cur,
      targetMm,
      480,
      (val) => set({ drawerOpenMm: val }),
      getActiveDrawerAnimRaf,
      (raf) => {
        setActiveDrawerAnimRaf(raf);
      }
    );
  },
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
      const res = autoFixModuleIssues(mod);
      fixedTotal += res.appliedFixes.length;
      return res.updatedModule;
    });
    if (fixedTotal === 0) return 0;
    const { validationIssues, bom, pricing, smartAdvice, lastChangeImpact } = recompute(next);
    set({
      project: next,
      validationIssues,
      bom,
      pricing,
      smartAdvice,
      lastChangeImpact,
      autoSaveStatus: 'unsaved',
      history: nextHistory(history, project, batchStartProject),
      future: [],
    });
    return fixedTotal;
  },
  toggleDoorOpen: (animated = true) => {
    const curDoor = get().doorOpenAngleDeg;
    const curDrawer = get().drawerOpenMm;
    const isAnyOpen = curDoor > 0 || curDrawer > 10;
    const targetDoorDeg = isAnyOpen ? 0 : 75;
    const targetDrawerMm = isAnyOpen ? 0 : 260;

    if (!animated) {
      if (getActiveDoorAnimRaf() !== null) { cancelAnimationFrame(getActiveDoorAnimRaf()!); setActiveDoorAnimRaf(null); }
      if (getActiveDrawerAnimRaf() !== null) { cancelAnimationFrame(getActiveDrawerAnimRaf()!); setActiveDrawerAnimRaf(null); }
      set({ doorOpenAngleDeg: targetDoorDeg, drawerOpenMm: targetDrawerMm });
      return;
    }
    // Kapaklar kapanırken daha seri (260ms), açılırken (320ms)
    const isClosing = targetDoorDeg === 0;
    animateValueTransition(
      curDoor,
      targetDoorDeg,
      isClosing ? 260 : 320,
      (val) => set({ doorOpenAngleDeg: val }),
      getActiveDoorAnimRaf,
      (raf) => {
        setActiveDoorAnimRaf(raf);
      }
    );
    // Çekmeceler tok ve ray üzerinde yavaş/ağır kayarak açılıp kapanır (480ms)
    animateValueTransition(
      curDrawer,
      targetDrawerMm,
      480,
      (val) => set({ drawerOpenMm: val }),
      getActiveDrawerAnimRaf,
      (raf) => {
        setActiveDrawerAnimRaf(raf);
      }
    );
  },
  };
}
