"use client";

import React, { useMemo } from "react";
import type { DesignProject } from "@birim/core";
import {
  computeProjectMepUtilityPoints,
  exportArchitecturalMepDxf,
  generateMepCoordinationPlanSvg,
} from "@birim/manufacturing";
import { startZeroLagModalDrag } from "../../design-system/zeroLagDrag";
import { Download, Zap, X } from "lucide-react";

interface MepCoordinationModalProps {
  isOpen: boolean;
  project: DesignProject;
  onClose: () => void;
}

function triggerFileDownload(fileName: string, content: string, mime: string): void {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    if (a.parentNode) a.parentNode.removeChild(a);
    URL.revokeObjectURL(url);
  }, 500);
}

export const MepCoordinationModal: React.FC<MepCoordinationModalProps> = ({
  isOpen,
  project,
  onClose,
}) => {
  const mepPoints = useMemo(
    () => (isOpen ? computeProjectMepUtilityPoints(project) : []),
    [isOpen, project]
  );
  const mepSvg = useMemo(
    () => (isOpen ? generateMepCoordinationPlanSvg(project) : ""),
    [isOpen, project]
  );

  if (!isOpen) return null;

  const safeSlug = (project.title || "Birim_Proje").replace(/[^a-zA-Z0-9_-]/g, "_");

  return (
    <div
      data-testid="mep-coordination-modal"
      className="fixed inset-0 z-[175] flex items-center justify-center bg-stone-950/50 backdrop-blur-xs p-3 sm:p-5 select-none"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="birim-ice-modal rounded-[28px] w-full max-w-5xl max-h-[90vh] flex flex-col overflow-hidden text-[#141413]"
      >
        <div
          onPointerDown={(e) => startZeroLagModalDrag(e)}
          className="px-5 py-3.5 birim-ice-shell-header flex flex-wrap items-center justify-between gap-3 cursor-grab active:cursor-grabbing"
        >
          <div className="flex items-center gap-2.5">
            <Zap className="w-4 h-4 text-amber-600" />
            <div>
              <h2 className="text-sm font-extrabold tracking-tight">
                Şantiye Elektrik &amp; Sıhhi Tesisat Aks Paftası (MEP + AIA Katmanlı .DXF)
              </h2>
              <p className="text-[11px] text-stone-500">
                Sol Bitmiş Duvar (X=0) ve Bitmiş Döşeme (FFL ±0.00) referanslı priz, su, gider ve davlumbaz baca kotları
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              data-testid="download-mep-dxf-btn"
              onClick={() =>
                triggerFileDownload(
                  `${safeSlug}_Mimari_MEP_Tesisat.dxf`,
                  exportArchitecturalMepDxf(project),
                  "application/dxf"
                )
              }
              className="px-3 py-1.5 rounded-xl bg-[#141413] hover:bg-stone-800 text-white text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              <span>AutoCAD / Revit .DXF İndir</span>
            </button>
            <button
              type="button"
              data-testid="download-mep-svg-btn"
              onClick={() =>
                triggerFileDownload(
                  `${safeSlug}_Santiye_MEP_Paftasi.svg`,
                  mepSvg,
                  "image/svg+xml;charset=utf-8"
                )
              }
              className="px-3 py-1.5 rounded-xl bg-white/85 hover:bg-white border border-stone-300 text-stone-800 text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              <span>.SVG Pafta</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="w-8 h-8 rounded-xl hover:bg-stone-200/70 flex items-center justify-center text-stone-600 cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-4 bg-[#F8F6F2]">
          <div
            className="w-full rounded-2xl bg-white border border-stone-200 shadow-xs overflow-hidden p-2"
            dangerouslySetInnerHTML={{ __html: mepSvg }}
          />

          <div className="rounded-2xl bg-white border border-stone-200 overflow-hidden">
            <div className="px-4 py-2.5 bg-stone-100 border-b border-stone-200 text-xs font-bold text-stone-800">
              Uygulama Aks Çizelgesi ({mepPoints.length} Tesisat / Elektrik Noktası)
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-stone-50 text-stone-500 border-b border-stone-200">
                  <tr>
                    <th className="py-2 px-3 font-semibold">Nokta Tanımı</th>
                    <th className="py-2 px-3 font-semibold">Sol Duvardan (X)</th>
                    <th className="py-2 px-3 font-semibold">Yerden Kot (FFL H)</th>
                    <th className="py-2 px-3 font-semibold">Teknik Özellik</th>
                    <th className="py-2 px-3 font-semibold">Şantiye Notu</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100">
                  {mepPoints.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-4 px-3 text-center text-stone-400">
                        Bu projede aktif su, ankastre cihaz veya LED trafo besleme noktası bulunmuyor.
                      </td>
                    </tr>
                  ) : (
                    mepPoints.map((pt) => (
                      <tr key={pt.id} className="hover:bg-stone-50/80">
                        <td className="py-2 px-3 font-semibold text-stone-900">{pt.label}</td>
                        <td className="py-2 px-3 font-mono font-bold text-sky-800">{pt.xFromLeftWallMm} mm</td>
                        <td className="py-2 px-3 font-mono font-bold text-emerald-800">+{pt.yFromFloorMm} mm</td>
                        <td className="py-2 px-3 text-stone-700">{pt.diameterOrSpec}</td>
                        <td className="py-2 px-3 text-stone-500">{pt.codeNote}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
