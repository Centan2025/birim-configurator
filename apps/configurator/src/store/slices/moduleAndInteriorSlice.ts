import type { StoreApi } from "zustand";
import { rescaleBayInteriorForHeightChange } from "../../v3/adapter/moduleHarmonizer";
import { applyPostResizeModuleSync } from "../../v3/engine/cabinetResizeAndStackEngine";
import { DesignProject, ModuleInstance, getMaxSafeBayCount, roundIntMm, inferDoorSystemIdFromType, computeBayDoorZones, alignModuleShelvesToSystem32, resolveMultiHoleSpec, evaluateHardwareMountPlacement } from "@birim/core";
import { getV4TemplateById, HANDLE_PROFILES, getHardwareProductById, PROJECT_HARDWARE_PACKAGES } from "@birim/catalog";
import { placeModuleInstanceOnWall, resolveModuleHostWallId } from "../../v3/engine/multiWallSnapAndBvhEngine";
import { getEffectiveSpaceWalls } from "../../v3/engine/kitchenSpatialEngine";
import type { ConfiguratorState } from "../useConfiguratorStore";
import { cloneProject, cloneProjectForSingleModule, recompute, nextHistory } from "../storeHelpers";

export type StoreSet = StoreApi<ConfiguratorState>["setState"];
export type StoreGet = StoreApi<ConfiguratorState>["getState"];

