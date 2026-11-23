import type { ModuleInstance } from "@birim/core";
import type { HardwareItem } from "@birim/manufacturing";
import { CAD_COLORS, escXml, renderDimLine, renderViewCaption } from "./productionSheetTypes";

export type HingeVisualVariant =
  | "blum_standard_110"
  | "blum_155_zero"
  | "blum_95_thick"
  | "blum_107_shallow"
  | "blum_45_diag"
  | "blum_95_blind"
  | "blum_cristallo"
  | "blum_expando_t"
  | "hettich_sensys_110"
  | "hettich_sensys_165"
  | "salice_silentia_110"
  | "grass_tiomos_110";

export type HingeCrankType =
  | "full_overlay"
  | "half_overlay"
  | "inset"
  | "angled_45"
  | "blind_corner";

export type HingeFixingType = "cup_35" | "uv_adhesive" | "expando_t_10";

export interface HingeTechnicalProfile {
  id: string;
  sku: string;
  manufacturer: string;
  series: string;
  modelLabelTr: string;
  variant: HingeVisualVariant;
  openingAngleDeg: number;
  crankType: HingeCrankType;
  crankMm: number;
  crankLabelTr: string;
  fixingType: HingeFixingType;
  cupDiaMm: number;
  cupDepthMm: number;
  bossPitchMm: number;
  bossOffsetMm: number;
  bossHoleDiaMm: number;
  flangeWidthMm: number;
  flangeLengthMm: number;
  plateSku: string;
  plateHeightMm: number;
  plateSetbackMm: number;
  finish: "nickel" | "obsidian_black";
  damperLabelTr: string;
  doorThicknessRangeTr: string;
}

/**
 * Gerçek üretici katalog ölçülerine göre (Blum, Hettich, Salice, Grass)
 * katalogdaki tüm menteşe modelleri için teknik kesit ve delik şablonu profilleri.
 */
export const HINGE_TECHNICAL_PROFILES: Record<string, HingeTechnicalProfile> = {
  hw_blum_71b3550: {
    id: "hw_blum_71b3550",
    sku: "71B3550",
    manufacturer: "Blum",
    series: "CLIP top BLUMOTION",
    modelLabelTr: "Blum CLIP top BLUMOTION 110°",
    variant: "blum_standard_110",
    openingAngleDeg: 110,
    crankType: "full_overlay",
    crankMm: 0,
    crankLabelTr: "Tam Bini (0mm Düz)",
    fixingType: "cup_35",
    cupDiaMm: 35,
    cupDepthMm: 13.0,
    bossPitchMm: 45,
    bossOffsetMm: 9.5,
    bossHoleDiaMm: 8,
    flangeWidthMm: 57,
    flangeLengthMm: 22,
    plateSku: "173H7100",
    plateHeightMm: 0,
    plateSetbackMm: 37,
    finish: "nickel",
    damperLabelTr: "Entegre BLUMOTION",
    doorThicknessRangeTr: "16–24 mm",
  },
  hw_blum_71b3650: {
    id: "hw_blum_71b3650",
    sku: "71B3650",
    manufacturer: "Blum",
    series: "CLIP top BLUMOTION",
    modelLabelTr: "Blum CLIP top BLUMOTION 110°",
    variant: "blum_standard_110",
    openingAngleDeg: 110,
    crankType: "half_overlay",
    crankMm: 9.5,
    crankLabelTr: "Yarı Bini (9.5mm Krank)",
    fixingType: "cup_35",
    cupDiaMm: 35,
    cupDepthMm: 13.0,
    bossPitchMm: 45,
    bossOffsetMm: 9.5,
    bossHoleDiaMm: 8,
    flangeWidthMm: 57,
    flangeLengthMm: 22,
    plateSku: "173H7100",
    plateHeightMm: 0,
    plateSetbackMm: 37,
    finish: "nickel",
    damperLabelTr: "Entegre BLUMOTION",
    doorThicknessRangeTr: "16–24 mm",
  },
  hw_blum_71b3750: {
    id: "hw_blum_71b3750",
    sku: "71B3750",
    manufacturer: "Blum",
    series: "CLIP top BLUMOTION",
    modelLabelTr: "Blum CLIP top BLUMOTION 110°",
    variant: "blum_standard_110",
    openingAngleDeg: 110,
    crankType: "inset",
    crankMm: 18,
    crankLabelTr: "İçte (18mm Krank)",
    fixingType: "cup_35",
    cupDiaMm: 35,
    cupDepthMm: 13.0,
    bossPitchMm: 45,
    bossOffsetMm: 9.5,
    bossHoleDiaMm: 8,
    flangeWidthMm: 57,
    flangeLengthMm: 22,
    plateSku: "173H7100",
    plateHeightMm: 0,
    plateSetbackMm: 37,
    finish: "nickel",
    damperLabelTr: "Entegre BLUMOTION",
    doorThicknessRangeTr: "16–24 mm",
  },
  hw_blum_71b7550: {
    id: "hw_blum_71b7550",
    sku: "71B7550",
    manufacturer: "Blum",
    series: "CLIP top BLUMOTION",
    modelLabelTr: "Blum CLIP top BLUMOTION 155°",
    variant: "blum_155_zero",
    openingAngleDeg: 155,
    crankType: "full_overlay",
    crankMm: 0,
    crankLabelTr: "Sıfır Çıkıntı (0mm)",
    fixingType: "cup_35",
    cupDiaMm: 35,
    cupDepthMm: 11.7,
    bossPitchMm: 45,
    bossOffsetMm: 9.5,
    bossHoleDiaMm: 8,
    flangeWidthMm: 57,
    flangeLengthMm: 22,
    plateSku: "173H7100",
    plateHeightMm: 0,
    plateSetbackMm: 37,
    finish: "nickel",
    damperLabelTr: "7-Eksen Sıfır Çıkıntı",
    doorThicknessRangeTr: "16–24 mm",
  },
  hw_blum_71b9550: {
    id: "hw_blum_71b9550",
    sku: "71B9550",
    manufacturer: "Blum",
    series: "CLIP top BLUMOTION",
    modelLabelTr: "Blum CLIP top BLUMOTION 95° Kalın",
    variant: "blum_95_thick",
    openingAngleDeg: 95,
    crankType: "full_overlay",
    crankMm: 0,
    crankLabelTr: "Tam Bini (Kalın Kapak)",
    fixingType: "cup_35",
    cupDiaMm: 35,
    cupDepthMm: 13.0,
    bossPitchMm: 45,
    bossOffsetMm: 9.5,
    bossHoleDiaMm: 8,
    flangeWidthMm: 57,
    flangeLengthMm: 22,
    plateSku: "173H7100",
    plateHeightMm: 0,
    plateSetbackMm: 37,
    finish: "nickel",
    damperLabelTr: "Kalın Kapak 18–32mm",
    doorThicknessRangeTr: "18–32 mm",
  },
  hw_blum_75b1550: {
    id: "hw_blum_75b1550",
    sku: "75B1550",
    manufacturer: "Blum",
    series: "CLIP top BLUMOTION",
    modelLabelTr: "Blum CLIP top BLUMOTION 107° Sığ",
    variant: "blum_107_shallow",
    openingAngleDeg: 107,
    crankType: "full_overlay",
    crankMm: 0,
    crankLabelTr: "Tam Bini (Sığ 11.5mm)",
    fixingType: "cup_35",
    cupDiaMm: 35,
    cupDepthMm: 11.5,
    bossPitchMm: 45,
    bossOffsetMm: 9.5,
    bossHoleDiaMm: 8,
    flangeWidthMm: 57,
    flangeLengthMm: 22,
    plateSku: "173H7100",
    plateHeightMm: 0,
    plateSetbackMm: 37,
    finish: "nickel",
    damperLabelTr: "Sığ Tas 11.5mm",
    doorThicknessRangeTr: "15–24 mm",
  },
  hw_blum_79b9458: {
    id: "hw_blum_79b9458",
    sku: "79B9458",
    manufacturer: "Blum",
    series: "CLIP top BLUMOTION",
    modelLabelTr: "Blum +45° Diyagonal Köşe",
    variant: "blum_45_diag",
    openingAngleDeg: 95,
    crankType: "angled_45",
    crankMm: 0,
    crankLabelTr: "+45° Diyagonal Köşe",
    fixingType: "cup_35",
    cupDiaMm: 35,
    cupDepthMm: 13.0,
    bossPitchMm: 45,
    bossOffsetMm: 9.5,
    bossHoleDiaMm: 8,
    flangeWidthMm: 57,
    flangeLengthMm: 22,
    plateSku: "173H7100",
    plateHeightMm: 0,
    plateSetbackMm: 37,
    finish: "nickel",
    damperLabelTr: "+45° Açılı Gövde",
    doorThicknessRangeTr: "16–22 mm",
  },
  hw_blum_79b9550: {
    id: "hw_blum_79b9550",
    sku: "79B9550",
    manufacturer: "Blum",
    series: "CLIP top BLUMOTION",
    modelLabelTr: "Blum 95° Kör Köşe / Klapa",
    variant: "blum_95_blind",
    openingAngleDeg: 95,
    crankType: "blind_corner",
    crankMm: 0,
    crankLabelTr: "95° Kör Klapa (Eş-Düzlem)",
    fixingType: "cup_35",
    cupDiaMm: 35,
    cupDepthMm: 13.0,
    bossPitchMm: 45,
    bossOffsetMm: 9.5,
    bossHoleDiaMm: 8,
    flangeWidthMm: 57,
    flangeLengthMm: 22,
    plateSku: "173H7100",
    plateHeightMm: 0,
    plateSetbackMm: 37,
    finish: "nickel",
    damperLabelTr: "Eş-Düzlem Klapa",
    doorThicknessRangeTr: "16–24 mm",
  },
  hw_blum_cristallo: {
    id: "hw_blum_cristallo",
    sku: "71B4500C",
    manufacturer: "Blum",
    series: "CRISTALLO",
    modelLabelTr: "Blum CRISTALLO 110° Cam/Ayna",
    variant: "blum_cristallo",
    openingAngleDeg: 110,
    crankType: "full_overlay",
    crankMm: 0,
    crankLabelTr: "Tam Bini (UV Yapıştırma)",
    fixingType: "uv_adhesive",
    cupDiaMm: 0,
    cupDepthMm: 0,
    bossPitchMm: 52,
    bossOffsetMm: 0,
    bossHoleDiaMm: 0,
    flangeWidthMm: 52,
    flangeLengthMm: 30.2,
    plateSku: "175H3100",
    plateHeightMm: 0,
    plateSetbackMm: 37,
    finish: "nickel",
    damperLabelTr: "Deliksiz UV Plaka 52×30.2",
    doorThicknessRangeTr: "4–6 mm Cam",
  },
  hw_blum_expando_t: {
    id: "hw_blum_expando_t",
    sku: "71B3550T",
    manufacturer: "Blum",
    series: "EXPANDO T",
    modelLabelTr: "Blum EXPANDO T 110° İnce Kapak",
    variant: "blum_expando_t",
    openingAngleDeg: 110,
    crankType: "full_overlay",
    crankMm: 0,
    crankLabelTr: "Tam Bini (İnce Kapak)",
    fixingType: "expando_t_10",
    cupDiaMm: 10,
    cupDepthMm: 6.0,
    bossPitchMm: 32,
    bossOffsetMm: 0,
    bossHoleDiaMm: 10,
    flangeWidthMm: 44,
    flangeLengthMm: 22,
    plateSku: "173H7100",
    plateHeightMm: 0,
    plateSetbackMm: 37,
    finish: "nickel",
    damperLabelTr: "2×Ø10×6mm EXPANDO T",
    doorThicknessRangeTr: "8–14 mm",
  },
  hw_hettich_9071205: {
    id: "hw_hettich_9071205",
    sku: "9071205",
    manufacturer: "Hettich",
    series: "Sensys 8645i",
    modelLabelTr: "Hettich Sensys 8645i 110°",
    variant: "hettich_sensys_110",
    openingAngleDeg: 110,
    crankType: "full_overlay",
    crankMm: 0,
    crankLabelTr: "Tam Bini (B 12.5mm)",
    fixingType: "cup_35",
    cupDiaMm: 35,
    cupDepthMm: 12.8,
    bossPitchMm: 52,
    bossOffsetMm: 5.5,
    bossHoleDiaMm: 10,
    flangeWidthMm: 63,
    flangeLengthMm: 22,
    plateSku: "9071626",
    plateHeightMm: 1.5,
    plateSetbackMm: 37,
    finish: "nickel",
    damperLabelTr: "Silent System • TH52",
    doorThicknessRangeTr: "15–24 mm",
  },
  hw_hettich_9091739: {
    id: "hw_hettich_9091739",
    sku: "9091739",
    manufacturer: "Hettich",
    series: "Sensys 8645i",
    modelLabelTr: "Hettich Sensys 8645i Obsidyen",
    variant: "hettich_sensys_110",
    openingAngleDeg: 110,
    crankType: "half_overlay",
    crankMm: 9.5,
    crankLabelTr: "Yarı Bini (B 3.0mm Siyah)",
    fixingType: "cup_35",
    cupDiaMm: 35,
    cupDepthMm: 12.8,
    bossPitchMm: 52,
    bossOffsetMm: 5.5,
    bossHoleDiaMm: 10,
    flangeWidthMm: 63,
    flangeLengthMm: 22,
    plateSku: "9071626",
    plateHeightMm: 1.5,
    plateSetbackMm: 37,
    finish: "obsidian_black",
    damperLabelTr: "Obsidyen Siyah • TH52",
    doorThicknessRangeTr: "15–24 mm",
  },
  hw_hettich_9099540: {
    id: "hw_hettich_9099540",
    sku: "9099540",
    manufacturer: "Hettich",
    series: "Sensys 8657i",
    modelLabelTr: "Hettich Sensys 8657i 165°",
    variant: "hettich_sensys_165",
    openingAngleDeg: 165,
    crankType: "full_overlay",
    crankMm: 0,
    crankLabelTr: "Sıfır Çıkıntı (165°)",
    fixingType: "cup_35",
    cupDiaMm: 35,
    cupDepthMm: 11.6,
    bossPitchMm: 52,
    bossOffsetMm: 5.5,
    bossHoleDiaMm: 10,
    flangeWidthMm: 63,
    flangeLengthMm: 22,
    plateSku: "9071626",
    plateHeightMm: 1.5,
    plateSetbackMm: 37,
    finish: "nickel",
    damperLabelTr: "165° Sıfır Çıkıntı • TH52",
    doorThicknessRangeTr: "15–32 mm",
  },
  hw_salice_c7p6ae9: {
    id: "hw_salice_c7p6ae9",
    sku: "C7P6AE9",
    manufacturer: "Salice",
    series: "Silentia+",
    modelLabelTr: "Salice Silentia+ 110°",
    variant: "salice_silentia_110",
    openingAngleDeg: 110,
    crankType: "full_overlay",
    crankMm: 0,
    crankLabelTr: "Tam Bini (0mm Düz)",
    fixingType: "cup_35",
    cupDiaMm: 35,
    cupDepthMm: 12.0,
    bossPitchMm: 48,
    bossOffsetMm: 9.0,
    bossHoleDiaMm: 8,
    flangeWidthMm: 60,
    flangeLengthMm: 22,
    plateSku: "BAP3R09",
    plateHeightMm: 0,
    plateSetbackMm: 37,
    finish: "nickel",
    damperLabelTr: "Çift Silikon Damper • 48×9",
    doorThicknessRangeTr: "16–26 mm",
  },
  hw_grass_tiomos_110: {
    id: "hw_grass_tiomos_110",
    sku: "F045138470",
    manufacturer: "Grass",
    series: "Tiomos 110°",
    modelLabelTr: "Grass Tiomos 110° Frenli",
    variant: "grass_tiomos_110",
    openingAngleDeg: 110,
    crankType: "full_overlay",
    crankMm: 0,
    crankLabelTr: "Tam Bini (0mm Düz)",
    fixingType: "cup_35",
    cupDiaMm: 35,
    cupDepthMm: 12.6,
    bossPitchMm: 45,
    bossOffsetMm: 9.5,
    bossHoleDiaMm: 8,
    flangeWidthMm: 57,
    flangeLengthMm: 22,
    plateSku: "F058139711",
    plateHeightMm: 2.0,
    plateSetbackMm: 37,
    finish: "nickel",
    damperLabelTr: "3 Kademeli Kol İçi Fren",
    doorThicknessRangeTr: "16–24 mm",
  },
};

