import {
  DoorOverlayType,
  DoorSystemId,
  HandleCategory,
  ModuleFamilyId,
  OpeningTechnology,
  UnitLength,
} from "@birim/core";

export interface VerificationScopeFlags {
  sourceTechDataVerified: boolean;
  cadGeometryVerified: boolean;
  bomFormulaVerified: boolean;
  drillingPatternVerified: boolean;
  physicalFactorySampleTested: boolean;
}

export interface HardwareDrillingTemplate {
  id: string;
  name: string;
  cupDiameterMm: UnitLength;
  cupDepthMm: UnitLength;
  cupEdgeTabMm: UnitLength;
  bossPitchMm: UnitLength; // e.g. 45 (Blum), 52 (Hettich TH52), 48 (Salice)
  bossOffsetMm: UnitLength; // e.g. 9.5 (Blum), 5.5 (Hettich), 9.0 (Salice)
  system32FrontSetbackMm: UnitLength;
  sourceId: string;
}

export interface HardwareProductRecord {
  id: string;
  manufacturerId: "mfr_blum" | "mfr_hettich" | "mfr_hafele" | "mfr_grass" | "mfr_salice" | "mfr_hawa" | "mfr_sugatsune";
  manufacturerName: string;
  familyId:
    | "fam_hinge_concealed"
    | "fam_drawer_box"
    | "fam_runner_concealed"
    | "fam_lift_system"
    | "fam_sliding_system"
    | "fam_pocket_system"
    | "fam_wardrobe_acc"
    | "fam_kitchen_acc"
    | "fam_connector";
  sku: string;
  name: string;
  revision: string;
  lifecycleStatus: "ACTIVE" | "PREFERRED_SUPPLIER" | "DEPRECATED";
  loadCapacityKg: number;
  doorThicknessLimitsMm?: [UnitLength, UnitLength];
  doorWeightLimitsKg?: [number, number];
  powerFactorRangeLf?: [number, number];
  drawerCuttingFormula?: {
    bottomWidthDeductionMm: UnitLength;
    backWidthDeductionMm: UnitLength;
    lengthDeductionMm: UnitLength;
    requiresBottomGroove?: boolean;
  };
  pocketClearanceMm?: {
    pocketWidthMm: UnitLength;
    minCarcassDepthMm: UnitLength;
    minDoorHeightMm: UnitLength;
    maxDoorHeightMm: UnitLength;
  };
  drillingTemplateId?: string;
  compatibleModuleFamilies: ModuleFamilyId[];
  compatibleDoorSystems: DoorSystemId[];
  unitPriceEur: number;
  unit: "adet" | "takım" | "metre";
  sourceId: string;
  verification: VerificationScopeFlags;
}

export interface DoorSystemDefinition {
  id: DoorSystemId;
  name: string;
  description: string;
  leafCount: 1 | 2 | 3 | 4;
  defaultOverlayType: DoorOverlayType;
  kinematicType:
    | "pivot_vertical"
    | "slide_horizontal_top"
    | "slide_horizontal_bottom"
    | "lift_parallel"
    | "lift_bifold"
    | "lift_up_stay"
    | "fold_side"
    | "pocket_retractable"
    | "tambour_roller"
    | "open";
  maxOpenAngleDeg: number;
  minCarcassDepthMm: UnitLength;
  defaultHardwareProductId?: string;
  verifiedForProduction: boolean;
}

export interface HandleProfileDefinition {
  id: string;
  category: HandleCategory;
  name: string;
  holeSpacingCcMm: UnitLength | null;
  protrusionMm: UnitLength;
  doorHeightDeductionMm: UnitLength;
  minDoorThicknessMm: UnitLength;
  unitPriceEur: number;
  sku: string;
}

export interface OpeningMechanismDefinition {
  id: OpeningTechnology;
  name: string;
  description: string;
  requiresHandle: boolean;
  requiresElectricity: boolean;
  triggerGapMm: UnitLength;
  addonUnitPriceEur: number;
}

export const HARDWARE_DRILLING_TEMPLATES: Record<string, HardwareDrillingTemplate> = {
  tpl_drill_blum_hinge_45x95: {
    id: "tpl_drill_blum_hinge_45x95",
    name: "Blum CLIP top BLUMOTION 45×9.5mm Şablonu",
    cupDiameterMm: 35,
    cupDepthMm: 13.0,
    cupEdgeTabMm: 4.0,
    bossPitchMm: 45.0,
    bossOffsetMm: 9.5,
    system32FrontSetbackMm: 37.0,
    sourceId: "SRC_BLUM_CAT_HINGE",
  },
  tpl_drill_blum_155_zero: {
    id: "tpl_drill_blum_155_zero",
    name: "Blum 155° Sıfır Çıkıntı 45×9.5mm (Derinlik 11.7mm)",
    cupDiameterMm: 35,
    cupDepthMm: 11.7,
    cupEdgeTabMm: 4.0,
    bossPitchMm: 45.0,
    bossOffsetMm: 9.5,
    system32FrontSetbackMm: 37.0,
    sourceId: "SRC_BLUM_CAT_HINGE",
  },
  tpl_drill_hettich_th52: {
    id: "tpl_drill_hettich_th52",
    name: "Hettich Sensys TH52 (52×5.5mm) Şablonu",
    cupDiameterMm: 35,
    cupDepthMm: 12.8,
    cupEdgeTabMm: 4.0,
    bossPitchMm: 52.0,
    bossOffsetMm: 5.5,
    system32FrontSetbackMm: 37.0,
    sourceId: "SRC_HETTICH_SENSYS",
  },
  tpl_drill_hettich_165_th52: {
    id: "tpl_drill_hettich_165_th52",
    name: "Hettich Sensys 165° TH52 (52×5.5mm, Derinlik 11.6mm)",
    cupDiameterMm: 35,
    cupDepthMm: 11.6,
    cupEdgeTabMm: 4.0,
    bossPitchMm: 52.0,
    bossOffsetMm: 5.5,
    system32FrontSetbackMm: 37.0,
    sourceId: "SRC_HETTICH_SENSYS",
  },
  tpl_drill_salice_48x9: {
    id: "tpl_drill_salice_48x9",
    name: "Salice Silentia+ 48×9.0mm Şablonu",
    cupDiameterMm: 35,
    cupDepthMm: 12.0,
    cupEdgeTabMm: 4.0,
    bossPitchMm: 48.0,
    bossOffsetMm: 9.0,
    system32FrontSetbackMm: 37.0,
    sourceId: "SRC_SALICE_SILENTIA",
  },
  tpl_drill_grass_tiomos: {
    id: "tpl_drill_grass_tiomos",
    name: "Grass Tiomos 45×9.5mm (Derinlik 12.6mm)",
    cupDiameterMm: 35,
    cupDepthMm: 12.6,
    cupEdgeTabMm: 4.0,
    bossPitchMm: 45.0,
    bossOffsetMm: 9.5,
    system32FrontSetbackMm: 37.0,
    sourceId: "SRC_GRASS_TIOMOS",
  },
};

