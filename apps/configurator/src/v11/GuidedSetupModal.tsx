"use client";

import React, { useState, useMemo } from "react";
import { X, Sparkles, Check, ArrowRight } from "lucide-react";
import { createInitialProject, type DesignProject, type MaterialDefinition } from "@birim/core";
import { generateSmartStarterTemplates } from "../v3/adapter/guidedWizardBuilder";

export interface GuidedSetupWizardPayload {
  spaceCategory: "wardrobe" | "walkin" | "kitchen" | "living";
  roomShape: "rectangular" | "l_shape" | "u_shape";
  wallWidthMm: number;
  targetHeightMm: number;
  targetDepthMm: number;
  autoFiller50Mm: boolean;
  interiorFocus: "hanging" | "balanced" | "shelves";
  doorStyle: "hinged" | "sliding" | "glass" | "open";
  conceptTier: "eco" | "smart" | "signature";
  colorSwatchId?: string;
  addLed: boolean;
  addTrouserRack: boolean;
  addJewelryTray: boolean;
  kitchenGripSystem?: "gola_profile" | "gola_melamine_box" | "bevel_backing" | "j_pull" | "bar_handle" | "push_to_open";
  kitchenWallOpening?: "lift_bi_fold" | "lift_up_stay" | "lift_parallel" | "hinged";
}

export interface GuidedSetupModalProps {
  isOpen: boolean;
  project?: DesignProject;
  materials: MaterialDefinition[];
  onClose: () => void;
  onApply: (payload: GuidedSetupWizardPayload) => void;
}