function findProfileBySkuOrName(sku?: string, name?: string): HingeTechnicalProfile | undefined {
  const s = (sku || "").trim().toUpperCase();
  if (s) {
    const exact = Object.values(HINGE_TECHNICAL_PROFILES).find((p) => p.sku.toUpperCase() === s);
    if (exact) return exact;
  }
  const n = (name || "").toLowerCase();
  if (!n) return undefined;
  if (n.includes("cristallo") || n.includes("71b4500c")) return HINGE_TECHNICAL_PROFILES.hw_blum_cristallo;
  if (n.includes("expando") || n.includes("71b3550t")) return HINGE_TECHNICAL_PROFILES.hw_blum_expando_t;
  if (n.includes("79b9458") || n.includes("+45") || n.includes("diyagonal")) return HINGE_TECHNICAL_PROFILES.hw_blum_79b9458;
  if (n.includes("79b9550") || n.includes("kör köşe") || n.includes("klapa")) return HINGE_TECHNICAL_PROFILES.hw_blum_79b9550;
  if (n.includes("75b1550") || n.includes("107")) return HINGE_TECHNICAL_PROFILES.hw_blum_75b1550;
  if (n.includes("71b9550") || n.includes("kalın kapak")) return HINGE_TECHNICAL_PROFILES.hw_blum_71b9550;
  if (n.includes("8657") || n.includes("9099540") || n.includes("165")) return HINGE_TECHNICAL_PROFILES.hw_hettich_9099540;
  if (n.includes("9091739") || (n.includes("sensys") && (n.includes("siyah") || n.includes("obsidyen") || n.includes("yarım")))) {
    return HINGE_TECHNICAL_PROFILES.hw_hettich_9091739;
  }
  if (n.includes("sensys") || n.includes("8645") || n.includes("9071205")) return HINGE_TECHNICAL_PROFILES.hw_hettich_9071205;
  if (n.includes("salice") || n.includes("silentia") || n.includes("c7p6ae9")) return HINGE_TECHNICAL_PROFILES.hw_salice_c7p6ae9;
  if (n.includes("tiomos") || n.includes("grass") || n.includes("f045138470")) return HINGE_TECHNICAL_PROFILES.hw_grass_tiomos_110;
  if (n.includes("71b7550") || n.includes("155")) return HINGE_TECHNICAL_PROFILES.hw_blum_71b7550;
  if (n.includes("71b3750") || n.includes("hemzemin") || n.includes("içte") || n.includes("inset")) return HINGE_TECHNICAL_PROFILES.hw_blum_71b3750;
  if (n.includes("71b3650") || n.includes("yarı")) return HINGE_TECHNICAL_PROFILES.hw_blum_71b3650;
  if (n.includes("71b3550")) return HINGE_TECHNICAL_PROFILES.hw_blum_71b3550;
  return undefined;
}

/**
 * Aktif modülde seçili olan menteşe donanımını (bay.door.hardwareProductId -> drillingTemplateId -> BOM)
 * kesin olarak çözümler ve kapak bindirme tipine (overlayType) göre senkronize eder.
 */