export const DOOR_SYSTEM_DEFINITIONS: DoorSystemDefinition[] = [
  {
    id: "hinged_single",
    name: "1. Tek Menteşeli Kapak",
    description: "Sol veya sağa açılan standart tam bini menteşeli kapak",
    leafCount: 1,
    defaultOverlayType: "full_overlay",
    kinematicType: "pivot_vertical",
    maxOpenAngleDeg: 110,
    minCarcassDepthMm: 200,
    defaultHardwareProductId: "hw_blum_71b3550",
    verifiedForProduction: true,
  },
  {
    id: "hinged_double",
    name: "2. Çift Menteşeli Kapak",
    description: "Simetrik iki yana açılan çift kanat menteşeli kapak",
    leafCount: 2,
    defaultOverlayType: "full_overlay",
    kinematicType: "pivot_vertical",
    maxOpenAngleDeg: 110,
    minCarcassDepthMm: 200,
    defaultHardwareProductId: "hw_blum_71b3550",
    verifiedForProduction: true,
  },
  {
    id: "hinged_inset",
    name: "3. İçten Menteşeli Kapak (Inset)",
    description: "Gövde yan panellerinin içine gömülen hemzemin (flush) kapak",
    leafCount: 1,
    defaultOverlayType: "inset",
    kinematicType: "pivot_vertical",
    maxOpenAngleDeg: 110,
    minCarcassDepthMm: 250,
    defaultHardwareProductId: "hw_blum_71b3750",
    verifiedForProduction: true,
  },
  {
    id: "hinged_overlay_variant",
    name: "4. Yarım Bini Menteşeli Kapak",
    description: "Ortak ara dikmeyi paylaşan yarım bini (9.5mm krank) menteşeli kapak",
    leafCount: 1,
    defaultOverlayType: "half_overlay",
    kinematicType: "pivot_vertical",
    maxOpenAngleDeg: 110,
    minCarcassDepthMm: 200,
    defaultHardwareProductId: "hw_blum_71b3650",
    verifiedForProduction: true,
  },
  {
    id: "sliding_top_hung",
    name: "5. Üstten Taşımalı Sürgülü Kapak",
    description: "Gövde üst tablasından askılı yavaşlatıcılı sürgü sistemi (TopLine L / Slido)",
    leafCount: 2,
    defaultOverlayType: "full_overlay",
    kinematicType: "slide_horizontal_top",
    maxOpenAngleDeg: 0,
    minCarcassDepthMm: 580,
    defaultHardwareProductId: "hw_hettich_topline_l",
    verifiedForProduction: true,
  },
  {
    id: "sliding_bottom_rolling",
    name: "6. Alttan Taşımalı Sürgülü Kapak",
    description: "Alt tabla rayı üzerinde yürüyen tekerlekli sürgü sistemi",
    leafCount: 2,
    defaultOverlayType: "inset",
    kinematicType: "slide_horizontal_bottom",
    maxOpenAngleDeg: 0,
    minCarcassDepthMm: 580,
    defaultHardwareProductId: "hw_hafele_slido_bottom",
    verifiedForProduction: true,
  },
  {
    id: "lift_parallel",
    name: "7. Paralel Yukarı Kalkar Kapak",
    description: "Gövde önüne paralel yükselen kalkar kapak (AVENTOS HL top / Free Up)",
    leafCount: 1,
    defaultOverlayType: "full_overlay",
    kinematicType: "lift_parallel",
    maxOpenAngleDeg: 90,
    minCarcassDepthMm: 280,
    defaultHardwareProductId: "hw_blum_aventos_hl_25",
    verifiedForProduction: true,
  },
  {
    id: "lift_bi_fold",
    name: "8. Katlanarak Yukarı Kalkar Kapak",
    description: "Yatay iki parçalı katlanır üst dolap kapağı (AVENTOS HF top / Free Fold)",
    leafCount: 2,
    defaultOverlayType: "full_overlay",
    kinematicType: "lift_bifold",
    maxOpenAngleDeg: 105,
    minCarcassDepthMm: 280,
    defaultHardwareProductId: "hw_blum_aventos_hf_25",
    verifiedForProduction: true,
  },
  {
    id: "lift_up_stay",
    name: "9. Döner Yukarı Kalkar Kapak",
    description: "Üstten tek parça yukarı açılan kalkar kapak (AVENTOS HK top / Free Flap)",
    leafCount: 1,
    defaultOverlayType: "full_overlay",
    kinematicType: "lift_up_stay",
    maxOpenAngleDeg: 107,
    minCarcassDepthMm: 240,
    defaultHardwareProductId: "hw_blum_aventos_hk_27",
    verifiedForProduction: true,
  },
  {
    id: "folding_side",
    name: "10. Katlanır Yan Kapak (Bi-Fold)",
    description: "Yana doğru katlanarak panoramik açılan kapak (Hettich WingLine L)",
    leafCount: 2,
    defaultOverlayType: "full_overlay",
    kinematicType: "fold_side",
    maxOpenAngleDeg: 95,
    minCarcassDepthMm: 500,
    defaultHardwareProductId: "hw_hettich_wingline_l",
    verifiedForProduction: true,
  },
  {
    id: "pocket_retractable",
    name: "11. Pocket / Yan Cebe Gizlenen Kapak",
    description: "90° açılıp gövde yan cebine tamamen gizlenen kapak (Blum REVEGO / Hawa Concepta III)",
    leafCount: 1,
    defaultOverlayType: "full_overlay",
    kinematicType: "pocket_retractable",
    maxOpenAngleDeg: 90,
    minCarcassDepthMm: 573,
    defaultHardwareProductId: "hw_blum_revego_uno",
    verifiedForProduction: true,
  },
  {
    id: "tambour_roller",
    name: "12. Tambur / Panjur Kapak (Önizleme)",
    description: "Kılavuz kanal içinde sarılan esnek panjur kapak (UNVERIFIED — Önizleme)",
    leafCount: 1,
    defaultOverlayType: "inset",
    kinematicType: "tambour_roller",
    maxOpenAngleDeg: 0,
    minCarcassDepthMm: 350,
    verifiedForProduction: false,
  },
];

