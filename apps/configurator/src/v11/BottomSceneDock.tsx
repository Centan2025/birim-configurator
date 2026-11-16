"use client";

import React, { useState, useRef, useEffect } from "react";
import {
  Eye,
  EyeOff,
  Ruler,
  SlidersHorizontal,
  Maximize2,
  DoorOpen,
  Shirt,
  Sun,
  Moon,
  Scissors,
  Box,
  Download,
} from "lucide-react";
import type { ModuleInstance } from "@birim/core";
import type { ViewportRenderStyle } from "../store/useConfiguratorStore";
import { SectionPlaneMiniMap } from "./SectionPlaneMiniMap";

export interface BottomSceneDockProps {
  activeModule?: ModuleInstance;
  doorOpenAngleDeg: number;
  onChangeDoorAngle: (deg: number, animated?: boolean) => void;
  doorsHidden: boolean;
  onToggleDoorsHidden: () => void;
  showDimensions: boolean;
  onToggleDimensions: () => void;
  showInteriorProps: boolean;
  onToggleInteriorProps: () => void;
  renderStyle: ViewportRenderStyle;
  onChangeRenderStyle: (style: ViewportRenderStyle) => void;
  cncXrayMode: boolean;
  onToggleCncXray: () => void;
  explodedFactor: number;
  onChangeExplodedFactor: (val: number) => void;
  isSimpleTier: boolean;
  projectId: string;
}

