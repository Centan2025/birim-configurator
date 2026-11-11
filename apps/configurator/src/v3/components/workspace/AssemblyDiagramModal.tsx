"use client";

import React, { useState, useMemo, useRef } from "react";
import type { DesignProject, ManufacturingBOM } from "@birim/core";
import { BirimLogo } from "../../design-system";
import { startZeroLagModalDrag } from "../../design-system/zeroLagDrag";
import { Printer, Download, CheckCircle2, X, Layers, Wrench } from "lucide-react";

interface AssemblyDiagramModalProps {
  isOpen: boolean;
  project: DesignProject;
  bom: ManufacturingBOM;
  activeModuleIndex: number;
  onClose: () => void;
}

export const AssemblyDiagramModal: React.FC<AssemblyDiagramModalProps> = ({
  isOpen,
  project,
  bom,
  activeModuleIndex,
  onClose,
}) => {
  const [selectedModIdx, setSelectedModIdx] = useState<number>(activeModuleIndex);
  const [activeStep, setActiveStep] = useState<number>(0); // 0 = All Steps Overview, 1..6 = Specific Step
  const svgRef = useRef<SVGSVGElement | null>(null);

  const mainModules = useMemo(
    () => project.modules.filter((m) => m.category !== "complementary"),
    [project.modules]
  );

  const mod = mainModules[Math.min(selectedModIdx, Math.max(0, mainModules.length - 1))] || project.modules[0];

  const assemblyData = useMemo(() => {
    if (!mod) return null;
    const W = mod.dimensions.width;
    const H = mod.dimensions.height;
    const D = mod.dimensions.depth;
    const T = mod.carcass.panelThickness || 18;
    const plinthH = mod.carcass.plinthHeight ?? 80;
    const bayCount = Math.max(1, mod.bays.length);
    const dividerCount = Math.max(0, bayCount - 1);
    const shelfCount = mod.bays.reduce((s, b) => s + (b.shelves?.length || 0), 0);
    const drawerCount = mod.bays.reduce((s, b) => s + (b.drawers?.length || 0), 0);
    const railCount = mod.bays.reduce((s, b) => s + (b.hangingRails?.length || 0), 0);
    const hasDoors =
      !mod.isOpenFront &&
      mod.bays.some((b) => b.door && b.door.type !== "open" && b.door.doorSystemId !== "open");
    const doorLeavesCount = mod.bays.reduce((acc, b) => {
      if (mod.isOpenFront || !b.door || b.door.type === "open" || b.door.doorSystemId === "open") return acc;
      return acc + (b.door.type === "double" || b.door.doorSystemId === "hinged_double" || b.door.type === "sliding" ? 2 : 1);
    }, 0);
    const isWallCab = mod.category === "kitchen_wall" || (mod.position.y || 0) >= 1100;
    const topStretcherMode = mod.category === "kitchen_base" && mod.carcass.topConstruction === "stretcher_90mm";
    const jointTopology = mod.carcass.carcassJoineryTopology || "type_a_top_bottom_between_sides";
    const isMiter45 = jointTopology === "type_c_miter_45_clamex";

    const modCutPieces = bom.cutList.filter((p) => p.moduleId === mod.id);
    const totalHoles = modCutPieces.reduce((acc, p) => acc + (p.holes?.length || 0), 0);

    const joineryLabel = isMiter45
      ? "Tip C — 45° Gönye Birleşim (Lamello Clamex P-14)"
      : topStretcherMode
      ? "Tip D — 90mm Ön/Arka Kayıtlı Alt Dolap Karkası"
      : jointTopology === "type_b_sides_on_top_bottom"
      ? "Tip B — Alt/Üst Tabla Üzerine Oturan Dikme (Minifiks + Ø8 Kavela)"
      : "Tip A — Yan Dikmeler Arası Alt/Üst Tabla (Ø15 Minifiks + Ø8×35 Kavela)";

    const steps = [
      {
        num: 1,
        title: "Baza / Ayak Teraziye Alma & Gövde Hazırlığı",
        partCodes: ["⑦", "①", "②", "③"],
        detail: isWallCab
          ? `Üst dolap yan panellerindeki 45×65 mm askı kertmelerine (NOTCH_WALL_HANGER) çelik duvar askı elemanlarını takın; Ø8×35 mm kavela ve minifiks milleri dikmelere vidalayın.`
          : `${plinthH} mm yüksekliğindeki baza/ayarlı ayak grubunu su terazisiyle hizalayın. Sol (①) ve sağ (②) dikmelerin iç yüzlerindeki Ø8 mm kavela ve Ø15 mm minifiks yuvalarına bağlantı millerini takın.`,
      },
      {
        num: 2,
        title: `Ana Karkas & ${dividerCount > 0 ? `${dividerCount} Adet Ara Dikme` : "Üst Tabla"} Kilitleme`,
        partCodes: ["①", "②", "③", "④", ...(dividerCount > 0 ? ["⑤"] : [])],
        detail: `${joineryLabel}. Alt tabla (③)${dividerCount > 0 ? `, ${dividerCount} adet ara dikme (⑤)` : ""} ve ${topStretcherMode ? "90 mm ön/arka kayıtları (④)" : "üst tablayı (④)"} birleştirip minifiks eksantriklerini saat yönünde 180° kilitleyin.`,
      },
      {
        num: 3,
        title: "8 mm Kanallı Arkalık (GROOVE_W8.5_Z6) & Gönye Kontrolü",
        partCodes: ["⑥"],
        detail: `Arkalık panelini (⑥) yan ve üst panellerdeki 18 mm içeriden açılmış 8.5×6 mm kanala sürerek oturtun. Köşegen (diyagonal) ölçü eşitliğini kontrol edip arkalık sabitleme kamalarını sıkın.`,
      },
      {
        num: 4,
        title:
          drawerCount > 0
            ? `${drawerCount} Adet Kanallı Çekmece Kasası & Gizli Ray Montajı`
            : `${shelfCount} Adet Raf & Sistem 32 Donanım Montajı`,
        partCodes: ["⑧", ...(drawerCount > 0 ? ["⑨"] : [])],
        detail:
          drawerCount > 0
            ? `Sistem 32 (37 mm ön set) deliklerine gizli rayları vidalayın. Çekmece yan/ön Z=6 mm kanallarına 8 mm alt tabanı (LW − 30 mm) sürün, 16 mm çekmece arkalığını Ø6 mm arka kancalara oturtup T51.1700 mandallarla raylara kilitleyin.`
            : `Sistem 32 Ø5 mm delik sıralarına raf pimlerini takın; sabit rafları minifiks gövde kilitleriyle, hareketli rafları (⑧)${railCount > 0 ? ` ve ${railCount} adet askı borusunu` : ""} yerleştirin.`,
      },
      {
        num: 5,
        title: hasDoors
          ? `${doorLeavesCount} Kanat Kapak, Ø35 mm Menteşe & Kulp (C-C) Montajı`
          : "İç Aksesuar & Raf Emniyet Kontrolü",
        partCodes: hasDoors ? ["⑩"] : ["⑧"],
        detail: hasDoors
          ? `Kapaklardaki Ø35×13 mm tas deliklerine frenli menteşeleri oturtup gövdedeki 37 mm taban plakalarına klipsleyin. 3 eksenli (±2 mm) vidalarla kapaklar arası 2 mm fuga boşluğunu hizalayın ve M4 vidalarla kulpları bağlayın.`
          : `Açık modül raflarının pimleri ve iç aksesuar bağlantılarının tam oturduğunu doğrulayın.`,
      },
      {
        num: 6,
        title:
          mainModules.length > 1
            ? "Modüller Arası M4 Gövde Birleştirme & Duvara Sabitleme"
            : "Devrilme Önleyici Duvar Sabitlemesi & Son Kontrol",
        partCodes: ["①", "②", "④"],
        detail:
          mainModules.length > 1
            ? `Yan yana gelen ${mainModules.length} modülü gönyeye alıp Ø5 mm boydan boya deliklerden M4×32 mm kovanlı birleştirme civatalarıyla birbirine sıkın ve L-braketle duvara emniyetleyin.`
            : `Dolabı nihai konumunda teraziye alıp üst arka kayıt/tabladan devrilme önleyici L-braket ile duvara sabitleyin.`,
      },
    ];

    return {
      W,
      H,
      D,
      T,
      plinthH,
      bayCount,
      dividerCount,
      shelfCount,
      drawerCount,
      railCount,
      hasDoors,
      doorLeavesCount,
      isWallCab,
      topStretcherMode,
      joineryLabel,
      modCutPieces,
      totalHoles,
      steps,
    };
  }, [mod, bom.cutList, mainModules.length]);

  if (!isOpen || !mod || !assemblyData) return null;

  const isHighlighted = (code: string) => {
    if (activeStep === 0) return true;
    const st = assemblyData.steps[activeStep - 1];
    return st ? st.partCodes.includes(code) : true;
  };

  const downloadSvgDiagram = () => {
    if (!svgRef.current) return;
    const raw = new XMLSerializer().serializeToString(svgRef.current);
    const blob = new Blob([raw], { type: "image/svg+xml;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `Birim_Montaj_Semasi_${mod.id}.svg`;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      if (a.parentNode) a.parentNode.removeChild(a);
      URL.revokeObjectURL(url);
    }, 1000);
  };

  const printAssemblySheet = () => {
    if (!svgRef.current) return;
    const svgMarkup = new XMLSerializer().serializeToString(svgRef.current);
    const hwRows = bom.hardware
      .map(
        (h) =>
          `<tr><td><code>${h.sku}</code></td><td>${h.name}</td><td style="text-align:right"><b>${h.quantity} ${h.unit}</b></td></tr>`
      )
      .join("");
    const stepRows = assemblyData.steps
      .map(
        (s) =>
          `<div style="margin-bottom:10px;padding:10px 12px;border:1px solid #cbd5e1;border-radius:10px;">
            <div style="font-weight:800;font-size:13px;color:#0f172a;">Adım ${s.num}: ${s.title} <span style="color:#0369a1;">[${s.partCodes.join(" ")}]</span></div>
            <div style="font-size:12px;color:#334155;margin-top:4px;">${s.detail}</div>
          </div>`
      )
      .join("");

    const html = `<!DOCTYPE html><html lang="tr"><head><meta charset="utf-8"/><title>Birim Montaj Şeması — ${mod.name}</title>
      <style>body{font-family:-apple-system,Segoe UI,sans-serif;margin:24px;color:#141413}table{width:100%;border-collapse:collapse;font-size:12px}th,td{border:1px solid #cbd5e1;padding:6px 8px;text-align:left}th{background:#f1f5f9}</style>
      </head><body>
      <div style="display:flex;justify-content:space-between;align-items:center;border-bottom:2px solid #141413;padding-bottom:12px;margin-bottom:16px;">
        <div><div style="font-size:22px;font-weight:900;letter-spacing:1px;">BİRİM® MONTAJ ŞEMASI &amp; KURULUM KILAVUZU</div>
        <div style="font-size:12px;color:#475569;">${project.title} • ${mod.name} (${assemblyData.W}×${assemblyData.H}×${assemblyData.D} mm) • ${assemblyData.joineryLabel}</div></div>
        <div style="font-family:monospace;font-size:12px;text-align:right;">Parça: ${assemblyData.modCutPieces.length} Adet<br/>CNC Delik: ${assemblyData.totalHoles} Adet</div>
      </div>
      <div style="text-align:center;margin-bottom:18px;border:1px solid #e2e8f0;border-radius:12px;padding:12px;background:#f8fafc;">${svgMarkup}</div>
      <h3 style="margin:12px 0 8px;font-size:15px;">Montaj Adımları</h3>
      ${stepRows}
      <h3 style="margin:16px 0 8px;font-size:15px;">Hırdavat &amp; Bağlantı Elemanı Paketi</h3>
      <table><thead><tr><th>SKU</th><th>Bağlantı / Donanım Adı</th><th style="text-align:right">Miktar</th></tr></thead><tbody>${hwRows}</tbody></table>
      <script>window.onload=()=>setTimeout(()=>window.print(),250);</script></body></html>`;

    const blob = new Blob([html], { type: "text/html;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    window.open(url, "_blank", "noopener,noreferrer");
  };

  return (
    <div
      data-testid="assembly-diagram-modal"
      onClick={onClose}
      className="fixed inset-0 z-[158] flex items-center justify-center bg-slate-950/55 backdrop-blur-xs p-3 sm:p-5"
    >
      <div
        data-draggable-shell="assembly-diagram-modal"
        onClick={(e) => e.stopPropagation()}
        className="birim-ice-modal rounded-[28px] max-w-5xl w-full max-h-[92vh] flex flex-col overflow-hidden text-[#141413]"
      >
        {/* Header with Official Birim Logo */}
        <div
          onPointerDown={(e) => startZeroLagModalDrag(e)}
          title="Pencereyi taşımak için sürükleyin"
          className="px-5 py-3.5 birim-ice-shell-header flex flex-wrap items-center justify-between gap-3 cursor-grab active:cursor-grabbing select-none"
        >
          <div className="flex items-center gap-3 min-w-0">
            <BirimLogo className="h-5 w-auto text-[#141413] shrink-0" />
            <div className="h-4 w-px bg-slate-900/15 shrink-0" />
            <div className="min-w-0">
              <h2 className="text-sm font-bold text-[#141413] truncate">
                Patlatılmış İzometrik Montaj Şeması &amp; Kurulum Kılavuzu
              </h2>
              <p className="text-[11px] text-[#475569] truncate">
                {assemblyData.joineryLabel} • {assemblyData.modCutPieces.length} Kesim Parçası • {assemblyData.totalHoles} CNC Delik İşlemi
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {mainModules.length > 1 && (
              <select
                value={selectedModIdx}
                onChange={(e) => setSelectedModIdx(Number(e.target.value))}
                className="px-2.5 py-1.5 rounded-xl bg-white/80 border border-slate-300 text-xs font-bold text-[#141413]"
              >
                {mainModules.map((m, idx) => (
                  <option key={m.id} value={idx}>
                    #{idx + 1} {m.name} ({m.dimensions.width}mm)
                  </option>
                ))}
              </select>
            )}
            <button
              type="button"
              onClick={downloadSvgDiagram}
              className="px-3 py-1.5 rounded-xl birim-ice-btn text-xs font-bold flex items-center gap-1.5 cursor-pointer"
              title="Montaj Şemasını Vektörel SVG Olarak İndir"
            >
              <Download className="w-3.5 h-3.5" />
              <span>.SVG</span>
            </button>
            <button
              type="button"
              data-testid="print-assembly-manual-btn"
              onClick={printAssemblySheet}
              className="px-3.5 py-1.5 rounded-xl birim-ice-charcoal-pill text-xs font-bold flex items-center gap-1.5 cursor-pointer"
            >
              <Printer className="w-3.5 h-3.5 text-amber-300" />
              <span>A4 Montaj Föyü Yazdır</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="w-8 h-8 rounded-xl birim-ice-btn flex items-center justify-center text-slate-700 hover:text-slate-950 cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Body: Left Exploded Isometric CAD Diagram + Right Step-by-Step Assembly & Hardware Bag */}
        <div className="flex-1 min-h-0 overflow-y-auto p-5 grid grid-cols-1 lg:grid-cols-12 gap-4 text-xs">
          {/* Left 7 cols: Interactive Exploded Isometric SVG Assembly Diagram */}
          <div className="lg:col-span-7 flex flex-col gap-3">
            <div className="p-3 rounded-2xl bg-white/80 border border-white/90 shadow-inner flex flex-col items-center">
              <div className="w-full flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-slate-200/80 mb-2">
                <span className="font-bold text-[#141413] flex items-center gap-1.5">
                  <Layers className="w-4 h-4 text-sky-700" />
                  <span>İzometrik Patlatılmış Parça &amp; Bağlantı Diyagramı ({assemblyData.W}×{assemblyData.H}×{assemblyData.D} mm)</span>
                </span>
                <button
                  type="button"
                  onClick={() => setActiveStep(0)}
                  className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold cursor-pointer ${
                    activeStep === 0 ? "bg-[#141413] text-white" : "bg-slate-200/80 text-slate-700"
                  }`}
                >
                  Tüm Parçaları Göster
                </button>
              </div>

              <svg
                ref={svgRef}
                viewBox="0 0 680 460"
                className="w-full h-auto max-h-[400px] select-none"
              >
                <defs>
                  <marker id="asm-arrow" viewBox="0 0 10 10" refX="7" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
                    <path d="M 0 1 L 10 5 L 0 9 z" fill="#0284c7" />
                  </marker>
                </defs>

                {/* Subtle Technical Grid Backdrop */}
                <rect x="8" y="8" width="664" height="444" rx="16" fill="#F8FAFC" stroke="#E2E8F0" />

                {/* ⑥ 8mm Grooved Back Panel (Exploded Rear-Up-Right) */}
                <g opacity={isHighlighted("⑥") ? 1 : 0.22}>
                  <polygon
                    points="275,46 455,22 455,232 275,256"
                    fill="#E2DDD3"
                    stroke="#475569"
                    strokeWidth="1.8"
                  />
                  <line x1="275" y1="150" x2="235" y2="178" stroke="#0284c7" strokeWidth="1.3" strokeDasharray="4 3" markerEnd="url(#asm-arrow)" />
                  <circle cx="368" cy="30" r="12" fill="#0f172a" />
                  <text x="368" y="34" textAnchor="middle" fill="#ffffff" fontSize="11" fontWeight="800">6</text>
                  <text x="386" y="34" fill="#0f172a" fontSize="10" fontWeight="700">8mm Kanallı Arkalık</text>
                </g>

                {/* ① Left Side Panel (Exploded Left) */}
                <g opacity={isHighlighted("①") ? 1 : 0.22}>
                  <polygon
                    points="64,122 118,92 118,324 64,354"
                    fill="#D8B892"
                    stroke="#57534E"
                    strokeWidth="2"
                  />
                  {/* 8mm Back Groove Line + System 32 Holes */}
                  <line x1="110" y1="98" x2="110" y2="320" stroke="#7c2d12" strokeWidth="1.4" strokeDasharray="3 2" />
                  {[135, 175, 215, 255, 295].map((yy) => (
                    <circle key={yy} cx="84" cy={yy} r="1.8" fill="#0369a1" />
                  ))}
                  <line x1="122" y1="220" x2="176" y2="220" stroke="#0284c7" strokeWidth="1.4" strokeDasharray="4 3" markerEnd="url(#asm-arrow)" />
                  <circle cx="52" cy="112" r="12" fill="#0f172a" />
                  <text x="52" y="116" textAnchor="middle" fill="#ffffff" fontSize="11" fontWeight="800">1</text>
                  <text x="52" y="372" textAnchor="middle" fill="#334155" fontSize="9.5" fontWeight="700">Sol Dikme ({assemblyData.T}mm)</text>
                </g>

                {/* ④ Top Panel or 90mm Kitchen Stretchers (Exploded Up) */}
                <g opacity={isHighlighted("④") ? 1 : 0.22}>
                  {assemblyData.topStretcherMode ? (
                    <>
                      <polygon points="185,96 385,70 402,80 202,106" fill="#DFC3A0" stroke="#57534E" strokeWidth="1.8" />
                      <polygon points="212,114 412,88 428,98 228,124" fill="#DFC3A0" stroke="#57534E" strokeWidth="1.8" />
                    </>
                  ) : (
                    <polygon
                      points="182,96 384,68 432,96 230,124"
                      fill="#E5CBA8"
                      stroke="#57534E"
                      strokeWidth="2"
                    />
                  )}
                  <line x1="295" y1="115" x2="295" y2="152" stroke="#0284c7" strokeWidth="1.4" strokeDasharray="4 3" markerEnd="url(#asm-arrow)" />
                  <circle cx="170" cy="82" r="12" fill="#0f172a" />
                  <text x="170" y="86" textAnchor="middle" fill="#ffffff" fontSize="11" fontWeight="800">4</text>
                  <text x="188" y="85" fill="#0f172a" fontSize="10" fontWeight="700">
                    {assemblyData.topStretcherMode ? "90mm Ön/Arka Kayıt" : "Üst Tabla"}
                  </text>
                </g>

                {/* ⑤ Center Vertical Divider(s) */}
                {assemblyData.dividerCount > 0 && (
                  <g opacity={isHighlighted("⑤") ? 1 : 0.22}>
                    <polygon
                      points="286,154 328,130 328,318 286,342"
                      fill="#DFC4A2"
                      stroke="#57534E"
                      strokeWidth="1.8"
                    />
                    <circle cx="308" cy="142" r="11" fill="#0f172a" />
                    <text x="308" y="146" textAnchor="middle" fill="#ffffff" fontSize="10.5" fontWeight="800">5</text>
                  </g>
                )}

                {/* ⑧ Interior Shelves */}
                {assemblyData.shelfCount > 0 && (
                  <g opacity={isHighlighted("⑧") ? 1 : 0.22}>
                    <polygon
                      points="192,216 282,204 316,222 226,234"
                      fill="#EFE6D8"
                      stroke="#64748B"
                      strokeWidth="1.5"
                    />
                    <polygon
                      points="192,262 282,250 316,268 226,280"
                      fill="#EFE6D8"
                      stroke="#64748B"
                      strokeWidth="1.5"
                    />
                    <circle cx="204" cy="204" r="11" fill="#0f172a" />
                    <text x="204" y="208" textAnchor="middle" fill="#ffffff" fontSize="10.5" fontWeight="800">8</text>
                  </g>
                )}

                {/* ③ Bottom Panel */}
                <g opacity={isHighlighted("③") ? 1 : 0.22}>
                  <polygon
                    points="182,344 384,316 432,344 230,372"
                    fill="#E5CBA8"
                    stroke="#57534E"
                    strokeWidth="2"
                  />
                  <circle cx="170" cy="356" r="12" fill="#0f172a" />
                  <text x="170" y="360" textAnchor="middle" fill="#ffffff" fontSize="11" fontWeight="800">3</text>
                </g>

                {/* ⑦ Plinth / Adjustable Base Frame (Exploded Down) */}
                {!assemblyData.isWallCab && (
                  <g opacity={isHighlighted("⑦") ? 1 : 0.22}>
                    <polygon
                      points="194,404 392,378 424,398 226,424"
                      fill="#94A3B8"
                      fillOpacity="0.45"
                      stroke="#334155"
                      strokeWidth="1.8"
                    />
                    <line x1="295" y1="395" x2="295" y2="366" stroke="#0284c7" strokeWidth="1.3" strokeDasharray="4 3" markerEnd="url(#asm-arrow)" />
                    <circle cx="182" cy="418" r="12" fill="#0f172a" />
                    <text x="182" y="422" textAnchor="middle" fill="#ffffff" fontSize="11" fontWeight="800">7</text>
                    <text x="295" y="440" textAnchor="middle" fill="#334155" fontSize="10" fontWeight="700">
                      Baza &amp; Ayarlı Ayak Grubu ({assemblyData.plinthH} mm)
                    </text>
                  </g>
                )}

                {/* ② Right Side Panel (Exploded Right) */}
                <g opacity={isHighlighted("②") ? 1 : 0.22}>
                  <polygon
                    points="478,96 532,66 532,298 478,328"
                    fill="#D8B892"
                    stroke="#57534E"
                    strokeWidth="2"
                  />
                  <line x1="474" y1="205" x2="424" y2="205" stroke="#0284c7" strokeWidth="1.4" strokeDasharray="4 3" markerEnd="url(#asm-arrow)" />
                  <circle cx="546" cy="82" r="12" fill="#0f172a" />
                  <text x="546" y="86" textAnchor="middle" fill="#ffffff" fontSize="11" fontWeight="800">2</text>
                  <text x="512" y="346" textAnchor="middle" fill="#334155" fontSize="9.5" fontWeight="700">Sağ Dikme ({assemblyData.T}mm)</text>
                </g>

                {/* ⑨ Grooved Drawer Box + Concealed Runner (Exploded Forward-Left) */}
                {assemblyData.drawerCount > 0 && (
                  <g opacity={isHighlighted("⑨") ? 1 : 0.22}>
                    {/* Drawer Back + Sides + Grooved 8mm Bottom + Front */}
                    <polygon points="315,286 402,274 428,290 341,302" fill="#FDE68A" stroke="#9A3412" strokeWidth="1.5" />
                    <polygon points="315,264 402,252 402,274 315,286" fill="#FDBA74" stroke="#7C2D12" strokeWidth="1.5" />
                    <polygon points="338,278 432,265 432,306 338,319" fill="#FEF3C7" stroke="#9A3412" strokeWidth="1.8" />
                    <circle cx="384" cy="328" r="11" fill="#9A3412" />
                    <text x="384" y="332" textAnchor="middle" fill="#ffffff" fontSize="10.5" fontWeight="800">9</text>
                    <text x="384" y="348" textAnchor="middle" fill="#7C2D12" fontSize="9.5" fontWeight="700">
                      Kanallı Çekmece + Arkalık
                    </text>
                  </g>
                )}

                {/* ⑩ Hinged / Sliding Door Leaf + Ø35mm Cup Hinge + C-C Handle (Exploded Front-Right) */}
                {assemblyData.hasDoors && (
                  <g opacity={isHighlighted("⑩") ? 1 : 0.22}>
                    <polygon
                      points="548,148 638,128 638,376 548,396"
                      fill="#EAE3D7"
                      fillOpacity="0.92"
                      stroke="#1E293B"
                      strokeWidth="2"
                    />
                    {/* Ø35mm Hinge Cups + Handle Bar */}
                    <circle cx="558" cy="178" r="5" fill="#f59e0b" stroke="#78350f" strokeWidth="1.2" />
                    <circle cx="558" cy="356" r="5" fill="#f59e0b" stroke="#78350f" strokeWidth="1.2" />
                    <line x1="624" y1="238" x2="624" y2="288" stroke="#141413" strokeWidth="3.5" strokeLinecap="round" />
                    <line x1="544" y1="255" x2="496" y2="245" stroke="#0284c7" strokeWidth="1.4" strokeDasharray="4 3" markerEnd="url(#asm-arrow)" />
                    <circle cx="648" cy="142" r="12" fill="#0f172a" />
                    <text x="648" y="146" textAnchor="middle" fill="#ffffff" fontSize="10.5" fontWeight="800">10</text>
                    <text x="594" y="414" textAnchor="middle" fill="#0f172a" fontSize="9.5" fontWeight="700">
                      Kapak &amp; Ø35 Menteşe ({assemblyData.doorLeavesCount}x)
                    </text>
                  </g>
                )}
              </svg>
            </div>

            {/* Hardware & Fastener Bag Table */}
            <div className="p-3.5 rounded-2xl birim-ice-card space-y-2">
              <div className="font-bold text-[#141413] flex items-center gap-1.5">
                <Wrench className="w-3.5 h-3.5 text-slate-700" />
                <span>Montaj Hırdavat &amp; Donanım Paketi Kontrol Listesi</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 max-h-40 overflow-y-auto pr-1">
                {bom.hardware.map((hw) => (
                  <div
                    key={hw.sku}
                    className="px-2.5 py-1.5 rounded-xl bg-white/70 border border-white/85 flex items-center justify-between gap-2"
                  >
                    <div className="min-w-0">
                      <div className="font-semibold text-[#141413] truncate text-[11px]">{hw.name}</div>
                      <div className="font-mono text-[9.5px] text-slate-500">{hw.sku}</div>
                    </div>
                    <span className="px-2 py-0.5 rounded-lg bg-[#141413] text-white font-mono font-bold text-[10.5px] shrink-0">
                      {hw.quantity} {hw.unit}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Right 5 cols: Interactive 6-Step Sequence */}
          <div className="lg:col-span-5 space-y-2.5">
            <div className="text-[11px] font-bold uppercase tracking-wider text-slate-600 px-1">
              Adım Adım Kurulum Sırası (Diyagramda Vurgulamak İçin Adıma Tıklayın)
            </div>
            {assemblyData.steps.map((st) => {
              const selected = activeStep === st.num;
              return (
                <button
                  key={st.num}
                  type="button"
                  data-testid={`assembly-step-card-${st.num}`}
                  onClick={() => setActiveStep(selected ? 0 : st.num)}
                  className={`w-full text-left p-3 rounded-2xl border transition cursor-pointer space-y-1 ${
                    selected
                      ? "bg-[#141413] text-white border-[#141413] shadow-md"
                      : "bg-white/72 hover:bg-white/90 text-[#141413] border-white/85"
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-bold text-xs flex items-center gap-1.5">
                      <span
                        className={`w-5 h-5 rounded-full text-[10px] font-mono font-black flex items-center justify-center shrink-0 ${
                          selected ? "bg-amber-400 text-[#141413]" : "bg-[#141413] text-white"
                        }`}
                      >
                        {st.num}
                      </span>
                      <span>{st.title}</span>
                    </span>
                    <span
                      className={`font-mono text-[10px] font-bold shrink-0 ${
                        selected ? "text-amber-300" : "text-sky-700"
                      }`}
                    >
                      {st.partCodes.join(" ")}
                    </span>
                  </div>
                  <p
                    className={`text-[11px] leading-relaxed pl-6 ${
                      selected ? "text-slate-200" : "text-slate-600"
                    }`}
                  >
                    {st.detail}
                  </p>
                </button>
              );
            })}

            <div className="p-3 rounded-2xl bg-emerald-950/90 text-emerald-100 text-[11px] flex items-start gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
              <span>
                Tüm gövde kavela/minifiks eksenleri, 8 mm arkalık ve çekmece taban kanalları (LW − 30 mm) ile Ø35 mm menteşe tas koordinatları CNC kesim paketiyle birebir senkronizedir.
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