export const HANDLE_PROFILES: HandleProfileDefinition[] = [
  {
    id: "hnd_knob_std",
    category: "knob",
    name: "Düğme Kulp (Tek Vida Ø32mm)",
    holeSpacingCcMm: null,
    protrusionMm: 28,
    doorHeightDeductionMm: 0,
    minDoorThicknessMm: 16,
    unitPriceEur: 3.5,
    sku: "HW_HND_KNOB_01",
  },
  {
    id: "hnd_bar_160",
    category: "bar_handle",
    name: "Standart Çubuk Kulp (C-C 160mm)",
    holeSpacingCcMm: 160,
    protrusionMm: 32,
    doorHeightDeductionMm: 0,
    minDoorThicknessMm: 16,
    unitPriceEur: 6.5,
    sku: "HW_HANDLE_BAR",
  },
  {
    id: "hnd_long_profile_960",
    category: "long_profile_handle",
    name: "Uzun Dikey Gardırop Kulpu (C-C 960mm)",
    holeSpacingCcMm: 960,
    protrusionMm: 26,
    doorHeightDeductionMm: 0,
    minDoorThicknessMm: 18,
    unitPriceEur: 24.0,
    sku: "HW_HND_LONG_960",
  },
  {
    id: "hnd_edge_profile",
    category: "edge_profile",
    name: "Kenar Geçme Alüminyum Kulp Profili",
    holeSpacingCcMm: null,
    protrusionMm: 20,
    doorHeightDeductionMm: 2,
    minDoorThicknessMm: 18,
    unitPriceEur: 9.0,
    sku: "HW_HND_EDGE_ALU",
  },
  {
    id: "hnd_recessed_grip",
    category: "recessed_grip",
    name: "Gömme Sürgü Kulpu (Hemzemin)",
    holeSpacingCcMm: null,
    protrusionMm: 0,
    doorHeightDeductionMm: 0,
    minDoorThicknessMm: 18,
    unitPriceEur: 8.5,
    sku: "HW_HND_RECESSED",
  },
  {
    id: "hnd_gola_profile",
    category: "gola_profile",
    name: "Gola Yatay/Dikey Gövde Profili (Kulpsuz Görünüm)",
    holeSpacingCcMm: null,
    protrusionMm: 0,
    doorHeightDeductionMm: 30,
    minDoorThicknessMm: 18,
    unitPriceEur: 14.5,
    sku: "HW_GOLA_PROFILE_L",
  },
  {
    id: "hnd_j_pull",
    category: "j_pull",
    name: "J-Pull Kendinden Kulplu Kapak (22mm Lake/Kaplama)",
    holeSpacingCcMm: null,
    protrusionMm: 0,
    doorHeightDeductionMm: 0,
    minDoorThicknessMm: 19,
    unitPriceEur: 12.0,
    sku: "HW_JPULL_MILLING",
  },
  {
    id: "hnd_milled_wood",
    category: "milled_wood_grip",
    name: "İşlenmiş Masif Ahşap Kulp",
    holeSpacingCcMm: 160,
    protrusionMm: 22,
    doorHeightDeductionMm: 0,
    minDoorThicknessMm: 18,
    unitPriceEur: 18.0,
    sku: "HW_HND_WOOD_MILLED",
  },
  {
    id: "hnd_decorative_brass",
    category: "decorative_bespoke",
    name: "Dekoratif Fırçalanmış Pirinç Kulp (C-C 128mm)",
    holeSpacingCcMm: 128,
    protrusionMm: 30,
    doorHeightDeductionMm: 0,
    minDoorThicknessMm: 18,
    unitPriceEur: 22.0,
    sku: "HW_HND_BRASS_128",
  },
  {
    id: "hnd_none",
    category: "handleless_plain",
    name: "Kulpsuz Düz Cephe (Bas-Aç / Servo İçin)",
    holeSpacingCcMm: null,
    protrusionMm: 0,
    doorHeightDeductionMm: 0,
    minDoorThicknessMm: 16,
    unitPriceEur: 0,
    sku: "NONE",
  },
];

