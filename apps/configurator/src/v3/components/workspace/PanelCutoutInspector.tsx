"use client";

import React, { useMemo } from "react";
import {
  STANDARD_UTILITY_CUTOUT_PRESETS,
  validatePanelCutouts,
  detectWallUtilityCutoutsForModule,
  type PanelCutoutConfig,
  type CutoutTargetPanel,
  type UtilityCutoutKind,
} from "@birim/core";
import {
  evaluateCornerAndSweepCollisions,
  type SweepModuleInput,
} from "@birim/core";
import {
  generateProjectCncPostProcessorBundle,
  type CncPieceInput,
} from "@birim/manufacturing";
import { Cpu, Scissors, ShieldAlert, Sparkles, Trash2, Download } from "lucide-react";

interface PanelCutoutInspectorProps {
  activeModule: SweepModuleInput & {
    utilityCutouts?: PanelCutoutConfig[];
  };
  allModules: SweepModuleInput[];
  roomObstacles: Array<{
    id: string;
    type: string;
    name?: string;
    position: { x: number; y: number; z: number };
    dimensions: { width: number; height: number; depth: number };
  }>;
  bomCutPieces: CncPieceInput[];
  onChangeCutouts: (nextCutouts: PanelCutoutConfig[]) => void;
  onAutoResolveCornerCollisions: () => void;
}

function downloadTextFile(text: string, fileName: string) {
  const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    if (a.parentNode) a.parentNode.removeChild(a);
    URL.revokeObjectURL(url);
  }, 1500);
}

