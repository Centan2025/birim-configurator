import { UnitLength } from "./types";

/**
 * Merkezi Sayısal Hassasiyet, Yuvarlama ve Tolerans Politikası (Bölüm 2 & P3-02).
 * Tüm monorepo paketleri (@birim/core, @birim/geometry, @birim/manufacturing)
 * rastgele Math.round çağrıları yerine bu deterministik politikayı kullanır.
 */
export const ENGINEERING_TOLERANCE_POLICY = {
  /** Dahili parametrik geometri, trigonometrik dönüşüm ve 3B düğüm hassasiyeti (0.001 mm) */
  INTERNAL_GEOMETRY_DECIMALS: 3,
  /** Nokta-nokta ve Nesting CNC delik/kanal koordinat hassasiyeti (0.01 mm) */
  CNC_COORDINATE_DECIMALS: 2,
  /** Ebatlama testeresi (Selco / OptiCut) net kesim ölçü hassasiyeti (0.1 mm) */
  SAW_CUT_DECIMALS: 1,
  /** Yan yana sıfır temaslı (0.00 mm) modülleri gerçek iç içe geçmeden ayıran temas eşiği (0.05 mm) */
  OBB_CONTACT_EPSILON_MM: 0.05,
  /** Eşleşen cumba ve yüzey delikleri (kavela/minifix) arasındaki azami eksen kaçıklığı toleransı (0.05 mm) */
  COAXIAL_HOLE_MAX_DEVIATION_MM: 0.05,
  /** Kapalı ölçü zinciri (∑W_bay + (N+1)T = W) azami sayısal sapma sınırı (0.05 mm) */
  DIMENSION_CHAIN_EPSILON_MM: 0.05,
  /** Selco WNT 600 ebatlama testeresi minimum güvenli kıskaç tutma ölçüsü (70 mm) */
  MIN_SAW_GRIPPER_PART_MM: 70,
  /** Standard 2800x2070mm raw board minus 2x15mm perimeter trim saw cut */
  USABLE_STANDARD_SHEET_LENGTH_MM: 2770,
  USABLE_STANDARD_SHEET_WIDTH_MM: 2040,
  /** Minimum Selco / Holzma beam-saw gripper clamping width */

} as const;

export function roundGeometryMm(value: number): UnitLength {
  const f = 10 ** ENGINEERING_TOLERANCE_POLICY.INTERNAL_GEOMETRY_DECIMALS;
  return Math.round((value + Number.EPSILON) * f) / f;
}

export function roundCncCoordMm(value: number): UnitLength {
  const f = 10 ** ENGINEERING_TOLERANCE_POLICY.CNC_COORDINATE_DECIMALS;
  return Math.round((value + Number.EPSILON) * f) / f;
}

export function roundSawCutMm(value: number): UnitLength {
  const f = 10 ** ENGINEERING_TOLERANCE_POLICY.SAW_CUT_DECIMALS;
  return Math.round((value + Number.EPSILON) * f) / f;
}

/**
 * Stoklanabilir artık plaka (remnant) ölçüsü asla yukarı yuvarlanmaz;
 * fiziksel olarak sığmayacak parça atamasını önlemek için aşağı yuvarlanır.
 */
export function floorRemnantMm(value: number): UnitLength {
  return Math.max(0, Math.floor(value + 1e-6));
}

/**
 * Kural Yönetişim Doğası (Bölüm 5 & Bölüm 8):
 * Zorunlu güvenlik/mevzuat kuralları ile ergonomik önerileri kesin biçimde birbirinden ayırır.
 */
export type RuleGovernanceNature =
  | "MANDATORY_SAFETY"       // EN 14749 devrilme, ankastre yangın/havalandırma, cam kırılma güvenliği (Üretimi Kilitler)
  | "ENGINEERING_VALIDITY"   // Geometri çakışması, menteşe/ray kapasitesi, delik eksen uyumu (Üretimi Kilitler)
  | "VERIFICATION_REQUIRED"  // Eksik üretici verisi, özel malzeme/yük veya fabrika numune onayı (Uzman Onayı Gerektirir)
  | "ERGONOMIC_ADVISORY";    // Erişim yüksekliği, konfor koridoru, çalışma üçgeni önerileri (Bilgilendirici Tavsiye)

