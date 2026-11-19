"use client";

import React from "react";

export interface HandleCrossSectionMeta {
  shortTitle: string;
  specLine: string;
  surfaceNote: string;
}

export function getHandleCrossSectionMeta(profileId: string, category: string, fallbackName: string): HandleCrossSectionMeta {
  switch (profileId) {
    case "hnd_gola_profile":
      return {
        shortTitle: "Alüminyum Gola L-Profil",
        specLine: "49×26 mm kanal • Tezgâh altı 30 mm boşluk",
        surfaceNote: "Tüm yüzeyler (MDFLam, Lake, Kaplama) • Alt dolap",
      };
    case "hnd_gola_c_drawer":
      return {
        shortTitle: "Alüminyum Gola C-Profil",
        specLine: "73×26 mm yatay C kanal • İki çekmece/kapak arası",
        surfaceNote: "Tüm yüzeyler • Üstten ve alttan kavrama",
      };
    case "hnd_gola_vertical":
      return {
        shortTitle: "Dikey Alüminyum Gola (1020)",
        specLine: "Dikey yan kanal • Boy dolap & gardırop",
        surfaceNote: "Buzdolabı, boy kiler ve gardırop kanat arası",
      };
    case "hnd_gola_wall_268":
      return {
        shortTitle: "Üst Dolap Altı Gola 268",
        specLine: "18 mm alt tablaya gömülü • Alttan el sokma + LED",
        surfaceNote: "Mutfak üst duvar dolapları için",
      };
    case "hnd_gola_melamine_box":
      return {
        shortTitle: "Melamin / Ahşap Gola Kutusu",
        specLine: "60×38 mm gövde rengi kutu • 32 mm parmak boşluğu",
        surfaceNote: "MDFLam, Lake, Kaplama • Metal profilsiz aynı renk",
      };
    case "hnd_gola_moulded_box":
      return {
        shortTitle: "Tek Parça Şekillendirilmiş Kutu",
        specLine: "60×25 mm gömme kavisli kanal • 30 mm boşluk",
        surfaceNote: "Membran / PVC ve boyalı kapaklar için",
      };
    case "hnd_bevel_30_backing":
      return {
        shortTitle: "30°/45° Pahlı Kapak + Arka Bant",
        specLine: "30°–45° eğimli üst kenar + 60×18 mm arka kapama",
        surfaceNote: "Lake, Kaplama ve seçili laminat • 30 mm boşluk",
      };
    case "hnd_overhang_recessed_lip":
      return {
        shortTitle: "Gömme Ters Dudak / Sarkık Kapak",
        specLine: "18×12 mm alt/üst oyuk • 4 mm pahlı kavrama",
        surfaceNote: "Üst dolap alt kenarı veya ters dudaklı kapaklar",
      };
    case "hnd_j_pull":
      return {
        shortTitle: "CNC J-Kulp (Üst Kenar Oyuk)",
        specLine: "30 mm CNC oyuk • 0 mm iç hacim kaybı",
        surfaceNote: "21–22 mm Lake veya Doğal Ahşap Kaplama gerektirir",
      };
    case "hnd_edge_profile":
      return {
        shortTitle: "Kenar Geçme Alüminyum Profil",
        specLine: "Kapak üst kenarına geçme 20 mm ince profil",
        surfaceNote: "18 mm tüm kapak yüzeylerine uyumlu",
      };
    case "hnd_none":
      return {
        shortTitle: "Bas-Aç (TIP-ON / SERVO-DRIVE)",
        specLine: "Tamamen düz kulpsuz cephe • 3 mm basma payı",
        surfaceNote: "Dokunarak açılan tüm alt, üst ve boy dolaplar",
      };
    case "hnd_knob_std":
      return {
        shortTitle: "Düğme Kulp (Ø32 mm)",
        specLine: "Tek vidalı klasik düğme kulp • 28 mm çıkıntı",
        surfaceNote: "Tüm kapak ve çekmecelere uyumlu",
      };
    case "hnd_bar_160":
      return {
        shortTitle: "Standart Çubuk Kulp (160 mm)",
        specLine: "C-C 160 mm delik aksı • 32 mm çıkıntı",
        surfaceNote: "Mutfak ve gardırop için klasik ergonomi",
      };
    case "hnd_long_profile_960":
      return {
        shortTitle: "Uzun Dikey Kulp (960 mm)",
        specLine: "C-C 960 mm • Boy kapaklar için",
        surfaceNote: "Gardırop ve boy kiler kapakları",
      };
    case "hnd_recessed_grip":
      return {
        shortTitle: "Gömme Sürgü Kulpu",
        specLine: "0 mm çıkıntı • Hemzemin CNC yuva",
        surfaceNote: "Sürgülü kapaklar için ideal",
      };
    default:
      return {
        shortTitle: fallbackName,
        specLine: category === "gola_profile" ? "Kulpsuz gömme profil" : "Standart kulp profili",
        surfaceNote: "18 mm+ kapaklarla uyumlu",
      };
  }
}

