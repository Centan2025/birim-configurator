"use client";

import React, { useState, useMemo } from "react";
import {
  ChevronLeft,
  ChevronRight,
  SlidersHorizontal,
  Plus,
  Minus,
  Trash2,
  Check,
  Sparkles,
  Copy,
  RotateCw,
  ArrowUpFromLine,
  MoreHorizontal,
  Lightbulb,
  Scissors,
  BookmarkPlus,
  Lock,
  ArrowUpDown,
} from "lucide-react";
import {
  calculateFourSpaceDimensions,
  type DoorCrossSectionProfile,
  type EngineeringValidationFinding,
  type FixedShelfConnectorType,
  type HandleCategory,
  type MaterialDefinition,
  type ModuleInstance,
  type RemediationProposal,
  type SpecialFittingConfig,
} from "@birim/core";
import type { HandleProfileDefinition } from "@birim/catalog";
import type { UserExperienceTier } from "../store/useConfiguratorStore";
import {
  V11_DOOR_PROFILES,
  V11_INTERIOR_PRESETS,
  V11_MATERIAL_GROUPS,
  filterMaterialsByGroup,
  formatFindingForTier,
  type V11InspectorTab,
  type V11MaterialGroup,
} from "./v11Constants";

export interface RightParametricInspectorProps {
  isOpen: boolean;
  onToggleOpen: () => void;
  activeTab: V11InspectorTab;
  onChangeTab: (tab: V11InspectorTab) => void;
  experienceTier: UserExperienceTier;
  modules: ModuleInstance[];
  activeModule: ModuleInstance;
  activeModuleIndex: number;
  activeBayIndex: number;
  materials: MaterialDefinition[];
  handleProfiles: HandleProfileDefinition[];
  engineeringFindings: EngineeringValidationFinding[];
  facadeGrainContinuity: boolean;
  onToggleFacadeGrainContinuity: (enabled: boolean) => void;
  onRunAutoFillersAndCrown: () => void;
  onOpenCutoutModal: () => void;
  onSaveModuleAsTemplate: (name: string) => void;
  onAddCustomMaterial: (input: {
    name: string;
    category: MaterialDefinition["category"];
    colorHex: string;
    roughness: number;
    costPerM2: number;
    hasGrain?: boolean;
  }) => void;
  onSelectModuleIndex: (idx: number) => void;
  onSelectBayIndex: (idx: number) => void;
  onSetDimensions: (w: number, h: number, d: number) => void;
  onBeginSliderDrag?: () => void;
  onCommitSliderDrag?: () => void;
  onSetPlinthHeight: (h: number) => void;
  onSplitBayIntoTwo: (bayIdx: number) => void;
  onEqualizeBaysAndShelves: () => void;
  onRemoveBayAt: (bayIdx: number) => void;
  onSetBayCustomWidth: (bayIdx: number, widthMm: number | null) => void;
  onApplyBayPreset: (
    bayIdx: number,
    presetId: "rail_double" | "shelves_5" | "rail_drawers_3" | "mixed_combo"
  ) => void;
  onAddShelf: (bayIdx: number) => void;
  onAddFixedShelf: (bayIdx: number) => void;
  onSetShelfMountType: (
    bayIdx: number,
    shelfId: string,
    isAdjustable: boolean,
    fixedConnectorType?: FixedShelfConnectorType
  ) => void;
  onRemoveShelf: (bayIdx: number, shelfId: string) => void;
  onSetShelfElevation: (bayIdx: number, shelfId: string, elevMm: number) => void;
  onSetShelfThickness: (bayIdx: number, shelfId: string | "all", thicknessMm: number) => void;
  onAddDrawer: (bayIdx: number) => void;
  onAddInternalDrawer: (bayIdx: number) => void;
  onRemoveDrawer: (bayIdx: number, drawerId: string) => void;
  onAddHangingRail: (bayIdx: number) => void;
  onRemoveHangingRail: (bayIdx: number, railId: string) => void;
  onAddSpecialFitting: (bayIdx: number, fittingType: SpecialFittingConfig["type"]) => void;
  onRemoveSpecialFitting: (bayIdx: number, fittingId: string) => void;
  onAddSubDivider: (bayIdx: number) => void;
  onRemoveSubDivider: (bayIdx: number, subId: string) => void;
  onSetBayDoorType: (
    bayIdx: number,
    type: "single_left" | "single_right" | "double" | "sliding" | "open"
  ) => void;
  onSetSlidingMountingType: (
    mode: "inset_inside" | "top_hung_exposed" | "top_hung_pelmet" | "coplanar_flush"
  ) => void;
  onSetBayV4DoorConfig: (
    bayIdx: number,
    updates: {
      crossSectionProfile?: DoorCrossSectionProfile;
      isGlassFramed?: boolean;
      handleCategory?: HandleCategory;
      handleProfileId?: string;
      softClose?: boolean;
      frontFillerLeftMm?: number;
      frontFillerRightMm?: number;
      frontFillerPosition?: "coplanar_front" | "recessed_inner";
      hardwareProductId?: string;
    }
  ) => void;
  onCopyDoorToAllBays: (sourceBayIdx: number) => void;
  onUpdateCarcassConfig: (patch: Partial<ModuleInstance["carcass"]>) => void;
  onApplyMaterialScope: (
    scope: "doors" | "carcass" | "all_module",
    materialId: string
  ) => void;
  onToggleModuleLed: (
    enabled: boolean,
    opts?: { colorTempK?: 2700 | 3000 | 4000 }
  ) => void;
  onApplyApprovedFix: (proposal: RemediationProposal) => void;
  onDuplicateActiveModule: () => void;
  onAddStackedTopModule: () => void;
  onRotateActiveModule90: () => void;
  onRemoveActiveModule: () => void;
  onOpenCustomHardwareModal: () => void;
}

function renderPresetSvg(kind: "double_hang" | "shelves" | "hang_drawers" | "combo") {
  return (
    <svg
      viewBox="0 0 40 48"
      className="w-8 h-10 text-[#57534E] shrink-0"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
    >
      <rect x="4" y="3" width="32" height="42" rx="3" />
      {kind === "double_hang" && (
        <>
          <line x1="6" y1="11" x2="34" y2="11" />
          <line x1="6" y1="26" x2="34" y2="26" />
          <path d="M15 11v8M25 11v8M15 26v8M25 26v8" strokeOpacity="0.55" />
        </>
      )}
      {kind === "shelves" && (
        <>
          <line x1="5" y1="12" x2="35" y2="12" />
          <line x1="5" y1="20" x2="35" y2="20" />
          <line x1="5" y1="28" x2="35" y2="28" />
          <line x1="5" y1="36" x2="35" y2="36" />
        </>
      )}
      {kind === "hang_drawers" && (
        <>
          <line x1="6" y1="11" x2="34" y2="11" />
          <line x1="5" y1="27" x2="35" y2="27" />
          <line x1="5" y1="33" x2="35" y2="33" />
          <line x1="5" y1="39" x2="35" y2="39" />
        </>
      )}
      {kind === "combo" && (
        <>
          <line x1="5" y1="11" x2="35" y2="11" />
          <line x1="6" y1="17" x2="34" y2="17" strokeDasharray="2 2" />
          <line x1="5" y1="31" x2="35" y2="31" />
          <line x1="5" y1="38" x2="35" y2="38" />
        </>
      )}
    </svg>
  );
}