export type RegionErgonomicProfileId =
  | "TR_RESIDENTIAL"
  | "EU_EN_STANDARD"
  | "ACCESSIBLE_EN17210";

export interface ErgonomicStandardProfile {
  id: RegionErgonomicProfileId;
  name: string;
  standardReference: string;
  sourceId: string;
  kitchenWorktopMinHeightMm: UnitLength;
  kitchenWorktopMaxHeightMm: UnitLength;
  maxComfortableShelfHeightMm: UnitLength;
  maxComfortableHangingRailHeightMm: UnitLength;
  minFrontPassageClearanceMm: UnitLength;
  minParallelKitchenAisleMm: UnitLength;
  requiresKneeClearanceUnderSink: boolean;
  minKneeClearanceHeightMm: UnitLength;
}

export const REGIONAL_ERGONOMIC_PROFILES: Record<
  RegionErgonomicProfileId,
  ErgonomicStandardProfile
> = {
  TR_RESIDENTIAL: {
    id: "TR_RESIDENTIAL",
    name: "Türkiye Konut & İç Mimari Uygulama Profili",
    standardReference: "TS EN 14749 / TS EN 1116 Konut Ergonomisi",
    sourceId: "SRC_EN_14749_2022",
    kitchenWorktopMinHeightMm: 850,
    kitchenWorktopMaxHeightMm: 940,
    maxComfortableShelfHeightMm: 2050,
    maxComfortableHangingRailHeightMm: 2050,
    minFrontPassageClearanceMm: 800,
    minParallelKitchenAisleMm: 1100,
    requiresKneeClearanceUnderSink: false,
    minKneeClearanceHeightMm: 0,
  },
  EU_EN_STANDARD: {
    id: "EU_EN_STANDARD",
    name: "Avrupa Birliği Standart Konut Profili (EN 1116 / DIN 18022)",
    standardReference: "EN 1116:2018 & EN 16122:2012",
    sourceId: "SRC_EN_16122_2012",
    kitchenWorktopMinHeightMm: 860,
    kitchenWorktopMaxHeightMm: 960,
    maxComfortableShelfHeightMm: 2000,
    maxComfortableHangingRailHeightMm: 2000,
    minFrontPassageClearanceMm: 900,
    minParallelKitchenAisleMm: 1200,
    requiresKneeClearanceUnderSink: false,
    minKneeClearanceHeightMm: 0,
  },
  ACCESSIBLE_EN17210: {
    id: "ACCESSIBLE_EN17210",
    name: "Erişilebilir / Tekerlekli Sandalye Uyumlu Profil (TS 9111 / EN 17210)",
    standardReference: "EN 17210:2021 & TS 9111 Engelsiz Tasarım",
    sourceId: "SRC_EN_17210_ACCESSIBLE",
    kitchenWorktopMinHeightMm: 760,
    kitchenWorktopMaxHeightMm: 840,
    maxComfortableShelfHeightMm: 1400,
    maxComfortableHangingRailHeightMm: 1350,
    minFrontPassageClearanceMm: 1500,
    minParallelKitchenAisleMm: 1500,
    requiresKneeClearanceUnderSink: true,
    minKneeClearanceHeightMm: 670,
  },
};

export function getErgonomicProfile(
  profileId?: RegionErgonomicProfileId | string
): ErgonomicStandardProfile {
  if (profileId && profileId in REGIONAL_ERGONOMIC_PROFILES) {
    return REGIONAL_ERGONOMIC_PROFILES[profileId as RegionErgonomicProfileId];
  }
  return REGIONAL_ERGONOMIC_PROFILES.TR_RESIDENTIAL;
}