export const PanelCutoutInspector: React.FC<PanelCutoutInspectorProps> = ({
  activeModule,
  allModules,
  roomObstacles,
  bomCutPieces,
  onChangeCutouts,
  onAutoResolveCornerCollisions,
}) => {
  const cutouts = activeModule.utilityCutouts || [];

  const cutoutIssues = useMemo(
    () =>
      validatePanelCutouts(
        activeModule.dimensions,
        activeModule.carcass.panelThickness || 18,
        cutouts
      ),
    [activeModule.dimensions, activeModule.carcass.panelThickness, cutouts]
  );

  const sweepIssues = useMemo(
    () => evaluateCornerAndSweepCollisions(allModules, 50),
    [allModules]
  );

  const cncBundle = useMemo(
    () => generateProjectCncPostProcessorBundle(bomCutPieces),
    [bomCutPieces]
  );

  const handleAddPreset = (kind: UtilityCutoutKind) => {
    const preset = STANDARD_UTILITY_CUTOUT_PRESETS.find((p) => p.kind === kind);
    if (!preset) return;
    const defaultX =
      preset.defaultTargetPanel === "back"
        ? Math.round(activeModule.dimensions.width / 2)
        : preset.shape === "corner_notch"
        ? Math.round(activeModule.dimensions.depth - preset.widthMm / 2)
        : Math.round(activeModule.dimensions.depth / 2);

    const next: PanelCutoutConfig = {
      id: `cutout_${kind}_${Date.now()}`,
      targetPanel: preset.defaultTargetPanel,
      kind: preset.kind,
      shape: preset.shape,
      centerXMm: defaultX,
      centerYMm: preset.defaultYMm,
      widthMm: preset.widthMm,
      heightMm: preset.heightMm,
      diameterMm: preset.diameterMm,
      cornerRadiusMm: preset.cornerRadiusMm,
      label: preset.label,
    };
    onChangeCutouts([...cutouts, next]);
  };

  const handleAutoDetectFromWall = () => {
    const autoDetected = detectWallUtilityCutoutsForModule(activeModule, roomObstacles);
    if (autoDetected.length === 0) return;
    const existingIds = new Set(cutouts.map((c) => c.id));
    const merged = [...cutouts, ...autoDetected.filter((a) => !existingIds.has(a.id))];
    onChangeCutouts(merged);
  };

  const handleDownloadHomagBundle = () => {
    const combined = cncBundle.homagMprFiles
      .map((f) => `; === FILE: ${f.fileName} (${f.faceSetup}) ===\r\n${f.content}`)
      .join("\r\n\r\n");
    downloadTextFile(combined, `Birim_Homag_WoodWOP_${activeModule.id}.mpr`);
  };

  const handleDownloadBiesseBundle = () => {
    const combined = cncBundle.biesseCixFiles
      .map((f) => `// === FILE: ${f.fileName} ===\r\n${f.content}`)
      .join("\r\n\r\n");
    downloadTextFile(combined, `Birim_Biesse_Works_${activeModule.id}.cix`);
  };

  return (
    <div className="space-y-4">
      {/* 1. 90° KÖŞE AÇILIM SÜPÜRME ÇARPIŞMASI & KÖR ÇITA KONTROLÜ */}
      {sweepIssues.length > 0 && (
        <section
          data-testid="corner-sweep-collision-alert"
          className="p-3.5 rounded-2xl bg-[#FDF2F2] border border-[#F2C6C6] space-y-2.5"
        >
          <div className="flex items-center gap-2 text-xs font-bold text-[#9E2A2B]">
            <ShieldAlert className="w-4 h-4 shrink-0" />
            <span>90° Köşe Kapak / Çekmece Açılım Çakışması ({sweepIssues.length})</span>
          </div>
          <ul className="space-y-1 text-[11px] text-[#7F1D1D]">
            {sweepIssues.map((iss) => (
              <li key={iss.id}>• {iss.message}</li>
            ))}
          </ul>
          <button
            type="button"
            data-testid="auto-fix-corner-filler-btn"
            onClick={onAutoResolveCornerCollisions}
            className="w-full py-2 px-3 rounded-xl bg-[#9E2A2B] hover:bg-[#7F1D1D] text-white text-xs font-bold transition cursor-pointer"
          >
            Otomatik 50 mm Köşe Kör Çıta Ekle & Çakışmayı Çöz
          </button>
        </section>
      )}

      {/* 2. PRİZ / BUAT / TESİSAT & SÜPÜRGELİK CNC BOŞALTMA ARACI */}
      <section className="p-3.5 rounded-2xl bg-white border border-[#E4DFD5] space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Scissors className="w-4 h-4 text-[#8C7A6B]" />
            <span className="text-xs font-bold text-[#141413]">
              Priz, Buat & Süpürgelik Boşaltmaları ({cutouts.length})
            </span>
          </div>
          <button
            type="button"
            onClick={handleAutoDetectFromWall}
            className="px-2.5 py-1 rounded-full bg-[#FAF9F6] hover:bg-[#EFECE5] border border-[#DED8CC] text-[10px] font-semibold text-[#141413] inline-flex items-center gap-1 cursor-pointer"
          >
            <Sparkles className="w-3 h-3 text-[#8C7A6B]" />
            <span>Duvardan Algıla</span>
          </button>
        </div>

        <div className="grid grid-cols-2 gap-1.5">
          {[
            { kind: "socket_single" as const, shortLabel: "+ Tekli Priz (82×82)" },
            { kind: "socket_double" as const, shortLabel: "+ İkili Priz (154×82)" },
            { kind: "cable_grommet" as const, shortLabel: "+ Kablo Buat (Ø60)" },
            { kind: "baseboard_notch" as const, shortLabel: "+ Süpürgelik Çentiği" },
          ].map((btn) => (
            <button
              key={btn.kind}
              type="button"
              onClick={() => handleAddPreset(btn.kind)}
              className="py-1.5 px-2.5 rounded-xl bg-[#FAF9F6] hover:bg-[#EFECE5] border border-[#E4DFD5] text-[11px] font-semibold text-[#141413] text-left transition cursor-pointer"
            >
              {btn.shortLabel}
            </button>
          ))}
        </div>

        {cutouts.length > 0 && (
          <div className="space-y-2 pt-1">
            {cutouts.map((co, idx) => (
              <div
                key={co.id}
                className="p-2.5 rounded-xl bg-[#FAF9F6] border border-[#E4DFD5] space-y-2 text-[11px]"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-bold text-[#141413] truncate">{co.label}</span>
                  <button
                    type="button"
                    onClick={() => onChangeCutouts(cutouts.filter((x) => x.id !== co.id))}
                    className="text-[#78716C] hover:text-red-600 cursor-pointer"
                    aria-label="Boşaltmayı Sil"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>

                <div className="grid grid-cols-3 gap-1.5">
                  <label className="block">
                    <span className="text-[9px] text-[#78716C] block">Hedef Panel</span>
                    <select
                      value={co.targetPanel}
                      onChange={(e) => {
                        const updated = [...cutouts];
                        updated[idx] = {
                          ...co,
                          targetPanel: e.target.value as CutoutTargetPanel,
                        };
                        onChangeCutouts(updated);
                      }}
                      className="w-full mt-0.5 px-1.5 py-1 rounded-lg bg-white border border-[#DED8CC] text-[11px] font-semibold"
                    >
                      <option value="back">Arkalık</option>
                      <option value="left_side">Sol Yan</option>
                      <option value="right_side">Sağ Yan</option>
                      <option value="bottom">Alt Tabla</option>
                    </select>
                  </label>

                  <label className="block">
                    <span className="text-[9px] text-[#78716C] block">Merkez X (mm)</span>
                    <input
                      type="number"
                      value={co.centerXMm}
                      onChange={(e) => {
                        const updated = [...cutouts];
                        updated[idx] = { ...co, centerXMm: Number(e.target.value) || 0 };
                        onChangeCutouts(updated);
                      }}
                      className="w-full mt-0.5 px-1.5 py-1 rounded-lg bg-white border border-[#DED8CC] font-mono font-bold text-center"
                    />
                  </label>

                  <label className="block">
                    <span className="text-[9px] text-[#78716C] block">Merkez Y (mm)</span>
                    <input
                      type="number"
                      value={co.centerYMm}
                      onChange={(e) => {
                        const updated = [...cutouts];
                        updated[idx] = { ...co, centerYMm: Number(e.target.value) || 0 };
                        onChangeCutouts(updated);
                      }}
                      className="w-full mt-0.5 px-1.5 py-1 rounded-lg bg-white border border-[#DED8CC] font-mono font-bold text-center"
                    />
                  </label>
                </div>
              </div>
            ))}
          </div>
        )}

        {cutoutIssues.length > 0 && (
          <div className="p-2.5 rounded-xl bg-[#FDF8F2] border border-[#EAD5BE] space-y-1 text-[10px] text-[#8C5A2B]">
            {cutoutIssues.map((ci) => (
              <div key={ci.cutoutId + ci.message}>⚠ {ci.message}</div>
            ))}
          </div>
        )}
      </section>

      {/* 3. ÇİFT YÜZEYLİ DOĞRUDAN CNC ÇIKTISI (.MPR & .CIX) */}
      <section className="p-3.5 rounded-2xl bg-white border border-[#E4DFD5] space-y-2.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Cpu className="w-4 h-4 text-[#8C7A6B]" />
            <span className="text-xs font-bold text-[#141413]">
              Çift Yüzeyli CNC Makine Çıktısı
            </span>
          </div>
          {cncBundle.flipRequiredPieceIds.length > 0 && (
            <span className="px-2 py-0.5 rounded-full bg-[#F5F3EE] border border-[#DED8CC] text-[10px] font-semibold text-[#141413]">
              {cncBundle.flipRequiredPieceIds.length} Çift Yüzeyli (Flip) Parça
            </span>
          )}
        </div>

        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            data-testid="download-homag-mpr-btn"
            onClick={handleDownloadHomagBundle}
            className="py-2 px-3 rounded-xl bg-[#141413] hover:bg-[#292524] text-white text-[11px] font-bold inline-flex items-center justify-center gap-1.5 transition cursor-pointer"
          >
            <Download className="w-3.5 h-3.5 text-[#E6D5C3]" />
            <span>Homag `.MPR` ({cncBundle.homagMprFiles.length})</span>
          </button>

          <button
            type="button"
            data-testid="download-biesse-cix-btn"
            onClick={handleDownloadBiesseBundle}
            className="py-2 px-3 rounded-xl bg-[#FAF9F6] hover:bg-[#EFECE5] border border-[#DED8CC] text-[#141413] text-[11px] font-bold inline-flex items-center justify-center gap-1.5 transition cursor-pointer"
          >
            <Download className="w-3.5 h-3.5 text-[#8C7A6B]" />
            <span>Biesse `.CIX` ({cncBundle.biesseCixFiles.length})</span>
          </button>
        </div>
      </section>
    </div>
  );
};