export function resolveModuleHingeProfile(
  mod: ModuleInstance,
  bomHardwareList: HardwareItem[]
): HingeTechnicalProfile {
  const firstHingedBay =
    mod.bays.find(
      (b) =>
        b.door?.hardwareProductId &&
        HINGE_TECHNICAL_PROFILES[b.door.hardwareProductId]
    ) ||
    mod.bays.find(
      (b) =>
        b.door?.overlayType ||
        b.door?.type === "single_left" ||
        b.door?.type === "single_right" ||
        b.door?.type === "double" ||
        b.door?.type?.startsWith("inset_") ||
        b.door?.type?.startsWith("half_overlay_")
    );

  const selectedHwId = firstHingedBay?.door?.hardwareProductId;
  let baseProfile: HingeTechnicalProfile | undefined = selectedHwId
    ? HINGE_TECHNICAL_PROFILES[selectedHwId]
    : undefined;

  if (!baseProfile && mod.carcass.hingeDrillingTemplateId) {
    const tpl = mod.carcass.hingeDrillingTemplateId;
    if (tpl === "tpl_drill_blum_155_zero") baseProfile = HINGE_TECHNICAL_PROFILES.hw_blum_71b7550;
    else if (tpl === "tpl_drill_hettich_165_th52") baseProfile = HINGE_TECHNICAL_PROFILES.hw_hettich_9099540;
    else if (tpl === "tpl_drill_hettich_th52") baseProfile = HINGE_TECHNICAL_PROFILES.hw_hettich_9071205;
    else if (tpl === "tpl_drill_salice_48x9") baseProfile = HINGE_TECHNICAL_PROFILES.hw_salice_c7p6ae9;
    else if (tpl === "tpl_drill_grass_tiomos") baseProfile = HINGE_TECHNICAL_PROFILES.hw_grass_tiomos_110;
  }

  if (!baseProfile) {
    const hingeHw = bomHardwareList.find(
      (h) => h.category === "hinge" || h.name.toLowerCase().includes("menteşe")
    );
    baseProfile = findProfileBySkuOrName(hingeHw?.sku, hingeHw?.name);
  }

  const profile = { ...(baseProfile || HINGE_TECHNICAL_PROFILES.hw_blum_71b3550) };

  // Kullanıcının seçtiği bini tipini (inset / half_overlay) özel olmayan standart menteşelerde yansıt
  if (
    profile.crankType !== "angled_45" &&
    profile.crankType !== "blind_corner" &&
    profile.fixingType === "cup_35"
  ) {
    const doorTypeStr = firstHingedBay?.door?.type || "";
    const explicitOverlay =
      firstHingedBay?.door?.overlayType ||
      (doorTypeStr.startsWith("inset_")
        ? "inset"
        : doorTypeStr.startsWith("half_overlay_")
        ? "half_overlay"
        : undefined);

    if (explicitOverlay === "inset" && profile.crankType !== "inset") {
      profile.crankType = "inset";
      profile.crankMm = 18;
      profile.crankLabelTr = "İçte (18mm Krank)";
      if (profile.sku === "71B3550") profile.sku = "71B3750";
    } else if (explicitOverlay === "half_overlay" && profile.crankType !== "half_overlay") {
      profile.crankType = "half_overlay";
      profile.crankMm = 9.5;
      profile.crankLabelTr = "Yarı Bini (9.5mm Krank)";
      if (profile.sku === "71B3550") profile.sku = "71B3650";
    }
  }

  return profile;
}

export function getDetailD4Title(profile: HingeTechnicalProfile): string {
  if (profile.fixingType === "uv_adhesive") {
    return `CRISTALLO UV CAM MENTEŞE DETAYI (ÖLÇEK 1:2)`;
  }
  if (profile.fixingType === "expando_t_10") {
    return `EXPANDO T (Ø10×6) İNCE KAPAK MENTEŞE DETAYI (ÖLÇEK 1:2)`;
  }
  return `Ø${profile.cupDiaMm} MENTEŞE TAS & KAPAK BİNDİRME (ÖLÇEK 1:2)`;
}

function renderLeaderCallout(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  label: string,
  align: "start" | "end" = "start"
): string {
  const elbowX = align === "start" ? x2 + 14 : x2 - 14;
  const tx = align === "start" ? elbowX + 3 : elbowX - 3;
  return `
    <g>
      <circle cx="${x1.toFixed(1)}" cy="${y1.toFixed(1)}" r="2" fill="${CAD_COLORS.ink}" />
      <polyline points="${x1.toFixed(1)},${y1.toFixed(1)} ${x2.toFixed(1)},${y2.toFixed(1)} ${elbowX.toFixed(1)},${y2.toFixed(1)}" fill="none" stroke="${CAD_COLORS.ink}" stroke-width="0.8" />
      <text x="${tx.toFixed(1)}" y="${(y2 + 3).toFixed(1)}" text-anchor="${align}" font-family="Segoe UI, sans-serif" font-size="10" font-weight="700" fill="${CAD_COLORS.ink}">${escXml(label)}</text>
    </g>
  `;
}

/**
 * Gerçekçi mekanik haç montaj tablası (173H7100 / 9071626 / BAP3R09 / 175H3100) kesit çizimi.
 * xFace: Gövde yan dikme iç yüzeyi X koordinatı
 * yCenter: Tabla merkez ekseni Y koordinatı (genellikle ön kenardan 37mm)
 */
function renderMountingPlateSection(
  xFace: number,
  yCenter: number,
  s: number,
  profile: HingeTechnicalProfile,
  plateFill: string,
  plateDark: string,
  strokeCol: string
): string {
  const plateLen = 36 * s; // 36mm dikey kanat + gövde
  const baseThick = (8.5 + profile.plateHeightMm) * s; // Blum 0mm = 8.5mm toplam profil
  const screwX1 = xFace;
  const screwLen = 12 * s; // Euro vida Ø5×12mm
  const screwOffY = 16 * s; // 32mm eksen (±16mm)

  return `
    <g class="cad-hinge-mounting-plate">
      <!-- 2× Euro Vida Ø5×12mm (Gövde yan dikme içine 12mm gömülü) -->
      ${[-screwOffY, screwOffY]
        .map(
          (dy) => `
          <rect x="${(screwX1 - screwLen).toFixed(1)}" y="${(yCenter + dy - 2.3 * s).toFixed(1)}" width="${screwLen.toFixed(1)}" height="${(4.6 * s).toFixed(1)}" fill="#94A3B8" stroke="${strokeCol}" stroke-width="0.75" />
          <line x1="${(screwX1 - screwLen * 0.7).toFixed(1)}" y1="${(yCenter + dy - 2.3 * s).toFixed(1)}" x2="${(screwX1 - screwLen * 0.55).toFixed(1)}" y2="${(yCenter + dy + 2.3 * s).toFixed(1)}" stroke="${strokeCol}" stroke-width="0.6" />
          <line x1="${(screwX1 - screwLen * 0.4).toFixed(1)}" y1="${(yCenter + dy - 2.3 * s).toFixed(1)}" x2="${(screwX1 - screwLen * 0.25).toFixed(1)}" y2="${(yCenter + dy + 2.3 * s).toFixed(1)}" stroke="${strokeCol}" stroke-width="0.6" />
          <rect x="${screwX1.toFixed(1)}" y="${(yCenter + dy - 3.4 * s).toFixed(1)}" width="${(2.6 * s).toFixed(1)}" height="${(6.8 * s).toFixed(1)}" fill="${plateDark}" stroke="${strokeCol}" stroke-width="0.8" />
        `
        )
        .join("")}
      <!-- Haç Montaj Tablası Alt Kanadı -->
      <path d="
        M ${xFace.toFixed(1)},${(yCenter - plateLen / 2).toFixed(1)}
        L ${(xFace + 3.2 * s).toFixed(1)},${(yCenter - plateLen / 2).toFixed(1)}
        L ${(xFace + 3.2 * s).toFixed(1)},${(yCenter - 11 * s).toFixed(1)}
        L ${(xFace + baseThick).toFixed(1)},${(yCenter - 9.5 * s).toFixed(1)}
        L ${(xFace + baseThick).toFixed(1)},${(yCenter + 9.5 * s).toFixed(1)}
        L ${(xFace + 3.2 * s).toFixed(1)},${(yCenter + 11 * s).toFixed(1)}
        L ${(xFace + 3.2 * s).toFixed(1)},${(yCenter + plateLen / 2).toFixed(1)}
        L ${xFace.toFixed(1)},${(yCenter + plateLen / 2).toFixed(1)}
        Z
      " fill="${plateFill}" stroke="${strokeCol}" stroke-width="1.15" stroke-linejoin="round" />
      <!-- Eksantrik Yükseklik Ayar Kamı (±2mm) -->
      <circle cx="${(xFace + baseThick * 0.55).toFixed(1)}" cy="${yCenter.toFixed(1)}" r="${(2.8 * s).toFixed(1)}" fill="#FFFFFF" stroke="${strokeCol}" stroke-width="0.9" />
      <line x1="${(xFace + baseThick * 0.55 - 1.8 * s).toFixed(1)}" y1="${yCenter.toFixed(1)}" x2="${(xFace + baseThick * 0.55 + 1.8 * s).toFixed(1)}" y2="${yCenter.toFixed(1)}" stroke="${strokeCol}" stroke-width="0.8" />
      <!-- CLIP Kilitleme Tırnağı -->
      <rect x="${(xFace + baseThick - 2.2 * s).toFixed(1)}" y="${(yCenter - 6 * s).toFixed(1)}" width="${(2.2 * s).toFixed(1)}" height="${(12 * s).toFixed(1)}" fill="${plateDark}" stroke="${strokeCol}" stroke-width="0.7" />
    </g>
  `;
}

/**
 * Ø35mm Tas Gövdesi ve Üreticiye Özgü Damper / Flanş Kesiti
 */
