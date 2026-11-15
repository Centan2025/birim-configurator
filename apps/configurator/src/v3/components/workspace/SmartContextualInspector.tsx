"use client";

import React, { useMemo, useState } from "react";
import {
  type DoorConfig,
  type DrawerConfig,
  type MaterialDefinition,
  type ModuleInstance,
  evaluateHardwareCompatibilityWithAlternatives,
  resolveKlapaAndHingeBehavior,
} from "@birim/core";
import type { UserExperienceTier } from "../../../store/useConfiguratorStore";
import { AlertTriangle, ChevronDown, ChevronRight, Wrench } from "lucide-react";

export interface SmartContextualInspectorProps {
  activeModule: ModuleInstance;
  activeBayIndex: number;
  selectedComponentId: string | null;
  experienceTier: UserExperienceTier;
  bayWidths: number[];
  materials: MaterialDefinition[];
  doorOpenAngleDeg: number;
  drawerOpenMm: number;
  projectMaterialPalette?: {
    doorMaterialIds: string[];
    bodyMaterialIds: string[];
  };
  onSelectComponent: (id: string | null) => void;
  onSelectBay: (bayIdx: number) => void;
  onSetDimensions: (w: number, h: number, d: number) => void;
  onSetMaterials: (bodyMatId: string, doorMatId: string) => void;
  onUpdateCarcass: (patch: Partial<ModuleInstance["carcass"]>) => void;
  onUpdateDoor: (bayIdx: number, patch: Partial<DoorConfig>) => void;
  onUpdateDrawer: (bayIdx: number, drawerId: string, patch: Partial<DrawerConfig>) => void;
  onSplitBay: (bayIdx: number) => void;
  onAddShelf: (bayIdx: number) => void;
  onAddDrawer: (bayIdx: number) => void;
  onSetDrawerOpenMm: (mm: number) => void;
  onToggleDoorOpen: () => void;
}

