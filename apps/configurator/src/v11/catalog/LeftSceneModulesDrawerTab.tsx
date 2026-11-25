"use client";
import React from "react";
import { Plus, Copy, Trash2, ArrowUpFromLine, Maximize2, RotateCw, Armchair } from "lucide-react";
import type { ModuleInstance, SceneObjectInstance } from "@birim/core";
import type { V11LeftDrawerTab } from "../v11Constants";

export interface LeftSceneModulesDrawerTabProps {
  activeModuleIndex: number;
  fmtLen: (mm: number, withUnit?: boolean) => string;
  mainModules: Array<{ mod: ModuleInstance; idx: number }>;
  modules: ModuleInstance[];
  onAddStackedTopModule: () => void;
  onChangeDrawer: (tab: V11LeftDrawerTab) => void;
  onDuplicateActiveModule: () => void;
  onFillRemainingWallGap: () => void;
  onOpenCapsuleAndGlbHub: (tab: "modules" | "capsule_curved" | "custom_glb" | "automation") => void;
  onOpenWizardModal: () => void;
  onRemoveModuleAt: (idx: number) => void;
  onRemoveSceneObject: (id: string) => void;
  onRotateSceneObject: (id: string) => void;
  onSelectModuleIndex: (idx: number) => void;
  remainingWallGapMm: number;
  renderedDrawer: V11LeftDrawerTab;
  sceneObjects: SceneObjectInstance[];
}

