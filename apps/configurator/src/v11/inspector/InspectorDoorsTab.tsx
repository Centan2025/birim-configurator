"use client";
import React from "react";
import {
  classifyCabinetPlacementZone,
  computeBayDoorZones,
  isHandleProfileCompatibleWithModuleBay,
  type BayConfig,
  type DoorConfig,
  type DoorCrossSectionProfile,
  type ModuleInstance,
} from "@birim/core";
import type { HandleProfileDefinition } from "@birim/catalog";
import { V11_DOOR_PROFILES, type V11InspectorTab } from "../v11Constants";
import type { RightParametricInspectorProps } from "../RightParametricInspector";
import { CustomDoorSketchEditor, type CustomDoorProfilePreset } from "../CustomDoorSketchEditor";
import { HandleCrossSectionSvg, getHandleCrossSectionMeta } from "../HandleCrossSectionSvg";
import { renderPhotorealDoorProfileArt, renderDoorTypeIcon, renderDoorProfileIcon } from "./inspectorSvgIcons";
import { StudioToggleSwitch } from "./InspectorControls";

export interface InspectorDoorsTabProps {
  activeBay: BayConfig;
  activeModule: ModuleInstance;
  activeTab: V11InspectorTab;
  applyDoorPatchAcrossScope: (
    patch: Parameters<RightParametricInspectorProps["onSetBayV4DoorConfig"]>[1],
    applyAllBaysInModule: boolean,
    applyAllModulesInScene: boolean
  ) => void;
  batchApplyDoorModelToModule: boolean;
  batchApplyDrawerFrontToAll: boolean;
  batchApplyHandlesToAllModules: boolean;
  batchApplyHandlesToModule: boolean;
  curDoorProfile: DoorCrossSectionProfile;
  curDoorType: DoorConfig["type"];
  customDoorOpen: boolean;
  customDoorProfiles: CustomDoorProfilePreset[];
  doorFrontSubTab: "door" | "drawer";
  handleFilterTab: "all" | "pull_handles" | "gola_handleless";
  handleProfiles: HandleProfileDefinition[];
  hasExternalDrawersInActiveBay: boolean;
  isKitchenCornerMod: boolean;
  isSimple: boolean;
  mainModuleIndices: Array<{ m: ModuleInstance; idx: number }>;
  onAddSpecialFitting: RightParametricInspectorProps["onAddSpecialFitting"];
  onCopyDoorToAllBays: RightParametricInspectorProps["onCopyDoorToAllBays"];
  onOpenCustomHardwareModal: RightParametricInspectorProps["onOpenCustomHardwareModal"];
  onRemoveSpecialFitting: RightParametricInspectorProps["onRemoveSpecialFitting"];
  onSetBayDoorType: RightParametricInspectorProps["onSetBayDoorType"];
  onSetBayV4DoorConfig: RightParametricInspectorProps["onSetBayV4DoorConfig"];
  onSetDrawerPlacement: RightParametricInspectorProps["onSetDrawerPlacement"];
  onSetSlidingMountingType: RightParametricInspectorProps["onSetSlidingMountingType"];
  onUpdateCarcassConfig: RightParametricInspectorProps["onUpdateCarcassConfig"];
  safeBayIdx: number;
  selectedCustomDoorId: string | null;
  selectedDrawerFrontId: string | null;
  setBatchApplyDoorModelToModule: React.Dispatch<React.SetStateAction<boolean>>;
  setBatchApplyDrawerFrontToAll: React.Dispatch<React.SetStateAction<boolean>>;
  setBatchApplyHandlesToAllModules: React.Dispatch<React.SetStateAction<boolean>>;
  setBatchApplyHandlesToModule: React.Dispatch<React.SetStateAction<boolean>>;
  setCustomDoorOpen: React.Dispatch<React.SetStateAction<boolean>>;
  setCustomDoorProfiles: React.Dispatch<React.SetStateAction<CustomDoorProfilePreset[]>>;
  setDoorFrontSubTab: React.Dispatch<React.SetStateAction<"door" | "drawer">>;
  setHandleFilterTab: React.Dispatch<React.SetStateAction<"all" | "pull_handles" | "gola_handleless">>;
  setSelectedCustomDoorId: React.Dispatch<React.SetStateAction<string | null>>;
  setSelectedDrawerFrontId: React.Dispatch<React.SetStateAction<string | null>>;
}

