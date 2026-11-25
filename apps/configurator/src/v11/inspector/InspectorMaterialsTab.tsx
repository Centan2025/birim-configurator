"use client";
import React from "react";
import { Check } from "lucide-react";
import type { MaterialDefinition, ModuleInstance } from "@birim/core";
import { V11_MATERIAL_GROUPS, type V11InspectorTab, type V11MaterialGroup } from "../v11Constants";
import type { RightParametricInspectorProps } from "../RightParametricInspector";
import { startLiveMaterialDrag } from "./inspectorLiveDrag";
import { StudioToggleSwitch } from "./InspectorControls";

export interface InspectorMaterialsTabProps {
  activeMatId: string;
  activeModule: ModuleInstance;
  activeTab: V11InspectorTab;
  customMatOpen: boolean;
  materialGroup: V11MaterialGroup["id"];
  materialSearch: string;
  materialTarget: "doors" | "carcass" | "all_module";
  newMatCat: "laminate" | "lacquer" | "wood" | "stone";
  newMatGrain: boolean;
  newMatHex: string;
  newMatName: string;
  onAddCustomMaterial: RightParametricInspectorProps["onAddCustomMaterial"];
  onApplyMaterialScope: RightParametricInspectorProps["onApplyMaterialScope"];
  onUpdateCarcassConfig: RightParametricInspectorProps["onUpdateCarcassConfig"];
  setCustomMatOpen: React.Dispatch<React.SetStateAction<boolean>>;
  setMaterialGroup: React.Dispatch<React.SetStateAction<V11MaterialGroup["id"]>>;
  setMaterialSearch: React.Dispatch<React.SetStateAction<string>>;
  setMaterialTarget: React.Dispatch<React.SetStateAction<"doors" | "carcass" | "all_module">>;
  setNewMatCat: React.Dispatch<React.SetStateAction<"laminate" | "lacquer" | "wood" | "stone">>;
  setNewMatGrain: React.Dispatch<React.SetStateAction<boolean>>;
  setNewMatHex: React.Dispatch<React.SetStateAction<string>>;
  setNewMatName: React.Dispatch<React.SetStateAction<string>>;
  visibleMaterials: MaterialDefinition[];
}

