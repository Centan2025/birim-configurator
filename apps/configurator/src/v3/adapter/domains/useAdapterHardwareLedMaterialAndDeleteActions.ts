"use client";
import { useCallback } from "react";
import { useConfiguratorStore } from "../../../store/useConfiguratorStore";
import { DEFAULT_MATERIALS, calculateBayWidths, calculateNetInnerHeight, calculateFourSpaceDimensions, type BayConfig, type ModuleInstance } from "@birim/core";
import { getHardwareProductById, getDrillingTemplateForHardware, selectOptimalRunnerLengthMm } from "@birim/catalog";
import { generateModuleGeometry } from "@birim/geometry";
import { commitAdapterState } from "../adapterMathAndCache";
import type { useAdapterStoreAndCoreBindings } from "./useAdapterStoreAndCoreBindings";

export type AdapterHardwareLedMaterialDeleteDeps = Pick<
  ReturnType<typeof useAdapterStoreAndCoreBindings>,
  | "setSelectedComponentId"
  | "setActiveBayIndex"
  | "setDoorOpenAngleDeg"
  | "removeShelf"
  | "removeDrawer"
  | "removeHangingRail"
  | "removeSpecialFitting"
  | "removeActiveModule"
> & {
  commitActiveModuleUpdate: (
    updater: (mod: ModuleInstance) => ModuleInstance,
    pushHistory?: boolean
  ) => void;
  safeBayIndex: number;
  removeSubDivider: (bayIdx: number, subDividerId: string) => void;
};