export const OPENING_MECHANISM_DEFINITIONS: OpeningMechanismDefinition[] = [
  {
    id: "manual_standard",
    name: "Standart Yaylı Manuel",
    description: "Frenlemesiz standart yaylı menteşe/ray",
    requiresHandle: true,
    requiresElectricity: false,
    triggerGapMm: 0,
    addonUnitPriceEur: 0,
  },
  {
    id: "soft_close",
    name: "Frenli Yavaş Kapanış (BLUMOTION / Silent System)",
    description: "Entegre hidrolik yavaşlatıcılı sessiz kapanış",
    requiresHandle: true,
    requiresElectricity: false,
    triggerGapMm: 0,
    addonUnitPriceEur: 0,
  },
  {
    id: "push_to_open",
    name: "Bas-Aç (TIP-ON / Push to open)",
    description: "Kulpsuz kapağa basıldığında mekanik olarak açılır",
    requiresHandle: false,
    requiresElectricity: false,
    triggerGapMm: 2.5,
    addonUnitPriceEur: 6.5,
  },
  {
    id: "push_to_open_soft_close",
    name: "Bas-Aç + Frenli Kapanış (TIP-ON BLUMOTION)",
    description: "Basınca mekanik açılır, kapatılırken yavaşlatarak çeker",
    requiresHandle: false,
    requiresElectricity: false,
    triggerGapMm: 2.5,
    addonUnitPriceEur: 14.0,
  },
  {
    id: "servo_electric",
    name: "Elektrikli Dokunmatik Açılma (SERVO-DRIVE)",
    description: "Hafif dokunuşla motorlu açılış ve butonla kapanış",
    requiresHandle: false,
    requiresElectricity: true,
    triggerGapMm: 2.0,
    addonUnitPriceEur: 145.0,
  },
];

