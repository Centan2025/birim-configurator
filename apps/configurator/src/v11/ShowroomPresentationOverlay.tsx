"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  Camera,
  ChevronDown,
  ChevronUp,
  DoorOpen,
  FileText,
  Maximize2,
  Minimize2,
  Moon,
  Smartphone,
  Sparkles,
  Sun,
} from "lucide-react";
import type { DesignProject, MaterialDefinition, ModuleInstance } from "@birim/core";

export interface ShowroomPresentationOverlayProps {
  project: DesignProject;
  modules: ModuleInstance[];
  activeModuleIndex: number;
  materials: MaterialDefinition[];
  totalPriceWithVatEur: number;
  doorOpenAngleDeg: number;
  onSelectModuleIndex: (idx: number) => void;
  onChangeDoorAngle: (deg: number, animated?: boolean) => void;
  onOpenQuoteModal: () => void;
  onOpenStudioRenderModal: () => void;
  onOpenArModal: () => void;
  onApplyMaterialScope: (scope: "doors" | "carcass" | "all_module", matId: string) => void;
}

type LightingPreset = "daylight" | "showroom_warm" | "night_led";

export const ShowroomPresentationOverlay: React.FC<ShowroomPresentationOverlayProps> =
  React.memo(
    ({
      project,
      modules,
      activeModuleIndex,
      materials,
      totalPriceWithVatEur,
      doorOpenAngleDeg,
      onSelectModuleIndex,
      onChangeDoorAngle,
      onOpenQuoteModal,
      onOpenStudioRenderModal,
      onOpenArModal,
      onApplyMaterialScope,
    }) => {
      const [summaryOpen, setSummaryOpen] = useState(true);
      const [lighting, setLighting] = useState<LightingPreset>("daylight");
      const [isFullscreen, setIsFullscreen] = useState(false);
      const [matScope, setMatScope] = useState<"doors" | "carcass" | "all_module">("doors");

      useEffect(() => {
        const onFsChange = () => {
          setIsFullscreen(Boolean(document.fullscreenElement));
        };
        document.addEventListener("fullscreenchange", onFsChange);
        return () => document.removeEventListener("fullscreenchange", onFsChange);
      }, []);

      const toggleFullscreen = useCallback(() => {
        if (typeof document === "undefined") return;
        if (document.fullscreenElement) {
          void document.exitFullscreen?.();
        } else {
          void document.documentElement.requestFullscreen?.();
        }
      }, []);

      const fitCamera = useCallback((preset: "hero" | "front" | "side") => {
        window.dispatchEvent(new CustomEvent("birim:fit-camera-3d", { detail: preset }));
      }, []);

      const applyLighting = useCallback((preset: LightingPreset) => {
        setLighting(preset);
        window.dispatchEvent(new CustomEvent("birim:set-lighting-preset", { detail: preset }));
      }, []);

      const summary = useMemo(() => {
        const totalW = modules.reduce((acc, m) => acc + (m.dimensions?.width || 0), 0);
        const maxH = modules.reduce((acc, m) => Math.max(acc, m.dimensions?.height || 0), 0);
        const maxD = modules.reduce((acc, m) => Math.max(acc, m.dimensions?.depth || 0), 0);
        const activeMod = modules[activeModuleIndex] || modules[0];
        const matMap = new Map(materials.map((m) => [m.id, m]));
        const doorMat = activeMod?.carcass?.doorMaterialId
          ? matMap.get(activeMod.carcass.doorMaterialId)
          : undefined;
        const carcassMat = activeMod?.carcass?.bodyMaterialId
          ? matMap.get(activeMod.carcass.bodyMaterialId)
          : undefined;
        return {
          totalWcm: Math.round(totalW / 10),
          maxHcm: Math.round(maxH / 10),
          maxDcm: Math.round(maxD / 10),
          doorMat,
          carcassMat,
        };
      }, [modules, activeModuleIndex, materials]);

      const swatchMaterials = useMemo(
        () =>
          materials
            .filter(
              (m) =>
                !m.id.includes("led") &&
                !m.id.includes("metal") &&
                !m.id.includes("handle") &&
                !m.id.includes("chrome") &&
                !m.id.includes("glass") &&
                !m.id.includes("mirror")
            )
            .slice(0, 14),
        [materials]
      );

      const activeScopeMatId =
        matScope === "carcass"
          ? summary.carcassMat?.id
          : summary.doorMat?.id;

      const formattedPrice = new Intl.NumberFormat("tr-TR", {
        style: "currency",
        currency: "EUR",
        maximumFractionDigits: 0,
      }).format(Math.max(0, totalPriceWithVatEur || 0));

      return (
        <>
          {/* SOL ALT: Müşteri Proje & Malzeme Özet Kartı */}
          <aside
            data-testid="v11-showroom-summary-card"
            className="fixed left-4 bottom-20 z-30 w-[300px] max-w-[calc(100vw-32px)] rounded-3xl bg-[#FAF8F4]/92 backdrop-blur-xl border border-[#DFD9CE] shadow-[0_18px_44px_rgba(20,20,19,0.12)] overflow-hidden text-xs text-[#141413]"
          >
            <button
              type="button"
              onClick={() => setSummaryOpen((v) => !v)}
              className="w-full px-4 py-3 flex items-center justify-between gap-2 hover:bg-white/50 transition cursor-pointer text-left"
            >
              <div className="min-w-0">
                <div className="text-[10px] font-bold uppercase tracking-wider text-[#8C7A6B]">
                  Müşteri Sunum Özeti
                </div>
                <div className="font-bold text-[13px] truncate">
                  {project.title || "Özel Mobilya Tasarımı"}
                </div>
              </div>
              {summaryOpen ? (
                <ChevronDown className="w-4 h-4 text-[#78716C] shrink-0" />
              ) : (
                <ChevronUp className="w-4 h-4 text-[#78716C] shrink-0" />
              )}
            </button>

            {summaryOpen && (
              <div className="px-4 pb-3.5 pt-1 space-y-3 border-t border-[#EAE4D8]">
                <div className="grid grid-cols-2 gap-2 pt-1.5">
                  <div className="p-2 rounded-xl bg-white/80 border border-[#EAE4D8]">
                    <div className="text-[10px] text-[#78716C]">Toplam Ölçü</div>
                    <div className="font-mono font-bold text-[11.5px]">
                      {summary.totalWcm} × {summary.maxHcm} × {summary.maxDcm} cm
                    </div>
                  </div>
                  <div className="p-2 rounded-xl bg-white/80 border border-[#EAE4D8]">
                    <div className="text-[10px] text-[#78716C]">KDV Dahil Tutar</div>
                    <div className="font-mono font-bold text-[12px] text-[#141413]">
                      {formattedPrice}
                    </div>
                  </div>
                </div>

                {(summary.doorMat || summary.carcassMat) && (
                  <div className="space-y-1.5">
                    {summary.doorMat && (
                      <div className="flex items-center gap-2 text-[11px]">
                        <span
                          className="w-4 h-4 rounded-full border border-black/15 shrink-0"
                          style={{ backgroundColor: summary.doorMat.colorHex }}
                        />
                        <span className="text-[#78716C]">Kapak:</span>
                        <span className="font-semibold truncate">{summary.doorMat.name}</span>
                      </div>
                    )}
                    {summary.carcassMat && (
                      <div className="flex items-center gap-2 text-[11px]">
                        <span
                          className="w-4 h-4 rounded-full border border-black/15 shrink-0"
                          style={{ backgroundColor: summary.carcassMat.colorHex }}
                        />
                        <span className="text-[#78716C]">Gövde:</span>
                        <span className="font-semibold truncate">{summary.carcassMat.name}</span>
                      </div>
                    )}
                  </div>
                )}

                {swatchMaterials.length > 0 && (
                  <div className="p-2.5 rounded-2xl bg-white/80 border border-[#EAE4D8] space-y-2">
                    <div className="flex items-center justify-between gap-1">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-[#8C7A6B]">
                        Renk / Malzeme
                      </span>
                      <div className="flex items-center gap-0.5 p-0.5 rounded-full bg-[#EFECE4]">
                        {(
                          [
                            { id: "doors", label: "Kapak" },
                            { id: "carcass", label: "Gövde" },
                            { id: "all_module", label: "Tümü" },
                          ] as const
                        ).map((sc) => (
                          <button
                            key={sc.id}
                            type="button"
                            onClick={() => setMatScope(sc.id)}
                            className={`px-2 py-0.5 rounded-full text-[9.5px] font-semibold cursor-pointer transition ${
                              matScope === sc.id
                                ? "bg-[#141413] text-white"
                                : "text-[#57534E] hover:text-[#141413]"
                            }`}
                          >
                            {sc.label}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {swatchMaterials.map((mat) => {
                        const isActive = activeScopeMatId === mat.id;
                        return (
                          <button
                            key={mat.id}
                            type="button"
                            title={mat.name}
                            aria-label={mat.name}
                            onClick={() => onApplyMaterialScope(matScope, mat.id)}
                            className={`w-6 h-6 rounded-full border transition cursor-pointer ${
                              isActive
                                ? "ring-2 ring-[#141413] ring-offset-1 border-white scale-105"
                                : "border-black/15 hover:scale-110"
                            }`}
                            style={{ backgroundColor: mat.colorHex }}
                          />
                        );
                      })}
                    </div>
                  </div>
                )}

                {modules.length > 1 && (
                  <div className="flex flex-wrap gap-1">
                    {modules.map((m, idx) => (
                      <button
                        key={m.id}
                        type="button"
                        onClick={() => onSelectModuleIndex(idx)}
                        className={`px-2.5 py-1 rounded-full text-[10.5px] font-semibold transition cursor-pointer ${
                          idx === activeModuleIndex
                            ? "bg-[#141413] text-white"
                            : "bg-white border border-[#E5DFD3] text-[#57534E] hover:text-[#141413]"
                        }`}
                      >
                        {idx + 1}. {m.name || "Modül"}
                      </button>
                    ))}
                  </div>
                )}

                <div className="grid grid-cols-3 gap-1.5 pt-0.5">
                  <button
                    type="button"
                    onClick={onOpenQuoteModal}
                    className="py-2 px-2 rounded-xl bg-[#141413] hover:bg-[#292524] text-white text-[10.5px] font-semibold flex items-center justify-center gap-1 cursor-pointer transition"
                  >
                    <FileText className="w-3.5 h-3.5 shrink-0" />
                    <span>Teklif</span>
                  </button>
                  <button
                    type="button"
                    onClick={onOpenStudioRenderModal}
                    className="py-2 px-2 rounded-xl bg-white hover:bg-[#EFECE4] border border-[#DED8CC] text-[#141413] text-[10.5px] font-semibold flex items-center justify-center gap-1 cursor-pointer transition"
                  >
                    <Camera className="w-3.5 h-3.5 shrink-0" />
                    <span>Render</span>
                  </button>
                  <button
                    type="button"
                    onClick={onOpenArModal}
                    className="py-2 px-2 rounded-xl bg-white hover:bg-[#EFECE4] border border-[#DED8CC] text-[#141413] text-[10.5px] font-semibold flex items-center justify-center gap-1 cursor-pointer transition"
                  >
                    <Smartphone className="w-3.5 h-3.5 shrink-0" />
                    <span>AR</span>
                  </button>
                </div>
              </div>
            )}
          </aside>

          {/* SAĞ ÜST: Kamera Durakları, Atmosfer ve Tam Ekran Sunum Kontrolleri */}
          <div
            data-testid="v11-showroom-camera-bar"
            className="fixed right-4 top-[74px] z-30 flex flex-col items-end gap-2"
          >
            <div className="p-1.5 rounded-2xl bg-[#FAF8F4]/92 backdrop-blur-xl border border-[#DFD9CE] shadow-[0_12px_32px_rgba(20,20,19,0.08)] flex flex-wrap items-center gap-1">
              <button
                type="button"
                onClick={() => {
                  onChangeDoorAngle(0, true);
                  fitCamera("hero");
                }}
                className="h-8 px-2.5 rounded-xl hover:bg-white text-[11px] font-semibold text-[#141413] cursor-pointer transition"
              >
                Genel Bakış
              </button>
              <button
                type="button"
                onClick={() => fitCamera("front")}
                className="h-8 px-2.5 rounded-xl hover:bg-white text-[11px] font-semibold text-[#44403C] cursor-pointer transition"
              >
                Ön Cephe
              </button>
              <button
                type="button"
                onClick={() => fitCamera("side")}
                className="h-8 px-2.5 rounded-xl hover:bg-white text-[11px] font-semibold text-[#44403C] cursor-pointer transition"
              >
                Yan Açı
              </button>
              <button
                type="button"
                onClick={() => {
                  onChangeDoorAngle(doorOpenAngleDeg > 20 ? 0 : 82, true);
                  fitCamera("hero");
                }}
                className={`h-8 px-2.5 rounded-xl text-[11px] font-semibold flex items-center gap-1 cursor-pointer transition ${
                  doorOpenAngleDeg > 20
                    ? "bg-[#141413] text-white"
                    : "hover:bg-white text-[#44403C]"
                }`}
              >
                <DoorOpen className="w-3.5 h-3.5" />
                <span>İç Düzen</span>
              </button>

              <span className="h-5 w-px bg-[#DFD9CE] mx-0.5" />

              <button
                type="button"
                onClick={() => applyLighting("daylight")}
                title="Gün Işığı"
                className={`h-8 px-2 rounded-xl text-[11px] font-semibold flex items-center gap-1 cursor-pointer transition ${
                  lighting === "daylight" ? "bg-[#141413] text-white" : "hover:bg-white text-[#57534E]"
                }`}
              >
                <Sun className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Gün</span>
              </button>
              <button
                type="button"
                onClick={() => applyLighting("showroom_warm")}
                title="3000K Sıcak Showroom Işığı"
                className={`h-8 px-2 rounded-xl text-[11px] font-semibold flex items-center gap-1 cursor-pointer transition ${
                  lighting === "showroom_warm"
                    ? "bg-[#141413] text-white"
                    : "hover:bg-white text-[#57534E]"
                }`}
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">3000K</span>
              </button>
              <button
                type="button"
                onClick={() => applyLighting("night_led")}
                title="Gece & Dolap İçi LED"
                className={`h-8 px-2 rounded-xl text-[11px] font-semibold flex items-center gap-1 cursor-pointer transition ${
                  lighting === "night_led" ? "bg-[#141413] text-white" : "hover:bg-white text-[#57534E]"
                }`}
              >
                <Moon className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Gece</span>
              </button>

              <span className="h-5 w-px bg-[#DFD9CE] mx-0.5" />

              <button
                type="button"
                onClick={toggleFullscreen}
                title={isFullscreen ? "Tam Ekrandan Çık" : "Tam Ekran Sunum"}
                className="h-8 w-8 rounded-xl hover:bg-white text-[#141413] flex items-center justify-center cursor-pointer transition"
              >
                {isFullscreen ? (
                  <Minimize2 className="w-3.5 h-3.5" />
                ) : (
                  <Maximize2 className="w-3.5 h-3.5" />
                )}
              </button>
            </div>
          </div>
        </>
      );
    }
  );

ShowroomPresentationOverlay.displayName = "ShowroomPresentationOverlay";
export default ShowroomPresentationOverlay;