export function useAdapterHardwareLedMaterialAndDeleteActions(
  deps: AdapterHardwareLedMaterialDeleteDeps
) {
  const {
    commitActiveModuleUpdate,
    setSelectedComponentId,
    setActiveBayIndex,
    safeBayIndex,
    setDoorOpenAngleDeg,
    removeShelf,
    removeDrawer,
    removeHangingRail,
    removeSpecialFitting,
    removeSubDivider,
    removeActiveModule,
  } = deps;
  /**
   * Merge a bay into its neighbor by removing the vertical divider while KEEPING outer cabinet width constant.
   * Automatically upgrades single hinged doors to double doors if the merged span exceeds 650 mm.
   */
  const removeBayAt = useCallback(
    (bayIdx: number) => {
      commitActiveModuleUpdate((mod) => {
        if (mod.bays.length <= 1) return mod;
        const targetIdx = Math.max(0, Math.min(mod.bays.length - 1, bayIdx));
        mod.bays.splice(targetIdx, 1);
        mod.bays = mod.bays.map((b, idx) => ({
          ...b,
          index: idx,
          customWidth: undefined,
          door: { ...b.door, bayIndex: idx, id: `${mod.id}_door_${idx}` },
          shelves: (b.shelves || []).map((s) => ({ ...s, bayIndex: idx })),
          hangingRails: (b.hangingRails || []).map((r) => ({ ...r, bayIndex: idx })),
          drawers: (b.drawers || []).map((d) => ({ ...d, bayIndex: idx })),
          specialFittings: (b.specialFittings || []).map((f) => ({ ...f, bayIndex: idx })),
          subDividers: (b.subDividers || []).map((sd) => ({ ...sd, bayIndex: idx })),
        }));
        const postFourSpace = calculateFourSpaceDimensions(mod);
        mod.bays = mod.bays.map((b, idx) => {
          const newClearW = postFourSpace.usableInternal.bayClearWidthsMm[idx] || 600;
          const dType = b.door?.type;
          if (newClearW > 650 && (dType === "single_left" || dType === "single_right")) {
            return {
              ...b,
              door: {
                ...b.door,
                type: "double",
                doorSystemId: "hinged_double",
              },
            };
          }
          return b;
        });
        return mod;
      }, true);
      setSelectedComponentId(null);
      const st = useConfiguratorStore.getState();
      const mod = st.project.modules[st.activeModuleIndex];
      if (mod) {
        setActiveBayIndex(Math.max(0, Math.min(bayIdx, mod.bays.length - 1)));
      }
    },
    [commitActiveModuleUpdate, setActiveBayIndex, setSelectedComponentId]
  );

  /**
   * Remove a specific bay/compartment AND shrink the cabinet's outer width by that bay's clear width + 1 divider thickness.
   * Preserves the widths and door configurations of all remaining compartments.
   */
  const removeBayAndShrinkModule = useCallback(
    (bayIdx: number) => {
      commitActiveModuleUpdate((mod) => {
        if (mod.bays.length <= 1) return mod;
        const targetIdx = Math.max(0, Math.min(mod.bays.length - 1, bayIdx));
        const preFourSpace = calculateFourSpaceDimensions(mod);
        const clearWidths = preFourSpace.usableInternal.bayClearWidthsMm;
        const panelT = mod.carcass.panelThickness || 18;
        const removedClearW =
          clearWidths[targetIdx] ||
          Math.max(300, Math.round((mod.dimensions.width - (mod.bays.length + 1) * panelT) / mod.bays.length));
        const remainingClearWidths = clearWidths.filter((_, i) => i !== targetIdx);

        mod.bays.splice(targetIdx, 1);
        const nextOuterWidth = Math.max(
          350,
          Math.round(mod.dimensions.width - (removedClearW + panelT))
        );
        mod.dimensions.width = nextOuterWidth;

        const singleRemaining = mod.bays.length === 1;
        mod.bays = mod.bays.map((b, idx) => ({
          ...b,
          index: idx,
          customWidth: singleRemaining ? undefined : remainingClearWidths[idx],
          door: { ...b.door, bayIndex: idx, id: `${mod.id}_door_${idx}` },
          shelves: (b.shelves || []).map((s) => ({ ...s, bayIndex: idx })),
          hangingRails: (b.hangingRails || []).map((r) => ({ ...r, bayIndex: idx })),
          drawers: (b.drawers || []).map((d) => ({ ...d, bayIndex: idx })),
          specialFittings: (b.specialFittings || []).map((f) => ({ ...f, bayIndex: idx })),
          subDividers: (b.subDividers || []).map((sd) => ({ ...sd, bayIndex: idx })),
        }));
        return mod;
      }, true);
      setSelectedComponentId(null);
      const st = useConfiguratorStore.getState();
      const mod = st.project.modules[st.activeModuleIndex];
      if (mod) {
        setActiveBayIndex(Math.max(0, Math.min(bayIdx, mod.bays.length - 1)));
      }
    },
    [commitActiveModuleUpdate, setActiveBayIndex, setSelectedComponentId]
  );

  /**
   * Convert a wide double-door compartment (e.g. 1171 mm in a 3-door 180 cm wardrobe) into a single-door compartment
   * and narrow the cabinet's outer width by half of that compartment's clear width (e.g. 180 cm -> 121 cm, 3 doors -> 2 doors).
   */
  const shrinkDoubleBayToSingle = useCallback(
    (bayIdx: number) => {
      commitActiveModuleUpdate((mod) => {
        const targetIdx = Math.max(0, Math.min(mod.bays.length - 1, bayIdx));
        const targetBay = mod.bays[targetIdx];
        if (!targetBay) return mod;
        const preFourSpace = calculateFourSpaceDimensions(mod);
        const clearWidths = preFourSpace.usableInternal.bayClearWidthsMm;
        const curClearW = clearWidths[targetIdx] || 900;
        if (curClearW < 760) return mod;

        const nextBayClearW = Math.max(400, Math.round(curClearW * 0.5));
        const deltaW = curClearW - nextBayClearW;
        mod.dimensions.width = Math.max(400, Math.round(mod.dimensions.width - deltaW));

        const singleRemaining = mod.bays.length === 1;
        const preferredLeaf: "single_left" | "single_right" =
          targetIdx === 0 && mod.bays.length > 1 ? "single_left" : "single_right";

        mod.bays = mod.bays.map((b, idx) => {
          if (idx !== targetIdx) {
            return {
              ...b,
              customWidth: singleRemaining ? undefined : clearWidths[idx],
            };
          }
          return {
            ...b,
            customWidth: singleRemaining ? undefined : nextBayClearW,
            door: {
              ...b.door,
              type: b.door.type === "open" ? "open" : preferredLeaf,
              doorSystemId: b.door.type === "open" ? "open" : "hinged_single",
            },
          };
        });
        return mod;
      }, true);
      setSelectedComponentId(null);
    },
    [commitActiveModuleUpdate, setSelectedComponentId]
  );

  /**
   * Screen 5 (Donanım ve Mekanizmalar): Update Hinge Hardware SKU across active bay or all hinged bays,
   * automatically syncing drilling template and door thickness compatibility.
   */
  const setModuleHingeHardware = useCallback(
    (
      hardwareProductId: string,
      applyAllBays = true,
      softCloseOverride?: boolean
    ): { ok: boolean; error?: string } => {
      const st = useConfiguratorStore.getState();
      const mod = st.project.modules[st.activeModuleIndex] || st.project.modules[0];
      if (!mod) return { ok: false, error: "Aktif modül bulunamadı." };

      const hw = getHardwareProductById(hardwareProductId);
      const T_door =
        mod.bays[safeBayIndex]?.door.doorThicknessMm || mod.carcass.doorThickness || 18;
      if (hw?.doorThicknessLimitsMm) {
        const [minT, maxT] = hw.doorThicknessLimitsMm;
        if (T_door < minT || T_door > maxT) {
          return {
            ok: false,
            error: `"${hw.name}" menteşesi ${minT}–${maxT} mm kapak kalınlığını destekler (Mevcut kapak kalınlığı: ${T_door} mm). Lütfen kalın kapak menteşesi (95° / 165°) seçin veya kapak kalınlığını güncelleyin.`,
          };
        }
      }

      const drillTpl = getDrillingTemplateForHardware(hardwareProductId);
      commitActiveModuleUpdate((nextMod) => {
        nextMod.carcass.hingeDrillingTemplateId = drillTpl.id;
        nextMod.bays = nextMod.bays.map((b, bIdx) => {
          if (!applyAllBays && bIdx !== safeBayIndex) return b;
          const dSys = b.door.doorSystemId || "hinged_single";
          if (!dSys.startsWith("hinged")) return b;
          const nextSoftClose =
            typeof softCloseOverride === "boolean" ? softCloseOverride : b.door.softClose;
          return {
            ...b,
            door: {
              ...b.door,
              hardwareProductId,
              softClose: nextSoftClose,
              openingTechnology: nextSoftClose ? "soft_close" : "manual_standard",
            },
          };
        });
        return nextMod;
      }, true);
      return { ok: true };
    },
    [commitActiveModuleUpdate, safeBayIndex]
  );

  /**
   * Screen 5 (Donanım ve Mekanizmalar): Update Drawer Runner Hardware SKU and Nominal Length (NL)
   * with strict inner depth clearance validation (NL <= usableInnerDepthMm - 10).
   */
  const setModuleDrawerRunnerHardware = useCallback(
    (
      hardwareProductId: string,
      nominalLengthMm?: number,
      applyAllBays = true,
      slideTypeOverride?: import("@birim/core").DrawerConfig["slideType"]
    ): { ok: boolean; error?: string; appliedNlMm?: number } => {
      const st = useConfiguratorStore.getState();
      const mod = st.project.modules[st.activeModuleIndex] || st.project.modules[0];
      if (!mod) return { ok: false, error: "Aktif modül bulunamadı." };

      const fourSpace = calculateFourSpaceDimensions(mod);
      const netInnerDepth = fourSpace.usableInternal.netInnerDepthMm;
      const maxAllowedNl = netInnerDepth - 10;
      const targetNl =
        typeof nominalLengthMm === "number"
          ? nominalLengthMm
          : selectOptimalRunnerLengthMm(netInnerDepth);

      if (targetNl > maxAllowedNl) {
        return {
          ok: false,
          error: `Seçilen ray uzunluğu (NL ${targetNl} mm), modül net iç derinliğine (${netInnerDepth} mm, maks. izin verilen NL ${maxAllowedNl} mm) sığmıyor! Lütfen ≤ ${selectOptimalRunnerLengthMm(netInnerDepth)} mm ray seçin veya dolap derinliğini artırın.`,
        };
      }

      const drillingSetId = hardwareProductId.includes("hettich")
        ? "hettich_avantech"
        : hardwareProductId.includes("tandembox")
        ? "blum_tandembox"
        : hardwareProductId.includes("movento")
        ? "blum_movento"
        : "blum_legrabox";

      commitActiveModuleUpdate((nextMod) => {
        nextMod.carcass.drawerDrillingSetId = drillingSetId;
        nextMod.bays = nextMod.bays.map((b, bIdx) => {
          if (!applyAllBays && bIdx !== safeBayIndex) return b;
          return {
            ...b,
            drawers: b.drawers.map((d) => ({
              ...d,
              hardwareProductId,
              nominalLengthMm: targetNl,
              slideType: slideTypeOverride || d.slideType || "soft_close",
            })),
          };
        });
        return nextMod;
      }, true);
      return { ok: true, appliedNlMm: targetNl };
    },
    [commitActiveModuleUpdate, safeBayIndex]
  );

  /**
   * Screen 5 (Donanım ve Mekanizmalar): Toggle Cabinet LED Lighting on/off across the module
   * and update LED profile type, color temperature (3000K / 4000K), or sensor type.
   */
  const toggleModuleLedLighting = useCallback(
    (
      enabled: boolean,
      options?: {
        ledType?: "led_profile" | "led_vertical_strip" | "led_rod_strip" | "full_showcase";
        colorTempK?: 2700 | 3000 | 4000;
        sensorType?: "ir_door" | "pir_motion" | "manual_switch";
        dimmerPct?: number;
        frontSetbackMm?: number;
        shelfSetbackMm?: number;
        alignShelfAndSide?: boolean;
        channelWidthMm?: number;
        channelDepthMm?: number;
      }
    ) => {
      commitActiveModuleUpdate((mod) => {
        mod.carcass.ledLightingEnabled = enabled;
        if (options?.colorTempK) {
          mod.carcass.ledColorTempK = options.colorTempK;
        } else if (!mod.carcass.ledColorTempK) {
          mod.carcass.ledColorTempK = 3000;
        }
        if (options?.sensorType) {
          mod.carcass.ledSensorType = options.sensorType;
        } else if (!mod.carcass.ledSensorType) {
          mod.carcass.ledSensorType = "ir_door";
        }
        if (typeof options?.dimmerPct === "number") {
          mod.carcass.ledDimmerPct = options.dimmerPct;
        } else if (typeof mod.carcass.ledDimmerPct !== "number") {
          mod.carcass.ledDimmerPct = 100;
        }

        const pThick = mod.carcass.panelThickness || 18;
        const maxSafeSetback = Math.max(60, mod.dimensions.depth - 45);
        if (typeof options?.alignShelfAndSide === "boolean") {
          mod.carcass.ledAlignShelfAndSide = options.alignShelfAndSide;
        } else if (typeof mod.carcass.ledAlignShelfAndSide !== "boolean") {
          mod.carcass.ledAlignShelfAndSide = true;
        }
        if (typeof options?.frontSetbackMm === "number") {
          mod.carcass.ledFrontSetbackMm = Math.max(35, Math.min(maxSafeSetback, Math.round(options.frontSetbackMm)));
        } else if (typeof mod.carcass.ledFrontSetbackMm !== "number") {
          mod.carcass.ledFrontSetbackMm = 75;
        }
        if (typeof options?.shelfSetbackMm === "number") {
          mod.carcass.ledShelfSetbackMm = Math.max(35, Math.min(maxSafeSetback, Math.round(options.shelfSetbackMm)));
        } else if (typeof mod.carcass.ledShelfSetbackMm !== "number") {
          mod.carcass.ledShelfSetbackMm = mod.carcass.ledFrontSetbackMm;
        }
        if (mod.carcass.ledAlignShelfAndSide) {
          mod.carcass.ledShelfSetbackMm = mod.carcass.ledFrontSetbackMm;
        }
        if (typeof options?.channelWidthMm === "number") {
          mod.carcass.ledChannelWidthMm = Math.max(6, Math.min(32, Math.round(options.channelWidthMm)));
        } else if (typeof mod.carcass.ledChannelWidthMm !== "number") {
          mod.carcass.ledChannelWidthMm = 12;
        }
        if (typeof options?.channelDepthMm === "number") {
          mod.carcass.ledChannelDepthMm = Math.max(4, Math.min(Math.max(5, pThick - 4), Math.round(options.channelDepthMm)));
        } else if (typeof mod.carcass.ledChannelDepthMm !== "number") {
          mod.carcass.ledChannelDepthMm = 8;
        }

        const existingMode = mod.carcass.ledPlacementMode;
        const fallbackType =
          existingMode === "full_showcase"
            ? "full_showcase"
            : existingMode === "vertical_sides"
            ? "led_vertical_strip"
            : existingMode === "hanging_rod"
            ? "led_rod_strip"
            : "led_profile";
        const targetType = options?.ledType || fallbackType;
        mod.carcass.ledPlacementMode =
          targetType === "full_showcase"
            ? "full_showcase"
            : targetType === "led_vertical_strip"
            ? "vertical_sides"
            : targetType === "led_rod_strip"
            ? "hanging_rod"
            : "shelf_underside";

        const netH = calculateNetInnerHeight(mod);
        const bayWidths = calculateBayWidths(mod);
        const nowStamp = Date.now();
        const chanW = mod.carcass.ledChannelWidthMm;
        const sideSetback = mod.carcass.ledFrontSetbackMm;
        const shelfSetback = mod.carcass.ledAlignShelfAndSide
          ? sideSetback
          : mod.carcass.ledShelfSetbackMm;

        mod.bays.forEach((b, bIdx) => {
          b.specialFittings = (b.specialFittings || []).filter(
            (f) => !f.type.startsWith("led_")
          );
          if (enabled) {
            const bw = bayWidths[bIdx] || 550;
            if (targetType === "led_profile" || targetType === "full_showcase") {
              b.specialFittings.push({
                id: `fit_led_profile_${mod.id}_${bIdx}_${nowStamp}`,
                bayIndex: bIdx,
                type: "led_profile",
                elevationY: Math.max(200, netH - 20),
                height: mod.carcass.ledChannelDepthMm ?? 12,
                width: Math.max(60, bw - 12),
                depth: shelfSetback,
              });
            }
            if (targetType === "led_vertical_strip" || targetType === "full_showcase") {
              b.specialFittings.push({
                id: `fit_led_vert_${mod.id}_${bIdx}_${nowStamp}`,
                bayIndex: bIdx,
                type: "led_vertical_strip",
                elevationY: 20,
                height: Math.max(160, netH - 24),
                width: chanW,
                depth: sideSetback,
              });
            }
            if (targetType === "led_rod_strip") {
              const topRailY =
                b.hangingRails && b.hangingRails.length > 0
                  ? Math.max(...b.hangingRails.map((r) => r.elevationY))
                  : Math.max(300, netH - 120);
              b.specialFittings.push({
                id: `fit_led_rod_${mod.id}_${bIdx}_${nowStamp}`,
                bayIndex: bIdx,
                type: "led_rod_strip",
                elevationY: topRailY - 8,
                height: 16,
                width: Math.max(60, bw - 12),
                depth: 18,
              });
            }
          }
        });
        return mod;
      }, true);

      // If turning interior LED ON while solid doors are completely closed, gently open doors to 75°
      // so the user immediately sees the warm interior LED illumination in 3D!
      if (enabled) {
        const curState = useConfiguratorStore.getState();
        const curMod = curState.project.modules[curState.activeModuleIndex];
        const allClosedOpaque =
          curMod &&
          !curMod.isOpenFront &&
          curState.doorOpenAngleDeg < 5 &&
          curMod.bays.every(
            (b) =>
              b.door.type !== "open" &&
              !b.door.isGlassFramed &&
              b.door.crossSectionProfile !== "glass_frame"
          );
        if (allClosedOpaque) {
          setDoorOpenAngleDeg(75);
        }
      }
    },
    [commitActiveModuleUpdate, setDoorOpenAngleDeg]
  );

  /**
   * Restore a saved bays snapshot if the user cancels a live interior template preview
   */
  const restoreModuleBaysSnapshot = useCallback(
    (baysSnapshot: import("@birim/core").BayConfig[]) => {
      commitActiveModuleUpdate((mod) => {
        mod.bays = JSON.parse(JSON.stringify(baysSnapshot));
        return mod;
      }, false);
    },
    [commitActiveModuleUpdate]
  );

  /**
   * Screen 6 (Malzeme ve Yüzeyler): Assign a catalog material to a specific scope
   * (all_module, carcass, doors, drawers, plinth, back, selected_part, or same_material_parts)
   * with technical compatibility validation and affected part count calculation.
   */
  const applyMaterialByTargetScope = useCallback(
    (
      scope:
        | "all_module"
        | "carcass"
        | "doors"
        | "drawers"
        | "plinth"
        | "back"
        | "countertop"
        | "selected_part"
        | "same_material_parts",
      materialId: string,
      targetCompId?: string,
      pushHistory = true
    ): { ok: boolean; affectedCount: number; error?: string } => {
      const matDef = DEFAULT_MATERIALS.find((m) => m.id === materialId);
      if (!matDef) {
        return { ok: false, affectedCount: 0, error: "Geçersiz katalog malzemesi." };
      }

      const st = useConfiguratorStore.getState();
      const mod = st.project.modules[st.activeModuleIndex] || st.project.modules[0];
      if (!mod) return { ok: false, affectedCount: 0, error: "Aktif modül bulunamadı." };

      const resolvedTargetId = targetCompId || st.selectedComponentId || undefined;
      const geo = generateModuleGeometry(mod);
      const targetComp = resolvedTargetId
        ? geo.components.find((c) => c.id === resolvedTargetId)
        : undefined;

      // Technical Surface Compatibility Guard (FAZ 3):
      // Heavy stone/marble slabs (2400 kg/m³) cannot be applied to hinged/sliding doors, drawers, or 8mm back panels!
      const isDoorOrDrawerScope =
        scope === "doors" ||
        scope === "drawers" ||
        scope === "back" ||
        (scope === "selected_part" &&
          targetComp &&
          (targetComp.role.includes("door") ||
            targetComp.role === "drawer_front" ||
            targetComp.role === "carcass_back"));
      if (matDef.category === "stone" && isDoorOrDrawerScope) {
        return {
          ok: false,
          affectedCount: 0,
          error: `"${matDef.name}" (${matDef.densityKgPerM3 || 2400} kg/m³ taş/kuvars levha) ağırlık ve menteşe sınırları nedeniyle kapak, çekmece veya arkalık panellerine atanamaz. Yalnızca tezgâh veya üst tabla yüzeylerinde kullanılabilir.`,
        };
      }
      if (
        (matDef.category === "glass" || matDef.category === "mirror") &&
        (scope === "carcass" || scope === "plinth" || scope === "back")
      ) {
        return {
          ok: false,
          affectedCount: 0,
          error: `"${matDef.name}" taşıyıcı gövde dikmesi, kaide veya arkalık olarak kullanılamaz; yalnızca kapak yüzeylerine atanabilir.`,
        };
      }

      let affectedCount = 0;

      commitActiveModuleUpdate((nextMod) => {
        if (!nextMod.componentMaterialOverrides) {
          nextMod.componentMaterialOverrides = {};
        }
        const overrides = { ...nextMod.componentMaterialOverrides };

        if (scope === "all_module") {
          const panelMatId =
            matDef.category === "glass" || matDef.category === "mirror" || matDef.category === "stone"
              ? nextMod.carcass.bodyMaterialId
              : materialId;
          nextMod.carcass.bodyMaterialId = panelMatId;
          nextMod.carcass.doorMaterialId = materialId;
          nextMod.carcass.plinthMaterialId = panelMatId;
          nextMod.edgeBandMaterialId = panelMatId;
          nextMod.bays = nextMod.bays.map((b) => ({
            ...b,
            door: { ...b.door, doorMaterialId: materialId },
            drawers: b.drawers.map((d) => ({ ...d, frontMaterialId: materialId })),
          }));
          nextMod.componentMaterialOverrides = {};
          affectedCount = geo.components.filter((c) => c.isManufacturablePanel !== false).length;
        } else if (scope === "carcass") {
          nextMod.carcass.bodyMaterialId = materialId;
          geo.components.forEach((c) => {
            if (
              c.role === "carcass_side_left" ||
              c.role === "carcass_side_right" ||
              c.role === "carcass_top" ||
              c.role === "carcass_bottom" ||
              c.role === "carcass_divider" ||
              c.role === "carcass_sub_divider" ||
              c.role === "shelf"
            ) {
              delete overrides[c.id];
              affectedCount++;
            }
          });
          nextMod.componentMaterialOverrides = overrides;
        } else if (scope === "doors") {
          nextMod.carcass.doorMaterialId = materialId;
          nextMod.bays = nextMod.bays.map((b) => ({
            ...b,
            door: { ...b.door, doorMaterialId: materialId },
          }));
          geo.components.forEach((c) => {
            if (c.role === "door_left" || c.role === "door_right") {
              delete overrides[c.id];
              affectedCount++;
            }
          });
          nextMod.componentMaterialOverrides = overrides;
        } else if (scope === "drawers") {
          nextMod.bays = nextMod.bays.map((b) => ({
            ...b,
            drawers: b.drawers.map((d) => {
              overrides[`${d.id}_front`] = materialId;
              affectedCount++;
              return { ...d, frontMaterialId: materialId };
            }),
          }));
          nextMod.componentMaterialOverrides = overrides;
        } else if (scope === "plinth") {
          nextMod.carcass.plinthMaterialId = materialId;
          overrides.__plinth__ = materialId;
          geo.components.forEach((c) => {
            if (c.role === "plinth") {
              overrides[c.id] = materialId;
              affectedCount++;
            }
          });
          if (affectedCount === 0) affectedCount = 1;
          nextMod.componentMaterialOverrides = overrides;
        } else if (scope === "back") {
          geo.components.forEach((c) => {
            if (c.role === "carcass_back") {
              overrides[c.id] = materialId;
              affectedCount++;
            }
          });
          if (affectedCount === 0) {
            overrides[`${nextMod.id}_back`] = materialId;
            affectedCount = 1;
          }
          nextMod.componentMaterialOverrides = overrides;
        } else if (scope === "countertop") {
          nextMod.carcass.countertopMaterialId = materialId;
          geo.components.forEach((c) => {
            if (c.role === "countertop") {
              overrides[c.id] = materialId;
              affectedCount++;
            }
          });
          if (affectedCount === 0) affectedCount = 1;
          nextMod.componentMaterialOverrides = overrides;
        } else if (scope === "selected_part" && resolvedTargetId) {
          overrides[resolvedTargetId] = materialId;
          if (resolvedTargetId.endsWith("_plinth")) {
            nextMod.carcass.plinthMaterialId = materialId;
            overrides.__plinth__ = materialId;
          }
          affectedCount = 1;
          nextMod.componentMaterialOverrides = overrides;
        } else if (scope === "same_material_parts") {
          const refMatId =
            (targetComp &&
              (overrides[targetComp.id] || targetComp.materialId)) ||
            nextMod.carcass.doorMaterialId;
          geo.components.forEach((c) => {
            if (c.isManufacturablePanel === false) return;
            const curCompMat = overrides[c.id] || c.materialId;
            if (curCompMat === refMatId) {
              overrides[c.id] = materialId;
              affectedCount++;
            }
          });
          if (nextMod.carcass.bodyMaterialId === refMatId) {
            nextMod.carcass.bodyMaterialId = materialId;
          }
          if (nextMod.carcass.doorMaterialId === refMatId) {
            nextMod.carcass.doorMaterialId = materialId;
          }
          nextMod.componentMaterialOverrides = overrides;
        }

        return nextMod;
      }, pushHistory);

      return { ok: true, affectedCount };
    },
    [commitActiveModuleUpdate]
  );

  /**
   * Screen 6 (FAZ 4): Update grain direction (Dikey / Yatay / Özel), surface finish (Mat / Yarı Mat / Parlak),
   * edgeband material/thickness, and panel/door thickness on the active module.
   */
  const setModuleMaterialDetails = useCallback(
    (updates: {
      grainDirection?: "lengthwise" | "crosswise" | "custom";
      grainTargetKey?: string;
      surfaceFinishOverride?: "matte" | "satin" | "gloss";
      edgeBandMaterialId?: string;
      edgeBandThickness?: number;
      doorThickness?: number;
      panelThickness?: number;
    }) => {
      commitActiveModuleUpdate((mod) => {
        if (updates.grainDirection) {
          if (!mod.componentGrainOverrides) mod.componentGrainOverrides = {};
          const key = updates.grainTargetKey || "__all__";
          mod.componentGrainOverrides = {
            ...mod.componentGrainOverrides,
            [key]: updates.grainDirection,
          };
        }
        if (updates.surfaceFinishOverride) {
          mod.surfaceFinishOverride = updates.surfaceFinishOverride;
        }
        if (updates.edgeBandMaterialId) {
          mod.edgeBandMaterialId = updates.edgeBandMaterialId;
        }
        if (typeof updates.edgeBandThickness === "number") {
          mod.carcass.edgeBandThickness = updates.edgeBandThickness;
        }
        if (typeof updates.doorThickness === "number") {
          mod.carcass.doorThickness = updates.doorThickness;
          mod.bays = mod.bays.map((b) => ({
            ...b,
            door: { ...b.door, doorThicknessMm: updates.doorThickness },
          }));
        }
        if (typeof updates.panelThickness === "number") {
          mod.carcass.panelThickness = updates.panelThickness;
        }
        return mod;
      }, true);
    },
    [commitActiveModuleUpdate]
  );

  /**
   * Screen 6: Clear all individual component material & grain overrides on the active module
   */
  const resetModuleMaterialOverrides = useCallback(() => {
    commitActiveModuleUpdate((mod) => {
      mod.componentMaterialOverrides = {};
      mod.componentGrainOverrides = {};
      mod.surfaceFinishOverride = undefined;
      return mod;
    }, true);
  }, [commitActiveModuleUpdate]);

  /**
   * Screen 6 (FAZ 5 & FAZ 6): Restore a saved material state snapshot when canceling a live material variation preview
   * in either Studio or Showroom mode so unconfirmed previews never mutate the saved project/BOM!
   */
  const restoreModuleMaterialSnapshot = useCallback(
    (snapshot: {
      carcass: import("@birim/core").CarcassConfig;
      bays: import("@birim/core").BayConfig[];
      componentMaterialOverrides?: Record<string, string>;
      componentGrainOverrides?: Record<string, "lengthwise" | "crosswise" | "custom">;
      surfaceFinishOverride?: "matte" | "satin" | "gloss";
      edgeBandMaterialId?: string;
    }) => {
      commitActiveModuleUpdate((mod) => {
        mod.carcass = JSON.parse(JSON.stringify(snapshot.carcass));
        mod.bays = JSON.parse(JSON.stringify(snapshot.bays));
        mod.componentMaterialOverrides = snapshot.componentMaterialOverrides
          ? { ...snapshot.componentMaterialOverrides }
          : {};
        mod.componentGrainOverrides = snapshot.componentGrainOverrides
          ? { ...snapshot.componentGrainOverrides }
          : {};
        mod.surfaceFinishOverride = snapshot.surfaceFinishOverride;
        mod.edgeBandMaterialId = snapshot.edgeBandMaterialId;
        return mod;
      }, false);
    },
    [commitActiveModuleUpdate]
  );

  const removeModuleAt = useCallback((modIdx: number) => {
    const state = useConfiguratorStore.getState();
    if (state.project.modules.length === 0) return;
    if (modIdx < 0 || modIdx >= state.project.modules.length) return;
    const updated = JSON.parse(JSON.stringify(state.project));
    updated.modules.splice(modIdx, 1);
    const nextIdx =
      state.activeModuleIndex === modIdx
        ? Math.min(modIdx, Math.max(0, updated.modules.length - 1))
        : state.activeModuleIndex > modIdx
        ? state.activeModuleIndex - 1
        : state.activeModuleIndex;
    commitAdapterState({
      project: updated,
      activeModuleIndex: nextIdx,
      selectedComponentId: null,
    });
  }, []);

  /**
   * Remove currently selected interior item (shelf, drawer, hanging rail, fitting, or sub-divider)
   */
  const removeSelectedInteriorComponent = useCallback((): boolean => {
    const state = useConfiguratorStore.getState();
    const selId = state.selectedComponentId;
    if (!selId) return false;
    const mod = state.project.modules[state.activeModuleIndex] || state.project.modules[0];
    if (!mod) return false;

    for (let bIdx = 0; bIdx < mod.bays.length; bIdx++) {
      const bay = mod.bays[bIdx];
      const shelfMatch = bay.shelves.find(
        (s, sIdx) =>
          s.id === selId ||
          selId.startsWith(`${s.id}_`) ||
          `${mod.id}_bay_${bIdx}_shelf_${sIdx}` === selId
      );
      if (shelfMatch) {
        removeShelf(bIdx, shelfMatch.id);
        setSelectedComponentId(null);
        return true;
      }

      const drawerMatch = bay.drawers.find(
        (d, dIdx) =>
          selId === d.id ||
          selId.startsWith(`${d.id}_`) ||
          `${mod.id}_bay_${bIdx}_drawer_${dIdx}` === selId
      );
      if (drawerMatch) {
        removeDrawer(bIdx, drawerMatch.id);
        setSelectedComponentId(null);
        return true;
      }

      const railMatch = bay.hangingRails.find(
        (r, rIdx) =>
          r.id === selId ||
          selId.startsWith(`${r.id}_`) ||
          `${mod.id}_bay_${bIdx}_rail_${rIdx}` === selId
      );
      if (railMatch) {
        removeHangingRail(bIdx, railMatch.id);
        setSelectedComponentId(null);
        return true;
      }

      const fitMatch = (bay.specialFittings || []).find(
        (f, fIdx) =>
          f.id === selId ||
          selId.startsWith(`${f.id}_`) ||
          selId.includes(f.id) ||
          `${mod.id}_bay_${bIdx}_fit_${fIdx}` === selId ||
          `${mod.id}_bay_${bIdx}_fitting_${fIdx}` === selId
      );
      if (fitMatch) {
        removeSpecialFitting(bIdx, fitMatch.id);
        setSelectedComponentId(null);
        return true;
      }

      const subDivMatch = (bay.subDividers || []).find(
        (sd, sdIdx) =>
          sd.id === selId ||
          selId.startsWith(`${sd.id}_`) ||
          `${mod.id}_bay_${bIdx}_subdiv_${sdIdx}` === selId
      );
      if (subDivMatch) {
        removeSubDivider(bIdx, subDivMatch.id);
        setSelectedComponentId(null);
        return true;
      }
    }
    return false;
  }, [
    removeShelf,
    removeDrawer,
    removeHangingRail,
    removeSpecialFitting,
    removeSubDivider,
    setSelectedComponentId,
  ]);

  /**
   * Smart CAD Delete Hierarchy for Delete / Backspace key & HUD Delete button:
   * - Instant 0-click deletion for interior parts (shelf, drawer, rail, fitting, sub-divider) & vertical dividers.
   * - Returns an inline intent-choice prompt when a Door or Structural Carcass Panel is selected so the user
   *   can pick in 1 click between Removing Door (Open Bay), Deleting Compartment (Shrink), or Deleting Entire Module.
   */
  const deleteActiveSelectionSmart = useCallback(():
    | { action: "executed"; ok: boolean; message: string }
    | {
        action: "prompt";
        kind: "door" | "structural";
        partName: string;
        bayIndex: number;
        canRemoveDoor: boolean;
        canDeleteBay: boolean;
        canShrinkDouble: boolean;
        canDeleteModule: boolean;
        shrunkOuterCm: number;
        halfShrunkOuterCm: number;
      } => {
    const state = useConfiguratorStore.getState();
    const selId = state.selectedComponentId;
    const mod = state.project.modules[state.activeModuleIndex] || state.project.modules[0];
    if (!mod) {
      return { action: "executed", ok: false, message: "Aktif modül bulunamadı." };
    }

    if (selId) {
      const bd = generateModuleGeometry(mod, { doorOpenAngleDeg: 0 });
      const selPart = bd.components.find((c) => c.id === selId);
      const partName = selPart ? selPart.label.split(" (")[0] : "Seçili parça";
      const role = selPart?.role || "";

      // 1. Removable interior component (shelf, drawer, rail, fitting, sub-divider) -> INSTANT DELETE
      if (removeSelectedInteriorComponent()) {
        return {
          action: "executed",
          ok: true,
          message: `"${partName}" silindi (Ctrl+Z ile geri al).`,
        };
      }

      // 2. Vertical carcass divider -> INSTANT MERGE
      if (role === "carcass_divider") {
        if (mod.bays.length > 1) {
          const bIdx =
            typeof selPart?.bayIndex === "number"
              ? Math.max(0, Math.min(mod.bays.length - 1, selPart.bayIndex))
              : Math.max(0, Math.min(mod.bays.length - 1, state.activeBayIndex));
          removeBayAt(bIdx);
          return {
            action: "executed",
            ok: true,
            message: "Ara dikme kaldırıldı ve komşu bölmeler birleştirildi (Ctrl+Z ile geri al).",
          };
        }
        return {
          action: "executed",
          ok: false,
          message: "Tek bölmeli dolapta silinecek ara dikme yok.",
        };
      }

      const bIdx =
        typeof selPart?.bayIndex === "number"
          ? Math.max(0, Math.min(mod.bays.length - 1, selPart.bayIndex))
          : Math.max(0, Math.min(mod.bays.length - 1, state.activeBayIndex));
      const fourSpace = calculateFourSpaceDimensions(mod);
      const bayClearW = fourSpace.usableInternal.bayClearWidthsMm[bIdx] || 600;
      const panelT = mod.carcass.panelThickness || 18;
      const shrunkOuterCm = Math.max(
        35,
        Math.round((mod.dimensions.width - (bayClearW + panelT)) / 10)
      );
      const halfShrunkOuterCm = Math.max(
        40,
        Math.round((mod.dimensions.width - Math.round(bayClearW * 0.5)) / 10)
      );
      const targetBay = mod.bays[bIdx];
      const canDeleteBay = mod.bays.length > 1;
      const canShrinkDouble =
        targetBay?.door?.type === "double" && bayClearW >= 760;
      const canDeleteModule = state.project.modules.length > 1;

      // 3. Door leaf or hinge -> SMART 1-LINE INTENT BAR
      if (
        role === "door_left" ||
        role === "door_right" ||
        role === "door_hinge" ||
        selId.includes("_door_")
      ) {
        const canRemoveDoor = targetBay?.door?.type !== "open";
        if (canRemoveDoor || canDeleteBay || canShrinkDouble || canDeleteModule) {
          return {
            action: "prompt",
            kind: "door",
            partName,
            bayIndex: bIdx,
            canRemoveDoor,
            canDeleteBay,
            canShrinkDouble,
            canDeleteModule,
            shrunkOuterCm,
            halfShrunkOuterCm,
          };
        }
        return {
          action: "executed",
          ok: false,
          message: "Bu bölmede zaten kapak bulunmuyor.",
        };
      }

      // 4. Structural outer carcass panel (top, bottom, sides, back, plinth, countertop) -> SMART 1-LINE INTENT BAR
      if (canDeleteBay || canShrinkDouble || canDeleteModule) {
        return {
          action: "prompt",
          kind: "structural",
          partName,
          bayIndex: bIdx,
          canRemoveDoor: false,
          canDeleteBay,
          canShrinkDouble,
          canDeleteModule,
          shrunkOuterCm,
          halfShrunkOuterCm,
        };
      }

      return {
        action: "executed",
        ok: false,
        message: `"${partName}" taşıyıcı ana gövde panelidir, tek başına silinemez.`,
      };
    }

    // 5. No sub-component selected -> module-level deletion if multiple modules exist
    if (state.project.modules.length > 1) {
      const modName = mod.name || "Modül";
      removeActiveModule();
      return {
        action: "executed",
        ok: true,
        message: `"${modName}" sahneden kaldırıldı (Ctrl+Z ile geri al).`,
      };
    }

    return {
      action: "executed",
      ok: false,
      message: "Sahnede tek modül var; silmek için önce bir iç parça veya bölme seçin.",
    };
  }, [
    removeSelectedInteriorComponent,
    removeBayAt,
    removeActiveModule,
  ]);

  return {
    removeBayAt,
    removeBayAndShrinkModule,
    shrinkDoubleBayToSingle,
    setModuleHingeHardware,
    setModuleDrawerRunnerHardware,
    toggleModuleLedLighting,
    restoreModuleBaysSnapshot,
    applyMaterialByTargetScope,
    setModuleMaterialDetails,
    resetModuleMaterialOverrides,
    restoreModuleMaterialSnapshot,
    removeModuleAt,
    removeSelectedInteriorComponent,
    deleteActiveSelectionSmart,
  };
}
