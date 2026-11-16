"use client";

import React, { useState } from "react";
import {
  CEILING_TYPE_CATALOG,
  GRAIN_CONTINUITY_CATALOG,
  MULTI_HOLE_MODE_CATALOG,
  type CeilingType,
  type ContinuousGrainPartAssignment,
  type DesignProject,
  type GrainContinuityMode,
  type ModuleInstance,
  type MultiHoleBoringMode,
  type SpaceCeilingConfig,
  computeEffectiveCeilingClearHeight,
  computeSystem32MultiHoleYs,
  resolveMultiHoleSpec,
  resolveSpaceCeilingConfig,
  sampleCeilingClearHeightAtX,
} from "@birim/core";

/**
 * 2D Ön Görünüş (Elevation) sahnesinde mimari tavan kesitini, 6 tavan tipini,
 * net tavan alt kotunu (`▽ +XXXXmm`) ve dolap üstü boşluk ölçüsünü çizer.
 */
export const ElevationCeilingSectionSvg: React.FC<{
  project: DesignProject;
  activeModule: ModuleInstance;
  wallLeftSvgX: number;
  floorSvgY: number;
  mainWallLen: number;
}> = React.memo(({ project, activeModule, wallLeftSvgX, floorSvgY, mainWallLen }) => {
  const cfg = resolveSpaceCeilingConfig(project.space);
  if (!cfg.enabled || !cfg.showInElevation2D) return null;

  const rawCeilH = project.space.ceilingHeight || 2600;
  const ceilingTopSvgY = floorSvgY - rawCeilH;
  const slabH = 110;
  const spanW = Math.max(mainWallLen, activeModule.position.x + activeModule.dimensions.width + 200);

  const modClear = computeEffectiveCeilingClearHeight(
    project.space,
    activeModule.position.x,
    activeModule.dimensions.width,
    activeModule.position.z,
    activeModule.dimensions.depth
  );
  const modTopMm = activeModule.position.y + activeModule.dimensions.height;
  const gapMm = Math.round(modClear.minClearHeightMm - modTopMm);
  const modCenterSvgX =
    wallLeftSvgX + activeModule.position.x + activeModule.dimensions.width / 2;
  const clearLineSvgY = floorSvgY - modClear.minClearHeightMm;
  const modTopSvgY = floorSvgY - modTopMm;

  return (
    <g data-testid="cad-elevation-ceiling-system" className="pointer-events-none">
      <defs>
        <pattern
          id="birim_ceiling_hatch_v74"
          width="24"
          height="24"
          patternTransform="rotate(45 0 0)"
          patternUnits="userSpaceOnUse"
        >
          <line x1="0" y1="0" x2="0" y2="24" stroke="#64748B" strokeWidth="3" opacity="0.35" />
        </pattern>
      </defs>

      {/* Ana Tavan Betonarme / Alçıpan Üst Tablası */}
      <rect
        x={wallLeftSvgX - 80}
        y={ceilingTopSvgY - slabH}
        width={spanW + 160}
        height={slabH}
        fill="#CBD5E1"
        stroke="#334155"
        strokeWidth="4"
      />
      <rect
        x={wallLeftSvgX - 80}
        y={ceilingTopSvgY - slabH}
        width={spanW + 160}
        height={slabH}
        fill="url(#birim_ceiling_hatch_v74)"
      />

      {/* Tip 2: Havuz Tavan (Gizli LED Bantlı) */}
      {cfg.ceilingType === "dropped_perimeter_cove" && (() => {
        const drop = Math.max(60, cfg.dropHeightMm);
        const sideBandW = Math.min(460, Math.max(220, Math.round(spanW * 0.12)));
        const innerW = Math.max(200, spanW - sideBandW * 2);
        return (
          <g>
            {/* Arka duvar önü düşük havuz kuşağı (kesikli alt sınır + yan kulaklar) */}
            <rect
              x={wallLeftSvgX}
              y={ceilingTopSvgY}
              width={spanW}
              height={drop}
              fill="#E2E8F0"
              fillOpacity={0.78}
              stroke="#475569"
              strokeWidth="3.5"
            />
            <rect
              x={wallLeftSvgX + sideBandW}
              y={ceilingTopSvgY + 8}
              width={innerW}
              height={Math.max(24, drop - 28)}
              fill="#F8FAFC"
              stroke="#94A3B8"
              strokeWidth="2.5"
              strokeDasharray="12 6"
            />
            {cfg.hasHiddenLedCove && (
              <line
                x1={wallLeftSvgX + sideBandW + 16}
                y1={ceilingTopSvgY + drop - 16}
                x2={wallLeftSvgX + sideBandW + innerW - 16}
                y2={ceilingTopSvgY + drop - 16}
                stroke="#F59E0B"
                strokeWidth="9"
                strokeLinecap="round"
              />
            )}
          </g>
        );
      })()}

      {/* Tip 3: Dolap Üstü Alçıpan Alın Kutusu (Soffit Bulkhead) */}
      {cfg.ceilingType === "gypsum_soffit_bulkhead" && (() => {
        const drop = Math.max(60, cfg.dropHeightMm);
        return (
          <g>
            <rect
              x={wallLeftSvgX}
              y={ceilingTopSvgY}
              width={spanW}
              height={drop}
              fill="#E7E5E4"
              stroke="#44403C"
              strokeWidth="4"
            />
            <rect
              x={wallLeftSvgX}
              y={ceilingTopSvgY}
              width={spanW}
              height={drop}
              fill="url(#birim_ceiling_hatch_v74)"
            />
          </g>
        );
      })()}

      {/* Tip 4: Ahşap / Betonarme Kirişli Tavan */}
      {cfg.ceilingType === "exposed_wood_beams" && (() => {
        const bH = cfg.beamHeightMm;
        const bW = cfg.beamWidthMm;
        const spacing = cfg.beamSpacingMm;
        const count = Math.max(2, Math.floor(spanW / spacing) + 1);
        const startX = (spanW - (count - 1) * spacing) / 2;
        return (
          <g>
            {Array.from({ length: count }).map((_, idx) => {
              const bx = wallLeftSvgX + startX + idx * spacing - bW / 2;
              return (
                <rect
                  key={`beam_2d_${idx}`}
                  x={bx}
                  y={ceilingTopSvgY}
                  width={bW}
                  height={bH}
                  fill="#A16207"
                  stroke="#451A03"
                  strokeWidth="3.5"
                />
              );
            })}
            <line
              x1={wallLeftSvgX}
              y1={ceilingTopSvgY + bH}
              x2={wallLeftSvgX + spanW}
              y2={ceilingTopSvgY + bH}
              stroke="#92400E"
              strokeWidth="2.5"
              strokeDasharray="10 8"
            />
          </g>
        );
      })()}

      {/* Tip 5: Akustik Ahşap Çıtalı (Baffle) Tavan */}
      {cfg.ceilingType === "coffered_baffle" && (() => {
        const slatH = Math.max(50, cfg.dropHeightMm);
        const pitch = Math.max(60, cfg.bafflePitchMm);
        const slatW = Math.min(42, Math.round(pitch * 0.34));
        const count = Math.max(4, Math.floor((spanW - 40) / pitch));
        const startX = (spanW - (count - 1) * pitch) / 2;
        return (
          <g>
            <rect
              x={wallLeftSvgX}
              y={ceilingTopSvgY}
              width={spanW}
              height={14}
              fill="#1C1917"
            />
            {Array.from({ length: count }).map((_, idx) => (
              <rect
                key={`baffle_2d_${idx}`}
                x={wallLeftSvgX + startX + idx * pitch - slatW / 2}
                y={ceilingTopSvgY + 12}
                width={slatW}
                height={slatH - 12}
                fill="#B45309"
                stroke="#78350F"
                strokeWidth="2"
              />
            ))}
          </g>
        );
      })()}

      {/* Tip 6: Eğimli Çatı / Çatı Katı Tavanı */}
      {cfg.ceilingType === "sloped_attic" && (() => {
        const samples = 16;
        const pts: string[] = [`${wallLeftSvgX},${ceilingTopSvgY}`];
        for (let s = 0; s <= samples; s++) {
          const xMm = (spanW * s) / samples;
          const hMm = sampleCeilingClearHeightAtX(project.space, xMm);
          pts.push(`${wallLeftSvgX + xMm},${floorSvgY - hMm}`);
        }
        pts.push(`${wallLeftSvgX + spanW},${ceilingTopSvgY}`);
        return (
          <polygon
            points={pts.join(" ")}
            fill="#CBD5E1"
            fillOpacity={0.85}
            stroke="#334155"
            strokeWidth="5"
          />
        );
      })()}

      {/* Gömme Spot Armatür Sembolleri */}
      {cfg.hasRecessedSpots && cfg.ceilingType !== "sloped_attic" && (() => {
        const spotCount = Math.max(2, Math.round(spanW / 950));
        const spotStep = spanW / (spotCount + 1);
        const spotSvgY = clearLineSvgY;
        return (
          <g>
            {Array.from({ length: spotCount }).map((_, idx) => {
              const sx = wallLeftSvgX + spotStep * (idx + 1);
              return (
                <g key={`spot_2d_${idx}`}>
                  <rect x={sx - 34} y={spotSvgY - 10} width={68} height={12} rx={3} fill="#1E293B" />
                  <rect x={sx - 22} y={spotSvgY - 2} width={44} height={6} rx={2} fill="#FBBF24" />
                </g>
              );
            })}
          </g>
        );
      })()}

      {/* Tavan Tipi & Net Alt Kot Bilgi Rozeti */}
      <g>
        <rect
          x={wallLeftSvgX + 24}
          y={ceilingTopSvgY - slabH + 18}
          width={640}
          height={50}
          rx={12}
          fill="#0F172A"
          opacity={0.94}
        />
        <text
          x={wallLeftSvgX + 44}
          y={ceilingTopSvgY - slabH + 51}
          fill="#F8FAFC"
          fontSize="23"
          fontWeight="800"
          fontFamily="monospace"
        >
          {`▽ TAVAN: ${
            CEILING_TYPE_CATALOG.find((c) => c.id === cfg.ceilingType)?.shortLabel || "Düz"
          } • Net Alt Kot: +${Math.round(modClear.minClearHeightMm)}mm`}
        </text>
      </g>

      {/* Aktif Modül Üstü Tavan Boşluğu veya Çakışma Ölçü Oku */}
      <g>
        <line
          x1={modCenterSvgX}
          y1={clearLineSvgY}
          x2={modCenterSvgX}
          y2={modTopSvgY}
          stroke={gapMm < 0 ? "#DC2626" : gapMm < 15 ? "#D97706" : "#0284C7"}
          strokeWidth="4"
          strokeDasharray={gapMm < 0 ? undefined : "8 6"}
        />
        <rect
          x={modCenterSvgX - 185}
          y={(clearLineSvgY + modTopSvgY) / 2 - 22}
          width={370}
          height={44}
          rx={10}
          fill={gapMm < 0 ? "#991B1B" : gapMm < 15 ? "#92400E" : "#0369A1"}
          opacity={0.95}
        />
        <text
          x={modCenterSvgX}
          y={(clearLineSvgY + modTopSvgY) / 2 + 7}
          textAnchor="middle"
          fill="#FFFFFF"
          fontSize="21"
          fontWeight="800"
          fontFamily="monospace"
        >
          {gapMm < 0
            ? `⚠ TAVAN ÇAKIŞMASI: ${gapMm}mm`
            : `↕ Tavan Boşluğu: ${gapMm}mm`}
        </text>
      </g>
    </g>
  );
});
ElevationCeilingSectionSvg.displayName = "ElevationCeilingSectionSvg";

