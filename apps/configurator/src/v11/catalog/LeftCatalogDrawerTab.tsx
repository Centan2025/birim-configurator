"use client";
import React from "react";
import { Plus, ArrowLeft, ArrowRight, ArrowUp, Shuffle, UtensilsCrossed, Box } from "lucide-react";
import { V3StudioModuleThumbnail } from "../../v3/components/V3StudioModuleThumbnail";
import { SceneObjectThumbnail } from "../../v3/components/SceneObjectThumbnail";
import type { V4ModuleTemplateDefinition, SceneObjectCatalogItem } from "@birim/catalog";
import { V11_CATALOG_GROUPS, type V11CatalogGroup, type V11LeftDrawerTab } from "../v11Constants";
import { startModuleSilhouetteDrag, setActiveDraggedTemplateId } from "../../v3/engine/kitchenSpatialEngine";
import { startSceneObjectSilhouetteDrag, setActiveDraggedSceneCatalogId } from "../../v3/engine/multiWallSnapAndBvhEngine";
import { renderPrimaryGroupVisualSvg, renderKitchenSubFilterSvg, renderWardrobeSubFilterSvg, type KitchenSubFilterId, type WardrobeSubFilterId } from "./catalogFilterSvgs";

export interface LeftCatalogDrawerTabProps {
  activeGroup: V11CatalogGroup["id"];
  classifyKitchenSub: (tpl: V4ModuleTemplateDefinition) => KitchenSubFilterId;
  classifyWardrobeSub: (tpl: V4ModuleTemplateDefinition) => WardrobeSubFilterId;
  displayUnit: "cm" | "mm";
  filteredSceneObjects: SceneObjectCatalogItem[];
  filteredTemplates: V4ModuleTemplateDefinition[];
  fmtLen: (mm: number, withUnit?: boolean) => string;
  groupBaseTemplates: V4ModuleTemplateDefinition[];
  kitchenSubFilter: KitchenSubFilterId;
  objectFilter: "all" | "appliance" | "furniture" | "plants" | "decor";
  onAddCompositeAssembly: (presetId: string) => void;
  onAddSceneObject: (catalogId: string) => void;
  onAppendTemplateAdjacent: (templateId: string, side?: "left" | "right" | "above") => void;
  onApplyTemplateToActive: (templateId: string) => void;
  onChangeDrawer: (tab: V11LeftDrawerTab) => void;
  onLoadKitchenPreset: (kind: "linear" | "l" | "u") => void;
  onOpenCapsuleAndGlbHub: (tab: "modules" | "capsule_curved" | "custom_glb" | "automation") => void;
  onOpenKitchenIslandModal: () => void;
  renderedDrawer: V11LeftDrawerTab;
  searchQuery: string;
  setActiveGroup: React.Dispatch<React.SetStateAction<V11CatalogGroup["id"]>>;
  setIsDraggingCatalogItem: React.Dispatch<React.SetStateAction<boolean>>;
  setKitchenSubFilter: React.Dispatch<React.SetStateAction<KitchenSubFilterId>>;
  setObjectFilter: React.Dispatch<React.SetStateAction<"all" | "appliance" | "furniture" | "plants" | "decor">>;
  setSearchQuery: React.Dispatch<React.SetStateAction<string>>;
  setWardrobeSubFilter: React.Dispatch<React.SetStateAction<WardrobeSubFilterId>>;
  wardrobeSubFilter: WardrobeSubFilterId;
}

