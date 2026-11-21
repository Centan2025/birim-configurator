"use client";

import React, { useState, useMemo, useEffect } from "react";
import { PremiumSelect } from "./PremiumSelect";
import {
  PaintBucket,
  Pipette,
  Sparkles,
  Star,
  Search,
  X,
  RefreshCw,
  Check,
  Layers,
} from "lucide-react";
import type { DesignProject, MaterialDefinition } from "@birim/core";
import { getMaterialSwatchStyle, classifyPhysicalMaterial } from "../v3/materials/pbrMaterialSystem";
import { AnimatedPopoverPresence } from "./AnimatedWindowPresence";
import {
  QUICK_ZONE_SCOPE_OPTIONS,
  BIRIM_CURATED_MOODBOARDS,
  collectProjectUsedMaterials,
  loadFavoriteMaterialIds,
  saveFavoriteMaterialIds,
  loadRecentMaterialIds,
  pushRecentMaterialId,
  dispatchLive3DMaterialPreview,
  dispatchLive3DMoodboardPreview,
  type QuickZoneScope,
  type CuratedBirimMoodboard,
  type PaintTool3DState,
  type PaintClickBehavior,
} from "./quickMaterialAndMoodboardEngine";

export interface QuickStyleAndMaterialDockProps {
  isOpen: boolean;
  leftSafePx?: number;
  rightSafePx?: number;
  project: DesignProject;
  activeModuleIndex: number;
  materials: MaterialDefinition[];
  paintToolState: PaintTool3DState;
  onChangePaintToolState: (next: PaintTool3DState) => void;
  onApplyZoneMaterial: (scope: QuickZoneScope, materialId: string) => void;
  onReplaceProjectMaterial: (fromMaterialId: string, toMaterialId: string) => void;
  onApplyCuratedMoodboard: (moodboard: CuratedBirimMoodboard) => void;
  onClose: () => void;
}

type CategoryFilterId =
  | "all"
  | "in_project"
  | "favorites"
  | "recent"
  | "wood"
  | "lacquer_melamine"
  | "stone"
  | "glass_mirror"
  | "metal";

