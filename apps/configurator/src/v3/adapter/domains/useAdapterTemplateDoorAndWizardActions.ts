"use client";
import { buildGuidedWizardProject, type GuidedWizardLayoutInput } from "../guidedWizardBuilder";
import { harmonizeModuleWithProjectContext } from "../moduleHarmonizer";
import { buildDoorSystemsShowcaseProject, type DoorShowcaseMode } from "../doorShowcaseBuilder";
import { applyValidatedDimensionsToModule } from "../../components/workspace/moduleLibraryUtils";
import { useCallback } from "react";
import { useConfiguratorStore } from "../../../store/useConfiguratorStore";
import { type ModuleInstance, resolveSmartCompatibleDoorPatchForModuleBay, computeBayDoorZones, type DoorSystemId, type DoorOverlayType, type HandleCategory, type OpeningTechnology } from "@birim/core";
import { WARDROBE_TEMPLATES, KITCHEN_TEMPLATES, V4_MODULE_TEMPLATES, type WardrobeInteriorWizardId, getV4TemplateById, generateSmartWallLayouts, distributeModulesAlongWall, applyWardrobeInteriorWizard, generateKitchenComplementaryModules } from "@birim/catalog";
import { getEffectiveSpaceWalls } from "../../engine/kitchenSpatialEngine";
import { commitAdapterState } from "../adapterMathAndCache";

export interface AdapterTemplateDoorDeps {
  commitActiveModuleUpdate: (
    updater: (mod: ModuleInstance) => ModuleInstance,
    pushHistory?: boolean
  ) => void;
}

