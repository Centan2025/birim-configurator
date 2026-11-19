"use client";

import React, { useMemo, useState } from "react";
import { X, Layers, ArrowRight, ZoomIn, AlertTriangle, CheckCircle2 } from "lucide-react";
import { createInitialProject, type ModuleInstance } from "@birim/core";
import { HandleCrossSectionSvg, getHandleCrossSectionMeta } from "./HandleCrossSectionSvg";
import { generateModuleGeometry, componentBounds, type ComponentGeometry } from "@birim/geometry";
import {
  buildDoorSystemsShowcaseProject,
  type DoorShowcaseMode,
} from "../v3/adapter/doorShowcaseBuilder";

export interface DoorSystemsShowcaseModalProps {
  isOpen: boolean;
  onClose: () => void;
  onLoad3DShowcase: (mode: DoorShowcaseMode) => void;
}

interface RealSectionCardData {
  mod: ModuleInstance;
  components: ComponentGeometry[];
  isWall: boolean;
  doorGapTopMm: number | null;
  golaZRange: [number, number] | null;
  doorZRange: [number, number] | null;
  protrusionMm: number;
}

function getRoleStyle(comp: ComponentGeometry): {
  fill: string;
  stroke: string;
  opacity: number;
  zOrder: number;
} {
  const r = String(comp.role);
  if (r === "countertop") {
    return { fill: "#D6CFC2", stroke: "#44403C", opacity: 0.9, zOrder: 2 };
  }
  if (r.startsWith("carcass_") || r === "plinth" || r === "shelf") {
    return { fill: "#EDE8DD", stroke: "#78716C", opacity: 0.65, zOrder: 1 };
  }
  if (r === "gola_profile") {
    return { fill: "#F59E0B", stroke: "#92400E", opacity: 0.95, zOrder: 5 };
  }
  if (r === "door_handle" || r === "drawer_handle") {
    return { fill: "#3B82F6", stroke: "#1D4ED8", opacity: 0.95, zOrder: 6 };
  }
  if (r === "door_left" || r === "door_right" || r === "drawer_front") {
    return { fill: "#CBD5E1", stroke: "#0F172A", opacity: 0.88, zOrder: 4 };
  }
  if (r === "door_hinge" || r === "special_fitting" || comp.id.includes("_aventos_mech_")) {
    return { fill: "#A855F7", stroke: "#6B21A8", opacity: 0.85, zOrder: 3 };
  }
  return { fill: "#E2E8F0", stroke: "#64748B", opacity: 0.5, zOrder: 0 };
}