export const QuickStyleAndMaterialDock: React.FC<QuickStyleAndMaterialDockProps> = React.memo(
  ({
    isOpen,
    leftSafePx = 76,
    rightSafePx = 64,
    project,
    activeModuleIndex,
    materials,
    paintToolState,
    onChangePaintToolState,
    onApplyZoneMaterial,
    onReplaceProjectMaterial,
    onApplyCuratedMoodboard,
    onClose,
  }) => {
    const [activeTab, setActiveTab] = useState<"swatches" | "moodboards">("swatches");
    const [selectedScope, setSelectedScope] = useState<QuickZoneScope>("active_doors");
    const [categoryFilter, setCategoryFilter] = useState<CategoryFilterId>("all");
    const [searchQuery, setSearchQuery] = useState("");
    const [replaceSourceMatId, setReplaceSourceMatId] = useState<string | null>(null);
    const [favoriteIds, setFavoriteIds] = useState<string[]>(() => loadFavoriteMaterialIds());
    const [recentIds, setRecentIds] = useState<string[]>(() => loadRecentMaterialIds());

    useEffect(() => {
      if (!isOpen) {
        dispatchLive3DMaterialPreview(null);
        dispatchLive3DMoodboardPreview(null);
        setReplaceSourceMatId(null);
      }
    }, [isOpen]);

    useEffect(() => {
      return () => {
        dispatchLive3DMaterialPreview(null);
        dispatchLive3DMoodboardPreview(null);
      };
    }, []);

    const matById = useMemo(
      () => new Map<string, MaterialDefinition>(materials.map((m) => [m.id, m])),
      [materials]
    );

    const inModelUsages = useMemo(
      () => collectProjectUsedMaterials(project, materials),
      [project, materials]
    );

    const filteredMaterials = useMemo(() => {
      const q = searchQuery.trim().toLowerCase();
      let list = materials.filter((m) => !m.id.startsWith("mat_led_"));

      if (categoryFilter === "in_project") {
        const usedSet = new Set(inModelUsages.map((u) => u.material.id));
        list = list.filter((m) => usedSet.has(m.id));
      } else if (categoryFilter === "favorites") {
        const favSet = new Set(favoriteIds);
        list = list.filter((m) => favSet.has(m.id));
      } else if (categoryFilter === "recent") {
        const recMap = new Map(recentIds.map((id, i) => [id, i]));
        list = list
          .filter((m) => recMap.has(m.id))
          .sort((a, b) => (recMap.get(a.id) ?? 99) - (recMap.get(b.id) ?? 99));
      } else if (categoryFilter === "wood") {
        list = list.filter((m) => classifyPhysicalMaterial(m) === "wood");
      } else if (categoryFilter === "lacquer_melamine") {
        list = list.filter((m) => {
          const c = classifyPhysicalMaterial(m);
          return c === "lacquer" || c === "melamine" || c === "fabric";
        });
      } else if (categoryFilter === "stone") {
        list = list.filter((m) => classifyPhysicalMaterial(m) === "stone");
      } else if (categoryFilter === "glass_mirror") {
        list = list.filter((m) => {
          const c = classifyPhysicalMaterial(m);
          return c === "glass" || c === "mirror";
        });
      } else if (categoryFilter === "metal") {
        list = list.filter((m) => classifyPhysicalMaterial(m) === "metal");
      }

      if (q) {
        list = list.filter((m) => `${m.name} ${m.id} ${m.category}`.toLowerCase().includes(q));
      }
      return list;
    }, [materials, categoryFilter, searchQuery, inModelUsages, favoriteIds, recentIds]);

    // Mounted/exit animation handled smoothly by AnimatedPopoverPresence below

    const handleToggleFavorite = (e: React.MouseEvent, matId: string) => {
      e.stopPropagation();
      const exists = favoriteIds.includes(matId);
      const next = exists ? favoriteIds.filter((x) => x !== matId) : [matId, ...favoriteIds];
      setFavoriteIds(next);
      saveFavoriteMaterialIds(next);
    };

    const handleSwatchClick = (mat: MaterialDefinition) => {
      dispatchLive3DMaterialPreview(null);
      const nextRecents = pushRecentMaterialId(mat.id);
      setRecentIds(nextRecents);

      if (replaceSourceMatId) {
        onReplaceProjectMaterial(replaceSourceMatId, mat.id);
        setReplaceSourceMatId(null);
        return;
      }

      if (paintToolState.mode === "paint") {
        onChangePaintToolState({
          ...paintToolState,
          materialId: mat.id,
          zoneScope: selectedScope,
        });
        return;
      }
      onApplyZoneMaterial(selectedScope, mat.id);
    };

    const activeBrushMat = matById.get(paintToolState.materialId) || materials[0];

    return (
      <AnimatedPopoverPresence isOpen={isOpen} origin="bottom" className="fixed bottom-[72px] left-0 right-0 z-30 pointer-events-none">
      <div
        data-testid="v15-quick-style-material-dock"
        onMouseLeave={() => {
          dispatchLive3DMaterialPreview(null);
          dispatchLive3DMoodboardPreview(null);
        }}
        style={{
          marginLeft: `${leftSafePx}px`,
          marginRight: `${rightSafePx}px`,
        }}
        className="birim-dramatic-panel mx-auto max-w-[880px] rounded-3xl bg-[#252A34]/88 backdrop-blur-2xl border border-white/[0.22] ring-1 ring-black/60 shadow-[0_28px_68px_rgba(0,0,0,0.62)] p-3.5 text-xs text-[#F3F4F6] space-y-2.5 pointer-events-auto transition-[margin] duration-200 max-lg:!mx-3"
      >
        {/* V49 KOMPAKT ÜST BAR: Sekmeler + Gruplu Hedef Seçici + İkon Araçları + Sahne Renk Noktaları */}
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 flex-wrap">
            <div className="inline-flex items-center p-0.5 rounded-full bg-[#ECE7DD] border border-[#DFD9CE]">
              <button
                type="button"
                data-testid="v15-dock-tab-swatches"
                title="Malzeme Kartelası"
                onClick={() => {
                  dispatchLive3DMoodboardPreview(null);
                  setActiveTab("swatches");
                }}
                className={`h-7 px-2.5 rounded-full text-[11px] font-bold flex items-center gap-1.5 transition cursor-pointer ${
                  activeTab === "swatches"
                    ? "bg-[#141413] text-white shadow-2xs"
                    : "text-[#57534E] hover:text-[#141413]"
                }`}
              >
                <Layers className="w-4 h-4" />
                <span>Kartela</span>
              </button>
              <button
                type="button"
                data-testid="v15-dock-tab-moodboards"
                title={`Hazır Kombinasyonlar (${BIRIM_CURATED_MOODBOARDS.length})`}
                onClick={() => {
                  dispatchLive3DMaterialPreview(null);
                  setActiveTab("moodboards");
                }}
                className={`h-7 px-2.5 rounded-full text-[11px] font-bold flex items-center gap-1.5 transition cursor-pointer ${
                  activeTab === "moodboards"
                    ? "bg-[#141413] text-white shadow-2xs"
                    : "text-[#57534E] hover:text-[#141413]"
                }`}
              >
                <Sparkles className="w-4 h-4 text-[#38BDF8]" />
                <span>Kombin</span>
              </button>
            </div>

            {activeTab === "swatches" && (
              <PremiumSelect
                ariaLabel="Hedef Bölge"
                title="Malzemenin uygulanacağı hedef bölge"
                direction="up"
                value={selectedScope}
                options={QUICK_ZONE_SCOPE_OPTIONS.map((sc) => ({
                  value: sc.id,
                  label: sc.shortTr,
                  hint: sc.hintTr,
                }))}
                onChange={(nextScope) => {
                  setReplaceSourceMatId(null);
                  setSelectedScope(nextScope);
                  if (paintToolState.mode !== "none") {
                    onChangePaintToolState({ ...paintToolState, zoneScope: nextScope });
                  }
                  if (nextScope === "countertops" && categoryFilter === "all") {
                    setCategoryFilter("stone");
                  } else if (nextScope === "handles_gola" && categoryFilter === "all") {
                    setCategoryFilter("metal");
                  } else if (
                    nextScope !== "countertops" &&
                    nextScope !== "handles_gola" &&
                    (categoryFilter === "stone" || categoryFilter === "metal")
                  ) {
                    setCategoryFilter("all");
                  }
                }}
              />
            )}

            {/* İkon Odaklı Boya Kovası & Damlalık */}
            <button
              type="button"
              data-testid="v15-dock-paint-bucket-btn"
              onClick={() => {
                const nextMode = paintToolState.mode === "paint" ? "none" : "paint";
                onChangePaintToolState({
                  ...paintToolState,
                  mode: nextMode,
                  zoneScope: selectedScope,
                });
              }}
              title="3B Boya Fırçası (Kısayol: B)"
              className={`h-7 px-2 rounded-full text-[11px] font-semibold inline-flex items-center gap-1.5 border transition cursor-pointer ${
                paintToolState.mode === "paint"
                  ? "bg-[#C2410C] border-[#C2410C] text-white shadow-xs"
                  : "bg-white hover:bg-[#F3EFE6] border-[#DFD9CE] text-[#44403C]"
              }`}
            >
              <PaintBucket className="w-4 h-4" />
              {activeBrushMat && (
                <span
                  className="w-3.5 h-3.5 rounded-full border border-white/40 shrink-0"
                  style={getMaterialSwatchStyle(activeBrushMat)}
                />
              )}
            </button>

            <button
              type="button"
              data-testid="v15-dock-eyedropper-btn"
              onClick={() => {
                const nextMode = paintToolState.mode === "eyedropper" ? "none" : "eyedropper";
                onChangePaintToolState({
                  ...paintToolState,
                  mode: nextMode,
                  zoneScope: selectedScope,
                });
              }}
              title="3B Damlalık (Kısayol: I veya Alt+Tık)"
              className={`h-7 w-8 rounded-full inline-flex items-center justify-center border transition cursor-pointer ${
                paintToolState.mode === "eyedropper"
                  ? "bg-[#1D4ED8] border-[#1D4ED8] text-white shadow-xs"
                  : "bg-white hover:bg-[#F3EFE6] border-[#DFD9CE] text-[#44403C]"
              }`}
            >
              <Pipette className="w-4 h-4" />
            </button>

            {paintToolState.mode === "paint" && (
              <PremiumSelect
                ariaLabel="Fırça Modu"
                direction="up"
                value={paintToolState.clickBehavior}
                options={[
                  { value: "active_scope", label: "Seçili Bölge" },
                  { value: "clicked_module", label: "Tüm Modül" },
                  { value: "clicked_part", label: "Tek Parça" },
                  { value: "replace_matching_project", label: "Aynı Rengi Değiştir" },
                ]}
                onChange={(nextBeh) =>
                  onChangePaintToolState({
                    ...paintToolState,
                    clickBehavior: nextBeh,
                  })
                }
              />
            )}

            {/* Sahnedeki Aktif Renkler — Sadece Kompakt Renk Noktaları (Yazısız) */}
            {activeTab === "swatches" && inModelUsages.length > 0 && (
              <div
                title="Sahnedeki rengi tek tıkla tüm projede değiştir"
                className="inline-flex items-center gap-1 px-2 h-7 rounded-full bg-[#F2EEE5] border border-[#E4DDD0]"
              >
                <RefreshCw className="w-3.5 h-3.5 text-[#78716C] shrink-0" />
                {inModelUsages.slice(0, 6).map((u) => {
                  const isReplacing = replaceSourceMatId === u.material.id;
                  return (
                    <button
                      key={u.material.id}
                      type="button"
                      onClick={() => setReplaceSourceMatId(isReplacing ? null : u.material.id)}
                      title={`Sahnedeki "${u.material.name}" (${u.zonesLabelTr}) rengini değiştirmek için tıkla`}
                      className={`w-4.5 h-4.5 rounded-full border transition cursor-pointer ${
                        isReplacing
                          ? "ring-2 ring-[#38BDF8] scale-110 border-white"
                          : "border-white/35 hover:scale-110"
                      }`}
                      style={getMaterialSwatchStyle(u.material)}
                    />
                  );
                })}
              </div>
            )}
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Kapat"
            className="w-7 h-7 rounded-full hover:bg-[#EFECE4] text-[#57534E] hover:text-[#141413] flex items-center justify-center cursor-pointer shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* SEKME 1: KOMPAKT KATEGORİ + ARAMA (Tek Satır) */}
        {activeTab === "swatches" && (
          <div className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-1 overflow-x-auto no-scrollbar">
                {(
                  [
                    { id: "all", label: "Tümü" },
                    { id: "favorites", label: `★ ${favoriteIds.length}` },
                    { id: "in_project", label: "Sahne" },
                    { id: "wood", label: "Ahşap" },
                    { id: "lacquer_melamine", label: "Lake" },
                    { id: "stone", label: "Taş" },
                    { id: "glass_mirror", label: "Cam" },
                    { id: "metal", label: "Metal" },
                  ] as const
                ).map((cat) => (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => setCategoryFilter(cat.id)}
                    className={`h-6 px-2.5 rounded-full text-[10.5px] font-semibold whitespace-nowrap transition cursor-pointer ${
                      categoryFilter === cat.id
                        ? "bg-[#38BDF8] text-white"
                        : "bg-white/80 hover:bg-white border border-[#E5DFD3] text-[#57534E]"
                    }`}
                  >
                    {cat.label}
                  </button>
                ))}
              </div>

              <div className="relative w-32 sm:w-40 shrink-0">
                <Search className="w-3.5 h-3.5 text-[#78716C] absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Ara..."
                  className="w-full h-6.5 pl-7 pr-5 rounded-full bg-white border border-[#DED8CC] text-[11px] text-[#141413] placeholder:text-[#8C857B] focus:outline-none focus:border-[#141413]"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery("")}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-[#78716C] hover:text-[#141413] cursor-pointer"
                  >
                    ✕
                  </button>
                )}
              </div>
            </div>

            {/* Satır D: Canlı 3B Önizlemeli Kartela Izgarası */}
            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2 max-h-[200px] overflow-y-auto pr-1">
              {filteredMaterials.map((mat) => {
                const isFav = favoriteIds.includes(mat.id);
                const isUsed = inModelUsages.some((u) => u.material.id === mat.id);
                return (
                  <div
                    key={mat.id}
                    role="button"
                    tabIndex={0}
                    draggable={true}
                    onDragStart={(e) => {
                      e.dataTransfer.effectAllowed = "copy";
                      e.dataTransfer.setData("application/x-birim-material", JSON.stringify({ materialId: mat.id, materialName: mat.name }));
                      if (typeof window !== "undefined") {
                        (window as any).__birimDraggedMaterial = { materialId: mat.id, materialName: mat.name };
                      }
                    }}
                    onDragEnd={() => {
                      if (typeof window !== "undefined") {
                        (window as any).__birimDraggedMaterial = null;
                      }
                    }}
                    onMouseEnter={() =>
                      dispatchLive3DMaterialPreview({
                        materialId: mat.id,
                        scope: selectedScope,
                        activeModuleIndex,
                        replaceFromMaterialId: replaceSourceMatId || undefined,
                      })
                    }
                    onFocus={() =>
                      dispatchLive3DMaterialPreview({
                        materialId: mat.id,
                        scope: selectedScope,
                        activeModuleIndex,
                        replaceFromMaterialId: replaceSourceMatId || undefined,
                      })
                    }
                    onClick={() => handleSwatchClick(mat)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        handleSwatchClick(mat);
                      }
                    }}
                    title={`${mat.name} • €${mat.costPerM2}/m²`}
                    className="group relative rounded-2xl bg-white hover:bg-[#F6F2EA] border border-[#E5DFD3] hover:border-[#38BDF8] p-1.5 flex flex-col gap-1.5 text-center transition cursor-pointer shadow-2xs"
                  >
                    <span
                      className="w-full h-14 rounded-xl border border-white/20 shrink-0 relative flex items-center justify-center shadow-inner"
                      style={getMaterialSwatchStyle(mat)}
                    >
                      {isUsed && (
                        <span
                          title="Bu projede kullanılıyor"
                          className="absolute left-1.5 top-1.5 w-4 h-4 rounded-full bg-gradient-to-br from-[#0284C7] to-[#1E40AF] text-white flex items-center justify-center shadow-sm"
                        >
                          <Check className="w-2.5 h-2.5" />
                        </span>
                      )}
                    </span>
                    <div className="text-[10.5px] font-bold text-[#141413] leading-tight truncate px-0.5">
                      {mat.name.replace(/^(Egger|Kastamonu|Yıldız Entegre|AGT|Fenix|Belenco|Çimstone|Neolith|Birim)\s+/i, "")}
                    </div>
                    <button
                      type="button"
                      onClick={(e) => handleToggleFavorite(e, mat.id)}
                      title={isFav ? "Favorilerden çıkar" : "Favorilere ekle"}
                      className={`absolute top-1 right-1 w-4.5 h-4.5 rounded-full flex items-center justify-center transition cursor-pointer ${
                        isFav
                          ? "text-amber-500 opacity-100"
                          : "text-[#A8A29E] opacity-0 group-hover:opacity-100 hover:text-amber-500"
                      }`}
                    >
                      <Star className="w-3 h-3" fill={isFav ? "currentColor" : "none"} />
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* SEKME 2: 8 MİMARİ BİRİM İMZA KOMBİNASYONU (TEK TIKLA ÇİFT TON PALET + HOVER 3B ÖNİZLEME) */}
        {activeTab === "moodboards" && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2 max-h-[220px] overflow-y-auto pr-1">
            {BIRIM_CURATED_MOODBOARDS.map((mb) => {
              const baseMat = matById.get(mb.baseFrontMaterialId);
              const wallMat = matById.get(mb.wallFrontMaterialId);
              const stoneMat = matById.get(mb.countertopMaterialId);
              const handleMat = matById.get(mb.handleMaterialId);
              return (
                <button
                  key={mb.id}
                  type="button"
                  data-testid={`v15-moodboard-${mb.id}`}
                  onMouseEnter={() => dispatchLive3DMoodboardPreview(mb)}
                  onFocus={() => dispatchLive3DMoodboardPreview(mb)}
                  onClick={() => {
                    dispatchLive3DMoodboardPreview(null);
                    onApplyCuratedMoodboard(mb);
                  }}
                  className="rounded-2xl bg-white hover:bg-[#F5F1E8] border border-[#E5DFD3] hover:border-[#141413] p-2.5 text-left transition cursor-pointer flex flex-col justify-between gap-2 shadow-2xs"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="text-[11.5px] font-bold text-[#141413] truncate">
                        {mb.titleTr}
                      </div>
                      <div className="text-[10px] text-[#57534E] leading-snug line-clamp-2 mt-0.5">
                        {mb.subtitleTr}
                      </div>
                    </div>
                    <span className="px-2 py-0.5 rounded-full bg-[#EFEAE0] text-[#6B5E4C] text-[9.5px] font-bold shrink-0">
                      {mb.badgeTr}
                    </span>
                  </div>

                  <div className="flex items-center justify-between pt-1 border-t border-[#EFECE4]">
                    <div className="flex items-center -space-x-1.5">
                      {[
                        { m: baseMat, tip: "Alt Cephe" },
                        { m: wallMat, tip: "Üst Cephe" },
                        { m: stoneMat, tip: "Tezgâh" },
                        { m: handleMat, tip: "Kulp/Gola" },
                      ].map((item, idx) => (
                        <span
                          key={idx}
                          title={`${item.tip}: ${item.m?.name || ""}`}
                          className="w-6 h-6 rounded-full border-2 border-white shadow-2xs inline-block"
                          style={getMaterialSwatchStyle(item.m)}
                        />
                      ))}
                    </div>
                    <span className="text-[10px] font-bold text-[#141413]">Uygula →</span>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>
      </AnimatedPopoverPresence>
    );
  }
);

QuickStyleAndMaterialDock.displayName = "QuickStyleAndMaterialDock";