function renderCupBodySection(
  cupCx: number,
  doorBotY: number,
  s: number,
  profile: HingeTechnicalProfile,
  metalLight: string,
  metalMid: string,
  metalDark: string,
  strokeCol: string
): string {
  const cupW = profile.cupDiaMm * s; // 35mm
  const cupD = profile.cupDepthMm * s; // 11.5 - 13.0mm
  const cupLeft = cupCx - cupW / 2;
  const cupRight = cupCx + cupW / 2;
  const cupTop = doorBotY - cupD;
  const wallT = 1.6 * s;
  const flangeExt = 5.5 * s;
  const flangeH = 2.4 * s;

  // Üreticiye özgü tas içi mekanizma detayı
  let internalDetail = "";
  if (profile.manufacturer === "Blum") {
    // BLUMOTION entegre fren silindiri + deaktivasyon anahtarı
    internalDetail = `
      <rect x="${(cupCx - 9.5 * s).toFixed(1)}" y="${(cupTop + wallT + 1.2 * s).toFixed(1)}" width="${(13 * s).toFixed(1)}" height="${(cupD - wallT - 2.5 * s).toFixed(1)}" rx="1.5" fill="${metalDark}" stroke="${strokeCol}" stroke-width="0.75" />
      <line x1="${(cupCx - 7 * s).toFixed(1)}" y1="${(cupTop + cupD * 0.55).toFixed(1)}" x2="${(cupCx + 1.5 * s).toFixed(1)}" y2="${(cupTop + cupD * 0.55).toFixed(1)}" stroke="#FFFFFF" stroke-width="0.85" />
      <rect x="${(cupRight - 7.5 * s).toFixed(1)}" y="${(doorBotY - 3.2 * s).toFixed(1)}" width="${(4.5 * s).toFixed(1)}" height="${(3.2 * s).toFixed(1)}" fill="#F59E0B" stroke="${strokeCol}" stroke-width="0.65" />
    `;
  } else if (profile.manufacturer === "Salice") {
    // Salice Silentia+ Çift Silikon Yağlı Damper
    internalDetail = `
      <rect x="${(cupCx - 11.5 * s).toFixed(1)}" y="${(cupTop + wallT + 1.0 * s).toFixed(1)}" width="${(9.5 * s).toFixed(1)}" height="${(cupD - wallT - 2.2 * s).toFixed(1)}" rx="1.5" fill="${metalDark}" stroke="${strokeCol}" stroke-width="0.7" />
      <rect x="${(cupCx + 2.0 * s).toFixed(1)}" y="${(cupTop + wallT + 1.0 * s).toFixed(1)}" width="${(9.5 * s).toFixed(1)}" height="${(cupD - wallT - 2.2 * s).toFixed(1)}" rx="1.5" fill="${metalDark}" stroke="${strokeCol}" stroke-width="0.7" />
      <circle cx="${cupCx.toFixed(1)}" cy="${(doorBotY - 2.5 * s).toFixed(1)}" r="${(1.8 * s).toFixed(1)}" fill="#E11D48" stroke="${strokeCol}" stroke-width="0.6" />
    `;
  } else if (profile.manufacturer === "Hettich") {
    // Hettich Sensys ince duvarlı çelik tas + mafsal yuvası
    internalDetail = `
      <rect x="${(cupCx - 7 * s).toFixed(1)}" y="${(cupTop + wallT + 1.5 * s).toFixed(1)}" width="${(14 * s).toFixed(1)}" height="${(cupD - wallT - 2.5 * s).toFixed(1)}" fill="${metalMid}" stroke="${strokeCol}" stroke-width="0.7" />
      <circle cx="${(cupCx - 4 * s).toFixed(1)}" cy="${(doorBotY - 4.2 * s).toFixed(1)}" r="${(2.0 * s).toFixed(1)}" fill="#FFFFFF" stroke="${strokeCol}" stroke-width="0.8" />
    `;
  } else {
    // Grass Tiomos düşük profilli mafsal haznesi
    internalDetail = `
      <path d="M ${(cupCx - 10 * s).toFixed(1)},${(doorBotY - 1).toFixed(1)} L ${(cupCx - 8 * s).toFixed(1)},${(cupTop + wallT + 1.5 * s).toFixed(1)} L ${(cupCx + 8 * s).toFixed(1)},${(cupTop + wallT + 1.5 * s).toFixed(1)} L ${(cupCx + 10 * s).toFixed(1)},${(doorBotY - 1).toFixed(1)} Z" fill="${metalMid}" stroke="${strokeCol}" stroke-width="0.75" />
    `;
  }

  return `
    <g class="cad-hinge-cup-body">
      <!-- Kapak içine frezelenen Ø35mm Tas Yuvası -->
      <rect x="${cupLeft.toFixed(1)}" y="${cupTop.toFixed(1)}" width="${cupW.toFixed(1)}" height="${cupD.toFixed(1)}" fill="#FFFFFF" stroke="${strokeCol}" stroke-width="1.25" />
      <!-- Çelik Tas Gövdesi Kesit Çeperi -->
      <path d="
        M ${(cupLeft - flangeExt).toFixed(1)},${doorBotY.toFixed(1)}
        L ${(cupLeft - flangeExt).toFixed(1)},${(doorBotY + flangeH).toFixed(1)}
        L ${cupLeft.toFixed(1)},${(doorBotY + flangeH).toFixed(1)}
        L ${cupLeft.toFixed(1)},${cupTop.toFixed(1)}
        L ${cupRight.toFixed(1)},${cupTop.toFixed(1)}
        L ${cupRight.toFixed(1)},${(doorBotY + flangeH).toFixed(1)}
        L ${(cupRight + flangeExt).toFixed(1)},${(doorBotY + flangeH).toFixed(1)}
        L ${(cupRight + flangeExt).toFixed(1)},${doorBotY.toFixed(1)}
        L ${(cupRight - wallT).toFixed(1)},${doorBotY.toFixed(1)}
        L ${(cupRight - wallT).toFixed(1)},${(cupTop + wallT).toFixed(1)}
        L ${(cupLeft + wallT).toFixed(1)},${(cupTop + wallT).toFixed(1)}
        L ${(cupLeft + wallT).toFixed(1)},${doorBotY.toFixed(1)}
        Z
      " fill="${metalLight}" stroke="${strokeCol}" stroke-width="1.05" stroke-linejoin="round" />
      ${internalDetail}
      <!-- Tas Mafsal Pimi -->
      <circle cx="${(cupLeft + 6.5 * s).toFixed(1)}" cy="${(doorBotY - 3.8 * s).toFixed(1)}" r="${(2.1 * s).toFixed(1)}" fill="#FFFFFF" stroke="${strokeCol}" stroke-width="0.95" />
      <circle cx="${(cupLeft + 13.5 * s).toFixed(1)}" cy="${(doorBotY - 6.2 * s).toFixed(1)}" r="${(1.8 * s).toFixed(1)}" fill="#FFFFFF" stroke="${strokeCol}" stroke-width="0.9" />
    </g>
  `;
}

/**
 * PAFTA 03 — DETAY D4: Seçili menteşe modeli için gerçek üretici ölçülerine dayalı
 * 1:2 ölçekli DIN 919 / ISO 128 teknik kesit çizimi.
 */
