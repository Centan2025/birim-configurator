import { create } from "zustand";
import {
  DesignProject,
  createInitialProject,
  validateProject,
  ValidationIssue,
  createDefaultWardrobeModule,
  ModuleInstance,
} from "@birim/core";
import { generateBOMForProject, ManufacturingBOM } from "@birim/manufacturing";
import { calculateProjectPrice, PricingBreakdown } from "@birim/pricing";
import { WARDROBE_TEMPLATES, createKitchenLinearProject, analyzeAndAdviseSpan, SmartAdvisorFeedback } from "@birim/catalog";

export type ViewMode = "3d" | "2d_elevation" | "2d_plan" | "2d_section";
export type CameraPreset = "front" | "side" | "top" | "iso";

interface ConfiguratorState {
  project: DesignProject;
  activeModuleIndex: number;
  viewMode: ViewMode;
  selectedComponentId: string | null;
  doorOpenAngleDeg: number;
  drawerOpenMm: number;
  explodedFactor: number;
  isOrthographic: boolean;
  cameraPreset: CameraPreset;
  validationIssues: ValidationIssue[];
  bom: ManufacturingBOM;
  pricing: PricingBreakdown;
  smartAdvice: SmartAdvisorFeedback;
  history: DesignProject[];
  future: DesignProject[];

  // Actions
  setViewMode: (mode: ViewMode) => void;
  setCameraPreset: (preset: CameraPreset) => void;
  setSelectedComponentId: (id: string | null) => void;
  setActiveModuleIndex: (index: number) => void;
  setDoorOpenAngleDeg: (angle: number) => void;
  setDrawerOpenMm: (mm: number) => void;
  setExplodedFactor: (factor: number) => void;
  toggleDoorOpen: () => void;
  toggleOrthographic: () => void;

  // Project & Module actions
  updateProjectTitle: (title: string) => void;
  setDimensions: (width: number, height: number, depth: number) => void;
  setPlinthHeight: (plinth: number) => void;
  setMaterials: (bodyMatId?: string, doorMatId?: string) => void;
  setBayCount: (count: number) => void;
  setBayDoorType: (bayIdx: number, type: "single_left" | "single_right" | "double" | "sliding" | "open") => void;

  // Interior fittings
  addShelf: (bayIdx: number) => void;
  removeShelf: (bayIdx: number, shelfId: string) => void;
  addHangingRail: (bayIdx: number) => void;
  removeHangingRail: (bayIdx: number, railId: string) => void;
  addDrawer: (bayIdx: number) => void;
  removeDrawer: (bayIdx: number, drawerId: string) => void;
  addSpecialFitting: (bayIdx: number, type: "trouser_rack" | "shoe_rack" | "wire_basket" | "led_profile") => void;
  removeSpecialFitting: (bayIdx: number, fittingId: string) => void;

  // Multi-module management
  addAdjacentModule: () => void;
  removeActiveModule: () => void;

  // Production approval
  approveProduction: () => { success: boolean; message: string };

  // Smart advisor
  applySmartSpan: (spanWidth: number) => void;

  // History & Templates
  undo: () => void;
  redo: () => void;
  applyTemplate: (templateId: string) => void;
  loadLinearKitchen: () => void;
  resetToDefault: () => void;
}

function recompute(project: DesignProject) {
  const validationIssues = validateProject(project);
  const bom = generateBOMForProject(project);
  const pricing = calculateProjectPrice(bom);
  const activeMod = project.modules[0] || createDefaultWardrobeModule();
  const smartAdvice = analyzeAndAdviseSpan(activeMod.dimensions.width, activeMod.dimensions.height);
  return { validationIssues, bom, pricing, smartAdvice };
}

const initialProj = createInitialProject();
const { validationIssues: initIssues, bom: initBom, pricing: initPricing, smartAdvice: initAdvice } = recompute(initialProj);

