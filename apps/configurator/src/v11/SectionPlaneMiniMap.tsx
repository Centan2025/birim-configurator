"use client";

import React, { useRef, useCallback, useMemo } from "react";
import { calculateBayWidths, type ModuleInstance } from "@birim/core";

export interface SectionPlaneMiniMapProps {
  activeModule: ModuleInstance;
  /** "X" = Dikey Yan Kesit (A-A, soldan sağa X koordinatında keser); "Z" = Yatay/Boyuna Kesit (B-B, arkadan öne Z koordinatında keser) */
  axis: "X" | "Z";
  ratio: number;
  onChangeAxis: (axis: "X" | "Z") => void;
  onChangeRatio: (ratio: number) => void;
  onClose?: () => void;
  compact?: boolean;
}

/**
 * Etkileşimli Görsel Üst Plan Kesit Yöneticisi (SectionPlaneMiniMap).
 * Sadece düz bir kaydırma çubuğu yerine dolabın üstten ölçekli planını (yan dikmeler, ara bölmeler,
 * çekmece/raf izdüşümü, arkalık kanalı ve ön kapaklar) çizer; kullanıcı A-A veya B-B kesit düzlemini
 * doğrudan mini plan üzerinde tıklayarak ya da sürükleyerek konumlandırır.
 */
