"use client";

import React from "react";
import { useConfiguratorStore } from "../store/useConfiguratorStore";
import {
  Plus,
  Trash2,
  Copy,
  ArrowLeft,
  ArrowRight,
  Shirt,
  Columns,
  Layers,
  Sparkles,
} from "lucide-react";

export const EasyInspector: React.FC = () => {
  const project = useConfiguratorStore((s) => s.project);
  const activeModIndex = useConfiguratorStore((s) => s.activeModuleIndex);
  const setActiveModuleIndex = useConfiguratorStore((s) => s.setActiveModuleIndex);
  const activeBayIndex = useConfiguratorStore((s) => s.activeBayIndex);
  const setActiveBayIndex = useConfiguratorStore((s) => s.setActiveBayIndex);

  const setDimensions = useConfiguratorStore((s) => s.setDimensions);
  const setPlinthHeight = useConfiguratorStore((s) => s.setPlinthHeight);
  const setBayCount = useConfiguratorStore((s) => s.setBayCount);
  const setBayDoorType = useConfiguratorStore((s) => s.setBayDoorType);
  const addShelf = useConfiguratorStore((s) => s.addShelf);
  const removeShelf = useConfiguratorStore((s) => s.removeShelf);
  const addHangingRail = useConfiguratorStore((s) => s.addHangingRail);
  const removeHangingRail = useConfiguratorStore((s) => s.removeHangingRail);
  const addDrawer = useConfiguratorStore((s) => s.addDrawer);
  const removeDrawer = useConfiguratorStore((s) => s.removeDrawer);
  const addSpecialFitting = useConfiguratorStore((s) => s.addSpecialFitting);
  const removeSpecialFitting = useConfiguratorStore((s) => s.removeSpecialFitting);

  const addAdjacentModule = useConfiguratorStore((s) => s.addAdjacentModule);
  const duplicateActiveModule = useConfiguratorStore((s) => s.duplicateActiveModule);
  const removeActiveModule = useConfiguratorStore((s) => s.removeActiveModule);
  const moveActiveModule = useConfiguratorStore((s) => s.moveActiveModule);

  const activeMod = project.modules[activeModIndex] || project.modules[0];
  if (!activeMod) return null;

  const { width, height, depth } = activeMod.dimensions;
  const currentBayIdx = Math.min(activeBayIndex, Math.max(0, activeMod.bays.length - 1));
  const activeBay = activeMod.bays[currentBayIdx] || activeMod.bays[0];

  // Quick preset helpers
  const widthPresets = [1200, 1600, 1800, 2000, 2400];
  const heightPresets = [2000, 2200, 2400, 2600];
  const depthPresets = [450, 550, 600, 650];

  return (
    <div className="space-y-5 text-xs text-slate-200">
      {/* 1. Module Switcher & Actions */}
      <div className="p-3 bg-slate-900/80 rounded-xl border border-slate-800 space-y-2.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-amber-400"></span>
            <span className="font-bold text-slate-100 text-xs">Aktif Kabin:</span>
            <span className="text-amber-400 font-semibold">{activeMod.name}</span>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={duplicateActiveModule}
              className="flex items-center gap-1 px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-semibold transition"
              title="Aktif kabini çoğalt"
            >
              <Copy className="w-3 h-3 text-amber-400" /> Çoğalt
            </button>
            <button
              onClick={addAdjacentModule}
              className="flex items-center gap-1 px-2.5 py-1.5 bg-amber-600 hover:bg-amber-500 text-white rounded-lg text-xs font-bold transition shadow-sm"
            >
              <Plus className="w-3 h-3" /> Kabin Ekle
            </button>
          </div>
        </div>

        {/* Modules row if multiple exist */}
        {project.modules.length > 1 && (
          <div className="flex items-center gap-1.5 pt-1 overflow-x-auto pb-1">
            <div className="flex items-center gap-0.5 shrink-0">
              <button
                onClick={() => moveActiveModule(-100)}
                className="p-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300"
                title="Sola Kaydır (-100mm)"
              >
                <ArrowLeft className="w-3 h-3" />
              </button>
              <button
                onClick={() => moveActiveModule(100)}
                className="p-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300"
                title="Sağa Kaydır (+100mm)"
              >
                <ArrowRight className="w-3 h-3" />
              </button>
            </div>
            {project.modules.map((m, idx) => (
              <button
                key={m.id}
                onClick={() => setActiveModuleIndex(idx)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition shrink-0 ${
                  activeModIndex === idx
                    ? "bg-amber-600 text-white shadow"
                    : "bg-slate-800 text-slate-400 hover:bg-slate-700"
                }`}
              >
                {m.name}
              </button>
            ))}
            <button
              onClick={removeActiveModule}
              className="p-1.5 rounded text-slate-500 hover:text-red-400 ml-auto shrink-0"
              title="Aktif kabini sil"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
      </div>

      {/* 2. Dimensions with Presets & Touch Steppers */}
      <div className="p-3.5 bg-slate-900/80 rounded-xl border border-slate-800 space-y-3.5">
        <div className="flex items-center justify-between border-b border-slate-800/80 pb-2">
          <h3 className="font-bold text-slate-200 text-xs uppercase tracking-wider flex items-center gap-1.5">
            <Columns className="w-3.5 h-3.5 text-amber-400" />
            Gövde Ölçüleri (mm)
          </h3>
          <span className="text-[10px] text-slate-400">Doğrudan yazın veya preset seçin</span>
        </div>

        {/* Width */}
        <div className="space-y-1.5">
          <div className="flex justify-between items-center">
            <span className="text-slate-300 font-medium">Genişlik (W):</span>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setDimensions(Math.max(300, width - 50), height, depth)}
                className="w-6 h-6 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold flex items-center justify-center text-xs"
              >
                -
              </button>
              <input
                type="number"
                min={300}
                max={3600}
                step={10}
                value={width}
                onChange={(e) => setDimensions(Math.min(3600, Math.max(300, Number(e.target.value) || 300)), height, depth)}
                className="w-16 px-1.5 py-1 bg-slate-950 border border-slate-700 rounded text-center font-mono text-amber-400 font-bold text-xs"
              />
              <button
                onClick={() => setDimensions(Math.min(3600, width + 50), height, depth)}
                className="w-6 h-6 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold flex items-center justify-center text-xs"
              >
                +
              </button>
              <span className="text-[10px] text-slate-400">mm</span>
            </div>
          </div>
          <div className="flex gap-1 overflow-x-auto pt-0.5">
            {widthPresets.map((preset) => (
              <button
                key={preset}
                onClick={() => setDimensions(preset, height, depth)}
                className={`flex-1 py-1 px-1.5 rounded text-[11px] font-mono transition ${
                  width === preset
                    ? "bg-amber-600 text-white font-bold"
                    : "bg-slate-950 hover:bg-slate-800 text-slate-400 border border-slate-800"
                }`}
              >
                {preset}
              </button>
            ))}
          </div>
          <input
            type="range"
            min={300}
            max={3600}
            step={50}
            value={width}
            onChange={(e) => setDimensions(Number(e.target.value), height, depth)}
            className="w-full accent-amber-500 cursor-pointer h-1.5 bg-slate-800 rounded-lg"
          />
        </div>

        {/* Height */}
        <div className="space-y-1.5">
          <div className="flex justify-between items-center">
            <span className="text-slate-300 font-medium">Yükseklik (H):</span>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setDimensions(width, Math.max(400, height - 50), depth)}
                className="w-6 h-6 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold flex items-center justify-center text-xs"
              >
                -
              </button>
              <input
                type="number"
                min={400}
                max={2800}
                step={10}
                value={height}
                onChange={(e) => setDimensions(width, Math.min(2800, Math.max(400, Number(e.target.value) || 400)), depth)}
                className="w-16 px-1.5 py-1 bg-slate-950 border border-slate-700 rounded text-center font-mono text-amber-400 font-bold text-xs"
              />
              <button
                onClick={() => setDimensions(width, Math.min(2800, height + 50), depth)}
                className="w-6 h-6 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold flex items-center justify-center text-xs"
              >
                +
              </button>
              <span className="text-[10px] text-slate-400">mm</span>
            </div>
          </div>
          <div className="flex gap-1 overflow-x-auto pt-0.5">
            {heightPresets.map((preset) => (
              <button
                key={preset}
                onClick={() => setDimensions(width, preset, depth)}
                className={`flex-1 py-1 px-1.5 rounded text-[11px] font-mono transition ${
                  height === preset
                    ? "bg-amber-600 text-white font-bold"
                    : "bg-slate-950 hover:bg-slate-800 text-slate-400 border border-slate-800"
                }`}
              >
                {preset}
              </button>
            ))}
          </div>
          <input
            type="range"
            min={400}
            max={2800}
            step={50}
            value={height}
            onChange={(e) => setDimensions(width, Number(e.target.value), depth)}
            className="w-full accent-amber-500 cursor-pointer h-1.5 bg-slate-800 rounded-lg"
          />
        </div>

        {/* Depth */}
        <div className="space-y-1.5">
          <div className="flex justify-between items-center">
            <span className="text-slate-300 font-medium">Derinlik (D):</span>
            <div className="flex items-center gap-1">
              <input
                type="number"
                min={250}
                max={900}
                step={10}
                value={depth}
                onChange={(e) => setDimensions(width, height, Math.min(900, Math.max(250, Number(e.target.value) || 250)))}
                className="w-16 px-1.5 py-1 bg-slate-950 border border-slate-700 rounded text-center font-mono text-amber-400 font-bold text-xs"
              />
              <span className="text-[10px] text-slate-400">mm</span>
            </div>
          </div>
          <div className="flex gap-1 overflow-x-auto pt-0.5">
            {depthPresets.map((preset) => (
              <button
                key={preset}
                onClick={() => setDimensions(width, height, preset)}
                className={`flex-1 py-1 px-1.5 rounded text-[11px] font-mono transition ${
                  depth === preset
                    ? "bg-amber-600 text-white font-bold"
                    : "bg-slate-950 hover:bg-slate-800 text-slate-400 border border-slate-800"
                }`}
              >
                {preset}
              </button>
            ))}
          </div>
        </div>

        {/* Plinth */}
        <div className="flex justify-between items-center pt-1 border-t border-slate-800">
          <span className="text-slate-400">Baza Yüksekliği:</span>
          <div className="flex items-center gap-1.5">
            {[0, 60, 80, 100].map((pVal) => (
              <button
                key={pVal}
                onClick={() => setPlinthHeight(pVal)}
                className={`px-2 py-0.5 rounded text-[11px] font-mono ${
                  activeMod.carcass.plinthHeight === pVal
                    ? "bg-amber-600 text-white font-semibold"
                    : "bg-slate-950 text-slate-400 hover:bg-slate-800"
                }`}
              >
                {pVal === 0 ? "Bazasız" : `${pVal}mm`}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* 3. Compartment Bays Selector (Touch Friendly 44px) */}
      <div className="p-3.5 bg-slate-900/80 rounded-xl border border-slate-800 space-y-3">
        <div className="flex items-center justify-between">
          <span className="font-bold text-slate-200 text-xs uppercase tracking-wider">
            Bölme Sayısı ({activeMod.bays.length})
          </span>
          <span className="text-[10px] text-slate-400">Genişliğe göre bölünür</span>
        </div>
        <div className="grid grid-cols-6 gap-1.5">
          {[1, 2, 3, 4, 5, 6].map((cnt) => (
            <button
              key={cnt}
              data-testid={`bay-btn-${cnt}`}
              onClick={() => {
                setBayCount(cnt);
                setActiveBayIndex(0);
              }}
              className={`h-11 rounded-lg flex items-center justify-center font-mono font-bold text-sm transition ${
                activeMod.bays.length === cnt
                  ? "bg-amber-600 text-white shadow-md ring-2 ring-amber-400/40"
                  : "bg-slate-950 text-slate-400 hover:bg-slate-800 border border-slate-800"
              }`}
            >
              {cnt}
            </button>
          ))}
        </div>
      </div>

      {/* 4. Active Bay Inspector (Fast Actions) */}
      {activeBay && (
        <div className="p-3.5 bg-slate-900/80 rounded-xl border border-slate-800 space-y-3">
          {/* Bay tabs if multiple */}
          {activeMod.bays.length > 1 && (
            <div className="flex gap-1 border-b border-slate-800 pb-2 overflow-x-auto">
              {activeMod.bays.map((b, idx) => (
                <button
                  key={b.index}
                  onClick={() => setActiveBayIndex(idx)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition ${
                    currentBayIdx === idx
                      ? "bg-amber-500/20 text-amber-300 border border-amber-500/40"
                      : "bg-slate-950 text-slate-400 hover:bg-slate-800 border border-slate-800"
                  }`}
                >
                  Bölme {idx + 1}
                </button>
              ))}
            </div>
          )}

          <div className="flex items-center justify-between">
            <h4 className="font-bold text-amber-400 flex items-center gap-1.5 text-xs">
              <Sparkles className="w-3.5 h-3.5" />
              Bölme {currentBayIdx + 1} Donatısı
            </h4>
            <span className="text-[10px] text-slate-400">1-Tıkla Ekle</span>
          </div>

          {/* 1-Click Feature Add Buttons */}
          <div className="grid grid-cols-2 gap-2">
            <button
              data-testid="add-shelf-btn"
              onClick={() => addShelf(currentBayIdx)}
              className="flex items-center justify-center gap-1.5 py-2.5 px-3 bg-slate-950 hover:bg-slate-800 border border-slate-700 hover:border-amber-500 text-slate-200 rounded-lg text-xs font-semibold transition"
            >
              <Layers className="w-3.5 h-3.5 text-blue-400" />
              + Raf ({activeBay.shelves.length})
            </button>
            <button
              data-testid="add-drawer-btn"
              onClick={() => addDrawer(currentBayIdx)}
              className="flex items-center justify-center gap-1.5 py-2.5 px-3 bg-slate-950 hover:bg-slate-800 border border-slate-700 hover:border-amber-500 text-slate-200 rounded-lg text-xs font-semibold transition"
            >
              <Plus className="w-3.5 h-3.5 text-emerald-400" />
              + Çekmece ({activeBay.drawers.length})
            </button>
            <button
              data-testid="add-rail-btn"
              onClick={() => addHangingRail(currentBayIdx)}
              className="flex items-center justify-center gap-1.5 py-2.5 px-3 bg-slate-950 hover:bg-slate-800 border border-slate-700 hover:border-amber-500 text-slate-200 rounded-lg text-xs font-semibold transition"
            >
              <Shirt className="w-3.5 h-3.5 text-amber-400" />
              + Askılık ({activeBay.hangingRails.length})
            </button>
            <button
              data-testid="add-trouser-btn"
              onClick={() => addSpecialFitting(currentBayIdx, "trouser_rack")}
              className="flex items-center justify-center gap-1.5 py-2.5 px-3 bg-slate-950 hover:bg-slate-800 border border-slate-700 hover:border-amber-500 text-slate-200 rounded-lg text-xs font-semibold transition"
            >
              <Plus className="w-3.5 h-3.5 text-purple-400" />
              + Pantolonluk ({activeBay.specialFittings?.length || 0})
            </button>
          </div>

          {/* Door Type Selector */}
          <div className="pt-2 border-t border-slate-800 space-y-1.5">
            <span className="text-slate-400 font-medium text-[11px]">Kapak Modeli:</span>
            <div className="grid grid-cols-3 gap-1">
              {[
                { type: "single_left", label: "Tek Sol" },
                { type: "single_right", label: "Tek Sağ" },
                { type: "double", label: "Çift Kanat" },
                { type: "sliding", label: "Sürgülü" },
                { type: "open", label: "Açık (Yok)" },
              ].map((dt) => (
                <button
                  key={dt.type}
                  onClick={() => setBayDoorType(currentBayIdx, dt.type as "single_left" | "single_right" | "double" | "sliding" | "open")}
                  className={`py-1.5 px-2 rounded text-[11px] font-medium transition ${
                    activeBay.door.type === dt.type
                      ? "bg-amber-600 text-white font-semibold"
                      : "bg-slate-950 text-slate-400 hover:bg-slate-800 border border-slate-800"
                  }`}
                >
                  {dt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Interior fittings quick list with delete buttons */}
          {(activeBay.shelves.length > 0 || activeBay.drawers.length > 0 || activeBay.hangingRails.length > 0 || (activeBay.specialFittings?.length || 0) > 0) && (
            <div className="pt-2 border-t border-slate-800 space-y-1 max-h-36 overflow-y-auto pr-1">
              {activeBay.shelves.map((s, sIdx) => (
                <div key={s.id} className="flex items-center justify-between p-1.5 bg-slate-950 rounded border border-slate-800 text-[11px]">
                  <span className="text-slate-300">Raf #{sIdx + 1} ({s.elevationY}mm)</span>
                  <button onClick={() => removeShelf(currentBayIdx, s.id)} className="text-slate-500 hover:text-red-400 p-0.5">
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              ))}
              {activeBay.drawers.map((d, dIdx) => (
                <div key={d.id} className="flex items-center justify-between p-1.5 bg-slate-950 rounded border border-slate-800 text-[11px]">
                  <span className="text-emerald-300">Çekmece #{dIdx + 1} ({d.height}mm Frenli)</span>
                  <button onClick={() => removeDrawer(currentBayIdx, d.id)} className="text-slate-500 hover:text-red-400 p-0.5">
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              ))}
              {activeBay.hangingRails.map((r, rIdx) => (
                <div key={r.id} className="flex items-center justify-between p-1.5 bg-slate-950 rounded border border-slate-800 text-[11px]">
                  <span className="text-amber-300">Askı Borusu #{rIdx + 1}</span>
                  <button onClick={() => removeHangingRail(currentBayIdx, r.id)} className="text-slate-500 hover:text-red-400 p-0.5">
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              ))}
              {activeBay.specialFittings?.map((f) => (
                <div key={f.id} className="flex items-center justify-between p-1.5 bg-slate-950 rounded border border-slate-800 text-[11px]">
                  <span className="text-purple-300">Özel Donatı ({f.type})</span>
                  <button onClick={() => removeSpecialFitting(currentBayIdx, f.id)} className="text-slate-500 hover:text-red-400 p-0.5">
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
