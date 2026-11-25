"use client";

import React, { useState, useCallback, useEffect, useMemo } from "react";
import { BirimLogo } from "../../design-system";
import { startZeroLagModalDrag } from "../../design-system/zeroLagDrag";
import { checkBlenderRenderStatus, type BlenderEngineStatus } from "../../engine/blenderRenderClient";
import {
  Camera,
  Sparkles,
  Download,
  SplitSquareHorizontal,
  RefreshCw,
  X,
  Gauge,
  Monitor,
  Sun,
  Contrast,
  SlidersHorizontal,
  RotateCcw,
  Layers,
  Image as ImageIcon,
  Compass,
  Square,
  RectangleHorizontal,
  RectangleVertical,
  Flame,
  Wand2,
  Check,
} from "lucide-react";

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
    onProgress?: (pct: number, previewDataUrl?: string) => void;
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

type ResolutionKey = "hd" | "fhd" | "2k" | "4k";
type AspectKey = "16:9" | "16:10" | "4:3" | "1:1" | "9:16";
type OutputFormat = "png" | "jpeg" | "webp";
type ColorPresetKey = "natural" | "warm_3000k" | "editorial" | "crisp";

const RESOLUTION_BASES: Record<ResolutionKey, { label: string; short: string; longEdge: number }> = {
  hd: { label: "HD", short: "720p", longEdge: 1280 },
  fhd: { label: "Full HD", short: "1080p", longEdge: 1920 },
  "2k": { label: "2K QHD", short: "2K", longEdge: 2560 },
  "4k": { label: "4K UHD", short: "4K", longEdge: 3840 },
};

const ASPECT_RATIOS: Record<AspectKey, { label: string; w: number; h: number }> = {
  "16:9": { label: "16:9", w: 16, h: 9 },
  "16:10": { label: "16:10", w: 16, h: 10 },
  "4:3": { label: "4:3", w: 4, h: 3 },
  "1:1": { label: "1:1", w: 1, h: 1 },
  "9:16": { label: "9:16", w: 9, h: 16 },
};

function computeDimensions(res: ResolutionKey, aspect: AspectKey): { width: number; height: number } {
  const longEdge = RESOLUTION_BASES[res].longEdge;
  const ar = ASPECT_RATIOS[aspect];
  if (ar.w >= ar.h) {
    const width = longEdge;
    const height = Math.round((longEdge * ar.h) / ar.w / 2) * 2;
    return { width, height };
  }
  const height = longEdge;
  const width = Math.round((longEdge * ar.w) / ar.h / 2) * 2;
  return { width, height };
}

