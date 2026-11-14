"use client";

import React, { useState, useCallback, useEffect } from "react";
import { BirimLogo } from "../../design-system";
import { startZeroLagModalDrag } from "../../design-system/zeroLagDrag";
import { checkBlenderRenderStatus, type BlenderEngineStatus } from "../../engine/blenderRenderClient";
import { Camera, Sparkles, Download, SplitSquareHorizontal, RefreshCw, X, Gauge } from "lucide-react";

export interface StudioRenderPerfMetrics {
  drawCalls: number;
  triangles: number;
  geometries: number;
  textures: number;
}

interface StudioRenderWindow {
  __birimRenderUltraStudioPhoto?: (opts?: {
    angle?: "current" | "iso" | "front";
    width?: number;
    height?: number;
    samples?: number;
    onProgress?: (pct: number) => void;
  }) => Promise<string>;
  __birimRenderPathTracedPhoto?: (opts?: {
    angle?: "current" | "iso" | "front";
    width?: number;
    height?: number;
    samples?: number;
    bounces?: number;
    onProgress?: (pct: number, currentPreviewUrl?: string) => void;
    shouldCancel?: () => boolean;
  }) => Promise<{
    dataUrl: string;
    elapsedMs: number;
    samplesCompleted: number;
    metrics: StudioRenderPerfMetrics;
    engine?: string;
    device?: string;
    error?: string;
  }>;
  __birimGetLiveSceneStats?: () => StudioRenderPerfMetrics;
}

interface StudioRenderModalProps {
  isOpen: boolean;
  projectId: string;
  projectTitle: string;
  onClose: () => void;
}

