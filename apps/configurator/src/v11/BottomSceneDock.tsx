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
  Move,
  Palette,
  PaintBucket,
  Camera,
  ChevronDown,
  Undo2,
  Redo2,
  Scan,
} from "lucide-react";
import type { ModuleInstance } from "@birim/core";
import type { ViewportRenderStyle } from "../store/useConfiguratorStore";
import { SectionPlaneMiniMap } from "./SectionPlaneMiniMap";
import { AnimatedPopoverPresence } from "./AnimatedWindowPresence";

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
  isShowroom?: boolean;
  isQuickPaletteOpen?: boolean;
  onToggleQuickPalette?: () => void;
  paintToolMode?: "none" | "paint" | "eyedropper";
  onTogglePaintBucket?: () => void;
  canUndo?: boolean;
  canRedo?: boolean;
  onUndo?: () => void;
  onRedo?: () => void;
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
    isSimpleTier,
    projectId,
    isShowroom = false,
    isQuickPaletteOpen = false,
    onToggleQuickPalette,
    paintToolMode = "none",
    onTogglePaintBucket,
    canUndo = false,
    canRedo = false,
    onUndo,
    onRedo,
  }) => {
    const [scenePopoverOpen, setScenePopoverOpen] = useState(false);
    const [cameraMenuOpen, setCameraMenuOpen] = useState(false);
    const [sectionPopoverOpen, setSectionPopoverOpen] = useState(false);
    const [activeCam, setActiveCam] = useState<"hero" | "room_front_persp" | "focus_module" | "front" | "side">("hero");
    const [lightMode, setLightMode] = useState<"daylight" | "showroom_warm" | "night_led">(
      "daylight"
    );
    const [floorId, setFloorId] = useState<string>("oak_parquet");
    const [sectionAxis, setSectionAxis] = useState<null | "X" | "Z">(null);
    const [sectionRatio, setSectionRatio] = useState<number>(0.5);
    const [renderingPhoto, setRenderingPhoto] = useState(false);
    const [moveMode3D, setMoveMode3D] = useState(false);
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

    const triggerCamera = (preset: "hero" | "room_front_persp" | "focus_module" | "front" | "side") => {
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
        {/* ETKİLEŞİMLİ 3B GÖRSEL KESİT MİNİ PLAN PENCERESİ (Animasyonlu) */}
        <AnimatedPopoverPresence isOpen={Boolean(sectionPopoverOpen && activeModule)} origin="bottom">
          {activeModule && (
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
        </AnimatedPopoverPresence>

        {/* YÜZEN SAHNE, GÖRÜNÜM & IŞIK POPOVER (Animasyonlu + Dramatik Cam) */}
        <AnimatedPopoverPresence isOpen={scenePopoverOpen} origin="bottom">
          <div
            data-testid="v11-scene-settings-popover"
            className="birim-dramatic-panel mb-2.5 w-80 rounded-3xl bg-[#2A313F]/68 backdrop-blur-2xl border border-white/[0.22] ring-1 ring-black/60 shadow-[0_26px_64px_rgba(0,0,0,0.62)] p-4 space-y-3.5 text-xs text-[#F3F4F6]"
          >
            <div className="flex items-center justify-between">
              <span className="font-bold text-[13px]">Sahne, Işık ve Görünüm</span>
              <button
                type="button"
                onClick={() => setScenePopoverOpen(false)}
                className="w-6 h-6 rounded-full hover:bg-[#EFECE4] text-slate-300 hover:text-[#141413] flex items-center justify-center cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="space-y-1.5">
              <div className="text-[10.5px] font-semibold text-slate-300">Stüdyo Aydınlatması</div>
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
              <div className="text-[10.5px] font-semibold text-slate-300">Zemin Kaplaması</div>
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
              <div className="text-[10.5px] font-semibold text-slate-300">Görünüm Stili</div>
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

              </div>
            </div>

            <div className="pt-2 border-t border-[#E6E1D6] space-y-2">
              {[
                {
                  id: "sw_dims",
                  label: "3B Ölçü Etiketleri",
                  checked: showDimensions,
                  onToggle: onToggleDimensions,
                },
                {
                  id: "sw_props",
                  label: "Dolap İçi Eşya & Askılar",
                  checked: showInteriorProps,
                  onToggle: onToggleInteriorProps,
                },
                {
                  id: "sw_doors",
                  label: "Kapakları Gizle (İçini Gör)",
                  checked: doorsHidden,
                  onToggle: onToggleDoorsHidden,
                },
                ...(!isSimpleTier
                  ? [
                      {
                        id: "sw_xray",
                        label: "CNC X-Ray Delik Görünümü",
                        checked: cncXrayMode,
                        onToggle: onToggleCncXray,
                      },
                    ]
                  : []),
              ].map((sw) => (
                <div key={sw.id} className="flex items-center justify-between gap-2 text-[11px]">
                  <span className="font-semibold text-[#44403C]">{sw.label}</span>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={sw.checked}
                    onClick={sw.onToggle}
                    className={`relative inline-flex items-center w-9 h-5 p-[2px] rounded-full border transition-colors duration-200 cursor-pointer ${
                      sw.checked
                        ? "bg-[#141413] border-[#141413]"
                        : "bg-[#E2DDD2] border-[#D3CCC0]"
                    }`}
                  >
                    <span
                      className={`w-3.5 h-3.5 rounded-full bg-white shadow-xs transition-transform duration-200 ${
                        sw.checked ? "translate-x-4" : "translate-x-0"
                      }`}
                    />
                  </button>
                </div>
              ))}
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
              <Download className="w-3.5 h-3.5 text-[#7DD3FC]" />
              <span>{renderingPhoto ? "2K Görsel Hazırlanıyor..." : "2K Stüdyo Fotoğraf İndir (.PNG)"}</span>
            </button>
          </div>
        </AnimatedPopoverPresence>

        {/* TEK BİRLEŞİK KOYU CAM (GLASSMORPHISM) ALT SAHNE KAPSÜLÜ */}
        <div className="relative h-12 px-2.5 rounded-full bg-[#1C222E]/82 backdrop-blur-2xl border border-white/[0.18] ring-1 ring-black/55 shadow-[0_20px_50px_rgba(0,0,0,0.52)] flex items-center gap-1.5 text-xs text-[#F3F4F6]">
          {/* Kamera Açıları Tek Dropdown Menü */}
          {!isShowroom && (
            <div className="relative">
              <button
                type="button"
                data-testid="v11-bottom-camera-dropdown-btn"
                onClick={() => {
                  setCameraMenuOpen((v) => !v);
                  setScenePopoverOpen(false);
                  setSectionPopoverOpen(false);
                }}
                title="Kamera Açıları (Genel 3B, Mekân Karşıdan, Yan, Modüle Odaklan)"
                className={`h-8 px-2.5 rounded-full flex items-center gap-1.5 text-[11px] font-semibold transition cursor-pointer ${
                  cameraMenuOpen
                    ? "bg-[#0284C7] text-white"
                    : "bg-white/[0.08] hover:bg-white/[0.16] text-slate-100 border border-white/[0.12]"
                }`}
              >
                <Camera className="w-3.5 h-3.5 text-sky-300" />
                <span className="inline whitespace-nowrap">
                  {activeCam === "room_front_persp"
                    ? "Karşıdan"
                    : activeCam === "focus_module"
                    ? "Odaklan"
                    : activeCam === "side"
                    ? "Yan"
                    : "Genel 3B"}
                </span>
                <ChevronDown className="w-3 h-3 opacity-80" />
              </button>
              {cameraMenuOpen && (
                <div className="absolute bottom-11 left-0 w-44 p-1.5 rounded-2xl bg-[#1C222E]/95 backdrop-blur-2xl border border-white/[0.18] shadow-[0_18px_40px_rgba(0,0,0,0.6)] space-y-0.5 z-50">
                  {(
                    [
                      { id: "hero", label: "Genel 3B" },
                      { id: "room_front_persp", label: "Mekân Karşıdan" },
                      { id: "side", label: "Yan Görünüş" },
                      { id: "focus_module", label: "Modüle Odaklan" },
                    ] as const
                  ).map((cam) => (
                    <button
                      key={cam.id}
                      type="button"
                      onClick={() => {
                        triggerCamera(cam.id);
                        setCameraMenuOpen(false);
                      }}
                      className={`w-full text-left px-2.5 py-1.5 rounded-xl text-[11px] font-semibold transition cursor-pointer ${
                        activeCam === cam.id
                          ? "bg-[#0284C7] text-white"
                          : "text-slate-200 hover:bg-white/[0.10]"
                      }`}
                    >
                      {cam.label}
                    </button>
                  ))}
                  <div className="my-1 border-t border-white/10" />
                  <button
                    type="button"
                    onClick={() => {
                      triggerCamera("hero");
                      setCameraMenuOpen(false);
                    }}
                    className="w-full text-left px-2.5 py-1.5 rounded-xl text-[11px] font-semibold text-sky-300 hover:bg-white/[0.10] flex items-center gap-1.5 transition cursor-pointer"
                  >
                    <Maximize2 className="w-3 h-3" />
                    <span>Sahneyi Ortala</span>
                  </button>
                </div>
              )}
            </div>
          )}
          {isShowroom && (
            <div className="flex items-center gap-0.5 p-0.5 rounded-full bg-black/40 border border-white/[0.12]">
              {(
                [
                  { id: "hero", label: "Genel 3B" },
                  { id: "room_front_persp", label: "Mekân Karşıdan" },
                  { id: "focus_module", label: "Modüle Odaklan" },
                  { id: "side", label: "Yan" },
                ] as const
              ).map((cam) => (
                <button
                  key={cam.id}
                  type="button"
                  onClick={() => triggerCamera(cam.id)}
                  className={`h-8 px-3 rounded-full text-[11px] font-bold transition-all duration-200 cursor-pointer ${
                    activeCam === cam.id
                      ? "bg-gradient-to-br from-[#0284C7] via-[#1D4ED8] to-[#1E3A8A] text-white shadow-[0_0_18px_rgba(29,78,216,0.54),0_4px_12px_rgba(37,99,235,0.42)]"
                      : "text-slate-300 hover:text-white"
                  }`}
                >
                  {cam.label}
                </button>
              ))}
              <button
                type="button"
                onClick={() => triggerCamera("hero")}
                title="Sahneyi Ekrana Ortala"
                className="w-8 h-8 rounded-full flex items-center justify-center text-slate-300 hover:text-white hover:bg-white/[0.12] transition cursor-pointer"
              >
                <Maximize2 className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {!isShowroom && (
            <>
              <button
                type="button"
                data-testid="v11-bottom-move-mode-btn"
                onClick={() => {
                  const next = !moveMode3D;
                  setMoveMode3D(next);
                  if (typeof window !== "undefined") {
                    window.dispatchEvent(new CustomEvent("birim:set-move-mode-3d", { detail: next }));
                  }
                }}
                title={
                  moveMode3D
                    ? "Modül Taşıma Açık — Ekranı sol tuşla döndürmek için kapatın"
                    : "Sol Tuş: Ekranı Döndür • Dolabı duvarda kaydırmak için tıklayın (veya Shift basılı tutun)"
                }
                className={`h-8 px-2.5 rounded-full flex items-center gap-1.5 text-[11px] font-semibold transition cursor-pointer ${
                  moveMode3D
                    ? "bg-[#C2410C] text-white"
                    : "hover:bg-white/[0.14] text-slate-200"
                }`}
              >
                <Move className="w-3.5 h-3.5" />
                
              </button>

              {onToggleQuickPalette && (
                <button
                  type="button"
                  data-testid="v15-bottom-quick-palette-btn"
                  onClick={() => {
                    setScenePopoverOpen(false);
                    setSectionPopoverOpen(false);
                    onToggleQuickPalette();
                  }}
                  title="Bölgesel Hızlı Kartela ve 8 Hazır İmza Kombinasyonu (Kısayol: M)"
                  className={`h-8 px-2.5 rounded-full flex items-center gap-1.5 text-[11px] font-semibold transition cursor-pointer ${
                    isQuickPaletteOpen
                      ? "bg-[#141413] text-white shadow-2xs"
                      : "bg-white/[0.10] hover:bg-white/[0.18] text-[#F3F4F6] border border-white/[0.14]"
                  }`}
                >
                  <Palette className="w-3.5 h-3.5 text-[#8C6D46]" />
                  <span className="hidden md:inline whitespace-nowrap">Kartela</span>
                </button>
              )}

              {onTogglePaintBucket && (
                <button
                  type="button"
                  data-testid="v15-bottom-paint-bucket-btn"
                  onClick={onTogglePaintBucket}
                  title="3B Boya Kovası (Kısayol: B) • Alt+Tık: 3B Yüzeyden Malzeme Örnekle"
                  className={`h-8 px-2.5 rounded-full flex items-center gap-1.5 text-[11px] font-semibold transition cursor-pointer ${
                    paintToolMode === "paint"
                      ? "bg-[#C2410C] text-white"
                      : paintToolMode === "eyedropper"
                      ? "bg-[#1D4ED8] text-white"
                      : "hover:bg-white/[0.14] text-slate-200"
                  }`}
                >
                  <PaintBucket className="w-3.5 h-3.5" />
                  
                </button>
              )}

              <span className="h-5 w-px bg-[#DFD9CE]" />
            </>
          )}

          <div className="flex items-center gap-2 px-1.5">
            <button
              type="button"
              onClick={() => onChangeDoorAngle(doorOpenAngleDeg > 10 ? 0 : 82, true)}
              title={doorOpenAngleDeg > 10 ? "Kapak & Çekmeceleri Kapat" : "Kapak & Çekmeceleri Aç"}
              className={`h-8 px-2.5 rounded-full flex items-center gap-1.5 text-[11px] font-semibold transition cursor-pointer ${
                doorOpenAngleDeg > 10
                  ? "bg-[#141413] text-white"
                  : "hover:bg-white/[0.14] text-slate-200"
              }`}
            >
              <DoorOpen className="w-3.5 h-3.5" />
              <span className="hidden lg:inline whitespace-nowrap">{doorOpenAngleDeg > 10 ? "Kapat" : "Kapak Aç"}</span>
            </button>

            <input
              type="range"
              aria-label="Kapak & Çekmece Açılma Oranı"
              min={0}
              max={85}
              step={1}
              value={Math.round(doorOpenAngleDeg)}
              onChange={(e) => onChangeDoorAngle(Number(e.target.value), false)}
              className="hidden sm:block w-18 accent-[#141413] h-1.5 bg-[#DFD9CE] rounded-full cursor-pointer"
            />
            <span className="hidden md:inline-block w-8 font-mono text-[10.5px] text-slate-300">
              %{doorOpenPct}
            </span>

            <button
              type="button"
              onClick={onToggleDoorsHidden}
                  title={doorsHidden ? "Kapakları Yeniden Göster" : "İç Düzeni Görmek İçin Kapakları Gizle"}
                  className={`h-7 rounded-full flex items-center justify-center gap-1.5 transition cursor-pointer ${
                    doorsHidden
                      ? "px-2.5 bg-gradient-to-br from-[#0284C7] via-[#1D4ED8] to-[#1E3A8A] text-white text-[11px] font-bold shadow-[0_0_14px_rgba(29,78,216,0.55)]"
                      : "w-7 hover:bg-white/[0.14] text-slate-200"
                  }`}
                >
                  {doorsHidden ? (
                    <>
                      <Eye className="w-3.5 h-3.5 shrink-0" />
                      <span>Kapakları Göster</span>
                    </>
                  ) : (
                    <EyeOff className="w-3.5 h-3.5" />
                  )}
              
            </button>
          </div>

          <span className="h-5 w-px bg-[#DFD9CE]" />

          {/* Canlı Görsel Kesit Planı Düğmesi */}
          {!isShowroom && (
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
                  : "hover:bg-white/[0.14] text-slate-200"
              }`}
            >
              <Scissors className="w-3.5 h-3.5" />
              
            </button>
          )}

          <button
            type="button"
            onClick={onToggleDimensions}
            title="3B Ölçü Etiketlerini Göster / Gizle"
            className={`h-8 px-3 rounded-full flex items-center gap-1.5 text-[11px] font-semibold transition cursor-pointer ${
              showDimensions ? "bg-[#141413] text-white" : "hover:bg-white/[0.14] text-slate-200"
            }`}
          >
            <Ruler className="w-3.5 h-3.5" />
            <span className="hidden lg:inline whitespace-nowrap">Ölçüler</span>
          </button>

          {!isShowroom && (
            <button
              type="button"
              data-testid="v11-bottom-wireframe-btn"
              onClick={() => onChangeRenderStyle(renderStyle === "wireframe" ? "solid" : "wireframe")}
              title="Tel Çerçeve (Wireframe) Görünümünü Aç / Kapat"
              className={`h-8 px-2.5 rounded-full flex items-center gap-1 text-[11px] font-semibold transition cursor-pointer ${
                renderStyle === "wireframe"
                  ? "bg-[#0284C7] text-white shadow-sm"
                  : "hover:bg-white/[0.14] text-slate-200"
              }`}
            >
              <span>Tel</span>
            </button>
          )}

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
            
          </button>

          {!isShowroom && (
            <button
              type="button"
              data-testid="v11-bottom-xray-btn"
              onClick={() =>
                onChangeRenderStyle(renderStyle === "transparent" ? "solid" : "transparent")
              }
              title="Şeffaf X-Ray Görünümünü Aç / Kapat"
              className={`h-8 px-2.5 rounded-full flex items-center gap-1.5 text-[11px] font-semibold transition cursor-pointer ${
                renderStyle === "transparent"
                  ? "bg-[#0284C7] text-white shadow-sm"
                  : "hover:bg-white/[0.14] text-slate-200"
              }`}
            >
              <Scan className="w-3.5 h-3.5" />
              <span className="inline whitespace-nowrap">X-Ray</span>
            </button>
          )}

          {!isShowroom && (
            <button
              type="button"
              data-testid="v11-open-scene-settings-btn"
              onClick={() => {
                setScenePopoverOpen((v) => !v);
                setSectionPopoverOpen(false);
                setCameraMenuOpen(false);
              }}
              title="Ultra PBR Render, Sahne Işığı ve Zemin Ayarları"
              className={`h-8 px-2.5 rounded-full flex items-center gap-1.5 text-[11px] font-semibold transition cursor-pointer ${
                scenePopoverOpen || renderStyle !== "solid"
                  ? "bg-[#0284C7] text-white"
                  : "hover:bg-white/[0.14] text-slate-200"
              }`}
            >
              <SlidersHorizontal className="w-3.5 h-3.5" />
              <span className="inline whitespace-nowrap">Ultra PBR</span>
            </button>
          )}

          {!isShowroom && (onUndo || onRedo) && (
            <>
              <span className="h-5 w-px bg-white/15" />
              <div className="flex items-center gap-0.5">
                {onUndo && (
                  <button
                    type="button"
                    disabled={!canUndo}
                    onClick={onUndo}
                    title="Geri Al (Ctrl+Z)"
                    className="w-8 h-8 rounded-full flex items-center justify-center text-slate-200 hover:bg-white/[0.14] disabled:opacity-35 transition cursor-pointer"
                  >
                    <Undo2 className="w-3.5 h-3.5" />
                  </button>
                )}
                {onRedo && (
                  <button
                    type="button"
                    disabled={!canRedo}
                    onClick={onRedo}
                    title="İleri Al (Ctrl+Y)"
                    className="w-8 h-8 rounded-full flex items-center justify-center text-slate-200 hover:bg-white/[0.14] disabled:opacity-35 transition cursor-pointer"
                  >
                    <Redo2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    );
  }
);

BottomSceneDock.displayName = "BottomSceneDock";
