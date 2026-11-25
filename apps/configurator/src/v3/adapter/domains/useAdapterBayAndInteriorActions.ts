"use client";
import { computeBaySystem32ShelfHoleElevations } from "../../engine/elevationSnapEngine";
import { useCallback } from "react";
import { useConfiguratorStore } from "../../../store/useConfiguratorStore";
import { alignModuleShelvesToSystem32, calculateBayWidths, calculateNetInnerHeight } from "@birim/core";
import { SubDividerShelfInterval, getBayShelfIntervalsForSubDivider } from "../adapterMathAndCache";
import type { useAdapterStoreAndCoreBindings } from "./useAdapterStoreAndCoreBindings";
import type { useAdapterLayoutAndWizardActions } from "./useAdapterLayoutAndWizardActions";
import { useAdapterHardwareLedMaterialAndDeleteActions } from "./useAdapterHardwareLedMaterialAndDeleteActions";

export function useAdapterBayAndInteriorActions(ctx: Pick<ReturnType<typeof useAdapterStoreAndCoreBindings>, "addSpecialFittingStore" | "setActiveBayIndex" | "setSelectedComponentId" | "setDoorOpenAngleDeg" | "removeShelf" | "removeDrawer" | "removeHangingRail" | "removeSpecialFitting" | "removeActiveModule"> & Pick<ReturnType<typeof useAdapterLayoutAndWizardActions>, "commitActiveModuleUpdate" | "safeBayIndex">) {
  const { commitActiveModuleUpdate, addSpecialFittingStore, setActiveBayIndex, setSelectedComponentId, safeBayIndex, setDoorOpenAngleDeg, removeShelf, removeDrawer, removeHangingRail, removeSpecialFitting, removeActiveModule } = ctx;
/**
   * Update Shelf Elevation Y (in mm from inner bottom panel) by manual drag or exact numeric input
   */
  /**
   * Adds an interior accessory/item (shelf, drawer, rail, special fitting) into the specified bay
   * at an exact elevation Y (mm from bottom) with System 32 / logical boundary clamping.
   */
  /**
   * Splits the specified bay (activeBayIndex) of the active module into 2 equal sub-bays
   * by inserting a full-height vertical divider (Ara Dikme) right down its center,
   * preserving all shelves, rails, drawers, and doors on both halves!
   */
  const splitBayIntoTwo = useCallback(
    (bayIdx?: number) => {
      commitActiveModuleUpdate((mod) => {
        if (mod.bays.length >= 8) return mod;
        const st = useConfiguratorStore.getState();
        const safeBayIdx = Math.max(
          0,
          Math.min(mod.bays.length - 1, typeof bayIdx === "number" ? bayIdx : st.activeBayIndex)
        );
        const targetBay = mod.bays[safeBayIdx];
        if (!targetBay) return mod;

        const T = mod.carcass.panelThickness || 18;
        const currentWidths = calculateBayWidths(mod);
        const origBayW = currentWidths[safeBayIdx] || 600;
        const halfW = Math.max(120, Math.floor((origBayW - T) / 2));

        // Create Left & Right halves from the selected bay so interior items are preserved in both
        const leftBay: typeof targetBay = JSON.parse(JSON.stringify(targetBay));
        const rightBay: typeof targetBay = JSON.parse(JSON.stringify(targetBay));

        // Adjust widths if other bays exist so only the selected bay is split in two!
        if (mod.bays.length > 1) {
          mod.bays.forEach((b, i) => {
            if (i !== safeBayIdx && typeof b.customWidth !== "number") {
              b.customWidth = currentWidths[i];
            }
          });
          leftBay.customWidth = halfW;
          rightBay.customWidth = Math.max(120, origBayW - T - halfW);
        } else {
          leftBay.customWidth = undefined;
          rightBay.customWidth = undefined;
        }

        // Adjust doors for split bays: if it was double door, each half gets a single door (left & right)
        if (targetBay.door.type === "double" || targetBay.door.doorSystemId === "hinged_double") {
          leftBay.door.type = "single_left";
          leftBay.door.doorSystemId = "hinged_single";
          rightBay.door.type = "single_right";
          rightBay.door.doorSystemId = "hinged_single";
        }

        const nextBays = [
          ...mod.bays.slice(0, safeBayIdx),
          leftBay,
          rightBay,
          ...mod.bays.slice(safeBayIdx + 1),
        ];

        // Re-index all bays and give unique IDs to cloned items
        nextBays.forEach((b, idx) => {
          b.index = idx;
          b.door.id = `${mod.id}_door_${idx}`;
          b.door.bayIndex = idx;
          b.shelves = (b.shelves || []).map((s, si) => ({
            ...s,
            id: `${mod.id}_shelf_${idx}_${si}_${Date.now()}`,
            bayIndex: idx,
          }));
          b.hangingRails = (b.hangingRails || []).map((r, ri) => ({
            ...r,
            id: `${mod.id}_rail_${idx}_${ri}_${Date.now()}`,
            bayIndex: idx,
          }));
          b.drawers = (b.drawers || []).map((d, di) => ({
            ...d,
            id: `${mod.id}_drw_${idx}_${di}_${Date.now()}`,
            bayIndex: idx,
          }));
          b.specialFittings = (b.specialFittings || []).map((f, fi) => ({
            ...f,
            id: `${mod.id}_fit_${idx}_${fi}_${Date.now()}`,
            bayIndex: idx,
          }));
          b.subDividers = (b.subDividers || []).map((sd, sdi) => ({
            ...sd,
            id: `${mod.id}_subdiv_${idx}_${sdi}_${Date.now()}`,
            bayIndex: idx,
            offsetX: Math.min(Math.max(40, halfW - 40), Math.round(sd.offsetX * 0.5)),
          }));
        });

        mod.bays = nextBays;
        return mod;
      }, true);
    },
    [commitActiveModuleUpdate]
  );

  const addInteriorItemAtElevation = useCallback(
    (
      bayIdx: number,
      itemKind: string,
      elevationY: number,
      options?: { drawerHeight?: number; isInternal?: boolean; offsetX?: number; exactElevation?: boolean }
    ) => {
      commitActiveModuleUpdate((mod) => {
        const netH = calculateNetInnerHeight(mod);
        const safeBayIdx = Math.max(0, Math.min(mod.bays.length - 1, bayIdx));
        const bay = mod.bays[safeBayIdx];
        if (!bay) return mod;

        const isExact = Boolean(options?.exactElevation);
        const snappedY = isExact ? Math.round(elevationY) : Math.round(elevationY / 32) * 32;

        // Helper to avoid physical overlap while preserving exact user drop elevation
        const resolveCollisionFreeY = (targetY: number, minGap = 96, minY = 32, maxY = netH - 32): number => {
          const effGap = isExact ? 24 : minGap;
          const stepUnit = isExact ? 16 : 32;
          const occupied = [
            ...(bay.shelves || []).map((s) => s.elevationY),
            ...(bay.hangingRails || []).map((r) => r.elevationY),
            ...(bay.specialFittings || []).map((f) => f.elevationY),
          ];
          let candidate = Math.max(minY, Math.min(maxY, targetY));
          for (let step = 0; step <= 16; step++) {
            const offset = step * stepUnit;
            for (const dir of [1, -1]) {
              const testY = Math.max(minY, Math.min(maxY, candidate + dir * offset));
              if (!occupied.some((oy) => Math.abs(oy - testY) < effGap)) {
                return testY;
              }
            }
          }
          return candidate;
        };

        // Case 0A: Full-Height Ara Dikme (Splits the target bay into 2 sub-bays!)
        if (
          itemKind === "lib_carcass_divider" ||
          itemKind === "carcass_divider" ||
          itemKind === "ara_dikme"
        ) {
          if (mod.bays.length >= 8) return mod;
          const T = mod.carcass.panelThickness || 18;
          const currentWidths = calculateBayWidths(mod);
          const origBayW = currentWidths[safeBayIdx] || 600;
          const halfW =
            typeof options?.offsetX === "number"
              ? Math.max(120, Math.min(origBayW - T - 120, Math.round(options.offsetX)))
              : Math.max(120, Math.floor((origBayW - T) / 2));

          const leftBay: typeof bay = JSON.parse(JSON.stringify(bay));
          const rightBay: typeof bay = JSON.parse(JSON.stringify(bay));

          if (mod.bays.length > 1 || typeof options?.offsetX === "number") {
            mod.bays.forEach((b, i) => {
              if (i !== safeBayIdx && typeof b.customWidth !== "number") {
                b.customWidth = currentWidths[i];
              }
            });
            leftBay.customWidth = halfW;
            rightBay.customWidth = Math.max(120, origBayW - T - halfW);
          }

          if (bay.door.type === "double" || bay.door.doorSystemId === "hinged_double") {
            leftBay.door.type = "single_left";
            leftBay.door.doorSystemId = "hinged_single";
            rightBay.door.type = "single_right";
            rightBay.door.doorSystemId = "hinged_single";
          }

          const nextBays = [
            ...mod.bays.slice(0, safeBayIdx),
            leftBay,
            rightBay,
            ...mod.bays.slice(safeBayIdx + 1),
          ];
          nextBays.forEach((b, idx) => {
            b.index = idx;
            b.door.id = `${mod.id}_door_${idx}`;
            b.door.bayIndex = idx;
            b.shelves = (b.shelves || []).map((s, si) => ({
              ...s,
              id: `${mod.id}_shelf_${idx}_${si}_${Date.now()}`,
              bayIndex: idx,
            }));
            b.hangingRails = (b.hangingRails || []).map((r, ri) => ({
              ...r,
              id: `${mod.id}_rail_${idx}_${ri}_${Date.now()}`,
              bayIndex: idx,
            }));
            b.drawers = (b.drawers || []).map((d, di) => ({
              ...d,
              id: `${mod.id}_drw_${idx}_${di}_${Date.now()}`,
              bayIndex: idx,
            }));
          });
          mod.bays = nextBays;
          return mod;
        }

        // Case 0B: Raf Arası Dikme — Places into the EXACT shelf interval under cursor!
        if (
          itemKind === "lib_sub_divider" ||
          itemKind === "sub_divider" ||
          itemKind === "raf_arasi_dikme"
        ) {
          const T = mod.carcass.panelThickness || 18;
          const bayWidths = calculateBayWidths(mod);
          const bayW = bayWidths[safeBayIdx] || 600;
          const intervals = getBayShelfIntervalsForSubDivider(bay, netH, T);
          const usableIntervals = intervals.filter((iv) => !iv.hasConflict);
          const pool = usableIntervals.length > 0 ? usableIntervals : intervals;

          const chosenIv =
            pool.find((iv) => elevationY >= iv.botY - 24 && elevationY <= iv.topY + 24) ||
            pool.reduce(
              (best, iv) =>
                !best ||
                Math.abs((iv.botY + iv.topY) / 2 - elevationY) <
                  Math.abs((best.botY + best.topY) / 2 - elevationY)
                  ? iv
                  : best,
              null as SubDividerShelfInterval | null
            );

          if (!chosenIv) return mod;

          const botY = chosenIv.botY;
          const spanH = Math.max(60, chosenIv.height);
          const existingInSpan = (bay.subDividers || []).filter(
            (sd) => Math.abs(sd.elevationY - botY) <= 15
          ).length;
          const rawX =
            typeof options?.offsetX === "number"
              ? options.offsetX
              : Math.round(
                  bayW / 2 -
                    T / 2 +
                    (existingInSpan % 2 === 1 ? 90 : existingInSpan > 0 ? -90 : 0)
                );
          const clampedX = Math.max(40, Math.min(Math.max(72, bayW - T - 40), Math.round(rawX / 5) * 5));

          bay.subDividers = bay.subDividers || [];
          bay.subDividers.push({
            id: `subdiv_${safeBayIdx}_${Date.now()}_${bay.subDividers.length}`,
            bayIndex: safeBayIdx,
            offsetX: clampedX,
            elevationY: botY,
            height: spanH,
            thickness: T,
          });
          return mod;
        }

        if (
          itemKind === "lib_shelf" ||
          itemKind === "shelf" ||
          itemKind === "lib_fixed_shelf" ||
          itemKind === "fixed_shelf"
        ) {
          const isFixedShelf = itemKind === "lib_fixed_shelf" || itemKind === "fixed_shelf";
          const clampedY = resolveCollisionFreeY(snappedY, 96, 32, netH - 32);
          bay.shelves = bay.shelves || [];
          bay.shelves.push({
            id: `shelf_${safeBayIdx}_${Date.now()}`,
            bayIndex: safeBayIdx,
            elevationY: clampedY,
            thickness: isFixedShelf ? 25 : mod.carcass.panelThickness || 18,
            isAdjustable: !isFixedShelf,
            isFixed: isFixedShelf,
            fixedConnectorType: isFixedShelf ? "minifix_dowel" : undefined,
          });
        } else if (
          itemKind === "lib_drawer" ||
          itemKind === "drawer" ||
          itemKind === "lib_internal_drawer" ||
          itemKind === "internal_drawer" ||
          itemKind === "lib_hw_legrabox" ||
          itemKind === "lib_hw_tandembox" ||
          itemKind === "lib_hw_movento"
        ) {
          const isInternal = itemKind.includes("internal") || !!options?.isInternal;
          const h = options?.drawerHeight || (isInternal ? 140 : 180);
          const targetBoxSys: import("@birim/core").DrawerBoxSystemType | undefined =
            itemKind === "lib_hw_legrabox"
              ? "metal_box_legrabox"
              : itemKind === "lib_hw_tandembox"
              ? "metal_box_tandembox"
              : itemKind === "lib_hw_movento"
              ? "wooden_undermount"
              : mod.carcass.drawerBoxSystem;
          if (targetBoxSys) {
            mod.carcass.drawerBoxSystem = targetBoxSys;
          }
          const targetHwId =
            targetBoxSys === "metal_box_tandembox"
              ? "hw_blum_tandembox_m30"
              : targetBoxSys === "metal_box_avantech"
              ? "hw_hettich_avantech_m"
              : targetBoxSys === "wooden_undermount"
              ? "hw_blum_movento_760h"
              : isInternal
              ? "hw_blum_legrabox_m40"
              : "hw_blum_legrabox_c70";

          bay.drawers = bay.drawers || [];
          // Smart stacking: if dropped near the bottom or overlapping an existing drawer, stack neatly on top of the highest drawer or at snappedY
          let clampedY = Math.max(0, Math.min(netH - h, snappedY));
          const hasOverlap = bay.drawers.some(
            (d) => clampedY < d.elevationY + d.height && clampedY + h > d.elevationY
          );
          if (hasOverlap || (!isExact && clampedY < 96)) {
            const topOfStack = bay.drawers.reduce(
              (maxTop, d) => Math.max(maxTop, d.elevationY + d.height),
              0
            );
            if (topOfStack + h <= netH) {
              clampedY = topOfStack;
            }
          }
          const optNl = Math.min(
            600,
            Math.max(270, Math.floor((mod.dimensions.depth - 28) / 50) * 50)
          );
          bay.drawers.push({
            id: `drw_${safeBayIdx}_${Date.now()}`,
            bayIndex: safeBayIdx,
            elevationY: clampedY,
            height: h,
            slideType: "soft_close",
            ...(targetBoxSys ? { boxSystemType: targetBoxSys } : {}),
            isInternal,
            hardwareProductId: targetHwId,
            nominalLengthMm: optNl,
          });
        } else if (
          itemKind === "lib_rail" ||
          itemKind === "rail" ||
          itemKind === "hanging_rail" ||
          itemKind === "lib_rail_lift" ||
          itemKind === "lib_rail_led"
        ) {
          // Logical wardrobe hanging zone: at least 350mm, and if dropped near top, place 80mm below top shelf/panel
          const clampedY = resolveCollisionFreeY(snappedY, 128, isExact ? 140 : 320, netH - 36);
          const profileType: import("@birim/core").HangingRailConfig["profileType"] =
            itemKind === "lib_rail_lift"
              ? "lift_pantograph"
              : itemKind === "lib_rail_led"
              ? "led_black_30x15"
              : "oval_30x15";
          if (itemKind === "lib_rail_led") {
            mod.carcass.ledLightingEnabled = true;
            mod.carcass.ledPlacementMode = "hanging_rod";
          }
          bay.hangingRails = bay.hangingRails || [];
          bay.hangingRails.push({
            id: `rail_${safeBayIdx}_${Date.now()}`,
            bayIndex: safeBayIdx,
            elevationY: clampedY,
            profileType,
            hasIntegratedLed: itemKind === "lib_rail_led",
            isLiftMechanism: itemKind === "lib_rail_lift",
          });
        } else {
          // Special fittings: trouser_rack, shoe_rack, wire_basket, jewelry_tray, tie_rack, belt_rack, wardrobe_lift, led_profile
          let fittingType: import("@birim/core").SpecialFittingConfig["type"] = "trouser_rack";
          if (itemKind.includes("trouser")) fittingType = "trouser_rack";
          else if (itemKind.includes("shoe")) fittingType = "shoe_rack";
          else if (itemKind.includes("wire")) fittingType = "wire_basket";
          else if (itemKind.includes("jewelry")) fittingType = "jewelry_tray";
          else if (itemKind.includes("tie")) fittingType = "tie_rack";
          else if (itemKind.includes("belt")) fittingType = "belt_rack";
          else if (itemKind.includes("lift")) fittingType = "wardrobe_lift";
          else if (itemKind.includes("led")) fittingType = "led_profile";

          const fitHeight =
            fittingType === "wardrobe_lift"
              ? Math.min(820, Math.max(420, netH - 80))
              : 120;
          const maxFitY = Math.max(32, netH - fitHeight - 48);
          const targetY =
            fittingType === "wardrobe_lift"
              ? Math.min(maxFitY, Math.max(32, snappedY - Math.round(fitHeight * 0.75)))
              : snappedY;
          const clampedY = resolveCollisionFreeY(targetY, 96, 32, maxFitY);
          bay.specialFittings = bay.specialFittings || [];
          bay.specialFittings.push({
            id: `fit_${fittingType}_${safeBayIdx}_${Date.now()}`,
            bayIndex: safeBayIdx,
            elevationY: Math.min(maxFitY, clampedY),
            type: fittingType,
            height: fitHeight,
          });
        }
        return mod;
      }, true);
    },
    [commitActiveModuleUpdate]
  );

  const setShelfElevation = useCallback(
    (bayIdx: number, shelfId: string, elevationY: number, pushHistory = true) => {
      commitActiveModuleUpdate((mod) => {
        const netH = calculateNetInnerHeight(mod);
        const T = mod.carcass.panelThickness || 18;
        let clampedY = Math.max(32, Math.min(Math.max(64, netH - 32), Math.round(elevationY)));
        const bay = mod.bays[bayIdx];
        if (!bay) return mod;
        const holeYs = computeBaySystem32ShelfHoleElevations(mod, bayIdx, shelfId, {
          includeFixedShelves: false,
        });
        if (holeYs && holeYs.length > 0) {
          let bestHole = holeYs[0];
          let bestDiff = Math.abs(clampedY - bestHole);
          for (let i = 1; i < holeYs.length; i++) {
            const diff = Math.abs(clampedY - holeYs[i]);
            if (diff < bestDiff) {
              bestDiff = diff;
              bestHole = holeYs[i];
            }
          }
          clampedY = bestHole;
        }
        bay.shelves = bay.shelves.map((s) =>
          s.id === shelfId ? { ...s, elevationY: clampedY } : s
        );
        // Automatically re-snap any sub-dividers in this bay so they stay flush between shelves
        if (bay.subDividers && bay.subDividers.length > 0) {
          const ivs = getBayShelfIntervalsForSubDivider(bay, netH, T);
          const freeIvs = ivs.filter((iv) => !iv.hasConflict);
          const pool = freeIvs.length > 0 ? freeIvs : ivs;
          if (pool.length > 0) {
            bay.subDividers = bay.subDividers.map((sd) => {
              const midY = sd.elevationY + sd.height / 2;
              const best = pool.reduce((b, iv) =>
                Math.abs((iv.botY + iv.topY) / 2 - midY) < Math.abs((b.botY + b.topY) / 2 - midY)
                  ? iv
                  : b
              );
              return { ...sd, elevationY: best.botY, height: best.height };
            });
          }
        }
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
      pushHistory = true,
      hardwareUpdates?: {
        hardwareProductId?: string;
        nominalLengthMm?: number;
        isInternal?: boolean;
        frontProfile?: import("@birim/core").DoorCrossSectionProfile;
        frontMaterialId?: string;
      }
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
          return {
            ...d,
            elevationY: y,
            height: h,
            ...(hardwareUpdates || {}),
          };
        });
        return mod;
      }, pushHistory);
    },
    [commitActiveModuleUpdate]
  );

  const addSpecialFitting = useCallback(
    (
      bayIdx: number,
      fittingType: import("@birim/core").SpecialFittingConfig["type"]
    ) => {
      if (fittingType.startsWith("led_")) {
        // Multi-door / multi-bay cabinets: add recessed LED across ALL bays of the module!
        commitActiveModuleUpdate((mod) => {
          const netH = calculateNetInnerHeight(mod);
          const bayWidths = calculateBayWidths(mod);
          mod.bays.forEach((b, bIdx) => {
            b.specialFittings = b.specialFittings || [];
            if (!b.specialFittings.some((f) => f.type === fittingType)) {
              const bw = bayWidths[bIdx] || 500;
              b.specialFittings.push({
                id: `fit_${fittingType}_${mod.id}_${bIdx}_${Date.now()}`,
                bayIndex: bIdx,
                elevationY:
                  fittingType === "led_rod_strip"
                    ? Math.max(300, netH - 120)
                    : fittingType === "led_profile"
                    ? Math.max(200, netH - 20)
                    : 20,
                type: fittingType,
                height: fittingType === "led_vertical_strip" ? Math.max(160, netH - 24) : 16,
                width: fittingType === "led_vertical_strip" ? 14 : Math.max(60, bw - 12),
                depth: fittingType === "led_vertical_strip" ? 75 : 18,
              });
            }
          });
          return mod;
        }, true);
        return;
      }
      addSpecialFittingStore(bayIdx, fittingType);
    },
    [commitActiveModuleUpdate, addSpecialFittingStore]
  );

  const setSpecialFittingPlacement = useCallback(
    (
      bayIdx: number,
      fittingId: string,
      updates: { elevationY?: number; height?: number; width?: number; depth?: number },
      pushHistory = true
    ) => {
      commitActiveModuleUpdate((mod) => {
        const netH = calculateNetInnerHeight(mod);
        const bay = mod.bays[bayIdx];
        if (!bay || !bay.specialFittings) return mod;
        const targetFit = bay.specialFittings.find((f) => f.id === fittingId);
        const isLed = targetFit?.type.startsWith("led_");
        mod.bays.forEach((b, bIdx) => {
          if (!b.specialFittings) return;
          b.specialFittings = b.specialFittings.map((f) => {
            if (bIdx === bayIdx ? f.id !== fittingId : !(isLed && f.type === targetFit?.type)) {
              return f;
            }
            const nextH =
              typeof updates.height === "number"
                ? Math.max(4, Math.min(netH, Math.round(updates.height)))
                : f.height;
            const nextY =
              typeof updates.elevationY === "number"
                ? Math.max(0, Math.min(Math.max(0, netH - nextH), Math.round(updates.elevationY)))
                : f.elevationY;
            const nextW =
              typeof updates.width === "number"
                ? Math.max(6, Math.min(2400, Math.round(updates.width)))
                : f.width;
            const nextD =
              typeof updates.depth === "number"
                ? Math.max(6, Math.min(850, Math.round(updates.depth)))
                : f.depth;
            return { ...f, elevationY: nextY, height: nextH, width: nextW, depth: nextD };
          });
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

  const setHangingRailProfile = useCallback(
    (
      bayIdx: number,
      railId: string,
      profileType: import("@birim/core").HangingRailConfig["profileType"]
    ) => {
      commitActiveModuleUpdate((mod) => {
        const bay = mod.bays[bayIdx];
        if (!bay) return mod;
        bay.hangingRails = bay.hangingRails.map((r) =>
          r.id === railId
            ? {
                ...r,
                profileType,
                hasIntegratedLed: profileType === "led_black_30x15",
                isLiftMechanism: profileType === "lift_pantograph",
              }
            : r
        );
        return mod;
      }, true);
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
    (bayIdx: number, customSpan?: { elevationY: number; height: number; offsetX?: number }) => {
      commitActiveModuleUpdate((mod) => {
        const bay = mod.bays[bayIdx];
        if (!bay) return mod;
        const bayWidths = calculateBayWidths(mod);
        const bayW = bayWidths[bayIdx] || 600;
        const netH = calculateNetInnerHeight(mod);
        const T = mod.carcass.panelThickness || 18;
        const intervals = getBayShelfIntervalsForSubDivider(bay, netH, T);
        const freeIntervals = intervals.filter((iv) => !iv.hasConflict);

        let elevY = 0;
        let spanH = Math.min(350, netH);
        if (customSpan && typeof customSpan.elevationY === "number" && typeof customSpan.height === "number") {
          elevY = Math.max(0, Math.round(customSpan.elevationY));
          spanH = Math.max(60, Math.min(netH - elevY, Math.round(customSpan.height)));
          // Ensure customSpan does not collide with a hanging rail or drawer
          const customMidY = elevY + spanH / 2;
          const matchingIv = intervals.find((iv) => customMidY >= iv.botY && customMidY <= iv.topY);
          if (matchingIv?.hasConflict) {
            if (freeIntervals.length === 0) return mod;
            elevY = freeIntervals[0].botY;
            spanH = freeIntervals[0].height;
          }
        } else {
          if (freeIntervals.length === 0) {
            // No conflict-free shelf interval exists in this bay (e.g. hanging rail occupies the bay)
            return mod;
          }
          // Prefer a conflict-free interval that does not yet have a sub-divider, or the first conflict-free interval
          const unoccupiedFreeIv =
            freeIntervals.find(
              (iv) => !(bay.subDividers || []).some((sd) => Math.abs(sd.elevationY - iv.botY) <= 15)
            ) || freeIntervals[0];
          elevY = unoccupiedFreeIv.botY;
          spanH = Math.max(80, unoccupiedFreeIv.height);
        }

        const existingInSameSpan = (bay.subDividers || []).filter(
          (sd) => Math.abs(sd.elevationY - elevY) <= 15
        ).length;
        const defaultOffsetX =
          typeof customSpan?.offsetX === "number"
            ? customSpan.offsetX
            : Math.round(bayW / 2 - T / 2 + (existingInSameSpan % 2 === 1 ? 90 : existingInSameSpan > 0 ? -90 : 0));
        const clampedX = Math.max(50, Math.min(Math.max(80, bayW - T - 50), defaultOffsetX));

        if (!bay.subDividers) bay.subDividers = [];
        bay.subDividers.push({
          id: `subdiv_${bayIdx}_${Date.now()}_${bay.subDividers.length}`,
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
   * Update a partial vertical sub-divider's horizontal offsetX, bottom elevationY, span height, or targetMidY (vertical drag across shelf intervals!)
   */
  const setSubDividerPlacement = useCallback(
    (
      bayIdx: number,
      subDividerId: string,
      updates: {
        offsetX?: number;
        elevationY?: number;
        height?: number;
        targetMidY?: number;
        targetBayIndex?: number;
      },
      pushHistory = true
    ) => {
      commitActiveModuleUpdate((mod) => {
        const srcBay = mod.bays[bayIdx];
        if (!srcBay || !srcBay.subDividers) return mod;
        const foundSd = srcBay.subDividers.find((s) => s.id === subDividerId);
        if (!foundSd) return mod;

        const destBayIdx =
          typeof updates.targetBayIndex === "number"
            ? Math.max(0, Math.min(mod.bays.length - 1, updates.targetBayIndex))
            : bayIdx;
        const destBay = mod.bays[destBayIdx];
        if (!destBay) return mod;

        const bayWidths = calculateBayWidths(mod);
        const bayW = bayWidths[destBayIdx] || 600;
        const netH = calculateNetInnerHeight(mod);
        const T = mod.carcass.panelThickness || 18;
        const intervals = getBayShelfIntervalsForSubDivider(destBay, netH, T);
        const usableIntervals = intervals.filter((iv) => !iv.hasConflict);
        const candidateIntervals = usableIntervals.length > 0 ? usableIntervals : intervals;

        const nextX =
          typeof updates.offsetX === "number"
            ? Math.max(40, Math.min(Math.max(60, bayW - T - 40), Math.round(updates.offsetX)))
            : Math.max(40, Math.min(Math.max(60, bayW - T - 40), foundSd.offsetX));

        let nextY = foundSd.elevationY;
        let nextH = foundSd.height;

        if (typeof updates.elevationY === "number" && typeof updates.height === "number") {
          nextH = Math.max(60, Math.min(netH, Math.round(updates.height)));
          nextY = Math.max(0, Math.min(Math.max(0, netH - nextH), Math.round(updates.elevationY)));
        } else if (typeof updates.targetMidY === "number" && candidateIntervals.length > 0) {
          const midY = updates.targetMidY;
          const containingIv = candidateIntervals.find(
            (iv) => midY >= iv.botY && midY <= iv.topY
          );
          const bestIv =
            containingIv ||
            candidateIntervals.reduce((best, iv) =>
              Math.abs((iv.botY + iv.topY) / 2 - midY) <
              Math.abs((best.botY + best.topY) / 2 - midY)
                ? iv
                : best
            );
          nextY = bestIv.botY;
          nextH = Math.max(60, bestIv.height);
        } else {
          if (typeof updates.height === "number") {
            nextH = Math.max(60, Math.min(netH, Math.round(updates.height)));
          }
          if (typeof updates.elevationY === "number") {
            nextY = Math.max(0, Math.min(Math.max(0, netH - nextH), Math.round(updates.elevationY)));
          }
        }

        const updatedItem = {
          ...foundSd,
          bayIndex: destBayIdx,
          offsetX: nextX,
          elevationY: nextY,
          height: nextH,
        };

        if (destBayIdx !== bayIdx) {
          srcBay.subDividers = srcBay.subDividers.filter((s) => s.id !== subDividerId);
          destBay.subDividers = [...(destBay.subDividers || []), updatedItem];
        } else {
          srcBay.subDividers = srcBay.subDividers.map((s) =>
            s.id === subDividerId ? updatedItem : s
          );
        }
        return mod;
      }, pushHistory);
    },
    [commitActiveModuleUpdate]
  );

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

  /**
   * Remove module at a specific index (keeps at least 1 module in the project)
   */

  /**
   * Apply an instant interior layout preset to ONLY the selected compartment (bayIdx)
   * for the 3D Wardrobe Compartment Workflow (Shelves, Double Rail, Rail+Drawers, Trouser Rack, Shoe Tower).
   */
  const applyBayInteriorPreset = useCallback(
    (
      bayIdx: number,
      presetId:
        | "shelves_5"
        | "rail_double"
        | "rail_drawers_3"
        | "rail_trouser"
        | "shoe_tower"
        | "shirt_shelf"
        | "dress_drawer"
        | "mixed_combo",
      options?: {
        shelfCount?: number;
        shelfMountMode?: "auto" | "all_adjustable" | "all_fixed";
        shelfThicknessMm?: 18 | 25;
      }
    ) => {
      commitActiveModuleUpdate((mod) => {
        const bay = mod.bays[bayIdx];
        if (!bay) return mod;
        const netH = calculateNetInnerHeight(mod);
        const bayWidths = calculateBayWidths(mod);
        const bw = bayWidths[bayIdx] || 550;

        bay.shelves = [];
        bay.drawers = [];
        bay.hangingRails = [];
        bay.specialFittings = (bay.specialFittings || []).filter((f) => f.type.startsWith("led_"));

        if (presetId === "shelves_5") {
          const count = Math.max(2, Math.min(10, Math.round(options?.shelfCount ?? 5)));
          const mountMode = options?.shelfMountMode ?? "auto";
          const midFixedIdx = Math.ceil(count / 2); // Shelf 3 of 5 at exact mid-height (~1042mm) acts as structural Konstruktionsboden!
          const step = Math.round(netH / (count + 1));
          const resolvedThick = options?.shelfThicknessMm ?? (bw > 980 ? 25 : undefined);
          for (let i = 1; i <= count; i++) {
            const isMidFixed =
              mountMode === "all_fixed"
                ? true
                : mountMode === "all_adjustable"
                ? false
                : netH >= 1400 && i === midFixedIdx;
            const rawY = i * step;
            const snappedY = isMidFixed ? rawY : Math.round(rawY / 32) * 32;
            bay.shelves.push({
              id: `${mod.id}_b${bayIdx}_sh_${i}_${Date.now()}`,
              bayIndex: bayIdx,
              elevationY: Math.min(netH - 80, Math.max(80, snappedY)),
              isAdjustable: !isMidFixed,
              isFixed: isMidFixed,
              ...(isMidFixed ? { fixedConnectorType: "minifix_dowel" as const } : {}),
              ...(resolvedThick ? { thickness: resolvedThick } : {}),
            });
          }
        } else if (presetId === "rail_double") {
          const midShelfY = Math.round(netH * 0.5);
          const topShelfY = Math.min(netH - 180, Math.round(netH * 0.86));
          bay.shelves.push(
            {
              id: `${mod.id}_b${bayIdx}_sh_mid_${Date.now()}`,
              bayIndex: bayIdx,
              elevationY: midShelfY,
              isAdjustable: false,
            },
            {
              id: `${mod.id}_b${bayIdx}_sh_top_${Date.now()}`,
              bayIndex: bayIdx,
              elevationY: topShelfY,
              isAdjustable: true,
            }
          );
          bay.hangingRails.push(
            {
              id: `${mod.id}_b${bayIdx}_rail_low_${Date.now()}`,
              bayIndex: bayIdx,
              elevationY: Math.max(320, midShelfY - 70),
            },
            {
              id: `${mod.id}_b${bayIdx}_rail_high_${Date.now()}`,
              bayIndex: bayIdx,
              elevationY: Math.max(400, topShelfY - 70),
            }
          );
        } else if (presetId === "rail_drawers_3") {
          const drwH = 180;
          for (let i = 0; i < 3; i++) {
            bay.drawers.push({
              id: `${mod.id}_b${bayIdx}_drw_${i}_${Date.now()}`,
              bayIndex: bayIdx,
              elevationY: i * drwH,
              height: drwH,
              slideType: "soft_close",
              hardwareProductId: "hw_blum_legrabox_m40",
            });
          }
          const coverShelfY = 3 * drwH + 18;
          const topShelfY = Math.min(netH - 180, Math.round(netH * 0.84));
          bay.shelves.push(
            {
              id: `${mod.id}_b${bayIdx}_sh_cov_${Date.now()}`,
              bayIndex: bayIdx,
              elevationY: coverShelfY,
              isAdjustable: false,
            },
            {
              id: `${mod.id}_b${bayIdx}_sh_top_${Date.now()}`,
              bayIndex: bayIdx,
              elevationY: topShelfY,
              isAdjustable: true,
            }
          );
          bay.hangingRails.push({
            id: `${mod.id}_b${bayIdx}_rail_main_${Date.now()}`,
            bayIndex: bayIdx,
            elevationY: Math.max(400, topShelfY - 70),
          });
        } else if (presetId === "rail_trouser") {
          const midShelfY = Math.round(netH * 0.42);
          const topShelfY = Math.min(netH - 180, Math.round(netH * 0.84));
          bay.shelves.push(
            {
              id: `${mod.id}_b${bayIdx}_sh_mid_${Date.now()}`,
              bayIndex: bayIdx,
              elevationY: midShelfY,
              isAdjustable: false,
            },
            {
              id: `${mod.id}_b${bayIdx}_sh_top_${Date.now()}`,
              bayIndex: bayIdx,
              elevationY: topShelfY,
              isAdjustable: true,
            }
          );
          bay.hangingRails.push({
            id: `${mod.id}_b${bayIdx}_rail_top_${Date.now()}`,
            bayIndex: bayIdx,
            elevationY: Math.max(400, topShelfY - 70),
          });
          bay.specialFittings.push({
            id: `fit_trouser_rack_${mod.id}_${bayIdx}_${Date.now()}`,
            bayIndex: bayIdx,
            type: "trouser_rack",
            elevationY: Math.max(120, midShelfY - 120),
            height: 90,
            width: Math.max(200, bw - 36),
            depth: Math.max(300, mod.dimensions.depth - 80),
          });
        } else if (presetId === "shoe_tower") {
          for (let i = 0; i < 3; i++) {
            bay.specialFittings.push({
              id: `fit_shoe_rack_${mod.id}_${bayIdx}_${i}_${Date.now()}`,
              bayIndex: bayIdx,
              type: "shoe_rack",
              elevationY: 120 + i * 220,
              height: 110,
              width: Math.max(200, bw - 36),
              depth: Math.max(300, mod.dimensions.depth - 80),
            });
          }
          const startShelfY = 820;
          const topCount = 3;
          const step = Math.round((netH - startShelfY) / (topCount + 1));
          for (let i = 1; i <= topCount; i++) {
            bay.shelves.push({
              id: `${mod.id}_b${bayIdx}_sh_shoe_${i}_${Date.now()}`,
              bayIndex: bayIdx,
              elevationY: Math.min(netH - 80, startShelfY + i * step),
              isAdjustable: i !== 1,
            });
          }
        } else if (presetId === "shirt_shelf") {
          // Gömlek + Raf: Üst askılık + 3 alt istif rafı
          const topShelfY = Math.min(netH - 180, Math.round(netH * 0.85));
          const midShelfY = Math.round(netH * 0.44);
          bay.shelves.push(
            {
              id: `${mod.id}_b${bayIdx}_sh_shirt_1_${Date.now()}`,
              bayIndex: bayIdx,
              elevationY: Math.round(midShelfY * 0.35),
              isAdjustable: true,
            },
            {
              id: `${mod.id}_b${bayIdx}_sh_shirt_2_${Date.now()}`,
              bayIndex: bayIdx,
              elevationY: Math.round(midShelfY * 0.68),
              isAdjustable: true,
            },
            {
              id: `${mod.id}_b${bayIdx}_sh_shirt_3_${Date.now()}`,
              bayIndex: bayIdx,
              elevationY: midShelfY,
              isAdjustable: false,
            },
            {
              id: `${mod.id}_b${bayIdx}_sh_shirt_top_${Date.now()}`,
              bayIndex: bayIdx,
              elevationY: topShelfY,
              isAdjustable: true,
            }
          );
          bay.hangingRails.push({
            id: `${mod.id}_b${bayIdx}_rail_shirt_${Date.now()}`,
            bayIndex: bayIdx,
            elevationY: Math.max(400, topShelfY - 65),
          });
        } else if (presetId === "dress_drawer") {
          // Elbise + Çekmece: Uzun elbise askılığı + 2 alt çekmece + üst raf
          const drwH = 200;
          for (let i = 0; i < 2; i++) {
            bay.drawers.push({
              id: `${mod.id}_b${bayIdx}_drw_dress_${i}_${Date.now()}`,
              bayIndex: bayIdx,
              elevationY: i * drwH,
              height: drwH,
              slideType: "soft_close",
              hardwareProductId: "hw_blum_legrabox_m40",
            });
          }
          const coverShelfY = 2 * drwH + 18;
          const topShelfY = Math.min(netH - 180, Math.round(netH * 0.85));
          bay.shelves.push(
            {
              id: `${mod.id}_b${bayIdx}_sh_dress_cov_${Date.now()}`,
              bayIndex: bayIdx,
              elevationY: coverShelfY,
              isAdjustable: false,
            },
            {
              id: `${mod.id}_b${bayIdx}_sh_dress_top_${Date.now()}`,
              bayIndex: bayIdx,
              elevationY: topShelfY,
              isAdjustable: true,
            }
          );
          bay.hangingRails.push({
            id: `${mod.id}_b${bayIdx}_rail_dress_${Date.now()}`,
            bayIndex: bayIdx,
            elevationY: Math.max(500, topShelfY - 65),
          });
        } else if (presetId === "mixed_combo") {
          // Karma Düzen: Üst raf + Askılık + Pantolonluk + Alt çekmece
          const drwH = 200;
          bay.drawers.push({
            id: `${mod.id}_b${bayIdx}_drw_mix_0_${Date.now()}`,
            bayIndex: bayIdx,
            elevationY: 0,
            height: drwH,
            slideType: "soft_close",
            hardwareProductId: "hw_blum_legrabox_m40",
          });
          const coverShelfY = drwH + 18;
          const midShelfY = Math.round(netH * 0.46);
          const topShelfY = Math.min(netH - 180, Math.round(netH * 0.85));
          bay.shelves.push(
            {
              id: `${mod.id}_b${bayIdx}_sh_mix_cov_${Date.now()}`,
              bayIndex: bayIdx,
              elevationY: coverShelfY,
              isAdjustable: false,
            },
            {
              id: `${mod.id}_b${bayIdx}_sh_mix_mid_${Date.now()}`,
              bayIndex: bayIdx,
              elevationY: midShelfY,
              isAdjustable: false,
            },
            {
              id: `${mod.id}_b${bayIdx}_sh_mix_top_${Date.now()}`,
              bayIndex: bayIdx,
              elevationY: topShelfY,
              isAdjustable: true,
            }
          );
          bay.hangingRails.push({
            id: `${mod.id}_b${bayIdx}_rail_mix_${Date.now()}`,
            bayIndex: bayIdx,
            elevationY: Math.max(450, topShelfY - 65),
          });
          bay.specialFittings.push({
            id: `fit_trouser_rack_${mod.id}_${bayIdx}_${Date.now()}`,
            bayIndex: bayIdx,
            type: "trouser_rack",
            elevationY: Math.max(coverShelfY + 110, midShelfY - 110),
            height: 90,
            width: Math.max(200, bw - 36),
            depth: Math.max(300, mod.dimensions.depth - 80),
          });
        }
        const bayHasSliding = mod.bays.some(
          (mb) =>
            mb.door?.type === "sliding" ||
            mb.door?.type === "sliding_bottom" ||
            Boolean(mb.door?.doorSystemId?.startsWith("sliding"))
        );
        if (bayHasSliding) {
          bay.drawers = (bay.drawers || []).map((dr) => ({ ...dr, isInternal: true }));
          if (mod.bays.length === 2) {
            const T_m = mod.carcass.panelThickness || 18;
            const innerSpanM = Math.max(400, mod.dimensions.width - 2 * T_m);
            const leafWM = Math.ceil((innerSpanM + 60) / 2);
            const maxClearW = Math.max(380, innerSpanM - leafWM - 6);
            const b0Pull = mod.bays[0].drawers.length > 0 || mod.bays[0].specialFittings.some((f) => !f.type.startsWith("led_"));
            const b1Pull = mod.bays[1].drawers.length > 0 || mod.bays[1].specialFittings.some((f) => !f.type.startsWith("led_"));
            if (b0Pull && !b1Pull) {
              mod.bays[0].customWidth = maxClearW;
              mod.bays[1].customWidth = undefined;
            } else if (b1Pull && !b0Pull) {
              mod.bays[0].customWidth = Math.max(420, innerSpanM - T_m - maxClearW);
              mod.bays[1].customWidth = undefined;
            }
          }
        }
        return mod;
      }, true);
    },
    [commitActiveModuleUpdate]
  );

  /**
   * Toggle visibility (isHidden) of an individual interior component in 3D while preserving its data
   */
  const toggleInteriorItemHidden = useCallback(
    (
      bayIdx: number,
      kind: "shelf" | "rail" | "drawer" | "fitting",
      itemId: string
    ) => {
      commitActiveModuleUpdate((mod) => {
        const bay = mod.bays[bayIdx];
        if (!bay) return mod;
        if (kind === "shelf") {
          bay.shelves = bay.shelves.map((s) =>
            s.id === itemId ? { ...s, isHidden: !s.isHidden } : s
          );
        } else if (kind === "rail") {
          bay.hangingRails = bay.hangingRails.map((r) =>
            r.id === itemId ? { ...r, isHidden: !r.isHidden } : r
          );
        } else if (kind === "drawer") {
          bay.drawers = bay.drawers.map((d) =>
            d.id === itemId ? { ...d, isHidden: !d.isHidden } : d
          );
        } else if (kind === "fitting") {
          bay.specialFittings = (bay.specialFittings || []).map((f) =>
            f.id === itemId ? { ...f, isHidden: !f.isHidden } : f
          );
        }
        return mod;
      }, true);
    },
    [commitActiveModuleUpdate]
  );

  /**
   * Update thickness of a specific shelf or all shelves in the selected compartment (18 / 22 / 25 / 36 mm)
   */
  const setShelfThickness = useCallback(
    (bayIdx: number, shelfId: string | "all", thicknessMm: number) => {
      const clampedT = [18, 22, 25, 36].includes(thicknessMm) ? thicknessMm : 18;
      commitActiveModuleUpdate((mod) => {
        const bay = mod.bays[bayIdx];
        if (!bay) return mod;
        bay.shelves = bay.shelves.map((s) =>
          shelfId === "all" || s.id === shelfId ? { ...s, thickness: clampedT } : s
        );
        return mod;
      }, true);
    },
    [commitActiveModuleUpdate]
  );

  /**
   * Equalize all bay widths AND distribute shelves evenly across the usable vertical span of the selected bay
   */
  const equalizeBaysAndShelves = useCallback(
    (bayIdx?: number) => {
      commitActiveModuleUpdate((mod) => {
        const netH = calculateNetInnerHeight(mod);
        const T_p = mod.carcass.panelThickness || 18;
        mod.bays = mod.bays.map((b, idx) => {
          const nextBay = { ...b, customWidth: undefined };
          if ((typeof bayIdx !== "number" || idx === bayIdx) && nextBay.shelves.length > 0) {
            const maxDrawerTop =
              nextBay.drawers.length > 0
                ? Math.max(...nextBay.drawers.map((d) => d.elevationY + d.height)) + T_p
                : 0;
            const usableH = Math.max(160, netH - maxDrawerTop);
            const cnt = nextBay.shelves.length;
            const stepY = usableH / (cnt + 1);
            const sorted = [...nextBay.shelves].sort((a, z) => a.elevationY - z.elevationY);
            sorted.forEach((s, sIdx) => {
              s.elevationY = Math.max(
                60,
                Math.min(netH - 60, Math.round((maxDrawerTop + stepY * (sIdx + 1)) / 10) * 10)
              );
            });
            nextBay.shelves = sorted;
          }
          return nextBay;
        });
        alignModuleShelvesToSystem32(mod);
        return mod;
      }, true);
    },
    [commitActiveModuleUpdate]
  );

  /**
   * Add an internal pull-out drawer (İç Çekmece — behind hinged/sliding doors) in the selected bay
   */
  const addInternalDrawer = useCallback(
    (bayIdx: number, heightMm = 140) => {
      commitActiveModuleUpdate((mod) => {
        const bay = mod.bays[bayIdx];
        if (!bay) return mod;
        const netH = calculateNetInnerHeight(mod);
        const T_p = mod.carcass.panelThickness || 18;
        const clampedH = Math.max(80, Math.min(240, Math.round(heightMm)));
        const maxTop =
          bay.drawers.length > 0
            ? Math.max(...bay.drawers.map((d) => d.elevationY + d.height))
            : 0;
        if (maxTop + clampedH > netH - 120) return mod;
        bay.drawers.push({
          id: `${mod.id}_b${bayIdx}_intdrw_${bay.drawers.length}_${Date.now()}`,
          bayIndex: bayIdx,
          elevationY: maxTop,
          height: clampedH,
          slideType: "soft_close",
          isInternal: true,
          hardwareProductId: "hw_blum_legrabox_m40",
        });
        const newCoverY = maxTop + clampedH + 4;
        const hasCoverShelf = bay.shelves.some(
          (s) => Math.abs(s.elevationY - newCoverY) <= 35
        );
        if (!hasCoverShelf && newCoverY < netH - 120) {
          bay.shelves.push({
            id: `${mod.id}_b${bayIdx}_intcov_${Date.now()}`,
            bayIndex: bayIdx,
            elevationY: newCoverY,
            thickness: T_p,
            isAdjustable: false,
          });
        }
        return mod;
      }, true);
    },
    [commitActiveModuleUpdate]
  );

  const hwLedMatAndDeleteActions = useAdapterHardwareLedMaterialAndDeleteActions({ commitActiveModuleUpdate, setSelectedComponentId, setActiveBayIndex, safeBayIndex, setDoorOpenAngleDeg, removeShelf, removeDrawer, removeHangingRail, removeSpecialFitting, removeSubDivider, removeActiveModule });
  return {
    splitBayIntoTwo,
    addInteriorItemAtElevation,
    setShelfElevation,
    setDrawerPlacement,
    addSpecialFitting,
    setSpecialFittingPlacement,
    setHangingRailElevation,
    setHangingRailProfile,
    setBayCustomWidth,
    moveInteriorItemToBay,
    addSubDivider,
    setSubDividerPlacement,
    removeSubDivider,
    applyBayInteriorPreset,
    toggleInteriorItemHidden,
    setShelfThickness,
    equalizeBaysAndShelves,
    addInternalDrawer,
    ...hwLedMatAndDeleteActions,
  };
}