export const useConfiguratorStore = create<ConfiguratorState>((set, get) => ({
  project: initialProj,
  activeModuleIndex: 0,
  viewMode: "3d",
  selectedComponentId: null,
  doorOpenAngleDeg: 0,
  drawerOpenMm: 0,
  explodedFactor: 0,
  isOrthographic: false,
  cameraPreset: "iso",
  validationIssues: initIssues,
  bom: initBom,
  pricing: initPricing,
  smartAdvice: initAdvice,
  history: [],
  future: [],

  setViewMode: (viewMode) => set({ viewMode }),
  setCameraPreset: (cameraPreset) => set({ cameraPreset }),
  setSelectedComponentId: (selectedComponentId) => set({ selectedComponentId }),
  setActiveModuleIndex: (activeModuleIndex) => set({ activeModuleIndex }),
  setDoorOpenAngleDeg: (doorOpenAngleDeg) => set({ doorOpenAngleDeg }),
  setDrawerOpenMm: (drawerOpenMm) => set({ drawerOpenMm }),
  setExplodedFactor: (explodedFactor) => set({ explodedFactor }),
  toggleOrthographic: () => set((s) => ({ isOrthographic: !s.isOrthographic })),
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
    const { project, history, activeModuleIndex } = get();
    const updated = JSON.parse(JSON.stringify(project)) as DesignProject;
    const mod = updated.modules[activeModuleIndex] || updated.modules[0];
    if (!mod) return;

    mod.dimensions = { width, height, depth };
    updated.updatedAt = new Date().toISOString();
    const { validationIssues, bom, pricing, smartAdvice } = recompute(updated);

    set({
      history: [...history.slice(-15), project],
      future: [],
      project: updated,
      validationIssues,
      bom,
      pricing,
      smartAdvice,
    });
  },

  setPlinthHeight: (plinth) => {
    const { project, history, activeModuleIndex } = get();
    const updated = JSON.parse(JSON.stringify(project)) as DesignProject;
    const mod = updated.modules[activeModuleIndex] || updated.modules[0];
    if (!mod) return;

    mod.carcass.plinthHeight = plinth;
    const { validationIssues, bom, pricing, smartAdvice } = recompute(updated);
    set({
      history: [...history.slice(-15), project],
      future: [],
      project: updated,
      validationIssues,
      bom,
      pricing,
      smartAdvice,
    });
  },

  setMaterials: (bodyMatId, doorMatId) => {
    const { project, history, activeModuleIndex } = get();
    const updated = JSON.parse(JSON.stringify(project)) as DesignProject;
    const mod = updated.modules[activeModuleIndex] || updated.modules[0];
    if (!mod) return;

    if (bodyMatId) mod.carcass.bodyMaterialId = bodyMatId;
    if (doorMatId) mod.carcass.doorMaterialId = doorMatId;
    const { validationIssues, bom, pricing, smartAdvice } = recompute(updated);
    set({
      history: [...history.slice(-15), project],
      future: [],
      project: updated,
      validationIssues,
      bom,
      pricing,
      smartAdvice,
    });
  },

  setBayCount: (count) => {
    const { project, history, activeModuleIndex } = get();
    if (count < 1 || count > 8) return;
    const updated = JSON.parse(JSON.stringify(project)) as DesignProject;
    const mod = updated.modules[activeModuleIndex] || updated.modules[0];
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
          specialFittings: [],
        });
      }
    } else if (count < currentBays.length) {
      mod.bays = currentBays.slice(0, count);
    }
    const { validationIssues, bom, pricing, smartAdvice } = recompute(updated);
    set({
      history: [...history.slice(-15), project],
      future: [],
      project: updated,
      validationIssues,
      bom,
      pricing,
      smartAdvice,
    });
  },

  setBayDoorType: (bayIdx, type) => {
    const { project, history, activeModuleIndex } = get();
    const updated = JSON.parse(JSON.stringify(project)) as DesignProject;
    const mod = updated.modules[activeModuleIndex] || updated.modules[0];
    if (!mod || !mod.bays[bayIdx]) return;

    mod.bays[bayIdx].door.type = type;
    const { validationIssues, bom, pricing, smartAdvice } = recompute(updated);
    set({
      history: [...history.slice(-15), project],
      future: [],
      project: updated,
      validationIssues,
      bom,
      pricing,
      smartAdvice,
    });
  },

  addShelf: (bayIdx) => {
    const { project, history, activeModuleIndex } = get();
    const updated = JSON.parse(JSON.stringify(project)) as DesignProject;
    const mod = updated.modules[activeModuleIndex] || updated.modules[0];
    if (!mod || !mod.bays[bayIdx]) return;

    const bay = mod.bays[bayIdx];
    const newElevation = bay.shelves.length > 0 ? (bay.shelves[bay.shelves.length - 1].elevationY || 300) + 350 : 400;
    bay.shelves.push({
      id: `shelf_${bayIdx}_${Date.now()}`,
      bayIndex: bayIdx,
      elevationY: Math.min(newElevation, 1900),
      isAdjustable: true,
    });

    const { validationIssues, bom, pricing, smartAdvice } = recompute(updated);
    set({
      history: [...history.slice(-15), project],
      future: [],
      project: updated,
      validationIssues,
      bom,
      pricing,
      smartAdvice,
    });
  },

  removeShelf: (bayIdx, shelfId) => {
    const { project, history, activeModuleIndex } = get();
    const updated = JSON.parse(JSON.stringify(project)) as DesignProject;
    const mod = updated.modules[activeModuleIndex] || updated.modules[0];
    if (!mod || !mod.bays[bayIdx]) return;

    mod.bays[bayIdx].shelves = mod.bays[bayIdx].shelves.filter((s) => s.id !== shelfId);
    const { validationIssues, bom, pricing, smartAdvice } = recompute(updated);
    set({
      history: [...history.slice(-15), project],
      future: [],
      project: updated,
      validationIssues,
      bom,
      pricing,
      smartAdvice,
    });
  },

  addHangingRail: (bayIdx) => {
    const { project, history, activeModuleIndex } = get();
    const updated = JSON.parse(JSON.stringify(project)) as DesignProject;
    const mod = updated.modules[activeModuleIndex] || updated.modules[0];
    if (!mod || !mod.bays[bayIdx]) return;

    mod.bays[bayIdx].hangingRails.push({
      id: `rail_${bayIdx}_${Date.now()}`,
      bayIndex: bayIdx,
      elevationY: 1700,
    });

    const { validationIssues, bom, pricing, smartAdvice } = recompute(updated);
    set({
      history: [...history.slice(-15), project],
      future: [],
      project: updated,
      validationIssues,
      bom,
      pricing,
      smartAdvice,
    });
  },

  removeHangingRail: (bayIdx, railId) => {
    const { project, history, activeModuleIndex } = get();
    const updated = JSON.parse(JSON.stringify(project)) as DesignProject;
    const mod = updated.modules[activeModuleIndex] || updated.modules[0];
    if (!mod || !mod.bays[bayIdx]) return;

    mod.bays[bayIdx].hangingRails = mod.bays[bayIdx].hangingRails.filter((r) => r.id !== railId);
    const { validationIssues, bom, pricing, smartAdvice } = recompute(updated);
    set({
      history: [...history.slice(-15), project],
      future: [],
      project: updated,
      validationIssues,
      bom,
      pricing,
      smartAdvice,
    });
  },

  addDrawer: (bayIdx) => {
    const { project, history, activeModuleIndex } = get();
    const updated = JSON.parse(JSON.stringify(project)) as DesignProject;
    const mod = updated.modules[activeModuleIndex] || updated.modules[0];
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

    const { validationIssues, bom, pricing, smartAdvice } = recompute(updated);
    set({
      history: [...history.slice(-15), project],
      future: [],
      project: updated,
      validationIssues,
      bom,
      pricing,
      smartAdvice,
    });
  },

  removeDrawer: (bayIdx, drawerId) => {
    const { project, history, activeModuleIndex } = get();
    const updated = JSON.parse(JSON.stringify(project)) as DesignProject;
    const mod = updated.modules[activeModuleIndex] || updated.modules[0];
    if (!mod || !mod.bays[bayIdx]) return;

    mod.bays[bayIdx].drawers = mod.bays[bayIdx].drawers.filter((d) => d.id !== drawerId);
    const { validationIssues, bom, pricing, smartAdvice } = recompute(updated);
    set({
      history: [...history.slice(-15), project],
      future: [],
      project: updated,
      validationIssues,
      bom,
      pricing,
      smartAdvice,
    });
  },

  addSpecialFitting: (bayIdx, type) => {
    const { project, history, activeModuleIndex } = get();
    const updated = JSON.parse(JSON.stringify(project)) as DesignProject;
    const mod = updated.modules[activeModuleIndex] || updated.modules[0];
    if (!mod || !mod.bays[bayIdx]) return;

    const bay = mod.bays[bayIdx];
    if (!bay.specialFittings) bay.specialFittings = [];
    bay.specialFittings.push({
      id: `fit_${bayIdx}_${Date.now()}`,
      bayIndex: bayIdx,
      elevationY: 700,
      type,
      height: type === "trouser_rack" ? 80 : 120,
    });

    const { validationIssues, bom, pricing, smartAdvice } = recompute(updated);
    set({
      history: [...history.slice(-15), project],
      future: [],
      project: updated,
      validationIssues,
      bom,
      pricing,
      smartAdvice,
    });
  },

  removeSpecialFitting: (bayIdx, fittingId) => {
    const { project, history, activeModuleIndex } = get();
    const updated = JSON.parse(JSON.stringify(project)) as DesignProject;
    const mod = updated.modules[activeModuleIndex] || updated.modules[0];
    if (!mod || !mod.bays[bayIdx]) return;

    mod.bays[bayIdx].specialFittings = mod.bays[bayIdx].specialFittings.filter((f) => f.id !== fittingId);
    const { validationIssues, bom, pricing, smartAdvice } = recompute(updated);
    set({
      history: [...history.slice(-15), project],
      future: [],
      project: updated,
      validationIssues,
      bom,
      pricing,
      smartAdvice,
    });
  },

  addAdjacentModule: () => {
    const { project, history } = get();
    const updated = JSON.parse(JSON.stringify(project)) as DesignProject;
    const lastMod = updated.modules[updated.modules.length - 1];
    const newX = lastMod ? lastMod.position.x + lastMod.dimensions.width : 0;

    const newMod: ModuleInstance = {
      id: `mod_${Date.now()}`,
      name: `Kabin ${updated.modules.length + 1}`,
      category: "wardrobe",
      position: { x: newX, y: 0, z: 0 },
      dimensions: { width: 900, height: 2200, depth: 600 },
      carcass: {
        panelThickness: 18,
        backPanelThickness: 8,
        backPanelType: "grooved",
        plinthHeight: 80,
        doorPerimeterGap: 2,
        edgeBandThickness: 1,
        bodyMaterialId: "mat_melamine_white",
        doorMaterialId: "mat_veneer_oak",
        jointType: "minifix_dowel",
      },
      bays: [
        {
          index: 0,
          door: { id: `door_${Date.now()}`, bayIndex: 0, type: "single_left", softClose: true },
          shelves: [{ id: `shelf_${Date.now()}`, bayIndex: 0, elevationY: 1800, isAdjustable: false }],
          hangingRails: [{ id: `rail_${Date.now()}`, bayIndex: 0, elevationY: 1730 }],
          drawers: [],
          specialFittings: [],
        },
      ],
    };

    updated.modules.push(newMod);
    const { validationIssues, bom, pricing, smartAdvice } = recompute(updated);
    set({
      history: [...history.slice(-15), project],
      future: [],
      project: updated,
      activeModuleIndex: updated.modules.length - 1,
      validationIssues,
      bom,
      pricing,
      smartAdvice,
    });
  },

  removeActiveModule: () => {
    const { project, history, activeModuleIndex } = get();
    if (project.modules.length <= 1) return; // Keep at least one module
    const updated = JSON.parse(JSON.stringify(project)) as DesignProject;
    updated.modules.splice(activeModuleIndex, 1);

    const { validationIssues, bom, pricing, smartAdvice } = recompute(updated);
    set({
      history: [...history.slice(-15), project],
      future: [],
      project: updated,
      activeModuleIndex: 0,
      validationIssues,
      bom,
      pricing,
      smartAdvice,
    });
  },

  approveProduction: () => {
    const { project, validationIssues } = get();
    const blockingErrors = validationIssues.filter((i) => i.blockingProduction || i.severity === "error");
    if (blockingErrors.length > 0) {
      return {
        success: false,
        message: `Üretim onayı verilemez: ${blockingErrors.length} adet kritik mühendislik hatası mevcut.`,
      };
    }

    const updated = JSON.parse(JSON.stringify(project)) as DesignProject;
    updated.status = "production_approved";
    updated.updatedAt = new Date().toISOString();
    const { validationIssues: newIssues, bom, pricing, smartAdvice } = recompute(updated);

    set({
      project: updated,
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
    const { project, history } = get();
    const updated = JSON.parse(JSON.stringify(project)) as DesignProject;
    const mod = updated.modules[0];
    if (!mod) return;

    mod.dimensions.width = spanWidth;
    // Suggest bay count: 1 bay per 600-900mm
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

    const { validationIssues, bom, pricing, smartAdvice } = recompute(updated);
    set({
      history: [...history.slice(-15), project],
      future: [],
      project: updated,
      validationIssues,
      bom,
      pricing,
      smartAdvice,
    });
  },

  undo: () => {
    const { history, project, future } = get();
    if (history.length === 0) return;
    const previous = history[history.length - 1];
    const newHistory = history.slice(0, -1);
    const { validationIssues, bom, pricing, smartAdvice } = recompute(previous);

    set({
      project: previous,
      history: newHistory,
      future: [project, ...future],
      validationIssues,
      bom,
      pricing,
      smartAdvice,
    });
  },

  redo: () => {
    const { future, project, history } = get();
    if (future.length === 0) return;
    const next = future[0];
    const newFuture = future.slice(1);
    const { validationIssues, bom, pricing, smartAdvice } = recompute(next);

    set({
      project: next,
      history: [...history, project],
      future: newFuture,
      validationIssues,
      bom,
      pricing,
      smartAdvice,
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
    const { validationIssues, bom, pricing, smartAdvice } = recompute(updated);

    set({
      history: [...history.slice(-15), project],
      future: [],
      project: updated,
      activeModuleIndex: 0,
      validationIssues,
      bom,
      pricing,
      smartAdvice,
      selectedComponentId: null,
    });
  },

  loadLinearKitchen: () => {
    const { project, history } = get();
    const kitchenProj = createKitchenLinearProject();
    const { validationIssues, bom, pricing, smartAdvice } = recompute(kitchenProj);

    set({
      history: [...history.slice(-15), project],
      future: [],
      project: kitchenProj,
      activeModuleIndex: 0,
      validationIssues,
      bom,
      pricing,
      smartAdvice,
      selectedComponentId: null,
    });
  },

  resetToDefault: () => {
    const def = createInitialProject();
    const { validationIssues, bom, pricing, smartAdvice } = recompute(def);
    set({
      project: def,
      activeModuleIndex: 0,
      history: [],
      future: [],
      validationIssues,
      bom,
      pricing,
      smartAdvice,
      selectedComponentId: null,
      doorOpenAngleDeg: 0,
      drawerOpenMm: 0,
      explodedFactor: 0,
    });
  },
}));
