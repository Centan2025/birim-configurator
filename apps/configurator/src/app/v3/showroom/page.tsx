"use client";

import React, { useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import {
  useV3Adapter,
  DEFAULT_MATERIALS,
  WARDROBE_TEMPLATES,
} from "../../../v3/adapter/useV3Adapter";
import { V3BrandBadge, V3PrototypeSwitcher } from "../../../v3/design-system";
import { V3CadViewport2D } from "../../../v3/components/V3CadViewport2D";
import { V3ProjectModal } from "../../../v3/components/V3ProjectModal";
import {
  Camera,
  DoorOpen,
  Eye,
  EyeOff,
  FolderOpen,
  Layers,
  Maximize2,
  Palette,
  SlidersHorizontal,
  Sparkles,
  ArrowUpRight,
  Check,
} from "lucide-react";

const V3ThreeViewport = dynamic(
  () => import("../../../v3/components/V3ThreeViewport"),
  {
    ssr: false,
    loading: () => (
      <div className="w-full h-full flex items-center justify-center bg-[#EBE7DF] text-stone-600 text-xs">
        Showroom Sahnesi Hazırlanıyor...
      </div>
    ),
  }
);

export default function V3ShowroomPage() {
  const {
    project,
    activeModule,
    activeModuleIndex,
    setActiveModuleIndex,
    activeBay,
    activeBayIndex,
    doorOpenAngleDeg,
    setDoorOpenAngleDeg,
    drawerOpenMm,
    setDrawerOpenMm,
    toggleDoorOpen,
    cameraPreset,
    setCameraPreset,
    pricing,
    setDimensions,
    setMaterials,
    addShelf,
    applyTemplate,
    loadLinearKitchen,
  } = useV3Adapter();

  const [zenMode, setZenMode] = useState(false);
  const [show2DOverlay, setShow2DOverlay] = useState(false);
  const [activeDrawer, setActiveDrawer] = useState<"none" | "templates" | "customize">(
    "none"
  );
  const [isProjectModalOpen, setIsProjectModalOpen] = useState(false);

  if (!activeModule) return null;
  const { width, height, depth } = activeModule.dimensions;

  return (
    <div
      data-testid="v3-showroom-root"
      className="relative h-screen w-screen overflow-hidden bg-[#EBE7DF] text-stone-900 font-sans select-none"
    >
      {/* 1. FULL-BLEED 3D OR 2D STAGE */}
      <div className="absolute inset-0">
        {!show2DOverlay ? (
          <V3ThreeViewport theme="showroom-neutral" showGrid={!zenMode} />
        ) : (
          <V3CadViewport2D mode="elevation" />
        )}
      </div>

      {/* 2. FLOATING TOP HEADER PILLS (Hidden in Zen Presentation Mode except exit button) */}
      {!zenMode ? (
        <div className="absolute top-5 left-6 right-6 z-20 flex items-center justify-between pointer-events-none">
          {/* Left: Brand & Active Collection Card */}
          <div className="pointer-events-auto flex items-center gap-3 bg-white/90 backdrop-blur-md px-4 py-2.5 rounded-2xl border border-stone-200/80 shadow-md">
            <V3BrandBadge subtitle="SHOWROOM" />
            <div className="h-4 w-px bg-stone-200" />
            <div>
              <div
                data-testid="showroom-project-title"
                className="text-xs font-bold text-stone-900"
              >
                {project.title}
              </div>
              <div className="text-[11px] font-mono text-stone-500">
                {activeModule.name} • {width} × {height} × {depth} mm
              </div>
            </div>
          </div>

          {/* Center: Prototype Switcher & 2D/3D Toggle */}
          <div className="pointer-events-auto hidden md:flex items-center gap-2">
            <V3PrototypeSwitcher />
            <button
              type="button"
              data-testid="showroom-toggle-2d"
              onClick={() => setShow2DOverlay(!show2DOverlay)}
              className={`px-3.5 py-2 rounded-xl text-xs font-semibold border shadow-sm transition cursor-pointer ${
                show2DOverlay
                  ? "bg-stone-900 text-white border-stone-900"
                  : "bg-white/90 hover:bg-white text-stone-800 border-stone-200/90 backdrop-blur-md"
              }`}
            >
              {show2DOverlay ? "3D Sahneye Dön" : "2D Ölçü Çizimi"}
            </button>
          </div>

          {/* Right: Save, Zen Presentation & Return to Studio */}
          <div className="pointer-events-auto flex items-center gap-2">
            <button
              type="button"
              data-testid="showroom-open-projects-btn"
              onClick={() => setIsProjectModalOpen(true)}
              className="px-3.5 py-2.5 rounded-2xl bg-white/90 hover:bg-white backdrop-blur-md border border-stone-200/90 text-xs font-semibold text-stone-800 shadow-md flex items-center gap-1.5 cursor-pointer"
            >
              <FolderOpen className="w-3.5 h-3.5 text-amber-700" />
              <span>Kaydet / Aç</span>
            </button>

            <button
              type="button"
              data-testid="showroom-zen-toggle"
              onClick={() => {
                setZenMode(true);
                setActiveDrawer("none");
              }}
              className="px-3.5 py-2.5 rounded-2xl bg-white/90 hover:bg-white backdrop-blur-md border border-stone-200/90 text-xs font-semibold text-stone-800 shadow-md flex items-center gap-1.5 cursor-pointer"
              title="Dikkat Dağıtmayan Tam Ekran Sunum Modu"
            >
              <Maximize2 className="w-3.5 h-3.5 text-amber-700" />
              <span>Sunum Modu</span>
            </button>

            <Link
              href="/v3/studio"
              data-testid="showroom-return-studio"
              className="px-4 py-2.5 rounded-2xl bg-stone-900 hover:bg-stone-800 text-white text-xs font-semibold shadow-md flex items-center gap-1.5"
            >
              <span>Tasarım Düzenlemeye Dön</span>
              <ArrowUpRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>
      ) : (
        <div className="absolute top-5 right-6 z-30">
          <button
            type="button"
            data-testid="showroom-exit-zen"
            onClick={() => setZenMode(false)}
            className="px-4 py-2.5 rounded-2xl bg-stone-900/85 hover:bg-stone-900 text-white backdrop-blur-md text-xs font-semibold shadow-lg flex items-center gap-2 cursor-pointer"
          >
            <Eye className="w-3.5 h-3.5 text-amber-400" />
            <span>Sunum Modundan Çık</span>
          </button>
        </div>
      )}

      {/* 3. FLOATING RIGHT CAMERA & KINEMATICS DOCK */}
      {!zenMode && (
        <div className="absolute right-6 top-1/2 -translate-y-1/2 z-20 flex flex-col gap-2 bg-white/90 backdrop-blur-md p-2 rounded-2xl border border-stone-200/90 shadow-lg">
          <div className="text-[10px] font-bold uppercase tracking-wider text-stone-400 text-center px-1 pt-0.5">
            Kamera
          </div>
          {[
            { id: "iso", label: "Perspektif" },
            { id: "front", label: "Ön Cephe" },
            { id: "side", label: "Yan Bakış" },
            { id: "top", label: "Üst Bakış" },
          ].map((cam) => (
            <button
              key={cam.id}
              type="button"
              data-testid={`showroom-cam-${cam.id}`}
              onClick={() => setCameraPreset(cam.id as "iso" | "front" | "side" | "top")}
              className={`px-3 py-2 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer ${
                cameraPreset === cam.id
                  ? "bg-stone-900 text-white shadow-xs"
                  : "text-stone-700 hover:bg-stone-100"
              }`}
            >
              <Camera className="w-3.5 h-3.5 text-amber-700" />
              <span>{cam.label}</span>
            </button>
          ))}

          <div className="h-px bg-stone-200 my-1" />

          {/* Smooth Door & Drawer Opening Controls */}
          <button
            type="button"
            data-testid="showroom-door-toggle"
            onClick={toggleDoorOpen}
            className={`px-3 py-2.5 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition cursor-pointer ${
              doorOpenAngleDeg > 0
                ? "bg-amber-700 text-white shadow-xs"
                : "bg-stone-100 hover:bg-stone-200 text-stone-800"
            }`}
          >
            {doorOpenAngleDeg > 0 ? (
              <>
                <EyeOff className="w-3.5 h-3.5" />
                <span>Kapakları Kapat</span>
              </>
            ) : (
              <>
                <DoorOpen className="w-3.5 h-3.5" />
                <span>Kapakları Aç</span>
              </>
            )}
          </button>

          <div className="px-2 py-1 space-y-1">
            <div className="flex justify-between text-[10px] text-stone-500 font-medium">
              <span>Kapak Açısı</span>
              <span className="font-mono font-bold text-stone-800">{doorOpenAngleDeg}°</span>
            </div>
            <input
              type="range"
              min={0}
              max={90}
              value={doorOpenAngleDeg}
              onChange={(e) => setDoorOpenAngleDeg(Number(e.target.value))}
              className="w-28 accent-amber-700 h-1.5 bg-stone-200 rounded-lg cursor-pointer"
            />
          </div>

          <div className="px-2 py-1 space-y-1">
            <div className="flex justify-between text-[10px] text-stone-500 font-medium">
              <span>Çekmece</span>
              <span className="font-mono font-bold text-stone-800">{drawerOpenMm}mm</span>
            </div>
            <input
              type="range"
              min={0}
              max={350}
              step={25}
              value={drawerOpenMm}
              onChange={(e) => setDrawerOpenMm(Number(e.target.value))}
              className="w-28 accent-amber-700 h-1.5 bg-stone-200 rounded-lg cursor-pointer"
            />
          </div>
        </div>
      )}

      {/* 4. FLOATING POPOVER DRAWERS (Templates or Quick Dimensions/Shelves) */}
      {!zenMode && activeDrawer !== "none" && (
        <div
          data-testid={`showroom-drawer-${activeDrawer}`}
          className="absolute bottom-24 left-1/2 -translate-x-1/2 z-30 bg-white/95 backdrop-blur-xl border border-stone-200/90 rounded-3xl shadow-2xl p-5 w-[92vw] max-w-2xl"
        >
          {activeDrawer === "templates" ? (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-stone-500">
                  Showroom Koleksiyonu Seçin
                </span>
                <button
                  type="button"
                  onClick={() => setActiveDrawer("none")}
                  className="text-xs text-stone-400 hover:text-stone-900 cursor-pointer"
                >
                  Kapat ✕
                </button>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {WARDROBE_TEMPLATES.map((tpl) => (
                  <button
                    key={tpl.templateId}
                    type="button"
                    data-testid={`showroom-tpl-${tpl.templateId}`}
                    onClick={() => {
                      applyTemplate(tpl.templateId);
                      setActiveDrawer("none");
                    }}
                    className="p-3.5 rounded-2xl bg-stone-50 hover:bg-amber-50/70 border border-stone-200 hover:border-amber-700 text-left transition cursor-pointer"
                  >
                    <div className="text-xs font-bold text-stone-900">{tpl.name}</div>
                    <div className="text-[11px] text-stone-500 mt-0.5">{tpl.description}</div>
                  </button>
                ))}
                <button
                  type="button"
                  data-testid="showroom-tpl-kitchen"
                  onClick={() => {
                    loadLinearKitchen();
                    setActiveDrawer("none");
                  }}
                  className="p-3.5 rounded-2xl bg-stone-50 hover:bg-amber-50/70 border border-stone-200 hover:border-amber-700 text-left transition cursor-pointer"
                >
                  <div className="text-xs font-bold text-stone-900">
                    Levent Loft Doğrusal Mutfak
                  </div>
                  <div className="text-[11px] text-stone-500 mt-0.5">
                    3200mm tam donanımlı mutfak yerleşimi
                  </div>
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-stone-500">
                  Hızlı Ölçü & İç Donatı Özelleştirme ({activeModule.name})
                </span>
                <button
                  type="button"
                  onClick={() => setActiveDrawer("none")}
                  className="text-xs text-stone-400 hover:text-stone-900 cursor-pointer"
                >
                  Kapat ✕
                </button>
              </div>

              {/* Module pills if multi-module */}
              {project.modules.length > 1 && (
                <div className="flex gap-1.5 overflow-x-auto pb-1">
                  {project.modules.map((m, idx) => (
                    <button
                      key={m.id}
                      type="button"
                      data-testid={`showroom-mod-select-${idx}`}
                      onClick={() => setActiveModuleIndex(idx)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-semibold cursor-pointer ${
                        activeModuleIndex === idx
                          ? "bg-stone-900 text-white"
                          : "bg-stone-100 text-stone-700"
                      }`}
                    >
                      {m.name}
                    </button>
                  ))}
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                {/* Width presets */}
                <div className="p-3 rounded-2xl bg-stone-50 border border-stone-200 space-y-2">
                  <div className="flex justify-between">
                    <span className="font-semibold text-stone-600">Genişlik</span>
                    <span className="font-mono font-bold text-stone-900">{width} mm</span>
                  </div>
                  <div className="flex gap-1 flex-wrap">
                    {[1200, 1600, 1800, 2000, 2400].map((pw) => (
                      <button
                        key={pw}
                        type="button"
                        data-testid={`showroom-width-preset-${pw}`}
                        onClick={() => setDimensions(pw, height, depth)}
                        className={`flex-1 py-1.5 px-2 rounded-lg font-mono text-[11px] font-bold cursor-pointer ${
                          width === pw
                            ? "bg-amber-700 text-white"
                            : "bg-white border border-stone-200 text-stone-700"
                        }`}
                      >
                        {pw}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Height presets */}
                <div className="p-3 rounded-2xl bg-stone-50 border border-stone-200 space-y-2">
                  <div className="flex justify-between">
                    <span className="font-semibold text-stone-600">Yükseklik</span>
                    <span className="font-mono font-bold text-stone-900">{height} mm</span>
                  </div>
                  <div className="flex gap-1 flex-wrap">
                    {[2000, 2200, 2400, 2600].map((ph) => (
                      <button
                        key={ph}
                        type="button"
                        onClick={() => setDimensions(width, ph, depth)}
                        className={`flex-1 py-1.5 px-2 rounded-lg font-mono text-[11px] font-bold cursor-pointer ${
                          height === ph
                            ? "bg-amber-700 text-white"
                            : "bg-white border border-stone-200 text-stone-700"
                        }`}
                      >
                        {ph}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Quick Shelf Add */}
                <div className="p-3 rounded-2xl bg-stone-50 border border-stone-200 flex flex-col justify-between">
                  <span className="font-semibold text-stone-600">
                    İç Raflar ({activeBay?.shelves.length || 0} Adet)
                  </span>
                  <button
                    type="button"
                    data-testid="showroom-add-shelf-btn"
                    onClick={() => addShelf(activeBayIndex)}
                    className="w-full py-2 px-3 rounded-xl bg-stone-900 hover:bg-stone-800 text-white font-semibold flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <Layers className="w-3.5 h-3.5 text-amber-400" />
                    <span>+ Yeni Raf Ekle</span>
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* 5. FLOATING BOTTOM MATERIAL CAROUSEL & PRICE CARD */}
      {!zenMode && (
        <div className="absolute bottom-5 left-6 right-6 z-20 flex flex-wrap items-center justify-between gap-4 pointer-events-none">
          {/* Left: Quick Drawer Triggers */}
          <div className="pointer-events-auto flex items-center gap-2 bg-white/90 backdrop-blur-md p-2 rounded-2xl border border-stone-200/90 shadow-lg">
            <button
              type="button"
              data-testid="showroom-open-templates"
              onClick={() =>
                setActiveDrawer(activeDrawer === "templates" ? "none" : "templates")
              }
              className={`px-3.5 py-2.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer ${
                activeDrawer === "templates"
                  ? "bg-stone-900 text-white"
                  : "hover:bg-stone-100 text-stone-800"
              }`}
            >
              <Sparkles className="w-3.5 h-3.5 text-amber-700" />
              <span>Koleksiyonlar</span>
            </button>

            <button
              type="button"
              data-testid="showroom-open-customize"
              onClick={() =>
                setActiveDrawer(activeDrawer === "customize" ? "none" : "customize")
              }
              className={`px-3.5 py-2.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer ${
                activeDrawer === "customize"
                  ? "bg-stone-900 text-white"
                  : "hover:bg-stone-100 text-stone-800"
              }`}
            >
              <SlidersHorizontal className="w-3.5 h-3.5 text-amber-700" />
              <span>Ölçü & Raf ({width}mm)</span>
            </button>
          </div>

          {/* Center: Interactive Material Swatch Bar */}
          <div className="pointer-events-auto flex items-center gap-2 bg-white/95 backdrop-blur-md px-4 py-2 rounded-2xl border border-stone-200/90 shadow-lg overflow-x-auto max-w-full">
            <div className="flex items-center gap-1.5 pr-2 border-r border-stone-200 text-xs font-bold text-stone-700 shrink-0">
              <Palette className="w-3.5 h-3.5 text-amber-700" />
              <span>Kapak Yüzeyi:</span>
            </div>
            <div className="flex items-center gap-2">
              {DEFAULT_MATERIALS.map((mat) => {
                const isSelected = activeModule.carcass.doorMaterialId === mat.id;
                return (
                  <button
                    key={mat.id}
                    type="button"
                    data-testid={`showroom-mat-${mat.id}`}
                    onClick={() => setMaterials(undefined, mat.id)}
                    className={`group flex items-center gap-2 px-2.5 py-1.5 rounded-xl border text-xs transition shrink-0 cursor-pointer ${
                      isSelected
                        ? "bg-amber-50 border-amber-700 text-stone-900 font-bold shadow-2xs"
                        : "bg-white hover:bg-stone-50 border-stone-200 text-stone-600"
                    }`}
                  >
                    <span
                      className="w-5 h-5 rounded-full border border-stone-300 flex items-center justify-center shrink-0"
                      style={{ backgroundColor: mat.colorHex }}
                    >
                      {isSelected && (
                        <Check
                          className={`w-3 h-3 ${
                            mat.colorHex.toLowerCase() === "#f3f4f6" ||
                            mat.colorHex.toLowerCase() === "#ede8d0"
                              ? "text-stone-900"
                              : "text-white"
                          }`}
                        />
                      )}
                    </span>
                    <span className="hidden xl:inline">{mat.name.split(" (")[0]}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Right: Customer Presentation Price Card */}
          <div className="pointer-events-auto flex items-center gap-4 bg-white/95 backdrop-blur-md px-5 py-2.5 rounded-2xl border border-stone-200/90 shadow-lg">
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-stone-400 block">
                Anahtar Teslim Fiyat
              </span>
              <div className="flex items-baseline gap-1.5">
                <span
                  data-testid="showroom-total-price"
                  className="text-lg font-black font-mono text-stone-900"
                >
                  €{pricing.totalWithVatEur.toLocaleString("tr-TR", { minimumFractionDigits: 2 })}
                </span>
                <span className="text-[11px] font-mono text-stone-500">
                  ({pricing.totalWithVatTry.toLocaleString("tr-TR", { maximumFractionDigits: 0 })} TL)
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      <V3ProjectModal
        isOpen={isProjectModalOpen}
        onClose={() => setIsProjectModalOpen(false)}
      />
    </div>
  );
}