export const V4_HARDWARE_CATALOG: HardwareProductRecord[] = [
  // 1. HINGES
  {
    id: "hw_blum_71b3550",
    manufacturerId: "mfr_blum",
    manufacturerName: "Julius Blum GmbH",
    familyId: "fam_hinge_concealed",
    sku: "71B3550",
    name: "Blum CLIP top BLUMOTION 110° Tam Bini Menteşe",
    revision: "2024.1",
    lifecycleStatus: "PREFERRED_SUPPLIER",
    loadCapacityKg: 24,
    doorThicknessLimitsMm: [16, 24],
    doorWeightLimitsKg: [1, 24],
    drillingTemplateId: "tpl_drill_blum_hinge_45x95",
    compatibleModuleFamilies: ["fam_kitchen_base", "fam_kitchen_wall", "fam_kitchen_tall", "fam_wardrobe"],
    compatibleDoorSystems: ["hinged_single", "hinged_double"],
    unitPriceEur: 3.8,
    unit: "adet",
    sourceId: "SRC_BLUM_CAT_HINGE",
    verification: {
      sourceTechDataVerified: true,
      cadGeometryVerified: true,
      bomFormulaVerified: true,
      drillingPatternVerified: true,
      physicalFactorySampleTested: true,
    },
  },
  {
    id: "hw_blum_71b3650",
    manufacturerId: "mfr_blum",
    manufacturerName: "Julius Blum GmbH",
    familyId: "fam_hinge_concealed",
    sku: "71B3650",
    name: "Blum CLIP top BLUMOTION 110° Yarım Bini Menteşe",
    revision: "2024.1",
    lifecycleStatus: "PREFERRED_SUPPLIER",
    loadCapacityKg: 24,
    doorThicknessLimitsMm: [16, 24],
    doorWeightLimitsKg: [1, 24],
    drillingTemplateId: "tpl_drill_blum_hinge_45x95",
    compatibleModuleFamilies: ["fam_kitchen_base", "fam_kitchen_wall", "fam_kitchen_tall", "fam_wardrobe"],
    compatibleDoorSystems: ["hinged_overlay_variant", "hinged_single", "hinged_double"],
    unitPriceEur: 4.1,
    unit: "adet",
    sourceId: "SRC_BLUM_CAT_HINGE",
    verification: {
      sourceTechDataVerified: true,
      cadGeometryVerified: true,
      bomFormulaVerified: true,
      drillingPatternVerified: true,
      physicalFactorySampleTested: true,
    },
  },
  {
    id: "hw_blum_71b3750",
    manufacturerId: "mfr_blum",
    manufacturerName: "Julius Blum GmbH",
    familyId: "fam_hinge_concealed",
    sku: "71B3750",
    name: "Blum CLIP top BLUMOTION 110° İçten Kapak (Inset) Menteşe",
    revision: "2024.1",
    lifecycleStatus: "PREFERRED_SUPPLIER",
    loadCapacityKg: 24,
    doorThicknessLimitsMm: [16, 24],
    doorWeightLimitsKg: [1, 24],
    drillingTemplateId: "tpl_drill_blum_hinge_45x95",
    compatibleModuleFamilies: ["fam_kitchen_base", "fam_kitchen_wall", "fam_kitchen_tall", "fam_wardrobe"],
    compatibleDoorSystems: ["hinged_inset"],
    unitPriceEur: 4.3,
    unit: "adet",
    sourceId: "SRC_BLUM_CAT_HINGE",
    verification: {
      sourceTechDataVerified: true,
      cadGeometryVerified: true,
      bomFormulaVerified: true,
      drillingPatternVerified: true,
      physicalFactorySampleTested: true,
    },
  },
  {
    id: "hw_blum_71b7550",
    manufacturerId: "mfr_blum",
    manufacturerName: "Julius Blum GmbH",
    familyId: "fam_hinge_concealed",
    sku: "71B7550",
    name: "Blum CLIP top BLUMOTION 155° Sıfır Çıkıntı Menteşe (İç Çekmece Uyumlu)",
    revision: "2024.1",
    lifecycleStatus: "PREFERRED_SUPPLIER",
    loadCapacityKg: 24,
    doorThicknessLimitsMm: [16, 26],
    doorWeightLimitsKg: [1, 24],
    drillingTemplateId: "tpl_drill_blum_155_zero",
    compatibleModuleFamilies: ["fam_kitchen_base", "fam_kitchen_tall", "fam_wardrobe"],
    compatibleDoorSystems: ["hinged_single", "hinged_double"],
    unitPriceEur: 6.4,
    unit: "adet",
    sourceId: "SRC_BLUM_CAT_HINGE",
    verification: {
      sourceTechDataVerified: true,
      cadGeometryVerified: true,
      bomFormulaVerified: true,
      drillingPatternVerified: true,
      physicalFactorySampleTested: true,
    },
  },
  {
    id: "hw_blum_71b9550",
    manufacturerId: "mfr_blum",
    manufacturerName: "Julius Blum GmbH",
    familyId: "fam_hinge_concealed",
    sku: "71B9550",
    name: "Blum CLIP top BLUMOTION 95° Kalın Kapak Menteşesi (18-28mm)",
    revision: "2024.1",
    lifecycleStatus: "ACTIVE",
    loadCapacityKg: 24,
    doorThicknessLimitsMm: [18, 28],
    doorWeightLimitsKg: [1, 24],
    drillingTemplateId: "tpl_drill_blum_hinge_45x95",
    compatibleModuleFamilies: ["fam_kitchen_base", "fam_kitchen_wall", "fam_kitchen_tall", "fam_wardrobe"],
    compatibleDoorSystems: ["hinged_single", "hinged_double"],
    unitPriceEur: 5.2,
    unit: "adet",
    sourceId: "SRC_BLUM_CAT_HINGE",
    verification: {
      sourceTechDataVerified: true,
      cadGeometryVerified: true,
      bomFormulaVerified: true,
      drillingPatternVerified: true,
      physicalFactorySampleTested: false,
    },
  },
  {
    id: "hw_hettich_9071205",
    manufacturerId: "mfr_hettich",
    manufacturerName: "Hettich Holding GmbH",
    familyId: "fam_hinge_concealed",
    sku: "9071205",
    name: "Hettich Sensys 8645i 110° Tam Bini Menteşe (TH52)",
    revision: "2024.1",
    lifecycleStatus: "ACTIVE",
    loadCapacityKg: 24,
    doorThicknessLimitsMm: [15, 24],
    doorWeightLimitsKg: [1, 24],
    drillingTemplateId: "tpl_drill_hettich_th52",
    compatibleModuleFamilies: ["fam_kitchen_base", "fam_kitchen_wall", "fam_kitchen_tall", "fam_wardrobe"],
    compatibleDoorSystems: ["hinged_single", "hinged_double"],
    unitPriceEur: 3.6,
    unit: "adet",
    sourceId: "SRC_HETTICH_SENSYS",
    verification: {
      sourceTechDataVerified: true,
      cadGeometryVerified: true,
      bomFormulaVerified: true,
      drillingPatternVerified: true,
      physicalFactorySampleTested: false,
    },
  },
  {
    id: "hw_hettich_9099540",
    manufacturerId: "mfr_hettich",
    manufacturerName: "Hettich Holding GmbH",
    familyId: "fam_hinge_concealed",
    sku: "9099540",
    name: "Hettich Sensys 8657i 165° Sıfır Çıkıntı Menteşe (TH52)",
    revision: "2024.1",
    lifecycleStatus: "ACTIVE",
    loadCapacityKg: 24,
    doorThicknessLimitsMm: [15, 32],
    doorWeightLimitsKg: [1, 24],
    drillingTemplateId: "tpl_drill_hettich_165_th52",
    compatibleModuleFamilies: ["fam_kitchen_base", "fam_kitchen_tall", "fam_wardrobe"],
    compatibleDoorSystems: ["hinged_single", "hinged_double"],
    unitPriceEur: 6.2,
    unit: "adet",
    sourceId: "SRC_HETTICH_SENSYS",
    verification: {
      sourceTechDataVerified: true,
      cadGeometryVerified: true,
      bomFormulaVerified: true,
      drillingPatternVerified: true,
      physicalFactorySampleTested: false,
    },
  },
  {
    id: "hw_salice_c7p6ae9",
    manufacturerId: "mfr_salice",
    manufacturerName: "Arturo Salice S.p.A.",
    familyId: "fam_hinge_concealed",
    sku: "C7P6AE9",
    name: "Salice Silentia+ 110° Çift Damperli Tam Bini Menteşe (48×9)",
    revision: "2024.1",
    lifecycleStatus: "ACTIVE",
    loadCapacityKg: 24,
    doorThicknessLimitsMm: [16, 26],
    doorWeightLimitsKg: [1, 24],
    drillingTemplateId: "tpl_drill_salice_48x9",
    compatibleModuleFamilies: ["fam_kitchen_base", "fam_kitchen_wall", "fam_kitchen_tall", "fam_wardrobe"],
    compatibleDoorSystems: ["hinged_single", "hinged_double"],
    unitPriceEur: 4.0,
    unit: "adet",
    sourceId: "SRC_SALICE_SILENTIA",
    verification: {
      sourceTechDataVerified: true,
      cadGeometryVerified: true,
      bomFormulaVerified: true,
      drillingPatternVerified: true,
      physicalFactorySampleTested: false,
    },
  },

  // 2. DRAWER BOX & RUNNER SYSTEMS
  {
    id: "hw_blum_legrabox_m40",
    manufacturerId: "mfr_blum",
    manufacturerName: "Julius Blum GmbH",
    familyId: "fam_drawer_box",
    sku: "750.5001S+770M",
    name: "Blum LEGRABOX pure M (90.5mm, 40kg) Metal Yanaklı Çekmece Seti",
    revision: "2024.1",
    lifecycleStatus: "PREFERRED_SUPPLIER",
    loadCapacityKg: 40,
    drawerCuttingFormula: {
      bottomWidthDeductionMm: 35,
      backWidthDeductionMm: 38,
      lengthDeductionMm: 10,
      requiresBottomGroove: true,
    },
    compatibleModuleFamilies: ["fam_kitchen_base", "fam_kitchen_tall", "fam_wardrobe"],
    compatibleDoorSystems: ["open", "hinged_single", "hinged_double"],
    unitPriceEur: 46.0,
    unit: "takım",
    sourceId: "SRC_BLUM_LEGRABOX",
    verification: {
      sourceTechDataVerified: true,
      cadGeometryVerified: true,
      bomFormulaVerified: true,
      drillingPatternVerified: true,
      physicalFactorySampleTested: true,
    },
  },
  {
    id: "hw_blum_legrabox_c70",
    manufacturerId: "mfr_blum",
    manufacturerName: "Julius Blum GmbH",
    familyId: "fam_drawer_box",
    sku: "753.5001S+770C",
    name: "Blum LEGRABOX pure C (177mm, 70kg) Ağır Hizmet Tencere Çekmecesi",
    revision: "2024.1",
    lifecycleStatus: "PREFERRED_SUPPLIER",
    loadCapacityKg: 70,
    drawerCuttingFormula: {
      bottomWidthDeductionMm: 35,
      backWidthDeductionMm: 38,
      lengthDeductionMm: 10,
      requiresBottomGroove: true,
    },
    compatibleModuleFamilies: ["fam_kitchen_base", "fam_kitchen_tall", "fam_wardrobe"],
    compatibleDoorSystems: ["open", "hinged_single", "hinged_double"],
    unitPriceEur: 58.0,
    unit: "takım",
    sourceId: "SRC_BLUM_LEGRABOX",
    verification: {
      sourceTechDataVerified: true,
      cadGeometryVerified: true,
      bomFormulaVerified: true,
      drillingPatternVerified: true,
      physicalFactorySampleTested: true,
    },
  },
  {
    id: "hw_blum_tandembox_m30",
    manufacturerId: "mfr_blum",
    manufacturerName: "Julius Blum GmbH",
    familyId: "fam_drawer_box",
    sku: "578.5001M+378M",
    name: "Blum TANDEMBOX antaro M (83.6mm, 30kg) Frenli Çekmece Seti",
    revision: "2024.1",
    lifecycleStatus: "PREFERRED_SUPPLIER",
    loadCapacityKg: 30,
    drawerCuttingFormula: {
      bottomWidthDeductionMm: 75,
      backWidthDeductionMm: 87,
      lengthDeductionMm: 24,
      requiresBottomGroove: false,
    },
    compatibleModuleFamilies: ["fam_kitchen_base", "fam_kitchen_tall", "fam_wardrobe"],
    compatibleDoorSystems: ["open", "hinged_single", "hinged_double"],
    unitPriceEur: 28.0,
    unit: "takım",
    sourceId: "SRC_BLUM_TANDEMBOX",
    verification: {
      sourceTechDataVerified: true,
      cadGeometryVerified: true,
      bomFormulaVerified: true,
      drillingPatternVerified: true,
      physicalFactorySampleTested: true,
    },
  },
  {
    id: "hw_blum_movento_760h",
    manufacturerId: "mfr_blum",
    manufacturerName: "Julius Blum GmbH",
    familyId: "fam_runner_concealed",
    sku: "760H5000S",
    name: "Blum MOVENTO 760H (40kg) Ahşap Çekmece Gizli Ray Takımı",
    revision: "2024.1",
    lifecycleStatus: "PREFERRED_SUPPLIER",
    loadCapacityKg: 40,
    drawerCuttingFormula: {
      bottomWidthDeductionMm: 42,
      backWidthDeductionMm: 42,
      lengthDeductionMm: 10,
    },
    compatibleModuleFamilies: ["fam_kitchen_base", "fam_kitchen_tall", "fam_wardrobe"],
    compatibleDoorSystems: ["open", "hinged_single", "hinged_double"],
    unitPriceEur: 24.5,
    unit: "takım",
    sourceId: "SRC_BLUM_MOVENTO",
    verification: {
      sourceTechDataVerified: true,
      cadGeometryVerified: true,
      bomFormulaVerified: true,
      drillingPatternVerified: true,
      physicalFactorySampleTested: true,
    },
  },
  {
    id: "hw_hettich_avantech_m",
    manufacturerId: "mfr_hettich",
    manufacturerName: "Hettich Holding GmbH",
    familyId: "fam_drawer_box",
    sku: "ActroYOU_101",
    name: "Hettich AvanTech YOU (101mm, 40kg) 13mm İnce Yanaklı Çekmece Seti",
    revision: "2024.1",
    lifecycleStatus: "ACTIVE",
    loadCapacityKg: 40,
    drawerCuttingFormula: {
      bottomWidthDeductionMm: 24,
      backWidthDeductionMm: 24,
      lengthDeductionMm: 21,
      requiresBottomGroove: false,
    },
    compatibleModuleFamilies: ["fam_kitchen_base", "fam_kitchen_tall", "fam_wardrobe"],
    compatibleDoorSystems: ["open", "hinged_single", "hinged_double"],
    unitPriceEur: 44.0,
    unit: "takım",
    sourceId: "SRC_HETTICH_AVANTECH",
    verification: {
      sourceTechDataVerified: true,
      cadGeometryVerified: true,
      bomFormulaVerified: true,
      drillingPatternVerified: true,
      physicalFactorySampleTested: false,
    },
  },

  // 3. LIFT SYSTEMS
  {
    id: "hw_blum_aventos_hk_27",
    manufacturerId: "mfr_blum",
    manufacturerName: "Julius Blum GmbH",
    familyId: "fam_lift_system",
    sku: "22K2700",
    name: "Blum AVENTOS HK top Yukarı Kalkar Mekanizma Seti (LF 1730-5200)",
    revision: "2024.1",
    lifecycleStatus: "PREFERRED_SUPPLIER",
    loadCapacityKg: 18,
    powerFactorRangeLf: [1730, 5200],
    compatibleModuleFamilies: ["fam_kitchen_wall", "fam_kitchen_tall"],
    compatibleDoorSystems: ["lift_up_stay"],
    unitPriceEur: 52.0,
    unit: "takım",
    sourceId: "SRC_BLUM_AVENTOS",
    verification: {
      sourceTechDataVerified: true,
      cadGeometryVerified: true,
      bomFormulaVerified: true,
      drillingPatternVerified: true,
      physicalFactorySampleTested: true,
    },
  },
  {
    id: "hw_blum_aventos_hf_25",
    manufacturerId: "mfr_blum",
    manufacturerName: "Julius Blum GmbH",
    familyId: "fam_lift_system",
    sku: "22F2510+22F3500",
    name: "Blum AVENTOS HF top İki Parçalı Katlanır Kalkar Set (LF 5350-10150)",
    revision: "2024.1",
    lifecycleStatus: "PREFERRED_SUPPLIER",
    loadCapacityKg: 20,
    powerFactorRangeLf: [5350, 10150],
    compatibleModuleFamilies: ["fam_kitchen_wall"],
    compatibleDoorSystems: ["lift_bi_fold"],
    unitPriceEur: 78.0,
    unit: "takım",
    sourceId: "SRC_BLUM_AVENTOS",
    verification: {
      sourceTechDataVerified: true,
      cadGeometryVerified: true,
      bomFormulaVerified: true,
      drillingPatternVerified: true,
      physicalFactorySampleTested: true,
    },
  },
  {
    id: "hw_blum_aventos_hl_25",
    manufacturerId: "mfr_blum",
    manufacturerName: "Julius Blum GmbH",
    familyId: "fam_lift_system",
    sku: "22L2500+22L3500",
    name: "Blum AVENTOS HL top Paralel Yukarı Kalkar Mekanizma Seti",
    revision: "2024.1",
    lifecycleStatus: "PREFERRED_SUPPLIER",
    loadCapacityKg: 12.75,
    compatibleModuleFamilies: ["fam_kitchen_wall", "fam_kitchen_tall"],
    compatibleDoorSystems: ["lift_parallel"],
    unitPriceEur: 86.0,
    unit: "takım",
    sourceId: "SRC_BLUM_AVENTOS",
    verification: {
      sourceTechDataVerified: true,
      cadGeometryVerified: true,
      bomFormulaVerified: true,
      drillingPatternVerified: true,
      physicalFactorySampleTested: false,
    },
  },

  // 4. SLIDING, FOLDING & POCKET SYSTEMS
  {
    id: "hw_hettich_topline_l",
    manufacturerId: "mfr_hettich",
    manufacturerName: "Hettich Holding GmbH",
    familyId: "fam_sliding_system",
    sku: "TopLineL_50",
    name: "Hettich TopLine L Üstten Taşımalı Yavaşlatıcılı Sürgü Sistemi (50kg)",
    revision: "2024.1",
    lifecycleStatus: "PREFERRED_SUPPLIER",
    loadCapacityKg: 50,
    doorThicknessLimitsMm: [16, 30],
    compatibleModuleFamilies: ["fam_wardrobe"],
    compatibleDoorSystems: ["sliding_top_hung"],
    unitPriceEur: 135.0,
    unit: "takım",
    sourceId: "SRC_HETTICH_WINGLINE",
    verification: {
      sourceTechDataVerified: true,
      cadGeometryVerified: true,
      bomFormulaVerified: true,
      drillingPatternVerified: true,
      physicalFactorySampleTested: true,
    },
  },
  {
    id: "hw_hafele_slido_bottom",
    manufacturerId: "mfr_hafele",
    manufacturerName: "Häfele SE & Co KG",
    familyId: "fam_sliding_system",
    sku: "Slido_Classic_50",
    name: "Häfele Slido Classic Alttan Taşımalı Sürgü Sistemi (50kg)",
    revision: "2024.1",
    lifecycleStatus: "ACTIVE",
    loadCapacityKg: 50,
    doorThicknessLimitsMm: [16, 28],
    compatibleModuleFamilies: ["fam_wardrobe"],
    compatibleDoorSystems: ["sliding_bottom_rolling"],
    unitPriceEur: 95.0,
    unit: "takım",
    sourceId: "SRC_HAFELE_MATRIX",
    verification: {
      sourceTechDataVerified: true,
      cadGeometryVerified: true,
      bomFormulaVerified: true,
      drillingPatternVerified: true,
      physicalFactorySampleTested: false,
    },
  },
  {
    id: "hw_hettich_wingline_l",
    manufacturerId: "mfr_hettich",
    manufacturerName: "Hettich Holding GmbH",
    familyId: "fam_sliding_system",
    sku: "WingLineL_25",
    name: "Hettich WingLine L Push/Pull Panoramik Katlanır Kapak Sistemi",
    revision: "2024.1",
    lifecycleStatus: "PREFERRED_SUPPLIER",
    loadCapacityKg: 25,
    doorThicknessLimitsMm: [16, 25],
    compatibleModuleFamilies: ["fam_wardrobe", "fam_special_corner"],
    compatibleDoorSystems: ["folding_side"],
    unitPriceEur: 110.0,
    unit: "takım",
    sourceId: "SRC_HETTICH_WINGLINE",
    verification: {
      sourceTechDataVerified: true,
      cadGeometryVerified: true,
      bomFormulaVerified: true,
      drillingPatternVerified: true,
      physicalFactorySampleTested: false,
    },
  },
  {
    id: "hw_blum_revego_uno",
    manufacturerId: "mfr_blum",
    manufacturerName: "Julius Blum GmbH",
    familyId: "fam_pocket_system",
    sku: "REVEGO_UNO_650",
    name: "Blum REVEGO uno Tekli Pocket (Gizlenen) Kapak Sistemi (35kg)",
    revision: "2024.1",
    lifecycleStatus: "PREFERRED_SUPPLIER",
    loadCapacityKg: 35,
    doorThicknessLimitsMm: [18, 26],
    pocketClearanceMm: {
      pocketWidthMm: 100,
      minCarcassDepthMm: 573,
      minDoorHeightMm: 1800,
      maxDoorHeightMm: 2980,
    },
    compatibleModuleFamilies: ["fam_kitchen_tall", "fam_wardrobe"],
    compatibleDoorSystems: ["pocket_retractable"],
    unitPriceEur: 420.0,
    unit: "takım",
    sourceId: "SRC_BLUM_REVEGO",
    verification: {
      sourceTechDataVerified: true,
      cadGeometryVerified: true,
      bomFormulaVerified: true,
      drillingPatternVerified: true,
      physicalFactorySampleTested: false,
    },
  },
  {
    id: "hw_hawa_concepta3_25",
    manufacturerId: "mfr_hawa",
    manufacturerName: "Hawa Sliding Solutions AG",
    familyId: "fam_pocket_system",
    sku: "ConceptaIII_25",
    name: "Hawa Concepta III 25 Döner-Sürülür Pocket Kapak Sistemi (25kg)",
    revision: "2024.1",
    lifecycleStatus: "ACTIVE",
    loadCapacityKg: 25,
    doorThicknessLimitsMm: [18, 26],
    pocketClearanceMm: {
      pocketWidthMm: 70,
      minCarcassDepthMm: 560,
      minDoorHeightMm: 1200,
      maxDoorHeightMm: 2200,
    },
    compatibleModuleFamilies: ["fam_kitchen_tall", "fam_wardrobe"],
    compatibleDoorSystems: ["pocket_retractable"],
    unitPriceEur: 380.0,
    unit: "takım",
    sourceId: "SRC_HAWA_CONCEPTA3",
    verification: {
      sourceTechDataVerified: true,
      cadGeometryVerified: true,
      bomFormulaVerified: true,
      drillingPatternVerified: true,
      physicalFactorySampleTested: false,
    },
  },
];

export function getHardwareProductById(id?: string): HardwareProductRecord | undefined {
  if (!id) return undefined;
  return V4_HARDWARE_CATALOG.find((p) => p.id === id);
}

export function getDrillingTemplateForHardware(hardwareProductId?: string): HardwareDrillingTemplate {
  const hw = getHardwareProductById(hardwareProductId);
  if (hw?.drillingTemplateId && HARDWARE_DRILLING_TEMPLATES[hw.drillingTemplateId]) {
    return HARDWARE_DRILLING_TEMPLATES[hw.drillingTemplateId];
  }
  return HARDWARE_DRILLING_TEMPLATES.tpl_drill_blum_hinge_45x95;
}

/**
 * Selects optimal nominal runner length (NL) in mm based on usable cabinet inner depth.
 */
export function selectOptimalRunnerLengthMm(usableInnerDepthMm: UnitLength): UnitLength {
  const standardLengths = [600, 550, 500, 450, 400, 350, 270];
  const maxAllowed = usableInnerDepthMm - 10;
  for (const nl of standardLengths) {
    if (nl <= maxAllowed) return nl;
  }
  return 270;
}