export const InspectorMaterialsTab: React.FC<InspectorMaterialsTabProps> = (props) => {
  const {
    activeMatId,
    activeModule,
    activeTab,
    customMatOpen,
    materialGroup,
    materialSearch,
    materialTarget,
    newMatCat,
    newMatGrain,
    newMatHex,
    newMatName,
    onAddCustomMaterial,
    onApplyMaterialScope,
    onUpdateCarcassConfig,
    setCustomMatOpen,
    setMaterialGroup,
    setMaterialSearch,
    setMaterialTarget,
    setNewMatCat,
    setNewMatGrain,
    setNewMatHex,
    setNewMatName,
    visibleMaterials,
  } = props;
  return (
    <>
          {/* ==================== SEKME 4: YÜZEY, ÖZEL RENK & I�?IK ==================== */}
          {activeTab === "materials" && (
            <>
              <div className="p-3.5 rounded-2xl bg-white border border-[#E5DFD3] space-y-3">
                <div className="grid grid-cols-3 gap-1 p-1 rounded-xl bg-[#ECE7DD]/80">
                  {(
                    [
                      { id: "doors", label: "Kapaklar" },
                      { id: "carcass", label: "İç Gövde" },
                      { id: "all_module", label: "Tüm Dolap" },
                    ] as const
                  ).map((sc) => (
                    <button
                      key={sc.id}
                      type="button"
                      onClick={() => setMaterialTarget(sc.id)}
                      className={`py-1.5 rounded-lg text-[11px] font-semibold transition cursor-pointer ${
                        materialTarget === sc.id
                          ? "bg-[#141413] text-white"
                          : "text-[#57534E] hover:text-[#141413]"
                      }`}
                    >
                      {sc.label}
                    </button>
                  ))}
                </div>

                <div className="space-y-2 pt-1.5 border-t border-[#F0ECE3]">
                  <div>
                    <div className="font-semibold text-[#141413] text-[11.5px]">
                      Görünen Yanlar Kapak Rengi Olsun
                    </div>
                    <div className="text-[10px] text-[#78716C]">
                      Ek panel eklemeden yan dikmeleri kapak malzemesiyle üretir
                    </div>
                  </div>
                  <div className="flex items-center justify-between gap-3 pt-0.5">
                    <StudioToggleSwitch
                      size="sm"
                      label="Sol Yan Dikme"
                      checked={Boolean(activeModule.carcass.exposedLeftSideUseDoorMaterial)}
                      onChange={(next) =>
                        onUpdateCarcassConfig({ exposedLeftSideUseDoorMaterial: next })
                      }
                    />
                    <StudioToggleSwitch
                      size="sm"
                      label="Sağ Yan Dikme"
                      checked={Boolean(activeModule.carcass.exposedRightSideUseDoorMaterial)}
                      onChange={(next) =>
                        onUpdateCarcassConfig({ exposedRightSideUseDoorMaterial: next })
                      }
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-2.5">
                <div className="flex items-center justify-between gap-1 flex-wrap">
                  <div className="flex flex-wrap gap-1">
                    {V11_MATERIAL_GROUPS.map((mg) => (
                      <button
                        key={mg.id}
                        type="button"
                        onClick={() => setMaterialGroup(mg.id)}
                        className={`px-2.5 py-1 rounded-full text-[11px] font-semibold transition cursor-pointer ${
                          materialGroup === mg.id
                            ? "bg-[#141413] text-white"
                            : "bg-white border border-[#E5DFD3] text-[#57534E]"
                        }`}
                      >
                        {mg.label}
                      </button>
                    ))}
                  </div>
                  <button
                    type="button"
                    onClick={() => setCustomMatOpen((v) => !v)}
                    className="text-[11px] font-semibold text-[#8C7A6B] hover:text-[#141413] cursor-pointer"
                  >
                    + Özel Renk
                  </button>
                </div>

                {/* Hızlı Marka / Dekor Kodu Arama */}
                <div className="relative">
                  <input
                    type="text"
                    value={materialSearch}
                    onChange={(e) => setMaterialSearch(e.target.value)}
                    placeholder={`Ara (${visibleMaterials.length} kartela): Kaşmir, Meşe, AGT, Kastamonu, Yıldız, Egger...`}
                    className="w-full h-8 px-3 pr-7 rounded-xl bg-white border border-[#DED8CC] text-[11px] text-[#141413] placeholder:text-[#A8A29E] focus:outline-none focus:border-[#141413]"
                  />
                  {materialSearch && (
                    <button
                      type="button"
                      onClick={() => setMaterialSearch("")}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[11px] text-[#78716C] hover:text-[#141413] cursor-pointer"
                    >
                      ✕
                    </button>
                  )}
                </div>

                {customMatOpen && (
                  <div className="p-3 rounded-2xl bg-white border border-[#DED8CC] space-y-2">
                    <div className="font-bold text-[11.5px]">Özel RAL / MDFLam Kartela Rengi Ekle</div>
                    <div className="flex items-center gap-2">
                      <input
                        type="color"
                        value={newMatHex}
                        onChange={(e) => setNewMatHex(e.target.value)}
                        className="w-9 h-9 rounded-lg border border-[#DED8CC] cursor-pointer shrink-0"
                      />
                      <input
                        type="text"
                        value={newMatName}
                        onChange={(e) => setNewMatName(e.target.value)}
                        placeholder="Örn: Kastamonu D218 Kaşmir / RAL 7044"
                        className="flex-1 h-9 px-2.5 rounded-xl bg-[#FAF8F4] border border-[#DED8CC] text-xs"
                      />
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex gap-1 flex-wrap">
                        {(
                          [
                            { id: "laminate", label: "MDFLam" },
                            { id: "lacquer", label: "Supramat/Lake" },
                            { id: "wood", label: "Ahşap" },
                            { id: "stone", label: "Taş" },
                          ] as const
                        ).map((c) => (
                          <button
                            key={c.id}
                            type="button"
                            onClick={() => {
                              setNewMatCat(c.id);
                              if (c.id === "wood") setNewMatGrain(true);
                            }}
                            className={`px-2 py-1 rounded-lg text-[10.5px] font-semibold cursor-pointer ${
                              newMatCat === c.id
                                ? "bg-[#141413] text-white"
                                : "bg-[#F5F2EA] text-[#44403C]"
                            }`}
                          >
                            {c.label}
                          </button>
                        ))}
                      </div>
                      <StudioToggleSwitch
                        size="sm"
                        label="Damarlı"
                        checked={newMatGrain || newMatCat === "wood"}
                        onChange={setNewMatGrain}
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        if (!newMatName.trim()) return;
                        onAddCustomMaterial({
                          name: newMatName.trim(),
                          category: newMatCat,
                          colorHex: newMatHex,
                          roughness: newMatCat === "lacquer" ? 0.28 : 0.5,
                          costPerM2: newMatCat === "laminate" ? 30 : 48,
                          hasGrain: newMatGrain || newMatCat === "wood",
                        });
                        setNewMatName("");
                        setCustomMatOpen(false);
                      }}
                      className="w-full py-1.5 rounded-full bg-[#141413] text-white text-[11px] font-semibold cursor-pointer"
                    >
                      Kartelaya Ekle
                    </button>
                  </div>
                )}

                <div className="grid grid-cols-3 gap-2">
                  {visibleMaterials.map((mat) => {
                    const isSelected = activeMatId === mat.id;
                    return (
                      <button
                        key={mat.id}
                        type="button"
                        draggable={false}
                        onPointerDown={(e) =>
                          startLiveMaterialDrag(e, mat, () =>
                            onApplyMaterialScope(materialTarget, mat.id)
                          )
                        }
                        onKeyDown={(ke) => {
                          if (ke.key === "Enter" || ke.key === " ") {
                            ke.preventDefault();
                            onApplyMaterialScope(materialTarget, mat.id);
                          }
                        }}
                        title={`${mat.name} — Tıkla veya sürükleyip objeye bırak`}
                        className={`p-2 rounded-2xl border text-left transition cursor-grab active:cursor-grabbing flex flex-col justify-between ${
                          isSelected
                            ? "bg-white border-[#141413] ring-2 ring-[#141413]/15"
                            : "bg-white/85 hover:bg-white border-[#E5DFD3]"
                        }`}
                      >
                        <div>
                          <div
                            className="w-full h-[70px] rounded-xl border border-white/20 relative mb-1.5 shadow-inner overflow-hidden"
                            style={{
                              backgroundColor: mat.colorHex,
                              backgroundImage: mat.hasGrain
                                ? "repeating-linear-gradient(90deg, rgba(255,255,255,0.09) 0px, rgba(0,0,0,0.08) 3px, transparent 8px)"
                                : (mat.roughness ?? 0.45) <= 0.14
                                ? "linear-gradient(135deg, rgba(255,255,255,0.42) 0%, transparent 48%, rgba(0,0,0,0.08) 100%)"
                                : undefined,
                            }}
                          >
                            {mat.decorCode && (
                              <span className="absolute bottom-1 left-1 px-1.5 py-0.2 rounded bg-black/55 backdrop-blur-xs text-white font-mono text-[8.5px] font-bold">
                                {mat.decorCode}
                              </span>
                            )}
                            {isSelected && (
                              <span className="absolute top-1.5 right-1.5 w-4 h-4 rounded-full bg-[#141413] text-white flex items-center justify-center">
                                <Check className="w-2.5 h-2.5" />
                              </span>
                            )}
                          </div>
                          <div className="text-[10.5px] font-semibold text-[#141413] leading-tight line-clamp-2">
                            {mat.name}
                          </div>
                        </div>
                        {mat.brand && (
                          <div className="text-[9px] text-[#78716C] font-medium truncate mt-1">
                            {mat.brand}
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            </>
          )}
    </>
  );
};
