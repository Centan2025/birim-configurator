"use client";

import React, { useState, useMemo, useRef, useEffect } from "react";
import {
  computeProjectGrainNeighborMap,
  evaluateUnifiedEngineeringModel,
  type DesignProject,
  type GrainPartNeighborInfo,
} from "@birim/core";
import {
  computeProjectCartonization,
  exportCartonManifestCsv,
  generateAssemblyInstructions,
  type ManufacturingBOM,
} from "@birim/manufacturing";
import { BirimLogo, V3PremiumDropdown } from "../../design-system";
import { startZeroLagModalDrag } from "../../design-system/zeroLagDrag";
import { Printer, Download, CheckCircle2, X, Layers, Wrench } from "lucide-react";
import {
  buildExplodedIsoScene,
  isTambourDoor,
} from "../../utils/explodedIsoScene";

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
  useEffect(() => {
    if (isOpen) {
      setSelectedModIdx(activeModuleIndex);
      setActiveStep(0);
    }
  }, [isOpen, activeModuleIndex]);
  const [activeStep, setActiveStep] = useState<number>(0);
  const [hideDoorsInDiagram, setHideDoorsInDiagram] = useState<boolean>(false);
  const [showGrainArrows, setShowGrainArrows] = useState<boolean>(false);
  const svgRef = useRef<SVGSVGElement | null>(null);

  const mainModules = useMemo(
    () => project.modules.filter((m) => m.category !== "complementary"),
    [project.modules]
  );

  const mod =
    mainModules[Math.min(selectedModIdx, Math.max(0, mainModules.length - 1))] || project.modules[0];

  const engReport = useMemo(() => evaluateUnifiedEngineeringModel(project), [project]);
  const canonicalFactorySteps = useMemo(
    () => (bom ? generateAssemblyInstructions(project, bom) : []),
    [project, bom]
  );
  const grainNeighborMap = useMemo(() => computeProjectGrainNeighborMap(project), [project]);
  const moduleGrainSequenceList = useMemo(() => {
    if (!mod) return [] as GrainPartNeighborInfo[];
    const uniq = new Map<string, GrainPartNeighborInfo>();
    grainNeighborMap.forEach((info) => {
      if (info.moduleId === mod.id) {
        uniq.set(info.componentId, info);
      }
    });
    return Array.from(uniq.values()).sort(
      (a, b) => a.grainGroupId.localeCompare(b.grainGroupId) || a.sequenceIndex - b.sequenceIndex
    );
  }, [grainNeighborMap, mod]);

  const assemblyData = useMemo(() => {
    if (!mod) return null;
    const W = mod.dimensions.width;
    const H = mod.dimensions.height;
    const D = mod.dimensions.depth;
    const T = mod.carcass.panelThickness || 18;
    const hull = mod.carcass.hullShape || "rectangular";
    const isCapsuleTambour = hull === "capsule_stadium" || hull === "rounded_corners";
    const isCapsuleTable = hull === "capsule_table";
    const hasTambourBays = mod.bays.some((b) => isTambourDoor(b.door));
    const hasTray =
      isCapsuleTambour &&
      mod.carcass.hasCountertopTray !== false &&
      Boolean(mod.carcass.countertopMaterialId || hull === "capsule_stadium");

    const plinthH = mod.carcass.plinthHeight ?? 80;
    const bayCount = Math.max(1, mod.bays.length);
    const dividerCount = Math.max(0, bayCount - 1);
    const shelfCount = mod.bays.reduce((s, b) => s + (b.shelves?.length || 0), 0);
    const drawerCount = mod.bays.reduce((s, b) => s + (b.drawers?.length || 0), 0);
    const railCount = mod.bays.reduce((s, b) => s + (b.hangingRails?.length || 0), 0);
    const hasDoors =
      !isCapsuleTable &&
      !mod.isOpenFront &&
      (isCapsuleTambour ||
        mod.bays.some((b) => b.door && b.door.type !== "open" && b.door.doorSystemId !== "open"));
    const doorLeavesCount = isCapsuleTambour
      ? mod.isOpenFront
        ? 0
        : 2
      : mod.bays.reduce((acc, b) => {
          if (mod.isOpenFront || !b.door || b.door.type === "open" || b.door.doorSystemId === "open")
            return acc;
          return (
            acc +
            (b.door.type === "double" ||
            b.door.doorSystemId === "hinged_double" ||
            b.door.type === "sliding"
              ? 2
              : 1)
          );
        }, 0);

    const isWallCab =
      !isCapsuleTable && (mod.category === "kitchen_wall" || (mod.position.y || 0) >= 1100);
    const topStretcherMode =
      !isCapsuleTambour &&
      !isCapsuleTable &&
      mod.category === "kitchen_base" &&
      mod.carcass.topConstruction === "stretcher_90mm";
    const jointTopology: string =
      mod.carcass.carcassJoineryTopology || "type_a_top_bottom_between_sides";
    const isMiter45 = jointTopology === "type_c_miter_45_clamex";

    const modCutPieces = (bom?.cutList || []).filter((p) => p.moduleId === mod.id);
    const totalHoles = modCutPieces.reduce((acc, p) => acc + (p.holes?.length || 0), 0);
    const cornerR =
      hull === "capsule_stadium"
        ? Math.round(D / 2)
        : Math.max(65, Math.min(mod.carcass.cornerRadiusMm || 100, Math.round(D / 2 - 10)));

    const joineryLabel = isCapsuleTable
      ? "Kapsül Masa — Silindirik Kerf Sütun Ayak + Dairesel M8 Flanş Disk & Çelik Sarkma Traversi"
      : isCapsuleTambour
      ? `${hull === "capsule_stadium" ? "Kapsül Stadyum" : `R${cornerR}mm Köşeli`} Tambur Sistemi — 8.5×7.5mm CNC Ray Kanalı + 32mm Kavisli Kerf Cep`
      : hasTambourBays
      ? "Tambur Kapaklı Modül — Üst Sarım Kaseti + Alüminyum Gömme Kılavuz Ray + Lamel Perde"
      : isMiter45
      ? "Tip C — 45° Gönye Birleşim (Lamello Clamex P-14)"
      : topStretcherMode
      ? "Tip D — 90mm Ön/Arka Kayıtlı Alt Dolap Karkası"
      : jointTopology === "type_b_sides_on_top_bottom"
      ? "Tip B — Alt/Üst Tabla Üzerine Oturan Dikme (Minifiks + Ø8 Kavela)"
      : "Tip A — Yan Dikmeler Arası Alt/Üst Tabla (Ø15 Minifiks + Ø8×35 Kavela)";

    let steps: Array<{ num: number; title: string; partCodes: string[]; detail: string }>;

    if (isCapsuleTable) {
      steps = [
        {
          num: 1,
          title: "Alt Dairesel CNC Kalıp Diskleri & Terazi Pabuçları",
          partCodes: ["⑦"],
          detail: `Her iki sütun ayak için alt dairesel CNC kalıp disklerine (⑦) M8 terazi ayar pabuçlarını vidalayın ve zemin üzerinde aks mesafesini hizalayın.`,
        },
        {
          num: 2,
          title: "Silindirik Yivli CNC Kerf Sütun Ayakların Kilitlenmesi",
          partCodes: ["①", "②", "⑦"],
          detail: `Arka yüzü esneme çentikli (CNC Kerf) sol (①) ve sağ (②) sütun gövde açınımlarını dairesel kalıp diskleri etrafına sararak kavelalı birleşim hattından poliüretan D4 tutkal ile kilitleyin.`,
        },
        {
          num: 3,
          title: "Üst Taşıyıcı Dairesel Flanş Disklerinin Montajı",
          partCodes: ["③", "①", "②"],
          detail: `Üst dairesel taşıyıcı CNC diskleri (③) ve lazer kesim M8 çelik bağlantı flanşlarını sütunların üst boğazına sabitleyin.`,
        },
        {
          num: 4,
          title: "Masa Altı Çelik Sarkma Önleyici Travers Bağlantısı",
          partCodes: ["⑤", "③"],
          detail: `İki sütun flanşı arasına 40×20×2 mm elektrostatik boyalı çelik sarkma önleyici travers profilini (⑤) M8 havşa başlı cıvatalarla bağlayın.`,
        },
        {
          num: 5,
          title: "5-Eksen Swiss-Edge Kapsül Masa Üst Tablasının Sabitlenmesi",
          partCodes: ["④", "③", "⑤"],
          detail: `${W}×${D} mm kapsül üst tablayı (④) ters yüzündeki M8 gömme somun (rampamuffe) yuvalarına flanş ve travers deliklerinden cıvatalayarak sıkın.`,
        },
        {
          num: 6,
          title: "Zemin Su Terazisi Kalibrasyonu & Son Kontrol",
          partCodes: ["④", "⑦"],
          detail: `Masayı nihai konumuna alıp alt terazi pabuçlarıyla (⑦) sallantıyı sıfırlayın ve 45° Swiss-Edge pah kenarlarını kontrol edin.`,
        },
      ];
    } else if (isCapsuleTambour) {
      steps = [
        {
          num: 1,
          title: "Torna Ayak / Baza & CNC Tambur Kanallı Alt Tabla Kurulumu",
          partCodes: ["⑦", "③"],
          detail: `${plinthH > 0 ? `${plinthH} mm masif/metal torna ayak flanşlarını (⑦) alt tablaya bağlayıp su terazisine alın. ` : ""}Alt tabladaki (③) R=${cornerR} mm sürekli 8.5×7.5 mm CNC tambur kılavuz oluğunu tozdan arındırıp kuru PTFE/silikon kaydırıcı uygulayın.`,
        },
        {
          num: 2,
          title: "Kavisli CNC Kerf İç Cep Gövdeleri & Taşıyıcı Dikmeler",
          partCodes: ["①", "②", "⑤", "③"],
          detail: `Dış tambur kanalıyla arasında net 32 mm cep koridoru kalacak şekilde sol (①) ve sağ (②) kavisli CNC kerf iç gövde kabuklarını, yan taşıyıcı dikmeleri ve ${dividerCount > 0 ? `${dividerCount} adet bölme dikmesini (⑤)` : "iç dikmeleri (⑤)"} alt tablaya kilitleyin.`,
        },
        {
          num: 3,
          title: `Orta Arkalık${drawerCount > 0 ? ", Medya Çekmecesi" : ""} & Bölme Rafları Montajı`,
          partCodes: ["⑥", "⑧", ...(drawerCount > 0 ? ["⑨"] : [])],
          detail: `Orta düz arkalığı (⑥, TV ünitelerinde kablo menfezli) arka kanala oturtun. ${shelfCount > 0 ? `${shelfCount} adet bölme rafını (⑧)` : "İç rafları"}${drawerCount > 0 ? ` ve ${drawerCount} adet frenli çekmece kasasını (⑨)` : ""} monte edin.`,
        },
        {
          num: 4,
          title: "Esnek Keçe Sırtlı Kavisli Tambur Lamel Perdelerin Sürülmesi",
          partCodes: ["⑩", "③"],
          detail: `Akustik keçe sırtlı sol ve sağ tambur lamel panellerin (⑩) alt kılavuz pimlerini alt tabladaki 8.5×7.5 mm CNC ray oluğuna teğetsel olarak sürün; 32 mm yan kavis koridoru boyunca takılmadan kaydığını doğrulayın.`,
        },
        {
          num: 5,
          title: "CNC Tambur Kanallı Üst Tabla Kilitleme & Gömme Kulp/Stoper Ayarı",
          partCodes: ["④", "⑩", "⑤"],
          detail: `Üst tabladaki (④) eşlenik 8.5×7.5 mm CNC tambur ray oluğunu tambur perdelerin üst kılavuz pimlerine geçirerek dikme minifikslerini 180° kilitleyin; orta kapanma mıknatısı/stoperini ve gömme çekme kulpunu sabitleyin.`,
        },
        {
          num: 6,
          title: hasTray
            ? "20 mm Gömme Mermer/Kuvars Tabla Montajı & Son Akış Testi"
            : "Devrilme Emniyeti & Tambur Akış Kalibrasyonu",
          partCodes: hasTray ? ["⑪", "④"] : ["④", "⑩"],
          detail: hasTray
            ? `Üst tabla havuzuna titreşim sönümleyici silikon pedleri yerleştirip 20 mm mermer/kuvars üst tablayı (⑪) oturtun ve her iki tambur kapağın tam açılıp kapanma senkronunu kontrol edin.`
            : `Üniteyi orta arka dikmeden duvara emniyetleyin ve her iki tambur kapağın tam açılıp kapanma senkronunu kontrol edin.`,
        },
      ];
    } else {
      steps = [
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
          title: hasTambourBays
            ? "Tambur Lamel Perde, Alüminyum Gömme Ray & Üst Sarım Kaseti Montajı"
            : hasDoors
            ? `${doorLeavesCount} Kanat Kapak, Ø35 mm Menteşe & Kulp (C-C) Montajı`
            : "İç Aksesuar & Raf Emniyet Kontrolü",
          partCodes: hasDoors ? ["⑩"] : ["⑧"],
          detail: hasTambourBays
            ? `Yan dikmelere alüminyum gömme kılavuz rayları ve üst bölmeye yaylı dengeleme tambur mekanizmasını sabitleyin. Esnek lamel perdeyi (⑩) raylara sürüp üst sarım kapama alnını ve alt çekme profilini bağlayın.`
            : hasDoors
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
    }

    return {
      W,
      H,
      D,
      T,
      hull,
      isCapsuleTambour,
      isCapsuleTable,
      hasTambourBays,
      hasTray,
      cornerR,
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
  }, [mod, bom?.cutList, mainModules.length]);

  const isoScene = useMemo(() => {
    if (!mod || !assemblyData) return null;
    return buildExplodedIsoScene(mod, {
      svgW: 920,
      svgH: 520,
      padX: 205,
      padY: 48,
      grainNeighborMap,
    });
  }, [mod, assemblyData, grainNeighborMap]);

  if (!isOpen || !mod || !assemblyData || !isoScene) return null;

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
    const hwRows = (bom?.hardwareList || [])
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
      <style>@page{size:A4 portrait;margin:12mm;}body{font-family:-apple-system,Segoe UI,sans-serif;margin:0;padding:16px;color:#141413;background:#fff}svg{width:100%;height:auto;max-height:460px}table{width:100%;border-collapse:collapse;font-size:12px}th,td{border:1px solid #cbd5e1;padding:6px 8px;text-align:left}th{background:#f1f5f9}</style>
      </head><body>
      <div style="display:flex;justify-content:space-between;align-items:center;border-bottom:2px solid #141413;padding-bottom:12px;margin-bottom:16px;">
        <div><div style="font-size:22px;font-weight:900;letter-spacing:1px;">BİRİM® MONTAJ ŞEMASI &amp; KURULUM KILAVUZU</div>
        <div style="font-size:12px;color:#475569;">${project.title} • ${mod.name} (${assemblyData.W}×${assemblyData.H}×${assemblyData.D} mm) • ${assemblyData.joineryLabel}</div></div>
        <div style="font-family:monospace;font-size:12px;text-align:right;">Parça: ${assemblyData.modCutPieces.length} Adet<br/>CNC Delik: ${assemblyData.totalHoles} Adet</div>
      </div>
      <div style="text-align:center;margin-bottom:18px;border:1px solid #e2e8f0;border-radius:12px;padding:12px;background:#f8fafc;">${svgMarkup}</div>
      ${
        moduleGrainSequenceList.length > 0
          ? `<h3 style="margin:12px 0 8px;font-size:15px;color:#92400e;">Desen Takibi Cephe Montaj Sırası ve Suyolu Yön Tablosu</h3>
             <table style="margin-bottom:14px;"><thead><tr><th>Sıra</th><th>Cephe Parçası</th><th>Damar / Suyolu Yönü</th><th>Bitişik Komşu Parçalar</th></tr></thead><tbody>
             ${moduleGrainSequenceList
               .map(
                 (g) =>
                   `<tr><td><b>${g.shortSeqBadge}</b></td><td>${g.partShortLabel}</td><td><b>${g.directionLabelTr}</b></td><td>${g.compactNeighborTextTr}</td></tr>`
               )
               .join("")}
             </tbody></table>`
          : ""
      }
      <h3 style="margin:12px 0 8px;font-size:15px;">Montaj Adımları</h3>
      ${stepRows}
      <h3 style="margin:16px 0 8px;font-size:15px;">Hırdavat &amp; Bağlantı Elemanı Paketi</h3>
      <table><thead><tr><th>SKU</th><th>Bağlantı / Donanım Adı</th><th style="text-align:right">Miktar</th></tr></thead><tbody>${hwRows}</tbody></table>
      <script>window.onload=()=>setTimeout(()=>window.print(),250);</script></body></html>`;

    const blob = new Blob([html], { type: "text/html;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    window.open(url, "_blank", "noopener,noreferrer");
  };

  const hardwareItems = bom?.hardwareList || [];
  const totalHardwareQty = hardwareItems.reduce((acc, hw) => acc + (hw.quantity || 0), 0);

  return (
    <div
      data-testid="assembly-diagram-modal"
      onClick={onClose}
      className="fixed inset-0 z-[158] flex items-center justify-center bg-[#141413]/55 backdrop-blur-xs p-0 md:p-5"
    >
      <div
        data-draggable-shell="assembly-diagram-modal"
        onClick={(e) => e.stopPropagation()}
        className="relative birim-ice-modal rounded-[28px] max-md:rounded-none max-md:h-[100dvh] max-md:max-h-[100dvh] max-w-6xl w-full max-h-[92dvh] flex flex-col overflow-hidden text-[#141413]"
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="Kapat"
          title="Kapat"
          className="absolute top-3.5 right-3.5 z-20 w-8 h-8 rounded-full bg-white/95 border border-[#D8D1C4] shadow-2xs flex items-center justify-center text-[#57534E] hover:text-[#141413] hover:bg-white cursor-pointer"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Header with Official Birim Logo */}
        <div
          onPointerDown={(e) => startZeroLagModalDrag(e)}
          title="Pencereyi taşımak için sürükleyin"
          className="px-5 py-3.5 pr-14 birim-ice-shell-header flex items-center justify-between gap-3 cursor-grab active:cursor-grabbing select-none"
        >
          <div className="flex items-center gap-3 flex-1 min-w-0 overflow-hidden">
            <BirimLogo className="h-5 w-auto text-[#141413] shrink-0" />
            <div className="h-4 w-px bg-slate-900/15 shrink-0" />
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-sm font-bold text-[#141413] truncate">
                  Patlatılmış İzometrik Montaj Şeması &amp; Kurulum Kılavuzu
                </h2>
                {assemblyData.isCapsuleTambour && (
                  <span className="px-2 py-0.5 rounded-full bg-amber-100 border border-amber-300 text-amber-950 text-[10px] font-bold">
                    Kapsül / R-Köşeli Tambur Üretim Modeli
                  </span>
                )}
                {assemblyData.isCapsuleTable && (
                  <span className="px-2 py-0.5 rounded-full bg-sky-100 border border-sky-300 text-sky-950 text-[10px] font-bold">
                    Silindirik Sütunlu Kapsül Masa Modeli
                  </span>
                )}
              </div>
              <p className="text-[11px] text-[#57534E] truncate">
                {assemblyData.joineryLabel} • {assemblyData.modCutPieces.length} Kesim Parçası •{" "}
                {assemblyData.totalHoles} CNC Delik İşlemi
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-1.5 sm:gap-2 shrink-0">
            {mainModules.length > 1 && (
              <V3PremiumDropdown
                variant="popover"
                size="sm"
                className="w-full sm:w-[210px]"
                value={String(selectedModIdx)}
                onChange={(val) => {
                  setSelectedModIdx(Number(val));
                  setActiveStep(0);
                }}
                options={mainModules.map((m, idx) => ({
                  value: String(idx),
                  label: `#${idx + 1} ${m.name}`,
                  badge: `${m.dimensions.width}mm`,
                }))}
              />
            )}
            <button
              type="button"
              onClick={downloadSvgDiagram}
              className="px-3 py-1.5 rounded-xl birim-ice-btn text-xs font-bold flex items-center gap-1.5 cursor-pointer"
              title="Montaj Şemasını Vektörel SVG Olarak İndir"
            >
              <Download className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">.SVG</span>
            </button>
            <button
              type="button"
              data-testid="print-assembly-manual-btn"
              onClick={printAssemblySheet}
              className="px-3.5 py-1.5 rounded-xl birim-ice-charcoal-pill text-xs font-bold flex items-center gap-1.5 cursor-pointer"
            >
              <Printer className="w-3.5 h-3.5 text-amber-300" />
              <span className="hidden sm:inline">A4 Montaj Föyü Yazdır</span>
            </button>
          </div>
        </div>

        {/* Çoklu Modül (L / U Sistem) Ayrı Modül Montaj Şeması Sekme Çubuğu */}
        {mainModules.length > 1 && (
          <div
            data-testid="assembly-multi-module-tabs"
            className="px-5 py-2 border-b border-[#E5DFD3] bg-[#F4F0E8] flex items-center gap-1.5 overflow-x-auto shrink-0"
          >
            <span className="text-[10px] font-bold uppercase tracking-wider text-[#78716C] pr-1 shrink-0">
              Modüller ({mainModules.length}):
            </span>
            {mainModules.map((m, idx) => {
              const isSel = idx === Math.min(selectedModIdx, Math.max(0, mainModules.length - 1));
              const r = (((m.rotation?.y || 0) % 360) + 360) % 360;
              const wallTag = r < 45 || r > 315 ? "Ana" : r >= 45 && r < 135 ? "Sol" : r >= 225 && r <= 315 ? "Sağ" : "Karşı";
              return (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => {
                    setSelectedModIdx(idx);
                    setActiveStep(0);
                  }}
                  className={`h-8 px-3 rounded-xl text-[11px] font-bold transition cursor-pointer shrink-0 inline-flex items-center gap-1.5 border ${
                    isSel
                      ? "bg-[#141413] text-white border-[#141413] shadow-xs"
                      : "bg-white hover:bg-[#FAF8F4] text-[#44403C] border-[#DFD9CE]"
                  }`}
                >
                  <span className={`font-mono text-[10px] px-1.5 py-0.5 rounded-md ${isSel ? "bg-sky-500 text-white" : "bg-[#EFECE4] text-[#57534E]"}`}>
                    M{idx + 1}
                  </span>
                  <span className="max-w-[140px] truncate">{m.name}</span>
                  <span className={`text-[9.5px] font-mono ${isSel ? "text-slate-300" : "text-[#78716C]"}`}>
                    {m.dimensions.width}×{m.dimensions.height} • {wallTag}
                  </span>
                </button>
              );
            })}
          </div>
        )}

        {/* Body: Left Exploded Isometric CAD Diagram + Full-Height Hardware Bag | Right Step-by-Step Sequence */}
        <div className="flex-1 min-h-0 overflow-y-auto p-3 sm:p-5 grid grid-cols-1 lg:grid-cols-12 items-stretch gap-3 sm:gap-4 text-xs">
          {/* Left 7 cols: Interactive Exploded Isometric SVG + Full-Stretch Hardware Bag */}
          <div className="lg:col-span-7 flex flex-col gap-3.5 lg:h-full lg:min-h-0">
            <div className="shrink-0 p-3.5 rounded-2xl bg-white border border-[#E5DFD3] shadow-2xs flex flex-col items-center">
              <div className="w-full flex flex-wrap items-center justify-between gap-2 pb-2.5 border-b border-[#ECE7DC] mb-2">
                <span className="font-bold text-[#141413] flex items-center gap-1.5">
                  <Layers className="w-4 h-4 text-sky-700" />
                  <span>
                    {mod.name} — İzometrik Patlatılmış Parça Diyagramı ({assemblyData.W}×{assemblyData.H}×
                    {assemblyData.D} mm)
                  </span>
                </span>
                <div className="flex flex-wrap items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => setHideDoorsInDiagram((v) => !v)}
                    className={`px-2.5 py-1 rounded-full text-[10.5px] font-bold cursor-pointer transition ${
                      hideDoorsInDiagram
                        ? "bg-sky-700 text-white"
                        : "bg-[#EFECE4] hover:bg-[#E5E0D5] text-[#44403C]"
                    }`}
                  >
                    {hideDoorsInDiagram ? "Kapakları Göster" : "Kapakları Gizle"}
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowGrainArrows((v) => !v)}
                    className={`px-2.5 py-1 rounded-full text-[10.5px] font-bold cursor-pointer transition ${
                      showGrainArrows
                        ? "bg-amber-700 text-white"
                        : "bg-[#EFECE4] hover:bg-[#E5E0D5] text-[#44403C]"
                    }`}
                  >
                    Damar Okları
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveStep(0)}
                    className={`px-2.5 py-1 rounded-full text-[10.5px] font-bold cursor-pointer transition ${
                      activeStep === 0
                        ? "bg-[#141413] text-white"
                        : "bg-[#EFECE4] hover:bg-[#E5E0D5] text-[#44403C]"
                    }`}
                  >
                    Tüm Parçaları Göster
                  </button>
                </div>
              </div>

              <svg
                ref={svgRef}
                viewBox="0 0 920 520"
                className="w-full h-auto max-h-[470px] select-none"
              >
                <defs>
                  <marker
                    id="asm-arrow"
                    viewBox="0 0 10 10"
                    refX="7"
                    refY="5"
                    markerWidth="6"
                    markerHeight="6"
                    orient="auto-start-reverse"
                  >
                    <path d="M 0 1 L 10 5 L 0 9 z" fill="#0284c7" />
                  </marker>
                  <marker
                    id="grain-vein-arrow"
                    viewBox="0 0 10 10"
                    refX="8"
                    refY="5"
                    markerWidth="5.5"
                    markerHeight="5.5"
                    orient="auto"
                  >
                    <path d="M 0 1 L 10 5 L 0 9 z" fill="#b45309" />
                  </marker>
                  <marker
                    id="grain-flow-arrow"
                    viewBox="0 0 10 10"
                    refX="8"
                    refY="5"
                    markerWidth="5"
                    markerHeight="5"
                    orient="auto"
                  >
                    <path d="M 0 1 L 10 5 L 0 9 z" fill="#d97706" />
                  </marker>
                </defs>

                {/* Subtle Warm Architectural CAD Grid Backdrop */}
                <rect x="8" y="8" width="904" height="504" rx="16" fill="#FAF8F4" stroke="#E5DFD3" />

                {/* Dynamic 3D-to-2D Isometric Exploded Parts (Painter's Order) */}
                {isoScene.renderedBoxes.map((box) => {
                  if (hideDoorsInDiagram && box.code === "⑩") return null;
                  const active = isHighlighted(box.code);
                  const baseOpacity = box.code === "⑩" ? Math.min(box.opacity ?? 0.55, 0.48) : (box.opacity ?? 1);
                  return (
                    <g key={box.id} opacity={active ? baseOpacity : 0.16}>
                      {box.topPoly && (
                        <polygon
                          points={box.topPoly}
                          fill={box.topFill}
                          stroke={box.stroke}
                          strokeWidth={box.strokeWidth ?? 1.4}
                          strokeLinejoin="round"
                        />
                      )}
                      {box.rightPoly && (
                        <polygon
                          points={box.rightPoly}
                          fill={box.sideFill}
                          stroke={box.stroke}
                          strokeWidth={box.strokeWidth ?? 1.4}
                          strokeLinejoin="round"
                        />
                      )}
                      {box.frontPoly && (
                        <polygon
                          points={box.frontPoly}
                          fill={box.frontFill}
                          stroke={box.stroke}
                          strokeWidth={box.strokeWidth ?? 1.5}
                          strokeLinejoin="round"
                        />
                      )}
                      {box.trackGroovePoly && (
                        <polygon
                          points={box.trackGroovePoly}
                          fill="none"
                          stroke="#0369a1"
                          strokeWidth="1.35"
                          strokeDasharray="4 2.5"
                        />
                      )}
                      {box.slatLines.map((sl, sIdx) => (
                        <line
                          key={`slat-${sIdx}`}
                          x1={sl.x1}
                          y1={sl.y1}
                          x2={sl.x2}
                          y2={sl.y2}
                          stroke={sl.dashed ? "#7c2d12" : "#57534E"}
                          strokeWidth={sl.dashed ? "1" : "0.95"}
                          strokeDasharray={sl.dashed ? "3 2" : undefined}
                          opacity={0.78}
                        />
                      ))}
                      {box.grooveLine && (
                        <line
                          x1={box.grooveLine.x1}
                          y1={box.grooveLine.y1}
                          x2={box.grooveLine.x2}
                          y2={box.grooveLine.y2}
                          stroke="#7c2d12"
                          strokeWidth="1.2"
                          strokeDasharray="3 2"
                        />
                      )}
                      {box.sys32Pts.map((pt, idx) => (
                        <circle key={idx} cx={pt.cx} cy={pt.cy} r="1.7" fill="#0369a1" />
                      ))}
                      {box.hingeCups.map((cup, idx) => (
                        <circle
                          key={idx}
                          cx={cup.cx}
                          cy={cup.cy}
                          r="3.6"
                          fill="#f59e0b"
                          stroke="#78350f"
                          strokeWidth="1"
                        />
                      ))}
                      {box.handleLine && (
                        <line
                          x1={box.handleLine.x1}
                          y1={box.handleLine.y1}
                          x2={box.handleLine.x2}
                          y2={box.handleLine.y2}
                          stroke="#141413"
                          strokeWidth="2.8"
                          strokeLinecap="round"
                        />
                      )}
                      {showGrainArrows && box.grainBadgeOverlay && (
                        <g data-testid={`grain-seq-overlay-${box.id}`}>
                          <line
                            x1={box.grainBadgeOverlay.arrowFrom.x}
                            y1={box.grainBadgeOverlay.arrowFrom.y}
                            x2={box.grainBadgeOverlay.arrowTo.x}
                            y2={box.grainBadgeOverlay.arrowTo.y}
                            stroke="#b45309"
                            strokeWidth="1.8"
                            markerEnd="url(#grain-vein-arrow)"
                          />
                          <rect
                            x={box.grainBadgeOverlay.cx - 21}
                            y={box.grainBadgeOverlay.cy - 9}
                            width="42"
                            height="18"
                            rx="5"
                            fill="#78350f"
                            stroke="#fde68a"
                            strokeWidth="1.1"
                          />
                          <text
                            x={box.grainBadgeOverlay.cx}
                            y={box.grainBadgeOverlay.cy + 3.5}
                            textAnchor="middle"
                            fill="#fffbeb"
                            fontSize="9"
                            fontFamily="monospace"
                            fontWeight="900"
                          >
                            {box.grainBadgeOverlay.dirSymbol}
                            {box.grainBadgeOverlay.seqBadge}
                          </text>
                        </g>
                      )}
                    </g>
                  );
                })}

                {/* Continuous Wood-Grain Inter-Panel Sequence Flow Arrows */}
                {showGrainArrows && isoScene.grainFlowLinks.map((lnk) => (
                  <line
                    key={lnk.id}
                    x1={lnk.from.x}
                    y1={lnk.from.y}
                    x2={lnk.to.x}
                    y2={lnk.to.y}
                    stroke="#d97706"
                    strokeWidth="1.35"
                    strokeDasharray="3 2.5"
                    markerEnd="url(#grain-flow-arrow)"
                    opacity={activeStep === 0 || activeStep === 4 || activeStep === 5 ? 0.88 : 0.15}
                  />
                ))}

                {/* Exploded Assembly Direction Arrows */}
                {isoScene.arrows.map((arr, idx) => (
                  <line
                    key={`arrow-${idx}`}
                    x1={arr.from.x}
                    y1={arr.from.y}
                    x2={arr.to.x}
                    y2={arr.to.y}
                    stroke="#0284c7"
                    strokeWidth="1.3"
                    strokeDasharray="4 3"
                    markerEnd="url(#asm-arrow)"
                    opacity={isHighlighted(arr.code) ? 0.9 : 0.18}
                  />
                ))}

                {/* Zero-Overlap Outer Margin Callout Columns with Crisp Leader Lines */}
                {(() => {
                  const visibleCallouts = isoScene.callouts.filter(
                    (c) => !(hideDoorsInDiagram && c.code === "⑩")
                  );
                  const leftSide = visibleCallouts
                    .filter((c) => c.x <= 460)
                    .sort((a, b) => a.y - b.y);
                  const rightSide = visibleCallouts
                    .filter((c) => c.x > 460)
                    .sort((a, b) => a.y - b.y);

                  const distributeY = (items: typeof visibleCallouts) => {
                    const minGap = 42;
                    const topMin = 38;
                    const botMax = 482;
                    const ys = items.map((it) => Math.max(topMin, Math.min(botMax, it.y)));
                    for (let i = 1; i < ys.length; i++) {
                      if (ys[i] - ys[i - 1] < minGap) ys[i] = ys[i - 1] + minGap;
                    }
                    if (ys.length > 0 && ys[ys.length - 1] > botMax) {
                      const shift = ys[ys.length - 1] - botMax;
                      for (let i = 0; i < ys.length; i++) ys[i] -= shift;
                      for (let i = ys.length - 2; i >= 0; i--) {
                        if (ys[i + 1] - ys[i] < minGap) ys[i] = ys[i + 1] - minGap;
                      }
                    }
                    return ys;
                  };

                  const leftYs = distributeY(leftSide);
                  const rightYs = distributeY(rightSide);

                  const renderCol = (
                    items: typeof visibleCallouts,
                    ys: number[],
                    side: "left" | "right"
                  ) =>
                    items.map((c, idx) => {
                      const ly = ys[idx];
                      const ax = Math.max(190, Math.min(730, c.x));
                      const ay = Math.max(24, Math.min(496, c.y));
                      const pillW = 166;
                      const pillH = 26;
                      const pillX = side === "left" ? 18 : 920 - 18 - pillW;
                      const elbowX = side === "left" ? pillX + pillW + 14 : pillX - 14;
                      const edgeX = side === "left" ? pillX + pillW : pillX;
                      const active = isHighlighted(c.code);
                      return (
                        <g key={`callout-${c.num}`} opacity={active ? 1 : 0.22}>
                          <polyline
                            points={`${edgeX},${ly} ${elbowX},${ly} ${ax},${ay}`}
                            fill="none"
                            stroke="#475569"
                            strokeWidth="1.25"
                            strokeDasharray="3 2"
                          />
                          <circle cx={ax} cy={ay} r="3.4" fill="#0F172A" stroke="#FFFFFF" strokeWidth="1.2" />
                          <rect
                            x={pillX}
                            y={ly - pillH / 2}
                            width={pillW}
                            height={pillH}
                            rx="8"
                            fill="#FFFFFF"
                            stroke="#CBD5E1"
                            strokeWidth="1.1"
                          />
                          <circle cx={pillX + 14} cy={ly} r="9.5" fill="#141413" />
                          <text
                            x={pillX + 14}
                            y={ly + 3.4}
                            textAnchor="middle"
                            fill="#FFFFFF"
                            fontSize="9.5"
                            fontWeight="800"
                          >
                            {c.num}
                          </text>
                          <text
                            x={pillX + 29}
                            y={ly + 3.6}
                            fill="#0F172A"
                            fontSize="10.2"
                            fontWeight="700"
                          >
                            {c.label}
                          </text>
                        </g>
                      );
                    });

                  return (
                    <>
                      {renderCol(leftSide, leftYs, "left")}
                      {renderCol(rightSide, rightYs, "right")}
                    </>
                  );
                })()}
              </svg>
            </div>

            {/* Hardware & Fastener Bag Table — Stretches cleanly to bottom of modal! */}
            <div className="lg:flex-1 lg:min-h-[240px] p-3.5 sm:p-4 rounded-2xl bg-white border border-[#E5DFD3] shadow-2xs flex flex-col gap-2.5">
              <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-[#ECE7DC] shrink-0">
                <div className="font-bold text-[#141413] flex items-center gap-1.5">
                  <Wrench className="w-3.5 h-3.5 text-[#8C7A6B]" />
                  <span>Montaj Hırdavat &amp; Donanım Paketi Kontrol Listesi</span>
                </div>
                <span className="px-2.5 py-0.5 rounded-full bg-[#F5F2EA] border border-[#E5DFD3] text-[10.5px] font-mono font-bold text-[#44403C]">
                  {hardwareItems.length} Kalem • {totalHardwareQty} Adet/Birim
                </span>
              </div>
              <div className="lg:flex-1 lg:min-h-0 lg:overflow-y-auto pr-1 grid grid-cols-1 sm:grid-cols-2 auto-rows-max content-start gap-2">
                {hardwareItems.map((hw) => (
                  <div
                    key={hw.sku}
                    className="px-3 py-2 rounded-xl bg-[#FAF8F4] border border-[#E5DFD3] hover:border-[#C7BCAE] transition flex items-center justify-between gap-2"
                  >
                    <div className="min-w-0">
                      <div className="font-semibold text-[#141413] truncate text-[11px]" title={hw.name}>
                        {hw.name}
                      </div>
                      <div className="font-mono text-[9.5px] text-[#78716C]">{hw.sku}</div>
                    </div>
                    <span className="px-2 py-0.5 rounded-lg bg-[#141413] text-white font-mono font-bold text-[10.5px] shrink-0">
                      {hw.quantity} {hw.unit}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Right 5 cols: Interactive 6-Step Sequence + Canonical Safety Notes + Cartonization */}
          <div className="lg:col-span-5 flex flex-col gap-2.5 h-full">
            {!engReport.canExportToCncAndSaw && (
              <div
                data-testid="assembly-engineering-gate-alert"
                className="p-3 rounded-2xl bg-red-50 border border-red-300 text-red-950 text-[11px] space-y-1"
              >
                <div className="font-bold text-red-800">
                  Üretim &amp; Montaj Uyarısı ({engReport.blockingSafetyAndEngineeringErrors.length} Kritik Mühendislik Bulgusu)
                </div>
                <p className="leading-relaxed text-red-900">
                  {engReport.blockingSafetyAndEngineeringErrors[0]?.message}
                </p>
              </div>
            )}
            {canonicalFactorySteps
              .filter((cs) => cs.safetyWarning)
              .map((cs) => (
                <div
                  key={`canon-safe-${cs.stepNumber}`}
                  className="p-3 rounded-2xl bg-amber-50 border border-amber-300 text-amber-950 text-[11px]"
                >
                  <div className="font-bold text-amber-900">{cs.title}</div>
                  <div className="mt-0.5 leading-snug text-amber-900/90">{cs.safetyWarning}</div>
                </div>
              ))}
            {moduleGrainSequenceList.length > 0 && (
              <div
                data-testid="assembly-grain-sequence-card"
                className="p-3 rounded-2xl bg-amber-50/95 border border-amber-300 text-[#141413] space-y-1.5"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-bold text-xs text-amber-950">
                    Desen Takibi Cephe Montaj Dizilimi ({moduleGrainSequenceList.length} Parça)
                  </span>
                  <span className="px-2 py-0.5 rounded-md bg-amber-900 text-amber-50 font-mono text-[10px] font-bold">
                    {moduleGrainSequenceList[0].directionLabelTr}
                  </span>
                </div>
                <div className="space-y-1 max-h-36 overflow-y-auto pr-1">
                  {moduleGrainSequenceList.map((g) => (
                    <div
                      key={g.componentId}
                      className="px-2 py-1 rounded-lg bg-white border border-amber-200 flex items-center justify-between gap-2 text-[10.5px]"
                    >
                      <span className="font-semibold text-slate-900">
                        <span className="font-mono font-black text-amber-900 mr-1">
                          {g.arrowSymbol} {g.shortSeqBadge}
                        </span>
                        {g.partShortLabel}
                      </span>
                      <span className="font-mono text-[9.5px] text-amber-900 shrink-0">
                        {g.compactNeighborTextTr}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
            <div className="text-[11px] font-bold uppercase tracking-wider text-[#57534E] px-1">
              Adım Adım Kurulum Sırası (Diyagramda Vurgulamak İçin Adıma Tıklayın)
            </div>
            <div className="space-y-2">
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
                        : "bg-white hover:bg-[#FAF8F4] text-[#141413] border-[#E5DFD3]"
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
                        selected ? "text-slate-200" : "text-[#57534E]"
                      }`}
                    >
                      {st.detail}
                    </p>
                  </button>
                );
              })}
            </div>

            {/* V5 Flat-Pack Cartonization & Carrier Manifest */}
            {bom &&
              (() => {
                const manifest = computeProjectCartonization(project, bom);
                return (
                  <div className="p-3.5 rounded-2xl bg-white border border-[#E5DFD3] space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <div>
                        <div className="font-bold text-xs text-[#141413]">
                          Sevkiyat &amp; Koli Optimizasyonu ({manifest.totalCartons} Koli •{" "}
                          {manifest.totalGrossWeightKg} kg)
                        </div>
                        <div className="text-[10px] text-[#78716C]">
                          Maks. 28 kg tek kişi ergonomik paket sınırı + petek köşe koruyucu hesabı
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          const csv = exportCartonManifestCsv(manifest);
                          const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
                          const url = URL.createObjectURL(blob);
                          const a = document.createElement("a");
                          a.href = url;
                          a.download = `${project.title.replace(/[^a-zA-Z0-9_-]/g, "_")}_Koli_Sevkiyat_Listesi.csv`;
                          document.body.appendChild(a);
                          a.click();
                          setTimeout(() => {
                            if (a.parentNode) a.parentNode.removeChild(a);
                            URL.revokeObjectURL(url);
                          }, 500);
                        }}
                        className="px-2.5 py-1 rounded-lg bg-[#141413] text-white text-[10.5px] font-bold cursor-pointer"
                      >
                        Koli .CSV İndir
                      </button>
                    </div>
                    <div className="max-h-36 overflow-y-auto space-y-1 pr-1">
                      {manifest.cartons.map((c) => (
                        <div
                          key={c.cartonCode}
                          className="px-2.5 py-1.5 rounded-xl bg-[#FAF8F4] border border-[#E5DFD3] flex items-center justify-between text-[10.5px]"
                        >
                          <div className="min-w-0">
                            <span className="font-mono font-bold text-[#141413]">{c.cartonCode}</span>{" "}
                            <span className="text-[#57534E]">• {c.moduleName}</span>
                          </div>
                          <span className="font-mono font-semibold text-[#44403C] shrink-0">
                            {c.outerLengthMm}×{c.outerWidthMm}mm • {c.grossWeightKg}kg
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })()}

            <div className="mt-auto p-3 rounded-2xl bg-emerald-50 border border-emerald-300 text-emerald-950 text-[11px] flex items-start gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0 mt-0.5" />
              <span>
                {assemblyData.isCapsuleTambour
                  ? "Alt/üst tablalardaki 8.5×7.5 mm CNC tambur ray olukları (TAMBOUR_TRACK_W8_5_Z7_5), 32 mm kavisli kerf cep koridorları ve lamel açınımları CNC kesim paketiyle birebir senkronizedir."
                  : assemblyData.isCapsuleTable
                  ? "Silindirik kerf sütun açınımları, iç dairesel CNC kalıp diskleri, çelik sarkma traversi ve 5-eksen Swiss-Edge kapsül tabla koordinatları CNC kesim paketiyle birebir senkronizedir."
                  : "Tüm gövde kavela/minifiks eksenleri, 8 mm arkalık ve çekmece taban kanalları (LW − 30 mm) ile kapak/tambur ray koordinatları CNC kesim paketiyle birebir senkronizedir."}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