export const BottomSceneDock: React.FC<BottomSceneDockProps> = React.memo(
  ({
    activeModule,
    doorOpenAngleDeg,
    onChangeDoorAngle,
    doorsHidden,
    onToggleDoorsHidden,
    showDimensions,
    onToggleDimensions,
    showInteriorProps,
    onToggleInteriorProps,
    renderStyle,
    onChangeRenderStyle,
    cncXrayMode,
    onToggleCncXray,
    explodedFactor,
    onChangeExplodedFactor,
    projectId,
  }) => {
    const [scenePopoverOpen, setScenePopoverOpen] = useState(false);
    const [sectionPopoverOpen, setSectionPopoverOpen] = useState(false);
    const [activeCam, setActiveCam] = useState<"hero" | "front" | "side">("hero");
    const [lightMode, setLightMode] = useState<"daylight" | "showroom_warm" | "night_led">(
      "daylight"
    );
    const [floorId, setFloorId] = useState<string>("oak_parquet");
    const [sectionAxis, setSectionAxis] = useState<null | "X" | "Z">(null);
    const [sectionRatio, setSectionRatio] = useState<number>(0.5);
    const [renderingPhoto, setRenderingPhoto] = useState(false);
    const popRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
      if (!scenePopoverOpen && !sectionPopoverOpen) return;
      const onDown = (e: MouseEvent) => {
        if (popRef.current && !popRef.current.contains(e.target as Node)) {
          setScenePopoverOpen(false);
          setSectionPopoverOpen(false);
        }
      };
      const onKey = (e: KeyboardEvent) => {
        if (e.key === "Escape") {
          setScenePopoverOpen(false);
          setSectionPopoverOpen(false);
        }
      };
      document.addEventListener("mousedown", onDown);
      window.addEventListener("keydown", onKey);
      return () => {
        document.removeEventListener("mousedown", onDown);
        window.removeEventListener("keydown", onKey);
      };
    }, [scenePopoverOpen, sectionPopoverOpen]);

    const triggerCamera = (preset: "hero" | "front" | "side") => {
      setActiveCam(preset);
      if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent("birim:fit-camera-3d", { detail: preset }));
      }
    };

    const applyLighting = (mode: "daylight" | "showroom_warm" | "night_led") => {
      setLightMode(mode);
      if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent("birim:set-lighting-preset", { detail: mode }));
      }
    };

    const applyFloor = (styleId: string) => {
      setFloorId(styleId);
      if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent("birim:set-floor-style", { detail: styleId }));
      }
    };

    const syncSection3D = (axis: null | "X" | "Z", ratioVal: number) => {
      setSectionAxis(axis);
      setSectionRatio(ratioVal);
      if (typeof window !== "undefined") {
        window.dispatchEvent(
          new CustomEvent("birim:set-section-3d", { detail: { axis, ratio: ratioVal } })
        );
      }
    };

    const doorOpenPct = Math.round(Math.min(100, Math.max(0, (doorOpenAngleDeg / 85) * 100)));

    return (
      <div
        ref={popRef}
        data-testid="v11-bottom-scene-dock"
        className="fixed bottom-4 left-1/2 -translate-x-1/2 z-30 flex flex-col items-center"
      >
        {/* ETKİLEŞİMLİ 3B GÖRSEL KESİT MİNİ PLAN PENCERESİ */}
        {sectionPopoverOpen && activeModule && (
          <div className="mb-2.5 w-80">
            <SectionPlaneMiniMap
              activeModule={activeModule}
              axis={sectionAxis || "X"}
              ratio={sectionRatio}
              compact={true}
              onChangeAxis={(nextAx) => syncSection3D(nextAx, sectionRatio)}
              onChangeRatio={(nextR) => syncSection3D(sectionAxis || "X", nextR)}
              onClose={() => {
                syncSection3D(null, sectionRatio);
                setSectionPopoverOpen(false);
              }}
            />
          </div>
        )}

        {/* YÜZEN SAHNE, GÖRÜNÜM & IŞIK POPOVER */}
        {scenePopoverOpen && (
          <div
            data-testid="v11-scene-settings-popover"
            className="mb-2.5 w-80 rounded-3xl bg-[#FAF8F4]/96 backdrop-blur-2xl border border-[#DFD9CE] shadow-[0_20px_50px_rgba(20,20,19,0.16)] p-4 space-y-3.5 text-xs text-[#141413]"
          >
            <div className="flex items-center justify-between">
              <span className="font-bold text-[13px]">Sahne, Işık ve Görünüm</span>
              <button
                type="button"
                onClick={() => setScenePopoverOpen(false)}
                className="w-6 h-6 rounded-full hover:bg-[#EFECE4] text-[#78716C] hover:text-[#141413] flex items-center justify-center cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="space-y-1.5">
              <div className="text-[10.5px] font-semibold text-[#78716C]">Stüdyo Aydınlatması</div>
              <div className="grid grid-cols-3 gap-1.5">
                {(
                  [
                    { id: "daylight", label: "Gün Işığı", icon: Sun },
                    { id: "showroom_warm", label: "3000K Sıcak", icon: Sun },
                    { id: "night_led", label: "Gece & LED", icon: Moon },
                  ] as const
                ).map((lp) => {
                  const Icon = lp.icon;
                  const active = lightMode === lp.id;
                  return (
                    <button
                      key={lp.id}
                      type="button"
                      onClick={() => applyLighting(lp.id)}
                      className={`py-2 px-2 rounded-2xl font-semibold flex items-center justify-center gap-1.5 transition cursor-pointer ${
                        active
                          ? "bg-[#141413] text-white"
                          : "bg-white hover:bg-[#EFECE4] border border-[#E5DFD3] text-[#44403C]"
                      }`}
                    >
                      <Icon className="w-3.5 h-3.5" />
                      <span>{lp.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="space-y-1.5">
              <div className="text-[10.5px] font-semibold text-[#78716C]">Zemin Kaplaması</div>
              <div className="grid grid-cols-3 gap-1.5">
                {[
                  { id: "oak_parquet", label: "Doğal Meşe" },
                  { id: "walnut_parquet", label: "Koyu Ceviz" },
                  { id: "travertine", label: "Traverten" },
                  { id: "neolith_calacatta", label: "Mermer" },
                  { id: "microcement", label: "Mikrobeton" },
                  { id: "studio", label: "Saf Stüdyo" },
                ].map((fl) => (
                  <button
                    key={fl.id}
                    type="button"
                    onClick={() => applyFloor(fl.id)}
                    className={`py-1.5 px-2 rounded-xl text-[11px] font-semibold transition cursor-pointer ${
                      floorId === fl.id
                        ? "bg-[#141413] text-white"
                        : "bg-white hover:bg-[#EFECE4] border border-[#E5DFD3] text-[#44403C]"
                    }`}
                  >
                    {fl.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-1.5">
              <div className="text-[10.5px] font-semibold text-[#78716C]">Görünüm Stili</div>
              <div className="grid grid-cols-3 gap-1.5">
                <button
                  type="button"
                  onClick={() => {
                    onChangeRenderStyle("solid");
                    if (cncXrayMode) onToggleCncXray();
                  }}
                  className={`py-1.5 px-2 rounded-xl text-[11px] font-semibold transition cursor-pointer ${
                    renderStyle === "solid" && !cncXrayMode
                      ? "bg-[#141413] text-white"
                      : "bg-white hover:bg-[#EFECE4] border border-[#E5DFD3]"
                  }`}
                >
                  Gerçekçi PBR
                </button>
                <button
                  type="button"
                  onClick={() =>
                    onChangeRenderStyle(renderStyle === "wireframe" ? "solid" : "wireframe")
                  }
                  className={`py-1.5 px-2 rounded-xl text-[11px] font-semibold transition cursor-pointer ${
                    renderStyle === "wireframe"
                      ? "bg-[#141413] text-white"
                      : "bg-white hover:bg-[#EFECE4] border border-[#E5DFD3]"
                  }`}
                >
                  Tel Kafes
                </button>
                <button
                  type="button"
                  onClick={onToggleCncXray}
                  className={`py-1.5 px-2 rounded-xl text-[11px] font-semibold transition cursor-pointer ${
                    cncXrayMode
                      ? "bg-[#141413] text-white"
                      : "bg-white hover:bg-[#EFECE4] border border-[#E5DFD3]"
                  }`}
                >
                  CNC X-Ray
                </button>
              </div>
            </div>

            <div className="pt-2 border-t border-[#E6E1D6] space-y-1">
              <div className="flex items-center justify-between text-[11px]">
                <span className="font-semibold text-[#57534E] flex items-center gap-1.5">
                  <Box className="w-3.5 h-3.5" />
                  <span>Patlatılmış Montaj Görünümü</span>
                </span>
                <span className="font-mono font-bold">%{Math.round(explodedFactor * 100)}</span>
              </div>
              <input
                type="range"
                min={0}
                max={1}
                step={0.05}
                value={explodedFactor}
                onChange={(e) => onChangeExplodedFactor(Number(e.target.value))}
                className="w-full accent-[#141413] cursor-pointer"
              />
            </div>

            <button
              type="button"
              disabled={renderingPhoto}
              onClick={async () => {
                const win = window as unknown as {
                  __birimRenderUltraStudioPhoto?: (opts?: {
                    angle?: "current" | "iso" | "front";
                    width?: number;
                    height?: number;
                  }) => Promise<string>;
                };
                if (!win.__birimRenderUltraStudioPhoto) return;
                setRenderingPhoto(true);
                try {
                  const url = await win.__birimRenderUltraStudioPhoto({
                    angle: "current",
                    width: 2048,
                    height: 1280,
                  });
                  if (url) {
                    const a = document.createElement("a");
                    a.href = url;
                    a.download = `Birim_Studyo_${projectId}.png`;
                    document.body.appendChild(a);
                    a.click();
                    a.remove();
                  }
                } finally {
                  setRenderingPhoto(false);
                }
              }}
              className="w-full h-9 rounded-full bg-[#141413] hover:bg-[#292524] disabled:opacity-50 text-white font-semibold flex items-center justify-center gap-2 transition cursor-pointer"
            >
              <Download className="w-3.5 h-3.5 text-[#D6C7B2]" />
              <span>{renderingPhoto ? "2K Görsel Hazırlanıyor..." : "2K Stüdyo Fotoğraf İndir (.PNG)"}</span>
            </button>
          </div>
        )}

        {/* TEK BİRLEŞİK ALT SAHNE KAPSÜLÜ */}
        <div className="h-12 px-2.5 rounded-full bg-[#FAF8F4]/92 backdrop-blur-xl border border-[#DFD9CE] shadow-[0_10px_32px_rgba(20,20,19,0.09)] flex items-center gap-1.5 text-xs text-[#141413]">
          <div className="flex items-center gap-0.5 p-0.5 rounded-full bg-[#ECE7DD]/80">
            {(
              [
                { id: "hero", label: "Perspektif" },
                { id: "front", label: "Ön" },
                { id: "side", label: "Yan" },
              ] as const
            ).map((cam) => (
              <button
                key={cam.id}
                type="button"
                onClick={() => triggerCamera(cam.id)}
                className={`h-8 px-3 rounded-full text-[11px] font-semibold transition cursor-pointer ${
                  activeCam === cam.id
                    ? "bg-white text-[#141413] shadow-2xs"
                    : "text-[#57534E] hover:text-[#141413]"
                }`}
              >
                {cam.label}
              </button>
            ))}
            <button
              type="button"
              onClick={() => triggerCamera("hero")}
              title="Sahneyi Ekrana Ortala"
              className="w-8 h-8 rounded-full flex items-center justify-center text-[#57534E] hover:text-[#141413] hover:bg-white/60 transition cursor-pointer"
            >
              <Maximize2 className="w-3.5 h-3.5" />
            </button>
          </div>

          <span className="h-5 w-px bg-[#DFD9CE]" />

          <div className="flex items-center gap-2 px-1.5">
            <button
              type="button"
              onClick={() => onChangeDoorAngle(doorOpenAngleDeg > 10 ? 0 : 82, true)}
              title={doorOpenAngleDeg > 10 ? "Kapakları Kapat" : "Kapakları Aç"}
              className={`h-8 px-2.5 rounded-full flex items-center gap-1.5 text-[11px] font-semibold transition cursor-pointer ${
                doorOpenAngleDeg > 10
                  ? "bg-[#141413] text-white"
                  : "hover:bg-[#EFECE4] text-[#44403C]"
              }`}
            >
              <DoorOpen className="w-3.5 h-3.5" />
              <span>Kapak</span>
            </button>

            <input
              type="range"
              aria-label="Kapak Açılma Oranı"
              min={0}
              max={85}
              step={1}
              value={Math.round(doorOpenAngleDeg)}
              onChange={(e) => onChangeDoorAngle(Number(e.target.value), false)}
              className="hidden sm:block w-18 accent-[#141413] h-1.5 bg-[#DFD9CE] rounded-full cursor-pointer"
            />
            <span className="hidden md:inline-block w-8 font-mono text-[10.5px] text-[#78716C]">
              %{doorOpenPct}
            </span>

            <button
              type="button"
              onClick={onToggleDoorsHidden}
              title={doorsHidden ? "Kapakları Yeniden Göster" : "İç Düzeni Görmek İçin Kapakları Gizle"}
              className={`h-8 px-2.5 rounded-full flex items-center gap-1 text-[11px] font-semibold transition cursor-pointer ${
                doorsHidden ? "bg-[#8C7A6B] text-white" : "hover:bg-[#EFECE4] text-[#44403C]"
              }`}
            >
              {doorsHidden ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
              <span className="hidden lg:inline">{doorsHidden ? "Gizli" : "İçini Gör"}</span>
            </button>
          </div>

          <span className="h-5 w-px bg-[#DFD9CE]" />

          {/* Canlı Görsel Kesit Planı Düğmesi */}
          <button
            type="button"
            data-testid="v11-bottom-section-btn"
            onClick={() => {
              const nextOpen = !sectionPopoverOpen;
              setSectionPopoverOpen(nextOpen);
              setScenePopoverOpen(false);
              if (nextOpen && !sectionAxis) {
                syncSection3D("X", sectionRatio);
              } else if (!nextOpen && sectionAxis) {
                syncSection3D(null, sectionRatio);
              }
            }}
            title="Görsel Plan Üzerinden Canlı 3B Kesit Al"
            className={`h-8 px-3 rounded-full flex items-center gap-1.5 text-[11px] font-semibold transition cursor-pointer ${
              sectionAxis
                ? "bg-[#C2410C] text-white"
                : "hover:bg-[#EFECE4] text-[#44403C]"
            }`}
          >
            <Scissors className="w-3.5 h-3.5" />
            <span className="hidden md:inline">{sectionAxis ? `Kesit (${sectionAxis})` : "Kesit"}</span>
          </button>

          <button
            type="button"
            onClick={onToggleDimensions}
            title="3B Ölçü Etiketlerini Göster / Gizle"
            className={`h-8 px-3 rounded-full flex items-center gap-1.5 text-[11px] font-semibold transition cursor-pointer ${
              showDimensions ? "bg-[#141413] text-white" : "hover:bg-[#EFECE4] text-[#44403C]"
            }`}
          >
            <Ruler className="w-3.5 h-3.5" />
            <span className="hidden md:inline">Ölçüler</span>
          </button>

          <button
            type="button"
            onClick={onToggleInteriorProps}
            title="Dolap İçi Giysi ve Aksesuar Önizlemesi"
            className={`h-8 px-3 rounded-full flex items-center gap-1.5 text-[11px] font-semibold transition cursor-pointer ${
              showInteriorProps
                ? "bg-[#EFECE4] text-[#141413] border border-[#DED8CC]"
                : "hover:bg-[#EFECE4] text-[#57534E]"
            }`}
          >
            <Shirt className="w-3.5 h-3.5" />
            <span className="hidden xl:inline">Eşyalar</span>
          </button>

          <button
            type="button"
            data-testid="v11-open-scene-settings-btn"
            onClick={() => {
              setScenePopoverOpen((v) => !v);
              setSectionPopoverOpen(false);
            }}
            title="Sahne Işığı, Zemin Dokusu ve Render Ayarları"
            className={`h-8 px-3 rounded-full flex items-center gap-1.5 text-[11px] font-semibold transition cursor-pointer ${
              scenePopoverOpen || cncXrayMode || renderStyle !== "solid"
                ? "bg-[#141413] text-white"
                : "hover:bg-[#EFECE4] text-[#44403C]"
            }`}
          >
            <SlidersHorizontal className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Sahne</span>
          </button>
        </div>
      </div>
    );
  }
);

BottomSceneDock.displayName = "BottomSceneDock";