export function createModuleAndInteriorSlice(set: StoreSet, get: StoreGet): Partial<ConfiguratorState> {
  return {
  updateProjectTitle: (title) => {
    const current = get().project;
    const updated: DesignProject = { ...current, title, updatedAt: new Date().toISOString() };
    set({ project: updated, autoSaveStatus: "unsaved" });
  },

  setDimensions: (width, height, depth) => {
    const { project, history, activeModuleIndex, batchStartProject } = get();
    const updated = cloneProjectForSingleModule(project, activeModuleIndex);
    const resolvedModIdx = updated.modules[activeModuleIndex] ? activeModuleIndex : 0;
    const mod = updated.modules[resolvedModIdx];
    if (!mod) return;
    const oldModSnapshot: ModuleInstance = structuredClone(mod);

    if (![width, height, depth].every(Number.isFinite)) return;
    const template = mod.templateId ? getV4TemplateById(mod.templateId) : undefined;
    const limits = template?.dimensionLimits;
    const clamp = (n: number, min: number, max: number) => Math.max(min, Math.min(max, n));
    const next = {
      width: roundIntMm(mod.isFixedWidth ? mod.dimensions.width : clamp(width, limits?.minW ?? 200, limits?.maxW ?? 3600)),
      height: roundIntMm(clamp(height, limits?.minH ?? 260, limits?.maxH ?? 2900)),
      depth: roundIntMm(clamp(depth, limits?.minD ?? 200, limits?.maxD ?? 1450)),
    };
    if (mod.carcass.hullShape === "capsule_stadium") {
      mod.carcass.cornerRadiusMm = Math.min(Math.floor(next.width / 2) - 40, Math.round(next.depth / 2));
    } else if (mod.carcass.hullShape === "rounded_corners") {
      mod.carcass.cornerRadiusMm = Math.max(
        65,
        Math.min(Math.max(65, Math.floor(next.depth / 2) - 20), mod.carcass.cornerRadiusMm || 110)
      );
    } else if (mod.carcass.hullShape === "capsule_table") {
      mod.carcass.cornerRadiusMm = Math.round(next.depth / 2);
    }
    const maxSafeBays = getMaxSafeBayCount(next.width, mod.carcass.panelThickness);
    if (mod.bays.length > maxSafeBays) {
      mod.bays = mod.bays.slice(0, maxSafeBays).map((b, idx) => ({ ...b, index: idx }));
    }
    const oldInner = Math.max(1, mod.dimensions.height - mod.carcass.plinthHeight - 2 * mod.carcass.panelThickness);
    const newInner = Math.max(1, next.height - mod.carcass.plinthHeight - 2 * mod.carcass.panelThickness);
    if (next.height !== mod.dimensions.height) mod.bays.forEach((b) => {
      rescaleBayInteriorForHeightChange(b, oldInner, newInner, mod.carcass.panelThickness);
    });
    mod.dimensions = next;
    const synced = applyPostResizeModuleSync(
      updated.modules,
      updated.sceneObjects || [],
      resolvedModIdx,
      oldModSnapshot,
      updated.space?.ceilingHeight || 2700,
      {
        syncStackedColumns: true,
        reflowAdjacentRow: true,
        wallWidthLimitMm: updated.space?.walls?.[0]?.length,
      }
    );
    updated.modules = synced.modules;
    updated.sceneObjects = synced.sceneObjects;
    updated.updatedAt = new Date().toISOString();
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

  applyHardwareProductToBay: (bayIndex, hardwareProductId, options) => {
    const { project, history, activeModuleIndex, batchStartProject } = get();
    const updated = cloneProject(project, activeModuleIndex);
    const mod = updated.modules[activeModuleIndex] || updated.modules[0];
    if (!mod) return { applied: false, messageTr: "Aktif modül bulunamadı." };
    const hw = getHardwareProductById(hardwareProductId);
    if (!hw) return { applied: false, messageTr: `Donanım bulunamadı: ${hardwareProductId}` };

    const safeBayIdx = Math.max(0, Math.min(bayIndex, Math.max(0, mod.bays.length - 1)));
    const bay = mod.bays[safeBayIdx];
    if (!bay) return { applied: false, messageTr: "Hedef bölme bulunamadı." };

    const evaluation = evaluateHardwareMountPlacement(mod, hw, safeBayIdx, options?.drawerId);
    if (!evaluation.canMount && !options?.forceApply) {
      const firstErr = evaluation.issues.find((i) => i.severity === "error");
      return {
        applied: false,
        messageTr: firstErr ? `${firstErr.reasonTr} Çözüm: ${firstErr.solutionTr}` : evaluation.summaryTr,
      };
    }

    if (hw.familyId === "fam_hinge_concealed" || hw.familyId === "fam_hinge_plate") {
      if (!bay.door || bay.door.type === "open") {
        bay.door = {
          ...(bay.door || { id: `door_${mod.id}_b${safeBayIdx}`, bayIndex: safeBayIdx, softClose: true }),
          type: "single_left",
          doorSystemId: "hinged_single",
          softClose: true,
        };
      }
      bay.door.hardwareProductId = hw.id;
      if (hw.drillingTemplateId) {
        mod.carcass.hingeDrillingTemplateId = hw.drillingTemplateId;
      }
    } else if (hw.familyId === "fam_drawer_box" || hw.familyId === "fam_runner_concealed") {
      let targetDrw = options?.drawerId
        ? bay.drawers.find((d) => d.id === options.drawerId && !d.isHidden)
        : bay.drawers.find((d) => !d.isHidden);
      if (!targetDrw) {
        const nextY = bay.drawers.reduce((maxY, d) => Math.max(maxY, d.elevationY + d.height + 16), 32);
        targetDrw = {
          id: `drw_${mod.id}_b${safeBayIdx}_${Date.now().toString(36)}`,
          bayIndex: safeBayIdx,
          elevationY: nextY,
          height: 180,
          slideType: hw.id.includes("pto") ? "push_to_open" : "soft_close",
          hardwareProductId: hw.id,
          nominalLengthMm: evaluation.recommendedNominalLengthMm || 500,
        };
        bay.drawers.push(targetDrw);
      } else {
        targetDrw.hardwareProductId = hw.id;
        if (evaluation.recommendedNominalLengthMm) {
          targetDrw.nominalLengthMm = evaluation.recommendedNominalLengthMm;
        }
        if (hw.id.includes("legrabox")) targetDrw.boxSystemType = "metal_box_legrabox";
        else if (hw.id.includes("tandembox")) targetDrw.boxSystemType = "metal_box_tandembox";
        else if (hw.id.includes("avantech") || hw.id.includes("atira")) targetDrw.boxSystemType = "metal_box_avantech";
        else targetDrw.boxSystemType = "wooden_undermount";
      }
    } else if (hw.familyId === "fam_lift_system") {
      const liftType = hw.id.includes("hf")
        ? "lift_bi_fold"
        : hw.id.includes("hl")
        ? "lift_parallel"
        : "lift_up_stay";
      bay.door = {
        ...(bay.door || { id: `door_${mod.id}_b${safeBayIdx}`, bayIndex: safeBayIdx, softClose: true }),
        type: liftType,
        doorSystemId: liftType,
        hardwareProductId: hw.id,
        softClose: true,
      };
    } else if (hw.familyId === "fam_sliding_system") {
      const isFolding = hw.id.includes("wingline");
      bay.door = {
        ...(bay.door || { id: `door_${mod.id}_b${safeBayIdx}`, bayIndex: safeBayIdx, softClose: true }),
        type: isFolding ? "folding" : hw.id.includes("slido") || hw.id.includes("slideline") ? "sliding_bottom" : "sliding",
        doorSystemId: isFolding ? "folding_side" : hw.id.includes("slido") || hw.id.includes("slideline") ? "sliding_bottom_rolling" : "sliding_top_hung",
        hardwareProductId: hw.id,
        softClose: true,
      };
    } else if (hw.familyId === "fam_pocket_system") {
      bay.door = {
        ...(bay.door || { id: `door_${mod.id}_b${safeBayIdx}`, bayIndex: safeBayIdx, softClose: true }),
        type: "pocket",
        doorSystemId: "pocket_retractable",
        hardwareProductId: hw.id,
        softClose: true,
      };
    } else if (hw.familyId === "fam_push_soft_close") {
      if (hw.mountSurface === "drawer_box" && bay.drawers.length > 0) {
        bay.drawers.forEach((d) => {
          if (!d.isHidden) d.slideType = "push_to_open_soft_close";
        });
      } else if (bay.door && bay.door.type !== "open") {
        bay.door.openingTechnology = "push_to_open";
        bay.door.handleCategory = "handleless_plain";
      }
    } else if (hw.familyId === "fam_connector") {
      if (hw.id.includes("cabineo")) mod.carcass.connectorSystem = "lamello_cabineo";
      else mod.carcass.connectorSystem = "minifix_dowel";
    } else if (hw.familyId === "fam_plinth_leg") {
      if (hw.id.includes("axilo")) {
        mod.carcass.plinthConstruction = "adjustable_legs_clip";
        mod.carcass.hasAdjustableLegs = true;
      } else if (hw.id.includes("anti_tip")) {
        mod.carcass.wallAnchored = true;
      }
    } else if (hw.familyId === "fam_kitchen_acc" || hw.familyId === "fam_wardrobe_acc") {
      const fittingType = hw.id.includes("lemans")
        ? "corner_lemans"
        : hw.id.includes("dispensa") || hw.id.includes("tandem") || hw.id.includes("space_tower")
        ? "pantry_pullout"
        : hw.id.includes("pantograph")
        ? "wardrobe_lift"
        : hw.id.includes("trouser")
        ? "trouser_rack"
        : "jewelry_tray";
      const netInnerH = Math.max(
        400,
        mod.dimensions.height - (mod.carcass.plinthHeight ?? 100) - 2 * (mod.carcass.panelThickness || 18)
      );
      const liftH = Math.min(840, Math.max(480, Math.round(netInnerH * 0.42)));
      const liftElevY = Math.max(200, Math.round(netInnerH - liftH - 60));
      bay.specialFittings = [
        ...(bay.specialFittings || []),
        {
          id: `sf_${mod.id}_b${safeBayIdx}_${Date.now().toString(36)}`,
          bayIndex: safeBayIdx,
          elevationY: fittingType === "wardrobe_lift" ? liftElevY : 220,
          type: fittingType,
          height:
            fittingType === "pantry_pullout"
              ? Math.max(900, mod.dimensions.height - 200)
              : fittingType === "wardrobe_lift"
              ? liftH
              : 160,
          hardwareProductId: hw.id,
        },
      ];
    }

    updated.updatedAt = new Date().toISOString();
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

    return {
      applied: true,
      messageTr: `${hw.name} Bölme ${safeBayIdx + 1} üzerine uygulandı.`,
    };
  },

  previewHardwarePackageDelta: (packageId) => {
    const { project, pricing } = get();
    const pkg = PROJECT_HARDWARE_PACKAGES.find((x) => x.id === packageId);
    const currentTotalEur = pricing?.totalWithVatEur ?? 0;
    if (!pkg) {
      return { packageId, currentTotalEur, projectedTotalEur: currentTotalEur, deltaEur: 0, affectedDoors: 0, affectedDrawers: 0 };
    }
    let affectedDoors = 0;
    let affectedDrawers = 0;
    let deltaEur = 0;

    project.modules.forEach((mod) => {
      const doorH = Math.max(300, mod.dimensions.height - mod.carcass.plinthHeight);
      const hingesPerLeaf = doorH > 2000 ? 5 : doorH > 1500 ? 4 : doorH > 900 ? 3 : 2;
      mod.bays.forEach((bay) => {
        const hasInternalDrw = (bay.drawers || []).some((d) => d.isInternal && !d.isHidden);
        if (bay.door && bay.door.type !== "open") {
          affectedDoors += 1;
          const dType = bay.door.type;
          const isDouble = dType === "double" || dType === "inset_double";
          const curHw = getHardwareProductById(bay.door.hardwareProductId || "hw_blum_71b3550");
          let nextId = hasInternalDrw ? pkg.hingeZeroProtrusionId : pkg.hingeStandardId;
          let qty = isDouble ? hingesPerLeaf * 2 : hingesPerLeaf;
          if (dType === "lift_bi_fold") { nextId = pkg.liftBiFoldId; qty = 1; }
          else if (dType.startsWith("lift")) { nextId = pkg.liftStayId; qty = 1; }
          else if (dType.startsWith("sliding")) { nextId = pkg.slidingId; qty = 1; }
          const nextHw = getHardwareProductById(nextId);
          if (curHw && nextHw) {
            deltaEur += (nextHw.unitPriceEur - curHw.unitPriceEur) * qty;
          }
        }
        (bay.drawers || []).forEach((drw) => {
          if (drw.isHidden) return;
          affectedDrawers += 1;
          const curHw = getHardwareProductById(drw.hardwareProductId || "hw_blum_tandembox_m30");
          const isHeavy = drw.height >= 220;
          const nextId = drw.boxSystemType === "wooden_undermount"
            ? pkg.runnerWoodenId
            : isHeavy
            ? pkg.drawerHeavyId
            : pkg.drawerStandardId;
          const nextHw = getHardwareProductById(nextId);
          if (curHw && nextHw) {
            deltaEur += nextHw.unitPriceEur - curHw.unitPriceEur;
          }
        });
      });
    });

    const roundedDelta = Math.round(deltaEur * 100) / 100;
    return {
      packageId,
      currentTotalEur,
      projectedTotalEur: Math.round((currentTotalEur + roundedDelta) * 100) / 100,
      deltaEur: roundedDelta,
      affectedDoors,
      affectedDrawers,
    };
  },

  removeHardwareFromBay: (bayIndex, targetKind, targetId) => {
    const { project, history, activeModuleIndex, batchStartProject } = get();
    const updated = cloneProject(project, activeModuleIndex);
    const mod = updated.modules[activeModuleIndex] || updated.modules[0];
    if (!mod) return { removed: false, messageTr: "Aktif modül bulunamadı." };
    const safeBayIdx = Math.max(0, Math.min(bayIndex, Math.max(0, mod.bays.length - 1)));
    const bay = mod.bays[safeBayIdx];
    if (!bay) return { removed: false, messageTr: "Bölme bulunamadı." };

    let label = "";
    if (targetKind === "door" && bay.door) {
      bay.door.hardwareProductId = undefined;
      label = "Kapak donanımı varsayılana sıfırlandı";
    } else if (targetKind === "drawer") {
      const drw = targetId ? bay.drawers.find((d) => d.id === targetId) : bay.drawers[0];
      if (drw) {
        drw.hardwareProductId = undefined;
        label = "Çekmece rayı varsayılana sıfırlandı";
      }
    } else if (targetKind === "special_fitting" && targetId) {
      bay.specialFittings = (bay.specialFittings || []).filter((sf) => sf.id !== targetId);
      label = "Özel donanım bölmeden söküldü";
    }
    if (!label) return { removed: false, messageTr: "Sökülecek donanım bulunamadı." };

    updated.updatedAt = new Date().toISOString();
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
    return { removed: true, messageTr: `${label} (Bölme ${safeBayIdx + 1}).` };
  },

  applyHardwarePackageToProject: (packageId) => {
    const { project, history, batchStartProject, pricing } = get();
    const pkg = PROJECT_HARDWARE_PACKAGES.find((x) => x.id === packageId);
    if (!pkg) return { applied: false, messageTr: "Donanım paketi bulunamadı.", deltaEur: 0 };
    const beforeEur = pricing?.totalWithVatEur ?? 0;
    const updated = cloneProject(project);
    const stdHinge = getHardwareProductById(pkg.hingeStandardId);
    let updatedDoors = 0;
    let updatedDrawers = 0;

    updated.modules.forEach((mod) => {
      if (stdHinge?.drillingTemplateId) {
        mod.carcass.hingeDrillingTemplateId = stdHinge.drillingTemplateId;
      }
      mod.bays.forEach((bay) => {
        const hasInternalDrw = (bay.drawers || []).some((d) => d.isInternal && !d.isHidden);
        if (bay.door && bay.door.type !== "open") {
          updatedDoors += 1;
          const dType = bay.door.type;
          if (dType === "lift_bi_fold") bay.door.hardwareProductId = pkg.liftBiFoldId;
          else if (dType.startsWith("lift")) bay.door.hardwareProductId = pkg.liftStayId;
          else if (dType.startsWith("sliding")) bay.door.hardwareProductId = pkg.slidingId;
          else if (dType !== "pocket" && dType !== "tambour") {
            bay.door.hardwareProductId = hasInternalDrw ? pkg.hingeZeroProtrusionId : pkg.hingeStandardId;
          }
        }
        (bay.drawers || []).forEach((drw) => {
          if (drw.isHidden) return;
          updatedDrawers += 1;
          const isHeavy = drw.height >= 220;
          const targetId = drw.boxSystemType === "wooden_undermount"
            ? pkg.runnerWoodenId
            : isHeavy
            ? pkg.drawerHeavyId
            : pkg.drawerStandardId;
          drw.hardwareProductId = targetId;
          if (targetId.includes("legrabox")) drw.boxSystemType = "metal_box_legrabox";
          else if (targetId.includes("tandembox")) drw.boxSystemType = "metal_box_tandembox";
          else if (targetId.includes("avantech") || targetId.includes("atira")) drw.boxSystemType = "metal_box_avantech";
        });
      });
    });

    updated.updatedAt = new Date().toISOString();
    const { validationIssues, bom, pricing: nextPricing, smartAdvice, lastChangeImpact } = recompute(updated);
    const deltaEur = Math.round(((nextPricing?.totalWithVatEur ?? beforeEur) - beforeEur) * 100) / 100;

    set({
      history: nextHistory(history, project, batchStartProject),
      future: [],
      project: updated,
      autoSaveStatus: "unsaved",
      validationIssues,
      bom,
      pricing: nextPricing,
      smartAdvice,
      lastChangeImpact,
    });

    return {
      applied: true,
      deltaEur,
      messageTr: `${pkg.nameTr} tüm projeye uygulandı (${updatedDoors} kapak, ${updatedDrawers} çekmece • ${deltaEur >= 0 ? "+" : ""}€${deltaEur}).`,
    };
  },

  setPlinthHeight: (plinth) => {
    const { project, history, activeModuleIndex, batchStartProject } = get();
    const updated = cloneProject(project, activeModuleIndex);
    const mod = updated.modules[activeModuleIndex] || updated.modules[0];
    if (!mod) return;

    mod.carcass.plinthHeight = plinth;
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

  setMaterials: (bodyMatId, doorMatId) => {
    const { project, history, activeModuleIndex, batchStartProject } = get();
    const updated = cloneProject(project, activeModuleIndex);
    const mod = updated.modules[activeModuleIndex] || updated.modules[0];
    if (!mod) return;

    if (bodyMatId) mod.carcass.bodyMaterialId = bodyMatId;
    if (doorMatId) {
      mod.carcass.doorMaterialId = doorMatId;
      mod.bays.forEach((b) => { b.door.doorMaterialId = doorMatId; b.drawers.forEach((d) => { d.frontMaterialId = doorMatId; }); });
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

  setBayCount: (count) => {
    const { project, history, activeModuleIndex, batchStartProject } = get();
    if (count < 1 || count > 8) return;
    const updated = cloneProject(project, activeModuleIndex);
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

  setBayDoorType: (bayIdx, type) => {
    const { project, history, activeModuleIndex, batchStartProject } = get();
    const updated = cloneProject(project, activeModuleIndex);
    const mod = updated.modules[activeModuleIndex] || updated.modules[0];
    if (!mod || !mod.bays[bayIdx]) return;

    // Ensure every bay has a valid DoorConfig object (open-system cabinets may have minimal/empty door configs)
    mod.bays.forEach((b, idx) => {
      if (!b.door) {
        b.door = {
          id: `${mod.id}_door_${idx}`,
          bayIndex: idx,
          type: "open",
          doorSystemId: "open",
          overlayType: "full_overlay",
          handleCategory: "bar_handle",
          thickness: 18,
        } as typeof b.door;
      }
    });

    if (type === "tambour") {
      if (mod.dimensions.depth < 320) {
        mod.dimensions.depth = 360;
      }
      const targetBay = mod.bays[bayIdx];
      targetBay.door.type = "tambour";
      targetBay.door.doorSystemId = "tambour_roller";
      targetBay.door.overlayType = "inset";
      targetBay.door.handleCategory = "milled_wood_grip";
      targetBay.drawers = (targetBay.drawers || []).map((dr) => ({ ...dr, isInternal: true }));
      mod.isOpenFront = false;
    } else if (type === "sliding") {
      // Industrial sliding wardrobe rule: minimum 1200mm width, >=600mm depth, >=2 bays, recessed grips, internal drawers only
      if (mod.dimensions.width < 1200) {
        mod.dimensions.width = 1400;
      }
      if (mod.dimensions.depth < 600) {
        mod.dimensions.depth = 600;
      }
      if (mod.bays.length < 2) {
        const clonedBay = structuredClone(mod.bays[0]);
        clonedBay.index = 1;
        clonedBay.door.id = `${mod.id}_door_1`;
        clonedBay.door.bayIndex = 1;
        mod.bays.push(clonedBay);
      }
      const T_s = mod.carcass.panelThickness || 18;
      const innerSpanS = Math.max(400, mod.dimensions.width - 2 * T_s);
      const leafWS = Math.ceil((innerSpanS + 60) / 2);
      mod.bays.forEach((b, idx) => {
        const curMount = b.door.slidingMountingType || "top_hung_pelmet";
        b.door.type = "sliding";
        b.door.doorSystemId =
          curMount === "inset_inside"
            ? "sliding_bottom_rolling"
            : curMount === "coplanar_flush"
            ? "sliding_coplanar"
            : "sliding_top_hung";
        b.door.slidingMountingType = curMount;
        b.door.overlayType = curMount === "inset_inside" ? "inset" : "full_overlay";
        b.door.handleCategory = "recessed_grip";
        b.door.hardwareProductId = "hw_hettich_topline_l";
        // Convert any drawers behind sliding doors into internal drawers
        b.drawers = (b.drawers || []).map((dr) => ({ ...dr, isInternal: true }));
      });
      // Prevent 2-bay sliding overlap dead-zone clash if one bay has pullouts
      if (mod.bays.length === 2) {
        const b0Pull = mod.bays[0].drawers.length > 0 || mod.bays[0].specialFittings.some((f) => !f.type.startsWith("led_"));
        const b1Pull = mod.bays[1].drawers.length > 0 || mod.bays[1].specialFittings.some((f) => !f.type.startsWith("led_"));
        const maxClearBayW = Math.max(380, innerSpanS - leafWS - 6);
        if (b0Pull && !b1Pull) {
          mod.bays[0].customWidth = maxClearBayW;
          mod.bays[1].customWidth = undefined;
        } else if (b1Pull && !b0Pull) {
          mod.bays[0].customWidth = Math.max(420, innerSpanS - T_s - maxClearBayW);
          mod.bays[1].customWidth = undefined;
        }
      }
      mod.isOpenFront = false;
    } else {
      // If switching away from module-wide sliding back to hinged/open, convert any sibling sliding bays cleanly too
      const wasModuleSliding = mod.bays.some((b) => b.door.type === "sliding");
      if (wasModuleSliding && mod.bays.length > 1) {
        mod.bays.forEach((b, idx) => {
          const fallbackType =
            idx === bayIdx
              ? type
              : type === "open"
              ? "open"
              : idx === 0
              ? "single_left"
              : "single_right";
          b.door.type = fallbackType;
          b.door.doorSystemId = inferDoorSystemIdFromType(fallbackType);
          b.door.overlayType = "full_overlay";
          if (b.door.handleCategory === "recessed_grip") {
            b.door.handleCategory = "bar_handle";
          }
        });
      } else {
        mod.bays[bayIdx].door.type = type;
        mod.bays[bayIdx].door.doorSystemId = inferDoorSystemIdFromType(type);
        mod.bays[bayIdx].door.overlayType = "full_overlay";
        if (type !== "open" && (!mod.bays[bayIdx].door.handleCategory || (mod.bays[bayIdx].door.handleCategory as string) === "none")) {
          mod.bays[bayIdx].door.handleCategory = "bar_handle";
        }
        // Full-height external drawer cabinets (e.g. 2/3/4-drawer kitchen bases) have zero remaining >=140mm door zone;
        // when the user explicitly selects a hinged door, convert those drawers to internal drawers so the door renders immediately.
        if (type !== "open") {
          const targetBay = mod.bays[bayIdx];
          const hasExtDrawers = (targetBay.drawers || []).some((d) => !d.isInternal && !d.isHidden);
          if (hasExtDrawers && computeBayDoorZones(mod, bayIdx).length === 0) {
            targetBay.drawers = targetBay.drawers.map((dr) =>
              !dr.isHidden ? { ...dr, isInternal: true } : dr
            );
          }
        }
      }
      mod.isOpenFront = mod.bays.every((b) => !b.door || b.door.type === "open");
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

  setBayHandleCategory: (bayIdx, category, handleProfileId) => {
    const { project, history, activeModuleIndex, batchStartProject } = get();
    const updated = cloneProject(project, activeModuleIndex);
    const mod = updated.modules[activeModuleIndex] || updated.modules[0];
    if (!mod || !mod.bays[bayIdx]) return;

    const matchedProfile =
      (handleProfileId ? HANDLE_PROFILES.find((p) => p.id === handleProfileId) : undefined) ||
      HANDLE_PROFILES.find((p) => p.category === category);
    mod.bays[bayIdx].door.handleCategory = category;
    mod.bays[bayIdx].door.handleProfileId = matchedProfile?.id;
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

  addShelf: (bayIdx) => {
    const { project, history, activeModuleIndex, batchStartProject } = get();
    const updated = cloneProject(project, activeModuleIndex);
    const mod = updated.modules[activeModuleIndex] || updated.modules[0];
    if (!mod || !mod.bays[bayIdx]) return;

    const bay = mod.bays[bayIdx];
    const T = mod.carcass.panelThickness || 18;
    const plinthH = mod.carcass.plinthHeight ?? 100;
    const netH = Math.max(200, mod.dimensions.height - plinthH - 2 * T);
    const drawerTopY =
      bay.drawers.length > 0
        ? Math.max(...bay.drawers.map((d) => d.elevationY + d.height))
        : 0;
    const minY = Math.min(netH - 80, drawerTopY + 64);
    const maxY = Math.max(minY + 32, netH - 64);

    const fixedYs = bay.shelves
      .filter((s) => !s.isHidden && (s.isAdjustable === false || s.isFixed === true))
      .map((s) => s.elevationY)
      .sort((a, b) => a - b);

    // Find the largest open vertical zone between [drawerTopY, ...fixedYs, netH] so fixed structural shelves NEVER shift!
    const anchors = [drawerTopY, ...fixedYs.filter((fy) => fy > drawerTopY + 40 && fy < netH - 40), netH];
    let bestLow = drawerTopY;
    let bestHigh = netH;
    for (let ai = 0; ai < anchors.length - 1; ai++) {
      if (anchors[ai + 1] - anchors[ai] > bestHigh - bestLow) {
        bestLow = anchors[ai];
        bestHigh = anchors[ai + 1];
      }
    }

    const newMovableId = `shelf_${bayIdx}_${Date.now()}`;
    bay.shelves.push({
      id: newMovableId,
      bayIndex: bayIdx,
      elevationY: Math.round((bestLow + bestHigh) / 2),
      isAdjustable: true,
      isFixed: false,
    });

    // Evenly distribute ONLY movable shelves within [bestLow .. bestHigh] on System-32 grid
    const movablesInZone = bay.shelves.filter(
      (sh) =>
        sh.isAdjustable !== false &&
        sh.isFixed !== true &&
        (sh.id === newMovableId || (sh.elevationY > bestLow + 20 && sh.elevationY < bestHigh - 20))
    );
    const zoneSpan = Math.max(120, bestHigh - bestLow);
    movablesInZone.forEach((sh, idx) => {
      const idealY = bestLow + ((idx + 1) * zoneSpan) / (movablesInZone.length + 1);
      const snappedY = Math.round(idealY / 32) * 32;
      sh.elevationY = Math.max(48, Math.min(netH - 48, snappedY));
    });
    if (resolveMultiHoleSpec(mod).mode !== "none") {
      alignModuleShelvesToSystem32(mod, { includeFixedShelves: true });
    }
    bay.shelves.sort((a, b) => a.elevationY - b.elevationY);

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

  addFixedShelf: (bayIdx) => {
    const { project, history, activeModuleIndex, batchStartProject } = get();
    const updated = cloneProject(project, activeModuleIndex);
    const mod = updated.modules[activeModuleIndex] || updated.modules[0];
    if (!mod || !mod.bays[bayIdx]) return;

    const bay = mod.bays[bayIdx];
    const T = mod.carcass.panelThickness || 18;
    const plinthH = mod.carcass.plinthHeight ?? 80;
    const netH = Math.max(200, mod.dimensions.height - plinthH - 2 * T);
    const drawerTopY =
      bay.drawers.length > 0
        ? Math.max(...bay.drawers.map((d) => d.elevationY + d.height))
        : 0;
    const existingYs = bay.shelves
      .filter((s) => !s.isHidden)
      .map((s) => s.elevationY)
      .sort((a, b) => a - b);

    const bounds = [drawerTopY, ...existingYs.filter((y) => y > drawerTopY + 60 && y < netH - 60), netH];
    let gapStart = drawerTopY;
    let gapEnd = netH;
    for (let i = 0; i < bounds.length - 1; i++) {
      if (bounds[i + 1] - bounds[i] > gapEnd - gapStart) {
        gapStart = bounds[i];
        gapEnd = bounds[i + 1];
      }
    }
    const targetY = Math.max(96, Math.min(netH - 96, Math.round((gapStart + gapEnd) / 2)));

    bay.shelves.push({
      id: `fixed_shelf_${bayIdx}_${Date.now()}`,
      bayIndex: bayIdx,
      elevationY: targetY,
      isAdjustable: false,
      isFixed: true,
      fixedConnectorType: "minifix_dowel",
    });
    bay.shelves.sort((a, b) => a.elevationY - b.elevationY);

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

  setShelfMountType: (bayIdx, shelfId, isAdjustable, fixedConnectorType) => {
    const { project, history, activeModuleIndex, batchStartProject } = get();
    const updated = cloneProject(project, activeModuleIndex);
    const mod = updated.modules[activeModuleIndex] || updated.modules[0];
    if (!mod || !mod.bays[bayIdx]) return;

    mod.bays[bayIdx].shelves = mod.bays[bayIdx].shelves.map((sh) => {
      if (sh.id !== shelfId) return sh;
      return {
        ...sh,
        isAdjustable,
        isFixed: !isAdjustable,
        fixedConnectorType: !isAdjustable
          ? fixedConnectorType || sh.fixedConnectorType || "minifix_dowel"
          : sh.fixedConnectorType,
      };
    });

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

  removeShelf: (bayIdx, shelfId) => {
    const { project, history, activeModuleIndex, batchStartProject } = get();
    const updated = cloneProject(project, activeModuleIndex);
    const mod = updated.modules[activeModuleIndex] || updated.modules[0];
    if (!mod || !mod.bays[bayIdx]) return;

    const bay = mod.bays[bayIdx];
    const removedShelf = bay.shelves.find((s) => s.id === shelfId);
    bay.shelves = bay.shelves.filter((s) => s.id !== shelfId);
    if (removedShelf && bay.subDividers && bay.subDividers.length > 0) {
      const T_s = mod.carcass.panelThickness || 18;
      const shelfY = removedShelf.elevationY;
      bay.subDividers = bay.subDividers.filter((sd) => {
        const sdBot = sd.elevationY || 0;
        const sdTop = sdBot + Math.max(60, sd.height || 300);
        const touchesBottom =
          Math.abs(sdBot - shelfY) <= T_s + 8 ||
          Math.abs(sdBot - (shelfY + T_s)) <= 8;
        const touchesTop = Math.abs(sdTop - shelfY) <= T_s + 8;
        return !(touchesBottom || touchesTop);
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

  addHangingRail: (bayIdx) => {
    const { project, history, activeModuleIndex, batchStartProject } = get();
    const updated = cloneProject(project, activeModuleIndex);
    const mod = updated.modules[activeModuleIndex] || updated.modules[0];
    if (!mod || !mod.bays[bayIdx]) return;

    const T_r = mod.carcass.panelThickness || 18;
    const plinth_r = mod.carcass.plinthHeight ?? 100;
    const netH_r = Math.max(240, mod.dimensions.height - plinth_r - 2 * T_r);
    const existingRails = mod.bays[bayIdx].hangingRails.length;
    const targetRailY =
      existingRails === 0
        ? Math.max(120, netH_r - 88)
        : Math.max(96, Math.round((netH_r * 0.48) / 32) * 32);
    mod.bays[bayIdx].hangingRails.push({
      id: `rail_${bayIdx}_${Date.now()}`,
      bayIndex: bayIdx,
      elevationY: Math.min(netH_r - 48, targetRailY),
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

  removeHangingRail: (bayIdx, railId) => {
    const { project, history, activeModuleIndex, batchStartProject } = get();
    const updated = cloneProject(project, activeModuleIndex);
    const mod = updated.modules[activeModuleIndex] || updated.modules[0];
    if (!mod || !mod.bays[bayIdx]) return;

    mod.bays[bayIdx].hangingRails = mod.bays[bayIdx].hangingRails.filter((r) => r.id !== railId);
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

  addDrawer: (bayIdx) => {
    const { project, history, activeModuleIndex, batchStartProject } = get();
    const updated = cloneProject(project, activeModuleIndex);
    const mod = updated.modules[activeModuleIndex] || updated.modules[0];
    if (!mod || !mod.bays[bayIdx]) return;

    const bay = mod.bays[bayIdx];
    const T_d = mod.carcass.panelThickness || 18;
    const plinth_d = mod.carcass.plinthHeight ?? 100;
    const netH_d = Math.max(220, mod.dimensions.height - plinth_d - 2 * T_d);
    const isSlidingBay =
      bay.door?.type === "sliding" ||
      bay.door?.type === "sliding_bottom" ||
      Boolean(bay.door?.doorSystemId?.startsWith("sliding"));
    const isFullDrawerBay =
      !isSlidingBay &&
      (Boolean(mod.isOpenFront) ||
        !bay.door ||
        bay.door.type === "open" ||
        bay.door.doorSystemId === "open");
    const extCountBefore = bay.drawers.filter((d) => !d.isInternal).length;
    const prevTop =
      bay.drawers.length > 0
        ? Math.max(...bay.drawers.map((d) => d.elevationY + d.height))
        : 0;

    if (isFullDrawerBay && extCountBefore >= 1 && prevTop >= netH_d * 0.65) {
      // Redistribute all N external drawers (2, 3, 4, 5, 6...) proportionally from bottom (0) to top (netH_d) with zero overlap!
      bay.drawers.push({
        id: `drw_${bayIdx}_${Date.now()}`,
        bayIndex: bayIdx,
        elevationY: prevTop,
        height: 140,
        slideType: "soft_close",
      });
      const extList = bay.drawers
        .filter((d) => !d.isInternal)
        .sort((a, b) => a.elevationY - b.elevationY);
      const n = extList.length;
      const gapStep = 3;
      const usableSum = Math.max(n * 80, netH_d - (n - 1) * gapStep);
      let cursorY = 0;
      extList.forEach((d, idx) => {
        const isLast = idx === n - 1;
        // Classic 3-drawer ratio (38% bottom + 36% mid + 26% top cutlery); equal height for 2, 4, 5, 6+ drawers
        const hShare =
          n === 3
            ? idx === 0
              ? Math.round(usableSum * 0.38)
              : idx === 1
              ? Math.round(usableSum * 0.35)
              : usableSum - Math.round(usableSum * 0.38) - Math.round(usableSum * 0.35)
            : isLast
            ? netH_d - cursorY
            : Math.round(usableSum / n);
        d.elevationY = cursorY;
        d.height = Math.max(75, hShare);
        cursorY += d.height + gapStep;
      });
    } else {
      const drwH = Math.min(
        180,
        Math.max(110, Math.floor(netH_d / Math.max(2, bay.drawers.length + 1)))
      );
      const clampedElev = Math.max(0, Math.min(netH_d - drwH, prevTop));
      bay.drawers.push({
        id: `drw_${bayIdx}_${Date.now()}`,
        bayIndex: bayIdx,
        elevationY: clampedElev,
        height: drwH,
        slideType: "soft_close",
        isInternal: isSlidingBay ? true : undefined,
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

  removeDrawer: (bayIdx, drawerId) => {
    const { project, history, activeModuleIndex, batchStartProject } = get();
    const updated = cloneProject(project, activeModuleIndex);
    const mod = updated.modules[activeModuleIndex] || updated.modules[0];
    if (!mod || !mod.bays[bayIdx]) return;

    const bayBefore = mod.bays[bayIdx];
    const T_r = mod.carcass.panelThickness || 18;
    const plinth_r = mod.carcass.plinthHeight ?? 100;
    const netH_r = Math.max(220, mod.dimensions.height - plinth_r - 2 * T_r);
    const wasFullStack =
      (Boolean(mod.isOpenFront) ||
        !bayBefore.door ||
        bayBefore.door.type === "open" ||
        bayBefore.door.doorSystemId === "open") &&
      bayBefore.drawers.some((d) => !d.isInternal && d.elevationY + d.height >= netH_r * 0.72);
    mod.bays[bayIdx].drawers = mod.bays[bayIdx].drawers.filter((d) => d.id !== drawerId);
    const remExt = mod.bays[bayIdx].drawers
      .filter((d) => !d.isInternal)
      .sort((a, b) => a.elevationY - b.elevationY);
    if (wasFullStack && remExt.length >= 1) {
      const n = remExt.length;
      const gapStep = 3;
      const usableSum = Math.max(n * 80, netH_r - (n - 1) * gapStep);
      let cursorY = 0;
      remExt.forEach((d, idx) => {
        const isLast = idx === n - 1;
        const hShare =
          n === 3
            ? idx === 0
              ? Math.round(usableSum * 0.38)
              : idx === 1
              ? Math.round(usableSum * 0.35)
              : usableSum - Math.round(usableSum * 0.38) - Math.round(usableSum * 0.35)
            : isLast
            ? netH_r - cursorY
            : Math.round(usableSum / n);
        d.elevationY = cursorY;
        d.height = Math.max(75, hShare);
        cursorY += d.height + gapStep;
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

  addSpecialFitting: (bayIdx, type) => {
    const { project, history, activeModuleIndex, batchStartProject } = get();
    const updated = cloneProject(project, activeModuleIndex);
    const mod = updated.modules[activeModuleIndex] || updated.modules[0];
    if (!mod || !mod.bays[bayIdx]) return;

    const bay = mod.bays[bayIdx];
    if (!bay.specialFittings) bay.specialFittings = [];
    const defaultHeights: Record<string, number> = {
      trouser_rack: 85,
      shoe_rack: 140,
      wire_basket: 160,
      wardrobe_lift: 840,
      jewelry_tray: 70,
      corner_lemans: 520,
      pantry_pullout: 1700,
      waste_bin: 420,
      spice_pullout: 520,
      cutlery_tray: 65,
      tie_rack: 75,
      led_profile: 20,
    };
    const defaultElevs: Record<string, number> = {
      wardrobe_lift: 1100,
      pantry_pullout: 100,
      corner_lemans: 120,
      waste_bin: 80,
      spice_pullout: 80,
      shoe_rack: 180,
      trouser_rack: 680,
      wire_basket: 420,
      jewelry_tray: 820,
      cutlery_tray: 480,
    };
    const existingCount = bay.specialFittings.length;
    const T_f = mod.carcass.panelThickness || 18;
    const plinth_f = mod.carcass.plinthHeight ?? 100;
    const netH_f = Math.max(200, mod.dimensions.height - plinth_f - 2 * T_f);
    const fitH =
      type === "wardrobe_lift"
        ? Math.min(820, Math.max(420, netH_f - 80))
        : Math.min(netH_f - 40, defaultHeights[type] ?? 120);
    const topMargin = type === "wardrobe_lift" ? 48 : 16;
    const rawFitY =
      type === "wardrobe_lift"
        ? Math.max(32, netH_f - fitH - topMargin)
        : defaultElevs[type] ?? (160 + existingCount * 180);
    const clampedFitY = Math.max(32, Math.min(Math.max(32, netH_f - fitH - topMargin), rawFitY));
    bay.specialFittings.push({
      id: `fit_${bayIdx}_${Date.now()}_${existingCount}`,
      bayIndex: bayIdx,
      elevationY: clampedFitY,
      type,
      height: fitH,
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

  removeSpecialFitting: (bayIdx, fittingId) => {
    const { project, history, activeModuleIndex, batchStartProject } = get();
    const updated = cloneProject(project, activeModuleIndex);
    const mod = updated.modules[activeModuleIndex] || updated.modules[0];
    if (!mod || !mod.bays[bayIdx]) return;

    mod.bays[bayIdx].specialFittings = mod.bays[bayIdx].specialFittings.filter((f) => f.id !== fittingId);
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

  addAdjacentModule: () => {
    const { project, history, activeModuleIndex, batchStartProject } = get();
    const updated = cloneProject(project, activeModuleIndex);
    const targetMod = updated.modules[activeModuleIndex] || updated.modules[0];
    const maxRightX = updated.modules.reduce(
      (maxX, m, idx) => Math.max(maxX, (m.position?.x ?? idx * 1000) + m.dimensions.width),
      0
    );

    if (targetMod) {
      const clonedMod: ModuleInstance = structuredClone(targetMod);
      const uid = `${Date.now()}_${updated.modules.length + 1}`;
      clonedMod.id = `mod_${uid}`;
      const baseName = targetMod.name.replace(/\s*\(Kopya\)|\s*#\d+$/g, "").trim();
      clonedMod.name = `${baseName} #${updated.modules.length + 1}`;
      clonedMod.position = {
        x: maxRightX,
        y: targetMod.position?.y ?? 0,
        z: targetMod.position?.z ?? 0,
      };
      clonedMod.bays.forEach((b, i) => {
        b.door.id = `${clonedMod.id}_door_${i}`;
        b.shelves.forEach((s, j) => {
          s.id = `${clonedMod.id}_shelf_${i}_${j}`;
        });
        b.drawers.forEach((d, j) => {
          d.id = `${clonedMod.id}_drw_${i}_${j}`;
        });
        b.hangingRails.forEach((r, j) => {
          r.id = `${clonedMod.id}_rail_${i}_${j}`;
        });
        (b.specialFittings ?? []).forEach((f, j) => {
          f.id = `${clonedMod.id}_fit_${i}_${j}`;
        });
        (b.subDividers ?? []).forEach((sd, j) => {
          sd.id = `${clonedMod.id}_subdiv_${i}_${j}`;
        });
      });
      updated.modules.push(clonedMod);
    }

    const { validationIssues, bom, pricing, smartAdvice, lastChangeImpact } = recompute(updated);
    set({
      history: nextHistory(history, project, batchStartProject),
      future: [],
      project: updated,
      autoSaveStatus: "unsaved",
      activeModuleIndex: updated.modules.length - 1,
      validationIssues,
      bom,
      pricing,
      smartAdvice,
      lastChangeImpact,
    });
  },

  addStackedTopModule: () => {
    const { project, history, activeModuleIndex, batchStartProject } = get();
    const updated = cloneProject(project, activeModuleIndex);
    const targetMod = updated.modules[activeModuleIndex] || updated.modules[0];
    if (!targetMod) return;

    const clonedMod: ModuleInstance = structuredClone(targetMod);
    const uid = `${Date.now()}_${updated.modules.length + 1}`;
    clonedMod.id = `mod_${uid}`;
    const baseName = targetMod.name
      .replace(/\s*\(Kopya\)|\s*\(Üst Yüklük\)|\s*#\d+$/g, "")
      .trim();
    clonedMod.name = `${baseName} (Üst Yüklük)`;

    const baseTopY = (targetMod.position?.y ?? 0) + targetMod.dimensions.height;
    const ceilingH = updated.space?.ceilingHeight || 2600;
    const remainingH = ceilingH - baseTopY;
    const topH = remainingH >= 320 ? Math.min(800, Math.round(remainingH)) : 500;

    clonedMod.dimensions = {
      ...targetMod.dimensions,
      height: topH,
    };
    clonedMod.position = {
      x: targetMod.position?.x ?? 0,
      y: baseTopY,
      z: targetMod.position?.z ?? 0,
    };
    clonedMod.carcass = {
      ...clonedMod.carcass,
      plinthHeight: 0,
      wallAnchored: true,
    };

    const carcassT = clonedMod.carcass.panelThickness || 18;
    const netH = Math.max(100, topH - 2 * carcassT);

    clonedMod.bays.forEach((b, i) => {
      b.door.id = `${clonedMod.id}_door_${i}`;
      b.drawers = [];
      b.hangingRails = [];
      b.specialFittings = [];
      b.subDividers = [];
      b.shelves =
        topH >= 550
          ? [
              {
                id: `${clonedMod.id}_shelf_${i}_0`,
                bayIndex: i,
                elevationY: Math.round(netH / 2),
                thickness: carcassT,
                isAdjustable: true,
              },
            ]
          : [];
    });

    updated.modules.push(clonedMod);

    const { validationIssues, bom, pricing, smartAdvice, lastChangeImpact } = recompute(updated);
    set({
      history: nextHistory(history, project, batchStartProject),
      future: [],
      project: updated,
      autoSaveStatus: "unsaved",
      activeModuleIndex: updated.modules.length - 1,
      validationIssues,
      bom,
      pricing,
      smartAdvice,
      lastChangeImpact,
    });
  },

  duplicateActiveModule: () => {
    const { project, history, activeModuleIndex, batchStartProject, activeWallId } = get();
    const updated = cloneProject(project, activeModuleIndex);
    const targetMod = updated.modules[activeModuleIndex] || updated.modules[0];
    if (!targetMod) return;

    const effWalls = getEffectiveSpaceWalls(updated);
    if (effWalls.length > updated.space.walls.length) {
      updated.space.walls = effWalls.map((w) => ({ ...w, position: { ...w.position } }));
    }

    const clonedMod: ModuleInstance = structuredClone(targetMod);
    clonedMod.id = `mod_${crypto.randomUUID()}`;
    clonedMod.bays.forEach((b, i) => {
      b.door.id = `${clonedMod.id}_door_${i}`;
      for (const items of [b.shelves, b.drawers, b.hangingRails, b.specialFittings ?? [], b.subDividers ?? []]) items.forEach((item, j) => { item.id = `${clonedMod.id}_${i}_${item.id}_${j}`; });
    });
    clonedMod.name = `${targetMod.name} (Kopya)`;

    const targetWallId =
      activeWallId || resolveModuleHostWallId(updated, targetMod) || effWalls[0]?.id || undefined;
    placeModuleInstanceOnWall(updated, clonedMod, {
      wallId: targetWallId,
      preserveY: true,
    });

    updated.modules.push(clonedMod);
    const { validationIssues, bom, pricing, smartAdvice, lastChangeImpact } = recompute(updated);
    set({
      history: nextHistory(history, project, batchStartProject),
      future: [],
      project: updated,
      autoSaveStatus: "unsaved",
      activeModuleIndex: updated.modules.length - 1,
      selectedModuleIds: [clonedMod.id],
      selectedSceneObjectId: null,
      validationIssues,
      bom,
      pricing,
      smartAdvice,
      lastChangeImpact,
    });
  },

  setModuleProductionAndPricingFlags: (moduleIndex, patch) => {
    const { project, history, batchStartProject } = get();
    if (moduleIndex < 0 || moduleIndex >= project.modules.length) return;
    const updated = cloneProject(project, moduleIndex);
    const target = updated.modules[moduleIndex];
    if (!target) return;
    if (typeof patch.includeInProduction === "boolean") {
      target.includeInProduction = patch.includeInProduction;
    }
    if (typeof patch.includeInPricing === "boolean") {
      target.includeInPricing = patch.includeInPricing;
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

  removeActiveModule: () => {
    const { project, history, activeModuleIndex, batchStartProject } = get();
    if (project.modules.length === 0) return;
    const updated = cloneProject(project);
    updated.modules.splice(activeModuleIndex, 1);
    const nextIdx = Math.min(activeModuleIndex, Math.max(0, updated.modules.length - 1));

    const { validationIssues, bom, pricing, smartAdvice, lastChangeImpact } = recompute(updated);
    set({
      history: nextHistory(history, project, batchStartProject),
      future: [],
      project: updated,
      autoSaveStatus: "unsaved",
      activeModuleIndex: nextIdx,
      selectedComponentId: null,
      validationIssues,
      bom,
      pricing,
      smartAdvice,
      lastChangeImpact,
    });
  },

  moveActiveModule: (deltaX: number) => {
    const { project, history, activeModuleIndex, batchStartProject } = get();
    const updated = cloneProject(project, activeModuleIndex);
    const mod = updated.modules[activeModuleIndex];
    if (!mod) return;

    mod.position.x = Math.max(0, mod.position.x + deltaX);
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
  };
}