/**
 * 2D Ön Görünüşte dikme iç kenarlarında System 32 çoklu delik noktalarını ve
 * kapak/çekmece cephelerinde sürekli desen takibi damar akış oklarını çizer.
 */
export const ElevationMultiHoleAndGrainSvg: React.FC<{
  el: { id: string; role: string; x: number; y: number; width: number; height: number; bayIndex?: number };
  activeModule: ModuleInstance;
  grainAssignment?: ContinuousGrainPartAssignment;
}> = React.memo(({ el, activeModule, grainAssignment }) => {
  const isSideOrDiv =
    el.role === "carcass_side_left" ||
    el.role === "carcass_side_right" ||
    el.role === "carcass_divider";

  if (isSideOrDiv && el.height >= 200) {
    const mhSpec = resolveMultiHoleSpec(activeModule);
    if (mhSpec.mode === "none") return null;
    const panelT = activeModule.carcass.panelThickness || 18;
    const isLeft = el.role === "carcass_side_left";
    const isRight = el.role === "carcass_side_right";
    const bottomOffsetY =
      isLeft || isRight ? Math.max(0, activeModule.carcass.plinthHeight || 0) : 0;

    let adjShelfYs: number[] = [];
    if (isLeft || isRight) {
      const bIdx = isRight ? Math.max(0, activeModule.bays.length - 1) : 0;
      adjShelfYs = (activeModule.bays[bIdx]?.shelves || [])
        .filter((s) => !s.isHidden && s.isAdjustable !== false)
        .map((s) => bottomOffsetY + panelT + s.elevationY);
    } else if (typeof el.bayIndex === "number") {
      const lb = activeModule.bays[el.bayIndex];
      const rb = activeModule.bays[el.bayIndex + 1];
      adjShelfYs = [...(lb?.shelves || []), ...(rb?.shelves || [])]
        .filter((s) => !s.isHidden && s.isAdjustable !== false)
        .map((s) => s.elevationY);
    }

    const ys = computeSystem32MultiHoleYs({
      mode: mhSpec.mode,
      panelHeightMm: el.height,
      bottomOffsetY,
      panelThicknessMm: el.role === "carcass_divider" ? 0 : panelT,
      edgeMarginMm: mhSpec.edgeMarginMm,
      adjustableShelfYsMm: adjShelfYs,
    });

    const dotX = isLeft
      ? el.x + el.width + 8
      : isRight
      ? el.x - 8
      : el.x + el.width / 2;

    return (
      <g data-testid={`elev-multihole-${el.id}`} className="pointer-events-none">
        {ys.map((hy) => (
          <circle
            key={`mh_${el.id}_${hy}`}
            cx={dotX}
            cy={el.y + el.height - hy}
            r={3.2}
            fill="#0F172A"
            opacity={0.72}
          />
        ))}
      </g>
    );
  }

  if (grainAssignment && (el.role.startsWith("door") || el.role === "drawer_front") && el.width >= 160 && el.height >= 100) {
    const isCross = grainAssignment.grainDirection === "crosswise";
    const stripeCount = 5;
    return (
      <g data-testid={`elev-grain-flow-${el.id}`} className="pointer-events-none">
        {/* Hizalı Sürekli Damar Akış Hatları */}
        {Array.from({ length: stripeCount }).map((_, idx) => {
          if (isCross) {
            const phase = ((grainAssignment.offsetYMm + (idx + 1) * 110) % Math.max(80, el.height));
            const ly = el.y + phase;
            return (
              <line
                key={`gr_h_${idx}`}
                x1={el.x + 12}
                y1={ly}
                x2={el.x + el.width - 12}
                y2={ly}
                stroke="#78350F"
                strokeWidth="2.2"
                strokeDasharray="24 10"
                opacity={0.38}
              />
            );
          }
          const worldStep = 130;
          const localMod = ((idx + 1) * worldStep - (grainAssignment.offsetXMm % worldStep) + el.width) % Math.max(80, el.width);
          const lx = el.x + Math.max(14, Math.min(el.width - 14, localMod));
          return (
            <line
              key={`gr_v_${idx}`}
              x1={lx}
              y1={el.y + 10}
              x2={lx}
              y2={el.y + el.height - 10}
              stroke="#78350F"
              strokeWidth="2.2"
              strokeDasharray="26 10"
              opacity={0.38}
            />
          );
        })}

        {/* Desen Takibi Sıra Etiketi */}
        <rect
          x={el.x + 14}
          y={el.y + 14}
          width={Math.min(el.width - 28, 250)}
          height={34}
          rx={8}
          fill="#451A03"
          opacity={0.86}
        />
        <text
          x={el.x + 26}
          y={el.y + 37}
          fill="#FDE68A"
          fontSize="18"
          fontWeight="800"
          fontFamily="monospace"
        >
          {`${isCross ? "↔" : "↕"} Desen [${grainAssignment.sequenceIndex}/${grainAssignment.totalInGroup}]`}
        </text>
      </g>
    );
  }

  return null;
});
ElevationMultiHoleAndGrainSvg.displayName = "ElevationMultiHoleAndGrainSvg";