export const GuidedSetupModal: React.FC<GuidedSetupModalProps> = React.memo(
  ({ isOpen, project, materials, onClose, onApply }) => {
    const [spaceCategory, setSpaceCategory] =
      useState<GuidedSetupWizardPayload["spaceCategory"]>("wardrobe");
    const [roomShape, setRoomShape] =
      useState<GuidedSetupWizardPayload["roomShape"]>("rectangular");
    const [wallWidthCm, setWallWidthCm] = useState(240);
    const [heightCm, setHeightCm] = useState(240);
    const [depthCm, setDepthCm] = useState(60);
    const [interiorFocus, setInteriorFocus] =
      useState<GuidedSetupWizardPayload["interiorFocus"]>("balanced");
    const [doorStyle, setDoorStyle] =
      useState<GuidedSetupWizardPayload["doorStyle"]>("hinged");
    const [swatchId, setSwatchId] = useState<string>(materials[0]?.id || "mat_veneer_oak");
    const [addLed, setAddLed] = useState(true);
    const [addTrouserRack, setAddTrouserRack] = useState(false);
    const [showAdvanced, setShowAdvanced] = useState(false);
    const [kitchenGripSystem, setKitchenGripSystem] = useState<NonNullable<GuidedSetupWizardPayload["kitchenGripSystem"]>>("gola_profile");
    const [kitchenWallOpening, setKitchenWallOpening] = useState<NonNullable<GuidedSetupWizardPayload["kitchenWallOpening"]>>("lift_bi_fold");
    const dispatchApplySmooth = (payload: GuidedSetupWizardPayload) => {
      onClose();
      if (typeof window !== "undefined") {
        window.setTimeout(() => {
          React.startTransition(() => {
            onApply(payload);
          });
        }, 24);
      } else {
        onApply(payload);
      }
    };

    const baseProj = useMemo(() => project || createInitialProject(), [project]);

    const starterProposals = useMemo(() => {
      if (!isOpen) return [];
      return generateSmartStarterTemplates(baseProj, {
        spaceCategory,
        roomShape,
        wallWidthMm: Math.round(wallWidthCm * 10),
        targetHeightMm: Math.round(heightCm * 10),
        targetDepthMm: Math.round(depthCm * 10),
        colorSwatchId: swatchId,
      });
    }, [isOpen, baseProj, spaceCategory, roomShape, wallWidthCm, heightCm, depthCm, swatchId]);

    if (!isOpen) return null;

    const topSwatches = materials.slice(0, 8);
    const isSlidingAllowed =
      spaceCategory !== "kitchen" && spaceCategory !== "walkin" && wallWidthCm >= 130;

    const fmtEur = (val: number) =>
      new Intl.NumberFormat("tr-TR", {
        style: "currency",
        currency: "EUR",
        maximumFractionDigits: 0,
      }).format(Math.max(0, val || 0));

    return (
      <div
        data-testid="v11-guided-setup-modal"
        className="fixed inset-0 z-[152] bg-[#141413]/50 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5"
        onClick={onClose}
      >
        <div
          onClick={(e) => e.stopPropagation()}
          className="w-full max-w-2xl max-h-[92vh] flex flex-col birim-ice-modal rounded-[28px] overflow-hidden text-[#141413]"
        >
          <div className="px-6 py-4 birim-ice-shell-header flex items-center justify-between shrink-0">
            <div className="flex items-center gap-2.5">
              <span className="w-9 h-9 rounded-2xl bg-[#141413] text-[#D6C7B2] flex items-center justify-center">
                <Sparkles className="w-4 h-4" />
              </span>
              <div>
                <h2 className="text-base font-bold">Akıllı Dolap &amp; Mekân Kurulumu</h2>
                <p className="text-xs text-[#78716C]">
                  Ölçünüzü girin, hazır akıllı şablonlardan birini tek tıkla uygulayın veya özelleştirin
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="w-8 h-8 rounded-full hover:bg-[#EFECE4] flex items-center justify-center cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="p-6 space-y-5 max-h-[76vh] overflow-y-auto text-xs">
            {/* 1. Mekân Tipi ve Oda Formu */}
            <div className="space-y-2.5">
              <div className="font-bold text-[#141413]">1. Mekân Türü ve Plan Tipi</div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {(
                  [
                    { id: "wardrobe", label: "Gardırop" },
                    { id: "walkin", label: "Giyinme Odası" },
                    { id: "kitchen", label: "Mutfak" },
                    { id: "living", label: "Vestiyer / TV" },
                  ] as const
                ).map((cat) => (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => {
                      setSpaceCategory(cat.id);
                      if (cat.id === "walkin") setDoorStyle("open");
                      else if (cat.id === "kitchen") {
                        setDoorStyle("hinged");
                        setHeightCm(87);
                        setShowAdvanced(true);
                      } else {
                        if (heightCm < 180) setHeightCm(240);
                        if (doorStyle === "open") setDoorStyle("hinged");
                      }
                    }}
                    className={`py-2.5 px-2 rounded-2xl font-semibold border transition cursor-pointer ${
                      spaceCategory === cat.id
                        ? "bg-[#141413] text-white border-[#141413]"
                        : "bg-white hover:bg-[#F5F2EA] border-[#E5DFD3]"
                    }`}
                  >
                    {cat.label}
                  </button>
                ))}
              </div>

              <div className="grid grid-cols-3 gap-2 pt-1">
                {(
                  [
                    { id: "rectangular", label: "Düz Duvar (I-Tipi)" },
                    { id: "l_shape", label: "L-Tipi Köşe" },
                    { id: "u_shape", label: "U-Tipi Üç Duvar" },
                  ] as const
                ).map((sh) => (
                  <button
                    key={sh.id}
                    type="button"
                    onClick={() => setRoomShape(sh.id)}
                    className={`py-2 px-2 rounded-xl font-semibold border transition cursor-pointer ${
                      roomShape === sh.id
                        ? "bg-[#EFECE4] text-[#141413] border-[#141413]"
                        : "bg-white border-[#E5DFD3] text-[#57534E]"
                    }`}
                  >
                    {sh.label}
                  </button>
                ))}
              </div>
            </div>

            {/* 2. Ölçüler */}
            <div className="p-4 rounded-2xl bg-white border border-[#E5DFD3] grid grid-cols-3 gap-3 sm:gap-4">
              <label className="space-y-1.5">
                <span className="font-semibold text-[#57534E] block">Genişlik (cm)</span>
                <input
                  type="number"
                  min={120}
                  max={600}
                  step={10}
                  value={wallWidthCm}
                  onChange={(e) => {
                    const nextW = Number(e.target.value) || 240;
                    setWallWidthCm(nextW);
                    if (nextW < 130 && doorStyle === "sliding") {
                      setDoorStyle("hinged");
                    }
                  }}
                  className="w-full h-10 px-3 rounded-xl bg-[#FAF8F4] border border-[#DED8CC] font-mono font-bold text-sm"
                />
              </label>
              <label className="space-y-1.5">
                <span className="font-semibold text-[#57534E] block">Yükseklik (cm)</span>
                <input
                  type="number"
                  min={spaceCategory === "kitchen" ? 80 : 180}
                  max={290}
                  step={5}
                  value={heightCm}
                  onChange={(e) => setHeightCm(Number(e.target.value) || 240)}
                  className="w-full h-10 px-3 rounded-xl bg-[#FAF8F4] border border-[#DED8CC] font-mono font-bold text-sm"
                />
              </label>
              <label className="space-y-1.5">
                <span className="font-semibold text-[#57534E] block">Derinlik (cm)</span>
                <input
                  type="number"
                  min={doorStyle === "sliding" ? 60 : 45}
                  max={70}
                  step={5}
                  value={doorStyle === "sliding" ? Math.max(60, depthCm) : depthCm}
                  onChange={(e) => setDepthCm(Number(e.target.value) || 60)}
                  className="w-full h-10 px-3 rounded-xl bg-[#FAF8F4] border border-[#DED8CC] font-mono font-bold text-sm"
                />
              </label>
            </div>

            {/* 3. ÖZELLİK #2: Ölçüye Uygun 4 Hazır Akıllı Başlangıç Tasarımı */}
            <div className="space-y-2.5" data-testid="v12-smart-starter-cards">
              <div className="flex items-center justify-between">
                <div className="font-bold text-[#141413]">
                  2. Ölçünüze Uygun Hazır Akıllı Tasarımlar ({wallWidthCm}×{heightCm} cm)
                </div>
                <span className="text-[10.5px] font-semibold text-[#8C7A6B]">
                  Tek tıkla sahneye uygula
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {starterProposals.map((card) => (
                  <button
                    key={card.id}
                    type="button"
                    data-testid={`v12-starter-card-${card.id}`}
                    onClick={() => dispatchApplySmooth(card.payload)}
                    className="group p-3.5 rounded-2xl bg-white hover:bg-[#FAF7F0] border border-[#E5DFD3] hover:border-[#141413] text-left transition flex flex-col justify-between gap-2.5 cursor-pointer shadow-2xs"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center justify-between gap-2">
                        <span className="px-2 py-0.5 rounded-full bg-[#EFECE4] text-[#6B4F28] text-[10px] font-bold">
                          {card.badge}
                        </span>
                        <span className="font-mono font-bold text-xs text-[#141413]">
                          {fmtEur(card.estimatedTotalWithVatEur)}
                        </span>
                      </div>
                      <div className="font-bold text-[12.5px] text-[#141413] group-hover:underline">
                        {card.title}
                      </div>
                      <p className="text-[11px] text-[#78716C] leading-snug">{card.subtitle}</p>
                    </div>

                    <div className="pt-2 border-t border-[#F0ECE3] flex items-center justify-between text-[10.5px] text-[#57534E]">
                      <span>
                        {card.moduleCount} Ünite • {card.bayCount} Bölme • {card.shelfCount} Raf
                        {card.drawerCount > 0 ? ` • ${card.drawerCount} Çekmece` : ""}
                      </span>
                      <span className="inline-flex items-center gap-1 font-bold text-[#141413]">
                        <span>Seç</span>
                        <ArrowRight className="w-3 h-3" />
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* 4. Yüzey Kartelası */}
            <div className="space-y-2.5">
              <div className="font-bold text-[#141413]">3. Yüzey Kartelası</div>
              <div className="grid grid-cols-4 gap-2">
                {topSwatches.map((m) => {
                  const sel = swatchId === m.id;
                  return (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => setSwatchId(m.id)}
                      className={`p-2 rounded-2xl border text-left transition cursor-pointer ${
                        sel
                          ? "bg-white border-[#141413] ring-2 ring-[#141413]/15"
                          : "bg-white border-[#E5DFD3]"
                      }`}
                    >
                      <div
                        className="h-8 rounded-xl border border-black/10 relative mb-1"
                        style={{ backgroundColor: m.colorHex }}
                      >
                        {sel && (
                          <span className="absolute top-1 right-1 w-4 h-4 rounded-full bg-[#141413] text-white flex items-center justify-center">
                            <Check className="w-2.5 h-2.5" />
                          </span>
                        )}
                      </div>
                      <div className="text-[10.5px] font-semibold truncate">{m.name}</div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* 5. İsteğe Bağlı İnce Özelleştirme */}
            <div className="pt-1">
              <button
                type="button"
                onClick={() => setShowAdvanced((v) => !v)}
                className="text-[11px] font-bold text-[#6B4F28] hover:underline cursor-pointer"
              >
                {showAdvanced
                  ? "▾ Kapak ve İç Aksesuar Özelleştirmesini Gizle"
                  : "▸ Kapak Tipi, LED ve İç Aksesuarları Kendim Seçmek İstiyorum"}
              </button>

              {showAdvanced && (
                <div className="mt-3 space-y-4 p-4 rounded-2xl bg-white/80 border border-[#E5DFD3]">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <div className="font-bold text-[#141413]">Kapak Tercihi</div>
                      <div className="grid grid-cols-2 gap-1.5">
                        {(
                          [
                            { id: "hinged", label: "Menteşeli", disabled: spaceCategory === "walkin" },
                            { id: "sliding", label: "Sürgülü", disabled: !isSlidingAllowed },
                            { id: "glass", label: "Füme Cam", disabled: spaceCategory === "walkin" },
                            { id: "open", label: "Kapaksız Açık", disabled: spaceCategory === "kitchen" },
                          ] as const
                        ).map((ds) => (
                          <button
                            key={ds.id}
                            type="button"
                            disabled={ds.disabled}
                            onClick={() => {
                              setDoorStyle(ds.id);
                              if (ds.id === "sliding" && depthCm < 60) setDepthCm(60);
                            }}
                            className={`py-2 px-2 rounded-xl font-semibold border transition cursor-pointer disabled:opacity-35 disabled:pointer-events-none ${
                              doorStyle === ds.id
                                ? "bg-[#141413] text-white border-[#141413]"
                                : "bg-white border-[#E5DFD3]"
                            }`}
                          >
                            {ds.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="space-y-2">
                      <div className="font-bold text-[#141413]">İç Kullanım Ağırlığı</div>
                      <div className="grid grid-cols-3 gap-1.5">
                        {(
                          [
                            { id: "balanced", label: "Dengeli" },
                            { id: "hanging", label: "Askı" },
                            { id: "shelves", label: "Raf & Çekmece" },
                          ] as const
                        ).map((inf) => (
                          <button
                            key={inf.id}
                            type="button"
                            onClick={() => setInteriorFocus(inf.id)}
                            className={`py-2 px-1.5 rounded-xl font-semibold border transition cursor-pointer ${
                              interiorFocus === inf.id
                                ? "bg-[#141413] text-white border-[#141413]"
                                : "bg-white border-[#E5DFD3]"
                            }`}
                          >
                            {inf.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  {spaceCategory === "kitchen" && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-[#EFEAE0]">
                      <div className="space-y-2">
                        <div className="font-bold text-[#141413]">Kulpsuz / Tutamak Sistemi (Alt &amp; Üst)</div>
                        <div className="grid grid-cols-2 gap-1.5">
                          {(
                            [
                              { id: "gola_profile", label: "Alüminyum Gola (L/C)" },
                              { id: "gola_melamine_box", label: "Melamin Gola Kutusu" },
                              { id: "bevel_backing", label: "30°/45° Pah + Arka Bant" },
                              { id: "j_pull", label: "CNC J-Kulp (22 mm Lake)" },
                              { id: "bar_handle", label: "Klasik Kulp" },
                              { id: "push_to_open", label: "Bas-Aç (TIP-ON)" },
                            ] as const
                          ).map((g) => (
                            <button
                              key={g.id}
                              type="button"
                              onClick={() => setKitchenGripSystem(g.id)}
                              className={`py-2 px-2 rounded-xl font-semibold border transition cursor-pointer ${
                                kitchenGripSystem === g.id
                                  ? "bg-[#141413] text-white border-[#141413]"
                                  : "bg-white border-[#E5DFD3]"
                              }`}
                            >
                              {g.label}
                            </button>
                          ))}
                        </div>
                      </div>
                      <div className="space-y-2">
                        <div className="font-bold text-[#141413]">Üst Dolap Açılım Sistemi</div>
                        <div className="grid grid-cols-2 gap-1.5">
                          {(
                            [
                              { id: "lift_bi_fold", label: "AVENTOS HF (Katlanır)" },
                              { id: "lift_up_stay", label: "AVENTOS HK (Tek Kalkar)" },
                              { id: "lift_parallel", label: "AVENTOS HL (Paralel)" },
                              { id: "hinged", label: "Standart Menteşeli" },
                            ] as const
                          ).map((w) => (
                            <button
                              key={w.id}
                              type="button"
                              onClick={() => setKitchenWallOpening(w.id)}
                              className={`py-2 px-2 rounded-xl font-semibold border transition cursor-pointer ${
                                kitchenWallOpening === w.id
                                  ? "bg-[#141413] text-white border-[#141413]"
                                  : "bg-white border-[#E5DFD3]"
                              }`}
                            >
                              {w.label}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}

                  {spaceCategory !== "kitchen" && (
                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setAddLed((v) => !v)}
                        className={`px-3.5 py-2 rounded-full font-semibold border transition cursor-pointer ${
                          addLed
                            ? "bg-[#141413] text-white border-[#141413]"
                            : "bg-white border-[#E5DFD3]"
                        }`}
                      >
                        {addLed ? "✓ İç LED Aydınlatma Dahil" : "+ İç LED Aydınlatma Ekle"}
                      </button>
                      <button
                        type="button"
                        onClick={() => setAddTrouserRack((v) => !v)}
                        className={`px-3.5 py-2 rounded-full font-semibold border transition cursor-pointer ${
                          addTrouserRack
                            ? "bg-[#141413] text-white border-[#141413]"
                            : "bg-white border-[#E5DFD3]"
                        }`}
                      >
                        {addTrouserRack ? "✓ Teleskopik Pantolonluk Dahil" : "+ Pantolonluk Ekle"}
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          <div className="px-6 py-4 bg-[#F3EFE6] border-t border-[#E6E1D6] flex items-center justify-between">
            <button
              type="button"
              onClick={onClose}
              className="h-10 px-4 rounded-full hover:bg-white/80 font-semibold text-xs text-[#57534E] cursor-pointer"
            >
              Vazgeç
            </button>
            <button
              type="button"
              onClick={() =>
                dispatchApplySmooth({
                  spaceCategory,
                  roomShape,
                  wallWidthMm: Math.round(wallWidthCm * 10),
                  targetHeightMm: Math.round(heightCm * 10),
                  targetDepthMm: Math.round(
                    (doorStyle === "sliding" ? Math.max(60, depthCm) : depthCm) * 10
                  ),
                  autoFiller50Mm: true,
                  interiorFocus,
                  doorStyle,
                  conceptTier: "smart",
                  colorSwatchId: swatchId,
                  addLed,
                  addTrouserRack,
                  addJewelryTray: false,
                  kitchenGripSystem: spaceCategory === "kitchen" ? kitchenGripSystem : undefined,
                  kitchenWallOpening: spaceCategory === "kitchen" ? kitchenWallOpening : undefined,
                })
              }
              className="h-10 px-6 rounded-full bg-[#141413] hover:bg-[#292524] text-white font-semibold text-xs shadow-sm cursor-pointer"
            >
              Özel Seçimle Oluştur
            </button>
          </div>
        </div>
      </div>
    );
  }
);

GuidedSetupModal.displayName = "GuidedSetupModal";
