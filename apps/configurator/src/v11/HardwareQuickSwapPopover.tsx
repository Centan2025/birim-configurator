"use client";

import React, { useMemo, useState } from "react";
import { X, Check, ArrowLeftRight, Search, Sparkles, AlertTriangle } from "lucide-react";
import { HandleCrossSectionSvg, getHandleCrossSectionMeta } from "./HandleCrossSectionSvg";
import {
  isHandleProfileCompatibleWithModuleBay,
  type DrawerConfig,
  type HangingRailConfig,
  type ModuleInstance,
  type DoorConfig,
} from "@birim/core";
import {
  getAllHardwareProducts,
  getAllHandleProfiles,
  type HardwareProductRecord,
  type HandleProfileDefinition,
} from "@birim/catalog";

export type HardwareSwapGroup = "hinge" | "handle" | "drawer_slide" | "rail";

export interface HardwareSwapTarget {
  group: HardwareSwapGroup;
  bayIndex: number;
  componentId?: string | null;
  sku?: string | null;
}

export interface HardwareQuickSwapPopoverProps {
  target: HardwareSwapTarget;
  activeModule: ModuleInstance;
  isInspectorOpen?: boolean;
  onApplyDoorHardware: (
    bayIndices: number[],
    patch: Partial<DoorConfig>,
    toastMessage: string
  ) => void;
  onApplyDrawerHardware: (
    bayIndices: number[],
    patch: Partial<DrawerConfig>,
    toastMessage: string
  ) => void;
  onApplyRailProfile: (
    bayIndices: number[],
    profileType: NonNullable<HangingRailConfig["profileType"]>,
    toastMessage: string
  ) => void;
  onClose: () => void;
}

const RAIL_PROFILE_OPTIONS: Array<{
  id: NonNullable<HangingRailConfig["profileType"]>;
  name: string;
  brand: string;
  spec: string;
  priceEur: number;
}> = [
  {
    id: "oval_30x15",
    name: "Standart Oval Askı Borusu",
    brand: "Birim Krom",
    spec: "30×15 mm Çelik • 25 kg/m",
    priceEur: 14,
  },
  {
    id: "round_25",
    name: "Yuvarlak Askı Borusu Ø25",
    brand: "Birim Krom",
    spec: "Ø25 mm Boru • 20 kg/m",
    priceEur: 12,
  },
  {
    id: "brass_25",
    name: "Fırçalı Pirinç Askı Borusu",
    brand: "Birim Gold",
    spec: "Ø25 mm Pirinç • 22 kg/m",
    priceEur: 26,
  },
  {
    id: "led_black_30x15",
    name: "Entegre LED'li Siyah Askı Borusu",
    brand: "Häfele Loox5",
    spec: "30×15 mm 3000K Sensörlü LED",
    priceEur: 68,
  },
  {
    id: "lift_pantograph",
    name: "Asansör Askı (Pantograf)",
    brand: "Häfele Servetto",
    spec: "Aşağı İnen Mekanizma • 12 kg",
    priceEur: 145,
  },
];

const GROUP_META: Record<HardwareSwapGroup, { title: string; subtitle: string }> = {
  hinge: {
    title: "Menteşe Sistemi Değiştir",
    subtitle: "Kapak menteşesini uyumlu alternatiflerle tek tıkla değiştirin",
  },
  handle: {
    title: "Kulp / Profil Değiştir",
    subtitle: "Kapak ve çekmece kulp profilini anında güncelleyin",
  },
  drawer_slide: {
    title: "Çekmece Ray / Kutu Sistemi",
    subtitle: "Çekmece ray ve kutu sistemini alternatifleriyle karşılaştırın",
  },
  rail: {
    title: "Askı Borusu / Mekanizma",
    subtitle: "Bölmedeki askı borusu tipini veya asansör mekanizmasını seçin",
  },
};

function formatDeltaEur(delta: number): { text: string; tone: "same" | "up" | "down" } {
  const rounded = Math.round(delta);
  if (Math.abs(rounded) < 1) return { text: "Aynı Fiyat", tone: "same" };
  if (rounded > 0) return { text: `+€${rounded}`, tone: "up" };
  return { text: `-€${Math.abs(rounded)}`, tone: "down" };
}