export function renderHingeSectionDetailSvg(params: {
  cx: number;
  cy: number;
  R: number;
  panelT: number;
  doorT: number;
  hingeSetbackMm: number;
  hatchId: string;
  profile: HingeTechnicalProfile;
}): string {
  const { cx: x, cy: y, R, panelT: T, doorT, hingeSetbackMm, hatchId, profile } = params;

  const isObsidian = profile.finish === "obsidian_black";
  const metalLight = isObsidian ? "#475569" : "#E2E8F0";
  const metalMid = isObsidian ? "#334155" : "#CBD5E1";
  const metalDark = isObsidian ? "#1E293B" : "#94A3B8";
  const strokeCol = CAD_COLORS.ink;

  const shortCrank = profile.crankLabelTr.split(" (")[0];
  const headerW = Math.min(220, Math.round(R * 1.24));
  const headerY = y - R + 42;
  const headerSvg = `
    <rect x="${(x - headerW / 2).toFixed(1)}" y="${headerY.toFixed(1)}" width="${headerW}" height="31" rx="4" fill="#F8FAFC" stroke="#CBD5E1" stroke-width="0.85" />
    <text x="${x.toFixed(1)}" y="${(headerY + 12.5).toFixed(1)}" text-anchor="middle" font-family="ui-monospace, monospace" font-size="9.5" font-weight="800" fill="${CAD_COLORS.plane}">${escXml(`${profile.sku} • ${profile.openingAngleDeg}° • ${shortCrank}`)}</text>
    <text x="${x.toFixed(1)}" y="${(headerY + 25).toFixed(1)}" text-anchor="middle" font-family="Segoe UI, sans-serif" font-size="9.0" font-weight="700" fill="${CAD_COLORS.subInk}">${escXml(`${profile.manufacturer} ${profile.series} • ${profile.plateSku}`)}</text>
  `;

  // =========================================================================
  // ÖZEL VARYANT A: BLUM +45° DİYAGONAL KÖŞE MENTEŞESİ (79B9458)
  // =========================================================================
  if (profile.variant === "blum_45_diag") {
    const s = 2.15;
    const pT = T * s;
    const dT = doorT * s;
    const cupW = profile.cupDiaMm * s;
    const cupD = profile.cupDepthMm * s;
    const tbMm = Math.max(3, Math.round((hingeSetbackMm - profile.cupDiaMm / 2) * 10) / 10);

    // Kapak yatay üstte, gövde yan dikme soldan +45° (135°) açıyla aşağı-sola iner
    const doorLeftX = x - 62;
    const doorTopY = y - 54;
    const doorBotY = doorTopY + dT;
    const cupCx = doorLeftX + hingeSetbackMm * s;
    const cornerX = doorLeftX + 12 * s;
    const cornerY = doorBotY + 2.5 * s;

    return `
      <!-- +45° Açılı Köşe Gövde Yan Dikmesi -->
      <g transform="translate(${cornerX.toFixed(1)}, ${cornerY.toFixed(1)}) rotate(45)">
        <rect x="${(-pT).toFixed(1)}" y="0" width="${pT.toFixed(1)}" height="${(R + 30).toFixed(1)}" fill="url(#${hatchId})" stroke="${strokeCol}" stroke-width="1.6" />
        ${renderMountingPlateSection(0, 37 * s, s, profile, metalMid, metalDark, strokeCol)}
      </g>
      <!-- Kapak Paneli -->
      <rect x="${doorLeftX.toFixed(1)}" y="${doorTopY.toFixed(1)}" width="156" height="${dT.toFixed(1)}" fill="url(#${hatchId})" stroke="${strokeCol}" stroke-width="1.6" />
      ${renderCupBodySection(cupCx, doorBotY, s, profile, metalLight, metalMid, metalDark, strokeCol)}
      <!-- +45° Açılı Menteşe Kolu & Mafsal Bağlantısı -->
      <path d="
        M ${(cupCx - 11 * s).toFixed(1)},${(doorBotY + 1).toFixed(1)}
        L ${(cupCx - 11 * s).toFixed(1)},${(doorBotY + 14 * s).toFixed(1)}
        L ${(cornerX - 18 * s).toFixed(1)},${(cornerY + 34 * s).toFixed(1)}
        L ${(cornerX - 28 * s).toFixed(1)},${(cornerY + 24 * s).toFixed(1)}
        L ${(cupCx - 19 * s).toFixed(1)},${(doorBotY + 8 * s).toFixed(1)}
        L ${(cupCx - 19 * s).toFixed(1)},${(doorBotY + 1).toFixed(1)}
        Z
      " fill="${metalLight}" stroke="${strokeCol}" stroke-width="1.15" stroke-linejoin="round" />
      <line x1="${(cupCx - 14 * s).toFixed(1)}" y1="${(doorBotY + 3).toFixed(1)}" x2="${(cornerX - 21 * s).toFixed(1)}" y2="${(cornerY + 26 * s).toFixed(1)}" stroke="${strokeCol}" stroke-width="1.6" />
      <!-- Merkez Eksen & +45° Açı Yay Göstergesi -->
      <line x1="${cupCx.toFixed(1)}" y1="${(doorTopY - 12).toFixed(1)}" x2="${cupCx.toFixed(1)}" y2="${(doorBotY + 22).toFixed(1)}" stroke="${CAD_COLORS.plane}" stroke-width="0.8" stroke-dasharray="5 2 1.5 2" />
      <path d="M ${(cornerX + 22).toFixed(1)},${(cornerY + 22).toFixed(1)} A 30 30 0 0 1 ${(cornerX - 2).toFixed(1)},${(cornerY + 32).toFixed(1)}" fill="none" stroke="${CAD_COLORS.plane}" stroke-width="1.1" />
      <text x="${(cornerX + 12).toFixed(1)}" y="${(cornerY + 42).toFixed(1)}" text-anchor="middle" font-family="ui-monospace, monospace" font-size="10" font-weight="800" fill="${CAD_COLORS.plane}">+45°</text>
      ${renderDimLine(doorLeftX, doorTopY - 20, cupCx - cupW / 2, doorTopY - 20, `K=${tbMm}`, "horizontal", doorTopY)}
      ${renderDimLine(cupCx - cupW / 2, doorBotY + 22, cupCx + cupW / 2, doorBotY + 22, `Ø${profile.cupDiaMm}`, "horizontal", doorBotY)}
      ${renderLeaderCallout(cupCx + cupW * 0.25, doorBotY - cupD * 0.5, cupCx + 38, doorTopY - 18, `Der. ${profile.cupDepthMm} mm`, "start")}
      ${headerSvg}
    `;
  }

  // =========================================================================
  // ÖZEL VARYANT B: BLUM 95° KÖR KÖŞE / EŞ-DÜZLEM KLAPA MENTEŞESİ (79B9550)
  // =========================================================================
  if (profile.variant === "blum_95_blind") {
    const s = 2.1;
    const pT = T * s;
    const dT = doorT * s;
    const cupW = profile.cupDiaMm * s;
    const cupD = profile.cupDepthMm * s;
    const tbMm = Math.max(3, Math.round((hingeSetbackMm - profile.cupDiaMm / 2) * 10) / 10);

    // Eş-düzlem kör klapa solda, kapak sağda (aynı ön düzlemde, arada 2mm derz)
    const panelTopY = y - 34;
    const panelBotY = panelTopY + dT;
    const gapPx = 2.5 * s;
    const klapaRightX = x - 18;
    const doorLeftX = klapaRightX + gapPx;
    const cupCx = doorLeftX + hingeSetbackMm * s;
    const plateCx = klapaRightX - 37 * s;

    return `
      <!-- Kör Köşe Sabit Klapa Paneli (Kapak ile Eş-Düzlem) -->
      <rect x="${(x - R).toFixed(1)}" y="${panelTopY.toFixed(1)}" width="${(klapaRightX - (x - R)).toFixed(1)}" height="${pT.toFixed(1)}" fill="url(#${hatchId})" stroke="${strokeCol}" stroke-width="1.6" />
      <!-- Kapak Paneli -->
      <rect x="${doorLeftX.toFixed(1)}" y="${panelTopY.toFixed(1)}" width="${(R + 30).toFixed(1)}" height="${dT.toFixed(1)}" fill="url(#${hatchId})" stroke="${strokeCol}" stroke-width="1.6" />
      <!-- Ø35mm Tas Gövdesi -->
      ${renderCupBodySection(cupCx, panelBotY, s, profile, metalLight, metalMid, metalDark, strokeCol)}
      <!-- Klapa Arka Yüzünde Haç Montaj Tablası (37mm gerilik) -->
      <g transform="translate(${plateCx.toFixed(1)}, ${panelBotY.toFixed(1)}) rotate(-90)">
        ${renderMountingPlateSection(0, 0, s, profile, metalMid, metalDark, strokeCol)}
      </g>
      <!-- Yatay Kör Köşe Menteşe Kolu (Eş-Düzlem Bağlantı) -->
      <path d="
        M ${(plateCx - 16 * s).toFixed(1)},${(panelBotY + 8.5 * s).toFixed(1)}
        L ${(cupCx - 6 * s).toFixed(1)},${(panelBotY + 8.5 * s).toFixed(1)}
        L ${(cupCx - 6 * s).toFixed(1)},${(panelBotY + 1).toFixed(1)}
        L ${(cupCx - 15 * s).toFixed(1)},${(panelBotY + 1).toFixed(1)}
        L ${(cupCx - 18 * s).toFixed(1)},${(panelBotY + 16 * s).toFixed(1)}
        L ${(plateCx - 16 * s).toFixed(1)},${(panelBotY + 16 * s).toFixed(1)}
        Z
      " fill="${metalLight}" stroke="${strokeCol}" stroke-width="1.15" stroke-linejoin="round" />
      <!-- Ayar Vidaları -->
      <circle cx="${(plateCx + 10 * s).toFixed(1)}" cy="${(panelBotY + 12.2 * s).toFixed(1)}" r="${(2.2 * s).toFixed(1)}" fill="#FFFFFF" stroke="${strokeCol}" stroke-width="0.85" />
      <circle cx="${(plateCx + 22 * s).toFixed(1)}" cy="${(panelBotY + 12.2 * s).toFixed(1)}" r="${(2.2 * s).toFixed(1)}" fill="#FFFFFF" stroke="${strokeCol}" stroke-width="0.85" />
      <!-- Merkez Eksen & Ölçüler -->
      <line x1="${cupCx.toFixed(1)}" y1="${(panelTopY - 12).toFixed(1)}" x2="${cupCx.toFixed(1)}" y2="${(panelBotY + 26).toFixed(1)}" stroke="${CAD_COLORS.plane}" stroke-width="0.8" stroke-dasharray="5 2 1.5 2" />
      ${renderDimLine(plateCx, panelBotY + 34, klapaRightX, panelBotY + 34, "37", "horizontal", panelBotY)}
      ${renderDimLine(doorLeftX, panelTopY - 20, cupCx - cupW / 2, panelTopY - 20, `K=${tbMm}`, "horizontal", panelTopY)}
      ${renderDimLine(cupCx - cupW / 2, panelBotY + 34, cupCx + cupW / 2, panelBotY + 34, `Ø${profile.cupDiaMm}`, "horizontal", panelBotY)}
      ${renderLeaderCallout(klapaRightX - 42, panelTopY + pT * 0.5, klapaRightX - 58, panelTopY - 26, "Kör Klapa", "end")}
      ${renderLeaderCallout(cupCx + cupW * 0.25, panelBotY - cupD * 0.5, cupCx + 36, panelTopY - 22, `Der. ${profile.cupDepthMm} mm`, "start")}
      ${headerSvg}
    `;
  }

  // =========================================================================
  // STANDART & ÖZEL 90° GÖVDE MENTEŞELERİ (Tam Bini / Yarı Bini / İçte / 155° / 165° / Cam / İnce)
  // =========================================================================
  const isInset = profile.crankType === "inset";
  const isHalf = profile.crankType === "half_overlay";
  const isWideAngle = profile.variant === "blum_155_zero" || profile.variant === "hettich_sensys_165";
  const isGlass = profile.fixingType === "uv_adhesive";
  const isThin = profile.fixingType === "expando_t_10";

  const s = isWideAngle ? 2.15 : 2.35; // 155°/165° daha uzun kol nedeniyle 2.15 px/mm
  const effDoorTMm = isGlass ? 6 : isThin ? Math.min(12, Math.max(8, doorT)) : profile.variant === "blum_95_thick" ? Math.max(22, doorT) : doorT;
  const pT = T * s;
  const dT = effDoorTMm * s;
  const gap = 2.0 * s;

  const sideX = x - (isWideAngle ? 84 : 78);
  const sideFrontY = isInset ? y - dT - 6 : y - 6;
  const overlayMm = isInset ? 0 : isHalf ? Math.round(T / 2 - 2) : Math.max(0, T - 2);
  const doorLeftX = isInset ? sideX + pT + 2.5 * s : sideX + pT - overlayMm * s;
  const doorTopY = isInset ? sideFrontY : sideFrontY - gap - dT;
  const doorBotY = doorTopY + dT;

  const effectiveSetbackMm = isGlass ? 22 : isThin ? 23.5 : hingeSetbackMm;
  const cupCx = doorLeftX + effectiveSetbackMm * s;
  const plateSetbackMm = isInset ? Math.round(37 + effDoorTMm + 1.5) : 37;
  const plateY = sideFrontY + plateSetbackMm * s;
  const sideInnerX = sideX + pT;
  const plateTopX = sideInnerX + (8.5 + profile.plateHeightMm) * s;

  // 1) Kapak Paneli Kesiti (Ahşap tarama / Cam mavi yarı saydam / İnce HPL)
  const doorPanelSvg = isGlass
    ? `
      <rect x="${doorLeftX.toFixed(1)}" y="${doorTopY.toFixed(1)}" width="155" height="${dT.toFixed(1)}" fill="#E0F2FE" stroke="#0369A1" stroke-width="1.5" />
      <line x1="${(doorLeftX + 18).toFixed(1)}" y1="${(doorTopY + 2).toFixed(1)}" x2="${(doorLeftX + 10).toFixed(1)}" y2="${(doorBotY - 2).toFixed(1)}" stroke="#0284C7" stroke-width="0.9" />
      <line x1="${(doorLeftX + 24).toFixed(1)}" y1="${(doorTopY + 2).toFixed(1)}" x2="${(doorLeftX + 16).toFixed(1)}" y2="${(doorBotY - 2).toFixed(1)}" stroke="#0284C7" stroke-width="0.9" />
    `
    : `<rect x="${doorLeftX.toFixed(1)}" y="${doorTopY.toFixed(1)}" width="155" height="${dT.toFixed(1)}" fill="url(#${hatchId})" stroke="${strokeCol}" stroke-width="1.6" />`;

  // 2) Kapak Bağlantı Başlığı (Ø35 Tas / CRISTALLO UV Plaka / EXPANDO T Ø10×6)
  let cupOrFixingSvg = "";
  let cupDimSvg = "";
  if (isGlass) {
    // Blum CRISTALLO 71B4500C: 30.2mm genişlik × 8.28mm yükseklik UV yapıştırma plakası (DELİKSİZ!)
    const adhW = 30.2 * s;
    const adhH = 8.28 * s;
    cupOrFixingSvg = `
      <!-- UV Yapıştırıcı Tabakası (Cam Deliksiz!) -->
      <rect x="${(cupCx - adhW / 2).toFixed(1)}" y="${doorBotY.toFixed(1)}" width="${adhW.toFixed(1)}" height="${(1.4 * s).toFixed(1)}" fill="#38BDF8" stroke="#0284C7" stroke-width="0.6" />
      <!-- CRISTALLO Mat Nikel Yapıştırma Plakası (52×30.2×8.28mm) -->
      <rect x="${(cupCx - adhW / 2).toFixed(1)}" y="${(doorBotY + 1.4 * s).toFixed(1)}" width="${adhW.toFixed(1)}" height="${(adhH - 1.4 * s).toFixed(1)}" rx="1.5" fill="${metalLight}" stroke="${strokeCol}" stroke-width="1.15" />
      <!-- Clip-on CRISTALLO Menteşe Başlığı -->
      <rect x="${(cupCx - 11 * s).toFixed(1)}" y="${(doorBotY + 2.5 * s).toFixed(1)}" width="${(22 * s).toFixed(1)}" height="${(7.5 * s).toFixed(1)}" rx="1" fill="${metalMid}" stroke="${strokeCol}" stroke-width="0.9" />
      <circle cx="${(cupCx - 6 * s).toFixed(1)}" cy="${(doorBotY + 6 * s).toFixed(1)}" r="${(1.8 * s).toFixed(1)}" fill="#FFFFFF" stroke="${strokeCol}" stroke-width="0.85" />
    `;
    cupDimSvg = `
      ${renderDimLine(cupCx - adhW / 2, doorBotY + 22, cupCx + adhW / 2, doorBotY + 22, "30.2 (UV)", "horizontal", doorBotY + adhH)}
      ${renderLeaderCallout(cupCx + adhW * 0.25, doorBotY + adhH * 0.5, cupCx + 36, doorTopY - 22, "UV Plaka (6mm Cam)", "start")}
    `;
  } else if (isThin) {
    // Blum EXPANDO T 71B3550T: 2× Ø10×6.0mm çelik çekme dübeli + 2.2mm flanş (Ø35 tas YOK!)
    const dDia = 10 * s;
    const dDep = 6.0 * s;
    const flgW = 22 * s;
    cupOrFixingSvg = `
      <!-- Ø10×6.0mm EXPANDO T Çelik Çekme Dübeli -->
      <rect x="${(cupCx - dDia / 2).toFixed(1)}" y="${(doorBotY - dDep).toFixed(1)}" width="${dDia.toFixed(1)}" height="${dDep.toFixed(1)}" fill="#FFFFFF" stroke="${CAD_COLORS.dim}" stroke-width="1.2" />
      <rect x="${(cupCx - dDia / 2 + 1.2).toFixed(1)}" y="${(doorBotY - dDep + 1).toFixed(1)}" width="${(dDia - 2.4).toFixed(1)}" height="${(dDep - 1).toFixed(1)}" fill="${metalDark}" stroke="${strokeCol}" stroke-width="0.75" />
      <rect x="${(cupCx - 1.6 * s).toFixed(1)}" y="${(doorBotY - dDep + 0.5).toFixed(1)}" width="${(3.2 * s).toFixed(1)}" height="${(dDep + 2 * s).toFixed(1)}" fill="${metalLight}" stroke="${strokeCol}" stroke-width="0.7" />
      <!-- 2.2mm EXPANDO T İnce Flanş -->
      <rect x="${(cupCx - flgW / 2).toFixed(1)}" y="${doorBotY.toFixed(1)}" width="${flgW.toFixed(1)}" height="${(2.6 * s).toFixed(1)}" rx="1" fill="${metalLight}" stroke="${strokeCol}" stroke-width="1.05" />
    `;
    cupDimSvg = `
      ${renderDimLine(cupCx - dDia / 2, doorBotY + 22, cupCx + dDia / 2, doorBotY + 22, "Ø10", "horizontal", doorBotY)}
      ${renderLeaderCallout(cupCx + dDia * 0.3, doorBotY - dDep * 0.5, cupCx + 34, doorTopY - 22, "EXPANDO T Der. 6.0 mm", "start")}
    `;
  } else {
    const cupW = profile.cupDiaMm * s;
    const cupD = profile.cupDepthMm * s;
    const tbMm = Math.max(3, Math.round((effectiveSetbackMm - profile.cupDiaMm / 2) * 10) / 10);
    cupOrFixingSvg = renderCupBodySection(cupCx, doorBotY, s, profile, metalLight, metalMid, metalDark, strokeCol);
    cupDimSvg = `
      ${renderDimLine(doorLeftX, doorTopY - 20, cupCx - cupW / 2, doorTopY - 20, `K=${tbMm}`, "horizontal", doorTopY)}
      ${renderDimLine(cupCx - cupW / 2, doorBotY + 22, cupCx + cupW / 2, doorBotY + 22, `Ø${profile.cupDiaMm}`, "horizontal", doorBotY)}
      ${renderLeaderCallout(cupCx + cupW * 0.22, doorBotY - cupD * 0.5, cupCx + 38, doorTopY - 22, `Derinlik ${profile.cupDepthMm} mm`, "start")}
    `;
  }

  // 3) Üreticiye ve Mekanizmaya Özgü Gerçekçi Menteşe Kolu & Mafsal Çizimi
  let armSvg = "";
  const armBaseX = plateTopX;
  const armOuterX = armBaseX + 9.2 * s;
  const armTailY = plateY + 18 * s;

  if (isWideAngle) {
    // 155° Blum 71B7550 & 165° Hettich Sensys 8657i: 7-Eksenli Çift Mafsallı Makas Mekanizması!
    const knuckleX = armOuterX + 9 * s;
    const knuckleY = sideFrontY + 12 * s;
    const cupPinX = cupCx - 11 * s;
    const cupPinY = doorBotY + 2 * s;
    armSvg = `
      <g class="cad-hinge-wide-scissor-arm">
        <!-- Uzun Geniş Açılım Kol Gövdesi -->
        <path d="
          M ${armBaseX.toFixed(1)},${(sideFrontY + 14 * s).toFixed(1)}
          L ${armOuterX.toFixed(1)},${(sideFrontY + 14 * s).toFixed(1)}
          L ${armOuterX.toFixed(1)},${armTailY.toFixed(1)}
          L ${armBaseX.toFixed(1)},${(armTailY + 3 * s).toFixed(1)}
          Z
        " fill="${metalLight}" stroke="${strokeCol}" stroke-width="1.15" stroke-linejoin="round" />
        <!-- 7-Eksenli Makas Kolları (Dış & İç Çift Bağlantı) -->
        <path d="
          M ${cupPinX.toFixed(1)},${cupPinY.toFixed(1)}
          L ${knuckleX.toFixed(1)},${knuckleY.toFixed(1)}
          L ${armOuterX.toFixed(1)},${(sideFrontY + 24 * s).toFixed(1)}
          L ${(armOuterX - 4 * s).toFixed(1)},${(sideFrontY + 24 * s).toFixed(1)}
          L ${(knuckleX - 5 * s).toFixed(1)},${(knuckleY + 2 * s).toFixed(1)}
          L ${(cupPinX - 6 * s).toFixed(1)},${cupPinY.toFixed(1)}
          Z
        " fill="${metalMid}" stroke="${strokeCol}" stroke-width="1.05" stroke-linejoin="round" />
        <line x1="${(cupPinX + 6 * s).toFixed(1)}" y1="${cupPinY.toFixed(1)}" x2="${(knuckleX - 2 * s).toFixed(1)}" y2="${(knuckleY + 10 * s).toFixed(1)}" stroke="${strokeCol}" stroke-width="2.4" stroke-linecap="round" />
        <line x1="${(cupPinX + 6 * s).toFixed(1)}" y1="${cupPinY.toFixed(1)}" x2="${(knuckleX - 2 * s).toFixed(1)}" y2="${(knuckleY + 10 * s).toFixed(1)}" stroke="${metalLight}" stroke-width="1.1" stroke-linecap="round" />
        <!-- Orta Yüzer Mafsal Bloğu & Pimler -->
        <rect x="${(knuckleX - 6 * s).toFixed(1)}" y="${(knuckleY - 3 * s).toFixed(1)}" width="${(8 * s).toFixed(1)}" height="${(13 * s).toFixed(1)}" rx="2" fill="${metalLight}" stroke="${strokeCol}" stroke-width="1" />
        <circle cx="${(knuckleX - 2 * s).toFixed(1)}" cy="${(knuckleY + 0.5 * s).toFixed(1)}" r="${(1.8 * s).toFixed(1)}" fill="#FFFFFF" stroke="${strokeCol}" stroke-width="0.85" />
        <circle cx="${(knuckleX - 2 * s).toFixed(1)}" cy="${(knuckleY + 7 * s).toFixed(1)}" r="${(1.8 * s).toFixed(1)}" fill="#FFFFFF" stroke="${strokeCol}" stroke-width="0.85" />
        <!-- Ayar Vidaları & CLIP Kuyruğu -->
        <circle cx="${(armBaseX + 4.6 * s).toFixed(1)}" cy="${(plateY - 6 * s).toFixed(1)}" r="${(2.1 * s).toFixed(1)}" fill="#FFFFFF" stroke="${strokeCol}" stroke-width="0.85" />
        <circle cx="${(armBaseX + 4.6 * s).toFixed(1)}" cy="${(plateY + 6 * s).toFixed(1)}" r="${(2.1 * s).toFixed(1)}" fill="#FFFFFF" stroke="${strokeCol}" stroke-width="0.85" />
      </g>
    `;
  } else {
    // Standart 95°/107°/110° Düz / 9.5mm Yarı Bini / 18mm İçte Kranklı Menteşe Kolu
    const cupEntryX = cupCx - (isGlass || isThin ? 6 : 11) * s;
    const cupEntryY = isGlass ? doorBotY + 8 * s : doorBotY + 1.5 * s;
    const neckY = isInset
      ? sideFrontY + (effDoorTMm + 10) * s
      : isHalf
      ? sideFrontY + 11 * s
      : sideFrontY + 7 * s;

    // Krank geometrisine göre gerçek mekanik sac gövde konturu
    const armOutlinePath = isInset
      ? `
        M ${cupEntryX.toFixed(1)},${cupEntryY.toFixed(1)}
        L ${cupEntryX.toFixed(1)},${(neckY - 4 * s).toFixed(1)}
        C ${cupEntryX.toFixed(1)},${(neckY + 4 * s).toFixed(1)} ${(armOuterX + 3 * s).toFixed(1)},${(neckY - 2 * s).toFixed(1)} ${armOuterX.toFixed(1)},${(neckY + 6 * s).toFixed(1)}
        L ${armOuterX.toFixed(1)},${armTailY.toFixed(1)}
        L ${armBaseX.toFixed(1)},${(armTailY + 2 * s).toFixed(1)}
        L ${armBaseX.toFixed(1)},${(neckY + 1 * s).toFixed(1)}
        C ${armBaseX.toFixed(1)},${(neckY - 6 * s).toFixed(1)} ${(cupEntryX - 7 * s).toFixed(1)},${(neckY - 1 * s).toFixed(1)} ${(cupEntryX - 7 * s).toFixed(1)},${(neckY - 8 * s).toFixed(1)}
        L ${(cupEntryX - 7 * s).toFixed(1)},${cupEntryY.toFixed(1)}
        Z
      `
      : isHalf
      ? `
        M ${cupEntryX.toFixed(1)},${cupEntryY.toFixed(1)}
        L ${cupEntryX.toFixed(1)},${neckY.toFixed(1)}
        L ${armOuterX.toFixed(1)},${(neckY + 7 * s).toFixed(1)}
        L ${armOuterX.toFixed(1)},${armTailY.toFixed(1)}
        L ${armBaseX.toFixed(1)},${(armTailY + 2 * s).toFixed(1)}
        L ${armBaseX.toFixed(1)},${(neckY + 5 * s).toFixed(1)}
        L ${(cupEntryX - 7.5 * s).toFixed(1)},${(neckY - 1 * s).toFixed(1)}
        L ${(cupEntryX - 7.5 * s).toFixed(1)},${cupEntryY.toFixed(1)}
        Z
      `
      : `
        M ${cupEntryX.toFixed(1)},${cupEntryY.toFixed(1)}
        L ${armOuterX.toFixed(1)},${(neckY + 5 * s).toFixed(1)}
        L ${armOuterX.toFixed(1)},${armTailY.toFixed(1)}
        L ${armBaseX.toFixed(1)},${(armTailY + 2 * s).toFixed(1)}
        L ${armBaseX.toFixed(1)},${(neckY + 4 * s).toFixed(1)}
        L ${(cupEntryX - 7.5 * s).toFixed(1)},${cupEntryY.toFixed(1)}
        Z
      `;

    // Üreticiye özgü kol üzeri detay (Hettich kapak şapkası / Grass 3 kademeli fren / Blum spiral vida)
    let brandArmFeature = "";
    if (profile.manufacturer === "Hettich") {
      // Hettich Sensys düz estetik kapak kapağı (Cover Cap) + kol içi Silent System
      brandArmFeature = `
        <rect x="${(armOuterX - 2.2 * s).toFixed(1)}" y="${(plateY - 12 * s).toFixed(1)}" width="${(2.6 * s).toFixed(1)}" height="${(26 * s).toFixed(1)}" rx="1" fill="${metalDark}" stroke="${strokeCol}" stroke-width="0.7" />
      `;
    } else if (profile.manufacturer === "Grass") {
      // Grass Tiomos 3 kademeli entegre fren ayar çarkı
      brandArmFeature = `
        <rect x="${(armBaseX + 1.5 * s).toFixed(1)}" y="${(plateY - 13 * s).toFixed(1)}" width="${(6 * s).toFixed(1)}" height="${(6 * s).toFixed(1)}" rx="1" fill="#F59E0B" stroke="${strokeCol}" stroke-width="0.7" />
      `;
    }

    armSvg = `
      <g class="cad-hinge-articulated-arm">
        <!-- Çelik Menteşe Kolu Gövdesi -->
        <path d="${armOutlinePath}" fill="${metalLight}" stroke="${strokeCol}" stroke-width="1.15" stroke-linejoin="round" />
        <!-- İç Mafsal Bağlantı Kolu -->
        <line x1="${(cupEntryX - 3.5 * s).toFixed(1)}" y1="${cupEntryY.toFixed(1)}" x2="${(armBaseX + 4.2 * s).toFixed(1)}" y2="${(neckY + 8 * s).toFixed(1)}" stroke="${strokeCol}" stroke-width="1.35" />
        ${brandArmFeature}
        <!-- Yan Ayar Vidası (±2mm) & Spiral Derinlik Vidası (+3/-2mm) -->
        <circle cx="${(armBaseX + 4.5 * s).toFixed(1)}" cy="${(plateY - 4 * s).toFixed(1)}" r="${(2.1 * s).toFixed(1)}" fill="#FFFFFF" stroke="${strokeCol}" stroke-width="0.85" />
        <line x1="${(armBaseX + 3.0 * s).toFixed(1)}" y1="${(plateY - 4 * s).toFixed(1)}" x2="${(armBaseX + 6.0 * s).toFixed(1)}" y2="${(plateY - 4 * s).toFixed(1)}" stroke="${strokeCol}" stroke-width="0.75" />
        <circle cx="${(armBaseX + 4.5 * s).toFixed(1)}" cy="${(plateY + 6.5 * s).toFixed(1)}" r="${(2.2 * s).toFixed(1)}" fill="#FFFFFF" stroke="${strokeCol}" stroke-width="0.85" />
        <circle cx="${(armBaseX + 4.5 * s).toFixed(1)}" cy="${(plateY + 6.5 * s).toFixed(1)}" r="${(0.8 * s).toFixed(1)}" fill="${strokeCol}" />
        <!-- Arka CLIP Sökme Mandalı -->
        <path d="M ${armBaseX.toFixed(1)},${(armTailY - 2 * s).toFixed(1)} L ${(armBaseX + 3.5 * s).toFixed(1)},${(armTailY + 5 * s).toFixed(1)} L ${(armBaseX + 7 * s).toFixed(1)},${(armTailY + 1 * s).toFixed(1)}" fill="${metalDark}" stroke="${strokeCol}" stroke-width="0.85" />
      </g>
    `;
  }

  return `
    <!-- Gövde Yan Dikme Kesiti (${T}mm) -->
    <rect x="${sideX.toFixed(1)}" y="${sideFrontY.toFixed(1)}" width="${pT.toFixed(1)}" height="${(R + 24).toFixed(1)}" fill="url(#${hatchId})" stroke="${strokeCol}" stroke-width="1.6" />
    <!-- Kapak Paneli Kesiti (${effDoorTMm}mm) -->
    ${doorPanelSvg}
    <!-- Kapak Menteşe Tası / Bağlantısı -->
    ${cupOrFixingSvg}
    <!-- Tas Merkez Ekseni -->
    <line x1="${cupCx.toFixed(1)}" y1="${(doorTopY - 12).toFixed(1)}" x2="${cupCx.toFixed(1)}" y2="${(doorBotY + 28).toFixed(1)}" stroke="${CAD_COLORS.plane}" stroke-width="0.8" stroke-dasharray="5 2 1.5 2" />
    <!-- Gövde Montaj Tablası (${profile.plateSku}) -->
    ${renderMountingPlateSection(sideInnerX, plateY, s, profile, metalMid, metalDark, strokeCol)}
    <!-- Gerçek Mekanik Menteşe Kolu -->
    ${armSvg}
    <!-- Teknik Ölçülendirme -->
    ${cupDimSvg}
    ${renderDimLine(sideX, sideFrontY + 124, sideX + pT, sideFrontY + 124, `${T}`, "horizontal", sideFrontY + 105)}
    ${renderDimLine(cupCx + (isWideAngle ? 58 : isThin ? 28 : 44), sideFrontY, cupCx + (isWideAngle ? 58 : isThin ? 28 : 44), plateY, `${plateSetbackMm}`, "vertical", sideInnerX)}
    ${
      overlayMm > 0
        ? renderDimLine(doorLeftX, doorTopY - 42, sideInnerX, doorTopY - 42, `Bini ${overlayMm}`, "horizontal", doorTopY)
        : ""
    }
    ${headerSvg}
  `;
}