const RealGeometricYZSection: React.FC<{
  data: RealSectionCardData;
  zoomGripZone: boolean;
  doorOpenDeg: number;
}> = React.memo(({ data, zoomGripZone, doorOpenDeg }) => {
  const { mod, components, isWall } = data;
  const modD = mod.dimensions.depth;
  const modH = mod.dimensions.height;
  const isVerticalGolaMod = mod.bays.some((b) => b.door?.handleProfileId === "hnd_gola_vertical");

  // Dikey Gola (1020) için gerçek 1:1 X-Z Yatay Plan Kesiti (Üstten Görünüş)
  if (isVerticalGolaMod) {
    const modW = mod.dimensions.width;
    const minX = -20;
    const maxX = modW + 20;
    const pMinZ = Math.max(0, modD - 180);
    const pMaxZ = modD + (doorOpenDeg > 2 ? 220 : 65);
    const spanX = Math.max(100, maxX - minX);
    const spanZ = Math.max(100, pMaxZ - pMinZ);
    const svgW = 280;
    const svgH = 190;
    const pad = 16;
    const scale = Math.min((svgW - pad * 2) / spanX, (svgH - pad * 2) / spanZ);
    const ox = pad + (svgW - pad * 2 - spanX * scale) / 2;
    const oy = pad + (svgH - pad * 2 - spanZ * scale) / 2;
    const toPX = (x: number) => ox + (x - minX) * scale;
    const toPZ = (z: number) => oy + (z - pMinZ) * scale;
    const planComps = [...components]
      .filter((c) => c.role !== "carcass_top" && c.role !== "carcass_bottom" && c.role !== "shelf")
      .sort((a, b) => getRoleStyle(a).zOrder - getRoleStyle(b).zOrder);
    return (
      <svg viewBox={`0 0 ${svgW} ${svgH}`} className="w-full h-[186px] rounded-xl bg-[#FAF8F4] border border-[#E5DFD3]">
        <line x1={pad} y1={toPZ(modD)} x2={svgW - pad} y2={toPZ(modD)} stroke="#DC2626" strokeWidth="0.9" strokeDasharray="3 2" opacity={0.55} />
        <text x={pad + 2} y={toPZ(modD) - 3} fontSize="7.5" fontFamily="monospace" fill="#DC2626">
          PLAN KESİTİ (X–Z) • Z={modD}
        </text>
        {planComps.map((c) => {
          const b = componentBounds(c);
          const st = getRoleStyle(c);
          return (
            <rect
              key={c.id}
              x={toPX(b.min.x)}
              y={toPZ(b.min.z)}
              width={Math.max(1.5, (b.max.x - b.min.x) * scale)}
              height={Math.max(1.5, (b.max.z - b.min.z) * scale)}
              fill={st.fill}
              fillOpacity={st.opacity}
              stroke={st.stroke}
              strokeWidth={c.role === "gola_profile" ? 1.4 : 0.9}
            >
              <title>{`${c.label || c.role} | X:${Math.round(b.min.x)}..${Math.round(b.max.x)} | Z:${Math.round(b.min.z)}..${Math.round(b.max.z)}`}</title>
            </rect>
          );
        })}
      </svg>
    );
  }

  // Viewport bounds in REAL mm (Z = horizontal left->right, Y = vertical bottom->top)
  let minZ = -20;
  let maxZ = modD + (doorOpenDeg > 2 ? 260 : 90);
  let minY = -20;
  let maxY = modH + (isWall ? (doorOpenDeg > 2 ? 220 : 60) : 95);

  if (zoomGripZone) {
    minZ = Math.max(0, modD - 180);
    maxZ = modD + (doorOpenDeg > 2 ? 140 : 75);
    const isMultiDrawerGola = (mod.bays[0]?.drawers?.length || 0) >= 2;
    if (isWall) {
      minY = -35;
      maxY = Math.min(modH + 40, 260);
    } else if (isMultiDrawerGola) {
      minY = Math.max(0, modH - 420);
      maxY = modH + 70;
    } else {
      minY = Math.max(0, modH - 220);
      maxY = modH + 75;
    }
  }

  const spanZ = Math.max(100, maxZ - minZ);
  const spanY = Math.max(100, maxY - minY);
  const svgW = 280;
  const svgH = 190;
  const pad = 16;
  const scale = Math.min((svgW - pad * 2) / spanZ, (svgH - pad * 2) / spanY);
  const offsetX = pad + (svgW - pad * 2 - spanZ * scale) / 2;
  const offsetY = pad + (svgH - pad * 2 - spanY * scale) / 2;

  const toX = (z: number) => offsetX + (z - minZ) * scale;
  const toY = (y: number) => svgH - offsetY - (y - minY) * scale;

  const sortedComps = [...components]
    .filter((c) => c.role !== "carcass_side_left" && c.role !== "carcass_side_right")
    .sort((a, b) => getRoleStyle(a).zOrder - getRoleStyle(b).zOrder);

  return (
    <svg
      viewBox={`0 0 ${svgW} ${svgH}`}
      className="w-full h-[186px] rounded-xl bg-[#FAF8F4] border border-[#E5DFD3]"
    >
      {/* 50mm / 20mm Arka Plan Ölçek Izgarası */}
      {Array.from({ length: 12 }).map((_, i) => {
        const gz = Math.ceil(minZ / 50) * 50 + i * 50;
        if (gz > maxZ) return null;
        return (
          <line
            key={`gz-${gz}`}
            x1={toX(gz)}
            y1={pad}
            x2={toX(gz)}
            y2={svgH - pad}
            stroke="#E7E2D8"
            strokeWidth="0.6"
            strokeDasharray="2 2"
          />
        );
      })}

      {/* Gövde Ön Yüzü Referans Çizgisi (Z = mod.dimensions.depth) */}
      <line
        x1={toX(modD)}
        y1={pad}
        x2={toX(modD)}
        y2={svgH - pad}
        stroke="#DC2626"
        strokeWidth="0.9"
        strokeDasharray="3 2"
        opacity={0.55}
      />
      <text
        x={toX(modD) + 2}
        y={pad + 8}
        fontSize="7.5"
        fontFamily="monospace"
        fill="#DC2626"
        opacity={0.85}
      >
        Z={modD}
      </text>

      {/* Gerçek generateModuleGeometry() Bileşenlerinin 1:1 Y-Z Kesitleri */}
      {sortedComps.map((c) => {
        const b = componentBounds(c);
        const st = getRoleStyle(c);
        const rx = toX(b.min.z);
        const ry = toY(b.max.y);
        const rw = Math.max(1.5, (b.max.z - b.min.z) * scale);
        const rh = Math.max(1.5, (b.max.y - b.min.y) * scale);
        const isProtrudingMech =
          doorOpenDeg < 2 &&
          (c.role === "special_fitting" || c.id.includes("_aventos_mech_")) &&
          b.max.z > modD + 2;

        return (
          <g key={c.id}>
            <rect
              x={rx}
              y={ry}
              width={rw}
              height={rh}
              fill={isProtrudingMech ? "#EF4444" : st.fill}
              fillOpacity={st.opacity}
              stroke={isProtrudingMech ? "#991B1B" : st.stroke}
              strokeWidth={c.role === "gola_profile" || isProtrudingMech ? 1.4 : 0.9}
            >
              <title>
                {`${c.label || c.role} | Y:${Math.round(b.min.y)}..${Math.round(
                  b.max.y
                )} mm | Z:${Math.round(b.min.z)}..${Math.round(b.max.z)} mm`}
              </title>
            </rect>
          </g>
        );
      })}
    </svg>
  );
});
RealGeometricYZSection.displayName = "RealGeometricYZSection";

