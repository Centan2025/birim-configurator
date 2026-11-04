"use client";

import React from "react";
import { useConfiguratorStore } from "../store/useConfiguratorStore";
import {
  Wrench,
  Cpu,
  Layers,
  FileSpreadsheet,
  Network,
  CheckCircle,
  AlertTriangle,
} from "lucide-react";
import { DesignProject } from "@birim/core";

interface TechnicalInspectorProps {
  onOpenBom: () => void;
  onOpenStoreErp: () => void;
}

export const TechnicalInspector: React.FC<TechnicalInspectorProps> = ({
  onOpenBom,
  onOpenStoreErp,
}) => {
  const project = useConfiguratorStore((s) => s.project);
  const activeModIndex = useConfiguratorStore((s) => s.activeModuleIndex);
  const bom = useConfiguratorStore((s) => s.bom);
  const approveProduction = useConfiguratorStore((s) => s.approveProduction);

  const activeMod = project.modules[activeModIndex] || project.modules[0];
  if (!activeMod) return null;

  const handleJointTypeChange = (joint: "minifix_dowel" | "confirmat" | "dowel_only") => {
    const updated: DesignProject = {
      ...project,
      version: (project.version || 1) + 1,
      modules: project.modules.map((m, idx) =>
        idx === activeModIndex ? { ...m, carcass: { ...m.carcass, jointType: joint } } : m
      ),
    };
    useConfiguratorStore.setState({ project: updated });
  };

  const handleThicknessChange = (thickness: number) => {
    const updated: DesignProject = {
      ...project,
      version: (project.version || 1) + 1,
      modules: project.modules.map((m, idx) =>
        idx === activeModIndex ? { ...m, carcass: { ...m.carcass, panelThickness: thickness } } : m
      ),
    };
    useConfiguratorStore.setState({ project: updated });
  };

  const handleBackThicknessChange = (thickness: number) => {
    const updated: DesignProject = {
      ...project,
      version: (project.version || 1) + 1,
      modules: project.modules.map((m, idx) =>
        idx === activeModIndex ? { ...m, carcass: { ...m.carcass, backPanelThickness: thickness } } : m
      ),
    };
    useConfiguratorStore.setState({ project: updated });
  };

  const handleEdgeBandChange = (eb: number) => {
    const updated: DesignProject = {
      ...project,
      version: (project.version || 1) + 1,
      modules: project.modules.map((m, idx) =>
        idx === activeModIndex ? { ...m, carcass: { ...m.carcass, edgeBandThickness: eb } } : m
      ),
    };
    useConfiguratorStore.setState({ project: updated });
  };

  return (
    <div className="space-y-4 text-xs text-slate-200">
      {/* 1. Header Banner */}
      <div className="p-3 bg-amber-950/30 border border-amber-800/50 rounded-xl space-y-1">
        <div className="flex items-center gap-1.5 text-amber-400 font-bold">
          <Wrench className="w-4 h-4" />
          <span>İmalat & Mühendislik Parametreleri</span>
        </div>
        <p className="text-[11px] text-slate-300">
          Bu paneldeki ayarlar CNC delik kodlarını, kenar bantlama makinelerini ve panel nesting yerleşimini doğrudan etkiler.
        </p>
      </div>

      {/* 2. Carcass Joint & Fastener Rules */}
      <div className="p-3.5 bg-slate-900/80 rounded-xl border border-slate-800 space-y-3">
        <h4 className="font-bold text-slate-200 text-xs uppercase tracking-wider flex items-center gap-1.5">
          <Cpu className="w-3.5 h-3.5 text-blue-400" />
          Gövde Birleşim Tipi (System 32)
        </h4>
        <div className="grid grid-cols-3 gap-1.5">
          {[
            { id: "minifix_dowel", label: "Minifix + Kavela" },
            { id: "confirmat", label: "Kabin Vidası (7x50)" },
            { id: "dowel_only", label: "Sadece Kavela" },
          ].map((j) => (
            <button
              key={j.id}
              onClick={() => handleJointTypeChange(j.id as "minifix_dowel" | "confirmat" | "dowel_only")}
              className={`p-2 rounded-lg text-[11px] font-medium transition text-center ${
                activeMod.carcass.jointType === j.id
                  ? "bg-blue-600 text-white font-bold shadow"
                  : "bg-slate-950 text-slate-400 hover:bg-slate-800 border border-slate-800"
              }`}
            >
              {j.label}
            </button>
          ))}
        </div>
      </div>

      {/* 3. Panel Thickness & Tolerances */}
      <div className="p-3.5 bg-slate-900/80 rounded-xl border border-slate-800 space-y-3">
        <h4 className="font-bold text-slate-200 text-xs uppercase tracking-wider flex items-center gap-1.5">
          <Layers className="w-3.5 h-3.5 text-emerald-400" />
          Plaka Kalınlık & Toleransları
        </h4>
        
        {/* Body Thickness */}
        <div className="flex items-center justify-between">
          <span className="text-slate-300">Gövde / Yan Tabla:</span>
          <div className="flex gap-1">
            {[18, 25].map((th) => (
              <button
                key={th}
                onClick={() => handleThicknessChange(th)}
                className={`px-3 py-1 rounded text-xs font-mono font-bold transition ${
                  activeMod.carcass.panelThickness === th
                    ? "bg-emerald-600 text-white"
                    : "bg-slate-950 text-slate-400 hover:bg-slate-800"
                }`}
              >
                {th} mm
              </button>
            ))}
          </div>
        </div>

        {/* Back Panel */}
        <div className="flex items-center justify-between pt-2 border-t border-slate-800/80">
          <span className="text-slate-300">Arkalık Kalınlığı:</span>
          <div className="flex gap-1">
            {[8, 18].map((bth) => (
              <button
                key={bth}
                onClick={() => handleBackThicknessChange(bth)}
                className={`px-3 py-1 rounded text-xs font-mono font-bold transition ${
                  activeMod.carcass.backPanelThickness === bth
                    ? "bg-emerald-600 text-white"
                    : "bg-slate-950 text-slate-400 hover:bg-slate-800"
                }`}
              >
                {bth === 8 ? "8 mm (Kanal İçi)" : "18 mm (Vidalı)"}
              </button>
            ))}
          </div>
        </div>

        {/* Edge Banding */}
        <div className="flex items-center justify-between pt-2 border-t border-slate-800/80">
          <span className="text-slate-300">Kenar Bantlama (ABS):</span>
          <div className="flex gap-1">
            {[0.8, 1, 2].map((eb) => (
              <button
                key={eb}
                onClick={() => handleEdgeBandChange(eb)}
                className={`px-2.5 py-1 rounded text-xs font-mono font-bold transition ${
                  activeMod.carcass.edgeBandThickness === eb
                    ? "bg-emerald-600 text-white"
                    : "bg-slate-950 text-slate-400 hover:bg-slate-800"
                }`}
              >
                {eb} mm
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* 4. Drilling & CNC Metrics */}
      <div className="p-3.5 bg-slate-900/80 rounded-xl border border-slate-800 space-y-2.5">
        <h4 className="font-bold text-slate-200 text-xs uppercase tracking-wider">
          CNC Delik & Üretim Metrikleri
        </h4>
        <div className="grid grid-cols-2 gap-2 text-[11px]">
          <div className="p-2 bg-slate-950 rounded border border-slate-800">
            <span className="text-slate-400 block">System 32 Delikleri:</span>
            <span className="text-amber-400 font-bold font-mono text-sm">{bom.summary.totalDrillingHolesCount} Adet</span>
          </div>
          <div className="p-2 bg-slate-950 rounded border border-slate-800">
            <span className="text-slate-400 block">Toplam Parça Sayısı:</span>
            <span className="text-slate-100 font-bold font-mono text-sm">{bom.summary.totalPiecesCount} Adet</span>
          </div>
          <div className="p-2 bg-slate-950 rounded border border-slate-800">
            <span className="text-slate-400 block">Net Panel Alanı:</span>
            <span className="text-blue-400 font-bold font-mono text-sm">{bom.summary.totalPanelAreaM2} m²</span>
          </div>
          <div className="p-2 bg-slate-950 rounded border border-slate-800">
            <span className="text-slate-400 block">Kenar Bandı Sarfiyatı:</span>
            <span className="text-emerald-400 font-bold font-mono text-sm">{bom.summary.totalEdgeBandMeters} mt</span>
          </div>
        </div>
      </div>

      {/* 5. Production Portals Quick Actions */}
      <div className="space-y-2 pt-1">
        <button
          onClick={onOpenBom}
          className="w-full py-2.5 px-3 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-100 font-semibold rounded-lg flex items-center justify-between transition"
        >
          <span className="flex items-center gap-2">
            <FileSpreadsheet className="w-4 h-4 text-amber-400" />
            BOM & Kesim Listesi Portalı
          </span>
          <span className="text-[11px] font-mono text-amber-400">Görüntüle →</span>
        </button>

        <button
          onClick={onOpenStoreErp}
          className="w-full py-2.5 px-3 bg-gradient-to-r from-blue-700/80 to-indigo-700/80 hover:from-blue-600 hover:to-indigo-600 border border-blue-600 text-white font-semibold rounded-lg flex items-center justify-between transition"
        >
          <span className="flex items-center gap-2">
            <Network className="w-4 h-4" />
            Store & ERP Köprüsü
          </span>
          <span className="text-[11px] font-mono">Mock API →</span>
        </button>
      </div>

      {/* 6. Production Approval */}
      <div className="pt-2 border-t border-slate-800">
        <button
          onClick={approveProduction}
          className="w-full py-2.5 px-4 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-lg flex items-center justify-center gap-2 shadow-lg transition"
        >
          <CheckCircle className="w-4 h-4" />
          Üretime Resmi Onay Ver
        </button>
      </div>
    </div>
  );
};