export function useAdapterTemplateDoorAndWizardActions(deps: AdapterTemplateDoorDeps) {
  const { commitActiveModuleUpdate } = deps;
  /**
   * V4: Update Door System, Overlay, Handle Category, Opening Technology, or Hardware Product SKU on a bay
   */
  /**
   * 1-Click Door Opening Direction Flip (Sol Açılır <-> Sağ Açılır <-> Çift Kapak)
   */
  const flipActiveDoorDirection = useCallback(
    (bayIdx?: number) => {
      commitActiveModuleUpdate((mod) => {
        const targetBayIdx =
          typeof bayIdx === "number"
            ? bayIdx
            : Math.min(useConfiguratorStore.getState().activeBayIndex, mod.bays.length - 1);
        const bay = mod.bays[targetBayIdx];
        if (!bay || !bay.door) return mod;
        const curType = bay.door.type;
        if (curType === "single_left") {
          bay.door = { ...bay.door, type: "single_right", doorSystemId: "hinged_single" };
        } else if (curType === "single_right") {
          bay.door = { ...bay.door, type: "single_left", doorSystemId: "hinged_single" };
        } else if (curType === "inset_left") {
          bay.door = { ...bay.door, type: "inset_right", doorSystemId: "hinged_inset" };
        } else if (curType === "inset_right") {
          bay.door = { ...bay.door, type: "inset_left", doorSystemId: "hinged_inset" };
        } else if (curType === "half_overlay_left") {
          bay.door = { ...bay.door, type: "half_overlay_right", doorSystemId: "hinged_overlay_variant" };
        } else if (curType === "half_overlay_right") {
          bay.door = { ...bay.door, type: "half_overlay_left", doorSystemId: "hinged_overlay_variant" };
        } else {
          // If currently double or other, switch to single_right so user immediately sees single-right opening, then next click flips to single_left
          bay.door = { ...bay.door, type: "single_right", doorSystemId: "hinged_single" };
          mod.isOpenFront = false;
        }
        return mod;
      }, true);
    },
    [commitActiveModuleUpdate]
  );

  const setBayV4DoorConfig = useCallback(
    (
      bayIdx: number,
      updates: {
        doorSystemId?: DoorSystemId;
        overlayType?: DoorOverlayType;
        handleCategory?: HandleCategory;
        handleProfileId?: string;
        handleMaterialId?: string;
        handleOrientation?: "auto" | "vertical" | "horizontal";
        handleOffsetY?: number;
        doorBottomGapMm?: number;
        doorTopGapMm?: number;
        doorSubType?: string;
        handleEdgeInsetX?: number;
        handleLengthMm?: number;
        openingTechnology?: OpeningTechnology;
        hardwareProductId?: string;
        hingeCount?: number;
        hingeBottomOffsetMm?: number;
        hingeTopOffsetMm?: number;
        crossSectionProfile?: import("@birim/core").DoorCrossSectionProfile;
        doorMaterialId?: string;
        doorThicknessMm?: number;
        doorEdgeBandThicknessMm?: number;
        softClose?: boolean;
        isGlassFramed?: boolean;
        frontFillerLeftMm?: number;
        frontFillerRightMm?: number;
        frontFillerPosition?: "coplanar_front" | "recessed_inner";
        upperZoneDoorState?: "auto" | "closed" | "open";
        lowerZoneDoorState?: "auto" | "closed" | "open";
        zoneDoorStates?: Record<string, "closed" | "open">;
      }
    ) => {
      commitActiveModuleUpdate((mod) => {
        const bay = mod.bays[bayIdx];
        if (!bay) return mod;
        const compatUpdates = resolveSmartCompatibleDoorPatchForModuleBay(updates, mod, bayIdx);
        const nextDoor = { ...bay.door, ...compatUpdates };
        if (compatUpdates.handleCategory && compatUpdates.handleProfileId === undefined) {
          nextDoor.handleProfileId = bay.door.handleProfileId;
        }
        if (typeof compatUpdates.softClose === "boolean" && !compatUpdates.openingTechnology) {
          nextDoor.openingTechnology = compatUpdates.softClose ? "soft_close" : "manual_standard";
        }
        if (compatUpdates.openingTechnology && compatUpdates.softClose === undefined) {
          nextDoor.softClose =
            compatUpdates.openingTechnology === "soft_close" ||
            compatUpdates.openingTechnology === "push_to_open_soft_close" ||
            compatUpdates.openingTechnology === "sliding_damped";
        }
        if (compatUpdates.doorSystemId) {
          mod.isOpenFront = compatUpdates.doorSystemId === "open";
          const types: Partial<Record<DoorSystemId, typeof nextDoor.type>> = { open: "open", hinged_single: "single_left", hinged_double: "double", hinged_inset: "inset_left", hinged_overlay_variant: "half_overlay_left", sliding_top_hung: "sliding", sliding_bottom_rolling: "sliding_bottom", lift_up_stay: "lift_up_stay", lift_parallel: "lift_parallel", lift_bi_fold: "lift_bi_fold", folding_side: "folding", pocket_retractable: "pocket", tambour_roller: "tambour" };
          nextDoor.type = types[compatUpdates.doorSystemId] ?? "single_left";
          nextDoor.overlayType = compatUpdates.doorSystemId === "hinged_inset" ? "inset" : compatUpdates.doorSystemId === "hinged_overlay_variant" ? "half_overlay" : "full_overlay";
        }
        if (compatUpdates.doorSystemId) {
          if (compatUpdates.doorSystemId === "hinged_double") nextDoor.type = "double";
          else if (compatUpdates.doorSystemId === "hinged_single") nextDoor.type = bay.door.type === "single_right" ? "single_right" : "single_left";
          else if (
            compatUpdates.doorSystemId === "sliding_top_hung" ||
            compatUpdates.doorSystemId === "sliding_bottom_rolling"
          ) {
            nextDoor.type = "sliding";
          } else if (compatUpdates.doorSystemId === "hinged_inset") {
            nextDoor.overlayType = "inset";
          } else if (compatUpdates.doorSystemId === "hinged_overlay_variant") {
            nextDoor.overlayType = "half_overlay";
          }
          if (compatUpdates.doorSystemId !== "open") {
            const hasExtDrawers = (bay.drawers || []).some((d) => !d.isInternal && !d.isHidden);
            const forcesInternalDrawers =
              compatUpdates.doorSystemId === "tambour_roller" ||
              compatUpdates.doorSystemId.startsWith("sliding") ||
              compatUpdates.doorSystemId.startsWith("lift_") ||
              compatUpdates.doorSystemId === "pocket_retractable";
            if (hasExtDrawers && (forcesInternalDrawers || computeBayDoorZones(mod, bayIdx).length === 0)) {
              bay.drawers = bay.drawers.map((dr) =>
                !dr.isHidden ? { ...dr, isInternal: true } : dr
              );
            }
          }
          // Üst dolapta AVENTOS HK top (maks 600mm), HL top (maks 580mm) veya HF top (min 480mm) seçildiğinde gövde boyunu otomatik uyarla
          if (mod.category === "kitchen_wall" || mod.moduleFamilyId === "fam_kitchen_wall") {
            let adjustedWallH: number | null = null;
            if (compatUpdates.doorSystemId === "lift_up_stay" && mod.dimensions.height > 600) {
              adjustedWallH = 600;
            } else if (compatUpdates.doorSystemId === "lift_parallel" && mod.dimensions.height > 580) {
              adjustedWallH = 540;
            } else if (compatUpdates.doorSystemId === "lift_bi_fold" && mod.dimensions.height < 480) {
              adjustedWallH = 720;
            }
            if (adjustedWallH !== null) {
              mod.dimensions = { ...mod.dimensions, height: adjustedWallH };
              const newNetH = Math.max(120, adjustedWallH - (mod.carcass.plinthHeight || 0) - 2 * (mod.carcass.panelThickness || 18));
              mod.bays.forEach((mb) => {
                mb.shelves = mb.shelves.map((sh, si, arr) => ({
                  ...sh,
                  elevationY: Math.min(
                    Math.max(64, newNetH - 64),
                    sh.elevationY > newNetH - 48
                      ? Math.round(((si + 1) * newNetH) / (arr.length + 1))
                      : sh.elevationY
                  ),
                }));
              });
            }
          }
          // Kapak açılış tipi değiştiğinde mevcut kulbun yeni kapakla uyumluluğunu tekrar doğrula
          const rechecked = resolveSmartCompatibleDoorPatchForModuleBay(
            {
              handleProfileId: nextDoor.handleProfileId,
              handleCategory: nextDoor.handleCategory,
              crossSectionProfile: nextDoor.crossSectionProfile,
            },
            {
              ...mod,
              bays: mod.bays.map((b, bi) => (bi === bayIdx ? { ...b, door: nextDoor } : b)),
            },
            bayIdx
          );
          nextDoor.handleProfileId = rechecked.handleProfileId;
          nextDoor.handleCategory = rechecked.handleCategory;
          if (rechecked.crossSectionProfile) {
            nextDoor.crossSectionProfile = rechecked.crossSectionProfile;
          }
        }
        if (compatUpdates.handleCategory === "handleless_plain") {
          nextDoor.handleType = "push_to_open";
        } else if (compatUpdates.handleCategory === "gola_profile" || compatUpdates.handleCategory === "j_pull") {
          nextDoor.handleType = "integrated_profile";
        } else if (compatUpdates.handleCategory) {
          nextDoor.handleType = "standard";
        }
        bay.door = nextDoor;
        return mod;
      }, true);
    },
    [commitActiveModuleUpdate]
  );

  const copyBayInteriorToAllBays = useCallback(
    (sourceBayIdx?: number) => {
      commitActiveModuleUpdate((mod) => {
        const srcIdx =
          typeof sourceBayIdx === "number"
            ? sourceBayIdx
            : Math.min(useConfiguratorStore.getState().activeBayIndex, mod.bays.length - 1);
        const srcBay = mod.bays[srcIdx];
        if (!srcBay) return mod;
        const isSlidingModule = mod.bays.some((b) => b.door?.type === "sliding");
        const stamp = Date.now();
        mod.bays = mod.bays.map((b, idx) => {
          if (idx === srcIdx) return b;
          return {
            ...b,
            shelves: (srcBay.shelves || []).map((sh, sIdx) => ({
              ...sh,
              id: `sh_${mod.id}_${idx}_${stamp}_${sIdx}`,
              bayIndex: idx,
            })),
            drawers: (srcBay.drawers || []).map((dr, dIdx) => ({
              ...dr,
              id: `drw_${mod.id}_${idx}_${stamp}_${dIdx}`,
              bayIndex: idx,
              isInternal: isSlidingModule ? true : dr.isInternal,
            })),
            hangingRails: (srcBay.hangingRails || []).map((hr, rIdx) => ({
              ...hr,
              id: `rail_${mod.id}_${idx}_${stamp}_${rIdx}`,
              bayIndex: idx,
            })),
            specialFittings: (srcBay.specialFittings || []).map((sf, fIdx) => ({
              ...sf,
              id: `fit_${mod.id}_${idx}_${stamp}_${fIdx}`,
              bayIndex: idx,
            })),
            subDividers: (srcBay.subDividers || []).map((sd, sdIdx) => ({
              ...sd,
              id: `subdiv_${mod.id}_${idx}_${stamp}_${sdIdx}`,
              bayIndex: idx,
            })),
          };
        });
        return mod;
      }, true);
    },
    [commitActiveModuleUpdate]
  );

  const mirrorModuleBaysLeftRight = useCallback(() => {
    commitActiveModuleUpdate((mod) => {
      if (mod.bays.length <= 1) return mod;
      const reversed = [...mod.bays].reverse().map((b, newIdx) => {
        const flippedDoorType =
          b.door?.type === "single_left"
            ? ("single_right" as const)
            : b.door?.type === "single_right"
            ? ("single_left" as const)
            : b.door?.type;
        return {
          ...b,
          index: newIdx,
          door: b.door ? { ...b.door, bayIndex: newIdx, type: flippedDoorType || b.door.type } : b.door,
          shelves: b.shelves.map((s) => ({ ...s, bayIndex: newIdx })),
          drawers: b.drawers.map((d) => ({ ...d, bayIndex: newIdx })),
          hangingRails: b.hangingRails.map((r) => ({ ...r, bayIndex: newIdx })),
          specialFittings: b.specialFittings.map((f) => ({ ...f, bayIndex: newIdx })),
          subDividers: (b.subDividers || []).map((sd) => ({ ...sd, bayIndex: newIdx })),
        };
      });
      mod.bays = reversed;
      return mod;
    }, true);
  }, [commitActiveModuleUpdate]);

  const copyDoorConfigToAllBays = useCallback(
    (sourceBayIdx?: number) => {
      commitActiveModuleUpdate((mod) => {
        const srcIdx =
          typeof sourceBayIdx === "number"
            ? sourceBayIdx
            : Math.min(useConfiguratorStore.getState().activeBayIndex, mod.bays.length - 1);
        const srcBay = mod.bays[srcIdx];
        if (!srcBay || !srcBay.door) return mod;
        const srcDoor = srcBay.door;
        mod.bays = mod.bays.map((b, bIdx) => {
          const adapted = resolveSmartCompatibleDoorPatchForModuleBay(
            {
              handleProfileId: srcDoor.handleProfileId,
              handleCategory: srcDoor.handleCategory,
              crossSectionProfile: srcDoor.crossSectionProfile,
            },
            mod,
            bIdx
          );
          return {
            ...b,
            door: {
              ...b.door,
              crossSectionProfile: adapted.crossSectionProfile ?? srcDoor.crossSectionProfile,
              isGlassFramed: srcDoor.isGlassFramed,
              handleCategory: adapted.handleCategory ?? srcDoor.handleCategory,
              handleProfileId: adapted.handleProfileId ?? srcDoor.handleProfileId,
              handleMaterialId: srcDoor.handleMaterialId,
              handleOrientation: srcDoor.handleOrientation,
              handleOffsetY: srcDoor.handleOffsetY,
              handleEdgeInsetX: srcDoor.handleEdgeInsetX,
              handleLengthMm: srcDoor.handleLengthMm,
              handleType: srcDoor.handleType,
              doorMaterialId: srcDoor.doorMaterialId,
              doorThicknessMm: srcDoor.doorThicknessMm,
              doorEdgeBandThicknessMm: srcDoor.doorEdgeBandThicknessMm,
              softClose: srcDoor.softClose,
              openingTechnology: srcDoor.openingTechnology,
              overlayType: srcDoor.overlayType,
            },
          };
        });
        if (srcDoor.crossSectionProfile) {
          const isSolid =
            srcDoor.crossSectionProfile !== "glass_frame" &&
            srcDoor.crossSectionProfile !== "mirror_door";
          if (
            isSolid &&
            (mod.carcass.doorMaterialId === "mat_smoked_glass" ||
              mod.carcass.doorMaterialId === "mat_bronze_mirror")
          ) {
            mod.carcass.doorMaterialId = "mat_veneer_oak";
          }
          if (isSolid) {
            mod.bays.forEach((bayItem) => {
              if (
                bayItem.door.doorMaterialId === "mat_smoked_glass" ||
                bayItem.door.doorMaterialId === "mat_bronze_mirror"
              ) {
                delete bayItem.door.doorMaterialId;
              }
            });
          }
        }
        if (srcDoor.crossSectionProfile) {
          mod.carcass.crossSectionProfile = srcDoor.crossSectionProfile;
        }
        if (srcDoor.doorMaterialId) {
          mod.carcass.doorMaterialId = srcDoor.doorMaterialId;
        }
        if (srcDoor.doorThicknessMm) {
          mod.carcass.doorThickness = srcDoor.doorThicknessMm;
        }
        if (mod.componentMaterialOverrides) {
          const nextOv = { ...mod.componentMaterialOverrides };
          Object.keys(nextOv).forEach((k) => {
            if (k.includes("door")) {
              delete nextOv[k];
            }
          });
          mod.componentMaterialOverrides = nextOv;
        }
        return mod;
      }, true);
    },
    [commitActiveModuleUpdate]
  );

  /**
   * V4: Instantiate any of the 92 V4 Parametric Module Templates
   */
  const dropV4TemplateWithSnap = useCallback(
    (
      templateId: string,
      dropWorldXMm?: number,
      customDimensions?: { width?: number; height?: number; depth?: number }
    ): { placedName: string; snappedX: number; snappedY: number; snapLabel: string } | null => {
      const tpl =
        getV4TemplateById(templateId) ||
        WARDROBE_TEMPLATES.find((w) => w.templateId === templateId) ||
        KITCHEN_TEMPLATES.find((k) => k.templateId === templateId);
      if (!tpl) return null;

      const state = useConfiguratorStore.getState();
      const curProj = state.project;
      const baseMod = tpl.createInstance(`mod_${Date.now()}`);
      const v4TplMatch = V4_MODULE_TEMPLATES.find((v) => v.templateId === templateId);
      const newMod = v4TplMatch
        ? applyValidatedDimensionsToModule(baseMod, v4TplMatch, customDimensions)
        : baseMod;
      const activeMod = curProj.modules[state.activeModuleIndex] || curProj.modules.find((m) => m.category !== "complementary") || curProj.modules[0];

      if (newMod.category !== "complementary" && newMod.moduleFamilyId !== "fam_complementary") {
        harmonizeModuleWithProjectContext(newMod, curProj.modules, {
          mode: "append",
          targetModule: activeMod,
          customDimensions,
        });
      }

      // Object-Linked Complementary Module Placement: attach directly to the selected parent cabinet!
      if ((newMod.category === "complementary" || newMod.moduleFamilyId === "fam_complementary") && activeMod) {
        const parentMod = activeMod.category === "complementary"
          ? (curProj.modules.find((m) => m.category !== "complementary") || activeMod)
          : activeMod;
        const tplAny = tpl as { code?: string; id?: string; templateId?: string };
        const codeUpper = (tplAny.code || tplAny.id || tplAny.templateId || "").toUpperCase();
        const nameLower = (tpl.name || newMod.name || "").toLowerCase();
        const pX = parentMod.position.x;
        const pY = parentMod.position.y;
        const pZ = parentMod.position.z;
        const pW = parentMod.dimensions.width;
        const pH = parentMod.dimensions.height;
        const pD = parentMod.dimensions.depth;
        const rotY = parentMod.rotation?.y || 0;

        let attachKey = `custom_${Date.now()}`;
        let snapDesc = `${parentMod.name} modülüne entegre edildi`;

        if (codeUpper.includes("PNL") || nameLower.includes("bitiş paneli") || nameLower.includes("yan panel")) {
          const hasLeft = curProj.modules.some((m) => m.id === `comp_att_${parentMod.id}__panel_left`);
          if (!hasLeft && pX >= 18) {
            attachKey = "panel_left";
            newMod.name = `${parentMod.name} — Sol Yan Bitiş Paneli`;
            newMod.dimensions = { width: 18, height: pH, depth: pD + 20 };
            newMod.position = { x: pX - 18, y: pY, z: pZ };
            snapDesc = `${parentMod.name} Sol Yanına Sıfır Entegre Edildi`;
          } else {
            attachKey = "panel_right";
            newMod.name = `${parentMod.name} — Sağ Yan Bitiş Paneli`;
            newMod.dimensions = { width: 18, height: pH, depth: pD + 20 };
            newMod.position = { x: pX + pW, y: pY, z: pZ };
            snapDesc = `${parentMod.name} Sağ Yanına Sıfır Entegre Edildi`;
          }
        } else if (codeUpper.includes("FLR") || nameLower.includes("kör dolgu") || nameLower.includes("köşe dolgu")) {
          attachKey = "filler_left";
          newMod.name = `${parentMod.name} — Yan Kör Dolgu Çıtası`;
          newMod.dimensions = { width: newMod.dimensions.width || 50, height: pH, depth: 18 };
          newMod.position = { x: pX + pW, y: pY, z: pZ + Math.max(0, pD - 18) };
          snapDesc = `${parentMod.name} Yanına Dolgu Çıtası Olarak Bağlandı`;
        } else if (codeUpper.includes("CRN") || codeUpper.includes("LGT") || nameLower.includes("taç") || nameLower.includes("alın") || nameLower.includes("ışık bandı")) {
          attachKey = "crown_top";
          newMod.name = `${parentMod.name} — Üst Taç / Işık Bandı`;
          newMod.dimensions = { width: pW, height: newMod.dimensions.height || 60, depth: newMod.dimensions.depth || 40 };
          newMod.position = { x: pX, y: pY + pH, z: pZ };
          snapDesc = `${parentMod.name} Üst Kotuna (Y: ${pY + pH}mm) Bağlandı`;
        } else if (codeUpper.includes("BKS") || nameLower.includes("backsplash") || nameLower.includes("tezgâh arası")) {
          attachKey = "backsplash";
          newMod.name = `${parentMod.name} — Tezgâh Arası Backsplash Paneli`;
          newMod.dimensions = { width: pW, height: 600, depth: 18 };
          newMod.position = { x: pX, y: pY + pH + 38, z: pZ };
          snapDesc = `${parentMod.name} Tezgâh Üstüne (W: ${pW}mm) Bağlandı`;
        } else if (codeUpper.includes("WTF") || nameLower.includes("şelale")) {
          attachKey = "waterfall_right";
          newMod.name = `${parentMod.name} — Şelale (Waterfall) Yan Tezgâh İnişi`;
          newMod.dimensions = { width: 38, height: pH + 38, depth: pD + 20 };
          newMod.position = { x: pX + pW, y: pY, z: pZ };
          snapDesc = `${parentMod.name} Sağ Yanına Şelale Tezgâh Olarak Bağlandı`;
        } else if (codeUpper.includes("WKT") || codeUpper.includes("BAR") || nameLower.includes("tezgâh") || nameLower.includes("bar")) {
          attachKey = "worktop";
          newMod.name = `${parentMod.name} — Üst Kuvars Tezgâh Plakası`;
          newMod.dimensions = { width: pW, height: 38, depth: pD + 20 };
          newMod.position = { x: pX, y: pY + pH, z: pZ };
          snapDesc = `${parentMod.name} Üstüne (W: ${pW}mm) Tezgâh Olarak Bağlandı`;
        } else if (codeUpper.includes("PLN") || nameLower.includes("baza")) {
          attachKey = "plinth_front";
          newMod.name = `${parentMod.name} — Ön Baza Bandı`;
          newMod.dimensions = { width: pW, height: parentMod.carcass.plinthHeight || 100, depth: 18 };
          newMod.position = { x: pX, y: pY, z: pZ + Math.max(0, pD - 45) };
          snapDesc = `${parentMod.name} Alt Bazasına (W: ${pW}mm) Bağlandı`;
        } else {
          newMod.position = { x: pX + pW, y: pY, z: pZ };
        }

        newMod.id = `comp_att_${parentMod.id}__${attachKey}`;
        newMod.rotation = { x: 0, y: rotY, z: 0 };
        if (attachKey !== "worktop" && attachKey !== "backsplash" && attachKey !== "waterfall_right") {
        newMod.carcass = {
          ...newMod.carcass,
          bodyMaterialId: parentMod.carcass.doorMaterialId || parentMod.carcass.bodyMaterialId,
          doorMaterialId: parentMod.carcass.doorMaterialId || parentMod.carcass.bodyMaterialId,
        };
      }

        const filteredMods = curProj.modules.filter((m) => m.id !== newMod.id);
        const nextModules = [...filteredMods, newMod];
        const nextProj = {
          ...curProj,
          version: (curProj.version || 1) + 1,
          updatedAt: new Date().toISOString(),
          modules: nextModules,
        };
        commitAdapterState({
          history: [...state.history.slice(-50), curProj],
          future: [],
          project: nextProj,

        });
        return {
          placedName: newMod.name,
          snappedX: newMod.position.x,
          snappedY: newMod.position.y,
          snapLabel: snapDesc,
        };
      }

      const isWallCab =
        newMod.category === "kitchen_wall" || newMod.moduleFamilyId === "fam_kitchen_wall";
      const targetY = isWallCab ? 1400 : 0;
      const targetTopY = targetY + newMod.dimensions.height;

      const sameRowMods = curProj.modules.filter((m) => {
        if (m.category === "complementary") return false;
        const mIsWall = m.category === "kitchen_wall" || m.moduleFamilyId === "fam_kitchen_wall";
        return mIsWall === isWallCab && (m.rotation?.y || 0) === 0;
      });

      // Check 3D vertical Y-range overlap so wall cabinets snap beside tall wardrobes instead of burying into them,
      // while still allowing wall cabinets above 720-860mm kitchen base cabinets.
      const yOverlappingMods = curProj.modules.filter((m) => {
        if (m.category === "complementary" || (m.rotation?.y || 0) !== 0) return false;
        const mTopY = m.position.y + m.dimensions.height;
        return m.position.y < targetTopY - 2 && mTopY > targetY + 2;
      });

      const overlapsAt = (candX: number) =>
        yOverlappingMods.some(
          (m) =>
            candX < m.position.x + m.dimensions.width - 2 &&
            candX + newMod.dimensions.width > m.position.x + 2
        );

      const hasLeftReturnWall = (curProj?.space?.walls || []).some(
        (w) =>
          Math.abs((((w?.rotationY || 0) % 180) + 180) % 180 - 90) <= 12 &&
          Math.abs(w?.position?.x ?? 9999) <= 50 &&
          (w?.length || 0) >= 250
      );
      const needsLeftWallFillerGap =
        hasLeftReturnWall &&
        !newMod.isCorner &&
        Boolean(
          newMod.bays[0]?.door &&
            (newMod.bays[0].door.type === "single_left" ||
              newMod.bays[0].door.type === "double")
        );
      const defaultStartWallX = needsLeftWallFillerGap ? 50 : 0;
      const snapCandidates: { x: number; label: string }[] = [
        {
          x: defaultStartWallX,
          label:
            defaultStartWallX > 0
              ? `Sol Duvar 50mm Kör Boşluk Hizası (X: ${defaultStartWallX}mm)`
              : "Duvar Başlangıcı (X: 0mm)",
        },
      ];
      yOverlappingMods.forEach((m, idx) => {
        const rightEdge = m.position.x + m.dimensions.width;
        const leftEdge = Math.max(0, m.position.x - newMod.dimensions.width);
        snapCandidates.push({
          x: rightEdge,
          label: `${idx + 1}. Modülün Sağına Sıfır Bitişik (X: ${rightEdge}mm)`,
        });
        snapCandidates.push({
          x: leftEdge,
          label: `${idx + 1}. Modülün Soluna Sıfır Bitişik (X: ${leftEdge}mm)`,
        });
      });

      const validCandidates = snapCandidates.filter((c) => c.x >= 0 && !overlapsAt(c.x));
      let chosen = validCandidates[validCandidates.length - 1] || {
        x:
          yOverlappingMods.length > 0
            ? Math.max(...yOverlappingMods.map((m) => m.position.x + m.dimensions.width))
            : 0,
        label: "Sıra Sonuna Mıknatıslandı",
      };

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
        }
      }

      let shiftedExisting = curProj.modules;
      if (
        newMod.isCorner &&
        (dropWorldXMm === undefined || dropWorldXMm <= 450) &&
        !sameRowMods.some((m) => m.isCorner && m.position.x === 0)
      ) {
        chosen = { x: 0, label: "Oda Başlangıç Köşesi (X: 0mm, Z: 0mm)" };
        if (overlapsAt(0)) {
          const shiftBy = newMod.dimensions.width;
          shiftedExisting = curProj.modules.map((m) => {
            const mIsWall = m.category === "kitchen_wall" || m.moduleFamilyId === "fam_kitchen_wall";
            if (mIsWall === isWallCab && (m.rotation?.y || 0) === 0) {
              return {
                ...m,
                position: { ...m.position, x: m.position.x + shiftBy },
              };
            }
            return m;
          });
        }
      }

      newMod.position = { x: chosen.x, y: targetY, z: 0 };
      const nextModules = [...shiftedExisting, newMod];
      const nextProj = {
        ...curProj,
        version: (curProj.version || 1) + 1,
        updatedAt: new Date().toISOString(),
        modules: nextModules,
      };

      commitAdapterState({
        history: [...state.history.slice(-50), curProj],
        future: [],
        project: nextProj,
        activeModuleIndex: nextModules.length - 1,
        selectedModuleIds: [newMod.id],
        activeBayIndex: 0,
        doorOpenAngleDeg: 0,
        drawerOpenMm: 0,
      });

      return {
        placedName: newMod.name,
        snappedX: chosen.x,
        snappedY: targetY,
        snapLabel: chosen.label,
      };
    },
    []
  );

  const applyV4Template = useCallback(
    (
      templateId: string,
      appendToProject = false,
      customDimensions?: { width?: number; height?: number; depth?: number }
    ) => {
      const tpl = getV4TemplateById(templateId);
      if (!tpl) return;
      const state = useConfiguratorStore.getState();
      const curProj = state.project;
      const lastMod = curProj.modules[curProj.modules.length - 1];
      const newMod = applyValidatedDimensionsToModule(
        tpl.createInstance(`mod_${Date.now()}`),
        tpl,
        customDimensions
      );

    let nextModules: ModuleInstance[];
    let targetIndex = 0;

    const hasLeftReturnWall = (curProj?.space?.walls || []).some(
      (w) =>
        Math.abs((((w?.rotationY || 0) % 180) + 180) % 180 - 90) <= 12 &&
        Math.abs(w?.position?.x ?? 9999) <= 50 &&
        (w?.length || 0) >= 250
    );
    const needsLeftWallClearance =
      hasLeftReturnWall &&
      !newMod.isCorner &&
      Boolean(
        newMod.bays[0]?.door &&
          (newMod.bays[0].door.type === "single_left" ||
            newMod.bays[0].door.type === "double")
      );
    const minLeftStartClearanceX = needsLeftWallClearance ? 50 : 0;

    if (appendToProject || curProj.modules.length === 0) {
      harmonizeModuleWithProjectContext(newMod, curProj.modules, {
        mode: "append",
        targetModule: lastMod,
        customDimensions,
      });
      const nextX = lastMod ? lastMod.position.x + lastMod.dimensions.width : minLeftStartClearanceX;
      newMod.position = { ...newMod.position, x: nextX };
      nextModules = [...curProj.modules, newMod];
      targetIndex = nextModules.length - 1;
    } else {
      targetIndex = Math.max(0, Math.min(curProj.modules.length - 1, state.activeModuleIndex ?? 0));
      const targetMod = curProj.modules[targetIndex];
      harmonizeModuleWithProjectContext(newMod, curProj.modules, {
        mode: "replace",
        targetModule: targetMod,
        customDimensions,
      });
      newMod.id = targetMod.id;
      // Retain horizontal X and Z placement, but determine Y (elevation) based on new template family:
      // Wall cabinets sit at wall elevation (1450 or previous if already wall), base/tall/wardrobe sit on floor (0).
      const newY =
        tpl.familyId === "fam_kitchen_wall"
          ? targetMod.moduleFamilyId === "fam_kitchen_wall"
            ? targetMod.position.y
            : 1450
          : 0;
      // Köşe şablonuna geçiliyorsa (0, newY, 0) köşesine oturt; köşeden normal menteşeli dolaba geçiliyorsa sol dik duvardan 50mm kör boşluk bırak
      const isSwappingIntoCorner = Boolean(newMod.isCorner && !targetMod.isCorner);
      const placedX = isSwappingIntoCorner
        ? 0
        : targetMod.position.x === 0 && minLeftStartClearanceX > 0
          ? minLeftStartClearanceX
          : targetMod.position.x;
      const placedZ = isSwappingIntoCorner ? 0 : targetMod.position.z;
      newMod.position = {
        ...newMod.position,
        x: placedX,
        y: newY,
        z: placedZ,
      };
      const deltaW = newMod.dimensions.width - targetMod.dimensions.width;
      const targetRotY = targetMod.rotation?.y || 0;
      const targetIsWall =
        targetMod.category === "kitchen_wall" || targetMod.moduleFamilyId === "fam_kitchen_wall";
      const newIsWall =
        newMod.category === "kitchen_wall" || newMod.moduleFamilyId === "fam_kitchen_wall";
      nextModules = curProj.modules.map((m, idx) => {
        if (idx === targetIndex) return newMod;
        if (
          !isSwappingIntoCorner &&
          deltaW !== 0 &&
          targetIsWall === newIsWall &&
          (m.category === "kitchen_wall" || m.moduleFamilyId === "fam_kitchen_wall") === newIsWall &&
          Math.abs((m.rotation?.y || 0) - targetRotY) <= 5 &&
          targetRotY === 0 &&
          m.position.x >= targetMod.position.x + targetMod.dimensions.width - 5
        ) {
          return {
            ...m,
            position: { ...m.position, x: Math.max(0, m.position.x + deltaW) },
          };
        }
        return m;
      });
    }

    const nextProj = {
      ...curProj,
      version: (curProj.version || 1) + 1,
      updatedAt: new Date().toISOString(),
      modules: nextModules,
    };

    commitAdapterState({
      history: [...state.history.slice(-50), curProj],
      future: [],
      project: nextProj,
      activeModuleIndex: targetIndex,
      activeBayIndex: 0,
      doorOpenAngleDeg: 0,
      drawerOpenMm: 0,
    });
  }, []);

  /**
   * Object-Linked Complementary Attachment: attaches or toggles a specific complementary part
   * (left/right end panel, top crown, filler strip, worktop, backsplash, waterfall, plinth)
   * directly on the currently selected cabinet so it matches its dimensions and moves with it!
   */
  const attachComplementaryToActiveModule = useCallback(
    (
      compType:
        | "panel_left"
        | "panel_right"
        | "crown_top"
        | "filler_left"
        | "worktop"
        | "backsplash"
        | "waterfall_right"
        | "plinth_front"
    ) => {
      const state = useConfiguratorStore.getState();
      const curProj = state.project;
      const activeMod =
        curProj.modules[state.activeModuleIndex] ||
        curProj.modules.find((m) => m.category !== "complementary");
      if (!activeMod) return;
      const parentMod =
        activeMod.category === "complementary"
          ? curProj.modules.find((m) => m.category !== "complementary") || activeMod
          : activeMod;

      const targetId = `comp_att_${parentMod.id}__${compType}`;
      const existingIdx = curProj.modules.findIndex((m) => m.id === targetId);
      if (existingIdx >= 0) {
        const removedComp = curProj.modules[existingIdx];
        const isLeftPiece = compType === "panel_left" || compType === "filler_left";
        const shiftBackLeft =
          isLeftPiece &&
          removedComp.position.x === 0 &&
          Math.abs(parentMod.position.x - removedComp.dimensions.width) <= 2
            ? removedComp.dimensions.width
            : 0;

        const nextModules = curProj.modules
          .filter((m) => m.id !== targetId)
          .map((m) => {
            if (shiftBackLeft > 0 && m.position.x >= parentMod.position.x) {
              return {
                ...m,
                position: { ...m.position, x: Math.max(0, m.position.x - shiftBackLeft) },
              };
            }
            return m;
          });
        const nextProj = {
          ...curProj,
          version: (curProj.version || 1) + 1,
          updatedAt: new Date().toISOString(),
          modules: nextModules,
        };
        commitAdapterState({
          history: [...state.history.slice(-50), curProj],
          future: [],
          project: nextProj,

        });
        return;
      }

      const tplMap: Record<string, string> = {
        panel_left: "tpl_cm_05_end_panel",
        panel_right: "tpl_cm_05_end_panel",
        filler_left: "tpl_cm_04_wall_filler",
        crown_top: "tpl_cm_12_crown_molding",
        worktop: "tpl_cm_09_countertop",
        backsplash: "tpl_cm_11_backsplash",
        waterfall_right: "tpl_cm_10_waterfall_edge",
        plinth_front: "tpl_cm_01_plinth_strip",
      };
      const tpl = getV4TemplateById(tplMap[compType] || "tpl_cm_05_end_panel");
      if (!tpl) return;

      const newMod = tpl.createInstance(targetId);
      const isLeftAttach = compType === "panel_left" || compType === "filler_left";
      const leftAttachW = compType === "panel_left" ? 18 : compType === "filler_left" ? 50 : 0;

      // If parentMod is snapped to the left wall (pX < leftAttachW) or flush against a left cabinet,
      // shift parentMod (and same-row right modules + their attached parts) right by shiftRightMm so the left panel sits OUTSIDE the cabinet!
      let shiftRightMm = 0;
      if (isLeftAttach) {
        const hasLeftCollision = curProj.modules.some(
          (other) =>
            other.id !== parentMod.id &&
            other.category !== "complementary" &&
            Math.abs(other.position.y - parentMod.position.y) < 300 &&
            parentMod.position.x - leftAttachW < other.position.x + other.dimensions.width - 1 &&
            parentMod.position.x > other.position.x
        );
        if (parentMod.position.x < leftAttachW) {
          shiftRightMm = leftAttachW - parentMod.position.x;
        } else if (hasLeftCollision) {
          shiftRightMm = leftAttachW;
        }
      }

      const updatedBaseModules =
        shiftRightMm > 0
          ? curProj.modules.map((m) => {
              if (
                m.id === parentMod.id ||
                m.id.startsWith(`comp_att_${parentMod.id}__`) ||
                (m.position.x >= parentMod.position.x &&
                  Math.abs(m.position.y - parentMod.position.y) < 400)
              ) {
                return {
                  ...m,
                  position: { ...m.position, x: m.position.x + shiftRightMm },
                };
              }
              return m;
            })
          : curProj.modules;

      const pX = parentMod.position.x + shiftRightMm;
      const pY = parentMod.position.y;
      const pZ = parentMod.position.z;
      const pW = parentMod.dimensions.width;
      const pH = parentMod.dimensions.height;
      const pD = parentMod.dimensions.depth;

      if (compType === "panel_left") {
        newMod.name = `${parentMod.name} — Sol Yan Bitiş Paneli`;
        newMod.dimensions = { width: 18, height: pH, depth: pD + 20 };
        newMod.position = { x: pX - 18, y: pY, z: pZ };
      } else if (compType === "panel_right") {
        newMod.name = `${parentMod.name} — Sağ Yan Bitiş Paneli`;
        newMod.dimensions = { width: 18, height: pH, depth: pD + 20 };
        newMod.position = { x: pX + pW, y: pY, z: pZ };
      } else if (compType === "filler_left") {
        newMod.name = `${parentMod.name} — Duvar Kör Dolgu Çıtası (50mm)`;
        newMod.dimensions = { width: 50, height: pH, depth: 18 };
        newMod.position = { x: pX - 50, y: pY, z: pZ + Math.max(0, pD - 18) };
      } else if (compType === "crown_top") {
        newMod.name = `${parentMod.name} — Üst Taç / Alın Çıtası`;
        newMod.dimensions = { width: pW, height: 60, depth: 40 };
        newMod.position = { x: pX, y: pY + pH, z: pZ };
      } else if (compType === "worktop") {
        newMod.name = `${parentMod.name} — Üst Kuvars Tezgâh (38mm)`;
        newMod.dimensions = { width: pW, height: 38, depth: pD + 20 };
        newMod.position = { x: pX, y: pY + pH, z: pZ };
      } else if (compType === "backsplash") {
        newMod.name = `${parentMod.name} — Tezgâh Arası Backsplash`;
        newMod.dimensions = { width: pW, height: 600, depth: 18 };
        newMod.position = { x: pX, y: pY + pH + 38, z: pZ };
      } else if (compType === "waterfall_right") {
        newMod.name = `${parentMod.name} — Şelale Yan Tezgâh İnişi`;
        newMod.dimensions = { width: 38, height: pH + 38, depth: pD + 20 };
        newMod.position = { x: pX + pW, y: pY, z: pZ };
      } else if (compType === "plinth_front") {
        newMod.name = `${parentMod.name} — Baza Ön Bandı`;
        newMod.dimensions = { width: pW, height: parentMod.carcass.plinthHeight || 100, depth: 18 };
        newMod.position = { x: pX, y: pY, z: pZ + Math.max(0, pD - 32) };
      }

      newMod.rotation = { x: 0, y: parentMod.rotation?.y || 0, z: 0 };
      if (compType !== "worktop" && compType !== "backsplash" && compType !== "waterfall_right") {
        newMod.carcass = {
          ...newMod.carcass,
          bodyMaterialId: parentMod.carcass.doorMaterialId || parentMod.carcass.bodyMaterialId,
          doorMaterialId: parentMod.carcass.doorMaterialId || parentMod.carcass.bodyMaterialId,
        };
      }

      const nextModules = [...updatedBaseModules, newMod];
      const nextProj = {
        ...curProj,
        version: (curProj.version || 1) + 1,
        updatedAt: new Date().toISOString(),
        modules: nextModules,
      };
      commitAdapterState({
        history: [...state.history.slice(-50), curProj],
        future: [],
        project: nextProj,

      });
    },
    []
  );

  /**
   * V4: Apply Wardrobe Interior Wizard to active module
   */
  const applyWardrobeWizard = useCallback(
    (wizardId: WardrobeInteriorWizardId) => {
      commitActiveModuleUpdate((mod) => applyWardrobeInteriorWizard(mod, wizardId), true);
    },
    [commitActiveModuleUpdate]
  );

  /**
   * V4: Apply Smart Wall Layout Proposal (e.g., 3600mm wall -> 4-carcass / 3-carcass / mixed)
   */
  const applySmartWallProposal = useCallback((proposalId: string, wallSpanMm = 3600) => {
    const state = useConfiguratorStore.getState();
    const curProj = state.project;
    const mod = curProj.modules[0];
    const isKitchen = mod?.category?.startsWith("kitchen");
    const proposals = generateSmartWallLayouts(
      wallSpanMm,
      mod?.dimensions.height || 2200,
      mod?.dimensions.depth || 600,
      isKitchen ? "kitchen" : "wardrobe"
    );
    const chosen = proposals.find((p) => p.id === proposalId) || proposals[0];
    if (!chosen) return;

    const nextProj = {
      ...curProj,
      version: (curProj.version || 1) + 1,
      updatedAt: new Date().toISOString(),
      modules: chosen.buildModules(),
    };

    commitAdapterState({
      history: [...state.history.slice(-50), curProj],
      future: [],
      project: nextProj,
      activeModuleIndex: 0,
      activeBayIndex: 0,
    });
  }, []);

  /**
   * V4: Distribute current modules evenly along wall
   */
  const distributeAlongWall = useCallback(() => {
    const state = useConfiguratorStore.getState();
    const curProj = state.project;
    const wallLen = getEffectiveSpaceWalls(curProj)[0]?.length || 3600;
    const { updatedModules } = distributeModulesAlongWall(curProj.modules, wallLen);
    const nextProj = {
      ...curProj,
      version: (curProj.version || 1) + 1,
      updatedAt: new Date().toISOString(),
      modules: updatedModules,
    };

    commitAdapterState({
      history: [...state.history.slice(-50), curProj],
      future: [],
      project: nextProj,
    });
  }, []);

  /**
   * V4: Auto-generate Complementary Kitchen Modules (Countertop, Backsplash, End Panel)
   */
  const autoGenerateKitchenComplementary = useCallback(() => {
    const state = useConfiguratorStore.getState();
    const curProj = state.project;
    const wallLen = getEffectiveSpaceWalls(curProj)[0]?.length || 3600;
    const nextModules = generateKitchenComplementaryModules(curProj.modules, wallLen);
    const nextProj = {
      ...curProj,
      version: (curProj.version || 1) + 1,
      updatedAt: new Date().toISOString(),
      modules: nextModules,
    };

    commitAdapterState({
      history: [...state.history.slice(-50), curProj],
      future: [],
      project: nextProj,
    });
  }, []);

  /**
   * One-Click Project Budget / Segment Switcher (Ekonomik <-> Standart <-> Premium + LED)
   */
  const applyProjectSegmentPreset = useCallback(
    (segment: "economy" | "standard" | "premium") => {
      const state = useConfiguratorStore.getState();
      const curProj = state.project;
      const presetMap = {
        economy: {
          bodyMat: "mat_melamine_white",
          doorMat: "mat_ke_safir_mese",
          runnerId: "hw_blum_tandembox_m30",
          hingeId: "hw_salice_c7p6ae9",
          addLed: false,
        },
        standard: {
          bodyMat: "mat_veneer_oak",
          doorMat: "mat_ye_kasmir_gri",
          runnerId: "hw_blum_movento_760h",
          hingeId: "hw_blum_71b3550",
          addLed: false,
        },
        premium: {
          bodyMat: "mat_ke_mattplus_vizon",
          doorMat: "mat_lacquer_cashmere",
          runnerId: "hw_blum_legrabox_m40",
          hingeId: "hw_blum_71b7550",
          addLed: true,
        },
      }[segment];

      const nextModules = curProj.modules.map((mod) => {
        if (mod.category === "complementary") return mod;
        const nextBays = mod.bays.map((b, bIdx) => {
          const nextDrawers = b.drawers.map((d) => ({
            ...d,
            hardwareProductId: presetMap.runnerId,
          }));
          let nextFittings = [...(b.specialFittings || [])];
          if (presetMap.addLed && !nextFittings.some((f) => f.type.startsWith("led_"))) {
            nextFittings.push({
              id: `fit_led_${mod.id}_${bIdx}`,
              bayIndex: bIdx,
              elevationY: Math.max(400, mod.dimensions.height - 220),
              type: "led_profile",
              height: 20,
            });
          } else if (!presetMap.addLed) {
            nextFittings = nextFittings.filter((f) => !f.id.startsWith("fit_led_"));
          }
          return {
            ...b,
            drawers: nextDrawers,
            specialFittings: nextFittings,
            door: {
              ...b.door,
              hardwareProductId:
                b.door.doorSystemId?.startsWith("sliding") ||
                b.door.doorSystemId?.startsWith("lift")
                  ? b.door.hardwareProductId
                  : presetMap.hingeId,
            },
          };
        });
        return {
          ...mod,
          carcass: {
            ...mod.carcass,
            bodyMaterialId: presetMap.bodyMat,
            doorMaterialId: presetMap.doorMat,
          },
          bays: nextBays,
        };
      });

      commitAdapterState({
        project: {
          ...curProj,
          modules: nextModules,
        },
      });
    },
    []
  );

  /**
   * V4 Guided Step-by-Step Wizard Atomic Builder:
   * Builds a 100% collision-free, non-overlapping multi-module wall layout in one atomic state commit.
   */
  const loadDoorSystemsShowcase = useCallback((mode: DoorShowcaseMode) => {
    const state = useConfiguratorStore.getState();
    const curProj = state.project;
    const nextProj = buildDoorSystemsShowcaseProject(curProj, mode);
    state.setDoorOpenAngleDeg(0, false);
    state.setDrawerOpenMm(0, false);
    commitAdapterState({
      history: [...state.history.slice(-50), curProj],
      future: [],
      project: nextProj,
      activeModuleIndex: 0,
      activeBayIndex: 0,
      selectedComponentId: null,
    });
    if (typeof window !== "undefined") {
      window.requestAnimationFrame(() => {
        window.dispatchEvent(new CustomEvent("birim:fit-camera-3d", { detail: "hero" }));
      });
    }
  }, []);

  const applyGuidedWizardLayout = useCallback(
    (wiz: GuidedWizardLayoutInput) => {
      const state = useConfiguratorStore.getState();
      const curProj = state.project;
      const nextProj = buildGuidedWizardProject(curProj, wiz);

      // Start newly generated layouts with doors and internal drawers cleanly closed
      state.setDoorOpenAngleDeg(0, false);
      state.setDrawerOpenMm(0, false);

      commitAdapterState({
        history: [...state.history.slice(-50), curProj],
        future: [],
        project: nextProj,
        activeModuleIndex: 0,
        activeBayIndex: 0,
        selectedComponentId: null,
      });
      if (typeof window !== "undefined") {
        window.requestAnimationFrame(() => {
          window.dispatchEvent(new CustomEvent("birim:fit-camera-3d", { detail: "hero" }));
        });
      }
    },
    []
  );

  return {
    flipActiveDoorDirection,
    setBayV4DoorConfig,
    copyBayInteriorToAllBays,
    mirrorModuleBaysLeftRight,
    copyDoorConfigToAllBays,
    dropV4TemplateWithSnap,
    applyV4Template,
    attachComplementaryToActiveModule,
    applyWardrobeWizard,
    applySmartWallProposal,
    distributeAlongWall,
    autoGenerateKitchenComplementary,
    applyProjectSegmentPreset,
    loadDoorSystemsShowcase,
    applyGuidedWizardLayout,
  };
}