export const RightParametricInspector: React.FC<RightParametricInspectorProps> = React.memo(
  (props) => {
    const {
      isOpen,
      onToggleOpen,
      activeTab,
      onChangeTab,
      experienceTier,
      modules,
      activeModule,
      activeModuleIndex,
      activeBayIndex,
      materials,
      handleProfiles,
      engineeringFindings,
      facadeGrainContinuity,
      onToggleFacadeGrainContinuity,
      onRunAutoFillersAndCrown,
      onOpenCutoutModal,
      onSaveModuleAsTemplate,
      onAddCustomMaterial,
      onSelectModuleIndex,
      onSelectBayIndex,
      onSetDimensions,
      onBeginSliderDrag,
      onCommitSliderDrag,
      onSetPlinthHeight,
      onSplitBayIntoTwo,
      onEqualizeBaysAndShelves,
      onRemoveBayAt,
      onSetBayCustomWidth,
      onApplyBayPreset,
      onAddShelf,
      onAddFixedShelf,
      onSetShelfMountType,
      onRemoveShelf,
      onSetShelfElevation,
      onSetShelfThickness,
      onAddDrawer,
      onAddInternalDrawer,
      onRemoveDrawer,
      onAddHangingRail,
      onRemoveHangingRail,
      onAddSpecialFitting,
      onRemoveSpecialFitting,
      onAddSubDivider,
      onRemoveSubDivider,
      onSetBayDoorType,
      onSetSlidingMountingType,
      onSetBayV4DoorConfig,
      onCopyDoorToAllBays,
      onUpdateCarcassConfig,
      onApplyMaterialScope,
      onToggleModuleLed,
      onApplyApprovedFix,
      onDuplicateActiveModule,
      onAddStackedTopModule,
      onRotateActiveModule90,
      onRemoveActiveModule,
      onOpenCustomHardwareModal,
    } = props;

    const [unitMode, setUnitMode] = useState<"cm" | "mm">(
      experienceTier === "factory" ? "mm" : "cm"
    );
    const [moduleMenuOpen, setModuleMenuOpen] = useState(false);
    const [materialTarget, setMaterialTarget] = useState<"doors" | "carcass" | "all_module">(
      "doors"
    );
    const [materialGroup, setMaterialGroup] = useState<V11MaterialGroup["id"]>("all");
    const [customMatOpen, setCustomMatOpen] = useState(false);
    const [newMatName, setNewMatName] = useState("");
    const [newMatHex, setNewMatHex] = useState("#C8B8A2");
    const [newMatCat, setNewMatCat] = useState<"lacquer" | "wood" | "stone">("lacquer");

    const isSimple = experienceTier === "simple";
    const safeBayIdx = Math.min(activeBayIndex, Math.max(0, activeModule.bays.length - 1));
    const activeBay = activeModule.bays[safeBayIdx] || activeModule.bays[0];

    const fourSpace = useMemo(
      () => calculateFourSpaceDimensions(activeModule),
      [activeModule]
    );
    const bayClearWidths = fourSpace.usableInternal.bayClearWidthsMm;

    const mainModuleIndices = useMemo(
      () =>
        modules
          .map((m, idx) => ({ m, idx }))
          .filter((item) => item.m.category !== "complementary"),
      [modules]
    );
    const currentOrderIdx = Math.max(
      0,
      mainModuleIndices.findIndex((x) => x.idx === activeModuleIndex)
    );

    const visibleMaterials = useMemo(
      () => filterMaterialsByGroup(materials, materialGroup),
      [materials, materialGroup]
    );

    const activeFinding = engineeringFindings[0] || null;
    const formattedFinding = useMemo(
      () => (activeFinding ? formatFindingForTier(activeFinding, experienceTier) : null),
      [activeFinding, experienceTier]
    );

    // DARALTILMIŞ DURUM: Sağ dikey merkezde (sol başlatıcı ile simetrik) durur — hiçbir üst/alt araç çubuğunun üzerine binmez!
    if (!isOpen) {
      return (
        <button
          type="button"
          data-testid="v11-expand-inspector-btn"
          onClick={onToggleOpen}
          title="Modül Özellikleri Panelini Aç"
          className="fixed right-4 top-1/2 -translate-y-1/2 z-30 py-3.5 px-2.5 rounded-full bg-[#FAF8F4]/94 backdrop-blur-xl border border-[#DFD9CE] shadow-[0_10px_30px_rgba(20,20,19,0.1)] text-xs font-semibold text-[#141413] flex flex-col items-center gap-2 hover:bg-white transition cursor-pointer"
        >
          <ChevronLeft className="w-4 h-4 text-[#57534E]" />
          <SlidersHorizontal className="w-4 h-4 text-[#8C7A6B]" />
          <span className="[writing-mode:vertical-rl] rotate-180 text-[11px] font-bold tracking-wide py-0.5">
            Özellikler
          </span>
        </button>
      );
    }

    const wMm = activeModule.dimensions.width;
    const hMm = activeModule.dimensions.height;
    const dMm = activeModule.dimensions.depth;
    const plinthMm = activeModule.carcass.plinthHeight ?? 80;
    const formatVal = (mm: number) =>
      unitMode === "cm" ? `${Math.round(mm / 10)}` : `${Math.round(mm)}`;

    const curDoorType = activeBay?.door?.type || "double";
    const isSlidingBay = curDoorType === "sliding" || curDoorType === "sliding_bottom";
    const curDoorProfile =
      activeBay?.door?.crossSectionProfile ||
      activeModule.carcass.crossSectionProfile ||
      "flat_slab";
    const activeMatId =
      materialTarget === "carcass"
        ? activeModule.carcass.bodyMaterialId
        : activeModule.carcass.doorMaterialId;
    const hasBaseboardNotch = Boolean(activeModule.carcass.baseboardNotch?.enabled);

    return (
      <aside
        aria-label="Modül Parametreleri"
        data-testid="v11-right-inspector"
        className="fixed right-4 top-[78px] bottom-[84px] w-[372px] max-w-[calc(100vw-32px)] z-30 rounded-3xl bg-[#FAF8F4]/94 backdrop-blur-2xl border border-[#DFD9CE] shadow-[0_24px_60px_rgba(20,20,19,0.12)] flex flex-col overflow-hidden text-[#141413]"
      >
        {/* ÜST MODÜL SEÇİCİ VE AKSİYON BAŞLIĞI */}
        <div className="px-4 pt-3.5 pb-3 border-b border-[#E6E1D6] shrink-0 space-y-2.5">
          <div className="flex items-center justify-between gap-2">
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="text-[11px] font-bold uppercase tracking-wider text-[#8C7A6B]">
                  Modül {currentOrderIdx + 1} / {Math.max(1, mainModuleIndices.length)}
                </span>
                {mainModuleIndices.length > 1 && (
                  <div className="inline-flex items-center gap-0.5 ml-1">
                    <button
                      type="button"
                      onClick={() => {
                        const prev =
                          mainModuleIndices[
                            (currentOrderIdx - 1 + mainModuleIndices.length) %
                              mainModuleIndices.length
                          ];
                        if (prev) onSelectModuleIndex(prev.idx);
                      }}
                      className="w-5 h-5 rounded-full hover:bg-[#EFECE4] flex items-center justify-center cursor-pointer"
                      title="Önceki Modül"
                    >
                      <ChevronLeft className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        const next =
                          mainModuleIndices[(currentOrderIdx + 1) % mainModuleIndices.length];
                        if (next) onSelectModuleIndex(next.idx);
                      }}
                      className="w-5 h-5 rounded-full hover:bg-[#EFECE4] flex items-center justify-center cursor-pointer"
                      title="Sonraki Modül"
                    >
                      <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}
              </div>
              <h2 className="text-sm font-bold truncate mt-0.5">{activeModule.name}</h2>
              <p className="text-[11px] font-mono text-[#78716C]">
                {Math.round(wMm / 10)} × {Math.round(hMm / 10)} × {Math.round(dMm / 10)} cm •{" "}
                {activeModule.bays.length} Bölme
              </p>
            </div>

            <div className="relative flex items-center gap-1 shrink-0">
              <button
                type="button"
                onClick={() => setModuleMenuOpen((v) => !v)}
                title="Modül İşlemleri"
                className="w-8 h-8 rounded-full hover:bg-[#EFECE4] text-[#57534E] hover:text-[#141413] flex items-center justify-center transition cursor-pointer"
              >
                <MoreHorizontal className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={onToggleOpen}
                title="Paneli Daralt"
                className="w-8 h-8 rounded-full hover:bg-[#EFECE4] text-[#57534E] hover:text-[#141413] flex items-center justify-center transition cursor-pointer"
              >
                <ChevronRight className="w-4 h-4" />
              </button>

              {moduleMenuOpen && (
                <div className="absolute right-0 top-full mt-1.5 w-56 rounded-2xl bg-white border border-[#DFD9CE] shadow-xl p-1.5 z-50 text-xs">
                  <button
                    type="button"
                    onClick={() => {
                      setModuleMenuOpen(false);
                      onDuplicateActiveModule();
                    }}
                    className="w-full px-3 py-2 rounded-xl hover:bg-[#F5F2EA] flex items-center gap-2 text-left font-medium cursor-pointer"
                  >
                    <Copy className="w-3.5 h-3.5 text-[#57534E]" />
                    <span>Yanına Kopyala</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setModuleMenuOpen(false);
                      onAddStackedTopModule();
                    }}
                    className="w-full px-3 py-2 rounded-xl hover:bg-[#F5F2EA] flex items-center gap-2 text-left font-medium cursor-pointer"
                  >
                    <ArrowUpFromLine className="w-3.5 h-3.5 text-[#57534E]" />
                    <span>Üst Yüklük Modülü Ekle</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setModuleMenuOpen(false);
                      onRotateActiveModule90();
                    }}
                    className="w-full px-3 py-2 rounded-xl hover:bg-[#F5F2EA] flex items-center gap-2 text-left font-medium cursor-pointer"
                  >
                    <RotateCw className="w-3.5 h-3.5 text-[#57534E]" />
                    <span>90° Döndür</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setModuleMenuOpen(false);
                      onOpenCutoutModal();
                    }}
                    className="w-full px-3 py-2 rounded-xl hover:bg-[#F5F2EA] flex items-center gap-2 text-left font-medium cursor-pointer"
                  >
                    <Scissors className="w-3.5 h-3.5 text-[#57534E]" />
                    <span>Panel Kertme & Priz Kesimi</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setModuleMenuOpen(false);
                      onSaveModuleAsTemplate(`${activeModule.name} (Özel)`);
                    }}
                    className="w-full px-3 py-2 rounded-xl hover:bg-[#F5F2EA] flex items-center gap-2 text-left font-medium cursor-pointer"
                  >
                    <BookmarkPlus className="w-3.5 h-3.5 text-[#57534E]" />
                    <span>Özel Şablon Olarak Kaydet</span>
                  </button>
                  {mainModuleIndices.length > 1 && (
                    <button
                      type="button"
                      onClick={() => {
                        setModuleMenuOpen(false);
                        onRemoveActiveModule();
                      }}
                      className="w-full px-3 py-2 rounded-xl hover:bg-red-50 text-red-600 flex items-center gap-2 text-left font-medium cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Modülü Sil</span>
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>

          <div className="grid grid-cols-4 gap-1 p-1 rounded-2xl bg-[#ECE7DD]/85 border border-[#DFD9CE]">
            {(
              [
                { id: "dimensions", label: "Boyut" },
                { id: "interior", label: "İç Düzen" },
                { id: "doors", label: "Kapak" },
                { id: "materials", label: "Yüzey" },
              ] as const
            ).map((tb) => {
              const active = activeTab === tb.id;
              return (
                <button
                  key={tb.id}
                  type="button"
                  data-testid={`v11-tab-${tb.id}`}
                  onClick={() => onChangeTab(tb.id)}
                  className={`py-2 px-1 rounded-xl text-xs font-semibold transition cursor-pointer ${
                    active
                      ? "bg-[#141413] text-white shadow-2xs"
                      : "text-[#57534E] hover:text-[#141413]"
                  }`}
                >
                  {tb.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* KAYDIRILABİLİR İÇERİK ALANI */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4 text-xs">
          {/* ==================== SEKME 1: BOYUT & MİMARİ DETAYLAR ==================== */}
          {activeTab === "dimensions" && (
            <>
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold text-[#78716C]">Ölçü Birimi</span>
                <div className="inline-flex p-0.5 rounded-full bg-[#ECE7DD] border border-[#DFD9CE]">
                  {(["cm", "mm"] as const).map((u) => (
                    <button
                      key={u}
                      type="button"
                      onClick={() => setUnitMode(u)}
                      className={`px-3 py-1 rounded-full text-[11px] font-semibold transition cursor-pointer ${
                        unitMode === u ? "bg-white text-[#141413] shadow-2xs" : "text-[#57534E]"
                      }`}
                    >
                      {u}
                    </button>
                  ))}
                </div>
              </div>

              {(
                [
                  {
                    key: "width",
                    label: "Genişlik",
                    valMm: wMm,
                    minMm: isSlidingBay ? 1200 : 350,
                    maxMm: 3600,
                    stepMm: unitMode === "cm" ? 50 : 10,
                    presetsMm: isSlidingBay
                      ? [1500, 1800, 2200, 2600, 3000]
                      : [600, 900, 1200, 1800, 2400],
                    apply: (next: number) => onSetDimensions(next, hMm, dMm),
                  },
                  {
                    key: "height",
                    label: "Yükseklik",
                    valMm: hMm,
                    minMm: 400,
                    maxMm: 2900,
                    stepMm: unitMode === "cm" ? 50 : 10,
                    presetsMm: [520, 870, 2200, 2400, 2600],
                    apply: (next: number) => onSetDimensions(wMm, next, dMm),
                  },
                  {
                    key: "depth",
                    label: "Derinlik",
                    valMm: dMm,
                    minMm: isSlidingBay ? 600 : 300,
                    maxMm: 950,
                    stepMm: unitMode === "cm" ? 20 : 10,
                    presetsMm: isSlidingBay ? [600, 650, 700] : [400, 500, 600, 650],
                    apply: (next: number) => onSetDimensions(wMm, hMm, next),
                  },
                ] as const
              ).map((dim) => (
                <div
                  key={dim.key}
                  className="p-3.5 rounded-2xl bg-white border border-[#E5DFD3] space-y-3"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-[#141413] text-[13px]">{dim.label}</span>
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() =>
                          dim.apply(Math.max(dim.minMm, dim.valMm - dim.stepMm))
                        }
                        className="w-7 h-7 rounded-full bg-[#F5F2EA] hover:bg-[#E7E1D4] flex items-center justify-center cursor-pointer"
                      >
                        <Minus className="w-3.5 h-3.5" />
                      </button>
                      <div className="px-2.5 py-1 rounded-xl bg-[#FAF8F4] border border-[#DED8CC] font-mono font-bold text-[13px] min-w-[68px] text-center">
                        {formatVal(dim.valMm)}{" "}
                        <span className="text-[10px] font-normal text-[#78716C]">{unitMode}</span>
                      </div>
                      <button
                        type="button"
                        onClick={() =>
                          dim.apply(Math.min(dim.maxMm, dim.valMm + dim.stepMm))
                        }
                        className="w-7 h-7 rounded-full bg-[#F5F2EA] hover:bg-[#E7E1D4] flex items-center justify-center cursor-pointer"
                      >
                        <Plus className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  <input
                    type="range"
                    min={dim.minMm}
                    max={dim.maxMm}
                    step={10}
                    value={dim.valMm}
                    onPointerDown={() => onBeginSliderDrag?.()}
                    onPointerUp={() => onCommitSliderDrag?.()}
                    onPointerCancel={() => onCommitSliderDrag?.()}
                    onBlur={() => onCommitSliderDrag?.()}
                    onChange={(e) => dim.apply(Number(e.target.value))}
                    className="w-full accent-[#141413] cursor-pointer"
                  />

                  <div className="flex flex-wrap gap-1.5">
                    {dim.presetsMm.map((pMm) => {
                      const active = Math.abs(dim.valMm - pMm) < 5;
                      return (
                        <button
                          key={pMm}
                          type="button"
                          onClick={() => dim.apply(pMm)}
                          className={`px-2.5 py-1 rounded-full text-[11px] font-mono font-semibold transition cursor-pointer ${
                            active
                              ? "bg-[#141413] text-white"
                              : "bg-[#F5F2EA] hover:bg-[#EAE3D5] text-[#44403C]"
                          }`}
                        >
                          {unitMode === "cm" ? `${pMm / 10} cm` : `${pMm}`}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}

              {/* Baza Yüksekliği */}
              <div className="p-3.5 rounded-2xl bg-white border border-[#E5DFD3] space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-[#141413]">Alt Baza Yüksekliği</span>
                  <span className="font-mono text-[#78716C]">
                    {plinthMm === 0 ? "Bazasız" : `${Math.round(plinthMm / 10)} cm`}
                  </span>
                </div>
                <div className="grid grid-cols-4 gap-1.5">
                  {[
                    { mm: 0, label: "Yok" },
                    { mm: 60, label: "6 cm" },
                    { mm: 80, label: "8 cm" },
                    { mm: 100, label: "10 cm" },
                  ].map((pl) => (
                    <button
                      key={pl.mm}
                      type="button"
                      onClick={() => onSetPlinthHeight(pl.mm)}
                      className={`py-2 rounded-xl font-semibold transition cursor-pointer ${
                        Math.abs(plinthMm - pl.mm) < 5
                          ? "bg-[#141413] text-white"
                          : "bg-[#F5F2EA] hover:bg-[#EAE3D5] text-[#44403C]"
                      }`}
                    >
                      {pl.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Mimari Bitişler, Desen Takibi ve Kertme */}
              <div className="p-3.5 rounded-2xl bg-white border border-[#E5DFD3] space-y-2.5">
                <div className="font-bold text-[#141413]">Mimari Detaylar & Desen Takibi</div>

                <div className="flex items-center justify-between py-1">
                  <div>
                    <div className="font-semibold text-[11.5px]">Cephe Ahşap Desen Takibi</div>
                    <div className="text-[10px] text-[#78716C]">
                      Kapak ve çekmecelerde kesintisiz damar sürekliliği
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => onToggleFacadeGrainContinuity(!facadeGrainContinuity)}
                    className={`px-3 py-1 rounded-full text-[10.5px] font-semibold cursor-pointer ${
                      facadeGrainContinuity
                        ? "bg-[#141413] text-white"
                        : "bg-[#F5F2EA] text-[#44403C]"
                    }`}
                  >
                    {facadeGrainContinuity ? "Açık" : "Kapalı"}
                  </button>
                </div>

                <div className="flex items-center justify-between py-1 border-t border-[#F0ECE3]">
                  <div>
                    <div className="font-semibold text-[11.5px]">Arka Süpürgelik Çentiği</div>
                    <div className="text-[10px] text-[#78716C]">
                      Duvara sıfır yanaşma için yan dikme alt çentiği (80×15 mm)
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() =>
                      onUpdateCarcassConfig({
                        baseboardNotch: {
                          enabled: !hasBaseboardNotch,
                          heightMm: 80,
                          depthMm: 15,
                        },
                      })
                    }
                    className={`px-3 py-1 rounded-full text-[10.5px] font-semibold cursor-pointer ${
                      hasBaseboardNotch
                        ? "bg-[#141413] text-white"
                        : "bg-[#F5F2EA] text-[#44403C]"
                    }`}
                  >
                    {hasBaseboardNotch ? "Açık" : "Kapalı"}
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-1.5 pt-1 border-t border-[#F0ECE3]">
                  <button
                    type="button"
                    onClick={onRunAutoFillersAndCrown}
                    className="py-2 px-2.5 rounded-xl bg-[#F5F2EA] hover:bg-[#EAE3D5] text-[11px] font-semibold cursor-pointer"
                  >
                    + Otomatik Taç & Bitiş
                  </button>
                  <button
                    type="button"
                    onClick={onOpenCutoutModal}
                    className="py-2 px-2.5 rounded-xl bg-[#F5F2EA] hover:bg-[#EAE3D5] text-[11px] font-semibold flex items-center justify-center gap-1 cursor-pointer"
                  >
                    <Scissors className="w-3 h-3" />
                    <span>Panel Kertme</span>
                  </button>
                </div>
              </div>
            </>
          )}

          {/* ==================== SEKME 2: İÇ DÜZEN ==================== */}
          {activeTab === "interior" && (
            <>
              <div className="p-3.5 rounded-2xl bg-white border border-[#E5DFD3] space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-[#141413]">
                    Bölme Seçimi ({activeModule.bays.length})
                  </span>
                  <button
                    type="button"
                    onClick={() => onSplitBayIntoTwo(safeBayIdx)}
                    className="px-2.5 py-1 rounded-full bg-[#141413] hover:bg-[#292524] text-white text-[11px] font-semibold flex items-center gap-1 cursor-pointer"
                  >
                    <Plus className="w-3 h-3" />
                    <span>Bölme Ekle</span>
                  </button>
                </div>

                <div className="flex flex-wrap gap-1.5">
                  {activeModule.bays.map((b, idx) => {
                    const isSel = idx === safeBayIdx;
                    const clearCm = Math.round((bayClearWidths[idx] || 600) / 10);
                    return (
                      <button
                        key={b.index}
                        type="button"
                        onClick={() => onSelectBayIndex(idx)}
                        className={`px-3 py-1.5 rounded-full text-[11px] font-semibold flex items-center gap-1.5 transition cursor-pointer ${
                          isSel
                            ? "bg-[#141413] text-white shadow-2xs"
                            : "bg-[#F5F2EA] hover:bg-[#EAE3D5] text-[#44403C]"
                        }`}
                      >
                        <span>{idx + 1}. Bölme</span>
                        <span
                          className={`font-mono text-[10px] ${
                            isSel ? "text-[#D6C7B2]" : "text-[#78716C]"
                          }`}
                        >
                          {clearCm} cm
                        </span>
                      </button>
                    );
                  })}
                </div>

                {activeModule.bays.length > 1 && (
                  <div className="flex items-center gap-2 pt-1 border-t border-[#F0ECE3]">
                    <button
                      type="button"
                      onClick={onEqualizeBaysAndShelves}
                      className="flex-1 py-1.5 rounded-xl bg-[#F5F2EA] hover:bg-[#EAE3D5] text-[11px] font-semibold text-[#44403C] cursor-pointer"
                    >
                      Genişlikleri Eşitle
                    </button>
                    {!(isSlidingBay && activeModule.bays.length <= 2) && (
                      <button
                        type="button"
                        onClick={() => onRemoveBayAt(safeBayIdx)}
                        className="py-1.5 px-3 rounded-xl hover:bg-red-50 text-[11px] font-semibold text-red-600 cursor-pointer"
                      >
                        {safeBayIdx + 1}. Bölmeyi Kaldır
                      </button>
                    )}
                  </div>
                )}

                {!isSimple && activeModule.bays.length > 1 && (
                  <div className="pt-2 border-t border-[#F0ECE3] space-y-1">
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="text-[#57534E]">{safeBayIdx + 1}. Bölme İç Genişlik</span>
                      <span className="font-mono font-bold">
                        {Math.round(bayClearWidths[safeBayIdx] || 600)} mm
                      </span>
                    </div>
                    <input
                      type="range"
                      min={280}
                      max={Math.max(400, wMm - 320)}
                      step={10}
                      value={Math.round(bayClearWidths[safeBayIdx] || 600)}
                      onPointerDown={() => onBeginSliderDrag?.()}
                      onPointerUp={() => onCommitSliderDrag?.()}
                      onPointerCancel={() => onCommitSliderDrag?.()}
                      onBlur={() => onCommitSliderDrag?.()}
                      onChange={(e) => onSetBayCustomWidth(safeBayIdx, Number(e.target.value))}
                      className="w-full accent-[#141413] cursor-pointer"
                    />
                  </div>
                )}
              </div>

              {formattedFinding && activeFinding && (
                <div className="p-3.5 rounded-2xl bg-[#F7F2E7] border border-[#E3D5B8] space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-bold text-[#6B4F28] flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5" />
                      <span>{formattedFinding.title}</span>
                    </span>
                  </div>
                  <p className="text-[11px] text-[#57534E] leading-relaxed">
                    {formattedFinding.detail}
                  </p>
                  {activeFinding.remediationProposals &&
                    activeFinding.remediationProposals.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 pt-0.5">
                        {activeFinding.remediationProposals.slice(0, 2).map((prop) => (
                          <button
                            key={prop.id}
                            type="button"
                            onClick={() => onApplyApprovedFix(prop)}
                            className="px-3 py-1.5 rounded-full bg-[#141413] hover:bg-[#292524] text-white text-[11px] font-semibold cursor-pointer transition"
                          >
                            Uygula: {prop.label}
                          </button>
                        ))}
                      </div>
                    )}
                </div>
              )}

              <div className="space-y-2">
                <div className="text-[11px] font-bold text-[#57534E] px-0.5">
                  {safeBayIdx + 1}. Bölme Hazır İç Düzeni
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {V11_INTERIOR_PRESETS.map((pr) => (
                    <button
                      key={pr.id}
                      type="button"
                      onClick={() => onApplyBayPreset(safeBayIdx, pr.id)}
                      className="p-2.5 rounded-2xl bg-white hover:bg-[#F5F2EA] border border-[#E5DFD3] hover:border-[#141413]/40 flex items-center gap-2.5 text-left transition cursor-pointer"
                    >
                      {renderPresetSvg(pr.diagram)}
                      <div className="min-w-0">
                        <div className="font-bold text-[#141413] text-xs">{pr.title}</div>
                        <div className="text-[10.5px] text-[#78716C] leading-tight mt-0.5">
                          {pr.subtitle}
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <div className="text-[11px] font-bold text-[#57534E] px-0.5">
                  + İç Eleman Ekle
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    {
                      label: "Hareketli Raf",
                      count:
                        activeBay?.shelves.filter(
                          (s) => !s.isHidden && s.isAdjustable !== false && !s.isFixed
                        ).length || 0,
                      onClick: () => onAddShelf(safeBayIdx),
                    },
                    {
                      label: "Sabit Taşıyıcı Raf",
                      count:
                        activeBay?.shelves.filter(
                          (s) => !s.isHidden && (s.isAdjustable === false || Boolean(s.isFixed))
                        ).length || 0,
                      onClick: () => onAddFixedShelf(safeBayIdx),
                    },
                    ...(isSlidingBay
                      ? []
                      : [
                          {
                            label: "Dış Çekmece",
                            count: activeBay?.drawers.filter((d) => !d.isInternal).length || 0,
                            onClick: () => onAddDrawer(safeBayIdx),
                          },
                        ]),
                    {
                      label: isSlidingBay ? "Sürgü İçi Çekmece" : "Gizli İç Çekmece",
                      count:
                        activeBay?.drawers.filter((d) => Boolean(d.isInternal) || isSlidingBay)
                          .length || 0,
                      onClick: () => onAddInternalDrawer(safeBayIdx),
                    },
                    {
                      label: "Elbise Askısı",
                      count: activeBay?.hangingRails.length || 0,
                      onClick: () => onAddHangingRail(safeBayIdx),
                    },
                    {
                      label: "Pantolonluk",
                      count:
                        activeBay?.specialFittings.filter((f) => f.type === "trouser_rack")
                          .length || 0,
                      onClick: () => onAddSpecialFitting(safeBayIdx, "trouser_rack"),
                    },
                    {
                      label: "Ayakkabılık",
                      count:
                        activeBay?.specialFittings.filter((f) => f.type === "shoe_rack").length ||
                        0,
                      onClick: () => onAddSpecialFitting(safeBayIdx, "shoe_rack"),
                    },
                    {
                      label: "Raf Arası Dikme",
                      count: activeBay?.subDividers?.length || 0,
                      onClick: () => onAddSubDivider(safeBayIdx),
                    },
                    {
                      label: "Takı Çekmecesi",
                      count:
                        activeBay?.specialFittings.filter((f) => f.type === "jewelry_tray")
                          .length || 0,
                      onClick: () => onAddSpecialFitting(safeBayIdx, "jewelry_tray"),
                    },
                  ].map((item) => (
                    <button
                      key={item.label}
                      type="button"
                      onClick={item.onClick}
                      className="px-3 py-2.5 rounded-2xl bg-white hover:bg-[#F5F2EA] border border-[#E5DFD3] flex items-center justify-between gap-2 text-left transition cursor-pointer"
                    >
                      <span className="font-semibold text-[#141413] text-[11.5px] leading-snug">
                        {item.label}
                      </span>
                      <span className="w-6 h-6 rounded-full bg-[#F5F2EA] text-[#141413] text-[11px] font-bold flex items-center justify-center shrink-0">
                        {item.count > 0 ? item.count : "+"}
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              {activeBay && (
                <div className="p-3.5 rounded-2xl bg-white border border-[#E5DFD3] space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-[#141413]">
                      {safeBayIdx + 1}. Bölmedeki Elemanlar
                    </span>
                    {!isSimple && activeBay.shelves.length > 0 && (
                      <button
                        type="button"
                        onClick={() => {
                          const curThick =
                            activeBay.shelves[0]?.thickness ||
                            activeModule.carcass.panelThickness ||
                            18;
                          onSetShelfThickness(safeBayIdx, "all", curThick === 25 ? 18 : 25);
                        }}
                        className="px-2 py-0.5 rounded-full bg-[#F5F2EA] hover:bg-[#EAE3D5] text-[10.5px] font-semibold cursor-pointer"
                      >
                        Tüm Raflar: {activeBay.shelves[0]?.thickness || activeModule.carcass.panelThickness || 18} mm
                      </button>
                    )}
                  </div>

                  {activeBay.shelves.length > 0 && (
                    <div className="space-y-1.5">
                      {activeBay.shelves.map((sh, i) => {
                        const isFixedSh = sh.isAdjustable === false || Boolean(sh.isFixed);
                        const connType = sh.fixedConnectorType || "minifix_dowel";
                        const shThick = sh.thickness || activeModule.carcass.panelThickness || 18;
                        return (
                          <div
                            key={sh.id}
                            className={`flex items-center justify-between gap-1.5 px-2.5 py-1.5 rounded-xl border text-[11px] ${
                              isFixedSh
                                ? "bg-[#F6EFE2] border-[#DFCFAF]"
                                : "bg-[#F8F6F1] border-[#E6E1D6]"
                            }`}
                          >
                            <div className="flex items-center gap-1.5 min-w-0">
                              <span className="font-bold text-[#141413] shrink-0">
                                Raf {i + 1}
                              </span>
                              <button
                                type="button"
                                onClick={() =>
                                  onSetShelfMountType(safeBayIdx, sh.id, isFixedSh, connType)
                                }
                                title={
                                  isFixedSh
                                    ? "Sabit taşıyıcı raf (gövdeyi birbirine kilitler) — hareketli rafa çevirmek için tıklayın"
                                    : "Hareketli raf (Sistem 32 Ø5mm pimli) — sabit taşıyıcı rafa çevirmek için tıklayın"
                                }
                                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold transition cursor-pointer ${
                                  isFixedSh
                                    ? "bg-[#141413] text-[#F5EFE6]"
                                    : "bg-white border border-[#DAD3C5] text-[#44403C] hover:bg-[#EFECE4]"
                                }`}
                              >
                                {isFixedSh ? (
                                  <>
                                    <Lock className="w-2.5 h-2.5" />
                                    <span>Sabit</span>
                                  </>
                                ) : (
                                  <>
                                    <ArrowUpDown className="w-2.5 h-2.5" />
                                    <span>Hareketli</span>
                                  </>
                                )}
                              </button>

                              {!isSimple && isFixedSh && (
                                <button
                                  type="button"
                                  onClick={() =>
                                    onSetShelfMountType(
                                      safeBayIdx,
                                      sh.id,
                                      false,
                                      connType === "rafix_20" ? "minifix_dowel" : "rafix_20"
                                    )
                                  }
                                  title="Sabit raf bağlantı tipini değiştir (Minifix 15 + Kavela veya Rafix 20)"
                                  className="px-1.5 py-0.5 rounded bg-white/90 border border-[#D8C8AA] text-[9.5px] font-mono font-semibold text-[#6B4F28] cursor-pointer"
                                >
                                  {connType === "rafix_20" ? "Rafix 20" : "Minifix"}
                                </button>
                              )}
                            </div>

                            <div className="flex items-center gap-1 shrink-0">
                              {!isSimple ? (
                                <>
                                  <input
                                    type="number"
                                    value={Math.round(sh.elevationY)}
                                    onChange={(e) =>
                                      onSetShelfElevation(
                                        safeBayIdx,
                                        sh.id,
                                        Math.max(64, Number(e.target.value) || 0)
                                      )
                                    }
                                    className="w-12 px-1 py-0.5 rounded bg-white border border-[#DED8CC] font-mono text-[10px] text-center"
                                    title="Alt tabladan yükseklik (mm)"
                                  />
                                  <span className="text-[9.5px] font-mono text-[#78716C]">
                                    {shThick}mm
                                  </span>
                                </>
                              ) : (
                                <span className="text-[10px] font-mono text-[#78716C]">
                                  {Math.round(sh.elevationY / 10)} cm
                                </span>
                              )}
                              <button
                                type="button"
                                onClick={() => onRemoveShelf(safeBayIdx, sh.id)}
                                className="w-5 h-5 rounded-full hover:bg-red-50 text-[#78716C] hover:text-red-600 flex items-center justify-center cursor-pointer"
                                title="Rafı Kaldır"
                              >
                                ✕
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  <div className="flex flex-wrap gap-1.5">

                    {activeBay.drawers.map((dr, i) => (
                      <span
                        key={dr.id}
                        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#F5F2EA] text-[11px] font-medium"
                      >
                        <span>
                          {dr.isInternal || isSlidingBay ? "İç Çekmece" : "Çekmece"} {i + 1}
                        </span>
                        <button
                          type="button"
                          onClick={() => onRemoveDrawer(safeBayIdx, dr.id)}
                          className="text-[#78716C] hover:text-red-600 cursor-pointer"
                        >
                          ✕
                        </button>
                      </span>
                    ))}

                    {activeBay.hangingRails.map((hr, i) => (
                      <span
                        key={hr.id}
                        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#F5F2EA] text-[11px] font-medium"
                      >
                        <span>Askı {i + 1}</span>
                        <button
                          type="button"
                          onClick={() => onRemoveHangingRail(safeBayIdx, hr.id)}
                          className="text-[#78716C] hover:text-red-600 cursor-pointer"
                        >
                          ✕
                        </button>
                      </span>
                    ))}

                    {activeBay.specialFittings.map((sf, i) => (
                      <span
                        key={sf.id}
                        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#F5F2EA] text-[11px] font-medium"
                      >
                        <span>Aksesuar {i + 1}</span>
                        <button
                          type="button"
                          onClick={() => onRemoveSpecialFitting(safeBayIdx, sf.id)}
                          className="text-[#78716C] hover:text-red-600 cursor-pointer"
                        >
                          ✕
                        </button>
                      </span>
                    ))}

                    {(activeBay.subDividers || []).map((sd, i) => (
                      <span
                        key={sd.id}
                        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#F5F2EA] text-[11px] font-medium"
                      >
                        <span>Ara Dikme {i + 1}</span>
                        <button
                          type="button"
                          onClick={() => onRemoveSubDivider(safeBayIdx, sd.id)}
                          className="text-[#78716C] hover:text-red-600 cursor-pointer"
                        >
                          ✕
                        </button>
                      </span>
                    ))}

                    {activeBay.shelves.length === 0 &&
                      activeBay.drawers.length === 0 &&
                      activeBay.hangingRails.length === 0 &&
                      activeBay.specialFittings.length === 0 && (
                        <span className="text-[11px] text-[#78716C]">
                          Bu bölmede henüz iç eleman yok. Yukarıdan ekleyebilirsiniz.
                        </span>
                      )}
                  </div>
                </div>
              )}
            </>
          )}

          {/* ==================== SEKME 3: KAPAK & DONANIM ==================== */}
          {activeTab === "doors" && (
            <>
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

                <div className="grid grid-cols-5 gap-1.5">
                  {(
                    [
                      { id: "double", label: "Çift" },
                      { id: "single_left", label: "Sol" },
                      { id: "single_right", label: "Sağ" },
                      { id: "sliding", label: "Sürgü" },
                      { id: "open", label: "Açık" },
                    ] as const
                  ).map((dt) => {
                    const active = curDoorType === dt.id;
                    return (
                      <button
                        key={dt.id}
                        type="button"
                        onClick={() => onSetBayDoorType(safeBayIdx, dt.id)}
                        className={`py-2 px-1 rounded-xl text-[11px] font-semibold transition cursor-pointer ${
                          active
                            ? "bg-[#141413] text-white"
                            : "bg-[#F5F2EA] hover:bg-[#EAE3D5] text-[#44403C]"
                        }`}
                      >
                        {dt.label}
                      </button>
                    );
                  })}
                </div>

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

              {curDoorType !== "open" && (
                <div className="p-3.5 rounded-2xl bg-white border border-[#E5DFD3] space-y-2.5">
                  <div className="font-bold text-[#141413]">Kapak Modeli</div>
                  <div className="grid grid-cols-2 gap-2">
                    {V11_DOOR_PROFILES.map((pf) => {
                      const active = curDoorProfile === pf.id;
                      return (
                        <button
                          key={pf.id}
                          type="button"
                          onClick={() =>
                            onSetBayV4DoorConfig(safeBayIdx, {
                              crossSectionProfile: pf.id,
                              isGlassFramed: Boolean(pf.isGlass),
                            })
                          }
                          className={`p-2.5 rounded-2xl border text-left transition cursor-pointer ${
                            active
                              ? "bg-[#141413] text-white border-[#141413]"
                              : "bg-[#FAF8F4] hover:bg-[#F2EEE4] border-[#E5DFD3] text-[#141413]"
                          }`}
                        >
                          <div className="font-bold text-xs">{pf.label}</div>
                          <div
                            className={`text-[10px] mt-0.5 ${
                              active ? "text-[#D6C7B2]" : "text-[#78716C]"
                            }`}
                          >
                            {pf.subtitle}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {curDoorType !== "open" && !isSlidingBay && (
                <div className="p-3.5 rounded-2xl bg-white border border-[#E5DFD3] space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-[#141413]">Kulp Stili</span>
                    <button
                      type="button"
                      onClick={onOpenCustomHardwareModal}
                      className="text-[11px] font-semibold text-[#8C7A6B] hover:text-[#141413] cursor-pointer"
                    >
                      + Özel Kulp Tanımla
                    </button>
                  </div>
                  <div className="grid grid-cols-2 gap-1.5">
                    {handleProfiles.slice(0, 6).map((hp) => {
                      const active = (activeBay?.door?.handleProfileId || "K019") === hp.id;
                      return (
                        <button
                          key={hp.id}
                          type="button"
                          onClick={() =>
                            onSetBayV4DoorConfig(safeBayIdx, {
                              handleProfileId: hp.id,
                              handleCategory: hp.category,
                            })
                          }
                          className={`py-2 px-2.5 rounded-xl text-[11px] font-semibold truncate text-left transition cursor-pointer ${
                            active
                              ? "bg-[#141413] text-white"
                              : "bg-[#F5F2EA] hover:bg-[#EAE3D5] text-[#44403C]"
                          }`}
                        >
                          {hp.name}
                        </button>
                      );
                    })}
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
                        type="number"
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
                                ? "hw_blum_clip_top_blind_95"
                                : "hw_blum_clip_top_110",
                          });
                        }}
                        className="w-full h-8 px-2.5 rounded-xl bg-[#FAF8F4] border border-[#DED8CC] font-mono text-xs"
                      />
                    </label>
                    <label className="space-y-1">
                      <span className="text-[10.5px] text-[#57534E]">Sağ Kör Klapa (mm)</span>
                      <input
                        type="number"
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
                            hardwareProductId: "hw_blum_clip_top_blind_95",
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
                            hardwareProductId: "hw_blum_clip_top_110",
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
                        type="number"
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
                        type="number"
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

          {/* ==================== SEKME 4: YÜZEY, ÖZEL RENK & IŞIK ==================== */}
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

                <div className="flex items-center justify-between gap-2 pt-1 border-t border-[#F0ECE3]">
                  <div>
                    <div className="font-semibold text-[#141413] text-[11.5px]">
                      Görünen Yanlar Kapak Rengi Olsun
                    </div>
                    <div className="text-[10px] text-[#78716C]">
                      Ek panel eklemeden yan dikmeleri kapak malzemesiyle üretir
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      type="button"
                      onClick={() =>
                        onUpdateCarcassConfig({
                          exposedLeftSideUseDoorMaterial:
                            !activeModule.carcass.exposedLeftSideUseDoorMaterial,
                        })
                      }
                      className={`px-2.5 py-1 rounded-full text-[10.5px] font-semibold transition cursor-pointer ${
                        activeModule.carcass.exposedLeftSideUseDoorMaterial
                          ? "bg-[#141413] text-white"
                          : "bg-[#F5F2EA] text-[#44403C]"
                      }`}
                    >
                      Sol
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        onUpdateCarcassConfig({
                          exposedRightSideUseDoorMaterial:
                            !activeModule.carcass.exposedRightSideUseDoorMaterial,
                        })
                      }
                      className={`px-2.5 py-1 rounded-full text-[10.5px] font-semibold transition cursor-pointer ${
                        activeModule.carcass.exposedRightSideUseDoorMaterial
                          ? "bg-[#141413] text-white"
                          : "bg-[#F5F2EA] text-[#44403C]"
                      }`}
                    >
                      Sağ
                    </button>
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

                {customMatOpen && (
                  <div className="p-3 rounded-2xl bg-white border border-[#DED8CC] space-y-2">
                    <div className="font-bold text-[11.5px]">Özel RAL / Kartela Rengi Ekle</div>
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
                        placeholder="Örn: RAL 7044 İpek Gri"
                        className="flex-1 h-9 px-2.5 rounded-xl bg-[#FAF8F4] border border-[#DED8CC] text-xs"
                      />
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex gap-1">
                        {(
                          [
                            { id: "lacquer", label: "Mat Lake" },
                            { id: "wood", label: "Ahşap" },
                            { id: "stone", label: "Taş" },
                          ] as const
                        ).map((c) => (
                          <button
                            key={c.id}
                            type="button"
                            onClick={() => setNewMatCat(c.id)}
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
                      <button
                        type="button"
                        onClick={() => {
                          if (!newMatName.trim()) return;
                          onAddCustomMaterial({
                            name: newMatName.trim(),
                            category: newMatCat,
                            colorHex: newMatHex,
                            roughness: newMatCat === "lacquer" ? 0.38 : 0.62,
                            costPerM2: 45,
                            hasGrain: newMatCat === "wood",
                          });
                          setNewMatName("");
                          setCustomMatOpen(false);
                        }}
                        className="px-3 py-1.5 rounded-full bg-[#141413] text-white text-[11px] font-semibold cursor-pointer"
                      >
                        Kartelaya Ekle
                      </button>
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-3 gap-2">
                  {visibleMaterials.map((mat) => {
                    const isSelected = activeMatId === mat.id;
                    return (
                      <button
                        key={mat.id}
                        type="button"
                        onClick={() => onApplyMaterialScope(materialTarget, mat.id)}
                        className={`p-2 rounded-2xl border text-left transition cursor-pointer ${
                          isSelected
                            ? "bg-white border-[#141413] ring-2 ring-[#141413]/15"
                            : "bg-white/85 hover:bg-white border-[#E5DFD3]"
                        }`}
                      >
                        <div
                          className="w-full h-12 rounded-xl border border-black/10 relative mb-1.5 shadow-inner"
                          style={{
                            backgroundColor: mat.colorHex,
                            backgroundImage: mat.hasGrain
                              ? "repeating-linear-gradient(90deg, rgba(255,255,255,0.06) 0px, rgba(0,0,0,0.05) 3px, transparent 7px)"
                              : undefined,
                          }}
                        >
                          {isSelected && (
                            <span className="absolute top-1.5 right-1.5 w-4 h-4 rounded-full bg-[#141413] text-white flex items-center justify-center">
                              <Check className="w-2.5 h-2.5" />
                            </span>
                          )}
                        </div>
                        <div className="text-[11px] font-semibold text-[#141413] leading-tight line-clamp-2">
                          {mat.name}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="p-3.5 rounded-2xl bg-white border border-[#E5DFD3] space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-[#141413] flex items-center gap-1.5">
                    <Lightbulb className="w-4 h-4 text-amber-500" />
                    <span>Gömme İç LED Aydınlatma</span>
                  </span>
                  <button
                    type="button"
                    onClick={() =>
                      onToggleModuleLed(!activeModule.carcass.ledLightingEnabled, {
                        colorTempK: activeModule.carcass.ledColorTempK || 3000,
                      })
                    }
                    className={`px-3 py-1 rounded-full text-[11px] font-semibold transition cursor-pointer ${
                      activeModule.carcass.ledLightingEnabled
                        ? "bg-[#141413] text-white"
                        : "bg-[#F5F2EA] text-[#44403C]"
                    }`}
                  >
                    {activeModule.carcass.ledLightingEnabled ? "Açık" : "Kapalı"}
                  </button>
                </div>

                {activeModule.carcass.ledLightingEnabled && (
                  <div className="grid grid-cols-3 gap-1.5 pt-1">
                    {(
                      [
                        { k: 2700, label: "2700K Sıcak" },
                        { k: 3000, label: "3000K Doğal" },
                        { k: 4000, label: "4000K Gün" },
                      ] as const
                    ).map((temp) => {
                      const active = (activeModule.carcass.ledColorTempK || 3000) === temp.k;
                      return (
                        <button
                          key={temp.k}
                          type="button"
                          onClick={() => onToggleModuleLed(true, { colorTempK: temp.k })}
                          className={`py-1.5 rounded-xl text-[11px] font-semibold cursor-pointer ${
                            active
                              ? "bg-[#141413] text-white"
                              : "bg-[#F5F2EA] text-[#44403C]"
                          }`}
                        >
                          {temp.label}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </aside>
    );
  }
);

RightParametricInspector.displayName = "RightParametricInspector";
