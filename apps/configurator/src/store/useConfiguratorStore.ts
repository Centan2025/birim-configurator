import { create } from "zustand";
import {
  DesignProject,
  createInitialProject,
  validateModule,
  ValidationIssue,
  createDefaultWardrobeModule,
} from "@birim/core";
import { generateBOMForProject, ManufacturingBOM } from "@birim/manufacturing";
import { calculateProjectPrice, PricingBreakdown } from "@birim/pricing";
import { WARDROBE_TEMPLATES, createKitchenLinearProject } from "@birim/catalog";

export type ViewMode = "3d" | "2d_elevation" | "2d_plan";
export type CameraPreset = "front" | "side" | "top" | "iso";

interface ConfiguratorState {
  project: DesignProject;
  activeModuleIndex: number;
  viewMode: ViewMode;
  selectedComponentId: string | null;
  doorOpenAngleDeg: number;
  cameraPreset: CameraPreset;
  validationIssues: ValidationIssue[];
  bom: ManufacturingBOM;
  pricing: PricingBreakdown;
  history: DesignProject[];
  future: DesignProject[];

  // Actions
  setViewMode: (mode: ViewMode) => void;
  setCameraPreset: (preset: CameraPreset) => void;
  setSelectedComponentId: (id: string | null) => void;
  setDoorOpenAngleDeg: (angle: number) => void;
  toggleDoorOpen: () => void;
  
  // Project actions
  updateProjectTitle: (title: string) => void;
  setDimensions: (width: number, height: number, depth: number) => void;
  setPlinthHeight: (plinth: number) => void;
  setMaterials: (bodyMatId?: string, doorMatId?: string) => void;
  setBayCount: (count: number) => void;
  setBayDoorType: (bayIdx: number, type: "single_left" | "single_right" | "double" | "open") => void;
  addShelf: (bayIdx: number) => void;
  removeShelf: (bayIdx: number, shelfId: string) => void;
  addHangingRail: (bayIdx: number) => void;
  removeHangingRail: (bayIdx: number, railId: string) => void;
  addDrawer: (bayIdx: number) => void;
  removeDrawer: (bayIdx: number, drawerId: string) => void;
  
  // History
  undo: () => void;
  redo: () => void;

  // Templates
  applyTemplate: (templateId: string) => void;
  loadLinearKitchen: () => void;
  resetToDefault: () => void;
}

function recompute(project: DesignProject) {
  const activeMod = project.modules[0] || createDefaultWardrobeModule();
  const validationIssues = validateModule(activeMod);
  const bom = generateBOMForProject(project);
  const pricing = calculateProjectPrice(bom);
  return { validationIssues, bom, pricing };
}

const initialProj = createInitialProject();
const { validationIssues: initIssues, bom: initBom, pricing: initPricing } = recompute(initialProj);