export const SectionPlaneMiniMap: React.FC<SectionPlaneMiniMapProps> = React.memo(
  ({
    activeModule,
    axis,
    ratio,
    onChangeAxis,
    onChangeRatio,
    onClose,
    compact = false,
  }) => {
    const svgRef = useRef<SVGSVGElement | null>(null);

    const wMm = Math.max(300, activeModule.dimensions.width);
    const dMm = Math.max(250, activeModule.dimensions.depth);
    const panelT = activeModule.carcass.panelThickness || 18;
    const bayWidths = useMemo(() => calculateBayWidths(activeModule), [activeModule]);

    const clampedRatio = Math.min(0.96, Math.max(0.04, ratio));
    const cutMm = Math.round((axis === "X" ? wMm : dMm) * clampedRatio);

    // SVG ViewBox Geometry
    const vbW = 280;
    const vbH = 128;
    const padX = 28;
    const padY = 22;
    const drawW = vbW - padX * 2;
    const drawH = vbH - padY * 2;

    const updateFromPointer = useCallback(
      (clientX: number, clientY: number) => {
        const svg = svgRef.current;
        if (!svg) return;
        const rect = svg.getBoundingClientRect();
        if (rect.width <= 0 || rect.height <= 0) return;

        const normSvgX = ((clientX - rect.left) / rect.width) * vbW;
        const normSvgY = ((clientY - rect.top) / rect.height) * vbH;

        if (axis === "X") {
          const next = (normSvgX - padX) / drawW;
          onChangeRatio(Number(Math.min(0.96, Math.max(0.04, next)).toFixed(3)));
        } else {
          const next = (normSvgY - padY) / drawH;
          onChangeRatio(Number(Math.min(0.96, Math.max(0.04, next)).toFixed(3)));
        }
      },
      [axis, drawW, drawH, onChangeRatio]
    );

    const handlePointerDown = (e: React.PointerEvent<SVGSVGElement>) => {
      e.preventDefault();
      const target = e.currentTarget;
      try {
        target.setPointerCapture(e.pointerId);
      } catch {
        // ignore synthetic event
      }
      updateFromPointer(e.clientX, e.clientY);

      const onMove = (ev: PointerEvent) => {
        updateFromPointer(ev.clientX, ev.clientY);
      };
      const onUp = () => {
        window.removeEventListener("pointermove", onMove);
        window.removeEventListener("pointerup", onUp);
      };
      window.addEventListener("pointermove", onMove);
      window.addEventListener("pointerup", onUp);
    };

    // Compute compartment X positions in SVG space
    const bayRects = useMemo(() => {
      const list: Array<{
        idx: number;
        xPx: number;
        wPx: number;
        centerRatio: number;
        hasDrawers: boolean;
        hasDoor: boolean;
      }> = [];
      let cursorMm = panelT;
      bayWidths.forEach((bw, idx) => {
        const xPx = padX + (cursorMm / wMm) * drawW;
        const wPx = Math.max(4, (bw / wMm) * drawW);
        const centerMm = cursorMm + bw * 0.5;
        const bay = activeModule.bays[idx];
        list.push({
          idx,
          xPx,
          wPx,
          centerRatio: Number(Math.min(0.95, Math.max(0.05, centerMm / wMm)).toFixed(3)),
          hasDrawers: Boolean(bay && bay.drawers.length > 0),
          hasDoor: Boolean(bay && bay.door && bay.door.type !== "open"),
        });
        cursorMm += bw + panelT;
      });
      return list;
    }, [bayWidths, panelT, wMm, drawW, activeModule.bays]);

    const lineXPx = padX + clampedRatio * drawW;
    const lineZPx = padY + clampedRatio * drawH;

    // Identify active compartment under X cut
    const activeBayUnderCut = useMemo(() => {
      if (axis !== "X") return null;
      let cursorMm = panelT;
      for (let i = 0; i < bayWidths.length; i++) {
        const endMm = cursorMm + bayWidths[i];
        if (cutMm >= cursorMm - panelT && cutMm <= endMm + panelT) {
          return i + 1;
        }
        cursorMm = endMm + panelT;
      }
      return null;
    }, [axis, bayWidths, cutMm, panelT]);

    return (
      <div
        data-testid="v11-section-plane-minimap"
        className={`rounded-3xl bg-[#FAF8F4]/96 backdrop-blur-2xl border border-[#DFD9CE] shadow-[0_16px_42px_rgba(20,20,19,0.12)] ${
          compact ? "p-3 space-y-2.5" : "p-3.5 space-y-3"
        } text-xs text-[#141413] select-none`}
      >
        {/* Başlık ve Kesit Yönü Seçici */}
        <div className="flex items-center justify-between gap-2">
          <div>
            <div className="font-bold text-[12.5px] flex items-center gap-1.5">
              <span>Görsel Kesit Planı</span>
              <span className="px-2 py-0.5 rounded-full bg-[#EFECE4] font-mono text-[10.5px] text-[#44403C]">
                {axis === "X" ? `A–A • X: ${cutMm} mm` : `B–B • Z: ${cutMm} mm`}
              </span>
            </div>
            <div className="text-[10.5px] text-[#78716C]">
              {axis === "X"
                ? activeBayUnderCut
                  ? `${activeBayUnderCut}. Bölme üzerinden yan kesit (plan üzerinde sürükleyin)`
                  : "Yan dikme üzerinden kesit"
                : "Arkadan öne derinlik kesiti (plan üzerinde sürükleyin)"}
            </div>
          </div>

          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="w-6 h-6 rounded-full hover:bg-[#EFECE4] text-[#78716C] hover:text-[#141413] flex items-center justify-center cursor-pointer"
              title="Kesiti Kapat"
            >
              ✕
            </button>
          )}
        </div>

        {/* Eksen Seçimi: A-A Yan Kesit vs B-B Boyuna Kesit */}
        <div className="grid grid-cols-2 gap-1 p-1 rounded-2xl bg-[#ECE7DD]/85 border border-[#DFD9CE]">
          <button
            type="button"
            onClick={() => onChangeAxis("X")}
            className={`py-1.5 px-2 rounded-xl text-[11px] font-semibold transition cursor-pointer ${
              axis === "X" ? "bg-[#141413] text-white shadow-2xs" : "text-[#57534E] hover:text-[#141413]"
            }`}
          >
            A–A Yan Kesit (Bölme)
          </button>
          <button
            type="button"
            onClick={() => onChangeAxis("Z")}
            className={`py-1.5 px-2 rounded-xl text-[11px] font-semibold transition cursor-pointer ${
              axis === "Z" ? "bg-[#141413] text-white shadow-2xs" : "text-[#57534E] hover:text-[#141413]"
            }`}
          >
            B–B Boyuna Kesit (Derinlik)
          </button>
        </div>

        {/* ETKİLEŞİMLİ ÜSTTEN MİNİ PLAN (Tıkla & Sürükle) */}
        <div className="rounded-2xl bg-white border border-[#E5DFD3] p-2">
          <svg
            ref={svgRef}
            viewBox={`0 0 ${vbW} ${vbH}`}
            onPointerDown={handlePointerDown}
            className="w-full h-[118px] cursor-crosshair touch-none"
          >
            {/* Arka Duvar Çizgisi */}
            <line
              x1={padX - 10}
              y1={padY - 4}
              x2={padX + drawW + 10}
              y2={padY - 4}
              stroke="#A8A29E"
              strokeWidth="2.5"
              strokeDasharray="4 2"
            />
            <text
              x={vbW / 2}
              y={12}
              textAnchor="middle"
              fontSize="8.5"
              fontWeight="600"
              fill="#78716C"
            >
              ARKA DUVAR ({Math.round(wMm / 10)} cm)
            </text>

            {/* Ana Dolap Gövdesi (Üstten Görünüş) */}
            <rect
              x={padX}
              y={padY}
              width={drawW}
              height={drawH}
              rx="3"
              fill="#F5F2EA"
              stroke="#44403C"
              strokeWidth="1.8"
            />

            {/* Arkalık Kanalı İzdüşümü */}
            <line
              x1={padX + 2}
              y1={padY + 6}
              x2={padX + drawW - 2}
              y2={padY + 6}
              stroke="#8C7A6B"
              strokeWidth="1"
              strokeDasharray="3 2"
            />

            {/* Bölmeler, Ara Dikmeler ve Çekmece/Kapak İzdüşümleri */}
            {bayRects.map((br) => (
              <g key={br.idx}>
                <rect
                  x={br.xPx}
                  y={padY + 7}
                  width={br.wPx}
                  height={drawH - 13}
                  fill="#FFFFFF"
                  stroke="#D6D0C4"
                  strokeWidth="1"
                />
                {br.hasDrawers && (
                  <rect
                    x={br.xPx + 3}
                    y={padY + 14}
                    width={Math.max(2, br.wPx - 6)}
                    height={drawH - 26}
                    rx="1.5"
                    fill="#EFECE4"
                    stroke="#C7BFAEE0"
                    strokeWidth="0.9"
                    strokeDasharray="2 2"
                  />
                )}
                {br.hasDoor && (
                  <rect
                    x={br.xPx + 1}
                    y={padY + drawH + 1.5}
                    width={Math.max(2, br.wPx - 2)}
                    height={3.5}
                    rx="1"
                    fill="#141413"
                  />
                )}
                <text
                  x={br.xPx + br.wPx / 2}
                  y={padY + drawH / 2 + 3}
                  textAnchor="middle"
                  fontSize="9.5"
                  fontWeight="700"
                  fill="#57534E"
                >
                  B{br.idx + 1}
                </text>
              </g>
            ))}

            <text
              x={vbW / 2}
              y={vbH - 4}
              textAnchor="middle"
              fontSize="8.5"
              fontWeight="600"
              fill="#78716C"
            >
              ÖN CEPHE (Derinlik {Math.round(dMm / 10)} cm)
            </text>

            {/* AKTİF KESİT DÜZLEMİ ÇİZGİSİ + BAKIŞ YÖNÜ OKLARI */}
            {axis === "X" ? (
              <g>
                {/* Kesilen sağ bölge hafif tarama */}
                <rect
                  x={padX}
                  y={padY}
                  width={Math.max(0, lineXPx - padX)}
                  height={drawH}
                  fill="#C2410C"
                  fillOpacity="0.08"
                />
                <line
                  x1={lineXPx}
                  y1={padY - 9}
                  x2={lineXPx}
                  y2={padY + drawH + 9}
                  stroke="#C2410C"
                  strokeWidth="2.4"
                />
                {/* Bakış yönü okları (sola bakış) */}
                <polygon
                  points={`${lineXPx - 7},${padY - 6} ${lineXPx},${padY - 10} ${lineXPx},${padY - 2}`}
                  fill="#C2410C"
                />
                <polygon
                  points={`${lineXPx - 7},${padY + drawH + 6} ${lineXPx},${padY + drawH + 2} ${lineXPx},${padY + drawH + 10}`}
                  fill="#C2410C"
                />
                <circle cx={lineXPx} cy={padY + drawH / 2} r="5" fill="#C2410C" />
                <circle cx={lineXPx} cy={padY + drawH / 2} r="2" fill="#FFFFFF" />
                <text
                  x={Math.min(vbW - 14, Math.max(14, lineXPx + 9))}
                  y={padY - 4}
                  fontSize="9.5"
                  fontWeight="800"
                  fill="#C2410C"
                >
                  A
                </text>
                <text
                  x={Math.min(vbW - 14, Math.max(14, lineXPx + 9))}
                  y={padY + drawH + 11}
                  fontSize="9.5"
                  fontWeight="800"
                  fill="#C2410C"
                >
                  A
                </text>
              </g>
            ) : (
              <g>
                <rect
                  x={padX}
                  y={padY}
                  width={drawW}
                  height={Math.max(0, lineZPx - padY)}
                  fill="#C2410C"
                  fillOpacity="0.08"
                />
                <line
                  x1={padX - 9}
                  y1={lineZPx}
                  x2={padX + drawW + 9}
                  y2={lineZPx}
                  stroke="#C2410C"
                  strokeWidth="2.4"
                />
                {/* Bakış yönü okları (arkaya doğru bakış) */}
                <polygon
                  points={`${padX - 6},${lineZPx - 7} ${padX - 10},${lineZPx} ${padX - 2},${lineZPx}`}
                  fill="#C2410C"
                />
                <polygon
                  points={`${padX + drawW + 6},${lineZPx - 7} ${padX + drawW + 2},${lineZPx} ${padX + drawW + 10},${lineZPx}`}
                  fill="#C2410C"
                />
                <circle cx={padX + drawW / 2} cy={lineZPx} r="5" fill="#C2410C" />
                <circle cx={padX + drawW / 2} cy={lineZPx} r="2" fill="#FFFFFF" />
                <text x={padX - 18} y={lineZPx + 3} fontSize="9.5" fontWeight="800" fill="#C2410C">
                  B
                </text>
                <text
                  x={padX + drawW + 12}
                  y={lineZPx + 3}
                  fontSize="9.5"
                  fontWeight="800"
                  fill="#C2410C"
                >
                  B
                </text>
              </g>
            )}
          </svg>
        </div>

        {/* Hızlı Mıknatıslı Kesit Noktaları */}
        <div className="flex flex-wrap gap-1">
          {axis === "X"
            ? bayRects.map((br) => {
                const isCurrent = Math.abs(clampedRatio - br.centerRatio) < 0.04;
                return (
                  <button
                    key={br.idx}
                    type="button"
                    onClick={() => onChangeRatio(br.centerRatio)}
                    className={`px-2.5 py-1 rounded-full text-[10.5px] font-semibold transition cursor-pointer ${
                      isCurrent
                        ? "bg-[#141413] text-white"
                        : "bg-white hover:bg-[#EFECE4] border border-[#E5DFD3] text-[#44403C]"
                    }`}
                  >
                    {br.idx + 1}. Bölme Ortası
                  </button>
                );
              })
            : [
                { label: "Arkalık Kanalı", r: 0.08 },
                { label: "Orta Gövde", r: 0.5 },
                { label: "LED Kanalı", r: Math.min(0.92, Math.max(0.7, (dMm - 75) / dMm)) },
                { label: "Ön Kapak", r: 0.94 },
              ].map((zp) => {
                const isCurrent = Math.abs(clampedRatio - zp.r) < 0.05;
                return (
                  <button
                    key={zp.label}
                    type="button"
                    onClick={() => onChangeRatio(Number(zp.r.toFixed(3)))}
                    className={`px-2.5 py-1 rounded-full text-[10.5px] font-semibold transition cursor-pointer ${
                      isCurrent
                        ? "bg-[#141413] text-white"
                        : "bg-white hover:bg-[#EFECE4] border border-[#E5DFD3] text-[#44403C]"
                    }`}
                  >
                    {zp.label}
                  </button>
                );
              })}
        </div>
      </div>
    );
  }
);

SectionPlaneMiniMap.displayName = "SectionPlaneMiniMap";