export interface HandleCrossSectionSvgProps {
  profileId: string;
  category: string;
  active?: boolean;
  size?: "sm" | "lg";
}

/**
 * Architectural 2D side cross-section diagram for kitchen & wardrobe door opening systems.
 * Visually shows countertop, carcass, recessed Gola/box/bevel profile, door front & finger direction.
 */
export const HandleCrossSectionSvg: React.FC<HandleCrossSectionSvgProps> = React.memo(
  ({ profileId, category, active = false, size = "sm" }) => {
    const stroke = active ? "#FAF8F4" : "#1C1917";
    const muted = active ? "#A8A29E" : "#78716C";
    const carcassFill = active ? "#292524" : "#E7E2D8";
    const doorFill = active ? "#44403C" : "#D6CFC2";
    const accent = active ? "#F59E0B" : "#B45309";
    const aluFill = active ? "#D6D3D1" : "#57534E";
    const cls = size === "lg" ? "w-[112px] h-[78px] shrink-0" : "w-[68px] h-[50px] shrink-0";

    // 1. Alüminyum Gola L-Profil (Tezgâh Altı)
    if (profileId === "hnd_gola_profile") {
      return (
        <svg viewBox="0 0 96 68" className={cls} fill="none">
          {/* Tezgâh */}
          <rect x="4" y="4" width="76" height="11" rx="2" fill={muted} fillOpacity="0.35" stroke={stroke} strokeWidth="1.2" />
          {/* Gövde üst kayıt */}
          <rect x="4" y="15" width="38" height="9" fill={carcassFill} stroke={stroke} strokeWidth="1" />
          {/* Alüminyum L-Gola profili */}
          <path d="M42 15 V35 Q42 39 46 39 H57" stroke={aluFill} strokeWidth="3.2" strokeLinecap="round" />
          {/* Kapak (30mm düşük) */}
          <rect x="58" y="34" width="14" height="30" fill={doorFill} stroke={stroke} strokeWidth="1.3" />
          {/* El giriş oku */}
          <path d="M84 25 H65 M69 21 L64 25 L69 29" stroke={accent} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
          <text x="75" y="19" fontSize="7" fill={accent} fontWeight="700">30</text>
        </svg>
      );
    }

    // 2. Alüminyum Gola C-Profil (73×26 mm, İki Çekmece/Kapak Arası)
    if (profileId === "hnd_gola_c_drawer") {
      return (
        <svg viewBox="0 0 96 68" className={cls} fill="none">
          {/* Yan gövde */}
          <rect x="6" y="4" width="46" height="60" fill={carcassFill} stroke={stroke} strokeWidth="1" />
          {/* Üst kapak/çekmece */}
          <rect x="52" y="4" width="14" height="20" fill={doorFill} stroke={stroke} strokeWidth="1.3" />
          {/* Alt kapak/çekmece */}
          <rect x="52" y="44" width="14" height="20" fill={doorFill} stroke={stroke} strokeWidth="1.3" />
          {/* C-Gola Profili (73x26) */}
          <path d="M52 16 H36 Q32 16 32 20 V48 Q32 52 36 52 H52" stroke={aluFill} strokeWidth="3.2" fill={active ? "#1C1917" : "#FAF8F4"} />
          {/* El giriş oku */}
          <path d="M84 34 H58 M62 30 L57 34 L62 38" stroke={accent} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
          <text x="72" y="29" fontSize="7" fill={accent} fontWeight="700">C73</text>
        </svg>
      );
    }

    // 3. Dikey Alüminyum Gola (Plan Kesiti)
    if (profileId === "hnd_gola_vertical") {
      return (
        <svg viewBox="0 0 96 68" className={cls} fill="none">
          {/* Sol & Sağ Gövde */}
          <rect x="6" y="8" width="28" height="34" fill={carcassFill} stroke={stroke} strokeWidth="1" />
          <rect x="62" y="8" width="28" height="34" fill={carcassFill} stroke={stroke} strokeWidth="1" />
          {/* Dikey C/L Gola kanalı */}
          <path d="M34 42 V24 Q34 20 38 20 H58 Q62 20 62 24 V42" stroke={aluFill} strokeWidth="3" fill={active ? "#1C1917" : "#FAF8F4"} />
          {/* Sol ve Sağ Kapak */}
          <rect x="6" y="42" width="32" height="12" fill={doorFill} stroke={stroke} strokeWidth="1.3" />
          <rect x="58" y="42" width="32" height="12" fill={doorFill} stroke={stroke} strokeWidth="1.3" />
          {/* Parmak oku */}
          <path d="M48 63 V44 M44 48 L48 43 L52 48" stroke={accent} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      );
    }

    // 4. Üst Dolap Altı Gola 268 + LED
    if (profileId === "hnd_gola_wall_268") {
      return (
        <svg viewBox="0 0 96 68" className={cls} fill="none">
          {/* Üst dolap gövde */}
          <rect x="8" y="6" width="46" height="34" fill={carcassFill} stroke={stroke} strokeWidth="1" />
          {/* Alt tabla 18mm */}
          <rect x="8" y="34" width="34" height="10" fill={carcassFill} stroke={stroke} strokeWidth="1.1" />
          {/* Gömülü Gola 268 profili */}
          <path d="M42 44 V35 H56 V44" stroke={aluFill} strokeWidth="2.8" fill={active ? "#1C1917" : "#FAF8F4"} />
          {/* LED noktası */}
          <circle cx="49" cy="40" r="2.2" fill="#F59E0B" />
          {/* Sarkık üst kapak */}
          <rect x="56" y="6" width="14" height="46" fill={doorFill} stroke={stroke} strokeWidth="1.3" />
          {/* Alttan el giriş oku */}
          <path d="M49 62 V47 M45 51 L49 46 L53 51" stroke={accent} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
          <text x="68" y="61" fontSize="6.5" fill={accent} fontWeight="700">268</text>
        </svg>
      );
    }

    // 5. Melamin / Ahşap Gömme Parmak Kutusu (Gola de Melamina 60×38)
    if (profileId === "hnd_gola_melamine_box") {
      return (
        <svg viewBox="0 0 96 68" className={cls} fill="none">
          <rect x="4" y="4" width="76" height="11" rx="2" fill={muted} fillOpacity="0.35" stroke={stroke} strokeWidth="1.2" />
          <rect x="4" y="15" width="28" height="9" fill={carcassFill} stroke={stroke} strokeWidth="1" />
          {/* L şeklinde aynı renk melamin kutu */}
          <path d="M32 15 H42 V32 H58 V41 H32 Z" fill={doorFill} stroke={stroke} strokeWidth="1.2" />
          {/* Kapak */}
          <rect x="58" y="34" width="14" height="30" fill={doorFill} stroke={stroke} strokeWidth="1.3" />
          {/* El giriş oku */}
          <path d="M84 25 H65 M69 21 L64 25 L69 29" stroke={accent} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
          <text x="73" y="19" fontSize="6.5" fill={accent} fontWeight="700">32</text>
        </svg>
      );
    }

    // 6. Tek Parça Şekillendirilmiş Gömme Kutu (60×25)
    if (profileId === "hnd_gola_moulded_box") {
      return (
        <svg viewBox="0 0 96 68" className={cls} fill="none">
          <rect x="4" y="4" width="76" height="11" rx="2" fill={muted} fillOpacity="0.35" stroke={stroke} strokeWidth="1.2" />
          <rect x="4" y="15" width="34" height="9" fill={carcassFill} stroke={stroke} strokeWidth="1" />
          {/* Tek parça şekillendirilmiş kavisli kutu */}
          <path d="M38 15 H46 V32 Q46 35 49 35 H58 V42 H42 Q38 42 38 38 Z" fill={doorFill} stroke={stroke} strokeWidth="1.2" />
          <rect x="58" y="34" width="14" height="30" fill={doorFill} stroke={stroke} strokeWidth="1.3" />
          <path d="M84 25 H65 M69 21 L64 25 L69 29" stroke={accent} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      );
    }

    // 7. 30°/45° Pahlı Kapak + Arka Kapama Bandı (60×18)
    if (profileId === "hnd_bevel_30_backing") {
      return (
        <svg viewBox="0 0 96 68" className={cls} fill="none">
          <rect x="4" y="4" width="76" height="11" rx="2" fill={muted} fillOpacity="0.35" stroke={stroke} strokeWidth="1.2" />
          <rect x="4" y="15" width="38" height="9" fill={carcassFill} stroke={stroke} strokeWidth="1" />
          {/* Aynı renk 60x18 arka kapama bandı */}
          <rect x="42" y="15" width="12" height="28" fill={doorFill} stroke={stroke} strokeWidth="1.2" />
          {/* 30°/45° Pahlı Kapak Üst Kenarı */}
          <path d="M56 38 L70 30 V64 H56 Z" fill={doorFill} stroke={stroke} strokeWidth="1.3" />
          <path d="M84 23 H65 M69 19 L64 23 L69 27" stroke={accent} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
          <text x="72" y="42" fontSize="6.5" fill={accent} fontWeight="700">45°</text>
        </svg>
      );
    }

    // 8. Üst Dolap Sarkık Kapak / Ters Dudak (18 mm Sarkma)
    if (profileId === "hnd_overhang_recessed_lip") {
      return (
        <svg viewBox="0 0 96 68" className={cls} fill="none">
          {/* Üst dolap yan gövde ve alt tabla */}
          <rect x="8" y="6" width="46" height="32" fill={carcassFill} stroke={stroke} strokeWidth="1" />
          <rect x="8" y="30" width="46" height="10" fill={carcassFill} stroke={stroke} strokeWidth="1.2" />
          {/* Alt sarkık kapak (18mm aşağı sarkar) */}
          <rect x="54" y="6" width="14" height="48" fill={doorFill} stroke={stroke} strokeWidth="1.3" />
          {/* Alttan parmak kavrama oku */}
          <path d="M44 60 V45 H52 M48 41 L53 45 L48 49" stroke={accent} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
          <text x="70" y="54" fontSize="6.5" fill={accent} fontWeight="700">18</text>
        </svg>
      );
    }

    // 9. Sürekli CNC J-Kulp (30mm Oyuk, 22mm Lake)
    if (profileId === "hnd_j_pull" || category === "j_pull") {
      return (
        <svg viewBox="0 0 96 68" className={cls} fill="none">
          <rect x="4" y="4" width="76" height="11" rx="2" fill={muted} fillOpacity="0.35" stroke={stroke} strokeWidth="1.2" />
          <rect x="4" y="15" width="46" height="10" fill={carcassFill} stroke={stroke} strokeWidth="1" />
          {/* 22mm kalın kapak içinde CNC J-oyuğu */}
          <path d="M52 17 H57 V31 Q57 35 61 35 H65 L70 30 V64 H52 Z" fill={doorFill} stroke={stroke} strokeWidth="1.3" />
          <path d="M84 24 H64 M68 20 L63 24 L68 28" stroke={accent} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
          <text x="73" y="43" fontSize="6.5" fill={accent} fontWeight="700">22</text>
        </svg>
      );
    }

    // 10. Kenar Geçme Alüminyum Profil
    if (profileId === "hnd_edge_profile" || category === "edge_profile") {
      return (
        <svg viewBox="0 0 96 68" className={cls} fill="none">
          <rect x="4" y="4" width="76" height="11" rx="2" fill={muted} fillOpacity="0.35" stroke={stroke} strokeWidth="1.2" />
          <rect x="4" y="15" width="46" height="10" fill={carcassFill} stroke={stroke} strokeWidth="1" />
          <rect x="52" y="21" width="14" height="43" fill={doorFill} stroke={stroke} strokeWidth="1.3" />
          {/* İnce L geçme kulp */}
          <path d="M52 20 H74 V25" stroke={aluFill} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M84 31 L71 25" stroke={accent} strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      );
    }

    // 11. Bas-Aç (TIP-ON / Handleless Plain)
    if (profileId === "hnd_none" || category === "handleless_plain") {
      return (
        <svg viewBox="0 0 96 68" className={cls} fill="none">
          <rect x="8" y="10" width="42" height="48" fill={carcassFill} stroke={stroke} strokeWidth="1" />
          {/* TIP-ON itici pim */}
          <rect x="34" y="28" width="19" height="6" rx="2" fill={accent} />
          {/* Düz kulpsuz kapak */}
          <rect x="54" y="10" width="14" height="48" fill={doorFill} stroke={stroke} strokeWidth="1.3" />
          {/* Basma oku */}
          <path d="M86 31 H72 M76 27 L71 31 L76 35" stroke={accent} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      );
    }

    // 12. Düğme Kulp
    if (category === "knob") {
      return (
        <svg viewBox="0 0 96 68" className={cls} fill="none">
          <rect x="10" y="10" width="38" height="48" fill={carcassFill} stroke={stroke} strokeWidth="1" />
          <rect x="48" y="10" width="14" height="48" fill={doorFill} stroke={stroke} strokeWidth="1.3" />
          <rect x="62" y="31" width="9" height="6" fill={aluFill} />
          <circle cx="76" cy="34" r="7" fill={aluFill} stroke={stroke} strokeWidth="1.2" />
        </svg>
      );
    }

    // 13. Gömme Sürgü Kulpu
    if (category === "recessed_grip" || category === "milled_wood_grip") {
      return (
        <svg viewBox="0 0 96 68" className={cls} fill="none">
          <rect x="10" y="10" width="38" height="48" fill={carcassFill} stroke={stroke} strokeWidth="1" />
          <path d="M48 10 H64 V24 H56 V44 H64 V58 H48 Z" fill={doorFill} stroke={stroke} strokeWidth="1.3" />
          <path d="M78 34 H60 M64 30 L59 34 L64 38" stroke={accent} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      );
    }

    // 14. Varsayılan: Çubuk / Bar Kulp Yan Kesit
    return (
      <svg viewBox="0 0 96 68" className={cls} fill="none">
        <rect x="10" y="10" width="38" height="48" fill={carcassFill} stroke={stroke} strokeWidth="1" />
        <rect x="48" y="10" width="14" height="48" fill={doorFill} stroke={stroke} strokeWidth="1.3" />
        <path d="M62 20 H74 V48 H62" stroke={aluFill} strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  }
);

HandleCrossSectionSvg.displayName = "HandleCrossSectionSvg";