export const HardwareQuickSwapPopover: React.FC<HardwareQuickSwapPopoverProps> = React.memo(
  ({
    target,
    activeModule,
    isInspectorOpen = true,
    onApplyDoorHardware,
    onApplyDrawerHardware,
    onApplyRailProfile,
    onClose,
  }) => {
    const [applyAllBays, setApplyAllBays] = useState(false);
    const [searchQuery, setSearchQuery] = useState("");
    const [activeGroup, setActiveGroup] = useState<HardwareSwapGroup>(target.group);

    React.useEffect(() => {
      setActiveGroup(target.group);
      setSearchQuery("");
    }, [target.group, target.bayIndex, target.componentId]);

    const safeBayIdx = Math.min(target.bayIndex, Math.max(0, activeModule.bays.length - 1));
    const bay = activeModule.bays[safeBayIdx];
    const targetBayIndices = useMemo(
      () =>
        applyAllBays
          ? activeModule.bays.map((_, idx) => idx)
          : [safeBayIdx],
      [applyAllBays, activeModule.bays, safeBayIdx]
    );

    const doorThickMm = activeModule.carcass.doorThickness || activeModule.carcass.panelThickness || 18;
    const allHardware = useMemo(() => getAllHardwareProducts(), []);
    const allHandles = useMemo(() => getAllHandleProfiles(), []);

    const currentDoorHwId = bay?.door?.hardwareProductId || "hw_blum_71b3550";
    const currentHandleProfileId = bay?.door?.handleProfileId || "K019";
    const currentDrawerHwId =
      bay?.drawers?.[0]?.hardwareProductId || "hw_blum_tandembox_m30";
    const currentRailProfile =
      bay?.hangingRails?.[0]?.profileType || "oval_30x15";

    const currentPriceEur = useMemo(() => {
      if (activeGroup === "hinge") {
        return allHardware.find((h) => h.id === currentDoorHwId)?.unitPriceEur ?? 0;
      }
      if (activeGroup === "drawer_slide") {
        return allHardware.find((h) => h.id === currentDrawerHwId)?.unitPriceEur ?? 0;
      }
      if (activeGroup === "handle") {
        return allHandles.find((h) => h.id === currentHandleProfileId || h.sku === currentHandleProfileId)?.unitPriceEur ?? 0;
      }
      return RAIL_PROFILE_OPTIONS.find((r) => r.id === currentRailProfile)?.priceEur ?? 14;
    }, [
      activeGroup,
      allHardware,
      allHandles,
      currentDoorHwId,
      currentDrawerHwId,
      currentHandleProfileId,
      currentRailProfile,
    ]);

    const q = searchQuery.trim().toLowerCase();

    const hingeOptions = useMemo<HardwareProductRecord[]>(() => {
      const doorSys = bay?.door?.doorSystemId || "";
      const targetFamily = doorSys.startsWith("lift")
        ? "fam_lift_system"
        : doorSys.startsWith("sliding")
        ? "fam_sliding_system"
        : doorSys.startsWith("pocket")
        ? "fam_pocket_system"
        : "fam_hinge_concealed";
      return allHardware
        .filter((h) => h.familyId === targetFamily && h.lifecycleStatus !== "DEPRECATED")
        .filter((h) =>
          !q
            ? true
            : `${h.manufacturerName} ${h.name} ${h.sku} ${h.series || ""}`
                .toLowerCase()
                .includes(q)
        );
    }, [allHardware, bay?.door?.doorSystemId, q]);

    const drawerSlideOptions = useMemo<HardwareProductRecord[]>(() => {
      return allHardware
        .filter(
          (h) =>
            (h.familyId === "fam_drawer_box" || h.familyId === "fam_runner_concealed") &&
            h.lifecycleStatus !== "DEPRECATED"
        )
        .filter((h) =>
          !q
            ? true
            : `${h.manufacturerName} ${h.name} ${h.sku} ${h.series || ""}`
                .toLowerCase()
                .includes(q)
        );
    }, [allHardware, q]);

    const handleOptions = useMemo<HandleProfileDefinition[]>(() => {
      return allHandles
        .filter((h) =>
          isHandleProfileCompatibleWithModuleBay(h.id, h.category, activeModule, safeBayIdx)
        )
        .filter((h) =>
          !q ? true : `${h.name} ${h.sku} ${h.category}`.toLowerCase().includes(q)
        );
    }, [allHandles, activeModule, safeBayIdx, q]);

    const railOptions = useMemo(() => {
      return RAIL_PROFILE_OPTIONS.filter((r) =>
        !q ? true : `${r.name} ${r.brand} ${r.spec}`.toLowerCase().includes(q)
      );
    }, [q]);

    const meta = GROUP_META[activeGroup];
    const hasDrawersInModule = activeModule.bays.some((b) => b.drawers.length > 0);
    const hasRailsInModule = activeModule.bays.some((b) => b.hangingRails.length > 0);

    return (
      <div
        data-testid="v11-hardware-quick-swap-popover"
        className={`fixed z-40 top-[76px] max-xl:top-[114px] right-4 ${
          isInspectorOpen ? "lg:right-[412px]" : "lg:right-4"
        } w-[min(356px,calc(100vw-32px))] lg:max-w-[calc(100vw-500px)] max-h-[min(540px,calc(100dvh-196px))] flex flex-col rounded-2xl bg-[#FAF8F4]/98 backdrop-blur-xl border border-[#DFD3BC] text-[#141413] shadow-[0_18px_42px_rgba(20,20,19,0.16)] overflow-hidden`}
      >
        {/* Başlık */}
        <div className="px-3.5 py-2.5 border-b border-[#E6E0D4] flex items-start justify-between gap-2 bg-white/75">
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <ArrowLeftRight className="w-3.5 h-3.5 text-[#8C6D46] shrink-0" />
              <h3 className="text-xs font-bold text-[#141413] truncate">{meta.title}</h3>
              <span className="px-1.5 py-0.5 rounded-full bg-[#EFECE4] text-[10px] font-mono font-semibold text-[#57534E] shrink-0">
                {safeBayIdx + 1}. Bölme
              </span>
            </div>
            <p className="text-[10.5px] text-[#78716C] mt-0.5 leading-snug">{meta.subtitle}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Donanım değiştirme penceresini kapat"
            className="w-6 h-6 rounded-full hover:bg-[#EFECE4] flex items-center justify-center text-[#78716C] hover:text-[#141413] shrink-0 cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Hızlı Grup Sekmeleri */}
        <div className="px-3 pt-2 pb-1.5 flex items-center gap-1 border-b border-[#EFEAE0] bg-[#FAF8F4]">
          {(
            [
              { id: "hinge", label: "Menteşe" },
              { id: "handle", label: "Kulp" },
              ...(hasDrawersInModule ? [{ id: "drawer_slide", label: "Çekmece Rayı" }] : []),
              ...(hasRailsInModule ? [{ id: "rail", label: "Askı" }] : []),
            ] as Array<{ id: HardwareSwapGroup; label: string }>
          ).map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => {
                setActiveGroup(tab.id);
                setSearchQuery("");
              }}
              className={`h-6.5 px-2.5 rounded-full text-[10.5px] font-semibold transition cursor-pointer ${
                activeGroup === tab.id
                  ? "bg-[#141413] text-white"
                  : "bg-white border border-[#E5DFD3] text-[#57534E] hover:text-[#141413]"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Arama Kutusu */}
        <div className="px-3 py-2 border-b border-[#EFEAE0]">
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-[#A8A29E] absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Marka, model veya SKU ara (Blum, Hettich, Salice...)"
              className="w-full h-7.5 pl-8 pr-2.5 rounded-xl bg-white border border-[#E5DFD3] text-[11px] text-[#141413] placeholder:text-[#A8A29E] focus:outline-none focus:border-[#8C6D46]"
            />
          </div>
        </div>

        {/* Alternatif Listesi */}
        <div className="flex-1 overflow-y-auto px-3 py-2 space-y-1.5">
          {activeGroup === "hinge" &&
            hingeOptions.map((hw) => {
              const isSelected = hw.id === currentDoorHwId;
              const delta = formatDeltaEur(hw.unitPriceEur - currentPriceEur);
              const thickOk =
                !hw.doorThicknessLimitsMm ||
                (doorThickMm >= hw.doorThicknessLimitsMm[0] &&
                  doorThickMm <= hw.doorThicknessLimitsMm[1]);
              return (
                <button
                  key={hw.id}
                  type="button"
                  onClick={() =>
                    onApplyDoorHardware(
                      targetBayIndices,
                      {
                        hardwareProductId: hw.id,
                        softClose: !hw.name.toLowerCase().includes("frensiz"),
                      },
                      `${hw.manufacturerName} ${hw.name} uygulandı (${
                        applyAllBays ? "Tüm dolap" : `${safeBayIdx + 1}. bölme`
                      }).`
                    )
                  }
                  className={`w-full p-2.5 rounded-xl border text-left transition cursor-pointer ${
                    isSelected
                      ? "bg-[#141413] text-white border-[#141413]"
                      : "bg-white hover:bg-[#F4F0E8] border-[#E5DFD3] text-[#141413]"
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span
                          className={`text-[10px] font-bold uppercase tracking-wide ${
                            isSelected ? "text-[#D6B88D]" : "text-[#8C6D46]"
                          }`}
                        >
                          {hw.manufacturerName}
                        </span>
                        <span
                          className={`text-[10px] font-mono ${
                            isSelected ? "text-stone-400" : "text-stone-400"
                          }`}
                        >
                          {hw.sku}
                        </span>
                      </div>
                      <div className="text-[11.5px] font-bold leading-snug mt-0.5">{hw.name}</div>
                    </div>
                    <div className="flex flex-col items-end gap-1 shrink-0">
                      {isSelected ? (
                        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 text-[10px] font-bold">
                          <Check className="w-3 h-3" /> Seçili
                        </span>
                      ) : (
                        <span
                          className={`px-1.5 py-0.5 rounded-full text-[10px] font-mono font-bold ${
                            delta.tone === "up"
                              ? "bg-amber-50 text-amber-800 border border-amber-200"
                              : delta.tone === "down"
                              ? "bg-emerald-50 text-emerald-800 border border-emerald-200"
                              : "bg-stone-100 text-stone-600"
                          }`}
                        >
                          {delta.text}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="mt-1.5 flex items-center justify-between gap-2 text-[10px]">
                    <span className={isSelected ? "text-stone-300" : "text-stone-500"}>
                      Taşıma: {hw.loadCapacityKg} kg
                      {hw.doorThicknessLimitsMm
                        ? ` • Kapak: ${hw.doorThicknessLimitsMm[0]}–${hw.doorThicknessLimitsMm[1]} mm`
                        : ""}
                    </span>
                    {thickOk ? (
                      <span
                        className={`inline-flex items-center gap-0.5 font-semibold ${
                          isSelected ? "text-emerald-300" : "text-emerald-700"
                        }`}
                      >
                        <Sparkles className="w-2.5 h-2.5" /> Uyumlu
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-0.5 font-semibold text-amber-600">
                        <AlertTriangle className="w-2.5 h-2.5" /> Kalınlık Sınırı
                      </span>
                    )}
                  </div>
                </button>
              );
            })}

          {activeGroup === "handle" &&
            handleOptions.map((hp) => {
              const isSelected =
                hp.id === currentHandleProfileId || hp.sku === currentHandleProfileId;
              const delta = formatDeltaEur(hp.unitPriceEur - currentPriceEur);
              return (
                <button
                  key={hp.id}
                  type="button"
                  onClick={() =>
                    onApplyDoorHardware(
                      targetBayIndices,
                      {
                        handleProfileId: hp.id,
                        handleCategory: hp.category,
                        crossSectionProfile:
                          hp.category === "j_pull" ? "j_pull_bevel" : "flat_slab",
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
                      `Kulp profili "${hp.name}" olarak değiştirildi (${
                        applyAllBays ? "Tüm dolap" : `${safeBayIdx + 1}. bölme`
                      }).`
                    )
                  }
                  className={`w-full p-2.5 rounded-xl border text-left transition cursor-pointer ${
                    isSelected
                      ? "bg-[#141413] text-white border-[#141413]"
                      : "bg-white hover:bg-[#F4F0E8] border-[#E5DFD3] text-[#141413]"
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <div
                        className={`rounded-lg p-1 border shrink-0 ${
                          isSelected ? "bg-[#1F1E1C] border-white/15" : "bg-[#FAF8F4] border-[#E5DFD3]"
                        }`}
                      >
                        <HandleCrossSectionSvg
                          profileId={hp.id}
                          category={String(hp.category)}
                          active={isSelected}
                          size="sm"
                        />
                      </div>
                      <div className="min-w-0">
                        <div className="text-[11px] font-bold leading-snug">
                          {getHandleCrossSectionMeta(hp.id, String(hp.category), hp.name).shortTitle}
                        </div>
                        <div
                          className={`text-[9.5px] mt-0.5 leading-snug ${
                            isSelected ? "text-stone-300" : "text-stone-500"
                          }`}
                        >
                          {getHandleCrossSectionMeta(hp.id, String(hp.category), hp.name).specLine}
                        </div>
                      </div>
                    </div>
                    {isSelected ? (
                      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 text-[10px] font-bold shrink-0">
                        <Check className="w-3 h-3" /> Seçili
                      </span>
                    ) : (
                      <span
                        className={`px-1.5 py-0.5 rounded-full text-[10px] font-mono font-bold shrink-0 ${
                          delta.tone === "up"
                            ? "bg-amber-50 text-amber-800 border border-amber-200"
                            : delta.tone === "down"
                            ? "bg-emerald-50 text-emerald-800 border border-emerald-200"
                            : "bg-stone-100 text-stone-600"
                        }`}
                      >
                        {delta.text}
                      </span>
                    )}
                  </div>
                </button>
              );
            })}

          {activeGroup === "drawer_slide" &&
            drawerSlideOptions.map((hw) => {
              const isSelected = hw.id === currentDrawerHwId;
              const delta = formatDeltaEur(hw.unitPriceEur - currentPriceEur);
              return (
                <button
                  key={hw.id}
                  type="button"
                  onClick={() =>
                    onApplyDrawerHardware(
                      targetBayIndices,
                      {
                        hardwareProductId: hw.id,
                        slideType: hw.name.toLowerCase().includes("tip-on")
                          ? "push_to_open"
                          : "soft_close",
                      },
                      `Çekmece sistemi "${hw.manufacturerName} ${hw.name}" olarak güncellendi (${
                        applyAllBays ? "Tüm dolap" : `${safeBayIdx + 1}. bölme`
                      }).`
                    )
                  }
                  className={`w-full p-2.5 rounded-xl border text-left transition cursor-pointer ${
                    isSelected
                      ? "bg-[#141413] text-white border-[#141413]"
                      : "bg-white hover:bg-[#F4F0E8] border-[#E5DFD3] text-[#141413]"
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span
                          className={`text-[10px] font-bold uppercase ${
                            isSelected ? "text-[#D6B88D]" : "text-[#8C6D46]"
                          }`}
                        >
                          {hw.manufacturerName}
                        </span>
                        <span className="text-[10px] font-mono text-stone-400">{hw.sku}</span>
                      </div>
                      <div className="text-[11.5px] font-bold leading-snug mt-0.5">{hw.name}</div>
                      <div
                        className={`text-[10px] mt-0.5 ${
                          isSelected ? "text-stone-300" : "text-stone-500"
                        }`}
                      >
                        Kapasite: {hw.loadCapacityKg} kg •{" "}
                        {hw.familyId === "fam_drawer_box" ? "Metal Kutu Sistemi" : "Gizli Ray"}
                      </div>
                    </div>
                    {isSelected ? (
                      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 text-[10px] font-bold shrink-0">
                        <Check className="w-3 h-3" /> Seçili
                      </span>
                    ) : (
                      <span
                        className={`px-1.5 py-0.5 rounded-full text-[10px] font-mono font-bold shrink-0 ${
                          delta.tone === "up"
                            ? "bg-amber-50 text-amber-800 border border-amber-200"
                            : delta.tone === "down"
                            ? "bg-emerald-50 text-emerald-800 border border-emerald-200"
                            : "bg-stone-100 text-stone-600"
                        }`}
                      >
                        {delta.text}
                      </span>
                    )}
                  </div>
                </button>
              );
            })}

          {activeGroup === "rail" &&
            railOptions.map((opt) => {
              const isSelected = opt.id === currentRailProfile;
              const delta = formatDeltaEur(opt.priceEur - currentPriceEur);
              return (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() =>
                    onApplyRailProfile(
                      targetBayIndices,
                      opt.id,
                      `Askı borusu "${opt.name}" olarak değiştirildi (${
                        applyAllBays ? "Tüm dolap" : `${safeBayIdx + 1}. bölme`
                      }).`
                    )
                  }
                  className={`w-full p-2.5 rounded-xl border text-left transition cursor-pointer ${
                    isSelected
                      ? "bg-[#141413] text-white border-[#141413]"
                      : "bg-white hover:bg-[#F4F0E8] border-[#E5DFD3] text-[#141413]"
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <span
                        className={`text-[10px] font-bold uppercase ${
                          isSelected ? "text-[#D6B88D]" : "text-[#8C6D46]"
                        }`}
                      >
                        {opt.brand}
                      </span>
                      <div className="text-[11.5px] font-bold leading-snug">{opt.name}</div>
                      <div
                        className={`text-[10px] mt-0.5 ${
                          isSelected ? "text-stone-300" : "text-stone-500"
                        }`}
                      >
                        {opt.spec}
                      </div>
                    </div>
                    {isSelected ? (
                      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 text-[10px] font-bold shrink-0">
                        <Check className="w-3 h-3" /> Seçili
                      </span>
                    ) : (
                      <span
                        className={`px-1.5 py-0.5 rounded-full text-[10px] font-mono font-bold shrink-0 ${
                          delta.tone === "up"
                            ? "bg-amber-50 text-amber-800 border border-amber-200"
                            : delta.tone === "down"
                            ? "bg-emerald-50 text-emerald-800 border border-emerald-200"
                            : "bg-stone-100 text-stone-600"
                        }`}
                      >
                        {delta.text}
                      </span>
                    )}
                  </div>
                </button>
              );
            })}
        </div>

        {/* Alt Kapsam Seçici */}
        {activeModule.bays.length > 1 && (
          <div className="px-3 py-2 border-t border-[#E6E0D4] bg-white/80 flex items-center justify-between gap-2">
            <span className="text-[10.5px] font-semibold text-[#57534E]">Uygulama Kapsamı:</span>
            <div className="inline-flex items-center p-0.5 rounded-full bg-[#ECE7DD] border border-[#DFD9CE]">
              <button
                type="button"
                onClick={() => setApplyAllBays(false)}
                className={`h-6 px-2.5 rounded-full text-[10px] font-bold transition cursor-pointer ${
                  !applyAllBays ? "bg-[#141413] text-white" : "text-[#57534E]"
                }`}
              >
                Bu Bölme
              </button>
              <button
                type="button"
                onClick={() => setApplyAllBays(true)}
                className={`h-6 px-2.5 rounded-full text-[10px] font-bold transition cursor-pointer ${
                  applyAllBays ? "bg-[#141413] text-white" : "text-[#57534E]"
                }`}
              >
                Tüm Dolap ({activeModule.bays.length})
              </button>
            </div>
          </div>
        )}
      </div>
    );
  }
);

HardwareQuickSwapPopover.displayName = "HardwareQuickSwapPopover";