export const StudioRenderModal: React.FC<StudioRenderModalProps> = ({
  isOpen,
  projectId,
  projectTitle,
  onClose,
}) => {
  const [cameraAngle, setCameraAngle] = useState<"current" | "iso" | "front">("current");
  const [resolution, setResolution] = useState<"2k" | "fhd">("2k");
  const [ptSamples, setPtSamples] = useState<32 | 64>(64);

  const [rasterUrl, setRasterUrl] = useState<string>("");
  const [rasterMs, setRasterMs] = useState<number | null>(null);
  const [pathTraceUrl, setPathTraceUrl] = useState<string>("");
  const [pathTraceMs, setPathTraceMs] = useState<number | null>(null);
  const [completedSpp, setCompletedSpp] = useState<number>(0);

  const [activeEngineRunning, setActiveEngineRunning] = useState<null | "raster" | "pathtrace" | "both">(null);
  const [progressPct, setProgressPct] = useState<number>(0);
  const [viewTab, setViewTab] = useState<"compare" | "pathtrace" | "raster">("pathtrace");
  const [wipePct, setWipePct] = useState<number>(50);
  const [blenderStatus, setBlenderStatus] = useState<BlenderEngineStatus | null>(null);
  const [renderEngineLabel, setRenderEngineLabel] = useState<string>("Blender Cycles (OIDN)");
  const [renderError, setRenderError] = useState<string | null>(null);
  const [sceneMetrics, setSceneMetrics] = useState<StudioRenderPerfMetrics>({
    drawCalls: 0,
    triangles: 0,
    geometries: 0,
    textures: 0,
  });

  const cancelFlagRef = React.useRef<boolean>(false);

  const targetW = resolution === "2k" ? 2048 : 1920;
  const targetH = resolution === "2k" ? 1280 : 1080;

  const refreshLiveMetrics = useCallback(() => {
    if (typeof window === "undefined") return;
    const win = window as unknown as StudioRenderWindow;
    if (typeof win.__birimGetLiveSceneStats === "function") {
      const stats = win.__birimGetLiveSceneStats();
      if (stats) setSceneMetrics(stats);
    }
  }, []);

  const runComparisonRender = useCallback(
    async (mode: "both" | "raster" | "pathtrace") => {
      if (typeof window === "undefined") return;
      const win = window as unknown as StudioRenderWindow;
      cancelFlagRef.current = false;
      setRenderError(null);
      setActiveEngineRunning(mode);
      setProgressPct(2);
      refreshLiveMetrics();

      if (mode === "raster" || mode === "both") {
        if (typeof win.__birimRenderUltraStudioPhoto === "function") {
          const t0 = performance.now();
          const rUrl = await win.__birimRenderUltraStudioPhoto({
            angle: cameraAngle,
            width: targetW,
            height: targetH,
            onProgress: (p) => setProgressPct(mode === "both" ? Math.round(p * 0.3) : p),
          });
          const dt = Math.round(performance.now() - t0);
          if (rUrl) {
            setRasterUrl(rUrl);
            setRasterMs(dt);
          }
          if (mode === "raster") setViewTab("raster");
        }
      }

      if ((mode === "pathtrace" || mode === "both") && !cancelFlagRef.current) {
        if (typeof win.__birimRenderPathTracedPhoto === "function") {
          const res = await win.__birimRenderPathTracedPhoto({
            angle: cameraAngle,
            width: targetW,
            height: targetH,
            samples: ptSamples,
            bounces: 5,
            shouldCancel: () => cancelFlagRef.current,
            onProgress: (pct, preview) => {
              setProgressPct(mode === "both" ? 30 + Math.round(pct * 0.7) : pct);
              setCompletedSpp(Math.max(1, Math.round((pct / 100) * ptSamples)));
              if (preview) setPathTraceUrl(preview);
            },
          });
          if (res?.dataUrl) {
            setPathTraceUrl(res.dataUrl);
            setPathTraceMs(Math.round(res.elapsedMs));
            setCompletedSpp(res.samplesCompleted);
            setSceneMetrics(res.metrics);
            if (res.engine) setRenderEngineLabel(res.engine);
          } else if (res?.error) {
            setRenderError(res.error);
          }
          setViewTab(mode === "both" && rasterUrl ? "compare" : "pathtrace");
        }
      }

      setActiveEngineRunning(null);
      setProgressPct(100);
    },
    [cameraAngle, targetW, targetH, ptSamples, refreshLiveMetrics]
  );

  useEffect(() => {
    if (!isOpen) return;
    void checkBlenderRenderStatus().then(setBlenderStatus);
    refreshLiveMetrics();
    if (!pathTraceUrl && activeEngineRunning === null) {
      void runComparisonRender("pathtrace");
    }
  }, [isOpen, pathTraceUrl, activeEngineRunning, refreshLiveMetrics, runComparisonRender]);

  if (!isOpen) return null;

  const downloadDataUrl = (url: string, suffix: string) => {
    if (!url) return;
    const a = document.createElement("a");
    a.href = url;
    a.download = `Birim_${suffix}_${projectId}_${targetW}x${targetH}.png`;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      if (a.parentNode) a.parentNode.removeChild(a);
    }, 800);
  };

  return (
    <div
      data-testid="studio-independent-render-modal"
      onClick={onClose}
      className="fixed inset-0 z-[160] flex items-center justify-center bg-slate-950/55 backdrop-blur-xs p-3 sm:p-5"
    >
      <div
        data-draggable-shell="studio-render-modal"
        onClick={(e) => e.stopPropagation()}
        className="birim-ice-modal rounded-[28px] max-w-5xl w-full max-h-[92vh] flex flex-col overflow-hidden text-[#141413]"
      >
        {/* Header with Official Birim Logo */}
        <div
          onPointerDown={(e) => startZeroLagModalDrag(e)}
          title="Pencereyi taşımak için sürükleyin"
          className="px-5 py-3.5 birim-ice-shell-header flex items-center justify-between gap-3 cursor-grab active:cursor-grabbing select-none"
        >
          <div className="flex flex-1 items-center gap-3 min-w-0">
            <BirimLogo className="h-5 w-auto text-[#141413] shrink-0" />
            <div className="h-4 w-px bg-slate-900/15 shrink-0" />
            <div className="min-w-0">
              <h2 className="text-sm font-bold text-[#141413] truncate flex items-center gap-2">
                <span>Bağımsız Stüdyo Render &amp; {renderEngineLabel}</span>
                {blenderStatus && (
                  <span
                    className={`px-2 py-0.5 rounded-full text-[10px] font-mono ${
                      blenderStatus.available
                        ? "bg-emerald-950/90 text-emerald-200"
                        : "bg-rose-950/90 text-rose-200"
                    }`}
                  >
                    {blenderStatus.available
                      ? `Blender ${blenderStatus.version ?? "Ready"}`
                      : "Blender Bulunamadı"}
                  </span>
                )}
              </h2>
              <p className="text-[11px] text-[#475569] truncate">
                {projectTitle} • Yerel Blender Cycles (AgX + OpenImageDenoise) ile gerçek ışın izlemeli (Ray-Traced) stüdyo render
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <div className="hidden md:flex items-center gap-2 px-2.5 py-1 rounded-xl bg-white/60 border border-white/75 text-[10px] font-mono text-slate-700">
              <Gauge className="w-3.5 h-3.5 text-slate-600" />
              <span>Draw: <b>{sceneMetrics.drawCalls}</b></span>
              <span>•</span>
              <span>Tri: <b>{(sceneMetrics.triangles / 1000).toFixed(1)}k</b></span>
              <span>•</span>
              <span>Geo/Tex: <b>{sceneMetrics.geometries}/{sceneMetrics.textures}</b></span>
            </div>
            <button
              type="button"
              onClick={() => {
                cancelFlagRef.current = true;
                onClose();
              }}
              className="w-8 h-8 rounded-xl birim-ice-btn flex items-center justify-center text-slate-700 hover:text-slate-950 cursor-pointer"
              title="Kapat"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Control Toolbar */}
        <div className="px-5 py-2.5 bg-white/45 border-b border-white/60 flex flex-wrap items-center justify-between gap-2.5 text-xs">
          <div className="flex flex-wrap items-center gap-2">
            <div className="inline-flex items-center p-0.5 rounded-xl bg-slate-900/8 border border-white/70">
              {[
                { id: "current" as const, lbl: "Aktif Kamera" },
                { id: "iso" as const, lbl: "3/4 Stüdyo Kadraj" },
                { id: "front" as const, lbl: "Tam Cephe" },
              ].map((ang) => (
                <button
                  key={ang.id}
                  type="button"
                  onClick={() => setCameraAngle(ang.id)}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition cursor-pointer ${
                    cameraAngle === ang.id
                      ? "bg-[#141413] text-white"
                      : "text-slate-700 hover:text-slate-950"
                  }`}
                >
                  {ang.lbl}
                </button>
              ))}
            </div>

            <div className="inline-flex items-center p-0.5 rounded-xl bg-slate-900/8 border border-white/70">
              {[
                { id: "2k" as const, lbl: "2K (2048×1280)" },
                { id: "fhd" as const, lbl: "FHD (1920×1080)" },
              ].map((res) => (
                <button
                  key={res.id}
                  type="button"
                  onClick={() => setResolution(res.id)}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-mono font-bold transition cursor-pointer ${
                    resolution === res.id
                      ? "bg-[#141413] text-white"
                      : "text-slate-700 hover:text-slate-950"
                  }`}
                >
                  {res.lbl}
                </button>
              ))}
            </div>

            <div className="inline-flex items-center p-0.5 rounded-xl bg-slate-900/8 border border-white/70">
              {[
                { spp: 32 as const, lbl: "32 SPP (Hızlı)" },
                { spp: 64 as const, lbl: "64 SPP (Stüdyo GI)" },
              ].map((sp) => (
                <button
                  key={sp.spp}
                  type="button"
                  onClick={() => setPtSamples(sp.spp)}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-mono font-bold transition cursor-pointer ${
                    ptSamples === sp.spp
                      ? "bg-[#141413] text-white"
                      : "text-slate-700 hover:text-slate-950"
                  }`}
                >
                  {sp.lbl}
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            {activeEngineRunning !== null ? (
              <button
                type="button"
                onClick={() => {
                  cancelFlagRef.current = true;
                }}
                className="px-3 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-[11px] flex items-center gap-1.5 cursor-pointer"
              >
                <span>Durdur (%{progressPct})</span>
              </button>
            ) : (
              <>
                <button
                  type="button"
                  data-testid="studio-render-run-both-btn"
                  onClick={() => void runComparisonRender("both")}
                  className="px-3 py-1.5 rounded-xl birim-ice-charcoal-pill font-bold text-[11px] flex items-center gap-1.5 cursor-pointer"
                >
                  <RefreshCw className="w-3.5 h-3.5 text-amber-300" />
                  <span>Aynı Sahnede Karşılaştırmalı Render Al</span>
                </button>
                <button
                  type="button"
                  onClick={() => void runComparisonRender("pathtrace")}
                  className="px-2.5 py-1.5 rounded-xl birim-ice-btn font-bold text-[11px] flex items-center gap-1 cursor-pointer"
                >
                  <Sparkles className="w-3.5 h-3.5 text-amber-700" />
                  <span>Yalnız Cycles Render</span>
                </button>
              </>
            )}
          </div>
        </div>

        {/* Comparison Viewport */}
        <div className="flex-1 min-h-0 p-4 overflow-y-auto space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="inline-flex items-center p-1 rounded-2xl birim-ice-pill gap-1 text-xs">
              {[
                { id: "compare" as const, lbl: "Yan Yana Perde Karşılaştırma (A/B)" },
                { id: "pathtrace" as const, lbl: `${renderEngineLabel} (${completedSpp || ptSamples} SPP)` },
                { id: "raster" as const, lbl: "Hızlı 2K Ön İzleme (16 SPP)" },
              ].map((vt) => (
                <button
                  key={vt.id}
                  type="button"
                  onClick={() => setViewTab(vt.id)}
                  className={`px-3 py-1.5 rounded-xl text-[11px] font-bold transition cursor-pointer flex items-center gap-1.5 ${
                    viewTab === vt.id
                      ? "birim-ice-charcoal-pill"
                      : "text-slate-700 hover:bg-white/60"
                  }`}
                >
                  {vt.id === "compare" && <SplitSquareHorizontal className="w-3.5 h-3.5" />}
                  {vt.id === "pathtrace" && <Sparkles className="w-3.5 h-3.5" />}
                  {vt.id === "raster" && <Camera className="w-3.5 h-3.5" />}
                  <span>{vt.lbl}</span>
                </button>
              ))}
            </div>

            <div className="flex items-center gap-2 text-[11px] font-mono">
              {rasterMs !== null && (
                <span className="px-2.5 py-1 rounded-xl bg-white/65 border border-white/80 text-slate-800">
                  Mevcut 2K PBR: <b>{(rasterMs / 1000).toFixed(2)} sn</b>
                </span>
              )}
              {pathTraceMs !== null && (
                <span className="px-2.5 py-1 rounded-xl bg-emerald-950/90 text-emerald-200 border border-emerald-400/30">
                  Path-Tracing ({completedSpp} SPP): <b>{(pathTraceMs / 1000).toFixed(2)} sn</b>
                </span>
              )}
            </div>
          </div>

          <div className="relative w-full aspect-[16/10] max-h-[56vh] mx-auto rounded-2xl overflow-hidden bg-[#1e1e1d] border border-white/75 shadow-xl select-none">
            {viewTab === "compare" && rasterUrl && pathTraceUrl ? (
              <>
                {/* Right full image: Path-Tracing GI */}
                <img
                  src={pathTraceUrl}
                  alt="GPU Path-Tracing Render"
                  className="absolute inset-0 w-full h-full object-contain"
                  draggable={false}
                />
                {/* Left clipped image: Current 2K PBR */}
                <div
                  style={{ clipPath: `inset(0 ${100 - wipePct}% 0 0)` }}
                  className="absolute inset-0 w-full h-full"
                >
                  <img
                    src={rasterUrl}
                    alt="Mevcut 2K Multi-Sample PBR"
                    className="w-full h-full object-contain"
                    draggable={false}
                  />
                </div>
                {/* Interactive Wipe Handle */}
                <div
                  style={{ left: `${wipePct}%` }}
                  className="absolute top-0 bottom-0 w-0.5 bg-white shadow-[0_0_12px_rgba(0,0,0,0.65)] pointer-events-none"
                >
                  <div className="absolute top-1/2 -translate-x-1/2 -translate-y-1/2 px-2.5 py-1 rounded-full bg-[#141413]/90 text-white border border-white/50 text-[10px] font-bold whitespace-nowrap shadow-lg">
                    ◀ 2K PBR | Path-Trace ▶
                  </div>
                </div>
                <input
                  type="range"
                  min={2}
                  max={98}
                  value={wipePct}
                  onChange={(e) => setWipePct(Number(e.target.value))}
                  aria-label="Render Karşılaştırma Perdesi"
                  className="absolute inset-0 w-full h-full opacity-0 cursor-ew-resize"
                />
                <div className="absolute top-3 left-3 px-2.5 py-1 rounded-lg bg-black/65 text-white text-[10px] font-bold backdrop-blur-md pointer-events-none">
                  SOL: Mevcut 2K PBR {rasterMs !== null ? `(${(rasterMs / 1000).toFixed(2)} sn)` : ""}
                </div>
                <div className="absolute top-3 right-3 px-2.5 py-1 rounded-lg bg-emerald-950/80 text-emerald-200 border border-emerald-400/30 text-[10px] font-bold backdrop-blur-md pointer-events-none">
                  SAĞ: Path-Tracing GI {pathTraceMs !== null ? `(${(pathTraceMs / 1000).toFixed(2)} sn • ${completedSpp} SPP)` : ""}
                </div>
              </>
            ) : viewTab === "raster" && rasterUrl ? (
              <img
                src={rasterUrl}
                alt="Mevcut 2K Multi-Sample PBR"
                className="w-full h-full object-contain"
              />
            ) : pathTraceUrl ? (
              <img
                src={pathTraceUrl}
                alt="Path-Tracing GI Render"
                className="w-full h-full object-contain"
              />
            ) : renderError ? (
              <div className="w-full h-full flex flex-col items-center justify-center text-rose-300 gap-2 text-xs px-6 text-center">
                <span className="font-bold text-sm">Blender Cycles Render Hatası</span>
                <span className="text-rose-200/80 max-w-lg">{renderError}</span>
              </div>
            ) : (
              <div className="w-full h-full flex flex-col items-center justify-center text-white/80 gap-2 text-xs">
                <Sparkles className="w-6 h-6 text-amber-300 animate-pulse" />
                <span>Blender Cycles Stüdyo Render Hazırlanıyor (%{progressPct})...</span>
              </div>
            )}

            {activeEngineRunning !== null && (
              <div className="absolute bottom-3 left-4 right-4 p-2 rounded-xl bg-black/70 backdrop-blur-md text-white text-[11px] flex items-center gap-3">
                <span className="font-mono font-bold shrink-0">%{progressPct}</span>
                <div className="flex-1 h-1.5 rounded-full bg-white/20 overflow-hidden">
                  <div
                    style={{ width: `${progressPct}%` }}
                    className="h-full bg-emerald-400 transition-all duration-150"
                  />
                </div>
                <span className="text-[10px] text-slate-300 shrink-0">
                  {activeEngineRunning === "both" && progressPct < 30
                    ? "1/2 Hızlı 2K Ön İzleme..."
                    : `Blender Cycles + OpenImageDenoise Render Alınıyor (${ptSamples} SPP)`}
                </span>
              </div>
            )}
          </div>

          {/* Footer Download & Architectural Assessment Row */}
          <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
            <div className="text-[11px] text-slate-700">
              <b>Mimari Not:</b> Path-Tracing modu çoklu yumuşak alan ışığı penumbrası, dolaylı zemin/tavan ışık sıçraması (GI bounce), füme cam iç raf geçirgenliği ve mikro-pah yansımalarını biriktirir.
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                disabled={!rasterUrl}
                onClick={() => downloadDataUrl(rasterUrl, "2K_PBR")}
                className="px-3 py-1.5 rounded-xl birim-ice-btn disabled:opacity-40 font-bold text-xs flex items-center gap-1.5 cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" />
                <span>2K PBR İndir (.PNG)</span>
              </button>
              <button
                type="button"
                disabled={!pathTraceUrl}
                onClick={() => downloadDataUrl(pathTraceUrl, `PathTraced_${completedSpp || ptSamples}SPP`)}
                className="px-3.5 py-1.5 rounded-xl birim-ice-charcoal-pill disabled:opacity-40 font-bold text-xs flex items-center gap-1.5 cursor-pointer"
              >
                <Download className="w-3.5 h-3.5 text-emerald-300" />
                <span>Path-Tracing Render İndir (.PNG)</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