export const LeftSceneModulesDrawerTab: React.FC<LeftSceneModulesDrawerTabProps> = (props) => {
  const {
    activeModuleIndex,
    fmtLen,
    mainModules,
    modules,
    onAddStackedTopModule,
    onChangeDrawer,
    onDuplicateActiveModule,
    onFillRemainingWallGap,
    onOpenCapsuleAndGlbHub,
    onOpenWizardModal,
    onRemoveModuleAt,
    onRemoveSceneObject,
    onRotateSceneObject,
    onSelectModuleIndex,
    remainingWallGapMm,
    renderedDrawer,
    sceneObjects,
  } = props;
  return (
    <>
            {/* SEKME 2: SAHNEDEKİ MODÜLLER & EŞYALAR */}
            {renderedDrawer === "modules" && (
              <div className="flex-1 overflow-y-auto p-4 space-y-3">
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={onDuplicateActiveModule}
                    className="h-10 px-3 rounded-2xl bg-white hover:bg-[#EFECE4] border border-[#DED8CC] text-xs font-semibold flex items-center justify-center gap-1.5 transition cursor-pointer"
                  >
                    <Copy className="w-3.5 h-3.5 text-[#57534E]" />
                    <span>Yanına Kopyala</span>
                  </button>
                  <button
                    type="button"
                    onClick={onAddStackedTopModule}
                    className="h-10 px-3 rounded-2xl bg-white hover:bg-[#EFECE4] border border-[#DED8CC] text-xs font-semibold flex items-center justify-center gap-1.5 transition cursor-pointer"
                  >
                    <ArrowUpFromLine className="w-3.5 h-3.5 text-[#57534E]" />
                    <span>Üst Yüklük Ekle</span>
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-1.5">
                  <button
                    type="button"
                    onClick={() => {
                      onChangeDrawer(null);
                      onOpenWizardModal();
                    }}
                    className="py-2 px-2.5 rounded-xl bg-[#141413] hover:bg-[#292524] text-white text-[11px] font-semibold flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Yeni Modül / Sihirbaz</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      onChangeDrawer(null);
                      onOpenCapsuleAndGlbHub("automation");
                    }}
                    className="py-2 px-2.5 rounded-xl bg-white hover:bg-[#F5F2EA] border border-[#DED8CC] text-[#141413] text-[11px] font-semibold flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <span>Oda Planı / LiDAR Yükle</span>
                  </button>
                </div>

                {remainingWallGapMm >= 350 && (
                  <button
                    type="button"
                    onClick={onFillRemainingWallGap}
                    className="w-full py-2.5 px-3.5 rounded-2xl bg-[#141413] hover:bg-[#292524] text-white text-xs font-semibold flex items-center justify-between transition cursor-pointer"
                  >
                    <span className="flex items-center gap-2">
                      <Maximize2 className="w-3.5 h-3.5 text-[#7DD3FC]" />
                      <span>Kalan Boşluğu Dolapla Tamamla</span>
                    </span>
                    <span className="px-2 py-0.5 rounded-full bg-white/15 font-mono text-[11px]">
                      +{fmtLen(remainingWallGapMm)}
                    </span>
                  </button>
                )}

                <div className="space-y-2 pt-1">
                  <div className="text-[11px] font-bold text-[#78716C]">
                    Dolap & Modüller ({mainModules.length})
                  </div>
                  {mainModules.map(({ mod, idx }, order) => {
                    const isSelected = idx === activeModuleIndex;
                    return (
                      <div
                        key={mod.id}
                        onClick={() => onSelectModuleIndex(idx)}
                        className={`p-3 rounded-2xl border flex items-center justify-between gap-2.5 transition cursor-pointer ${
                          isSelected
                            ? "bg-[#141413] text-white border-[#141413] shadow-sm"
                            : "bg-white hover:bg-[#F5F2EA] text-[#141413] border-[#E5DFD3]"
                        }`}
                      >
                        <div className="min-w-0">
                          <div className="text-xs font-bold truncate">
                            {order + 1}. {mod.name}
                          </div>
                          <div
                            className={`text-[11px] font-mono mt-0.5 ${
                              isSelected ? "text-[#7DD3FC]" : "text-[#78716C]"
                            }`}
                          >
                            {fmtLen(mod.dimensions.width, false)} × {fmtLen(mod.dimensions.height, false)} × {fmtLen(mod.dimensions.depth)} • {mod.bays.length} Bölme
                          </div>
                        </div>
                        {mainModules.length > 1 && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              onRemoveModuleAt(idx);
                            }}
                            title="Bu modülü sil"
                            className={`w-8 h-8 rounded-full flex items-center justify-center transition cursor-pointer ${
                              isSelected
                                ? "hover:bg-white/15 text-stone-300 hover:text-white"
                                : "hover:bg-red-50 text-[#78716C] hover:text-red-600"
                            }`}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>

                {modules.some((m) => m.category === "complementary") && (
                  <div className="space-y-1.5 pt-2 border-t border-[#E6E1D6]">
                    <div className="text-[11px] font-bold text-[#78716C]">
                      Kör Paneller &amp; Tamamlayıcı Parçalar ({modules.filter((m) => m.category === "complementary").length})
                    </div>
                    {modules.map((mod, idx) => {
                      if (mod.category !== "complementary") return null;
                      const isSelected = idx === activeModuleIndex;
                      return (
                        <div
                          key={mod.id}
                          onClick={() => onSelectModuleIndex(idx)}
                          className={`p-2.5 rounded-2xl border flex items-center justify-between gap-2 transition cursor-pointer ${
                            isSelected
                              ? "bg-[#141413] text-white border-[#141413]"
                              : "bg-white hover:bg-[#F5F2EA] text-[#141413] border-[#E5DFD3]"
                          }`}
                        >
                          <div className="min-w-0">
                            <div className="text-xs font-bold truncate">{mod.name}</div>
                            <div className={`text-[10.5px] font-mono ${isSelected ? "text-[#7DD3FC]" : "text-[#78716C]"}`}>
                              {fmtLen(mod.dimensions.width, false)} × {fmtLen(mod.dimensions.height, false)} × {fmtLen(mod.dimensions.depth)}
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              onRemoveModuleAt(idx);
                            }}
                            title="Bu kör paneli / tamamlayıcı parçayı sil"
                            className={`w-7 h-7 rounded-full flex items-center justify-center transition cursor-pointer ${
                              isSelected
                                ? "hover:bg-white/15 text-stone-300 hover:text-white"
                                : "hover:bg-red-50 text-[#78716C] hover:text-red-600"
                            }`}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}

                {sceneObjects.length > 0 && (
                  <div className="space-y-2 pt-2 border-t border-[#E6E1D6]">
                    <div className="text-[11px] font-bold text-[#78716C] flex items-center gap-1.5">
                      <Armchair className="w-3.5 h-3.5" />
                      <span>Sahnedeki Masalar, Cihazlar ve Eşyalar ({sceneObjects.length})</span>
                    </div>
                    {sceneObjects.map((so) => (
                      <div
                        key={so.id}
                        className="p-2.5 rounded-2xl bg-white border border-[#E5DFD3] flex items-center justify-between gap-2 text-xs"
                      >
                        <div className="min-w-0">
                          <div className="font-semibold truncate">{so.name}</div>
                          <div className="text-[10.5px] font-mono text-[#78716C]">
                            {fmtLen(so.dimensions.width, false)}×{fmtLen(so.dimensions.depth)}
                          </div>
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            type="button"
                            onClick={() => onRotateSceneObject(so.id)}
                            title="90° Döndür"
                            className="w-7 h-7 rounded-full hover:bg-[#EFECE4] flex items-center justify-center cursor-pointer"
                          >
                            <RotateCw className="w-3.5 h-3.5 text-[#57534E]" />
                          </button>
                          <button
                            type="button"
                            onClick={() => onRemoveSceneObject(so.id)}
                            title="Sahne eşyasını kaldır"
                            className="w-7 h-7 rounded-full hover:bg-red-50 text-[#78716C] hover:text-red-600 flex items-center justify-center cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
    </>
  );
};