export const DoorSystemsShowcaseModal: React.FC<DoorSystemsShowcaseModalProps> = React.memo(
  ({ isOpen, onClose, onLoad3DShowcase }) => {
    const [zoomGripZone, setZoomGripZone] = useState(true);
    const [doorOpenDeg, setDoorOpenDeg] = useState(0);

    const sectionCards = useMemo<RealSectionCardData[]>(() => {
      if (!isOpen) return [];
      const baseProj = createInitialProject();
      const showcaseProj = buildDoorSystemsShowcaseProject(baseProj, "kitchen_opening_systems");

      return showcaseProj.modules.map((mod) => {
        const bd = generateModuleGeometry(mod, {
          doorOpenAngleDeg: doorOpenDeg,
          drawerOpenMm: 0,
          explodedFactor: 0,
        });
        const comps = bd.components;
        const isWall = mod.position.y >= 1100 || mod.category === "kitchen_wall";

        const doors = comps.filter(
          (c) => c.role === "door_left" || c.role === "door_right" || c.role === "drawer_front"
        );
        const golas = comps.filter((c) => c.role === "gola_profile");
        const mechs = comps.filter(
          (c) => c.role === "special_fitting" || c.id.includes("_aventos_mech_")
        );

        let doorMaxY = -Infinity;
        let doorMinZ = Infinity;
        let doorMaxZ = -Infinity;
        for (const d of doors) {
          const b = componentBounds(d);
          if (b.max.y > doorMaxY) doorMaxY = b.max.y;
          if (b.min.z < doorMinZ) doorMinZ = b.min.z;
          if (b.max.z > doorMaxZ) doorMaxZ = b.max.z;
        }

        let golaMinZ = Infinity;
        let golaMaxZ = -Infinity;
        for (const g of golas) {
          const b = componentBounds(g);
          if (b.min.z < golaMinZ) golaMinZ = b.min.z;
          if (b.max.z > golaMaxZ) golaMaxZ = b.max.z;
        }

        let maxMechZ = -Infinity;
        for (const m of mechs) {
          const b = componentBounds(m);
          if (b.max.z > maxMechZ) maxMechZ = b.max.z;
        }

        const protrusionMm =
          doorOpenDeg < 2 && Number.isFinite(maxMechZ)
            ? Math.max(0, Math.round(maxMechZ - mod.dimensions.depth))
            : 0;

        const doorGapTopMm =
          !isWall && Number.isFinite(doorMaxY)
            ? Math.round(mod.dimensions.height - doorMaxY)
            : null;

        return {
          mod,
          components: comps,
          isWall,
          doorGapTopMm,
          golaZRange:
            golas.length > 0 ? [Math.round(golaMinZ), Math.round(golaMaxZ)] : null,
          doorZRange:
            doors.length > 0 ? [Math.round(doorMinZ), Math.round(doorMaxZ)] : null,
          protrusionMm,
        };
      });
    }, [isOpen, doorOpenDeg]);

    if (!isOpen) return null;

    const triggerShowcase = (mode: DoorShowcaseMode) => {
      onClose();
      if (typeof window !== "undefined") {
        window.setTimeout(() => {
          React.startTransition(() => {
            onLoad3DShowcase(mode);
          });
        }, 24);
      } else {
        onLoad3DShowcase(mode);
      }
    };

    return (
      <div
        data-testid="v11-door-showcase-modal"
        className="fixed inset-0 z-[155] bg-[#141413]/55 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5"
        onClick={onClose}
      >
        <div
          onClick={(e) => e.stopPropagation()}
          className="w-full max-w-6xl max-h-[92vh] flex flex-col birim-ice-modal rounded-[28px] overflow-hidden text-[#141413]"
        >
          {/* Üst Başlık */}
          <div className="px-6 py-4 birim-ice-shell-header flex items-center justify-between shrink-0 gap-3">
            <div className="flex items-center gap-2.5 min-w-0">
              <span className="w-9 h-9 rounded-2xl bg-[#141413] text-[#D6C7B2] flex items-center justify-center shrink-0">
                <Layers className="w-4 h-4" />
              </span>
              <div className="min-w-0">
                <h2 className="text-base font-bold truncate">
                  Canlı Geometrik Y–Z Kesit Müfettişi (Gerçek Motor Çıktısı)
                </h2>
                <p className="text-xs text-[#78716C]">
                  Her kart doğrudan <code className="font-mono">generateModuleGeometry()</code> çıktısının 1:1 mm yan kesitini çizer — statik çizim değil gerçek geometridir
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="w-8 h-8 rounded-full hover:bg-[#EFECE4] flex items-center justify-center cursor-pointer shrink-0"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Kontrol Çubuğu: Yakın Çekim + Kapak Açılım Açısı + 3B Sahneye Diz */}
          <div className="px-6 py-3 bg-[#F6F2EA] border-b border-[#E6E0D4] flex flex-wrap items-center justify-between gap-3 shrink-0">
            <div className="flex flex-wrap items-center gap-2.5">
              <button
                type="button"
                onClick={() => setZoomGripZone((v) => !v)}
                className={`h-8 px-3 rounded-full text-[11px] font-bold inline-flex items-center gap-1.5 border transition cursor-pointer ${
                  zoomGripZone
                    ? "bg-[#141413] text-white border-[#141413]"
                    : "bg-white text-[#141413] border-[#DFD3BC]"
                }`}
              >
                <ZoomIn className="w-3.5 h-3.5" />
                <span>{zoomGripZone ? "Yakın Çekim: Tutamak Bölgesi" : "Tam Gövde Kesiti"}</span>
              </button>

              <div className="flex items-center gap-2 px-3 h-8 rounded-full bg-white border border-[#DFD3BC] text-[11px]">
                <span className="font-semibold text-[#57534E]">Kapak Açılımı:</span>
                <input
                  type="range"
                  min={0}
                  max={85}
                  step={5}
                  value={doorOpenDeg}
                  onChange={(e) => setDoorOpenDeg(Number(e.target.value))}
                  className="w-24 accent-[#141413] cursor-pointer"
                />
                <span className="font-mono font-bold w-8 text-right">{doorOpenDeg}°</span>
              </div>

              {/* Renk Lejantı */}
              <div className="hidden lg:flex items-center gap-2.5 text-[10px] font-semibold text-[#57534E] pl-1">
                <span className="inline-flex items-center gap-1">
                  <span className="w-2.5 h-2.5 rounded-xs bg-[#CBD5E1] border border-[#0F172A]" /> Kapak
                </span>
                <span className="inline-flex items-center gap-1">
                  <span className="w-2.5 h-2.5 rounded-xs bg-[#F59E0B] border border-[#92400E]" /> Gola
                </span>
                <span className="inline-flex items-center gap-1">
                  <span className="w-2.5 h-2.5 rounded-xs bg-[#3B82F6] border border-[#1D4ED8]" /> Kulp
                </span>
                <span className="inline-flex items-center gap-1">
                  <span className="w-2.5 h-2.5 rounded-xs bg-[#A855F7] border border-[#6B21A8]" /> Mekanizma
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => triggerShowcase("kitchen_opening_systems")}
                className="h-8 px-3 rounded-full bg-[#141413] hover:bg-[#292524] text-white text-[11px] font-semibold inline-flex items-center gap-1.5 transition cursor-pointer"
              >
                <span>3B Sahneye Diz (15 Sistem)</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => triggerShowcase("door_profiles")}
                className="h-8 px-3 rounded-full bg-white hover:bg-[#FAF7F0] border border-[#DFD3BC] text-[#141413] text-[11px] font-semibold transition cursor-pointer"
              >
                Kapak Modelleri (9)
              </button>
            </div>
          </div>

          {/* 1:1 Gerçek Y-Z Geometrik Kesit Kartları */}
          <div className="flex-1 overflow-y-auto p-5">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3.5">
              {sectionCards.map((card) => {
                const doorCfg = card.mod.bays[0]?.door;
                const profId = doorCfg?.handleProfileId || "hnd_bar_160";
                const hCat = String(doorCfg?.handleCategory || "bar_handle");
                const refMeta = getHandleCrossSectionMeta(profId, hCat, card.mod.name);
                return (
                <div
                  key={card.mod.id}
                  className="p-3 rounded-2xl bg-white border border-[#E5DFD3] flex flex-col gap-2 shadow-2xs"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="text-[12px] font-bold text-[#141413] leading-snug">
                        {card.mod.name}
                      </div>
                      <div className="text-[10px] font-mono text-[#78716C]">
                        {card.mod.dimensions.width}×{card.mod.dimensions.height}×{card.mod.dimensions.depth} mm • {refMeta.specLine}
                      </div>
                    </div>
                    {card.protrusionMm > 0 ? (
                      <span className="px-2 py-0.5 rounded-full bg-red-100 text-red-800 text-[9.5px] font-bold inline-flex items-center gap-1 shrink-0">
                        <AlertTriangle className="w-3 h-3" /> +{card.protrusionMm}mm Taşma
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 text-[9.5px] font-bold inline-flex items-center gap-1 shrink-0">
                        <CheckCircle2 className="w-3 h-3" /> Temiz
                      </span>
                    )}
                  </div>

                  {/* Yan Yana Karşılaştırma: Sol = Olması Gereken Standart | Sağ = Sistemin Gerçek 1:1 Çizimi */}
                  <div className="grid grid-cols-[132px_1fr] gap-2 items-stretch">
                    <div className="rounded-xl bg-[#F8F5EE] border border-[#E5DFD3] p-2 flex flex-col items-center justify-between">
                      <span className="text-[9px] font-bold uppercase tracking-wider text-[#8C6D46] text-center">
                        Olması Gereken
                      </span>
                      <HandleCrossSectionSvg
                        profileId={profId}
                        category={hCat}
                        size="lg"
                      />
                      <span className="text-[8.5px] text-[#57534E] text-center leading-tight">
                        {refMeta.surfaceNote}
                      </span>
                    </div>
                    <div className="flex flex-col gap-1 min-w-0">
                      <div className="text-[9px] font-bold uppercase tracking-wider text-[#0F172A] px-1">
                        Sistemin Gerçek 1:1 Y–Z Çizimi
                      </div>
                      <RealGeometricYZSection
                        data={card}
                        zoomGripZone={zoomGripZone}
                        doorOpenDeg={doorOpenDeg}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-1.5 text-[9.5px] font-mono bg-[#FAF8F4] px-2 py-1.5 rounded-lg border border-[#EFEAE0] text-[#44403C]">
                    <div>
                      <span className="text-[#78716C]">Üst Boşluk: </span>
                      <strong>
                        {card.doorGapTopMm !== null ? `${card.doorGapTopMm} mm` : "Üst Dolap"}
                      </strong>
                    </div>
                    <div>
                      <span className="text-[#78716C]">Kapak Z: </span>
                      <strong>
                        {card.doorZRange ? `${card.doorZRange[0]}..${card.doorZRange[1]}` : "—"}
                      </strong>
                    </div>
                    <div className="col-span-2">
                      <span className="text-[#78716C]">Gola Kanal Z: </span>
                      <strong>
                        {card.golaZRange
                          ? `${card.golaZRange[0]}..${card.golaZRange[1]} mm (Gövde Önü: ${card.mod.dimensions.depth} mm)`
                          : "Gola Yok"}
                      </strong>
                    </div>
                  </div>
                </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    );
  }
);

DoorSystemsShowcaseModal.displayName = "DoorSystemsShowcaseModal";