export const InspectorDoorsTab: React.FC<InspectorDoorsTabProps> = (props) => {
  const {
    activeBay,
    activeModule,
    activeTab,
    applyDoorPatchAcrossScope,
    batchApplyDoorModelToModule,
    batchApplyDrawerFrontToAll,
    batchApplyHandlesToAllModules,
    batchApplyHandlesToModule,
    curDoorProfile,
    curDoorType,
    customDoorOpen,
    customDoorProfiles,
    doorFrontSubTab,
    handleFilterTab,
    handleProfiles,
    hasExternalDrawersInActiveBay,
    isKitchenCornerMod,
    isSimple,
    mainModuleIndices,
    onAddSpecialFitting,
    onCopyDoorToAllBays,
    onOpenCustomHardwareModal,
    onRemoveSpecialFitting,
    onSetBayDoorType,
    onSetBayV4DoorConfig,
    onSetDrawerPlacement,
    onSetSlidingMountingType,
    onUpdateCarcassConfig,
    safeBayIdx,
    selectedCustomDoorId,
    selectedDrawerFrontId,
    setBatchApplyDoorModelToModule,
    setBatchApplyDrawerFrontToAll,
    setBatchApplyHandlesToAllModules,
    setBatchApplyHandlesToModule,
    setCustomDoorOpen,
    setCustomDoorProfiles,
    setDoorFrontSubTab,
    setHandleFilterTab,
    setSelectedCustomDoorId,
    setSelectedDrawerFrontId,
  } = props;
  return (
    <>
          {/* ==================== SEKME 3: KAPAK & DONANIM ==================== */}
          {activeTab === "doors" && (
            <>
              {(activeModule.isOpenFront || activeModule.bays.every((b) => !b.door || b.door.type === "open")) && (
                <div
                  data-testid="v11-open-cabinet-add-doors-card"
                  className="p-3.5 rounded-2xl bg-[#1D4ED8]/15 border border-[#3B82F6]/45 space-y-2.5"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-extrabold text-sky-200">
                      Açık Dolap Sistemi — Kapak Ekle
                    </span>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-sky-500/20 text-sky-200 border border-sky-400/30">
                      Kapaksız
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-300 leading-relaxed">
                    Bu modül şu an açık sistem olarak yapılandırılmış. Tek tıkla tüm bölmelere veya sadece seçili bölmeye kapak ekleyebilirsiniz.
                  </p>
                  <div className="grid grid-cols-2 gap-1.5">
                    <button
                      type="button"
                      data-testid="v11-add-hinged-all-bays-btn"
                      onClick={() => {
                        const T = activeModule.carcass.panelThickness || 18;
                        const innerW = Math.max(300, activeModule.dimensions.width - 2 * T);
                        const avgBayW = innerW / Math.max(1, activeModule.bays.length);
                        activeModule.bays.forEach((b, idx) => {
                          const bw = b.customWidth ?? avgBayW;
                          const bestType =
                            bw > 560 ? "double" : idx % 2 === 0 ? "single_left" : "single_right";
                          onSetBayDoorType(idx, bestType);
                        });
                      }}
                      className="py-2 px-2.5 rounded-xl bg-[#2563EB] hover:bg-[#1D4ED8] text-white text-[11px] font-bold transition cursor-pointer shadow-xs"
                    >
                      + Tümüne Menteşeli Kapak
                    </button>
                    <button
                      type="button"
                      data-testid="v11-add-sliding-doors-btn"
                      onClick={() => onSetBayDoorType(safeBayIdx, "sliding")}
                      className="py-2 px-2.5 rounded-xl bg-white/10 hover:bg-white/18 border border-white/18 text-white text-[11px] font-bold transition cursor-pointer"
                    >
                      + Sürgülü Kapak Ekle
                    </button>
                  </div>
                </div>
              )}
              <div className="p-3.5 rounded-2xl bg-white border border-[#E5DFD3] space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-[#141413]">
                    {safeBayIdx + 1}. Bölme Kapak Açılışı
                  </span>
                  {activeModule.bays.length > 1 && (
                    <button
                      type="button"
                      onClick={() => onCopyDoorToAllBays(safeBayIdx)}
                      className="px-2.5 py-1 rounded-full bg-[#F5F2EA] hover:bg-[#EAE3D5] text-[10.5px] font-semibold text-[#44403C] cursor-pointer"
                    >
                      Tüm Bölmelere Uygula
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-3 gap-1.5">
                  {(() => {
                    const zone = classifyCabinetPlacementZone(activeModule);
                    const canSlide =
                      curDoorType === "sliding" ||
                      (zone !== "kitchen_wall" &&
                        zone !== "kitchen_corner_wall" &&
                        zone !== "kitchen_corner_base" &&
                        zone !== "kitchen_sink_base" &&
                        zone !== "kitchen_appliance_base" &&
                        activeModule.dimensions.depth >= 450 &&
                        activeModule.dimensions.width >= 900 &&
                        activeModule.bays.length >= 2);
                    const isLCorner90 =
                      isKitchenCornerMod &&
                      !activeModule.templateId?.includes("blind") &&
                      !activeModule.templateId?.includes("diag");
                    const list: Array<{ id: typeof curDoorType; label: string }> = [
                      ...(isLCorner90 ? [{ id: "folding" as const, label: "90° Katlanır" }] : []),
                      { id: "double", label: "Çift" },
                      { id: "single_left", label: "Sol" },
                      { id: "single_right", label: "Sağ" },
                      ...(canSlide ? [{ id: "sliding" as const, label: "Sürgü" }] : []),
                      ...(!isKitchenCornerMod ? [{ id: "tambour" as const, label: "Tambur" }] : []),
                      { id: "open", label: "Açık" },
                    ];
                    return list;
                  })().map((dt) => {
                    const active = curDoorType === dt.id;
                    return (
                      <button
                        key={dt.id}
                        type="button"
                        onClick={() =>
                          dt.id === "folding"
                            ? onSetBayV4DoorConfig(safeBayIdx, { doorSystemId: "folding_side" })
                            : onSetBayDoorType(safeBayIdx, dt.id as "single_left" | "single_right" | "double" | "sliding" | "tambour" | "open")
                        }
                        className={`py-2 px-1 rounded-xl text-[10.5px] font-semibold transition cursor-pointer flex flex-col items-center gap-1 ${
                          active
                            ? "bg-[#141413] text-white"
                            : "bg-[#F5F2EA] hover:bg-[#EAE3D5] text-[#44403C]"
                        }`}
                      >
                        <span className="scale-125 my-0.5">{renderDoorTypeIcon(dt.id)}</span>
                        <span className="text-[10px]">{dt.label}</span>
                      </button>
                    );
                  })}
                </div>

                {/* Dinamik Çoklu Çekmece Aralığı Kapak Bölgeleri (Üst / Orta 1..N / Alt) */}
                {curDoorType !== "open" &&
                  curDoorType !== "sliding" &&
                  curDoorType !== "tambour" && (() => {
                    const doorZones = computeBayDoorZones(activeModule, safeBayIdx);
                    if (doorZones.length === 0) return null;
                    const toggleZone = (zoneKey: string, nextClosed: boolean) => {
                      const nextMap: Record<string, "closed" | "open"> = {
                        ...(activeBay.door?.zoneDoorStates || {}),
                        [zoneKey]: nextClosed ? "closed" : "open",
                      };
                      onSetBayV4DoorConfig(safeBayIdx, {
                        zoneDoorStates: nextMap,
                        ...(zoneKey === "upper"
                          ? { upperZoneDoorState: nextClosed ? "closed" : "open" }
                          : {}),
                        ...(zoneKey === "lower"
                          ? { lowerZoneDoorState: nextClosed ? "closed" : "open" }
                          : {}),
                      });
                    };
                    return (
                      <div className="pt-2 border-t border-[#F0ECE3] space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-[10.5px] font-semibold text-[#57534E]">
                            Çekmece Aralığı Kapak Bölgeleri ({doorZones.length})
                          </span>
                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => {
                                const allClosed: Record<string, "closed" | "open"> = {};
                                doorZones.forEach((z) => {
                                  allClosed[z.key] = "closed";
                                });
                                onSetBayV4DoorConfig(safeBayIdx, {
                                  zoneDoorStates: allClosed,
                                  upperZoneDoorState: "closed",
                                  lowerZoneDoorState: "closed",
                                });
                              }}
                              className="px-1.5 py-0.5 rounded-md bg-[#F5F2EA] hover:bg-[#EAE3D5] text-[9.5px] font-semibold text-[#44403C] cursor-pointer"
                            >
                              Tümü Kapaklı
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                const allOpen: Record<string, "closed" | "open"> = {};
                                doorZones.forEach((z) => {
                                  allOpen[z.key] = "open";
                                });
                                onSetBayV4DoorConfig(safeBayIdx, {
                                  zoneDoorStates: allOpen,
                                  upperZoneDoorState: "open",
                                  lowerZoneDoorState: "open",
                                });
                              }}
                              className="px-1.5 py-0.5 rounded-md bg-[#F5F2EA] hover:bg-[#EAE3D5] text-[9.5px] font-semibold text-[#44403C] cursor-pointer"
                            >
                              Tümü Açık
                            </button>
                          </div>
                        </div>
                        <div className="space-y-1.5">
                          {doorZones.map((zone) => (
                            <div
                              key={zone.key}
                              className="px-2.5 py-1.5 rounded-xl bg-[#FAF8F4] border border-[#E5DFD3] flex items-center justify-between gap-2"
                            >
                              <div className="min-w-0">
                                <span className="text-[10.5px] font-semibold text-[#141413]">
                                  {zone.label}
                                </span>
                                <span className="ml-1.5 font-mono text-[9.5px] text-[#78716C]">
                                  {zone.height} mm
                                </span>
                              </div>
                              <StudioToggleSwitch
                                size="sm"
                                checked={!zone.isOpen}
                                onChange={(next) => toggleZone(zone.key, next)}
                              />
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })()}

                {activeModule.category === "kitchen_wall" && !isKitchenCornerMod && (
                  <div className="pt-2 border-t border-[#F0ECE3] space-y-1.5">
                    <div className="text-[10.5px] font-semibold text-[#57534E]">
                      Üst Dolap Yukarı Kalkar Mekanizma (Blum AVENTOS)
                    </div>
                    <div className="grid grid-cols-3 gap-1.5">
                      {(
                        [
                          { sys: "lift_up_stay", type: "lift_up_stay", label: "Tek Kalkar (HK)" },
                          { sys: "lift_bi_fold", type: "lift_bi_fold", label: "Katlanır (HF)" },
                          { sys: "lift_parallel", type: "lift_parallel", label: "Paralel (HL)" },
                        ] as const
                      ).map((lf) => {
                        const isLiftAct =
                          activeBay?.door?.doorSystemId === lf.sys || curDoorType === lf.type;
                        return (
                          <button
                            key={lf.sys}
                            type="button"
                            onClick={() =>
                              onSetBayV4DoorConfig(safeBayIdx, {
                                doorSystemId: lf.sys,
                              })
                            }
                            className={`py-1.5 px-1.5 rounded-xl text-[10.5px] font-semibold transition cursor-pointer ${
                              isLiftAct
                                ? "bg-[#141413] text-white"
                                : "bg-[#FAF8F4] hover:bg-[#EAE3D5] border border-[#E5DFD3] text-[#44403C]"
                            }`}
                          >
                            {lf.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {isKitchenCornerMod && activeModule.category !== "kitchen_wall" && (
                  <div className="pt-2 border-t border-[#F0ECE3] space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-[10.5px] font-bold text-[#141413]">
                        Köşe Dolap İç Mekanizması
                      </span>
                      <span className="text-[9.5px] text-[#78716C]">Kapakla senkron 3B hareket</span>
                    </div>
                    <div className="grid grid-cols-2 gap-1.5">
                      {(
                        [
                          { id: "corner_lemans", label: "LeMans II Fasulye", sub: "2×25kg Döner Tabla" },
                          { id: "magic_corner", label: "Magic Corner", sub: "Çift Kademe Çekme Sepet" },
                          { id: "carousel_half_moon", label: "270° Karusel", sub: "3/4 Döner Sepet" },
                          { id: "none_shelves", label: "Sabit Köşe Raf", sub: "Mekanizmasız L/Beşgen" },
                        ] as const
                      ).map((cm) => {
                        const curCornerFit = (activeBay?.specialFittings || []).find(
                          (f) =>
                            f.type === "corner_lemans" ||
                            f.type === "magic_corner" ||
                            f.type === "carousel_half_moon"
                        );
                        const isSel =
                          cm.id === "none_shelves" ? !curCornerFit : curCornerFit?.type === cm.id;
                        return (
                          <button
                            key={cm.id}
                            type="button"
                            onClick={() => {
                              const existingCornerFits = (activeBay?.specialFittings || []).filter(
                                (f) =>
                                  f.type === "corner_lemans" ||
                                  f.type === "magic_corner" ||
                                  f.type === "carousel_half_moon"
                              );
                              existingCornerFits.forEach((ef) =>
                                onRemoveSpecialFitting(safeBayIdx, ef.id)
                              );
                              if (cm.id !== "none_shelves") {
                                onAddSpecialFitting(safeBayIdx, cm.id);
                              }
                            }}
                            className={`p-2 rounded-xl border text-left transition cursor-pointer ${
                              isSel
                                ? "bg-[#141413] text-white border-[#141413]"
                                : "bg-[#FAF8F4] hover:bg-[#EFEAE0] border-[#E5DFD3] text-[#1C1917]"
                            }`}
                          >
                            <div className="text-[10.5px] font-bold leading-tight">{cm.label}</div>
                            <div
                              className={`text-[9px] mt-0.5 ${
                                isSel ? "text-stone-300" : "text-[#78716C]"
                              }`}
                            >
                              {cm.sub}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {curDoorType === "sliding" && (
                  <div className="grid grid-cols-2 gap-1.5 pt-2 border-t border-[#F0ECE3]">
                    {(
                      [
                        { id: "top_hung_pelmet", label: "Üstü Kapalı Ray" },
                        { id: "inset_inside", label: "İçten Raylı" },
                        { id: "top_hung_exposed", label: "Üstten Askılı" },
                        { id: "coplanar_flush", label: "Hemzemin Sürgü" },
                      ] as const
                    ).map((sm) => {
                      const curMount = activeBay?.door?.slidingMountingType || "top_hung_pelmet";
                      return (
                        <button
                          key={sm.id}
                          type="button"
                          onClick={() => onSetSlidingMountingType(sm.id)}
                          className={`py-1.5 px-2 rounded-xl text-[11px] font-semibold transition cursor-pointer ${
                            curMount === sm.id
                              ? "bg-[#141413] text-white"
                              : "bg-[#F5F2EA] text-[#44403C]"
                          }`}
                        >
                          {sm.label}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              {customDoorOpen && (
                <CustomDoorSketchEditor
                  defaultTarget={curDoorType === "open" && activeBay.drawers.length > 0 ? "drawer" : "door"}
                  onCancel={() => setCustomDoorOpen(false)}
                  onSave={(created) => {
                    const nextList = [...customDoorProfiles, created];
                    setCustomDoorProfiles(nextList);
                    try {
                      window.localStorage.setItem(
                        "birim_custom_door_profiles_v1",
                        JSON.stringify(nextList)
                      );
                    } catch {}
                    setSelectedCustomDoorId(created.id);
                    if (created.target === "drawer") {
                      onUpdateCarcassConfig({
                        drawerFrontProfile: created.baseProfile,
                        customCadPolygon: created.customCadPolygon,
                        customCadProfileName: created.label,
                      });
                    } else {
                      applyDoorPatchAcrossScope(
                        {
                          crossSectionProfile: created.baseProfile,
                          customCadPolygon: created.customCadPolygon,
                          customCadProfileName: created.label,
                          isGlassFramed: Boolean(created.isGlass),
                        },
                        batchApplyDoorModelToModule,
                        batchApplyHandlesToAllModules
                      );
                    }
                    setCustomDoorOpen(false);
                  }}
                />
              )}

              {(curDoorType !== "open" || activeBay.drawers.length > 0) && (
                <div className="p-3.5 rounded-2xl bg-white border border-[#E5DFD3] space-y-2.5">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="inline-flex items-center p-0.5 rounded-full bg-black/35 border border-white/15">
                      {curDoorType !== "open" && (
                        <button
                          type="button"
                          onClick={() => setDoorFrontSubTab("door")}
                          className={`px-2.5 py-1 rounded-full text-[10.5px] font-bold transition cursor-pointer ${
                            doorFrontSubTab === "door" || activeBay.drawers.length === 0
                              ? "bg-gradient-to-br from-[#0284C7] via-[#1D4ED8] to-[#1E3A8A] text-white"
                              : "text-slate-300 hover:text-white"
                          }`}
                        >
                          Kapak Modeli
                        </button>
                      )}
                      {activeBay.drawers.length > 0 && (
                        <button
                          type="button"
                          onClick={() => setDoorFrontSubTab("drawer")}
                          className={`px-2.5 py-1 rounded-full text-[10.5px] font-bold transition cursor-pointer ${
                            doorFrontSubTab === "drawer" || curDoorType === "open"
                              ? "bg-gradient-to-br from-[#0284C7] via-[#1D4ED8] to-[#1E3A8A] text-white"
                              : "text-slate-300 hover:text-white"
                          }`}
                        >
                          Çekmece Klapası
                        </button>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      {activeModule.bays.length > 1 && doorFrontSubTab === "door" && curDoorType !== "open" && (
                        <StudioToggleSwitch
                          size="sm"
                          label="Tümü"
                          checked={batchApplyDoorModelToModule}
                          onChange={setBatchApplyDoorModelToModule}
                          title="Açıkken seçtiğiniz kapak modeli bu dolaptaki tüm kapaklara uygulanır"
                        />
                      )}
                      {((doorFrontSubTab === "drawer" && activeBay.drawers.length > 0) || curDoorType === "open") &&
                        activeBay.drawers.length > 1 && (
                          <StudioToggleSwitch
                            size="sm"
                            label="Tümü"
                            checked={batchApplyDrawerFrontToAll}
                            onChange={setBatchApplyDrawerFrontToAll}
                            title="Kapalıyken yalnızca seçili çekmecenin klapası değişir; açıkken tüm çekmecelere uygulanır"
                          />
                        )}
                      <button
                        type="button"
                        onClick={() => setCustomDoorOpen(true)}
                        className="px-2 py-1 rounded-lg bg-[#F5F2EA] hover:bg-[#EAE3D5] text-[#141413] text-[10px] font-semibold cursor-pointer"
                      >
                        + Kesit
                      </button>
                    </div>
                  </div>
                  {((doorFrontSubTab === "drawer" && activeBay.drawers.length > 0) || curDoorType === "open") &&
                    activeBay.drawers.length > 0 && (
                      <div className="flex flex-wrap items-center gap-1 pb-0.5">
                        {activeBay.drawers.map((dr, drIdx) => {
                          const effectiveTargetId =
                            selectedDrawerFrontId && activeBay.drawers.some((d) => d.id === selectedDrawerFrontId)
                              ? selectedDrawerFrontId
                              : activeBay.drawers[0]?.id;
                          const isSelectedDr = !batchApplyDrawerFrontToAll && dr.id === effectiveTargetId;
                          return (
                            <button
                              key={dr.id}
                              type="button"
                              onClick={() => {
                                setSelectedDrawerFrontId(dr.id);
                                setBatchApplyDrawerFrontToAll(false);
                              }}
                              className={`px-2 py-1 rounded-lg text-[10px] font-semibold border transition cursor-pointer ${
                                isSelectedDr
                                  ? "bg-[#141413] text-white border-[#38BDF8]"
                                  : batchApplyDrawerFrontToAll
                                  ? "bg-[#ECE7DD]/70 text-[#57534E] border-[#DED8CC]"
                                  : "bg-[#FAF8F4] hover:bg-[#F2EEE4] text-[#57534E] border-[#E5DFD3]"
                              }`}
                            >
                              Çekmece {drIdx + 1} ({dr.isInternal ? "İç" : "Dış"})
                            </button>
                          );
                        })}
                      </div>
                    )}
                  <div className="grid grid-cols-3 gap-2">
                    {V11_DOOR_PROFILES.filter((pf) => {
                      const isDrawerMode = (doorFrontSubTab === "drawer" && activeBay.drawers.length > 0) || curDoorType === "open";
                      if (isDrawerMode) return pf.id !== "mirror_door" && pf.id !== "mirror_frameless";
                      return pf.id !== "u_glass_open_top";
                    }).map((pf) => {
                      const isDrawerMode = (doorFrontSubTab === "drawer" && activeBay.drawers.length > 0) || curDoorType === "open";
                      const targetDrawer =
                        (selectedDrawerFrontId && activeBay.drawers.find((d) => d.id === selectedDrawerFrontId)) ||
                        activeBay.drawers[0];
                      const curDrawerProf = batchApplyDrawerFrontToAll
                        ? activeModule.carcass.drawerFrontProfile || "flat_slab"
                        : targetDrawer?.frontProfile || activeModule.carcass.drawerFrontProfile || "flat_slab";
                      const active = isDrawerMode ? curDrawerProf === pf.id : !selectedCustomDoorId && curDoorProfile === pf.id;
                      return (
                        <button
                          key={`${isDrawerMode ? "dr" : "d"}_${pf.id}`}
                          type="button"
                          onClick={() => {
                            if (isDrawerMode) {
                              if (!batchApplyDrawerFrontToAll && targetDrawer && onSetDrawerPlacement) {
                                onSetDrawerPlacement(
                                  safeBayIdx,
                                  targetDrawer.id,
                                  targetDrawer.elevationY,
                                  targetDrawer.height,
                                  true,
                                  { frontProfile: pf.id }
                                );
                              } else {
                                onUpdateCarcassConfig({ drawerFrontProfile: pf.id });
                                if (onSetDrawerPlacement) {
                                  activeBay.drawers.forEach((dr) => {
                                    if (dr.frontProfile && dr.frontProfile !== pf.id) {
                                      onSetDrawerPlacement(safeBayIdx, dr.id, dr.elevationY, dr.height, false, {
                                        frontProfile: pf.id,
                                      });
                                    }
                                  });
                                }
                              }
                            } else {
                              setSelectedCustomDoorId(null);
                              applyDoorPatchAcrossScope(
                                {
                                  crossSectionProfile: pf.id,
                                  isGlassFramed: Boolean(pf.isGlass),
                                },
                                batchApplyDoorModelToModule,
                                batchApplyHandlesToAllModules
                              );
                            }
                          }}
                          title={pf.label}
                          className={`p-1.5 rounded-2xl border text-center transition cursor-pointer flex flex-col items-stretch gap-1 overflow-hidden ${
                            active
                              ? "bg-[#141413] text-white border-[#38BDF8] ring-2 ring-[#38BDF8]/40"
                              : "bg-[#FAF8F4] hover:bg-[#F2EEE4] border-[#E5DFD3] text-[#141413]"
                          }`}
                        >
                          {renderPhotorealDoorProfileArt(pf.id)}
                          <div className="font-semibold text-[10px] leading-tight truncate px-0.5 pb-0.5">{pf.label.split(" (")[0]}</div>
                        </button>
                      );
                    })}
                    {customDoorProfiles.map((cp) => {
                      const active = selectedCustomDoorId === cp.id;
                      return (
                        <div key={cp.id} className="relative group">
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedCustomDoorId(cp.id);
                              applyDoorPatchAcrossScope(
                                {
                                  crossSectionProfile: cp.baseProfile,
                                  customCadPolygon: cp.customCadPolygon,
                                  customCadProfileName: cp.label,
                                  isGlassFramed: Boolean(cp.isGlass),
                                },
                                batchApplyDoorModelToModule,
                                batchApplyHandlesToAllModules
                              );
                            }}
                            className={`w-full p-2 rounded-2xl border text-left transition cursor-pointer flex items-center gap-2 ${
                              active
                                ? "bg-[#141413] text-white border-[#141413]"
                                : "bg-[#FAF8F4] hover:bg-[#F2EEE4] border-[#E5DFD3] text-[#141413]"
                            }`}
                          >
                            {cp.svgPaths && cp.svgPaths.length > 0 ? (
                              <svg width="24" height="24" viewBox="0 0 120 160" fill="none" className="shrink-0">
                                <rect x="4" y="4" width="112" height="152" rx="6" stroke="currentColor" strokeWidth="8" />
                                {cp.svgPaths.map((d, idx) => (
                                  <path key={idx} d={d} stroke="currentColor" strokeWidth="7" strokeLinecap="round" strokeLinejoin="round" />
                                ))}
                              </svg>
                            ) : (
                              renderDoorProfileIcon(cp.baseProfile)
                            )}
                            <div className="font-bold text-[11px] leading-tight truncate pr-3">
                              {cp.label}
                            </div>
                          </button>
                          <button
                            type="button"
                            title="Sil"
                            onClick={() => {
                              const nextList = customDoorProfiles.filter((x) => x.id !== cp.id);
                              setCustomDoorProfiles(nextList);
                              if (selectedCustomDoorId === cp.id) setSelectedCustomDoorId(null);
                              try {
                                window.localStorage.setItem(
                                  "birim_custom_door_profiles_v1",
                                  JSON.stringify(nextList)
                                );
                              } catch {}
                            }}
                            className="absolute top-1 right-1 w-4 h-4 rounded-full bg-black/10 hover:bg-rose-600 hover:text-white text-[10px] leading-none flex items-center justify-center opacity-0 group-hover:opacity-100 transition cursor-pointer"
                          >
                            ×
                          </button>
                        </div>
                      );
                    })}
                  </div>

                  <div className="flex items-center justify-between pt-2 border-t border-[#F0ECE3]">
                    <div>
                      <div className="text-[11px] font-semibold text-[#141413]">Frenli Yavaş Kapanır Menteşe</div>
                      <div className="text-[10px] text-[#78716C]">Blum CLIP top BLUMOTION entegre fren</div>
                    </div>
                    <StudioToggleSwitch
                      size="sm"
                      checked={activeBay?.door?.softClose !== false}
                      onChange={(next) =>
                        applyDoorPatchAcrossScope(
                          { softClose: next },
                          batchApplyDoorModelToModule,
                          batchApplyHandlesToAllModules
                        )
                      }
                    />
                  </div>
                </div>
              )}

              {(curDoorType !== "open" || hasExternalDrawersInActiveBay) && (
                <div className="p-3.5 rounded-2xl bg-white border border-[#E5DFD3] space-y-2.5">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-bold text-[#141413]">
                      {curDoorType === "open" && hasExternalDrawersInActiveBay
                        ? "Çekmece Kulp Stili & Toplu Uygulama"
                        : "Kulp Stili & Toplu Uygulama"}
                    </span>
                    <button
                      type="button"
                      onClick={onOpenCustomHardwareModal}
                      className="text-[11px] font-semibold text-[#8C7A6B] hover:text-[#141413] cursor-pointer"
                    >
                      + Özel Kulp
                    </button>
                  </div>

                  {/* Toplu Kulp Uygulama Toggle Switch Kontrolleri */}
                  <div className="p-2.5 rounded-xl bg-[#FAF8F4] border border-[#E6E1D6] space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <div>
                        <div className="text-[11px] font-semibold text-[#141413]">
                          Dolaptaki Tüm Kapaklara Uygula
                        </div>
                        <div className="text-[9.5px] text-[#78716C]">
                          Kapatırsanız yalnızca {safeBayIdx + 1}. bölme kapağı değişir
                        </div>
                      </div>
                      <StudioToggleSwitch
                        size="sm"
                        testId="v11-toggle-batch-handle-module"
                        checked={batchApplyHandlesToModule}
                        onChange={setBatchApplyHandlesToModule}
                      />
                    </div>

                    {mainModuleIndices.length > 1 && (
                      <div className="flex items-center justify-between gap-2 pt-1.5 border-t border-[#ECE7DD]">
                        <div>
                          <div className="text-[11px] font-semibold text-[#141413]">
                            Sahnedeki Tüm Dolaplara Uygula ({mainModuleIndices.length} Modül)
                          </div>
                          <div className="text-[9.5px] text-[#78716C]">
                            Tüm modüllerdeki kapak kulplarını tek seferde eşitler
                          </div>
                        </div>
                        <StudioToggleSwitch
                          size="sm"
                          testId="v11-toggle-batch-handle-project"
                          checked={batchApplyHandlesToAllModules}
                          onChange={(next) => {
                            setBatchApplyHandlesToAllModules(next);
                            if (next) setBatchApplyHandlesToModule(true);
                          }}
                        />
                      </div>
                    )}

                    {(activeModule.bays.length > 1 || mainModuleIndices.length > 1) && (
                      <button
                        type="button"
                        data-testid="v11-sync-current-handle-all-btn"
                        onClick={() => {
                          const curDoor = activeBay?.door;
                          if (!curDoor) return;
                          applyDoorPatchAcrossScope(
                            {
                              handleProfileId: curDoor.handleProfileId || "K019",
                              handleCategory: curDoor.handleCategory,
                              handleMaterialId: curDoor.handleMaterialId,
                              handleLengthMm: curDoor.handleLengthMm,
                              handleOrientation: curDoor.handleOrientation,
                            },
                            true,
                            batchApplyHandlesToAllModules || mainModuleIndices.length > 1
                          );
                        }}
                        className="w-full py-1.5 px-2.5 rounded-lg bg-[#141413] hover:bg-[#292524] text-white text-[10.5px] font-semibold transition cursor-pointer"
                      >
                        ✓ Seçili Kapağın Kulbunu {mainModuleIndices.length > 1 ? "Tüm Dolaplara" : "Diğer Kapaklara"} Eşitle
                      </button>
                    )}
                  </div>

                  {/* Seçili Açma / Kulp Sisteminin Büyük Teknik Kesit Önizlemesi */}
                  {(() => {
                    const activeProfileId = activeBay?.door?.handleProfileId || "hnd_bar_160";
                    const activeHp =
                      handleProfiles.find((h) => h.id === activeProfileId || h.sku === activeProfileId) ||
                      handleProfiles[0];
                    if (!activeHp) return null;
                    const activeMeta = getHandleCrossSectionMeta(
                      activeHp.id,
                      String(activeHp.category),
                      activeHp.name
                    );
                    return (
                      <div
                        data-testid="v11-active-handle-cross-section"
                        className="p-2.5 rounded-xl bg-white border border-[#DFD3BC] flex items-center gap-3 shadow-2xs"
                      >
                        <div className="rounded-lg bg-[#FAF8F4] border border-[#EAE3D5] p-1 flex items-center justify-center">
                          <HandleCrossSectionSvg
                            profileId={activeHp.id}
                            category={String(activeHp.category)}
                            size="lg"
                          />
                        </div>
                        <div className="min-w-0 flex-1 space-y-0.5">
                          <div className="text-[10px] font-bold uppercase tracking-wide text-[#8C6D46]">
                            Aktif Açma Kesiti
                          </div>
                          <div className="text-[11.5px] font-bold text-[#141413] leading-snug">
                            {activeMeta.shortTitle}
                          </div>
                          <div className="text-[10px] text-[#57534E] leading-snug">
                            {activeMeta.specLine}
                          </div>
                          <div className="text-[9.5px] text-[#78716C] leading-snug">
                            {activeMeta.surfaceNote}
                          </div>
                        </div>
                      </div>
                    );
                  })()}

                  {/* Hızlı Kulp Grubu Filtresi: Çekme Kulplar kaybolmadan en üstte tek tıkla filtrelenir */}
                  <div className="grid grid-cols-3 gap-1 p-1 rounded-xl bg-[#ECE7DD]/80">
                    {(
                      [
                        { id: "all", label: "Tümü" },
                        { id: "pull_handles", label: "Çekme Kulplar" },
                        { id: "gola_handleless", label: "Gola & Kulpsuz" },
                      ] as const
                    ).map((ft) => (
                      <button
                        key={ft.id}
                        type="button"
                        onClick={() => setHandleFilterTab(ft.id)}
                        className={`py-1.5 px-1.5 rounded-lg text-[10.5px] font-semibold transition cursor-pointer ${
                          handleFilterTab === ft.id
                            ? "bg-[#141413] text-white shadow-2xs"
                            : "text-[#57534E] hover:text-[#141413]"
                        }`}
                      >
                        {ft.label}
                      </button>
                    ))}
                  </div>

                  {(() => {
                    const cabZone = classifyCabinetPlacementZone(activeModule);
                    const zoneHint =
                      cabZone === "kitchen_wall" || cabZone === "kitchen_corner_wall"
                        ? "Üst Dolap Ergonomisi: Tezgâh altı L/C-Gola, dikey Gola ve 960 mm boy kulpları gizlendi; yalnızca alttan/yandan açılabilir uyumlu kulplar listelenir."
                        : cabZone === "kitchen_tall" || cabZone === "wardrobe"
                        ? "Boy Dolap & Gardırop Ergonomisi: Üst dolap Gola 268 ve tezgâh altı yatay L-Gola gizlendi; dikey Gola 1020 ve boy kulplar aktiftir."
                        : cabZone.startsWith("kitchen_")
                        ? "Alt Dolap Ergonomisi: Üst dolap Gola 268 ve 960 mm gardırop kulpu gizlendi; sahneye toplu uygulamada üst/boy dolaplar otomatik kendi Gola eşdeğerini alır."
                        : null;
                    return zoneHint ? (
                      <div className="px-2.5 py-1.5 rounded-xl bg-[#F5F2EA] border border-[#E5DFD3] text-[10px] text-[#57534E] leading-snug">
                        {zoneHint}
                      </div>
                    ) : null;
                  })()}

                  <div className="space-y-1.5 max-h-[360px] overflow-y-auto pr-0.5">
                    {handleProfiles
                      .filter((hp) => {
                        if (
                          !isHandleProfileCompatibleWithModuleBay(
                            hp.id,
                            hp.category,
                            activeModule,
                            safeBayIdx
                          )
                        ) {
                          return false;
                        }
                        if (handleFilterTab === "pull_handles") {
                          return (
                            hp.category !== "gola_profile" &&
                            hp.category !== "j_pull" &&
                            hp.category !== "handleless_plain"
                          );
                        }
                        if (handleFilterTab === "gola_handleless") {
                          return (
                            hp.category === "gola_profile" ||
                            hp.category === "j_pull" ||
                            hp.category === "handleless_plain"
                          );
                        }
                        return true;
                      })
                      .map((hp) => {
                      const active =
                        (activeBay?.door?.handleProfileId || "K019") === hp.id ||
                        (activeBay?.door?.handleProfileId || "") === hp.sku;
                      const rawMeta = getHandleCrossSectionMeta(hp.id, String(hp.category), hp.name);
                      const isUpperWallZone =
                        activeModule.category === "kitchen_wall" ||
                        activeModule.moduleFamilyId === "fam_kitchen_wall" ||
                        (activeModule.position?.y ?? 0) >= 1100;
                      const meta =
                        isUpperWallZone && hp.id === "hnd_j_pull"
                          ? {
                              ...rawMeta,
                              shortTitle: "Alt Kenar CNC J-Kulp (Üst Dolap)",
                              surfaceNote: "Üst dolap kapağının ALT kenarına CNC J-oyuk açılır; alttan tutularak açılır",
                            }
                          : isUpperWallZone && hp.id === "hnd_edge_profile"
                          ? {
                              ...rawMeta,
                              shortTitle: "Alt Kenar Geçme Alüminyum Kulp",
                              surfaceNote: "Üst dolap kapağının alt cumbasına geçme alüminyum tutamak",
                            }
                          : rawMeta;
                      return (
                        <button
                          key={hp.id}
                          type="button"
                          onClick={() =>
                            applyDoorPatchAcrossScope(
                              {
                                handleProfileId: hp.id,
                                handleCategory: hp.category,
                                crossSectionProfile:
                                  hp.category === "j_pull"
                                    ? "j_pull_bevel"
                                    : hp.id === "hnd_bevel_30_backing"
                                    ? "bevel_45"
                                    : "flat_slab",
                                openingTechnology:
                                  hp.category === "handleless_plain" ? "push_to_open" : "soft_close",
                                handleType:
                                  hp.category === "handleless_plain"
                                    ? "push_to_open"
                                    : hp.category === "gola_profile" || hp.category === "j_pull"
                                    ? "none"
                                    : hp.category === "recessed_grip"
                                    ? "integrated_profile"
                                    : "standard",
                              },
                              batchApplyHandlesToModule,
                              batchApplyHandlesToAllModules
                            )
                          }
                          className={`w-full p-2 rounded-xl border flex items-center gap-2.5 text-left transition cursor-pointer ${
                            active
                              ? "bg-[#141413] text-white border-[#141413]"
                              : "bg-[#F8F5EE] hover:bg-[#EFEAE0] border-[#E5DFD3] text-[#1C1917]"
                          }`}
                        >
                          <div
                            className={`rounded-lg p-1 border shrink-0 ${
                              active
                                ? "bg-[#1F1E1C] border-white/15"
                                : "bg-white border-[#E5DFD3]"
                            }`}
                          >
                            <HandleCrossSectionSvg
                              profileId={hp.id}
                              category={String(hp.category)}
                              active={active}
                              size="sm"
                            />
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="text-[11px] font-bold leading-snug">
                              {meta.shortTitle}
                            </div>
                            <div
                              className={`text-[9.5px] leading-snug mt-0.5 ${
                                active ? "text-stone-300" : "text-[#57534E]"
                              }`}
                            >
                              {meta.specLine}
                            </div>
                            <div
                              className={`text-[9px] leading-snug ${
                                active ? "text-stone-400" : "text-[#78716C]"
                              }`}
                            >
                              {meta.surfaceNote}
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </div>

                  {/* Kulp Metal Rengi / Yüzeyi */}
                  <div className="pt-2 border-t border-[#F0ECE3] space-y-1.5">
                    <div className="text-[10.5px] font-semibold text-[#57534E]">Kulp Rengi / Metal Yüzeyi</div>
                    <div className="grid grid-cols-4 gap-1">
                      {[
                        { id: "mat_handle_matte_black", label: "Mat Siyah", hex: "#1e293b" },
                        { id: "mat_handle_inox", label: "Inox", hex: "#cbd5e1" },
                        { id: "mat_handle_brass", label: "Pirinç", hex: "#d4af37" },
                        { id: "mat_handle_anthracite", label: "Antrasit", hex: "#374151" },
                      ].map((hm) => {
                        const curHm = activeBay?.door?.handleMaterialId || "mat_handle_matte_black";
                        const active = curHm === hm.id;
                        return (
                          <button
                            key={hm.id}
                            type="button"
                            onClick={() =>
                              applyDoorPatchAcrossScope(
                                { handleMaterialId: hm.id },
                                batchApplyHandlesToModule,
                                batchApplyHandlesToAllModules
                              )
                            }
                            className={`py-1.5 px-1.5 rounded-xl border text-[10px] font-semibold flex items-center justify-center gap-1 transition cursor-pointer ${
                              active
                                ? "bg-[#141413] text-white border-[#141413]"
                                : "bg-[#FAF8F4] hover:bg-[#F2EEE4] text-[#44403C] border-[#E5DFD3]"
                            }`}
                          >
                            <span
                              className="w-2.5 h-2.5 rounded-full border border-black/20 shrink-0"
                              style={{ backgroundColor: hm.hex }}
                            />
                            <span className="truncate">{hm.label}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}

              {!isSimple && (
                <div className="p-3.5 rounded-2xl bg-white border border-[#E5DFD3] space-y-3">
                  <div className="font-bold text-[#141413]">
                    Ön Kör Klapa ve Montaj Tıraş Payı
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <label className="space-y-1">
                      <span className="text-[10.5px] text-[#57534E]">Sol Kör Klapa (mm)</span>
                      <input
                        type="number" inputMode="decimal"
                        min={0}
                        max={250}
                        step={5}
                        value={activeBay?.door?.frontFillerLeftMm || 0}
                        onChange={(e) => {
                          const v = Math.max(0, Number(e.target.value) || 0);
                          const pos = activeBay?.door?.frontFillerPosition || "coplanar_front";
                          onSetBayV4DoorConfig(safeBayIdx, {
                            frontFillerLeftMm: v,
                            frontFillerPosition: pos,
                            hardwareProductId:
                              v > 0 && pos === "coplanar_front"
                                ? "hw_blum_79b9458"
                                : "hw_blum_71b3550",
                          });
                        }}
                        className="w-full h-8 px-2.5 rounded-xl bg-[#FAF8F4] border border-[#DED8CC] font-mono text-xs"
                      />
                    </label>
                    <label className="space-y-1">
                      <span className="text-[10.5px] text-[#57534E]">Sağ Kör Klapa (mm)</span>
                      <input
                        type="number" inputMode="decimal"
                        min={0}
                        max={250}
                        step={5}
                        value={activeBay?.door?.frontFillerRightMm || 0}
                        onChange={(e) => {
                          const v = Math.max(0, Number(e.target.value) || 0);
                          const pos = activeBay?.door?.frontFillerPosition || "coplanar_front";
                          onSetBayV4DoorConfig(safeBayIdx, {
                            frontFillerRightMm: v,
                            frontFillerPosition: pos,
                          });
                        }}
                        className="w-full h-8 px-2.5 rounded-xl bg-[#FAF8F4] border border-[#DED8CC] font-mono text-xs"
                      />
                    </label>
                  </div>

                  {((activeBay?.door?.frontFillerLeftMm || 0) > 0 ||
                    (activeBay?.door?.frontFillerRightMm || 0) > 0) && (
                    <div className="grid grid-cols-2 gap-1.5">
                      <button
                        type="button"
                        onClick={() =>
                          onSetBayV4DoorConfig(safeBayIdx, {
                            frontFillerPosition: "coplanar_front",
                            hardwareProductId: "hw_blum_79b9458",
                          })
                        }
                        className={`py-1.5 px-2 rounded-xl text-[10.5px] font-semibold cursor-pointer ${
                          (activeBay?.door?.frontFillerPosition || "coplanar_front") ===
                          "coplanar_front"
                            ? "bg-[#141413] text-white"
                            : "bg-[#F5F2EA] text-[#44403C]"
                        }`}
                      >
                        Eş-Düzlem (95° Menteşe)
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          onSetBayV4DoorConfig(safeBayIdx, {
                            frontFillerPosition: "recessed_inner",
                            hardwareProductId: "hw_blum_71b3550",
                          })
                        }
                        className={`py-1.5 px-2 rounded-xl text-[10.5px] font-semibold cursor-pointer ${
                          activeBay?.door?.frontFillerPosition === "recessed_inner"
                            ? "bg-[#141413] text-white"
                            : "bg-[#F5F2EA] text-[#44403C]"
                        }`}
                      >
                        İçerlek (110° Menteşe)
                      </button>
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-2 pt-2 border-t border-[#F0ECE3]">
                    <label className="space-y-1">
                      <span className="text-[10.5px] text-[#57534E]">Sol Duvar Tıraş Payı (mm)</span>
                      <input
                        type="number" inputMode="decimal"
                        min={0}
                        max={80}
                        step={5}
                        value={activeModule.carcass.scribeAllowanceLeftMm || 0}
                        onChange={(e) =>
                          onUpdateCarcassConfig({
                            scribeAllowanceLeftMm: Math.max(0, Number(e.target.value) || 0),
                          })
                        }
                        className="w-full h-8 px-2.5 rounded-xl bg-[#FAF8F4] border border-[#DED8CC] font-mono text-xs"
                      />
                    </label>
                    <label className="space-y-1">
                      <span className="text-[10.5px] text-[#57534E]">Sağ Duvar Tıraş Payı (mm)</span>
                      <input
                        type="number" inputMode="decimal"
                        min={0}
                        max={80}
                        step={5}
                        value={activeModule.carcass.scribeAllowanceRightMm || 0}
                        onChange={(e) =>
                          onUpdateCarcassConfig({
                            scribeAllowanceRightMm: Math.max(0, Number(e.target.value) || 0),
                          })
                        }
                        className="w-full h-8 px-2.5 rounded-xl bg-[#FAF8F4] border border-[#DED8CC] font-mono text-xs"
                      />
                    </label>
                  </div>
                </div>
              )}
            </>
          )}
    </>
  );
};