/**
 * PAFTA 05 — MENTEŞE TAS DELİĞİ (1:1)
 * Seçili menteşenin üretici şablonuna (Blum 45×9.5, Hettich TH52 52×5.5, Salice 48×9,
 * Grass 45×9.5, CRISTALLO UV 52×30.2 deliksiz, EXPANDO T 2×Ø10×6 @ 32mm) göre
 * gerçek flanş silüeti ve delik eksenlerini çizer.
 */
export function renderHingeDrillingDetail1to1Svg(params: {
  hCx: number;
  hCy: number;
  hR: number;
  modId: string;
  cupDiaMm: number;
  cupDepthMm: number;
  cupSetbackMm: number;
  dowelPitchMm: number;
  dowelOffsetMm: number;
  kMarginMm: number;
  profile: HingeTechnicalProfile;
}): string {
  const {
    hCx,
    hCy,
    hR,
    modId,
    cupDiaMm,
    cupDepthMm,
    cupSetbackMm,
    dowelPitchMm,
    dowelOffsetMm,
    kMarginMm,
    profile,
  } = params;

  const ds = 1.65;
  const doorEdgeX = hCx - 42;
  const hingeClipId = `hinge-1to1-clip-${modId}`;

  // ÖZEL 1: BLUM CRISTALLO (DELİKSİZ UV YAPIŞTIRMA PLAKASI)
  if (profile.fixingType === "uv_adhesive") {
    const plateW = 30.2 * ds;
    const plateH = 52 * ds;
    const plateLeft = doorEdgeX + 7 * ds;
    return `
      <defs><clipPath id="${hingeClipId}"><circle cx="${hCx}" cy="${hCy}" r="${hR - 1}" /></clipPath></defs>
      <circle cx="${hCx}" cy="${hCy}" r="${hR}" fill="#F8FAFC" stroke="${CAD_COLORS.ink}" stroke-width="1.3" />
      <g clip-path="url(#${hingeClipId})">
        <rect x="${doorEdgeX}" y="${hCy - hR}" width="${hR * 2}" height="${hR * 2}" fill="#F0F9FF" />
        <line x1="${doorEdgeX}" y1="${hCy - hR}" x2="${doorEdgeX}" y2="${hCy + hR}" stroke="#0369A1" stroke-width="2" />
        <!-- UV Yapıştırma Plakası (52×30.2mm) -->
        <rect x="${plateLeft.toFixed(1)}" y="${(hCy - plateH / 2).toFixed(1)}" width="${plateW.toFixed(1)}" height="${plateH.toFixed(1)}" rx="3" fill="#E2E8F0" stroke="${CAD_COLORS.ink}" stroke-width="1.3" />
        <rect x="${(plateLeft + 5).toFixed(1)}" y="${(hCy - plateH / 2 + 8).toFixed(1)}" width="${(plateW - 10).toFixed(1)}" height="${(plateH - 16).toFixed(1)}" rx="2" fill="#FFFFFF" stroke="${CAD_COLORS.plane}" stroke-width="0.8" stroke-dasharray="3 2" />
        <line x1="${doorEdgeX - 6}" y1="${hCy}" x2="${(plateLeft + plateW + 16).toFixed(1)}" y2="${hCy}" stroke="${CAD_COLORS.plane}" stroke-width="0.75" stroke-dasharray="5 1.5 1.5 1.5" />
        ${renderDimLine(plateLeft, hCy - plateH / 2 - 12, plateLeft + plateW, hCy - plateH / 2 - 12, "30.2", "horizontal", hCy - plateH / 2)}
        ${renderDimLine(plateLeft + plateW + 14, hCy - plateH / 2, plateLeft + plateW + 14, hCy + plateH / 2, "52", "vertical", plateLeft + plateW)}
        <text x="${(plateLeft + plateW / 2).toFixed(1)}" y="${(hCy + 3).toFixed(1)}" text-anchor="middle" font-family="ui-monospace, monospace" font-size="9.5" font-weight="800" fill="#0369A1">UV CAM</text>
      </g>
      ${renderViewCaption(hCx, hCy + hR + 16, "MENTEŞE TAS DELİĞİ (1:1)", `${profile.sku} • DELİKSİZ UV PLAKA 52×30.2 mm`)}
    `;
  }

  // ÖZEL 2: BLUM EXPANDO T (2×Ø10×6.0mm, 32mm EKSEN, TAS DELİĞİ YOK)
  if (profile.fixingType === "expando_t_10") {
    const holeX = doorEdgeX + 23.5 * ds;
    const halfPitch = 16 * ds; // 32mm / 2
    const holeR = 5 * ds; // Ø10mm
    const flgW = 22 * ds;
    const flgH = 44 * ds;
    return `
      <defs><clipPath id="${hingeClipId}"><circle cx="${hCx}" cy="${hCy}" r="${hR - 1}" /></clipPath></defs>
      <circle cx="${hCx}" cy="${hCy}" r="${hR}" fill="#F8FAFC" stroke="${CAD_COLORS.ink}" stroke-width="1.3" />
      <g clip-path="url(#${hingeClipId})">
        <rect x="${doorEdgeX}" y="${hCy - hR}" width="${hR * 2}" height="${hR * 2}" fill="#FFFFFF" />
        <rect x="${doorEdgeX - 3}" y="${hCy - hR}" width="3" height="${hR * 2}" fill="#CBD5E1" />
        <line x1="${doorEdgeX}" y1="${hCy - hR}" x2="${doorEdgeX}" y2="${hCy + hR}" stroke="${CAD_COLORS.ink}" stroke-width="2" />
        <!-- 44×22mm EXPANDO T Flanş Silüeti -->
        <rect x="${(holeX - flgW / 2).toFixed(1)}" y="${(hCy - flgH / 2).toFixed(1)}" width="${flgW.toFixed(1)}" height="${flgH.toFixed(1)}" rx="5" fill="#F1F5F9" stroke="#94A3B8" stroke-width="0.9" stroke-dasharray="3 2" />
        <line x1="${doorEdgeX - 6}" y1="${hCy}" x2="${(holeX + 24).toFixed(1)}" y2="${hCy}" stroke="${CAD_COLORS.plane}" stroke-width="0.75" stroke-dasharray="5 1.5 1.5 1.5" />
        <line x1="${holeX.toFixed(1)}" y1="${(hCy - halfPitch - 14).toFixed(1)}" x2="${holeX.toFixed(1)}" y2="${(hCy + halfPitch + 14).toFixed(1)}" stroke="${CAD_COLORS.plane}" stroke-width="0.75" stroke-dasharray="5 1.5 1.5 1.5" />
        <!-- 2×Ø10×6.0mm Dübel Delikleri -->
        <circle cx="${holeX.toFixed(1)}" cy="${(hCy - halfPitch).toFixed(1)}" r="${holeR.toFixed(1)}" fill="#FFFFFF" stroke="${CAD_COLORS.dim}" stroke-width="1.4" />
        <circle cx="${holeX.toFixed(1)}" cy="${(hCy + halfPitch).toFixed(1)}" r="${holeR.toFixed(1)}" fill="#FFFFFF" stroke="${CAD_COLORS.dim}" stroke-width="1.4" />
        ${renderDimLine(doorEdgeX, hCy - halfPitch - 14, holeX, hCy - halfPitch - 14, "23.5", "horizontal", hCy - halfPitch)}
        ${renderDimLine(holeX + 26, hCy - halfPitch, holeX + 26, hCy + halfPitch, "32", "vertical", holeX)}
        <text x="${(holeX - 18).toFixed(1)}" y="${(hCy + 3).toFixed(1)}" text-anchor="middle" font-family="ui-monospace, monospace" font-size="9.5" font-weight="800" fill="${CAD_COLORS.dim}">2×Ø10</text>
      </g>
      ${renderViewCaption(hCx, hCy + hR + 16, "MENTEŞE TAS DELİĞİ (1:1)", `${profile.sku} • EXPANDO T: 2×Ø10×6.0 mm • 32 mm Eksen`)}
    `;
  }

  // STANDART Ø35mm TAS MENTEŞE DELİK & GERÇEK FLANŞ ŞABLONU
  const effCupDepth = profile.cupDepthMm || cupDepthMm;
  const effPitch = dowelPitchMm || profile.bossPitchMm;
  const effOffset = dowelOffsetMm || profile.bossOffsetMm;
  const cupSvgCx = doorEdgeX + cupSetbackMm * ds;
  const dowelSvgCx = cupSvgCx + effOffset * ds;
  const dowelHalfY = (effPitch / 2) * ds;
  const cupRadiusPx = (cupDiaMm / 2) * ds;
  const bossHoleR = (profile.bossHoleDiaMm / 2) * ds;
  const flangeH = profile.flangeWidthMm * ds;
  const flangeW = profile.flangeLengthMm * ds;

  return `
    <defs><clipPath id="${hingeClipId}"><circle cx="${hCx}" cy="${hCy}" r="${hR - 1}" /></clipPath></defs>
    <circle cx="${hCx}" cy="${hCy}" r="${hR}" fill="#F8FAFC" stroke="${CAD_COLORS.ink}" stroke-width="1.3" />
    <g clip-path="url(#${hingeClipId})">
      <!-- Kapak iç yüzeyi -->
      <rect x="${doorEdgeX}" y="${hCy - hR}" width="${hR * 2}" height="${hR * 2}" fill="#FFFFFF" />
      <!-- 1mm PVC Kenar Bandı + Kapak Kenar Çizgisi -->
      <rect x="${doorEdgeX - 3}" y="${hCy - hR}" width="3" height="${hR * 2}" fill="#CBD5E1" />
      <line x1="${doorEdgeX}" y1="${hCy - hR}" x2="${doorEdgeX}" y2="${hCy + hR}" stroke="${CAD_COLORS.ink}" stroke-width="2" />
      <!-- Gerçek Üretici Menteşe Flanş Silüeti (${profile.flangeWidthMm}×${profile.flangeLengthMm}mm) -->
      <rect x="${(dowelSvgCx - flangeW * 0.45).toFixed(1)}" y="${(hCy - flangeH / 2).toFixed(1)}" width="${flangeW.toFixed(1)}" height="${flangeH.toFixed(1)}" rx="6" fill="#F1F5F9" stroke="#94A3B8" stroke-width="0.9" stroke-dasharray="3 2" />
      <!-- Merkez Eksenler -->
      <line x1="${doorEdgeX - 8}" y1="${hCy}" x2="${(dowelSvgCx + 22).toFixed(1)}" y2="${hCy}" stroke="${CAD_COLORS.plane}" stroke-width="0.75" stroke-dasharray="5 1.5 1.5 1.5" />
      <line x1="${cupSvgCx.toFixed(1)}" y1="${(hCy - cupRadiusPx - 16).toFixed(1)}" x2="${cupSvgCx.toFixed(1)}" y2="${(hCy + cupRadiusPx + 14).toFixed(1)}" stroke="${CAD_COLORS.plane}" stroke-width="0.75" stroke-dasharray="5 1.5 1.5 1.5" />
      <line x1="${dowelSvgCx.toFixed(1)}" y1="${(hCy - dowelHalfY - 12).toFixed(1)}" x2="${dowelSvgCx.toFixed(1)}" y2="${(hCy + dowelHalfY + 12).toFixed(1)}" stroke="${CAD_COLORS.plane}" stroke-width="0.65" stroke-dasharray="4 1.5 1 1.5" />
      <!-- Ø35 Tas Deliği & 2× Üretici Dübel/Vida Delikleri -->
      <circle cx="${cupSvgCx.toFixed(1)}" cy="${hCy.toFixed(1)}" r="${cupRadiusPx.toFixed(1)}" fill="#FFFFFF" stroke="${CAD_COLORS.dim}" stroke-width="1.5" />
      <circle cx="${cupSvgCx.toFixed(1)}" cy="${hCy.toFixed(1)}" r="${(cupRadiusPx - 3).toFixed(1)}" fill="none" stroke="#CBD5E1" stroke-width="0.7" stroke-dasharray="3 2" />
      <circle cx="${dowelSvgCx.toFixed(1)}" cy="${(hCy - dowelHalfY).toFixed(1)}" r="${bossHoleR.toFixed(1)}" fill="#FFFFFF" stroke="${CAD_COLORS.ink}" stroke-width="1.2" />
      <circle cx="${dowelSvgCx.toFixed(1)}" cy="${(hCy + dowelHalfY).toFixed(1)}" r="${bossHoleR.toFixed(1)}" fill="#FFFFFF" stroke="${CAD_COLORS.ink}" stroke-width="1.2" />
      <!-- Ölçüler -->
      ${renderDimLine(doorEdgeX, hCy - cupRadiusPx - 14, cupSvgCx, hCy - cupRadiusPx - 14, `${cupSetbackMm}`, "horizontal", hCy - cupRadiusPx)}
      ${renderDimLine(dowelSvgCx + 18, hCy - dowelHalfY, dowelSvgCx + 18, hCy + dowelHalfY, `${effPitch}`, "vertical", dowelSvgCx)}
      ${renderDimLine(doorEdgeX, hCy + cupRadiusPx + 14, cupSvgCx - cupRadiusPx, hCy + cupRadiusPx + 14, `K=${kMarginMm}`, "horizontal", hCy)}
      <text x="${cupSvgCx.toFixed(1)}" y="${(hCy - 8).toFixed(1)}" text-anchor="middle" font-family="ui-monospace, monospace" font-size="10.5" font-weight="800" fill="${CAD_COLORS.dim}">Ø${cupDiaMm}</text>
      <text x="${cupSvgCx.toFixed(1)}" y="${(hCy + 7).toFixed(1)}" text-anchor="middle" font-family="ui-monospace, monospace" font-size="9.0" font-weight="700" fill="${CAD_COLORS.subInk}">${escXml(profile.sku)}</text>
    </g>
    ${renderViewCaption(hCx, hCy + hR + 16, "MENTEŞE TAS DELİĞİ (1:1)", `${profile.manufacturer} ${profile.sku} • Der: ${effCupDepth} mm • ${effPitch}×${effOffset} mm • K=${kMarginMm}`)}
  `;
}
