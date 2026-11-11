"use client";

import React, { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

export type BirimTooltipPlacement = "auto" | "top" | "bottom" | "left" | "right";

export type BirimTooltipVisualId =
  | "view_3d"
  | "view_elevation"
  | "view_section"
  | "view_plan"
  | "view_split"
  | "view_xray"
  | "mode_studio"
  | "mode_plan"
  | "mode_showroom"
  | "tool_wizard"
  | "tool_assembly"
  | "tool_render"
  | "tool_bom"
  | "tool_hardware"
  | "tool_island_table"
  | "tool_angled_wall"
  | "tool_interior_props"
  | "door_flat_slab"
  | "door_shaker"
  | "door_fluted"
  | "door_bevel_45"
  | "door_glass"
  | "door_mirror";

export interface BirimTooltipProps {
  /** Ana başlık metni */
  content: string;
  /** Üst kategori etiketi (örn. "CAD GÖRÜNÜM", "ÜRETİM & CNC") */
  badge?: string;
  /** Açıklayıcı alt metin */
  description?: string;
  /** Klavye kısayolu rozeti (örn. "Ctrl+Z", "R") */
  shortcut?: string;
  /** Hazır mimari SVG mikro-diyagram kimliği */
  visual?: BirimTooltipVisualId;
  /** Özel görsel / doku URL'i veya CSS arkaplanı */
  imageSrc?: string;
  /** Açılış yönü (varsayılan: "auto") */
  placement?: BirimTooltipPlacement;
  children: React.ReactNode;
  className?: string;
  disabled?: boolean;
}

interface RichPresetEntry {
  badge: string;
  label?: string;
  description: string;
  shortcut?: string;
  visual?: BirimTooltipVisualId;
}

const BIRIM_RICH_TOOLTIP_PRESETS: Record<string, RichPresetEntry> = {
  "studio-tab-modules": {
    badge: "SOL KÜTÜPHANE",
    label: "Modül & Gövde Şablonları",
    description: "Gardırop, mutfak alt/üst, boy kiler ve köşe modül şablonlarını sahneye ekler veya değiştirir.",
    visual: "mode_studio",
  },
  "studio-tab-interior": {
    badge: "İÇ MİMARİ",
    label: "İç Düzen & Bölme Tasarımı",
    description: "Raf, frenli çekmece, askı borusu, pantolonluk ve dikey ara bölme ekleme/düzenleme paneli.",
    visual: "view_section",
  },
  "studio-tab-materials": {
    badge: "PBR KÜTÜPHANESİ",
    label: "Malzeme, Ahşap Damar & Doku Paleti",
    description: "7 fiziksel PBR sınıfında (ahşap, ipek mat lake, keten, füme cam, ayna, kuvars, metal) yüzey ataması.",
    visual: "door_fluted",
  },
  "studio-tab-hardware": {
    badge: "ENDÜSTRİYEL DONANIM",
    label: "Blum, Hettich & Häfele Donanımlar",
    description: "Menteşe açısı, çekmece ray sistemi, kalkar/sürgü kapak mekanizması ve gömme Loox5 LED seçimi.",
    visual: "tool_hardware",
  },
  "viewport-3d-pill-props": {
    badge: "SAHNE DETAYI",
    label: "İç Eşyaları (Giysi, Kutu, Ayakkabı) Göster / Gizle",
    description: "Askıdaki ceket/gömlek, deri kayışlı düzenleyici kutular ve ayakkabı modellerini açar veya gizler.",
    visual: "tool_interior_props",
  },
  "viewport-3d-section-toggle-btn": {
    badge: "CANLI KESİT",
    label: "2-Yönlü Canlı 3D Dolap Kesiti (X / Z)",
    description: "Dolabı X veya Z ekseninde canlı keserek iç birleşim ve çekmece derinliklerini 3D sahnede inceler.",
    visual: "view_section",
  },
  "viewport-3d-edge-mode-toggle": {
    badge: "STÜDYO & IŞIK",
    label: "Stüdyo Işığı, Zemin & 2K Fotoğraf Render",
    description: "Gün ışığı / 3000K / Gece LED modları, parke-mermer zemin seçimi ve Path-Tracing render stüdyosu.",
    visual: "tool_render",
  },
  "v3-mode-studio": {
    badge: "TASARIM MODU",
    label: "3D Parametrik Stüdyo",
    description:
      "Gerçek zamanlı PBR malzemeler, iç donanım sürükleme, kapak açılım simülasyonu ve canlı ışıklandırma sahnesi.",
    visual: "mode_studio",
  },
  "v3-mode-plan": {
    badge: "MEKÂN & MİMARİ",
    label: "2D Mekân & Kat Planı",
    description:
      "Serbest/açılı duvar çizimi, kapı-pencere yerleşimi, mıknatıslı modül dizilimi ve duvara paralel otomatik hizalama.",
    visual: "mode_plan",
  },
  "v3-mode-showroom": {
    badge: "MÜŞTERİ SUNUMU",
    label: "Tam Ekran Sunum Stüdyosu",
    description:
      "Teknik araçları gizleyerek müşteriye temiz sahne, malzeme alternatifleri ve anlık fiyat özeti sunar.",
    visual: "mode_showroom",
  },
  "studio-view-3d": {
    badge: "SAHNE GÖRÜNÜMÜ",
    label: "3D Perspektif Sahne",
    description:
      "Fiziksel tabanlı ahşap damar yönü, füme cam iç gölgeleri ve etkileşimli modül/raf taşıma görünümü.",
    shortcut: "1",
    visual: "view_3d",
  },
  "studio-view-2d": {
    badge: "TEKNİK ÇİZİM",
    label: "2D Ön Cephe Görünüşü",
    description:
      "Otomatik dış ve iç zincir ölçülendirme, kapak açılış yönü üçgenleri ve kot yüksekliği kontrolü.",
    shortcut: "2",
    visual: "view_elevation",
  },
  "studio-view-2d-section": {
    badge: "KESİT ANALİZİ",
    label: "2D A-A / B-B Teknik Kesit",
    description:
      "18mm gövde birleşimleri, 8mm kanal arkalık, 16mm çekmece arkalığı, baza detayı ve raf aralıklarını kesitte inceler.",
    shortcut: "3",
    visual: "view_section",
  },
  "studio-view-2d-plan": {
    badge: "ÜSTTEN KESİT",
    label: "2D Üstten Kat Planı",
    description:
      "0°–360° tüm açılarda 90° kapak tarama yayları, koridor geçiş mesafesi ve modül derinlik kontrolü.",
    shortcut: "4",
    visual: "view_plan",
  },
  "studio-view-split": {
    badge: "ÇİFT EKRAN",
    label: "Bölünmüş 3D + 2D CAD Ekranı",
    description:
      "Sol tarafta canlı 3D sahneyi, sağ tarafta ölçülü teknik kesit veya cephe çizimini eşzamanlı çalıştırır.",
    visual: "view_split",
  },
  "studio-view-split-btn": {
    badge: "ÇİFT EKRAN",
    label: "Bölünmüş 3D + 2D CAD Ekranı",
    description:
      "Sol tarafta canlı 3D sahneyi, sağ tarafta ölçülü teknik kesit veya cephe çizimini eşzamanlı çalıştırır.",
    visual: "view_split",
  },
  "studio-toggle-xray": {
    badge: "ÜRETİM KONTROLÜ",
    label: "CNC Delik & Bağlantı X-Ray Modu",
    description:
      "Panelleri yarı saydamlaştırarak Minifix eksantrik, Ø8mm kavela, 32mm raf pimi ve menteşe tas deliklerini gösterir.",
    visual: "view_xray",
  },
  "studio-cnc-xray-btn": {
    badge: "ÜRETİM KONTROLÜ",
    label: "CNC Delik & Bağlantı X-Ray Modu",
    description:
      "Panelleri yarı saydamlaştırarak Minifix eksantrik, Ø8mm kavela, 32mm raf pimi ve menteşe tas deliklerini gösterir.",
    visual: "view_xray",
  },
  "open-step-wizard-btn": {
    badge: "HIZLI KURULUM",
    label: "4 Adımda Akıllı Kurulum Sihirbazı",
    description:
      "Oda ölçüsü, dolap tipi, iç düzen ve malzeme paletini canlı önizlemeyle dakikalar içinde oluşturur.",
    visual: "tool_wizard",
  },
  "open-assembly-diagram-header-btn": {
    badge: "KURULUM KILAVUZU",
    label: "Patlatılmış İzometrik Montaj Şeması",
    description:
      "Seçili dolap için numaralı parça balonları (①–⑩), 6 adımlı montaj sırası, hırdavat poşeti ve A4/SVG çıktı üretir.",
    visual: "tool_assembly",
  },
  "open-studio-render-header-btn": {
    badge: "FOTOGERÇEKÇİ ÇIKTI",
    label: "2K Stüdyo Render & GPU Path-Tracing",
    description:
      "Mevcut çok-örnekli 2K PBR sahnesi ile Monte Carlo küresel aydınlatmalı Path-Tracing çıktısını yan yana kıyaslar.",
    visual: "tool_render",
  },
  "open-bom-modal-btn": {
    badge: "ÜRETİM & ERP",
    label: "BOM Malzeme Listesi & CNC Kesim Şeması",
    description:
      "2800×2070mm plaka optimizasyonu (nesting), PVC kenar bandı metrajı, CNC delik koordinatları ve maliyet dökümü.",
    visual: "tool_bom",
  },
  "plan-snap-module-parallel-wall-btn": {
    badge: "AKILLI HİZALAMA",
    label: "Dolabı Açılı Duvara Paralel Yasla",
    description:
      "Seçili dolabı 30°, 45°, 135° veya serbest çizilmiş en yakın duvara paralel döndürür ve sırtını 0.0mm boşlukla öpüştürür.",
    visual: "tool_angled_wall",
  },
  "plan-add-45deg-wall-btn": {
    badge: "MİMARİ DUVAR",
    label: "+45° Açılı Duvar Segmenti Ekle",
    description:
      "Mevcut duvar ucuna 45° kırmalı yeni duvar ekler; dolapları yaklaştırdığınızda otomatik paralel mıknatıslanır.",
    visual: "tool_angled_wall",
  },
  "toggle-interior-props-btn": {
    badge: "SAHNE DETAYI",
    label: "İç Eşyaları (Giysi, Kutu, Ayakkabı) Göster / Gizle",
    description:
      "Askıdaki ceket/gömlek, deri kayışlı düzenleyici kutular ve ayakkabı modellerini tek tıkla açar veya sadeleştirir.",
    visual: "tool_interior_props",
  },
  "open-custom-hardware-btn": {
    badge: "DONANIM KÜTÜPHANESİ",
    label: "Yeni Kulp & Özel Donanım Tanımla",
    description:
      "Özel kulp boyu, C-C iki vida deliği aks mesafesi (CNC Ø5mm otomatik delik), kaplama ve birim EUR fiyatı ekler.",
    visual: "tool_hardware",
  },
  "open-island-table-btn": {
    badge: "MUTFAK MİMARİSİ",
    label: "Şelale Ada Mutfak & Çok Açılı Masa Stüdyosu",
    description:
      "40mm taş şelale yan panelli ada mutfak kurar; adaya veya tezgâha 0°, 30°, 45°, 90° açıyla yemek/bar masası bağlar.",
    visual: "tool_island_table",
  },
};

function renderVisualDiagram(visual: BirimTooltipVisualId): React.ReactNode {
  switch (visual) {
    case "view_3d":
    case "mode_studio":
      return (
        <svg viewBox="0 0 88 54" className="w-full h-full">
          <defs>
            <linearGradient id="tt3dA" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#E5D3B8" />
              <stop offset="100%" stopColor="#B08D63" />
            </linearGradient>
          </defs>
          <polygon points="44,6 74,18 74,44 44,50" fill="url(#tt3dA)" opacity="0.92" />
          <polygon points="44,6 16,18 16,44 44,50" fill="#8C6D46" />
          <polygon points="44,6 74,18 44,28 16,18" fill="#F3E5D0" />
          <line x1="59" y1="12" x2="59" y2="47" stroke="#1E293B" strokeWidth="1.2" opacity="0.65" />
          <line x1="56" y1="26" x2="56" y2="33" stroke="#0F172A" strokeWidth="1.8" strokeLinecap="round" />
          <line x1="62" y1="25" x2="62" y2="32" stroke="#0F172A" strokeWidth="1.8" strokeLinecap="round" />
        </svg>
      );
    case "view_elevation":
      return (
        <svg viewBox="0 0 88 54" className="w-full h-full">
          <rect x="20" y="9" width="48" height="34" rx="1.5" fill="none" stroke="#93C5FD" strokeWidth="1.5" />
          <line x1="44" y1="9" x2="44" y2="43" stroke="#93C5FD" strokeWidth="1.2" />
          <polyline points="20,9 44,26 20,43" fill="none" stroke="#FBBF24" strokeWidth="1" strokeDasharray="2 2" />
          <polyline points="68,9 44,26 68,43" fill="none" stroke="#FBBF24" strokeWidth="1" strokeDasharray="2 2" />
          <line x1="20" y1="49" x2="68" y2="49" stroke="#38BDF8" strokeWidth="1.1" />
          <line x1="20" y1="46.5" x2="20" y2="51.5" stroke="#38BDF8" strokeWidth="1.1" />
          <line x1="68" y1="46.5" x2="68" y2="51.5" stroke="#38BDF8" strokeWidth="1.1" />
        </svg>
      );
    case "view_section":
      return (
        <svg viewBox="0 0 88 54" className="w-full h-full">
          <rect x="24" y="7" width="38" height="38" fill="rgba(148,163,184,0.12)" stroke="#E2E8F0" strokeWidth="1.6" />
          <line x1="27" y1="9" x2="27" y2="43" stroke="#F59E0B" strokeWidth="1.4" />
          <line x1="28" y1="19" x2="59" y2="19" stroke="#93C5FD" strokeWidth="1.6" />
          <line x1="28" y1="28" x2="59" y2="28" stroke="#93C5FD" strokeWidth="1.6" />
          <rect x="30" y="33" width="29" height="8" fill="rgba(56,189,248,0.18)" stroke="#38BDF8" strokeWidth="1.2" />
          <rect x="30" y="33" width="3" height="8" fill="#FBBF24" />
          <rect x="28" y="45" width="31" height="4" fill="none" stroke="#94A3B8" strokeWidth="1.2" />
        </svg>
      );
    case "view_plan":
    case "mode_plan":
      return (
        <svg viewBox="0 0 88 54" className="w-full h-full">
          <line x1="10" y1="12" x2="56" y2="12" stroke="#CBD5E1" strokeWidth="3.2" strokeLinecap="round" />
          <line x1="56" y1="12" x2="78" y2="30" stroke="#F59E0B" strokeWidth="3.2" strokeLinecap="round" />
          <rect x="16" y="14" width="34" height="14" rx="1.5" fill="rgba(59,130,246,0.22)" stroke="#60A5FA" strokeWidth="1.3" />
          <path d="M 16 28 L 16 44 A 16 16 0 0 0 32 28 Z" fill="rgba(251,191,36,0.20)" stroke="#FBBF24" strokeWidth="1.1" strokeDasharray="2 1.5" />
          <path d="M 50 28 L 50 44 A 16 16 0 0 1 34 28 Z" fill="rgba(251,191,36,0.20)" stroke="#FBBF24" strokeWidth="1.1" strokeDasharray="2 1.5" />
        </svg>
      );
    case "view_split":
      return (
        <svg viewBox="0 0 88 54" className="w-full h-full">
          <rect x="10" y="8" width="68" height="38" rx="4" fill="rgba(15,23,42,0.5)" stroke="#94A3B8" strokeWidth="1.2" />
          <line x1="44" y1="8" x2="44" y2="46" stroke="#38BDF8" strokeWidth="1.8" />
          <polygon points="27,16 37,21 37,35 27,39 17,35 17,21" fill="rgba(229,211,184,0.75)" />
          <rect x="51" y="15" width="20" height="24" fill="none" stroke="#93C5FD" strokeWidth="1.3" />
          <line x1="51" y1="24" x2="71" y2="24" stroke="#93C5FD" strokeWidth="1" />
          <line x1="51" y1="32" x2="71" y2="32" stroke="#38BDF8" strokeWidth="1" />
        </svg>
      );
    case "view_xray":
      return (
        <svg viewBox="0 0 88 54" className="w-full h-full">
          <rect x="18" y="8" width="52" height="38" rx="2" fill="rgba(34,211,238,0.08)" stroke="#22D3EE" strokeWidth="1.2" strokeDasharray="3 2" />
          <line x1="22" y1="24" x2="66" y2="24" stroke="#22D3EE" strokeWidth="1.1" />
          {[15, 21, 27, 33, 39].map((yy) => (
            <circle key={yy} cx="24" cy={yy} r="1.4" fill="#FBBF24" />
          ))}
          {[15, 21, 27, 33, 39].map((yy) => (
            <circle key={`r${yy}`} cx="64" cy={yy} r="1.4" fill="#FBBF24" />
          ))}
          <circle cx="24" cy="11" r="2.3" fill="none" stroke="#F43F5E" strokeWidth="1.3" />
          <circle cx="64" cy="11" r="2.3" fill="none" stroke="#F43F5E" strokeWidth="1.3" />
        </svg>
      );
    case "tool_assembly":
      return (
        <svg viewBox="0 0 88 54" className="w-full h-full">
          <polygon points="44,9 64,15 44,21 24,15" fill="rgba(226,232,240,0.75)" stroke="#94A3B8" strokeWidth="1" />
          <polygon points="20,19 26,22 26,41 20,38" fill="rgba(147,197,253,0.65)" stroke="#60A5FA" strokeWidth="1" />
          <polygon points="62,22 68,19 68,38 62,41" fill="rgba(147,197,253,0.65)" stroke="#60A5FA" strokeWidth="1" />
          <polygon points="44,35 64,41 44,47 24,41" fill="rgba(226,232,240,0.75)" stroke="#94A3B8" strokeWidth="1" />
          <line x1="44" y1="21" x2="44" y2="35" stroke="#FBBF24" strokeWidth="1.1" strokeDasharray="2 2" />
          <circle cx="14" cy="14" r="5" fill="#F59E0B" />
          <text x="14" y="16.5" textAnchor="middle" fontSize="6.5" fontWeight="800" fill="#0F172A">1</text>
          <circle cx="75" cy="39" r="5" fill="#38BDF8" />
          <text x="75" y="41.5" textAnchor="middle" fontSize="6.5" fontWeight="800" fill="#0F172A">2</text>
        </svg>
      );
    case "tool_render":
    case "mode_showroom":
      return (
        <svg viewBox="0 0 88 54" className="w-full h-full">
          <defs>
            <linearGradient id="ttRndL" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#334155" />
              <stop offset="100%" stopColor="#0F172A" />
            </linearGradient>
            <linearGradient id="ttRndR" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#FDE68A" stopOpacity="0.45" />
              <stop offset="100%" stopColor="#B45309" stopOpacity="0.65" />
            </linearGradient>
          </defs>
          <rect x="8" y="7" width="36" height="40" rx="3" fill="url(#ttRndL)" />
          <rect x="44" y="7" width="36" height="40" rx="3" fill="url(#ttRndR)" />
          <rect x="24" y="15" width="40" height="25" rx="2" fill="rgba(229,211,184,0.85)" stroke="#FFF" strokeWidth="0.9" />
          <line x1="44" y1="5" x2="44" y2="49" stroke="#FBBF24" strokeWidth="1.8" />
          <circle cx="44" cy="27" r="4.5" fill="#FBBF24" />
        </svg>
      );
    case "tool_island_table":
      return (
        <svg viewBox="0 0 88 54" className="w-full h-full">
          <rect x="12" y="16" width="36" height="18" rx="2" fill="rgba(226,232,240,0.85)" stroke="#94A3B8" strokeWidth="1.2" />
          <g transform="translate(46, 25) rotate(32)">
            <rect x="0" y="-6" width="30" height="12" rx="1.5" fill="rgba(217,179,130,0.9)" stroke="#F59E0B" strokeWidth="1.2" />
          </g>
          <path d="M 52 25 A 10 10 0 0 1 50 31" fill="none" stroke="#38BDF8" strokeWidth="1.3" />
          <text x="64" y="17" fontSize="7" fontWeight="800" fill="#38BDF8">45°</text>
        </svg>
      );
    case "tool_angled_wall":
      return (
        <svg viewBox="0 0 88 54" className="w-full h-full">
          <line x1="10" y1="14" x2="46" y2="14" stroke="#94A3B8" strokeWidth="3.5" strokeLinecap="round" />
          <line x1="46" y1="14" x2="78" y2="40" stroke="#F59E0B" strokeWidth="3.5" strokeLinecap="round" />
          <g transform="translate(52, 21) rotate(39)">
            <rect x="0" y="0" width="24" height="11" rx="1.5" fill="rgba(56,189,248,0.32)" stroke="#38BDF8" strokeWidth="1.4" />
          </g>
        </svg>
      );
    case "tool_hardware":
      return (
        <svg viewBox="0 0 88 54" className="w-full h-full">
          <line x1="20" y1="22" x2="68" y2="22" stroke="#E5D3B8" strokeWidth="4" strokeLinecap="round" />
          <rect x="26" y="22" width="4" height="9" fill="#C4A47C" />
          <rect x="58" y="22" width="4" height="9" fill="#C4A47C" />
          <circle cx="28" cy="35" r="2.2" fill="#38BDF8" />
          <circle cx="60" cy="35" r="2.2" fill="#38BDF8" />
          <line x1="28" y1="43" x2="60" y2="43" stroke="#38BDF8" strokeWidth="1.1" strokeDasharray="2 1.5" />
          <text x="44" y="50" textAnchor="middle" fontSize="6.5" fontWeight="700" fill="#93C5FD">C-C 160mm</text>
        </svg>
      );
    case "tool_bom":
      return (
        <svg viewBox="0 0 88 54" className="w-full h-full">
          <rect x="12" y="9" width="64" height="36" rx="2" fill="rgba(30,41,59,0.8)" stroke="#94A3B8" strokeWidth="1.2" />
          <rect x="15" y="12" width="26" height="19" fill="rgba(56,189,248,0.32)" stroke="#38BDF8" strokeWidth="1" />
          <rect x="43" y="12" width="18" height="30" fill="rgba(251,191,36,0.28)" stroke="#FBBF24" strokeWidth="1" />
          <rect x="15" y="33" width="26" height="9" fill="rgba(52,211,153,0.28)" stroke="#34D399" strokeWidth="1" />
          <rect x="63" y="12" width="10" height="30" fill="rgba(148,163,184,0.2)" stroke="#64748B" strokeWidth="0.9" strokeDasharray="2 2" />
        </svg>
      );
    case "tool_interior_props":
      return (
        <svg viewBox="0 0 88 54" className="w-full h-full">
          <line x1="14" y1="12" x2="74" y2="12" stroke="#CBD5E1" strokeWidth="2" />
          <path d="M30,12 Q30,16 23,19 L21,38 L39,38 L37,19 Q30,16 30,12 Z" fill="rgba(148,163,184,0.75)" stroke="#E2E8F0" strokeWidth="1" />
          <rect x="47" y="24" width="21" height="14" rx="2" fill="rgba(214,197,173,0.82)" stroke="#FDE68A" strokeWidth="1" />
          <line x1="57.5" y1="24" x2="57.5" y2="38" stroke="#78350F" strokeWidth="2" />
        </svg>
      );
    case "door_fluted":
      return (
        <svg viewBox="0 0 88 54" className="w-full h-full">
          <rect x="14" y="10" width="60" height="34" rx="2" fill="#8C6D46" stroke="#E5D3B8" strokeWidth="1" />
          {[20, 26, 32, 38, 44, 50, 56, 62, 68].map((xx) => (
            <line key={xx} x1={xx} y1="11" x2={xx} y2="43" stroke="#452B14" strokeWidth="2.1" />
          ))}
        </svg>
      );
    case "door_shaker":
      return (
        <svg viewBox="0 0 88 54" className="w-full h-full">
          <rect x="16" y="8" width="56" height="38" rx="2" fill="#D6CFC2" stroke="#F8FAFC" strokeWidth="1.2" />
          <rect x="24" y="15" width="40" height="24" fill="#B8B0A2" stroke="#64748B" strokeWidth="1" />
        </svg>
      );
    case "door_bevel_45":
      return (
        <svg viewBox="0 0 88 54" className="w-full h-full">
          <polygon points="18,38 56,38 68,20 18,20" fill="#CBD5E1" stroke="#38BDF8" strokeWidth="1.3" />
          <path d="M 56 38 A 12 12 0 0 0 63 28" fill="none" stroke="#FBBF24" strokeWidth="1.2" />
          <text x="68" y="36" fontSize="7" fontWeight="800" fill="#FBBF24">45°</text>
        </svg>
      );
    default:
      return (
        <svg viewBox="0 0 88 54" className="w-full h-full">
          <rect x="16" y="10" width="56" height="34" rx="4" fill="rgba(56,189,248,0.16)" stroke="#38BDF8" strokeWidth="1.3" />
          <circle cx="44" cy="27" r="7" fill="rgba(251,191,36,0.35)" stroke="#FBBF24" strokeWidth="1.3" />
        </svg>
      );
  }
}

export const BirimTooltip: React.FC<BirimTooltipProps> = ({
  content,
  badge,
  description,
  shortcut,
  visual,
  imageSrc,
  placement = "auto",
  children,
  className,
  disabled = false,
}) => {
  if (disabled || !content) {
    return <>{children}</>;
  }

  const dataAttrs: Record<string, string | undefined> = {
    "data-tooltip": content,
    ...(badge ? { "data-tooltip-badge": badge } : {}),
    ...(description ? { "data-tooltip-desc": description } : {}),
    ...(shortcut ? { "data-tooltip-shortcut": shortcut } : {}),
    ...(visual ? { "data-tooltip-visual": visual } : {}),
    ...(imageSrc ? { "data-tooltip-image": imageSrc } : {}),
    ...(placement && placement !== "auto" ? { "data-tooltip-placement": placement } : {}),
  };

  if (React.isValidElement<Record<string, unknown>>(children)) {
    return React.cloneElement(children, dataAttrs);
  }

  return (
    <span className={`inline-flex items-center ${className || ""}`} {...dataAttrs}>
      {children}
    </span>
  );
};

interface ParsedTooltipPayload {
  badge?: string;
  label: string;
  description?: string;
  shortcut?: string;
  visual?: BirimTooltipVisualId;
  imageSrc?: string;
  swatchBgColor?: string;
  swatchBgImage?: string;
  placement: Exclude<BirimTooltipPlacement, "auto">;
  anchorRect: DOMRect;
}

let activePortalCount = 0;

function inferRichMetadataFromAnchor(
  anchor: HTMLElement,
  rawText: string
): Partial<ParsedTooltipPayload> {
  const testId = anchor.getAttribute("data-testid") || "";
  if (testId && BIRIM_RICH_TOOLTIP_PRESETS[testId]) {
    return BIRIM_RICH_TOOLTIP_PRESETS[testId];
  }

  const lower = rawText.toLowerCase();
  if (lower.includes("derzli") || lower.includes("fluted") || lower.includes("çıtalı")) {
    return {
      badge: "KAPAK PROFİLİ",
      description: "Dikey CNC derz/çıta frezelemeli mimari yüzey; InstancedMesh ile yüksek FPS.",
      visual: "door_fluted",
    };
  }
  if (lower.includes("shaker")) {
    return {
      badge: "KAPAK PROFİLİ",
      description: "68mm masif çerçeve kayıtlı ve çökertme göbekli klasik-modern kapak kesiti.",
      visual: "door_shaker",
    };
  }
  if (lower.includes("45° pah") || lower.includes("bevel")) {
    return {
      badge: "KAPAK PROFİLİ",
      description: "Üst cumbası 45° açılı kulpsuz tutamak pahı; gerçek milimetre ölçekli kesit.",
      visual: "door_bevel_45",
    };
  }
  if (lower.includes("montaj şeması")) {
    return BIRIM_RICH_TOOLTIP_PRESETS["open-assembly-diagram-header-btn"];
  }
  if (lower.includes("path-tracing") || lower.includes("stüdyo render")) {
    return BIRIM_RICH_TOOLTIP_PRESETS["open-studio-render-header-btn"];
  }
  if (lower.includes("paralel yasla")) {
    return BIRIM_RICH_TOOLTIP_PRESETS["plan-snap-module-parallel-wall-btn"];
  }
  if (lower.includes("ada mutfak") || lower.includes("açılı masa")) {
    return BIRIM_RICH_TOOLTIP_PRESETS["open-island-table-btn"];
  }
  if (lower.includes("yeni kulp") || lower.includes("özel donanım")) {
    return BIRIM_RICH_TOOLTIP_PRESETS["open-custom-hardware-btn"];
  }

  const swatchEl = anchor.querySelector(
    "[data-material-swatch='true'], .rounded-full[style*='background']"
  ) as HTMLElement | null;
  if (swatchEl && swatchEl.style && (swatchEl.style.backgroundImage || swatchEl.style.backgroundColor)) {
    return {
      badge: "PBR YÜZEY DOKUSU",
      swatchBgColor: swatchEl.style.backgroundColor || "#d6d3cd",
      swatchBgImage: swatchEl.style.backgroundImage || undefined,
    };
  }

  return {};
}

function parseRawTooltipText(
  anchor: HTMLElement,
  rawText: string
): Omit<ParsedTooltipPayload, "placement" | "anchorRect"> {
  let text = rawText.trim();
  const explicitBadge = anchor.getAttribute("data-tooltip-badge")?.trim() || undefined;
  let description = anchor.getAttribute("data-tooltip-desc")?.trim() || undefined;
  let shortcut = anchor.getAttribute("data-tooltip-shortcut")?.trim() || undefined;
  const explicitVisual = (anchor.getAttribute("data-tooltip-visual")?.trim() || undefined) as
    | BirimTooltipVisualId
    | undefined;
  const explicitImage = anchor.getAttribute("data-tooltip-image")?.trim() || undefined;

  if (!shortcut) {
    const scMatch = text.match(
      /^(.*?)\s*\(((?:Ctrl|Cmd|Alt|Shift|⌘|⌥|⇧|\+|[A-Z0-9]|Esc|Del|Tab|Space){1,14})\)$/i
    );
    if (scMatch && scMatch[1].trim().length >= 2) {
      text = scMatch[1].trim();
      shortcut = scMatch[2].trim();
    }
  }

  if (!description) {
    const dashIdx = text.indexOf(" — ");
    const bulletIdx = text.indexOf(" • ");
    const splitIdx = dashIdx > 2 ? dashIdx : bulletIdx > 2 ? bulletIdx : -1;
    if (splitIdx > 2 && splitIdx < 48) {
      description = text.slice(splitIdx + 3).trim();
      text = text.slice(0, splitIdx).trim();
    }
  }

  const inferred = inferRichMetadataFromAnchor(anchor, text);

  return {
    badge: explicitBadge || inferred.badge,
    label: inferred.label || text,
    description: description || inferred.description,
    shortcut: shortcut || inferred.shortcut,
    visual: explicitVisual || inferred.visual,
    imageSrc: explicitImage || inferred.imageSrc,
    swatchBgColor: inferred.swatchBgColor,
    swatchBgImage: inferred.swatchBgImage,
  };
}

function resolveSmartPlacement(
  el: HTMLElement,
  rect: DOMRect,
  requested?: string | null
): Exclude<BirimTooltipPlacement, "auto"> {
  if (
    requested === "top" ||
    requested === "bottom" ||
    requested === "left" ||
    requested === "right"
  ) {
    return requested;
  }

  const vw = typeof window !== "undefined" ? window.innerWidth : 1440;
  const vh = typeof window !== "undefined" ? window.innerHeight : 900;

  if (
    el.closest('[data-testid="studio-left-icon-rail"], .birim-ice-rail-pill') &&
    rect.left < 160
  ) {
    return "right";
  }

  if (rect.right > vw - 64 && rect.top > 76 && rect.width <= 48) {
    return "left";
  }

  if (rect.top < 84 || el.closest("header")) {
    return "bottom";
  }

  if (rect.bottom > vh - 96) {
    return "top";
  }

  return "top";
}

function findTooltipAnchor(target: EventTarget | null): HTMLElement | null {
  if (!target || !(target instanceof HTMLElement)) return null;
  if (target.closest("[data-no-tooltip='true']")) return null;

  const candidate = target.closest(
    "[data-tooltip], [data-birim-tooltip], [title], button, [role='button'], a[href], summary"
  ) as HTMLElement | null;

  if (!candidate) return null;
  if (candidate.hasAttribute("disabled") || candidate.getAttribute("aria-disabled") === "true") {
    return null;
  }

  if (candidate.hasAttribute("title")) {
    const nativeTitle = candidate.getAttribute("title")?.trim();
    if (nativeTitle) {
      candidate.setAttribute("data-birim-tooltip", nativeTitle);
    }
    candidate.removeAttribute("title");
  }

  const titledAncestor = candidate.parentElement?.closest("[title]") as HTMLElement | null;
  if (
    titledAncestor &&
    titledAncestor.contains(candidate) &&
    titledAncestor.getBoundingClientRect().width < 280
  ) {
    const ancTitle = titledAncestor.getAttribute("title")?.trim();
    if (
      ancTitle &&
      !candidate.getAttribute("data-tooltip") &&
      !candidate.getAttribute("data-birim-tooltip")
    ) {
      candidate.setAttribute("data-birim-tooltip", ancTitle);
    }
    titledAncestor.removeAttribute("title");
  }

  const explicit =
    candidate.getAttribute("data-tooltip") ||
    candidate.getAttribute("data-birim-tooltip");

  if (explicit && explicit.trim().length > 0) {
    return candidate;
  }

  const testId = candidate.getAttribute("data-testid") || "";
  if (testId && BIRIM_RICH_TOOLTIP_PRESETS[testId]) {
    candidate.setAttribute(
      "data-birim-tooltip",
      BIRIM_RICH_TOOLTIP_PRESETS[testId].label || testId
    );
    return candidate;
  }

  const ariaLabel = candidate.getAttribute("aria-label")?.trim();
  if (ariaLabel) {
    const visibleText = (candidate.innerText || "").replace(/\s+/g, " ").trim();
    if (visibleText.length <= 2) {
      candidate.setAttribute("data-birim-tooltip", ariaLabel);
      return candidate;
    }
  }

  return null;
}

/**
 * Birim Global Zengin & Görselli Tooltip Portalı (`<BirimTooltipPortal />`).
 * - Boyama öncesi senkron konum hesaplaması (`useLayoutEffect`) ile aşağıdan/uzaktan fırlama etkisini tamamen kaldırır.
 * - Yatay menülerde (üst bar, alt dock, sekme şeritleri) aşağıdan kayma yerine buton kenarından yumuşak buğu çözülmesi (optical mist bloom)
 *   ve yan yana düğmeler arasında akışkan yatay süzülme (liquid horizontal glide) uygular.
 */
export const BirimTooltipPortal: React.FC = () => {
  const [mounted, setMounted] = useState(false);
  const [isPrimaryInstance, setIsPrimaryInstance] = useState(false);
  const [payload, setPayload] = useState<ParsedTooltipPayload | null>(null);
  const [visible, setVisible] = useState(false);
  const [coords, setCoords] = useState<{
    x: number;
    y: number;
    arrowOffset: number;
    placement: Exclude<BirimTooltipPlacement, "auto">;
    canGlideHorizontally: boolean;
  }>({
    x: -9999,
    y: -9999,
    arrowOffset: 24,
    placement: "bottom",
    canGlideHorizontally: false,
  });

  const bubbleRef = useRef<HTMLDivElement | null>(null);
  const activeAnchorRef = useRef<HTMLElement | null>(null);
  const prevCoordsRef = useRef<{ x: number; y: number; active: boolean }>({
    x: -9999,
    y: -9999,
    active: false,
  });
  const showTimerRef = useRef<number | null>(null);
  const hideTimerRef = useRef<number | null>(null);
  const unmountTimerRef = useRef<number | null>(null);
  const lastShownAtRef = useRef<number>(0);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (activePortalCount > 0) return;
    activePortalCount += 1;
    setIsPrimaryInstance(true);
    setMounted(true);
    return () => {
      activePortalCount = Math.max(0, activePortalCount - 1);
    };
  }, []);

  useEffect(() => {
    if (!mounted || !isPrimaryInstance) return;

    const clearTimers = () => {
      if (showTimerRef.current !== null) {
        window.clearTimeout(showTimerRef.current);
        showTimerRef.current = null;
      }
      if (hideTimerRef.current !== null) {
        window.clearTimeout(hideTimerRef.current);
        hideTimerRef.current = null;
      }
      if (unmountTimerRef.current !== null) {
        window.clearTimeout(unmountTimerRef.current);
        unmountTimerRef.current = null;
      }
    };

    const hideImmediately = (instant = false) => {
      clearTimers();
      activeAnchorRef.current = null;
      setVisible(false);
      if (instant) {
        prevCoordsRef.current.active = false;
        setPayload(null);
      } else {
        unmountTimerRef.current = window.setTimeout(() => {
          prevCoordsRef.current.active = false;
          setPayload(null);
        }, 230);
      }
    };

    const showForAnchor = (anchor: HTMLElement) => {
      if (document.body.dataset.birimUiDragging === "1") return;
      const raw =
        anchor.getAttribute("data-tooltip") ||
        anchor.getAttribute("data-birim-tooltip") ||
        "";
      if (!raw.trim()) return;

      const rect = anchor.getBoundingClientRect();
      if (rect.width === 0 && rect.height === 0) return;

      const parsed = parseRawTooltipText(anchor, raw);
      const placement = resolveSmartPlacement(
        anchor,
        rect,
        anchor.getAttribute("data-tooltip-placement")
      );

      setPayload({
        ...parsed,
        placement,
        anchorRect: rect,
      });
      requestAnimationFrame(() => {
        setVisible(true);
        lastShownAtRef.current = performance.now();
      });
    };

    const handlePointerOver = (e: PointerEvent) => {
      if (e.pointerType === "touch") return;
      if (document.body.dataset.birimUiDragging === "1") {
        hideImmediately(true);
        return;
      }

      const anchor = findTooltipAnchor(e.target);
      if (!anchor) {
        if (activeAnchorRef.current) {
          hideImmediately(false);
        }
        return;
      }

      if (anchor === activeAnchorRef.current) return;

      clearTimers();
      activeAnchorRef.current = anchor;

      const warmHandoff = performance.now() - lastShownAtRef.current < 480;
      const delayMs = warmHandoff ? 36 : 175;

      showTimerRef.current = window.setTimeout(() => {
        if (activeAnchorRef.current === anchor && document.contains(anchor)) {
          showForAnchor(anchor);
        }
      }, delayMs);
    };

    const handlePointerOut = (e: PointerEvent) => {
      if (!activeAnchorRef.current) return;
      const nextTarget = e.relatedTarget as HTMLElement | null;
      if (nextTarget && activeAnchorRef.current.contains(nextTarget)) {
        return;
      }
      const nextAnchor = findTooltipAnchor(nextTarget);
      if (nextAnchor && nextAnchor !== activeAnchorRef.current) {
        return;
      }
      clearTimers();
      hideTimerRef.current = window.setTimeout(() => {
        activeAnchorRef.current = null;
        setVisible(false);
        lastShownAtRef.current = performance.now();
        unmountTimerRef.current = window.setTimeout(() => {
          prevCoordsRef.current.active = false;
          setPayload(null);
        }, 230);
      }, 65);
    };

    const handleFocusIn = (e: FocusEvent) => {
      const target = e.target as HTMLElement | null;
      if (!target || typeof target.matches !== "function" || !target.matches(":focus-visible")) {
        return;
      }
      const anchor = findTooltipAnchor(target);
      if (!anchor) return;
      clearTimers();
      activeAnchorRef.current = anchor;
      showForAnchor(anchor);
    };

    const handleDismissAction = () => {
      if (activeAnchorRef.current || visible) {
        hideImmediately(false);
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        hideImmediately(true);
      }
    };

    document.addEventListener("pointerover", handlePointerOver, { passive: true });
    document.addEventListener("pointerout", handlePointerOut, { passive: true });
    document.addEventListener("focusin", handleFocusIn, { passive: true });
    document.addEventListener("focusout", handleDismissAction, { passive: true });
    document.addEventListener("pointerdown", handleDismissAction, { passive: true });
    window.addEventListener("scroll", handleDismissAction, { passive: true, capture: true });
    window.addEventListener("wheel", handleDismissAction, { passive: true });
    window.addEventListener("resize", handleDismissAction, { passive: true });
    window.addEventListener("keydown", handleKeyDown, { passive: true });

    return () => {
      clearTimers();
      document.removeEventListener("pointerover", handlePointerOver);
      document.removeEventListener("pointerout", handlePointerOut);
      document.removeEventListener("focusin", handleFocusIn);
      document.removeEventListener("focusout", handleDismissAction);
      document.removeEventListener("pointerdown", handleDismissAction);
      window.removeEventListener("scroll", handleDismissAction, true);
      window.removeEventListener("wheel", handleDismissAction);
      window.removeEventListener("resize", handleDismissAction);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [mounted, isPrimaryInstance, visible]);

  // Boyama öncesi (pre-paint) senkron ölçüm: ilk açılışta asla ekranın altından/eski Y konumundan kayarak gelmez!
  useLayoutEffect(() => {
    if (!payload || !bubbleRef.current) return;
    const bubble = bubbleRef.current;
    const bw = bubble.offsetWidth || 210;
    const bh = bubble.offsetHeight || 46;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const gap = 10;
    const margin = 12;
    const r = payload.anchorRect;

    let finalPlacement = payload.placement;
    if (finalPlacement === "top" && r.top - bh - gap < margin) {
      finalPlacement = "bottom";
    } else if (finalPlacement === "bottom" && r.bottom + bh + gap > vh - margin) {
      finalPlacement = "top";
    } else if (finalPlacement === "right" && r.right + bw + gap > vw - margin) {
      finalPlacement = "left";
    } else if (finalPlacement === "left" && r.left - bw - gap < margin) {
      finalPlacement = "right";
    }

    let x = 0;
    let y = 0;
    let arrowOffset = 0;

    if (finalPlacement === "top" || finalPlacement === "bottom") {
      const anchorCx = r.left + r.width * 0.5;
      x = Math.round(Math.max(margin, Math.min(vw - bw - margin, anchorCx - bw * 0.5)));
      y = Math.round(finalPlacement === "top" ? r.top - bh - gap : r.bottom + gap);
      arrowOffset = Math.round(Math.max(14, Math.min(bw - 14, anchorCx - x)));
    } else {
      const anchorCy = r.top + r.height * 0.5;
      x = Math.round(finalPlacement === "right" ? r.right + gap : r.left - bw - gap);
      y = Math.round(Math.max(margin, Math.min(vh - bh - margin, anchorCy - bh * 0.5)));
      arrowOffset = Math.round(Math.max(12, Math.min(bh - 12, anchorCy - y)));
    }

    const prev = prevCoordsRef.current;
    const sameHorizontalBar =
      prev.active &&
      (finalPlacement === "bottom" || finalPlacement === "top") &&
      Math.abs(y - prev.y) <= 32 &&
      Math.abs(x - prev.x) <= 460;

    prevCoordsRef.current = { x, y, active: true };
    setCoords({
      x,
      y,
      arrowOffset,
      placement: finalPlacement,
      canGlideHorizontally: sameHorizontalBar,
    });
  }, [payload]);

  if (!mounted || !isPrimaryInstance || !payload || typeof document === "undefined") {
    return null;
  }

  const isRichCard = Boolean(
    payload.description || payload.visual || payload.imageSrc || payload.swatchBgColor || payload.swatchBgImage || payload.badge
  );

  const transformOrigin =
    coords.placement === "bottom"
      ? `${coords.arrowOffset}px 0%`
      : coords.placement === "top"
      ? `${coords.arrowOffset}px 100%`
      : coords.placement === "right"
      ? `0% ${coords.arrowOffset}px`
      : `100% ${coords.arrowOffset}px`;

  return createPortal(
    <div
      ref={bubbleRef}
      role="tooltip"
      data-testid="birim-global-tooltip"
      data-placement={coords.placement}
      data-visible={visible ? "true" : "false"}
      data-glide={coords.canGlideHorizontally ? "true" : "false"}
      data-rich={isRichCard ? "true" : "false"}
      className="birim-tooltip-root"
      style={{
        transform: `translate3d(${coords.x}px, ${coords.y}px, 0)`,
      }}
    >
      <div
        className={`birim-tooltip-surface ${isRichCard ? "birim-tooltip-surface-rich" : ""}`}
        style={{ transformOrigin }}
      >
        {(payload.visual || payload.imageSrc || payload.swatchBgColor || payload.swatchBgImage) && (
          <div className="birim-tooltip-media">
            {payload.imageSrc ? (
              <img
                src={payload.imageSrc}
                alt={payload.label}
                className="w-full h-full object-cover rounded-lg"
              />
            ) : payload.swatchBgColor || payload.swatchBgImage ? (
              <div
                className="w-full h-full rounded-lg border border-white/20 shadow-inner"
                style={{
                  backgroundColor: payload.swatchBgColor || "#d6d3cd",
                  backgroundImage: payload.swatchBgImage || "none",
                  backgroundSize: "cover",
                  backgroundPosition: "center",
                  backgroundRepeat: "no-repeat",
                }}
              />
            ) : payload.visual ? (
              renderVisualDiagram(payload.visual)
            ) : null}
          </div>
        )}

        <div className="birim-tooltip-body">
          {payload.badge && (
            <div className="flex items-center justify-between gap-2 mb-0.5">
              <span className="birim-tooltip-badge">{payload.badge}</span>
              {payload.shortcut && (
                <kbd className="birim-tooltip-kbd">{payload.shortcut}</kbd>
              )}
            </div>
          )}

          <div className="flex items-center justify-between gap-2">
            <span className="birim-tooltip-label">{payload.label}</span>
            {!payload.badge && payload.shortcut && (
              <kbd className="birim-tooltip-kbd">{payload.shortcut}</kbd>
            )}
          </div>

          {payload.description && (
            <p className="birim-tooltip-desc">{payload.description}</p>
          )}
        </div>

        <span
          aria-hidden="true"
          className={`birim-tooltip-arrow birim-tooltip-arrow-${coords.placement}`}
          style={
            coords.placement === "top" || coords.placement === "bottom"
              ? { left: `${coords.arrowOffset}px` }
              : { top: `${coords.arrowOffset}px` }
          }
        />
      </div>
    </div>,
    document.body
  );
};