export const LeftCatalogDrawerTab: React.FC<LeftCatalogDrawerTabProps> = (props) => {
  const {
    activeGroup,
    classifyKitchenSub,
    classifyWardrobeSub,
    displayUnit,
    filteredSceneObjects,
    filteredTemplates,
    fmtLen,
    groupBaseTemplates,
    kitchenSubFilter,
    objectFilter,
    onAddCompositeAssembly,
    onAddSceneObject,
    onAppendTemplateAdjacent,
    onApplyTemplateToActive,
    onChangeDrawer,
    onLoadKitchenPreset,
    onOpenCapsuleAndGlbHub,
    onOpenKitchenIslandModal,
    renderedDrawer,
    searchQuery,
    setActiveGroup,
    setIsDraggingCatalogItem,
    setKitchenSubFilter,
    setObjectFilter,
    setSearchQuery,
    setWardrobeSubFilter,
    wardrobeSubFilter,
  } = props;
  return (
    <>
            {/* SEKME 1: ÜRÜN & EŞYA KATALOĞU */}
            {renderedDrawer === "catalog" && (
              <>
                <div className="px-4 pt-3 pb-2 space-y-2.5 shrink-0">
                  {/* 4 Görsel Ağırlıklı Ana Kategori Kartı (Kayarak Giden Gölgeli Seçici) */}
                  <div className="relative grid grid-cols-4 gap-1.5 p-1.5 rounded-2xl bg-slate-900/[0.07] border border-white/55 shadow-inner">
                    {!searchQuery && (
                      <span
                        aria-hidden="true"
                        style={{
                          width: "calc((100% - 12px - 18px) / 4)",
                          transform: `translate3d(calc(${Math.max(
                            0,
                            V11_CATALOG_GROUPS.findIndex((g) => g.id === activeGroup)
                          )} * (100% + 6px)), 0, 0)`,
                        }}
                        className="pointer-events-none absolute top-1.5 bottom-1.5 left-1.5 rounded-xl bg-[#18181B] shadow-[0_6px_16px_rgba(15,23,42,0.30)] transition-transform duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]"
                      />
                    )}
                    {V11_CATALOG_GROUPS.map((grp) => {
                      const active = !searchQuery && activeGroup === grp.id;
                      return (
                        <button
                          key={grp.id}
                          type="button"
                          onClick={() => {
                            setSearchQuery("");
                            setActiveGroup(grp.id);
                          }}
                          className={`relative z-10 py-2 px-1 rounded-xl flex flex-col items-center justify-center gap-1 transition-all duration-250 cursor-pointer ${
                            active
                              ? "text-white"
                              : "bg-white/70 hover:bg-white/95 text-slate-700 hover:text-[#18181B] shadow-[0_2px_8px_rgba(15,23,42,0.08)]"
                          }`}
                        >
                          {renderPrimaryGroupVisualSvg(grp.id, active)}
                          <span className="text-[10px] font-bold leading-tight text-center">
                            {grp.label}
                          </span>
                        </button>
                      );
                    })}
                  </div>

                  {/* Görsel Alt Dolap / Üst Dolap / Boy / Köşe Filtre Düğmeleri (Kayarak Giden Gölgeli Seçici) */}
                  {!searchQuery && activeGroup === "kitchen" && (() => {
                    const kTabs = [
                      { id: "all", label: "Tümü" },
                      { id: "base", label: "Alt Dolap" },
                      { id: "wall", label: "Üst Dolap" },
                      { id: "tall", label: "Boy Kule" },
                      { id: "corner", label: "Köşe" },
                    ] as const;
                    const kIdx = Math.max(0, kTabs.findIndex((x) => x.id === kitchenSubFilter));
                    return (
                      <div className="relative grid grid-cols-5 gap-1 p-1 rounded-2xl bg-slate-900/[0.06] border border-white/55">
                        <span
                          aria-hidden="true"
                          style={{
                            width: "calc((100% - 8px - 16px) / 5)",
                            transform: `translate3d(calc(${kIdx} * (100% + 4px)), 0, 0)`,
                          }}
                          className="pointer-events-none absolute top-1 bottom-1 left-1 rounded-xl bg-gradient-to-br from-[#0284C7] via-[#1D4ED8] to-[#1E3A8A] shadow-[0_5px_16px_rgba(56,189,248,0.38)] transition-transform duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]"
                        />
                        {kTabs.map((sf) => {
                          const active = kitchenSubFilter === sf.id;
                          const cnt =
                            sf.id === "all"
                              ? groupBaseTemplates.length
                              : groupBaseTemplates.filter((t) => classifyKitchenSub(t) === sf.id).length;
                          return (
                            <button
                              key={sf.id}
                              type="button"
                              data-testid={`v11-kitchen-subfilter-${sf.id}`}
                              onClick={() => setKitchenSubFilter(sf.id)}
                              className={`relative z-10 py-1.5 px-1 rounded-xl flex flex-col items-center gap-0.5 transition-all duration-250 cursor-pointer ${
                                active
                                  ? "text-white"
                                  : "bg-white/75 hover:bg-white text-slate-700 shadow-[0_2px_6px_rgba(15,23,42,0.08)]"
                              }`}
                            >
                              {renderKitchenSubFilterSvg(sf.id, active)}
                              <span className="text-[9.5px] font-bold leading-none mt-0.5">{sf.label}</span>
                              <span
                                className={`text-[8.5px] font-mono ${
                                  active ? "text-slate-300" : "text-slate-500"
                                }`}
                              >
                                {cnt}
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    );
                  })()}

                  {!searchQuery && activeGroup === "wardrobe" && (() => {
                    const wTabs = [
                      { id: "all", label: "Tümü" },
                      { id: "hinged", label: "Menteşeli" },
                      { id: "sliding", label: "Sürgülü" },
                      { id: "corner_open", label: "Köşe" },
                    ] as const;
                    const wIdx = Math.max(0, wTabs.findIndex((x) => x.id === wardrobeSubFilter));
                    return (
                      <div className="relative grid grid-cols-4 gap-1.5 p-1 rounded-2xl bg-slate-900/[0.06] border border-white/55">
                        <span
                          aria-hidden="true"
                          style={{
                            width: "calc((100% - 8px - 18px) / 4)",
                            transform: `translate3d(calc(${wIdx} * (100% + 6px)), 0, 0)`,
                          }}
                          className="pointer-events-none absolute top-1 bottom-1 left-1 rounded-xl bg-gradient-to-br from-[#0284C7] via-[#1D4ED8] to-[#1E3A8A] shadow-[0_5px_16px_rgba(56,189,248,0.38)] transition-transform duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]"
                        />
                        {wTabs.map((wf) => {
                          const active = wardrobeSubFilter === wf.id;
                          const cnt =
                            wf.id === "all"
                              ? groupBaseTemplates.length
                              : groupBaseTemplates.filter((t) => classifyWardrobeSub(t) === wf.id).length;
                          return (
                            <button
                              key={wf.id}
                              type="button"
                              data-testid={`v11-wardrobe-subfilter-${wf.id}`}
                              onClick={() => setWardrobeSubFilter(wf.id)}
                              className={`relative z-10 py-1.5 px-1 rounded-xl flex flex-col items-center gap-0.5 transition-all duration-250 cursor-pointer ${
                                active
                                  ? "text-white"
                                  : "bg-white/75 hover:bg-white text-slate-700 shadow-[0_2px_6px_rgba(15,23,42,0.08)]"
                              }`}
                            >
                              {renderWardrobeSubFilterSvg(wf.id, active)}
                              <span className="text-[9.5px] font-bold leading-none mt-0.5">{wf.label}</span>
                              <span
                                className={`text-[8.5px] font-mono ${
                                  active ? "text-slate-300" : "text-slate-500"
                                }`}
                              >
                                {cnt}
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    );
                  })()}
                </div>

                <div className="flex-1 overflow-y-auto px-4 pb-4 pt-1 space-y-3">
                  {/* MUTFAK & ADA ÖZEL GÖRSEL HIZLI KARTLARI */}
                  {!searchQuery && activeGroup === "kitchen" && (
                    <div className="p-2.5 rounded-2xl bg-black/25 border border-white/12 space-y-2">
                      <div className="text-[11px] font-bold text-slate-100 flex items-center gap-1.5 px-0.5">
                        <UtensilsCrossed className="w-3.5 h-3.5 text-sky-300" />
                        <span>Mutfak Adası, Masa ve Hazır Setler</span>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <button
                          type="button"
                          title="Şelale Tezgâhlı Ada + 0°/30°/45°/90° bağlı yemek/bar masası"
                          onClick={() => {
                            onChangeDrawer(null);
                            onOpenKitchenIslandModal();
                          }}
                          className="p-2.5 rounded-xl bg-gradient-to-br from-[#0284C7] via-[#1D4ED8] to-[#1E3A8A] text-white flex flex-col items-center justify-center gap-1.5 text-center shadow-[0_6px_16px_rgba(29,78,216,0.45)] transition hover:scale-[1.02] cursor-pointer"
                        >
                          <svg viewBox="0 0 88 44" className="w-20 h-10" fill="none">
                            {/* Waterfall island body */}
                            <path d="M8 14 H52 V38 H47 V19 H13 V38 H8 Z" stroke="#FFFFFF" strokeWidth="1.5" fill="rgba(255,255,255,0.22)" strokeLinejoin="round" />
                            <rect x="14" y="20" width="32" height="16" rx="1" stroke="#BAE6FD" strokeWidth="1.1" fill="rgba(186,230,253,0.14)" />
                            <line x1="30" y1="20" x2="30" y2="36" stroke="#BAE6FD" strokeWidth="1" />
                            <line x1="14" y1="28" x2="46" y2="28" stroke="#BAE6FD" strokeWidth="1" />
                            {/* Attached extending dining/bar table */}
                            <rect x="48" y="20" width="32" height="4.5" rx="1.5" stroke="#FDE68A" strokeWidth="1.4" fill="rgba(253,230,138,0.28)" />
                            <line x1="76" y1="24.5" x2="76" y2="38" stroke="#FDE68A" strokeWidth="1.8" strokeLinecap="round" />
                            <line x1="4" y1="39" x2="84" y2="39" stroke="rgba(255,255,255,0.25)" strokeWidth="1" />
                          </svg>
                          <div>
                            <div className="text-[11px] font-bold leading-tight">Şelale Ada &amp; Masa</div>
                            <div className="text-[9.5px] text-sky-200/90 mt-0.5">0°/30°/45°/90° bağlı masa</div>
                          </div>
                        </button>

                        <button
                          type="button"
                          title="180 cm ada + 80 cm indüksiyon ocak + lineer sarkıt + 3 bar taburesi"
                          onClick={() => onAddCompositeAssembly("comp_island_social_set")}
                          className="p-2.5 rounded-xl bg-white/[0.08] hover:bg-white/[0.15] border border-white/15 text-slate-100 flex flex-col items-center justify-center gap-1.5 text-center transition hover:scale-[1.02] cursor-pointer"
                        >
                          <svg viewBox="0 0 88 44" className="w-20 h-10" fill="none">
                            {/* Linear ceiling pendant */}
                            <line x1="30" y1="2" x2="30" y2="9" stroke="#94A3B8" strokeWidth="1.1" />
                            <line x1="58" y1="2" x2="58" y2="9" stroke="#94A3B8" strokeWidth="1.1" />
                            <line x1="25" y1="9" x2="63" y2="9" stroke="#FBBF24" strokeWidth="2.2" strokeLinecap="round" />
                            {/* Island + cooktop */}
                            <rect x="14" y="18" width="60" height="19" rx="2" stroke="#E2E8F0" strokeWidth="1.4" fill="rgba(148,163,184,0.16)" />
                            <line x1="36" y1="16.5" x2="52" y2="16.5" stroke="#38BDF8" strokeWidth="2" strokeLinecap="round" />
                            {/* 3 Bar stools */}
                            {[24, 44, 64].map((sx) => (
                              <g key={sx}>
                                <rect x={sx - 5} y="27" width="10" height="3.2" rx="1.2" fill="#D6A874" stroke="#FDE68A" strokeWidth="0.9" />
                                <line x1={sx - 3.5} y1="30.2" x2={sx - 4.5} y2="39" stroke="#CBD5E1" strokeWidth="1.2" strokeLinecap="round" />
                                <line x1={sx + 3.5} y1="30.2" x2={sx + 4.5} y2="39" stroke="#CBD5E1" strokeWidth="1.2" strokeLinecap="round" />
                              </g>
                            ))}
                            <line x1="6" y1="39.5" x2="82" y2="39.5" stroke="rgba(255,255,255,0.20)" strokeWidth="1" />
                          </svg>
                          <div>
                            <div className="text-[11px] font-bold leading-tight">Sosyal Ada + 3 Tabure</div>
                            <div className="text-[9.5px] text-slate-300/90 mt-0.5">180 cm + ocak + sarkıt</div>
                          </div>
                        </button>
                      </div>

                      <div className="grid grid-cols-3 gap-1.5">
                        <button
                          type="button"
                          title="Buzdolabı + Fırın/Mikrodalga Kulesi + Boy Kiler Seti"
                          onClick={() => onAddCompositeAssembly("comp_appliance_wall_trio")}
                          className="py-2 px-1.5 rounded-xl bg-white/[0.08] hover:bg-white/[0.16] border border-white/15 text-slate-100 flex flex-col items-center justify-center gap-1 transition cursor-pointer"
                        >
                          <svg viewBox="0 0 54 30" className="w-12 h-7" fill="none">
                            {/* Fridge */}
                            <rect x="4" y="3" width="15" height="24" rx="1.5" stroke="#CBD5E1" strokeWidth="1.3" fill="rgba(148,163,184,0.16)" />
                            <line x1="11.5" y1="3" x2="11.5" y2="18" stroke="#94A3B8" strokeWidth="0.9" />
                            <line x1="4" y1="18" x2="19" y2="18" stroke="#94A3B8" strokeWidth="0.9" />
                            {/* Oven + MW tower */}
                            <rect x="21" y="3" width="13" height="24" rx="1.5" stroke="#E2E8F0" strokeWidth="1.3" fill="rgba(148,163,184,0.12)" />
                            <rect x="23" y="9" width="9" height="4.5" rx="0.8" fill="#0F172A" stroke="#38BDF8" strokeWidth="0.9" />
                            <rect x="23" y="15" width="9" height="6" rx="0.8" fill="#0F172A" stroke="#38BDF8" strokeWidth="0.9" />
                            {/* Pantry column */}
                            <rect x="36" y="3" width="14" height="24" rx="1.5" stroke="#CBD5E1" strokeWidth="1.3" fill="rgba(148,163,184,0.14)" />
                            <line x1="39" y1="10" x2="47" y2="10" stroke="#94A3B8" strokeWidth="0.9" />
                            <line x1="39" y1="16" x2="47" y2="16" stroke="#94A3B8" strokeWidth="0.9" />
                            <line x1="39" y1="22" x2="47" y2="22" stroke="#94A3B8" strokeWidth="0.9" />
                          </svg>
                          <span className="text-[10px] font-bold leading-tight">Ankastre Kule</span>
                        </button>

                        <button
                          type="button"
                          title="Hazır L-Tipi Köşe Mutfak Planı"
                          onClick={() => onLoadKitchenPreset("l")}
                          className="py-2 px-1.5 rounded-xl bg-white/[0.08] hover:bg-white/[0.16] border border-white/15 text-slate-100 flex flex-col items-center justify-center gap-1 transition cursor-pointer"
                        >
                          <svg viewBox="0 0 54 30" className="w-12 h-7" fill="none">
                            <path d="M11 25 V5 H44" stroke="#E2E8F0" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
                            <path d="M14 8 H42 V15 H21 V24 H14 Z" stroke="#38BDF8" strokeWidth="1.3" fill="rgba(56,189,248,0.22)" strokeLinejoin="round" />
                          </svg>
                          <span className="text-[10px] font-bold leading-tight">L-Mutfak</span>
                        </button>

                        <button
                          type="button"
                          title="Hazır U-Tipi Üç Duvar Mutfak Planı"
                          onClick={() => onLoadKitchenPreset("u")}
                          className="py-2 px-1.5 rounded-xl bg-white/[0.08] hover:bg-white/[0.16] border border-white/15 text-slate-100 flex flex-col items-center justify-center gap-1 transition cursor-pointer"
                        >
                          <svg viewBox="0 0 54 30" className="w-12 h-7" fill="none">
                            <path d="M9 25 V5 H45 V25" stroke="#E2E8F0" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
                            <path d="M12 8 H42 V24 H35 V15 H19 V24 H12 Z" stroke="#38BDF8" strokeWidth="1.3" fill="rgba(56,189,248,0.22)" strokeLinejoin="round" />
                          </svg>
                          <span className="text-[10px] font-bold leading-tight">U-Mutfak</span>
                        </button>
                      </div>
                    </div>
                  )}

                  {/* V64 İKON AĞIRLIKLI TV, KAPSÜL, MASA & SANDALYE HIZLI KARTLARI */}
                  {!searchQuery && activeGroup === "living" && (
                    <div className="p-2.5 rounded-2xl bg-black/25 border border-white/12 space-y-2">
                      <div className="grid grid-cols-2 gap-2">
                        <button
                          type="button"
                          title="Salon TV Bench + 65 inç TV Seti (240 cm gönye konsol + ekran + vitrin)"
                          onClick={() => onAddCompositeAssembly("comp_living_tv_wall_set")}
                          className="py-2.5 px-2 rounded-xl bg-gradient-to-br from-[#0284C7] via-[#1D4ED8] to-[#1E3A8A] text-white flex flex-col items-center justify-center gap-1.5 shadow-[0_6px_16px_rgba(29,78,216,0.45)] transition hover:scale-[1.02] cursor-pointer"
                        >
                          <svg viewBox="0 0 72 42" className="w-16 h-10" fill="none">
                            <rect x="14" y="4" width="32" height="19" rx="2" stroke="#FFFFFF" strokeWidth="1.6" fill="rgba(255,255,255,0.14)" />
                            <rect x="6" y="27" width="48" height="10" rx="2" stroke="#BAE6FD" strokeWidth="1.5" fill="rgba(186,230,253,0.18)" />
                            <line x1="22" y1="27" x2="22" y2="37" stroke="#BAE6FD" strokeWidth="1.1" />
                            <line x1="38" y1="27" x2="38" y2="37" stroke="#BAE6FD" strokeWidth="1.1" />
                            <rect x="57" y="5" width="10" height="32" rx="1.5" stroke="#E0F2FE" strokeWidth="1.3" fill="rgba(255,255,255,0.10)" />
                            <line x1="57" y1="16" x2="67" y2="16" stroke="#E0F2FE" strokeWidth="1" />
                            <line x1="57" y1="26" x2="67" y2="26" stroke="#E0F2FE" strokeWidth="1" />
                          </svg>
                          <span className="text-[11px] font-bold">TV Seti</span>
                        </button>

                        <button
                          type="button"
                          title="Özel Kapsül Masa & Tamburlu Bar Tasarla"
                          onClick={() => {
                            onChangeDrawer(null);
                            onOpenCapsuleAndGlbHub("capsule_curved");
                          }}
                          className="py-2.5 px-2 rounded-xl bg-white/[0.08] hover:bg-white/[0.15] border border-white/15 text-slate-100 flex flex-col items-center justify-center gap-1.5 transition hover:scale-[1.02] cursor-pointer"
                        >
                          <svg viewBox="0 0 72 42" className="w-16 h-10" fill="none">
                            <rect x="10" y="9" width="52" height="14" rx="7" stroke="#E2E8F0" strokeWidth="1.6" fill="rgba(214,168,116,0.22)" />
                            <rect x="20" y="23" width="8" height="14" rx="3" stroke="#CBD5E1" strokeWidth="1.4" fill="rgba(148,163,184,0.18)" />
                            <rect x="44" y="23" width="8" height="14" rx="3" stroke="#CBD5E1" strokeWidth="1.4" fill="rgba(148,163,184,0.18)" />
                            <line x1="24" y1="25" x2="24" y2="35" stroke="#94A3B8" strokeWidth="1" />
                            <line x1="48" y1="25" x2="48" y2="35" stroke="#94A3B8" strokeWidth="1" />
                          </svg>
                          <span className="text-[11px] font-bold">Kapsül & Bar</span>
                        </button>
                      </div>

                      <div className="grid grid-cols-3 gap-1.5">
                        <button
                          type="button"
                          draggable={true}
                          onDragStart={(e) => { startSceneObjectSilhouetteDrag(e, "obj_birim_dining_table_1800"); requestAnimationFrame(() => setIsDraggingCatalogItem(true)); }}
                          onDragEnd={() => { setActiveDraggedSceneCatalogId(null); setIsDraggingCatalogItem(false); }}
                          title="Masif Meşe Yemek Masası (180×90 cm) — Tıkla veya sahneye sürükle"
                          onClick={() => onAddSceneObject("obj_birim_dining_table_1800")}
                          className="py-2 px-1 rounded-xl bg-white/[0.08] hover:bg-white/[0.16] border border-white/15 text-slate-200 flex flex-col items-center justify-center gap-1 transition cursor-pointer"
                        >
                          <svg viewBox="0 0 44 28" className="w-10 h-6" fill="none">
                            <rect x="5" y="7" width="34" height="4.5" rx="1.5" stroke="#E2E8F0" strokeWidth="1.5" fill="rgba(214,168,116,0.25)" />
                            <line x1="9" y1="11.5" x2="9" y2="24" stroke="#CBD5E1" strokeWidth="1.8" strokeLinecap="round" />
                            <line x1="35" y1="11.5" x2="35" y2="24" stroke="#CBD5E1" strokeWidth="1.8" strokeLinecap="round" />
                          </svg>
                          <span className="text-[10px] font-bold">Masa</span>
                        </button>

                        <button
                          type="button"
                          draggable={true}
                          onDragStart={(e) => { startSceneObjectSilhouetteDrag(e, "obj_birim_dining_chair"); requestAnimationFrame(() => setIsDraggingCatalogItem(true)); }}
                          onDragEnd={() => { setActiveDraggedSceneCatalogId(null); setIsDraggingCatalogItem(false); }}
                          title="Yemek Sandalyesi — Tıkla veya sahneye sürükle"
                          onClick={() => onAddSceneObject("obj_birim_dining_chair")}
                          className="py-2 px-1 rounded-xl bg-white/[0.08] hover:bg-white/[0.16] border border-white/15 text-slate-200 flex flex-col items-center justify-center gap-1 transition cursor-pointer"
                        >
                          <svg viewBox="0 0 44 28" className="w-10 h-6" fill="none">
                            <path d="M15 5 V15 H29" stroke="#E2E8F0" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                            <line x1="15" y1="15" x2="15" y2="24" stroke="#CBD5E1" strokeWidth="1.8" strokeLinecap="round" />
                            <line x1="29" y1="15" x2="29" y2="24" stroke="#CBD5E1" strokeWidth="1.8" strokeLinecap="round" />
                          </svg>
                          <span className="text-[10px] font-bold">Sandalye</span>
                        </button>

                        <button
                          type="button"
                          draggable={true}
                          onDragStart={(e) => { startSceneObjectSilhouetteDrag(e, "obj_birim_bar_stool"); requestAnimationFrame(() => setIsDraggingCatalogItem(true)); }}
                          onDragEnd={() => { setActiveDraggedSceneCatalogId(null); setIsDraggingCatalogItem(false); }}
                          title="Bar Taburesi — Tıkla veya sahneye sürükle"
                          onClick={() => onAddSceneObject("obj_birim_bar_stool")}
                          className="py-2 px-1 rounded-xl bg-white/[0.08] hover:bg-white/[0.16] border border-white/15 text-slate-200 flex flex-col items-center justify-center gap-1 transition cursor-pointer"
                        >
                          <svg viewBox="0 0 44 28" className="w-10 h-6" fill="none">
                            <rect x="14" y="6" width="16" height="4" rx="2" stroke="#E2E8F0" strokeWidth="1.6" fill="rgba(214,168,116,0.25)" />
                            <line x1="17" y1="10" x2="15" y2="24" stroke="#CBD5E1" strokeWidth="1.6" strokeLinecap="round" />
                            <line x1="27" y1="10" x2="29" y2="24" stroke="#CBD5E1" strokeWidth="1.6" strokeLinecap="round" />
                            <line x1="16" y1="18" x2="28" y2="18" stroke="#94A3B8" strokeWidth="1.4" />
                          </svg>
                          <span className="text-[10px] font-bold">Tabure</span>
                        </button>
                      </div>
                    </div>
                  )}

                  {/* 3B CİHAZLAR, MASALAR VE SAHNE EŞYALARI SEKMESİ */}
                  {(activeGroup === "objects" || Boolean(searchQuery)) &&
                    filteredSceneObjects.length > 0 && (
                      <div className="space-y-2.5">
                        {!searchQuery && (
                          <div className="grid grid-cols-5 gap-1">
                            {(
                              [
                                { id: "all", label: "Tümü" },
                                { id: "appliance", label: "Cihazlar" },
                                { id: "furniture", label: "Mobilya" },
                                { id: "plants", label: "Bitkiler" },
                                { id: "decor", label: "TV & Işık" },
                              ] as const
                            ).map((flt) => {
                              const active = objectFilter === flt.id;
                              const strk = active ? "#FAF8F4" : "#292524";
                              const fill = active ? "#CFC6B8" : "#E5DDD0";
                              return (
                                <button
                                  key={flt.id}
                                  type="button"
                                  onClick={() => setObjectFilter(flt.id)}
                                  className={`py-1.5 px-1 rounded-xl border flex flex-col items-center gap-1 transition cursor-pointer ${
                                    active
                                      ? "bg-[#292524] text-white border-[#141413]"
                                      : "bg-white/90 hover:bg-white border-[#E5DFD3] text-[#44403C]"
                                  }`}
                                >
                                  <svg viewBox="0 0 28 20" className="w-6 h-4.5" fill="none" aria-hidden="true">
                                    {flt.id === "all" && (
                                      <>
                                        <rect x="4" y="3" width="8" height="14" rx="1" fill={fill} stroke={strk} strokeWidth="1.2" />
                                        <ellipse cx="19" cy="11" rx="5.5" ry="2.2" fill={fill} stroke={strk} strokeWidth="1.2" />
                                        <line x1="16" y1="13" x2="15" y2="17.5" stroke={strk} strokeWidth="1.2" />
                                        <line x1="22" y1="13" x2="23" y2="17.5" stroke={strk} strokeWidth="1.2" />
                                      </>
                                    )}
                                    {flt.id === "appliance" && (
                                      <>
                                        <rect x="7" y="2" width="14" height="16" rx="1.5" fill={fill} stroke={strk} strokeWidth="1.3" />
                                        <rect x="9.5" y="5" width="9" height="6" rx="0.8" fill="#1E293B" />
                                        <circle cx="11.5" cy="14.5" r="1" fill={strk} />
                                        <circle cx="16.5" cy="14.5" r="1" fill={strk} />
                                      </>
                                    )}
                                    {flt.id === "furniture" && (
                                      <>
                                        <ellipse cx="14" cy="9.5" rx="9" ry="3.2" fill={fill} stroke={strk} strokeWidth="1.3" />
                                        <line x1="8" y1="12" x2="7" y2="18" stroke={strk} strokeWidth="1.3" strokeLinecap="round" />
                                        <line x1="20" y1="12" x2="21" y2="18" stroke={strk} strokeWidth="1.3" strokeLinecap="round" />
                                      </>
                                    )}
                                    {flt.id === "plants" && (
                                      <>
                                        <polygon points="10,13 18,13 16.5,18.5 11.5,18.5" fill={fill} stroke={strk} strokeWidth="1.2" />
                                        <path d="M14 13V6M14 9c-3-3-5.5-2-5.5 0.5S12 11 14 10M14 8c3-3 5.5-2 5.5 0.5S16 10 14 9" stroke={strk} strokeWidth="1.25" strokeLinecap="round" />
                                      </>
                                    )}
                                    {flt.id === "decor" && (
                                      <>
                                        <line x1="14" y1="2" x2="14" y2="8" stroke={strk} strokeWidth="1.2" />
                                        <path d="M9 12a5 4 0 0 1 10 0H9z" fill="#FDE68A" stroke={strk} strokeWidth="1.2" />
                                        <circle cx="14" cy="13.5" r="1.4" fill="#F59E0B" />
                                      </>
                                    )}
                                  </svg>
                                  <span className="text-[9.5px] font-bold leading-none">{flt.label}</span>
                                </button>
                              );
                            })}
                          </div>
                        )}

                        {searchQuery && (
                          <div className="text-[11px] font-bold text-[#78716C] pt-1">
                            3B Cihazlar, Masalar ve Mekân Eşyaları
                          </div>
                        )}

                        <div className="grid grid-cols-2 gap-2.5">
                          {filteredSceneObjects.map((obj) => (
                            <div
                              key={obj.catalogId}
                              draggable={true}
                              onDragStart={(e) => {
                                startSceneObjectSilhouetteDrag(e, obj.catalogId);
                                requestAnimationFrame(() => setIsDraggingCatalogItem(true));
                              }}
                              onDragEnd={() => {
                                setActiveDraggedSceneCatalogId(null);
                                setIsDraggingCatalogItem(false);
                              }}
                              title="Sahneye sürükleyip bırakın veya tıklayarak ekleyin"
                              className="group relative p-3 rounded-2xl bg-white/90 hover:bg-white border border-[#E5DFD3] hover:border-[#141413]/40 flex flex-col justify-between gap-2 transition shadow-2xs cursor-grab active:cursor-grabbing"
                            >
                              <span className="absolute top-4 right-4 z-10 px-1.5 py-0.5 rounded-md bg-[#141413]/75 text-white text-[9px] font-semibold opacity-0 group-hover:opacity-100 transition pointer-events-none">
                                ⠿ Sürükle
                              </span>
                              <button
                                type="button"
                                draggable={false}
                                onClick={() => onAddSceneObject(obj.catalogId)}
                                className="w-full text-left flex flex-col cursor-pointer"
                              >
                                <div className="w-full h-24 rounded-xl bg-[#F6F3EC] flex items-center justify-center mb-2 overflow-hidden p-1.5 pointer-events-none">
                                  <SceneObjectThumbnail item={obj} />
                                </div>
                                <div className="text-xs font-semibold text-[#141413] leading-snug line-clamp-2">
                                  {obj.name}
                                </div>
                                <div className="text-[10px] font-mono text-[#78716C] mt-0.5">
                                  {fmtLen(obj.defaultDimensions.width, false)}×{fmtLen(obj.defaultDimensions.depth)}
                                </div>
                              </button>
                              <button
                                type="button"
                                draggable={false}
                                onClick={() => onAddSceneObject(obj.catalogId)}
                                className="w-full h-7 rounded-full bg-[#141413] hover:bg-[#292524] text-white text-[10.5px] font-semibold flex items-center justify-center gap-1 cursor-pointer"
                              >
                                <Plus className="w-3 h-3" />
                                <span>Sahneye Ekle</span>
                              </button>
                            </div>
                          ))}
                        </div>

                        {!searchQuery && (
                          <button
                            type="button"
                            onClick={() => {
                              onChangeDrawer(null);
                              onOpenCapsuleAndGlbHub("custom_glb");
                            }}
                            className="w-full py-2.5 px-3.5 rounded-2xl bg-white hover:bg-[#EFECE4] border border-[#DED8CC] text-xs font-semibold flex items-center justify-center gap-2 cursor-pointer"
                          >
                            <Box className="w-3.5 h-3.5 text-[#8C7A6B]" />
                            <span>+ Dışarıdan Özel 3B Model (.GLB) Yükle</span>
                          </button>
                        )}
                      </div>
                    )}

                  {/* PARAMETRİK MODÜL KARTLARI — 3B & 2B Mıknatıslı Sürükle-Bırak Destekli */}
                  {(activeGroup !== "objects" || Boolean(searchQuery)) &&
                    filteredTemplates.length > 0 && (
                      <div className="space-y-2">
                        <div className="flex items-center justify-between px-1 text-[10px] text-[#78716C]">
                          <span></span>
                          <span className="font-mono font-semibold text-[#57534E]">
                            {filteredTemplates.length} model
                          </span>
                        </div>
                        <div className="grid grid-cols-2 gap-2.5 content-start">
                          {filteredTemplates.map((tpl) => {
                            const minVal = fmtLen(tpl.dimensionLimits.minW, false);
                            const maxVal = fmtLen(tpl.dimensionLimits.maxW, false);
                            const isKitchenTpl =
                              tpl.familyId === "fam_kitchen_base" ||
                              tpl.familyId === "fam_kitchen_wall" ||
                              tpl.familyId === "fam_kitchen_tall" ||
                              (tpl.familyId as string) === "fam_kitchen_island" ||
                              tpl.templateId.includes("kitchen");
                            const kSub = isKitchenTpl ? classifyKitchenSub(tpl) : null;
                            const isWallUpper =
                              kSub === "wall" || tpl.familyId === "fam_kitchen_wall";
                            const kitchenBadge =
                              kSub === "wall"
                                ? {
                                    label: "⬆ ÜST DOLAP",
                                    cls: "bg-violet-500/30 border-violet-400/80 text-violet-100",
                                    cardRing: "border-violet-400/40",
                                  }
                                : kSub === "base"
                                ? {
                                    label: "⬇ ALT DOLAP",
                                    cls: "bg-sky-500/28 border-sky-400/80 text-sky-100",
                                    cardRing: "border-sky-400/40",
                                  }
                                : kSub === "tall"
                                ? {
                                    label: "↕ BOY KULE",
                                    cls: "bg-amber-500/28 border-amber-400/80 text-amber-100",
                                    cardRing: "border-amber-400/40",
                                  }
                                : kSub === "corner"
                                ? {
                                    label: "◢ KÖŞE DOLAP",
                                    cls: "bg-emerald-500/28 border-emerald-400/80 text-emerald-100",
                                    cardRing: "border-emerald-400/40",
                                  }
                                : null;

                            return (
                              <div
                                key={tpl.templateId}
                                data-testid={`v11-tpl-${tpl.templateId}`}
                                draggable={true}
                                onDragStart={(e) => {
                                  startModuleSilhouetteDrag(e, tpl.templateId);
                                  requestAnimationFrame(() => setIsDraggingCatalogItem(true));
                                }}
                                onDragEnd={() => {
                                  setActiveDraggedTemplateId(null);
                                  setIsDraggingCatalogItem(false);
                                }}
                                title="3B sahneye veya 2B plana sürükleyip bırakın (mıknatıslı hizalama aktif)"
                                className={`group relative rounded-2xl bg-white/90 hover:bg-white border p-2.5 flex flex-col justify-between transition shadow-[0_10px_24px_rgba(0,0,0,0.30)] hover:shadow-[0_14px_30px_rgba(0,0,0,0.42)] cursor-grab active:cursor-grabbing ${
                                  kitchenBadge ? kitchenBadge.cardRing : "border-[#E5DFD3]"
                                }`}
                              >
                                {kitchenBadge ? (
                                  <span
                                    className={`absolute top-3.5 left-3.5 z-10 px-2 py-0.5 rounded-md border text-[9.5px] font-extrabold tracking-wide backdrop-blur-md shadow-sm pointer-events-none ${kitchenBadge.cls}`}
                                  >
                                    {kitchenBadge.label}
                                  </span>
                                ) : (
                                  <span className="absolute top-3.5 left-3.5 z-10 px-2 py-0.5 rounded-md bg-black/55 border border-white/25 text-slate-100 text-[9px] font-bold backdrop-blur-md shadow-sm pointer-events-none">
                                    {tpl.name.toLowerCase().includes("sürgü") || tpl.templateId.includes("sliding")
                                      ? "↔ Sürgülü"
                                      : tpl.name.toLowerCase().includes("açık") || tpl.templateId.includes("open")
                                      ? "▦ Açık Raf"
                                      : "▯ Menteşeli"}
                                  </span>
                                )}
                                <span title="Sürükleyip sahneye bırak" className="absolute top-3 right-3 z-10 w-6 h-6 rounded-lg bg-black/65 border border-white/20 text-white text-xs font-bold flex items-center justify-center opacity-0 group-hover:opacity-100 transition pointer-events-none">
                                  ⠿
                                </span>
                                <button
                                  type="button"
                                  draggable={false}
                                  onClick={() => onApplyTemplateToActive(tpl.templateId)}
                                  className="w-full text-left flex flex-col items-center cursor-pointer"
                                >
                                  {/* REAL 3D PBR ARCHITECTURAL SHOWROOM RENDER THUMBNAIL */}
                                  <V3StudioModuleThumbnail template={tpl} isWallUpper={isWallUpper} />
                                  <div className="w-full text-xs font-bold text-[#141413] leading-snug line-clamp-2">
                                    {tpl.name}
                                  </div>
                                  <div className="w-full text-[10.5px] font-mono text-[#78716C] mt-0.5">
                                    {minVal === maxVal ? `${minVal} ${displayUnit}` : `${minVal}–${maxVal} ${displayUnit}`}
                                  </div>
                                </button>

                                {/* V89 KAPSÜL DÜĞME BAR: [ ← ]  ( 🔀 )  [ → ] */}
                                <div className="mt-2.5 pt-2 border-t border-white/10 flex items-center justify-between gap-1.5">
                                  <button
                                    type="button"
                                    draggable={false}
                                    data-testid={`v40-add-left-${tpl.templateId}`}
                                    onClick={() => onAppendTemplateAdjacent(tpl.templateId, "left")}
                                    title="Seçili modülün SOL tarafına ekle"
                                    className="flex-1 h-9 rounded-full bg-gradient-to-b from-[#444C5C] to-[#2C3341] hover:from-[#525B6E] hover:to-[#353E4F] hover:scale-[1.03] active:scale-95 text-slate-100 leading-none flex items-center justify-center border border-white/15 shadow-[0_6px_14px_rgba(0,0,0,0.42),inset_0_1px_0.5px_rgba(255,255,255,0.22)] transition cursor-pointer"
                                  >
                                    <ArrowLeft className="w-[16px] h-[16px] stroke-[2.35] block" />
                                  </button>
                                  <button
                                    type="button"
                                    draggable={false}
                                    onClick={() => onApplyTemplateToActive(tpl.templateId)}
                                    title="Seçili mevcut modülü bu modelle değiştir"
                                    className="w-11 h-9 rounded-full bg-gradient-to-b from-[#343B49] to-[#1F2531] hover:from-[#3F4758] hover:to-[#272F3E] hover:scale-105 active:scale-95 border-[1.5px] border-[#C99F78]/85 text-[#E4BC96] leading-none flex items-center justify-center shadow-[0_0_14px_rgba(201,159,120,0.42),0_6px_14px_rgba(0,0,0,0.48),inset_0_1px_0.5px_rgba(255,255,255,0.18)] transition cursor-pointer shrink-0"
                                  >
                                    <Shuffle className="w-[15px] h-[15px] stroke-[2.25] block" />
                                  </button>
                                  {isWallUpper && (
                                    <button
                                      type="button"
                                      draggable={false}
                                      data-testid={`v40-add-above-${tpl.templateId}`}
                                      onClick={() => onAppendTemplateAdjacent(tpl.templateId, "above")}
                                      title="Seçili alt dolabın ÜSTÜNE (145 cm duvar kotuna) ekle"
                                      className="w-9 h-9 rounded-full bg-gradient-to-b from-[#444C5C] to-[#2C3341] hover:from-violet-600 hover:to-indigo-700 hover:scale-105 active:scale-95 border border-violet-300/45 text-violet-200 leading-none flex items-center justify-center shadow-[0_6px_14px_rgba(0,0,0,0.42),inset_0_1px_0.5px_rgba(255,255,255,0.2)] transition cursor-pointer shrink-0"
                                    >
                                      <ArrowUp className="w-[15px] h-[15px] stroke-[2.35] block" />
                                    </button>
                                  )}
                                  <button
                                    type="button"
                                    draggable={false}
                                    data-testid={`v40-add-right-${tpl.templateId}`}
                                    onClick={() => onAppendTemplateAdjacent(tpl.templateId, "right")}
                                    title="Seçili modülün SAĞ tarafına ekle"
                                    className="flex-1 h-9 rounded-full bg-gradient-to-b from-[#444C5C] to-[#2C3341] hover:from-[#525B6E] hover:to-[#353E4F] hover:scale-[1.03] active:scale-95 text-slate-100 leading-none flex items-center justify-center border border-white/15 shadow-[0_6px_14px_rgba(0,0,0,0.42),inset_0_1px_0.5px_rgba(255,255,255,0.22)] transition cursor-pointer"
                                  >
                                    <ArrowRight className="w-[16px] h-[16px] stroke-[2.35] block" />
                                  </button>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                </div>
              </>
            )}
    </>
  );
};