export const useConfiguratorStore = create<ConfiguratorState>((set, get) => ({
  project: initialProj,
  activeModuleIndex: 0,
  viewMode: "3d",
  selectedComponentId: null,
  doorOpenAngleDeg: 0,
  cameraPreset: "iso",
  validationIssues: initIssues,
  bom: initBom,
  pricing: initPricing,
  history: [],
  future: [],

  setViewMode: (viewMode) => set({ viewMode }),
  setCameraPreset: (cameraPreset) => set({ cameraPreset }),
  setSelectedComponentId: (selectedComponentId) => set({ selectedComponentId }),
  setDoorOpenAngleDeg: (doorOpenAngleDeg) => set({ doorOpenAngleDeg }),
  toggleDoorOpen: () => {
    const cur = get().doorOpenAngleDeg;
    set({ doorOpenAngleDeg: cur > 0 ? 0 : 75 });
  },

  updateProjectTitle: (title) => {
    const current = get().project;
    const updated: DesignProject = { ...current, title, updatedAt: new Date().toISOString() };
    set({ project: updated });
  },

  setDimensions: (width, height, depth) => {
    const { project, history } = get();
    const updated = JSON.parse(JSON.stringify(project)) as DesignProject;
    const mod = updated.modules[0];
    if (!mod) return;

    mod.dimensions = { width, height, depth };
    updated.updatedAt = new Date().toISOString();
    const { validationIssues, bom, pricing } = recompute(updated);

    set({
      history: [...history.slice(-15), project],
      future: [],
      project: updated,
      validationIssues,
      bom,
      pricing,
    });
  },

  setPlinthHeight: (plinth) => {
    const { project, history } = get();
    const updated = JSON.parse(JSON.stringify(project)) as DesignProject;
    const mod = updated.modules[0];
    if (!mod) return;

    mod.carcass.plinthHeight = plinth;
    const { validationIssues, bom, pricing } = recompute(updated);
    set({
      history: [...history.slice(-15), project],
      future: [],
      project: updated,
      validationIssues,
      bom,
      pricing,
    });
  },

  setMaterials: (bodyMatId, doorMatId) => {
    const { project, history } = get();
    const updated = JSON.parse(JSON.stringify(project)) as DesignProject;
    const mod = updated.modules[0];
    if (!mod) return;

    if (bodyMatId) mod.carcass.bodyMaterialId = bodyMatId;
    if (doorMatId) mod.carcass.doorMaterialId = doorMatId;
    const { validationIssues, bom, pricing } = recompute(updated);
    set({
      history: [...history.slice(-15), project],
      future: [],
      project: updated,
      validationIssues,
      bom,
      pricing,
    });
  },

  setBayCount: (count) => {
    const { project, history } = get();
    if (count < 1 || count > 5) return;
    const updated = JSON.parse(JSON.stringify(project)) as DesignProject;
    const mod = updated.modules[0];
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
        });
      }
    } else if (count < currentBays.length) {
      mod.bays = currentBays.slice(0, count);
    }
    const { validationIssues, bom, pricing } = recompute(updated);
    set({
      history: [...history.slice(-15), project],
      future: [],
      project: updated,
      validationIssues,
      bom,
      pricing,
    });
  },

  setBayDoorType: (bayIdx, type) => {
    const { project, history } = get();
    const updated = JSON.parse(JSON.stringify(project)) as DesignProject;
    const mod = updated.modules[0];
    if (!mod || !mod.bays[bayIdx]) return;

    mod.bays[bayIdx].door.type = type;
    const { validationIssues, bom, pricing } = recompute(updated);
    set({
      history: [...history.slice(-15), project],
      future: [],
      project: updated,
      validationIssues,
      bom,
      pricing,
    });
  },

  addShelf: (bayIdx) => {
    const { project, history } = get();
    const updated = JSON.parse(JSON.stringify(project)) as DesignProject;
    const mod = updated.modules[0];
    if (!mod || !mod.bays[bayIdx]) return;

    const bay = mod.bays[bayIdx];
    const newElevation = bay.shelves.length > 0 ? (bay.shelves[bay.shelves.length - 1].elevationY || 300) + 350 : 400;
    bay.shelves.push({
      id: `shelf_${bayIdx}_${Date.now()}`,
      bayIndex: bayIdx,
      elevationY: Math.min(newElevation, 1900),
      isAdjustable: true,
    });

    const { validationIssues, bom, pricing } = recompute(updated);
    set({
      history: [...history.slice(-15), project],
      future: [],
      project: updated,
      validationIssues,
      bom,
      pricing,
    });
  },

  removeShelf: (bayIdx, shelfId) => {
    const { project, history } = get();
    const updated = JSON.parse(JSON.stringify(project)) as DesignProject;
    const mod = updated.modules[0];
    if (!mod || !mod.bays[bayIdx]) return;

    mod.bays[bayIdx].shelves = mod.bays[bayIdx].shelves.filter((s) => s.id !== shelfId);
    const { validationIssues, bom, pricing } = recompute(updated);
    set({
      history: [...history.slice(-15), project],
      future: [],
      project: updated,
      validationIssues,
      bom,
      pricing,
    });
  },

  addHangingRail: (bayIdx) => {
    const { project, history } = get();
    const updated = JSON.parse(JSON.stringify(project)) as DesignProject;
    const mod = updated.modules[0];
    if (!mod || !mod.bays[bayIdx]) return;

    mod.bays[bayIdx].hangingRails.push({
      id: `rail_${bayIdx}_${Date.now()}`,
      bayIndex: bayIdx,
      elevationY: 1700,
    });

    const { validationIssues, bom, pricing } = recompute(updated);
    set({
      history: [...history.slice(-15), project],
      future: [],
      project: updated,
      validationIssues,
      bom,
      pricing,
    });
  },

  removeHangingRail: (bayIdx, railId) => {
    const { project, history } = get();
    const updated = JSON.parse(JSON.stringify(project)) as DesignProject;
    const mod = updated.modules[0];
    if (!mod || !mod.bays[bayIdx]) return;

    mod.bays[bayIdx].hangingRails = mod.bays[bayIdx].hangingRails.filter((r) => r.id !== railId);
    const { validationIssues, bom, pricing } = recompute(updated);
    set({
      history: [...history.slice(-15), project],
      future: [],
      project: updated,
      validationIssues,
      bom,
      pricing,
    });
  },

  addDrawer: (bayIdx) => {
    const { project, history } = get();
    const updated = JSON.parse(JSON.stringify(project)) as DesignProject;
    const mod = updated.modules[0];
    if (!mod || !mod.bays[bayIdx]) return;

    const bay = mod.bays[bayIdx];
    const prevCount = bay.drawers.length;
    const newElevation = prevCount * 185;
    bay.drawers.push({
      id: `drw_${bayIdx}_${Date.now()}`,
      bayIndex: bayIdx,
      elevationY: newElevation,
      height: 180,
      slideType: "soft_close",
    });

    const { validationIssues, bom, pricing } = recompute(updated);
    set({
      history: [...history.slice(-15), project],
      future: [],
      project: updated,
      validationIssues,
      bom,
      pricing,
    });
  },

  removeDrawer: (bayIdx, drawerId) => {
    const { project, history } = get();
    const updated = JSON.parse(JSON.stringify(project)) as DesignProject;
    const mod = updated.modules[0];
    if (!mod || !mod.bays[bayIdx]) return;

    mod.bays[bayIdx].drawers = mod.bays[bayIdx].drawers.filter((d) => d.id !== drawerId);
    const { validationIssues, bom, pricing } = recompute(updated);
    set({
      history: [...history.slice(-15), project],
      future: [],
      project: updated,
      validationIssues,
      bom,
      pricing,
    });
  },

  undo: () => {
    const { history, project, future } = get();
    if (history.length === 0) return;
    const previous = history[history.length - 1];
    const newHistory = history.slice(0, -1);
    const { validationIssues, bom, pricing } = recompute(previous);

    set({
      project: previous,
      history: newHistory,
      future: [project, ...future],
      validationIssues,
      bom,
      pricing,
    });
  },

  redo: () => {
    const { future, project, history } = get();
    if (future.length === 0) return;
    const next = future[0];
    const newFuture = future.slice(1);
    const { validationIssues, bom, pricing } = recompute(next);

    set({
      project: next,
      history: [...history, project],
      future: newFuture,
      validationIssues,
      bom,
      pricing,
    });
  },

  applyTemplate: (templateId) => {
    const tpl = WARDROBE_TEMPLATES.find((t) => t.templateId === templateId);
    if (!tpl) return;
    const { project, history } = get();
    const newMod = tpl.createInstance(`mod_${Date.now()}`);
    const updated: DesignProject = {
      ...project,
      modules: [newMod],
      version: project.version + 1,
      updatedAt: new Date().toISOString(),
    };
    const { validationIssues, bom, pricing } = recompute(updated);

    set({
      history: [...history.slice(-15), project],
      future: [],
      project: updated,
      validationIssues,
      bom,
      pricing,
      selectedComponentId: null,
    });
  },

  loadLinearKitchen: () => {
    const { project, history } = get();
    const kitchenProj = createKitchenLinearProject();
    const { validationIssues, bom, pricing } = recompute(kitchenProj);

    set({
      history: [...history.slice(-15), project],
      future: [],
      project: kitchenProj,
      validationIssues,
      bom,
      pricing,
      selectedComponentId: null,
    });
  },

  resetToDefault: () => {
    const def = createInitialProject();
    const { validationIssues, bom, pricing } = recompute(def);
    set({
      project: def,
      history: [],
      future: [],
      validationIssues,
      bom,
      pricing,
      selectedComponentId: null,
      doorOpenAngleDeg: 0,
    });
  },
}));