export const StudioRenderModal: React.FC<StudioRenderModalProps> = ({
  isOpen,
  projectId,
  projectTitle,
  onClose,
}) => {
  const [cameraAngle, setCameraAngle] = useState<"current" | "iso" | "front">("current");
  const [resolution, setResolution] = useState<ResolutionKey>("fhd");
  const [aspectRatio, setAspectRatio] = useState<AspectKey>("16:9");
  const [ptSamples, setPtSamples] = useState<16 | 32 | 64 | 128>(64);
  const [giBounces, setGiBounces] = useState<3 | 5 | 8>(5);
  const [outputFormat, setOutputFormat] = useState<OutputFormat>("png");
  const [includeWatermark, setIncludeWatermark] = useState<boolean>(true);

  // Live Post-Processing Controls (applied live on preview & baked on export!)
  const [colorPreset, setColorPreset] = useState<ColorPresetKey>("natural");
  const [exposure, setExposure] = useState<number>(1.0);
  const [contrast, setContrast] = useState<number>(1.02);
  const [saturation, setSaturation] = useState<number>(1.04);
  const [warmth, setWarmth] = useState<number>(0);

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
  const autoStartedSessionRef = React.useRef<boolean>(false);
  const isRunningGuardRef = React.useRef<boolean>(false);

  const { width: targetW, height: targetH } = useMemo(
    () => computeDimensions(resolution, aspectRatio),
    [resolution, aspectRatio]
  );

  const liveCssFilter = useMemo(
    () =>
      `brightness(${exposure.toFixed(2)}) contrast(${contrast.toFixed(2)}) saturate(${saturation.toFixed(2)})${
        warmth > 0 ? ` sepia(${(warmth / 100).toFixed(2)})` : ""
      }`,
    [exposure, contrast, saturation, warmth]
  );

  const applyColorPreset = (preset: ColorPresetKey) => {
    setColorPreset(preset);
    if (preset === "natural") {
      setExposure(1.0);
      setContrast(1.02);
      setSaturation(1.04);
      setWarmth(0);
    } else if (preset === "warm_3000k") {
      setExposure(1.04);
      setContrast(1.06);
      setSaturation(1.08);
      setWarmth(14);
    } else if (preset === "editorial") {
      setExposure(1.02);
      setContrast(1.12);
      setSaturation(0.92);
      setWarmth(6);
    } else if (preset === "crisp") {
      setExposure(1.06);
      setContrast(1.18);
      setSaturation(1.12);
      setWarmth(0);
    }
  };

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
      if (typeof window === "undefined" || isRunningGuardRef.current) return;
      const win = window as unknown as StudioRenderWindow;
      isRunningGuardRef.current = true;
      cancelFlagRef.current = false;
      setRenderError(null);
      setActiveEngineRunning(mode);
      setProgressPct(2);
      refreshLiveMetrics();

      const setMonotonicPct = (nextVal: number) => {
        setProgressPct((prev) => Math.min(99, Math.max(prev, Math.round(nextVal))));
      };

      try {
        let localRasterUrl = rasterUrl;
        if (mode === "raster" || mode === "both") {
          if (typeof win.__birimRenderUltraStudioPhoto === "function") {
            const t0 = performance.now();
            const rUrl = await win.__birimRenderUltraStudioPhoto({
              angle: cameraAngle,
              width: targetW,
              height: targetH,
              onProgress: (p, preview) => {
                setMonotonicPct(mode === "both" ? Math.round(p * 0.3) : p);
                if (preview) {
                  setRasterUrl(preview);
                  if (mode === "raster") setViewTab("raster");
                }
              },
            });
            const dt = Math.round(performance.now() - t0);
            if (rUrl) {
              localRasterUrl = rUrl;
              setRasterUrl(rUrl);
              setRasterMs(dt);
            }
            if (mode === "raster") setViewTab("raster");
          }
        }

        if ((mode === "pathtrace" || mode === "both") && !cancelFlagRef.current) {
          const status = blenderStatus ?? (await checkBlenderRenderStatus());
          setBlenderStatus(status);

          if (!status.available) {
            if (mode === "pathtrace" && typeof win.__birimRenderUltraStudioPhoto === "function") {
              setRenderEngineLabel("Softbox Stüdyo Motoru (16x SSAA)");
              const t0 = performance.now();
              const fallbackUrl = await win.__birimRenderUltraStudioPhoto({
                angle: cameraAngle,
                width: targetW,
                height: targetH,
                onProgress: (p, preview) => {
                  setMonotonicPct(8 + Math.round(p * 0.9));
                  setCompletedSpp(Math.max(1, Math.round((p / 100) * 16)));
                  if (preview) {
                    setPathTraceUrl(preview);
                    setViewTab("pathtrace");
                  }
                },
              });
              const dt = Math.round(performance.now() - t0);
              if (fallbackUrl) {
                setRasterUrl(fallbackUrl);
                setRasterMs(dt);
                setPathTraceUrl(fallbackUrl);
                setPathTraceMs(dt);
                setCompletedSpp(16);
                setViewTab("pathtrace");
              } else {
                setRenderError(
                  status.hint ||
                    "Blender 4.2+ bulunamadı. Gerçek Cycles Ray-Tracing için Blender kurup BLENDER_PATH tanımlayabilirsiniz."
                );
              }
            } else {
              setRenderError(
                status.hint ||
                  "Blender 4.2+ bulunamadı. Softbox Stüdyo Render sekmesini kullanabilirsiniz."
              );
              if (localRasterUrl) setViewTab("raster");
            }
          } else if (typeof win.__birimRenderPathTracedPhoto === "function") {
            const res = await win.__birimRenderPathTracedPhoto({
              angle: cameraAngle,
              width: targetW,
              height: targetH,
              samples: ptSamples,
              bounces: giBounces,
              shouldCancel: () => cancelFlagRef.current,
              onProgress: (pct, preview) => {
                const mappedPct = mode === "both" ? 30 + Math.round(pct * 0.7) : pct;
                setMonotonicPct(mappedPct);
                setCompletedSpp((prev) =>
                  Math.max(prev, Math.max(1, Math.round((pct / 100) * ptSamples)))
                );
                if (preview) setPathTraceUrl(preview);
              },
            });
            if (res?.dataUrl) {
              setPathTraceUrl(res.dataUrl);
              setPathTraceMs(Math.round(res.elapsedMs));
              setCompletedSpp(res.samplesCompleted);
              setSceneMetrics(res.metrics);
              if (res.engine) setRenderEngineLabel(res.engine);
              setViewTab(mode === "both" && localRasterUrl ? "compare" : "pathtrace");
            } else if (res?.error) {
              setRenderError(res.error);
              if (!localRasterUrl && typeof win.__birimRenderUltraStudioPhoto === "function") {
                const t0 = performance.now();
                const fbUrl = await win.__birimRenderUltraStudioPhoto({
                  angle: cameraAngle,
                  width: targetW,
                  height: targetH,
                });
                if (fbUrl) {
                  setRasterUrl(fbUrl);
                  setRasterMs(Math.round(performance.now() - t0));
                  setViewTab("raster");
                }
              }
            }
          }
        }
      } finally {
        isRunningGuardRef.current = false;
        setActiveEngineRunning(null);
        setProgressPct(100);
      }
    },
    [cameraAngle, targetW, targetH, ptSamples, giBounces, refreshLiveMetrics, blenderStatus, rasterUrl]
  );

  // Auto-start ONCE per modal open session
  useEffect(() => {
    if (!isOpen) {
      autoStartedSessionRef.current = false;
      return;
    }
    refreshLiveMetrics();
    if (!autoStartedSessionRef.current) {
      autoStartedSessionRef.current = true;
      void checkBlenderRenderStatus()
        .then((st) => {
          setBlenderStatus(st);
          if (!pathTraceUrl && !isRunningGuardRef.current) {
            void runComparisonRender("pathtrace");
          }
        })
        .catch(() => {
          // Non-fatal: fallback to local WebGL path-tracing preview when status probe fails.
        });
    }
  }, [isOpen, pathTraceUrl, refreshLiveMetrics, runComparisonRender]);

  if (!isOpen) return null;

  const downloadProcessedDataUrl = (url: string, suffix: string) => {
    if (!url) return;
    const ext = outputFormat === "jpeg" ? "jpg" : outputFormat;
    const mime =
      outputFormat === "jpeg"
        ? "image/jpeg"
        : outputFormat === "webp"
        ? "image/webp"
        : "image/png";

    const img = new Image();
    img.onload = () => {
      try {
        const canvas = document.createElement("canvas");
        canvas.width = targetW;
        canvas.height = targetH;
        const ctx = canvas.getContext("2d");
        if (!ctx) throw new Error("no 2d ctx");

        ctx.fillStyle = "#18191c";
        ctx.fillRect(0, 0, targetW, targetH);
        ctx.filter = liveCssFilter;

        // Fit image cleanly preserving aspect ratio
        const scale = Math.min(targetW / img.naturalWidth, targetH / img.naturalHeight);
        const dw = img.naturalWidth * scale;
        const dh = img.naturalHeight * scale;
        const dx = (targetW - dw) / 2;
        const dy = (targetH - dh) / 2;
        ctx.drawImage(img, dx, dy, dw, dh);
        ctx.filter = "none";

        if (includeWatermark) {
          const pad = Math.round(targetW * 0.02);
          const barH = Math.max(36, Math.round(targetH * 0.042));
          ctx.fillStyle = "rgba(15, 23, 42, 0.72)";
          ctx.fillRect(0, targetH - barH, targetW, barH);
          ctx.fillStyle = "#F8FAFC";
          ctx.font = `700 ${Math.max(13, Math.round(barH * 0.44))}px system-ui, sans-serif`;
          ctx.textBaseline = "middle";
          ctx.fillText(`BİRİM® STUDIO  •  ${projectTitle}`, pad, targetH - barH / 2);
          ctx.textAlign = "right";
          ctx.font = `600 ${Math.max(11, Math.round(barH * 0.36))}px monospace`;
          ctx.fillStyle = "#CBD5E1";
          ctx.fillText(`${targetW}×${targetH} • ${renderEngineLabel}`, targetW - pad, targetH - barH / 2);
        }

        const outUrl = canvas.toDataURL(mime, outputFormat === "png" ? undefined : 0.94);
        const a = document.createElement("a");
        a.href = outUrl;
        a.download = `Birim_${suffix}_${projectId}_${targetW}x${targetH}.${ext}`;
        document.body.appendChild(a);
        a.click();
        setTimeout(() => {
          if (a.parentNode) a.parentNode.removeChild(a);
        }, 800);
      } catch {
        const a = document.createElement("a");
        a.href = url;
        a.download = `Birim_${suffix}_${projectId}_${targetW}x${targetH}.png`;
        document.body.appendChild(a);
        a.click();
        setTimeout(() => {
          if (a.parentNode) a.parentNode.removeChild(a);
        }, 800);
      }
    };
    img.src = url;
  };

  return (
    <div
      data-testid="studio-independent-render-modal"
      onClick={onClose}
      className="fixed inset-0 z-[160] flex items-center justify-center bg-slate-950/60 backdrop-blur-xs p-0 md:p-5"
    >
      <div
        data-draggable-shell="studio-render-modal"
        onClick={(e) => e.stopPropagation()}
        className="birim-ice-modal rounded-[28px] max-md:rounded-none max-md:h-[100dvh] max-md:max-h-[100dvh] max-w-6xl w-full max-h-[94dvh] flex flex-col overflow-hidden text-[#141413]"
      >
        {/* Header */}
        <div
          onPointerDown={(e) => startZeroLagModalDrag(e)}
          title="Pencereyi taşımak için sürükleyin"
          className="px-3.5 sm:px-5 py-3 birim-ice-shell-header flex flex-nowrap items-center justify-between gap-2.5 cursor-grab active:cursor-grabbing select-none shrink-0"
        >
          <div className="flex flex-1 items-center gap-2.5 min-w-0">
            <BirimLogo className="h-4 sm:h-5 w-auto text-[#141413] shrink-0" />
            <div className="h-4 w-px bg-slate-900/15 shrink-0 hidden sm:block" />
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <h2 className="text-xs sm:text-sm font-extrabold text-[#141413] truncate">
                  Stüdyo Render Merkezi
                </h2>
                {blenderStatus && (
                  <span
                    className={`px-2 py-0.5 rounded-full text-[9.5px] font-mono font-bold shrink-0 ${
                      blenderStatus.available
                        ? "bg-emerald-950/90 text-emerald-200"
                        : "bg-amber-950/85 text-amber-200"
                    }`}
                  >
                    {blenderStatus.available
                      ? `Cycles ${blenderStatus.version ?? "Hazır"}`
                      : "WebGL Stüdyo"}
                  </span>
                )}
              </div>
              <p className="text-[10.5px] sm:text-[11px] text-[#475569] truncate">
                {projectTitle} • {targetW}×{targetH} ({aspectRatio})
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0" onPointerDown={(e) => e.stopPropagation()}>
            <div className="hidden xl:flex items-center gap-2 px-2.5 py-1 rounded-xl bg-white/60 border border-white/75 text-[10px] font-mono text-slate-700">
              <Gauge className="w-3.5 h-3.5 text-slate-600" />
              <span>Draw: <b>{sceneMetrics.drawCalls}</b></span>
              <span>•</span>
              <span>Tri: <b>{(sceneMetrics.triangles / 1000).toFixed(1)}k</b></span>
              <span>•</span>
              <span>Tex: <b>{sceneMetrics.textures}</b></span>
            </div>
            <button
              type="button"
              onClick={() => {
                cancelFlagRef.current = true;
                onClose();
              }}
              aria-label="Kapat"
              className="w-8 h-8 rounded-xl birim-ice-btn flex items-center justify-center text-slate-700 hover:text-slate-950 cursor-pointer shrink-0"
              title="Kapat"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Main 2-Column Responsive Studio Body */}
        <div className="flex-1 min-h-0 flex flex-col lg:flex-row overflow-y-auto lg:overflow-hidden">
          {/* LEFT: Live Preview Stage & Download Bar */}
          <div className="flex-1 min-w-0 flex flex-col p-3.5 sm:p-4 gap-3 lg:overflow-y-auto">
            {/* Top View Switcher + Timing Pills */}
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="inline-flex items-center p-1 rounded-2xl bg-black/15 border border-white/15 shadow-inner gap-1 text-xs">
                {[
                  { id: "pathtrace" as const, lbl: "Stüdyo GI", icon: Sparkles },
                  { id: "raster" as const, lbl: "Hızlı PBR", icon: Camera },
                  { id: "compare" as const, lbl: "A/B Perde", icon: SplitSquareHorizontal },
                ].map((vt) => {
                  const Icon = vt.icon;
                  const active = viewTab === vt.id;
                  return (
                    <button
                      key={vt.id}
                      type="button"
                      onClick={() => setViewTab(vt.id)}
                      className={`px-2.5 sm:px-3 py-1.5 rounded-xl text-[11px] font-bold transition cursor-pointer inline-flex items-center gap-1.5 ${
                        active
                          ? "bg-gradient-to-r from-[#0284C7] to-[#2563EB] text-white shadow-[0_4px_14px_rgba(37,99,235,0.45)]"
                          : "text-slate-400 hover:text-white"
                      }`}
                    >
                      <Icon className="w-3.5 h-3.5" />
                      <span>{vt.lbl}</span>
                    </button>
                  );
                })}
              </div>

              <div className="flex flex-wrap items-center gap-1.5 text-[10.5px] font-mono">
                <span className="px-2 py-1 rounded-xl bg-black/15 border border-white/15 text-slate-300">
                  {targetW}×{targetH} • {outputFormat.toUpperCase()}
                </span>
                {pathTraceMs !== null && (
                  <span className="px-2 py-1 rounded-xl bg-emerald-950/90 text-emerald-200 border border-emerald-400/30">
                    {(pathTraceMs / 1000).toFixed(2)} sn • {completedSpp || ptSamples} SPP
                  </span>
                )}
              </div>
            </div>

            {/* Preview Viewport */}
            <div
              style={{
                aspectRatio: `${ASPECT_RATIOS[aspectRatio].w} / ${ASPECT_RATIOS[aspectRatio].h}`,
              }}
              className="relative w-full max-h-[54dvh] mx-auto rounded-2xl overflow-hidden bg-[#18191c] border border-white/20 shadow-2xl select-none flex items-center justify-center"
            >
              {viewTab === "compare" && rasterUrl && pathTraceUrl ? (
                <>
                  <img
                    src={pathTraceUrl}
                    alt="Stüdyo GI Render"
                    style={{ filter: liveCssFilter }}
                    className="absolute inset-0 w-full h-full object-contain"
                    draggable={false}
                  />
                  <div
                    style={{ clipPath: `inset(0 ${100 - wipePct}% 0 0)` }}
                    className="absolute inset-0 w-full h-full"
                  >
                    <img
                      src={rasterUrl}
                      alt="Hızlı PBR"
                      style={{ filter: liveCssFilter }}
                      className="w-full h-full object-contain"
                      draggable={false}
                    />
                  </div>
                  <div
                    style={{ left: `${wipePct}%` }}
                    className="absolute top-0 bottom-0 w-0.5 bg-white shadow-[0_0_12px_rgba(0,0,0,0.65)] pointer-events-none"
                  >
                    <div className="absolute top-1/2 -translate-x-1/2 -translate-y-1/2 px-2.5 py-1 rounded-full bg-[#141413]/90 text-white border border-white/50 text-[10px] font-bold whitespace-nowrap shadow-lg">
                      ◀ PBR | GI ▶
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
                  <div className="absolute top-3 left-3 px-2 py-0.5 rounded-lg bg-black/65 text-white text-[10px] font-bold backdrop-blur-md pointer-events-none">
                    SOL: PBR {rasterMs !== null ? `(${(rasterMs / 1000).toFixed(1)}s)` : ""}
                  </div>
                  <div className="absolute top-3 right-3 px-2 py-0.5 rounded-lg bg-emerald-950/80 text-emerald-200 border border-emerald-400/30 text-[10px] font-bold backdrop-blur-md pointer-events-none">
                    SAĞ: GI ({completedSpp} SPP)
                  </div>
                </>
              ) : viewTab === "raster" && rasterUrl ? (
                <img
                  src={rasterUrl}
                  alt="Hızlı PBR Render"
                  style={{
                    filter: activeEngineRunning !== null && progressPct < 96
                      ? `${liveCssFilter} blur(${Math.max(0, ((100 - progressPct) / 100) * 1.4).toFixed(2)}px)`
                      : liveCssFilter,
                  }}
                  className="w-full h-full object-contain transition-[filter] duration-200"
                />
              ) : pathTraceUrl ? (
                <img
                  src={pathTraceUrl}
                  alt="Stüdyo GI Render"
                  style={{
                    filter: activeEngineRunning !== null && progressPct < 96
                      ? `${liveCssFilter} blur(${Math.max(0, ((100 - progressPct) / 100) * 1.4).toFixed(2)}px)`
                      : liveCssFilter,
                  }}
                  className="w-full h-full object-contain transition-[filter] duration-200"
                />
              ) : renderError ? (
                <div className="w-full h-full flex flex-col items-center justify-center text-rose-300 gap-2 text-xs px-6 text-center">
                  <span className="font-bold text-sm">Render Motoru Bildirimi</span>
                  <span className="text-rose-200/80 max-w-lg">{renderError}</span>
                </div>
              ) : (
                <div className="w-full h-full flex flex-col items-center justify-center text-white/80 gap-2 text-xs">
                  <Sparkles className="w-6 h-6 text-amber-300 animate-pulse" />
                  <span>Stüdyo Render Hazırlanıyor (%{progressPct})...</span>
                </div>
              )}

              {/* Live Watermark Preview */}
              {includeWatermark && (pathTraceUrl || rasterUrl) && (
                <div className="absolute inset-x-0 bottom-0 px-3 py-1.5 bg-slate-950/70 backdrop-blur-xs flex items-center justify-between text-[10px] text-white/90 pointer-events-none">
                  <span className="font-bold tracking-wider truncate">BİRİM® STUDIO • {projectTitle}</span>
                  <span className="font-mono text-slate-300 shrink-0 ml-2">{targetW}×{targetH}</span>
                </div>
              )}

              {activeEngineRunning !== null && (
                <div className="absolute bottom-8 left-3 right-3 p-2 rounded-xl bg-black/75 backdrop-blur-md text-white text-[11px] flex items-center gap-3">
                  <span className="font-mono font-bold shrink-0">%{progressPct}</span>
                  <div className="flex-1 h-1.5 rounded-full bg-white/20 overflow-hidden">
                    <div
                      style={{ width: `${progressPct}%` }}
                      className="h-full bg-sky-400 transition-all duration-150"
                    />
                  </div>
                  <span className="text-[10px] text-slate-300 shrink-0 hidden sm:inline">
                    {targetW}×{targetH} • {ptSamples} SPP
                  </span>
                </div>
              )}
            </div>

            {/* Bottom Quick Export Bar */}
            <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
              <div className="text-[11px] text-slate-400 flex items-center gap-1.5">
                <ImageIcon className="w-3.5 h-3.5 text-sky-400 shrink-0" />
                <span>Pozlama, renk ve filigran ayarları indirilen görsele birebir işlenir.</span>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  disabled={!rasterUrl}
                  onClick={() => downloadProcessedDataUrl(rasterUrl, "PBR")}
                  className="px-3 py-1.5 rounded-xl birim-ice-btn disabled:opacity-40 font-bold text-xs inline-flex items-center gap-1.5 cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>PBR İndir (.{outputFormat.toUpperCase()})</span>
                </button>
                <button
                  type="button"
                  disabled={!pathTraceUrl}
                  onClick={() => downloadProcessedDataUrl(pathTraceUrl, `Studio_${completedSpp || ptSamples}SPP`)}
                  className="px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-[#0284C7] to-[#2563EB] hover:opacity-95 text-white shadow-[0_4px_14px_rgba(37,99,235,0.45)] disabled:opacity-40 font-bold text-xs inline-flex items-center gap-1.5 cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Stüdyo Render İndir (.{outputFormat.toUpperCase()})</span>
                </button>
              </div>
            </div>
          </div>

          {/* RIGHT: Icon-Rich Studio Settings Inspector Sidebar */}
          <aside className="w-full lg:w-[330px] shrink-0 border-t lg:border-t-0 lg:border-l border-white/15 bg-black/15 flex flex-col min-h-0">
            <div className="flex-1 overflow-y-auto p-3.5 space-y-4 text-xs">
              {/* 1. Resolution Selector */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-[11px] uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
                    <Monitor className="w-3.5 h-3.5 text-sky-400" />
                    <span>Çözünürlük</span>
                  </span>
                  <span className="font-mono text-[10.5px] text-sky-300 font-bold">
                    {targetW} × {targetH} px
                  </span>
                </div>
                <div className="grid grid-cols-4 gap-1.5">
                  {(["hd", "fhd", "2k", "4k"] as ResolutionKey[]).map((rk) => {
                    const active = resolution === rk;
                    const info = RESOLUTION_BASES[rk];
                    return (
                      <button
                        key={rk}
                        type="button"
                        onClick={() => setResolution(rk)}
                        className={`py-2 px-1 rounded-xl border text-center transition cursor-pointer ${
                          active
                            ? "bg-gradient-to-b from-[#0284C7] to-[#2563EB] border-sky-400/60 text-white shadow-[0_4px_12px_rgba(37,99,235,0.45)]"
                            : "bg-white/[0.05] border-white/12 text-slate-300 hover:bg-white/[0.10]"
                        }`}
                      >
                        <div className="font-extrabold text-[11px] leading-tight">{info.short}</div>
                        <div className="text-[9px] opacity-80 font-mono mt-0.5">{info.label}</div>
                      </button>
                    );
                  })}
                </div>

                {/* Aspect Ratio Pills */}
                <div className="grid grid-cols-5 gap-1 pt-0.5">
                  {(["16:9", "16:10", "4:3", "1:1", "9:16"] as AspectKey[]).map((ar) => {
                    const active = aspectRatio === ar;
                    return (
                      <button
                        key={ar}
                        type="button"
                        onClick={() => setAspectRatio(ar)}
                        className={`py-1.5 rounded-xl border text-[10px] font-mono font-bold flex flex-col items-center justify-center gap-0.5 transition cursor-pointer ${
                          active
                            ? "bg-white/20 border-sky-400/60 text-white"
                            : "bg-white/[0.04] border-white/10 text-slate-400 hover:text-white"
                        }`}
                      >
                        {ar === "1:1" ? (
                          <Square className="w-3 h-3" />
                        ) : ar === "9:16" ? (
                          <RectangleVertical className="w-3 h-3" />
                        ) : (
                          <RectangleHorizontal className="w-3 h-3" />
                        )}
                        <span>{ar}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* 2. Camera Angle */}
              <div className="space-y-2 pt-3 border-t border-white/10">
                <span className="font-bold text-[11px] uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
                  <Compass className="w-3.5 h-3.5 text-amber-400" />
                  <span>Kamera Kadrajı</span>
                </span>
                <div className="grid grid-cols-3 gap-1.5">
                  {[
                    { id: "current" as const, lbl: "Aktif Açı", icon: Camera },
                    { id: "iso" as const, lbl: "3/4 Stüdyo", icon: Layers },
                    { id: "front" as const, lbl: "Tam Cephe", icon: Square },
                  ].map((ang) => {
                    const Icon = ang.icon;
                    const active = cameraAngle === ang.id;
                    return (
                      <button
                        key={ang.id}
                        type="button"
                        onClick={() => setCameraAngle(ang.id)}
                        className={`py-2 px-1.5 rounded-xl border flex flex-col items-center gap-1 text-[10.5px] font-bold transition cursor-pointer ${
                          active
                            ? "bg-gradient-to-b from-[#0284C7] to-[#2563EB] border-sky-400/60 text-white shadow-[0_4px_12px_rgba(37,99,235,0.4)]"
                            : "bg-white/[0.05] border-white/12 text-slate-300 hover:bg-white/[0.10]"
                        }`}
                      >
                        <Icon className="w-3.5 h-3.5" />
                        <span>{ang.lbl}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* 3. Quality (SPP) & GI Bounces */}
              <div className="space-y-2 pt-3 border-t border-white/10">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-[11px] uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Örnekleme (SPP) &amp; GI</span>
                  </span>
                  <span className="font-mono text-[10px] text-slate-400">{giBounces} Sıçrama</span>
                </div>
                <div className="grid grid-cols-4 gap-1.5">
                  {([16, 32, 64, 128] as const).map((spp) => (
                    <button
                      key={spp}
                      type="button"
                      onClick={() => setPtSamples(spp)}
                      className={`py-1.5 rounded-xl border font-mono text-[11px] font-bold transition cursor-pointer ${
                        ptSamples === spp
                          ? "bg-emerald-600 border-emerald-400/60 text-white shadow-[0_4px_12px_rgba(16,185,129,0.38)]"
                          : "bg-white/[0.05] border-white/12 text-slate-300 hover:bg-white/[0.10]"
                      }`}
                    >
                      {spp}
                    </button>
                  ))}
                </div>
                <div className="grid grid-cols-3 gap-1.5">
                  {([
                    { b: 3 as const, lbl: "3 GI (Hızlı)" },
                    { b: 5 as const, lbl: "5 GI (Stüdyo)" },
                    { b: 8 as const, lbl: "8 GI (Ultra)" },
                  ]).map((item) => (
                    <button
                      key={item.b}
                      type="button"
                      onClick={() => setGiBounces(item.b)}
                      className={`py-1 rounded-lg border text-[10px] font-bold transition cursor-pointer ${
                        giBounces === item.b
                          ? "bg-white/20 border-white/40 text-white"
                          : "bg-white/[0.04] border-white/10 text-slate-400 hover:text-white"
                      }`}
                    >
                      {item.lbl}
                    </button>
                  ))}
                </div>
              </div>

              {/* 4. Color Mood & Live Post-Processing Sliders */}
              <div className="space-y-2.5 pt-3 border-t border-white/10">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-[11px] uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
                    <SlidersHorizontal className="w-3.5 h-3.5 text-violet-400" />
                    <span>Işık &amp; Renk Tonlama</span>
                  </span>
                  <button
                    type="button"
                    onClick={() => applyColorPreset("natural")}
                    className="text-[10px] text-slate-400 hover:text-white inline-flex items-center gap-1 cursor-pointer"
                    title="Varsayılana Sıfırla"
                  >
                    <RotateCcw className="w-3 h-3" />
                    <span>Sıfırla</span>
                  </button>
                </div>

                <div className="grid grid-cols-4 gap-1">
                  {[
                    { id: "natural" as const, lbl: "Doğal", icon: Sun },
                    { id: "warm_3000k" as const, lbl: "3000K", icon: Flame },
                    { id: "editorial" as const, lbl: "Dergi", icon: Wand2 },
                    { id: "crisp" as const, lbl: "Keskin", icon: Contrast },
                  ].map((cp) => {
                    const Icon = cp.icon;
                    const active = colorPreset === cp.id;
                    return (
                      <button
                        key={cp.id}
                        type="button"
                        onClick={() => applyColorPreset(cp.id)}
                        className={`py-1.5 rounded-xl border flex flex-col items-center gap-0.5 text-[10px] font-bold transition cursor-pointer ${
                          active
                            ? "bg-white/20 border-sky-400/60 text-white"
                            : "bg-white/[0.04] border-white/10 text-slate-400 hover:text-white"
                        }`}
                      >
                        <Icon className="w-3 h-3" />
                        <span>{cp.lbl}</span>
                      </button>
                    );
                  })}
                </div>

                <div className="space-y-2 pt-0.5">
                  <label className="block space-y-1">
                    <div className="flex justify-between text-[10.5px] text-slate-300">
                      <span className="inline-flex items-center gap-1"><Sun className="w-3 h-3 text-amber-400" /> Pozlama</span>
                      <span className="font-mono font-bold">{Math.round(exposure * 100)}%</span>
                    </div>
                    <input
                      type="range"
                      min={0.75}
                      max={1.35}
                      step={0.02}
                      value={exposure}
                      onChange={(e) => setExposure(Number(e.target.value))}
                      className="w-full accent-sky-500 cursor-pointer"
                    />
                  </label>
                  <label className="block space-y-1">
                    <div className="flex justify-between text-[10.5px] text-slate-300">
                      <span className="inline-flex items-center gap-1"><Contrast className="w-3 h-3 text-sky-400" /> Kontrast</span>
                      <span className="font-mono font-bold">{Math.round(contrast * 100)}%</span>
                    </div>
                    <input
                      type="range"
                      min={0.8}
                      max={1.3}
                      step={0.02}
                      value={contrast}
                      onChange={(e) => setContrast(Number(e.target.value))}
                      className="w-full accent-sky-500 cursor-pointer"
                    />
                  </label>
                  <label className="block space-y-1">
                    <div className="flex justify-between text-[10.5px] text-slate-300">
                      <span className="inline-flex items-center gap-1"><Flame className="w-3 h-3 text-orange-400" /> Sıcaklık</span>
                      <span className="font-mono font-bold">+{warmth}%</span>
                    </div>
                    <input
                      type="range"
                      min={0}
                      max={35}
                      step={1}
                      value={warmth}
                      onChange={(e) => setWarmth(Number(e.target.value))}
                      className="w-full accent-amber-500 cursor-pointer"
                    />
                  </label>
                </div>
              </div>

              {/* 5. Output Format & Watermark */}
              <div className="space-y-2 pt-3 border-t border-white/10">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-bold text-[11px] uppercase tracking-wider text-slate-300">
                    Dosya Formatı
                  </span>
                  <div className="inline-flex items-center p-0.5 rounded-xl bg-white/[0.06] border border-white/12 gap-0.5">
                    {(["png", "jpeg", "webp"] as OutputFormat[]).map((fmt) => (
                      <button
                        key={fmt}
                        type="button"
                        onClick={() => setOutputFormat(fmt)}
                        className={`px-2 py-0.5 rounded-lg text-[10px] font-mono font-bold uppercase transition cursor-pointer ${
                          outputFormat === fmt
                            ? "bg-sky-600 text-white"
                            : "text-slate-400 hover:text-white"
                        }`}
                      >
                        {fmt === "jpeg" ? "JPG" : fmt}
                      </button>
                    ))}
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setIncludeWatermark((v) => !v)}
                  className={`w-full px-3 py-2 rounded-xl border flex items-center justify-between text-[11px] font-bold transition cursor-pointer ${
                    includeWatermark
                      ? "bg-emerald-500/15 border-emerald-400/40 text-emerald-200"
                      : "bg-white/[0.04] border-white/10 text-slate-400"
                  }`}
                >
                  <span>BİRİM® Stüdyo Filigran Bandı</span>
                  <span className={`w-4 h-4 rounded-md flex items-center justify-center ${includeWatermark ? "bg-emerald-500 text-white" : "bg-white/10"}`}>
                    {includeWatermark && <Check className="w-3 h-3" />}
                  </span>
                </button>
              </div>
            </div>

            {/* Pinned Render Trigger Footer */}
            <div className="p-3 border-t border-white/15 bg-black/20 flex items-center gap-2 shrink-0">
              {activeEngineRunning !== null ? (
                <button
                  type="button"
                  onClick={() => {
                    cancelFlagRef.current = true;
                  }}
                  className="w-full py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs flex items-center justify-center gap-2 cursor-pointer"
                >
                  <span>Render İşlemini Durdur (%{progressPct})</span>
                </button>
              ) : (
                <>
                  <button
                    type="button"
                    data-testid="studio-render-run-both-btn"
                    onClick={() => void runComparisonRender("both")}
                    className="flex-1 py-2.5 px-3 rounded-xl bg-gradient-to-r from-[#0284C7] to-[#2563EB] hover:opacity-95 text-white shadow-[0_4px_14px_rgba(37,99,235,0.45)] font-bold text-xs inline-flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    <span>Render Al</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => void runComparisonRender("pathtrace")}
                    className="py-2.5 px-3 rounded-xl bg-white/[0.08] hover:bg-white/[0.15] border border-white/15 text-white font-bold text-xs inline-flex items-center justify-center gap-1.5 cursor-pointer"
                    title="Yalnızca Stüdyo GI / Cycles Render"
                  >
                    <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                    <span>Cycles</span>
                  </button>
                </>
              )}
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
};
