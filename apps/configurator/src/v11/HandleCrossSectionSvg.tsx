"use client";

import React from "react";

export interface HandleCrossSectionMeta {
  shortTitle: string;
  specLine: string;
  surfaceNote: string;
}

export function getHandleCrossSectionMeta(
  profileId: string,
  category: string,
  fallbackName: string
): HandleCrossSectionMeta {
  switch (profileId) {
    case "hnd_gola_profile":
      return {
        shortTitle: "Alüminyum Gola L-Profil",
        specLine: "56×26 mm L-kanal + Sabitleyici L-Klips • 30 mm boşluk",
        surfaceNote: "Yan dikme & üst kayda klipsli sabit (kapakla açılmaz)",
      };
    case "hnd_gola_c_drawer":
      return {
        shortTitle: "Alüminyum Gola C-Profil",
        specLine: "73.5×26 mm C-kanal + Sabitleyici Klips • 32 mm boşluk",
        surfaceNote: "≤120 cm'de Üst L + ikişerli C profil; >120 cm yüksek çekmecelerde otomatik alttan C profil (TS EN 14749)",
      };
    case "hnd_gola_vertical":
      return {
        shortTitle: "Dikey Alüminyum Gola (1020)",
        specLine: "56×26 mm dikey C/L kanal • Dikmeye klipsle sabit",
        surfaceNote: "Boy kiler, ankastre buzdolabı ve gardıroplar",
      };
    case "hnd_gola_wall_268":
      return {
        shortTitle: "Üst Dolap Altı Gola 268",
        specLine: "18×26 mm alt tablaya sabit gömülü + 18 mm sarkma",
        surfaceNote: "Mutfak üst duvar dolapları (alttan el sokmalı + LED)",
      };
    case "hnd_gola_melamine_box":
      return {
        shortTitle: "Melamin / Ahşap Gola Kutusu",
        specLine: "60×38 mm 2 parçalı gövdeye sabit kutu • 30 mm boşluk",
        surfaceNote: "MDFLam, Lake, Kaplama • Metal profilsiz aynı renk",
      };
    case "hnd_gola_moulded_box":
      return {
        shortTitle: "Şekillendirilmiş Gömme Kutu",
        specLine: "60×25 mm tek parça gövdeye sabit kutu • 30 mm boşluk",
        surfaceNote: "Membran / PVC ve boyalı kapaklar için",
      };
    case "hnd_bevel_30_backing":
      return {
        shortTitle: "30°/45° Pahlı Kapak + Arka Bant",
        specLine: "45° eğimli kapak üstü + 60×18 mm sabit arka bant",
        surfaceNote: "Lake, Kaplama ve seçili laminat • 30 mm boşluk",
      };
    case "hnd_overhang_recessed_lip":
      return {
        shortTitle: "Üst Dolap Sarkık Kapak (18 mm)",
        specLine: "Kapak alt kenarı gövdeden 18 mm aşağı sarkar",
        surfaceNote: "Ek profil gerektirmeyen kulpsuz üst dolap çözümü",
      };
    case "hnd_j_pull":
      return {
        shortTitle: "CNC J-Kulp (Entegre Oyuk)",
        specLine: "22 mm kapak içine oyulmuş 34 mm J-kanal • 0 mm kayıp",
        surfaceNote: "21–22 mm Lake veya Doğal Ahşap Kaplama gerektirir",
      };
    case "hnd_edge_profile":
      return {
        shortTitle: "Kenar Geçme Alüminyum Profil",
        specLine: "Kapak üst cumbasına binen 2 mm + 18 mm ön tırnak",
        surfaceNote: "18 mm tüm kapak yüzeylerine uyumlu",
      };
    case "hnd_none":
      return {
        shortTitle: "Bas-Aç (TIP-ON / SERVO-DRIVE)",
        specLine: "Tamamen düz kulpsuz cephe • 3 mm tetikleme boşluğu",
        surfaceNote: "Dokunarak açılan tüm alt, üst ve boy dolaplar",
      };
    case "hnd_knob_std":
      return {
        shortTitle: "Düğme Kulp (Ø32 mm)",
        specLine: "Tek vidalı klasik düğme kulp • 28 mm çıkıntı",
        surfaceNote: "Tüm kapak ve çekmecelere uyumlu",
      };
    case "hnd_bar_160":
    case "K019":
      return {
        shortTitle: "Standart Çekme / Çubuk Kulp (160 mm)",
        specLine: "C-C 160 mm delik aksı • 32 mm çıkıntı",
        surfaceNote: "Mutfak kapak ve çekmeceleri için klasik ergonomi",
      };
    case "hnd_bar_320":
      return {
        shortTitle: "Geniş Çekmece Kulpu (320 mm)",
        specLine: "C-C 320 mm delik aksı • 32 mm çıkıntı",
        surfaceNote: "60–120 cm geniş tencere ve erzak çekmeceleri için ideal",
      };
    case "hnd_bridge_pull_128":
      return {
        shortTitle: "Modern Köprü Çekme Kulp (128 mm)",
        specLine: "C-C 128 mm tek parça ince U-köprü • 28 mm çıkıntı",
        surfaceNote: "Yalın modern mutfak kapakları ve çekmeceler",
      };
    case "hnd_cup_pull_96":
      return {
        shortTitle: "Çanak / Kupa Çekme Kulp (96 mm)",
        specLine: "C-C 96 mm alttan kavramalı yarım ay çanak • 26 mm çıkıntı",
        surfaceNote: "Shaker / çerçeveli mutfak çekmeceleri ve kapaklar",
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
 * True-to-scale technical cross-section reference diagrams matching DIN / European KBB standards:
 * - Countertop front overhang = +40mm past carcass (Z=580 -> Z=620, i.e., +22mm past 18mm door face!)
 * - Top front stretcher recessed strictly BEHIND the Gola / Finger-Box notch
 * - Explicit Scilm SU116 / Häfele 712.63.511 Carcass Fixing Brackets (Sabitleyici L-Klips) locking into rear T-slot of L & C Gola!
 */
export const HandleCrossSectionSvg: React.FC<HandleCrossSectionSvgProps> = React.memo(
  ({ profileId, category, active = false, size = "sm" }) => {
    const stroke = active ? "#FAF8F4" : "#1C1917";
    const ctopFill = active ? "#57534E" : "#D6CFC2";
    const carcassFill = active ? "#292524" : "#EDE8DD";
    const doorFill = active ? "#64748B" : "#CBD5E1";
    const clipFill = active ? "#94A3B8" : "#64748B";
    const accent = active ? "#FBBF24" : "#D97706";
    const aluStroke = active ? "#F59E0B" : "#B45309";
    const cls = size === "lg" ? "w-[118px] h-[82px] shrink-0" : "w-[68px] h-[50px] shrink-0";

    // 1. Alüminyum Gola L-Profil (56×26 mm + Gövde Sabitleyici L-Klips SU116)
    if (profileId === "hnd_gola_profile") {
      return (
        <svg viewBox="0 0 100 72" className={cls} fill="none">
          {/* Tezgâh (+22mm kapak önünden taşar: x=80) */}
          <rect x="4" y="4" width="76" height="11" rx="1.5" fill={ctopFill} stroke={stroke} strokeWidth="1.1" />
          {/* Geri çekilmiş üst ön kayıt (x=4..39, Gola arkasında biter!) */}
          <rect x="4" y="15" width="35" height="9" fill={carcassFill} stroke={stroke} strokeWidth="1" />
          {/* Yan dikmeye vidalı Sabitleyici L-Klips (35x14x32mm: x=22..39, y=24..43) + arka T-kanal kilidi */}
          <path d="M22 24 H39 V42 H22 Z" fill={clipFill} fillOpacity="0.88" stroke={stroke} strokeWidth="0.9" />
          <circle cx="27" cy="29" r="1.4" fill="#F8FAFC" stroke={stroke} strokeWidth="0.6" />
          <circle cx="27" cy="37" r="1.4" fill="#F8FAFC" stroke={stroke} strokeWidth="0.6" />
          {/* İnce etli Alüminyum L-Gola + arka kırlangıç kanal dişi */}
          <path d="M37 29 H40 M37 37 H40" stroke={aluStroke} strokeWidth="1.8" />
          <path
            d="M40 15 V43 Q40 46 43 46 H55 V41"
            stroke={aluStroke}
            strokeWidth="2.6"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          {/* Kapak (30mm boşluk altında y=32..68, x=56..68) */}
          <rect x="56" y="32" width="12" height="36" fill={doorFill} stroke={stroke} strokeWidth="1.2" />
          {/* Parmak giriş oku */}
          <path d="M92 23 H62 M66 19.5 L61.5 23 L66 26.5" stroke={accent} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          <text x="82" y="19" fontSize="6.5" fontFamily="monospace" fill={accent} fontWeight="700">30</text>
        </svg>
      );
    }

    // 2. Alüminyum Gola C-Profil (73.5×26 mm + Yan Dikme Sabitleyici Klips SU116 / 712.63.511)
    if (profileId === "hnd_gola_c_drawer") {
      return (
        <svg viewBox="0 0 100 72" className={cls} fill="none">
          {/* Yan dikme ve C-kertmesi (ara raf YOK, yan dikme kertmeli!) */}
          <path d="M6 4 H56 V16 H39 V56 H56 V68 H6 Z" fill={carcassFill} stroke={stroke} strokeWidth="1" />
          {/* Yan dikmeye vidalı Orta Sabitleyici L-Klips (35x14x35mm: x=21..39, y=26..46) */}
          <path d="M21 26 H39 V46 H21 Z" fill={clipFill} fillOpacity="0.9" stroke={stroke} strokeWidth="0.9" />
          <circle cx="26" cy="31" r="1.4" fill="#F8FAFC" stroke={stroke} strokeWidth="0.6" />
          <circle cx="26" cy="41" r="1.4" fill="#F8FAFC" stroke={stroke} strokeWidth="0.6" />
          {/* C-Gola arka kırlangıç T-kanal tırnakları */}
          <path d="M36.5 31.5 H39.5 M36.5 40.5 H39.5" stroke={aluStroke} strokeWidth="1.8" />
          {/* Üst çekmece klapası */}
          <rect x="56" y="4" width="12" height="16" fill={doorFill} stroke={stroke} strokeWidth="1.2" />
          {/* Alt çekmece klapası */}
          <rect x="56" y="52" width="12" height="16" fill={doorFill} stroke={stroke} strokeWidth="1.2" />
          {/* İnce etli 73.5x26 Alüminyum C-Gola Profili (her iki klapa arkasına 21mm simetrik biner!) */}
          <path
            d="M55 21 V16.5 H42 Q39.5 16.5 39.5 19 V53 Q39.5 55.5 42 55.5 H55 V51"
            stroke={aluStroke}
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path d="M92 36 H61 M65 32.5 L60.5 36 L65 39.5" stroke={accent} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          <text x="74" y="31" fontSize="6.5" fontFamily="monospace" fill={accent} fontWeight="700">C73</text>
        </svg>
      );
    }

    // 3. Dikey Alüminyum Gola 1020 (Yatay X-Z Plan Kesiti + Orta Dikme Sabitleyici Klips)
    if (profileId === "hnd_gola_vertical") {
      return (
        <svg viewBox="0 0 100 72" className={cls} fill="none">
          {/* Orta dikme (26mm geri çekili: y=6..28) */}
          <rect x="44" y="6" width="12" height="22" fill={carcassFill} stroke={stroke} strokeWidth="1" />
          {/* Dikme ucu Sabitleyici Klips */}
          <rect x="41" y="22" width="18" height="8" fill={clipFill} stroke={stroke} strokeWidth="0.9" />
          {/* Yatay plan C-Gola 1020 (56x26mm: x=30..70, y=30..46) */}
          <path
            d="M31 45 H30 V32 Q30 30 32 30 H68 Q70 30 70 32 V45 H69"
            stroke={aluStroke}
            strokeWidth="2.5"
            strokeLinecap="round"
          />
          {/* Sol ve Sağ Boy Kapaklar (arada 30mm el boşluğu!) */}
          <rect x="6" y="46" width="30" height="11" fill={doorFill} stroke={stroke} strokeWidth="1.2" />
          <rect x="64" y="46" width="30" height="11" fill={doorFill} stroke={stroke} strokeWidth="1.2" />
          <path d="M50 67 V48 M46.5 52 L50 47.5 L53.5 52" stroke={accent} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      );
    }

    // 4. Üst Dolap Altı Gola 268 (18mm Alt Tablaya Sıfır Gömülü + 18mm Sarkık Kapak)
    if (profileId === "hnd_gola_wall_268") {
      return (
        <svg viewBox="0 0 100 72" className={cls} fill="none">
          <rect x="8" y="6" width="48" height="38" fill={carcassFill} fillOpacity="0.45" stroke={stroke} strokeWidth="0.9" strokeDasharray="2 2" />
          <rect x="8" y="33" width="32" height="11" fill={carcassFill} stroke={stroke} strokeWidth="1.2" />
          <path d="M40 44 V33 H56 V36" stroke={aluStroke} strokeWidth="2.5" strokeLinejoin="round" />
          <circle cx="48" cy="38" r="2" fill="#F59E0B" />
          <rect x="56" y="6" width="12" height="49" fill={doorFill} stroke={stroke} strokeWidth="1.2" />
          <path d="M48 66 V47 M44.5 51 L48 46.5 L51.5 51" stroke={accent} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          <text x="71" y="55" fontSize="6.5" fontFamily="monospace" fill={accent} fontWeight="700">268</text>
        </svg>
      );
    }

    // 5. Melamin / Ahşap Gömme Parmak Kutusu ("Gola de Melamina" 60×38 mm, 2 Parça L)
    if (profileId === "hnd_gola_melamine_box") {
      return (
        <svg viewBox="0 0 100 72" className={cls} fill="none">
          <rect x="4" y="4" width="76" height="11" rx="1.5" fill={ctopFill} stroke={stroke} strokeWidth="1.1" />
          <rect x="4" y="15" width="28" height="9" fill={carcassFill} stroke={stroke} strokeWidth="1" />
          <rect x="32" y="15" width="10" height="33" fill={doorFill} stroke={stroke} strokeWidth="1.1" />
          <rect x="42" y="39" width="14" height="9" fill={doorFill} stroke={stroke} strokeWidth="1.1" />
          <rect x="56" y="32" width="12" height="36" fill={doorFill} stroke={stroke} strokeWidth="1.2" />
          <path d="M92 23 H62 M66 19.5 L61.5 23 L66 26.5" stroke={accent} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      );
    }

    // 6. Tek Parça Şekillendirilmiş Gömme Kutu (Moulded 60×25 mm)
    if (profileId === "hnd_gola_moulded_box") {
      return (
        <svg viewBox="0 0 100 72" className={cls} fill="none">
          <rect x="4" y="4" width="76" height="11" rx="1.5" fill={ctopFill} stroke={stroke} strokeWidth="1.1" />
          <rect x="4" y="15" width="35" height="9" fill={carcassFill} stroke={stroke} strokeWidth="1" />
          <path d="M39 15 H46 V36 Q46 40 50 40 H56 V47 H43 Q39 47 39 42 Z" fill={doorFill} stroke={stroke} strokeWidth="1.1" />
          <rect x="56" y="32" width="12" height="36" fill={doorFill} stroke={stroke} strokeWidth="1.2" />
          <path d="M92 23 H62 M66 19.5 L61.5 23 L66 26.5" stroke={accent} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      );
    }

    // 7. 30°/45° Pahlı Kapak + Aynı Renk Arka Kapama Bandı (60×18 mm)
    if (profileId === "hnd_bevel_30_backing") {
      return (
        <svg viewBox="0 0 100 72" className={cls} fill="none">
          <rect x="4" y="4" width="76" height="11" rx="1.5" fill={ctopFill} stroke={stroke} strokeWidth="1.1" />
          <rect x="4" y="15" width="41" height="9" fill={carcassFill} stroke={stroke} strokeWidth="1" />
          <rect x="45" y="15" width="11" height="33" fill={doorFill} stroke={stroke} strokeWidth="1.1" />
          <path d="M56 42 L68 32 V68 H56 Z" fill={doorFill} stroke={stroke} strokeWidth="1.2" />
          <path d="M92 23 H62 M66 19.5 L61.5 23 L66 26.5" stroke={accent} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          <text x="72" y="44" fontSize="6.5" fontFamily="monospace" fill={accent} fontWeight="700">45°</text>
        </svg>
      );
    }

    // 8. Üst Dolap Sarkık Kapak (18 mm Sarkma — Ek Profil Yok)
    if (profileId === "hnd_overhang_recessed_lip") {
      return (
        <svg viewBox="0 0 100 72" className={cls} fill="none">
          <rect x="8" y="6" width="48" height="38" fill={carcassFill} fillOpacity="0.45" stroke={stroke} strokeWidth="0.9" strokeDasharray="2 2" />
          <rect x="8" y="33" width="48" height="11" fill={carcassFill} stroke={stroke} strokeWidth="1.2" />
          <rect x="56" y="6" width="12" height="50" fill={doorFill} stroke={stroke} strokeWidth="1.2" />
          <path d="M44 62 V49 H54 M50 45.5 L54.5 49 L50 52.5" stroke={accent} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          <text x="71" y="55" fontSize="6.5" fontFamily="monospace" fill={accent} fontWeight="700">18</text>
        </svg>
      );
    }

    // 9. Sürekli CNC J-Kulp (22 mm Lake Kapak İçine Oyulmuş J-Kanal, TLD HL2)
    if (profileId === "hnd_j_pull" || category === "j_pull") {
      return (
        <svg viewBox="0 0 100 72" className={cls} fill="none">
          <rect x="4" y="4" width="76" height="11" rx="1.5" fill={ctopFill} stroke={stroke} strokeWidth="1.1" />
          <rect x="4" y="15" width="52" height="9" fill={carcassFill} stroke={stroke} strokeWidth="1" />
          <path
            d="M56 17 H60 V34 Q60 37 64 37 Q67 37 68 33 L71 33 V68 H56 Z"
            fill={doorFill}
            stroke={stroke}
            strokeWidth="1.2"
          />
          <path d="M92 24 H65 M69 20.5 L64.5 24 L69 27.5" stroke={accent} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          <text x="74" y="46" fontSize="6.5" fontFamily="monospace" fill={accent} fontWeight="700">22</text>
        </svg>
      );
    }

    // 10. Kenar Geçme Alüminyum Profil (Kapak Üst Cumbasına Geçme)
    if (profileId === "hnd_edge_profile" || category === "edge_profile") {
      return (
        <svg viewBox="0 0 100 72" className={cls} fill="none">
          <rect x="4" y="4" width="76" height="11" rx="1.5" fill={ctopFill} stroke={stroke} strokeWidth="1.1" />
          <rect x="4" y="15" width="52" height="9" fill={carcassFill} stroke={stroke} strokeWidth="1" />
          <rect x="56" y="19" width="12" height="49" fill={doorFill} stroke={stroke} strokeWidth="1.2" />
          <path d="M56 18 H78 V24" stroke={aluStroke} strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M90 31 L77 24" stroke={accent} strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      );
    }

    // 11. Bas-Aç (TIP-ON)
    if (profileId === "hnd_none" || category === "handleless_plain") {
      return (
        <svg viewBox="0 0 100 72" className={cls} fill="none">
          <rect x="4" y="4" width="76" height="11" rx="1.5" fill={ctopFill} stroke={stroke} strokeWidth="1.1" />
          <rect x="4" y="15" width="52" height="9" fill={carcassFill} stroke={stroke} strokeWidth="1" />
          <rect x="40" y="29" width="16" height="5" rx="1.5" fill={accent} />
          <rect x="58" y="17" width="12" height="51" fill={doorFill} stroke={stroke} strokeWidth="1.2" />
          <path d="M90 32 H74 M78 28.5 L73.5 32 L78 35.5" stroke={accent} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      );
    }

    // 12. Düğme Kulp
    if (category === "knob") {
      return (
        <svg viewBox="0 0 100 72" className={cls} fill="none">
          <rect x="10" y="10" width="44" height="52" fill={carcassFill} stroke={stroke} strokeWidth="1" />
          <rect x="54" y="10" width="12" height="52" fill={doorFill} stroke={stroke} strokeWidth="1.2" />
          <rect x="66" y="33" width="8" height="6" fill={aluStroke} />
          <circle cx="79" cy="36" r="7" fill={aluStroke} stroke={stroke} strokeWidth="1.1" />
        </svg>
      );
    }

    // 13. Gömme Sürgü Kulpu
    if (category === "recessed_grip" || category === "milled_wood_grip") {
      return (
        <svg viewBox="0 0 100 72" className={cls} fill="none">
          <rect x="10" y="10" width="44" height="52" fill={carcassFill} stroke={stroke} strokeWidth="1" />
          <path d="M54 10 H68 V24 H60 V48 H68 V62 H54 Z" fill={doorFill} stroke={stroke} strokeWidth="1.2" />
          <path d="M84 36 H64 M68 32.5 L63.5 36 L68 39.5" stroke={accent} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      );
    }

    // 13b. Çanak / Kupa Çekme Kulp (Alttan Kavramalı Yarım Ay)
    if (profileId === "hnd_cup_pull_96") {
      return (
        <svg viewBox="0 0 100 72" className={cls} fill="none">
          <rect x="4" y="4" width="76" height="11" rx="1.5" fill={ctopFill} stroke={stroke} strokeWidth="1.1" />
          <rect x="4" y="15" width="52" height="9" fill={carcassFill} stroke={stroke} strokeWidth="1" />
          <rect x="56" y="17" width="12" height="51" fill={doorFill} stroke={stroke} strokeWidth="1.2" />
          <path d="M68 25 C84 25 85 45 76 50 L68 50" fill={aluStroke} fillOpacity="0.22" stroke={aluStroke} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M77 62 V49" stroke={accent} strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      );
    }

    // 14. Varsayılan: Standart Çubuk Kulp
    return (
      <svg viewBox="0 0 100 72" className={cls} fill="none">
        <rect x="4" y="4" width="76" height="11" rx="1.5" fill={ctopFill} stroke={stroke} strokeWidth="1.1" />
        <rect x="4" y="15" width="52" height="9" fill={carcassFill} stroke={stroke} strokeWidth="1" />
        <rect x="56" y="17" width="12" height="51" fill={doorFill} stroke={stroke} strokeWidth="1.2" />
        <path d="M68 25 H79 V56 H68" stroke={aluStroke} strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  }
);

HandleCrossSectionSvg.displayName = "HandleCrossSectionSvg";