/**
 * Hem 3D Sahne hem 2D Ön Görünüş üst çubuğunda çalışan kompakt Tavan + Çoklu Delik + Desen Takibi hızlı kontrol açılır menüsü.
 */
export const CeilingAndEngineeringQuickPopover: React.FC<{
  project: DesignProject;
  activeModule: ModuleInstance;
  surface: "3d" | "2d_elevation";
  onUpdateCeiling: (patch: Partial<SpaceCeilingConfig>) => void;
  onUpdateCeilingHeightMm: (newHeightMm: number) => void;
  onUpdateCarcass: (patch: Partial<ModuleInstance["carcass"]>) => void;
  onSetFacadeGrainContinuity: (enabled: boolean) => void;
}> = ({
  project,
  activeModule,
  surface,
  onUpdateCeiling,
  onUpdateCeilingHeightMm,
  onUpdateCarcass,
  onSetFacadeGrainContinuity,
}) => {
  const [open, setOpen] = useState(false);
  const ceilCfg = resolveSpaceCeilingConfig(project.space);
  const mhSpec = resolveMultiHoleSpec(activeModule);
  const grainMode: GrainContinuityMode = project.facadeGrainContinuity
    ? "facade_continuous"
    : activeModule.carcass.grainContinuityMode || "none";

  return (
    <div className="relative pointer-events-auto">
      <button
        type="button"
        data-testid={`quick-ceiling-grain-holes-btn-${surface}`}
        onClick={() => setOpen((v) => !v)}
        title="Tavan Tipleri, Çoklu Delik Sistemi (System 32) ve Desen Takibi Ayarları"
        className={`h-8 px-2.5 rounded-xl text-[11px] font-bold flex items-center gap-1.5 transition cursor-pointer ${
          ceilCfg.enabled || grainMode !== "none"
            ? "birim-ice-btn-active"
            : "birim-ice-btn text-[#141413]"
        }`}
      >
        <span>🏗️</span>
        <span className="hidden sm:inline">
          {ceilCfg.enabled
            ? CEILING_TYPE_CATALOG.find((c) => c.id === ceilCfg.ceilingType)?.shortLabel || "Tavan"
            : "Tavan & Delik"}
        </span>
      </button>

      {open && (
        <div
          data-testid={`quick-ceiling-grain-holes-popover-${surface}`}
          className="absolute right-0 top-10 z-50 w-[332px] p-3.5 rounded-2xl bg-white/95 backdrop-blur-xl border border-slate-200 shadow-2xl text-[#1C1917] space-y-3 text-xs"
          onMouseDown={(e) => e.stopPropagation()}
        >
          {/* 1. MİMARİ TAVAN VE TAVAN TİPLERİ */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-extrabold text-[11.5px] text-slate-900">
                1. Mimari Tavan & Tavan Tipleri
              </span>
              <label className="flex items-center gap-1.5 font-bold text-[11px] cursor-pointer">
                <input
                  type="checkbox"
                  checked={ceilCfg.enabled}
                  onChange={(e) =>
                    onUpdateCeiling({
                      enabled: e.target.checked,
                      showIn3D: true,
                      showInElevation2D: true,
                    })
                  }
                />
                <span>{ceilCfg.enabled ? "Tavan Açık" : "Tavan Ekle"}</span>
              </label>
            </div>

            <div className="grid grid-cols-2 gap-1.5">
              {CEILING_TYPE_CATALOG.map((ct) => {
                const active = ceilCfg.enabled && ceilCfg.ceilingType === ct.id;
                return (
                  <button
                    key={ct.id}
                    type="button"
                    onClick={() =>
                      onUpdateCeiling({
                        enabled: true,
                        ceilingType: ct.id as CeilingType,
                        dropHeightMm:
                          ct.defaultDropHeightMm > 0 ? ct.defaultDropHeightMm : ceilCfg.dropHeightMm,
                      })
                    }
                    title={ct.description}
                    className={`px-2 py-1.5 rounded-xl border text-left text-[10.5px] font-bold transition cursor-pointer ${
                      active
                        ? "bg-slate-900 text-white border-slate-900"
                        : "bg-slate-50 hover:bg-slate-100 text-slate-800 border-slate-200"
                    }`}
                  >
                    {ct.icon} {ct.shortLabel}
                  </button>
                );
              })}
            </div>

            {ceilCfg.enabled && (
              <div className="grid grid-cols-2 gap-2 pt-1">
                <div>
                  <label className="block text-[10px] font-semibold text-slate-500">
                    Tavan Kotu (mm)
                  </label>
                  <input
                    type="number"
                    min={2000}
                    max={4500}
                    step={20}
                    value={project.space.ceilingHeight || 2600}
                    onChange={(e) =>
                      onUpdateCeilingHeightMm(Number(e.target.value) || 2600)
                    }
                    className="w-full mt-0.5 px-2 py-1 rounded-lg border border-slate-300 font-mono text-[11px]"
                  />
                </div>
                {ceilCfg.ceilingType === "sloped_attic" ? (
                  <div>
                    <label className="block text-[10px] font-semibold text-slate-500">
                      Diz Kotu / Açı (°)
                    </label>
                    <div className="flex gap-1 mt-0.5">
                      <input
                        type="number"
                        min={800}
                        max={2600}
                        step={50}
                        value={ceilCfg.slopeKneeHeightMm}
                        onChange={(e) =>
                          onUpdateCeiling({ slopeKneeHeightMm: Number(e.target.value) || 1850 })
                        }
                        className="w-3/5 px-1.5 py-1 rounded-lg border border-slate-300 font-mono text-[11px]"
                      />
                      <input
                        type="number"
                        min={5}
                        max={60}
                        value={ceilCfg.slopeAngleDeg}
                        onChange={(e) =>
                          onUpdateCeiling({ slopeAngleDeg: Number(e.target.value) || 22 })
                        }
                        className="w-2/5 px-1.5 py-1 rounded-lg border border-slate-300 font-mono text-[11px]"
                      />
                    </div>
                  </div>
                ) : (
                  <div>
                    <label className="block text-[10px] font-semibold text-slate-500">
                      Düşüm / Kiriş (mm)
                    </label>
                    <input
                      type="number"
                      min={0}
                      max={900}
                      step={10}
                      value={
                        ceilCfg.ceilingType === "exposed_wood_beams"
                          ? ceilCfg.beamHeightMm
                          : ceilCfg.dropHeightMm
                      }
                      onChange={(e) => {
                        const val = Math.max(0, Number(e.target.value) || 0);
                        if (ceilCfg.ceilingType === "exposed_wood_beams") {
                          onUpdateCeiling({ beamHeightMm: val });
                        } else {
                          onUpdateCeiling({ dropHeightMm: val });
                        }
                      }}
                      className="w-full mt-0.5 px-2 py-1 rounded-lg border border-slate-300 font-mono text-[11px]"
                    />
                  </div>
                )}

                {surface === "3d" && (
                  <label className="col-span-2 flex items-center justify-between px-2 py-1 rounded-lg bg-slate-100 text-[10.5px] font-semibold cursor-pointer">
                    <span>Üstten Bakışta Yarı-Saydam Kesit Tavan</span>
                    <input
                      type="checkbox"
                      checked={ceilCfg.translucentCutawayIn3D}
                      onChange={(e) =>
                        onUpdateCeiling({ translucentCutawayIn3D: e.target.checked })
                      }
                    />
                  </label>
                )}
              </div>
            )}
          </div>

          {/* 2. ÇOKLU DELİK SİSTEMİ (SYSTEM 32) */}
          <div className="pt-2 border-t border-slate-200 space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="font-extrabold text-[11.5px] text-slate-900">
                2. Çoklu Delik Sistemi (System 32)
              </span>
              <select
                value={mhSpec.rowCount}
                onChange={(e) =>
                  onUpdateCarcass({ multiHoleRowCount: Number(e.target.value) === 3 ? 3 : 2 })
                }
                className="px-1.5 py-0.5 rounded-md border border-slate-300 text-[10.5px] font-bold bg-white"
              >
                <option value={2}>2 Sıra (Ön+Arka)</option>
                <option value={3}>3 Sıra (Ön+Orta+Arka)</option>
              </select>
            </div>
            <div className="grid grid-cols-3 gap-1">
              {MULTI_HOLE_MODE_CATALOG.map((mh) => {
                const active = mhSpec.mode === mh.id;
                return (
                  <button
                    key={mh.id}
                    type="button"
                    title={mh.description}
                    onClick={() => onUpdateCarcass({ multiHoleMode: mh.id as MultiHoleBoringMode })}
                    className={`px-1.5 py-1.5 rounded-lg border text-center text-[10px] font-bold transition cursor-pointer ${
                      active
                        ? "bg-slate-900 text-white border-slate-900"
                        : "bg-slate-50 hover:bg-slate-100 text-slate-800 border-slate-200"
                    }`}
                  >
                    {mh.shortLabel}
                  </button>
                );
              })}
            </div>
          </div>

          {/* 3. DESENLİ MALZEMEDE DESEN TAKİBİ */}
          <div className="pt-2 border-t border-slate-200 space-y-1.5">
            <span className="font-extrabold text-[11.5px] text-slate-900 block">
              3. Desenli Malzemede Desen Takibi
            </span>
            <div className="grid grid-cols-2 gap-1">
              {GRAIN_CONTINUITY_CATALOG.map((gc) => {
                const active = grainMode === gc.id;
                return (
                  <button
                    key={gc.id}
                    type="button"
                    title={gc.description}
                    onClick={() => {
                      if (gc.id === "facade_continuous") {
                        onSetFacadeGrainContinuity(true);
                      } else {
                        onSetFacadeGrainContinuity(false);
                        onUpdateCarcass({ grainContinuityMode: gc.id as GrainContinuityMode });
                      }
                    }}
                    className={`px-2 py-1.5 rounded-lg border text-left text-[10px] font-bold transition cursor-pointer ${
                      active
                        ? "bg-amber-800 text-white border-amber-900"
                        : "bg-amber-50/60 hover:bg-amber-100/70 text-stone-800 border-amber-200"
                    }`}
                  >
                    🪵 {gc.shortLabel}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