export const SmartContextualInspector: React.FC<SmartContextualInspectorProps> = React.memo(
  ({
    activeModule,
    activeBayIndex,
    experienceTier,
    bayWidths,
    onSetDimensions,
    onUpdateCarcass,
    onUpdateDoor,
    onUpdateDrawer,
  }) => {
    const [openJoineryDetails, setOpenJoineryDetails] = useState(false);

    const bay = activeModule.bays[activeBayIndex] || activeModule.bays[0];
    const bayW = bayWidths[activeBayIndex] || bayWidths[0] || 450;
    const selectedDrawer = bay?.drawers?.[0] || null;

    const compatibilityAdvices = useMemo(
      () => evaluateHardwareCompatibilityWithAlternatives(activeModule, activeBayIndex),
      [activeModule, activeBayIndex]
    );

    const actionableAdvices = useMemo(
      () => compatibilityAdvices.filter((a) => a.severity === "error" || a.severity === "warning"),
      [compatibilityAdvices]
    );

    const klapaResolution = useMemo(
      () =>
        resolveKlapaAndHingeBehavior(
          bay?.door,
          bayW,
          Boolean(bay?.drawers?.some((d) => d.isInternal && !d.isHidden))
        ),
      [bay, bayW]
    );

    const handleApplyAlternative = (
      target: "door" | "drawer" | "carcass",
      field: string,
      value: string | number | boolean
    ) => {
      if (target === "door") {
        onUpdateDoor(activeBayIndex, { [field]: value } as Partial<DoorConfig>);
      } else if (target === "drawer" && selectedDrawer) {
        onUpdateDrawer(activeBayIndex, selectedDrawer.id, { [field]: value } as Partial<DrawerConfig>);
      } else if (target === "carcass") {
        if (field === "depth" && typeof value === "number") {
          onSetDimensions(activeModule.dimensions.width, activeModule.dimensions.height, value);
        } else {
          onUpdateCarcass({ [field]: value } as Partial<ModuleInstance["carcass"]>);
        }
      }
    };

    const isSimple = experienceTier === "simple";
    if (isSimple && actionableAdvices.length === 0) {
      return null;
    }

    const hasActiveJoineryCustomizations = Boolean(
      (bay?.door?.frontFillerLeftMm || 0) > 0 ||
        (bay?.door?.frontFillerRightMm || 0) > 0 ||
        activeModule.carcass.exposedLeftSideUseDoorMaterial ||
        activeModule.carcass.exposedRightSideUseDoorMaterial ||
        (activeModule.carcass.scribeAllowanceLeftMm || 0) > 0 ||
        (activeModule.carcass.scribeAllowanceRightMm || 0) > 0
    );

    return (
      <div data-testid="smart-contextual-inspector" className="space-y-2 text-xs text-[#141413]">
        {actionableAdvices.map((adv) => (
          <div
            key={adv.code}
            className="p-3 rounded-2xl bg-amber-50/95 border border-amber-300/80 space-y-2 shadow-2xs"
          >
            <div className="flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <div className="space-y-0.5">
                <div className="font-bold text-[11.5px] text-amber-950">{adv.titleTr}</div>
                <div className="text-[11px] text-amber-900/90 leading-snug">{adv.reasonTr}</div>
              </div>
            </div>
            {adv.alternatives.length > 0 && (
              <div className="flex flex-wrap gap-1.5 pt-0.5">
                {adv.alternatives.map((alt) => (
                  <button
                    key={alt.id}
                    type="button"
                    onClick={() => handleApplyAlternative(alt.applyTarget, alt.field, alt.value)}
                    className="px-2.5 py-1 rounded-xl bg-[#141413] hover:bg-[#292524] text-white text-[10.5px] font-semibold cursor-pointer transition"
                  >
                    ✓ {alt.labelTr}
                  </button>
                ))}
              </div>
            )}
          </div>
        ))}

        {!isSimple && bay?.door && (
          <div className="rounded-[20px] birim-ice-card overflow-hidden">
            <button
              type="button"
              data-testid="toggle-joinery-klapa-accordion"
              onClick={() => setOpenJoineryDetails((p) => !p)}
              className="w-full px-3.5 py-2.5 flex items-center justify-between gap-2 text-left cursor-pointer hover:bg-white/35 transition"
            >
              <span className="inline-flex items-center gap-1.5 font-bold text-[11px] text-[#141413]">
                <Wrench className="w-3.5 h-3.5 text-[#8C7A6B]" />
                <span>Klapa, Görünen Yan &amp; Duvar Payı</span>
                {hasActiveJoineryCustomizations && (
                  <span className="px-1.5 py-0.5 rounded-full bg-emerald-700 text-white text-[9px] font-bold">
                    Aktif
                  </span>
                )}
              </span>
              {openJoineryDetails ? (
                <ChevronDown className="w-3.5 h-3.5 text-[#57534E]" />
              ) : (
                <ChevronRight className="w-3.5 h-3.5 text-[#57534E]" />
              )}
            </button>

            {openJoineryDetails && (
              <div className="px-3.5 pb-3.5 pt-1 space-y-3 border-t border-white/50">
                <div className="space-y-1.5">
                  <div className="text-[10.5px] font-bold text-[#57534E]">
                    Ön Kör Klapa (Bölme {activeBayIndex + 1})
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <label className="space-y-0.5">
                      <span className="text-[10px] text-[#57534E] block">Sol Klapa (mm)</span>
                      <input
                        type="number"
                        min={0}
                        max={250}
                        step={5}
                        value={bay.door.frontFillerLeftMm || 0}
                        onChange={(e) =>
                          onUpdateDoor(activeBayIndex, {
                            frontFillerLeftMm: Math.max(0, Number(e.target.value) || 0),
                          })
                        }
                        className="w-full h-7 px-2 rounded-lg bg-white border border-[#DED8CC] font-mono font-bold text-[11px]"
                      />
                    </label>
                    <label className="space-y-0.5">
                      <span className="text-[10px] text-[#57534E] block">Sağ Klapa (mm)</span>
                      <input
                        type="number"
                        min={0}
                        max={250}
                        step={5}
                        value={bay.door.frontFillerRightMm || 0}
                        onChange={(e) =>
                          onUpdateDoor(activeBayIndex, {
                            frontFillerRightMm: Math.max(0, Number(e.target.value) || 0),
                          })
                        }
                        className="w-full h-7 px-2 rounded-lg bg-white border border-[#DED8CC] font-mono font-bold text-[11px]"
                      />
                    </label>
                  </div>

                  {((bay.door.frontFillerLeftMm || 0) > 0 || (bay.door.frontFillerRightMm || 0) > 0) && (
                    <div className="space-y-1.5 pt-1">
                      <div className="grid grid-cols-2 gap-1">
                        <button
                          type="button"
                          onClick={() => onUpdateDoor(activeBayIndex, { frontFillerPosition: "coplanar_front" })}
                          className={`py-1 px-2 rounded-lg text-[10px] font-semibold cursor-pointer ${
                            (bay.door.frontFillerPosition || "coplanar_front") === "coplanar_front"
                              ? "bg-[#141413] text-white"
                              : "bg-white/80 text-[#44403C]"
                          }`}
                        >
                          Dış Eş-Düzlem (95°)
                        </button>
                        <button
                          type="button"
                          onClick={() => onUpdateDoor(activeBayIndex, { frontFillerPosition: "recessed_inner" })}
                          className={`py-1 px-2 rounded-lg text-[10px] font-semibold cursor-pointer ${
                            bay.door.frontFillerPosition === "recessed_inner"
                              ? "bg-[#141413] text-white"
                              : "bg-white/80 text-[#44403C]"
                          }`}
                        >
                          İçerlek Kayıt (110°)
                        </button>
                      </div>
                      <div className="p-2 rounded-lg bg-white/70 text-[10px] text-[#44403C] leading-snug">
                        Net kapak: <strong>{klapaResolution.effectiveDoorSpanMm} mm</strong> •{" "}
                        {klapaResolution.hingeLabelTr}
                      </div>
                    </div>
                  )}
                </div>

                <div className="space-y-1.5 pt-2 border-t border-white/50">
                  <div className="text-[10.5px] font-bold text-[#57534E]">
                    Görünen Yan Dikme (Kapak Malzemesinden)
                  </div>
                  <div className="grid grid-cols-2 gap-1.5">
                    <button
                      type="button"
                      onClick={() =>
                        onUpdateCarcass({
                          exposedLeftSideUseDoorMaterial: !activeModule.carcass.exposedLeftSideUseDoorMaterial,
                        })
                      }
                      className={`py-1.5 px-2 rounded-lg text-[10.5px] font-semibold cursor-pointer transition ${
                        activeModule.carcass.exposedLeftSideUseDoorMaterial
                          ? "bg-[#141413] text-white"
                          : "bg-white/80 text-[#44403C]"
                      }`}
                    >
                      Sol Yan: {activeModule.carcass.exposedLeftSideUseDoorMaterial ? "Kapak Malz." : "Gövde"}
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        onUpdateCarcass({
                          exposedRightSideUseDoorMaterial: !activeModule.carcass.exposedRightSideUseDoorMaterial,
                        })
                      }
                      className={`py-1.5 px-2 rounded-lg text-[10.5px] font-semibold cursor-pointer transition ${
                        activeModule.carcass.exposedRightSideUseDoorMaterial
                          ? "bg-[#141413] text-white"
                          : "bg-white/80 text-[#44403C]"
                      }`}
                    >
                      Sağ Yan: {activeModule.carcass.exposedRightSideUseDoorMaterial ? "Kapak Malz." : "Gövde"}
                    </button>
                  </div>
                </div>

                <div className="space-y-1.5 pt-2 border-t border-white/50">
                  <div className="text-[10.5px] font-bold text-[#57534E]">
                    Duvar Tıraş Payı (Kesim Listesine Eklenir)
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <label className="space-y-0.5">
                      <span className="text-[10px] text-[#57534E] block">Sol Pay (mm)</span>
                      <input
                        type="number"
                        min={0}
                        max={80}
                        step={5}
                        value={activeModule.carcass.scribeAllowanceLeftMm || 0}
                        onChange={(e) =>
                          onUpdateCarcass({
                            scribeAllowanceLeftMm: Math.max(0, Number(e.target.value) || 0),
                          })
                        }
                        className="w-full h-7 px-2 rounded-lg bg-white border border-[#DED8CC] font-mono font-bold text-[11px]"
                      />
                    </label>
                    <label className="space-y-0.5">
                      <span className="text-[10px] text-[#57534E] block">Sağ Pay (mm)</span>
                      <input
                        type="number"
                        min={0}
                        max={80}
                        step={5}
                        value={activeModule.carcass.scribeAllowanceRightMm || 0}
                        onChange={(e) =>
                          onUpdateCarcass({
                            scribeAllowanceRightMm: Math.max(0, Number(e.target.value) || 0),
                          })
                        }
                        className="w-full h-7 px-2 rounded-lg bg-white border border-[#DED8CC] font-mono font-bold text-[11px]"
                      />
                    </label>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    );
  }
);
SmartContextualInspector.displayName = "SmartContextualInspector";
