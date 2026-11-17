"use client";

import React, { useState } from "react";
import { X, Sparkles, Check } from "lucide-react";
import type { MaterialDefinition } from "@birim/core";

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
}

export interface GuidedSetupModalProps {
  isOpen: boolean;
  materials: MaterialDefinition[];
  onClose: () => void;
  onApply: (payload: GuidedSetupWizardPayload) => void;
}

export const GuidedSetupModal: React.FC<GuidedSetupModalProps> = React.memo(
  ({ isOpen, materials, onClose, onApply }) => {
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

    if (!isOpen) return null;

    const topSwatches = materials.slice(0, 8);
    const isSlidingAllowed =
      spaceCategory !== "kitchen" && spaceCategory !== "walkin" && wallWidthCm >= 130;

    return (
      <div
        data-testid="v11-guided-setup-modal"
        className="fixed inset-0 z-[152] bg-[#141413]/50 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5"
        onClick={onClose}
      >
        <div
          onClick={(e) => e.stopPropagation()}
          className="w-full max-w-xl max-h-[90vh] flex flex-col birim-ice-modal rounded-[28px] overflow-hidden text-[#141413]"
        >
          <div className="px-6 py-4 birim-ice-shell-header flex items-center justify-between shrink-0">
            <div className="flex items-center gap-2.5">
              <span className="w-9 h-9 rounded-2xl bg-[#141413] text-[#D6C7B2] flex items-center justify-center">
                <Sparkles className="w-4 h-4" />
              </span>
              <div>
                <h2 className="text-base font-bold">Hızlı Kurulum</h2>
                <p className="text-xs text-[#78716C]">Mekân ve modül ölçülerini seçin</p>
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

          <div className="p-6 space-y-5 max-h-[75vh] overflow-y-auto text-xs">
            {/* 1. Mekân Tipi ve Oda Formu */}
            <div className="space-y-2.5">
              <div className="font-bold text-[#141413]">1. Mekân Türü ve Plan Tipi</div>
              <div className="grid grid-cols-4 gap-2">
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
                    { id: "l_shape", label: "L-Tipi Köşe Yerleşim" },
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
            <div className="p-4 rounded-2xl bg-white border border-[#E5DFD3] grid grid-cols-3 gap-4">
              <label className="space-y-1.5">
                <span className="font-semibold text-[#57534E] block">Duvar Genişliği (cm)</span>
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

            {/* 3. Kapak ve İç Düzen Odağı */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <div className="font-bold text-[#141413]">3. Kapak Tercihi</div>
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
                      className={`py-2.5 px-2 rounded-xl font-semibold border transition cursor-pointer disabled:opacity-35 disabled:pointer-events-none ${
                        doorStyle === ds.id
                          ? "bg-[#141413] text-white border-[#141413]"
                          : "bg-white border-[#E5DFD3]"
                      }`}
                    >
                      {ds.label}
                    </button>
                  ))}
                </div>
                {doorStyle === "sliding" && (
                  <p className="text-[10.5px] text-[#78716C]">
                    Sürgü kapakta tek parça geniş gövde ve ray gerisinde gizli iç çekmece kullanılır.
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <div className="font-bold text-[#141413]">4. İç Kullanım Ağırlığı</div>
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
                      className={`py-2.5 px-1.5 rounded-xl font-semibold border transition cursor-pointer ${
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

            {/* 5. Malzeme ve Ek Donanım */}
            <div className="space-y-2.5">
              <div className="font-bold text-[#141413]">5. Yüzey Kartelası ve Aydınlatma</div>
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
                        className="h-9 rounded-xl border border-black/10 relative mb-1"
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

              {spaceCategory !== "kitchen" && (
                <div className="flex flex-wrap items-center gap-2 pt-1">
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
              onClick={() => {
                onApply({
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
                });
                onClose();
              }}
              className="h-10 px-6 rounded-full bg-[#141413] hover:bg-[#292524] text-white font-semibold text-xs shadow-sm cursor-pointer"
            >
              Yerleşimi Oluştur
            </button>
          </div>
        </div>
      </div>
    );
  }
);

GuidedSetupModal.displayName = "GuidedSetupModal";
