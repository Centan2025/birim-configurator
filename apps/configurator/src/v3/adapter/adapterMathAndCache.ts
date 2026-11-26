import { useConfiguratorStore } from "../../store/useConfiguratorStore";
import {
  getActiveRuntimeTenantProfile,
  buildActiveTenantPricingParams,
  buildActiveTenantSheetConfig,
  scheduleBackgroundStoreNesting,
} from "../../store/storeHelpers";
import { createDefaultWardrobeModule, type DesignProject, calculateFourSpaceDimensions, evaluateProjectCompatibility, evaluateUnifiedEngineeringModel, type BayConfig, computeContinuousKitchenLayers, BoundedLruCache, computeProjectStructuralSignature } from "@birim/core";
import { analyzeAndAdviseSpan, WARDROBE_TEMPLATES, KITCHEN_TEMPLATES, getAllHandleProfiles, getAllHardwareProducts, getV4TemplateById } from "@birim/catalog";
import { generateBOMForProject } from "@birim/manufacturing";
import { calculateProjectPrice } from "@birim/pricing";
import { validateSpatialAndKitchenEngineering, type RowSnapPreviewResult, type SnapSlotCandidate } from "../engine/kitchenSpatialEngine";

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


const cachedSpatialBySig = new BoundedLruCache<
  string,
  ReturnType<typeof validateSpatialAndKitchenEngineering>
>(64);
const cachedContinuousLayersBySig = new BoundedLruCache<
  string,
  ReturnType<typeof computeContinuousKitchenLayers>
>(64);

export function getMemoizedUnifiedEngineering(project: DesignProject) {
  return evaluateUnifiedEngineeringModel(project);
}

export function getMemoizedProjectCompatibility(project: DesignProject) {
  return evaluateProjectCompatibility(project);
}

export function getMemoizedSpatialValidation(project: DesignProject) {
  const sig = computeProjectStructuralSignature(project);
  const hit = cachedSpatialBySig.get(sig);
  if (hit) return hit;
  const computed = validateSpatialAndKitchenEngineering(project);
  cachedSpatialBySig.set(sig, computed);
  return computed;
}

export function getMemoizedContinuousKitchenLayers(project: DesignProject) {
  const sig = computeProjectStructuralSignature(project);
  const hit = cachedContinuousLayersBySig.get(sig);
  if (hit) return hit;
  const computed = computeContinuousKitchenLayers(project);
  cachedContinuousLayersBySig.set(sig, computed);
  return computed;
}

/** One transaction for adapter edits; derived manufacturing state cannot lag geometry. */
export function commitAdapterState(patch: Partial<ReturnType<typeof useConfiguratorStore.getState>>) {
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
  const tenantProfile = state.activeTenantProfile || getActiveRuntimeTenantProfile();
  const sheetConfig = buildActiveTenantSheetConfig(tenantProfile);
  const pricingParams = buildActiveTenantPricingParams(tenantProfile);
  const bom =
    patch.bom ?? generateBOMForProject(project, undefined, { skipSyncNesting: isBrowser, sheetConfig });
  const pricing = patch.pricing ?? calculateProjectPrice(bom, pricingParams, undefined, project.sceneObjects || []);
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
    scheduleBackgroundStoreNesting(project, bom);
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
  const sortedShelves = [...(bay.shelves || [])]
    .filter((s) => !s.isHidden)
    .sort((a, b) => a.elevationY - b.elevationY);

  // Compute top of any bottom drawer stack so space above drawers is ALWAYS a valid shelf interval!
  const bottomDrawers = (bay.drawers || []).filter((d) => (d.elevationY || 0) < netInnerH * 0.65);
  const drawerStackTopY =
    bottomDrawers.length > 0
      ? Math.max(...bottomDrawers.map((d) => (d.elevationY || 0) + d.height))
      : 0;

  const rawIntervals: { label: string; botY: number; topY: number }[] = [];
  const floorStartY = drawerStackTopY > 10 ? drawerStackTopY : 0;
  const floorLabel = drawerStackTopY > 10 ? "Çekmece Üstü" : "Alt Taban";

  const shelvesAboveFloor = sortedShelves.filter((s) => s.elevationY > floorStartY + 30);

  if (shelvesAboveFloor.length === 0) {
    if (netInnerH - floorStartY >= 60) {
      rawIntervals.push({ label: `${floorLabel} ↔ Üst Tavan`, botY: floorStartY, topY: netInnerH });
    } else {
      rawIntervals.push({ label: "Alt Taban ↔ Üst Tavan", botY: 0, topY: netInnerH });
    }
  } else {
    if (shelvesAboveFloor[0].elevationY - floorStartY >= 60) {
      rawIntervals.push({
        label: `${floorLabel} ↔ Raf 1`,
        botY: floorStartY,
        topY: shelvesAboveFloor[0].elevationY,
      });
    }
    for (let k = 0; k < shelvesAboveFloor.length - 1; k++) {
      const bY = shelvesAboveFloor[k].elevationY + (shelvesAboveFloor[k].thickness || T);
      const tY = shelvesAboveFloor[k + 1].elevationY;
      if (tY - bY >= 60) {
        rawIntervals.push({
          label: `Raf ${k + 1} ↔ Raf ${k + 2}`,
          botY: bY,
          topY: tY,
        });
      }
    }
    const lastIdx = shelvesAboveFloor.length - 1;
    const lastBotY =
      shelvesAboveFloor[lastIdx].elevationY + (shelvesAboveFloor[lastIdx].thickness || T);
    if (netInnerH - lastBotY >= 60) {
      rawIntervals.push({
        label: `Raf ${shelvesAboveFloor.length} ↔ Üst Tavan`,
        botY: lastBotY,
        topY: netInnerH,
      });
    }
  }

  return rawIntervals.map((iv) => {
    const height = Math.max(60, iv.topY - iv.botY);
    // Only block if an elevated drawer physically fills this exact span
    const blockedByElevatedDrawer = (bay.drawers || []).some(
      (d) =>
        d.elevationY >= floorStartY &&
        d.elevationY < iv.topY - 12 &&
        d.elevationY + d.height > iv.botY + 12
    );
    if (blockedByElevatedDrawer) {
      return {
        ...iv,
        height,
        hasConflict: true,
        conflictReason: "Çekmece var",
      };
    }
    return {
      ...iv,
      height,
      hasConflict: false,
    };
  });
}

export const EMPTY_VALIDATION_ISSUES: ReturnType<typeof useConfiguratorStore.getState>["validationIssues"] = [];
export const EMPTY_REVISIONS: ReturnType<typeof useConfiguratorStore.getState>["revisions"] = [];
export const EMPTY_FOUR_SPACE = calculateFourSpaceDimensions(
  createDefaultWardrobeModule("empty_scene_placeholder")
);
export const LITE_COMPATIBILITY_REPORT = {
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
export const CACHED_HANDLE_PROFILES = getAllHandleProfiles();
export const CACHED_HARDWARE_CATALOG = getAllHardwareProducts();
