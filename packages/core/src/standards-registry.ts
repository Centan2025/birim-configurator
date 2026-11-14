import { DesignProject, ValidationIssue } from "./types";

export interface StandardCatalogEntry {
  id: string;
  category:
    | "Güvenlik & Statik"
    | "Gövde & Karkas"
    | "Kapak & Menteşe"
    | "Çekmece & İç Düzen"
    | "Mutfak & Cihaz"
    | "Üretim & Plaka";
  title: string;
  standardRef: string;
  thresholdSummary: string;
  severity: "error" | "warning" | "info";
  codeLocation: string;
  isSystemLocked?: boolean;
}

export type CustomStandardMetric =
  | "max_shelf_span_18mm"
  | "min_plinth_height"
  | "max_single_door_width"
  | "min_carcass_depth"
  | "max_module_height"
  | "min_drawer_height"
  | "max_drawer_height"
  | "min_wall_filler_gap";

export interface CustomStandardRule {
  id: string;
  name: string;
  standardRef: string;
  category: StandardCatalogEntry["category"];
  metric: CustomStandardMetric;
  operator: "max" | "min";
  thresholdMm: number;
  appliesToCategory: "all" | "wardrobe" | "kitchen_base" | "kitchen_wall" | "kitchen_tall";
  severity: "error" | "warning";
  enabled: boolean;
  createdAt: string;
}

export const CUSTOM_STANDARDS_STORAGE_KEY = "birim_custom_standards_v1";

export const CUSTOM_STANDARD_METRIC_OPTIONS: {
  metric: CustomStandardMetric;
  label: string;
  defaultOperator: "max" | "min";
  defaultThresholdMm: number;
  unit: "mm";
}[] = [
  {
    metric: "max_shelf_span_18mm",
    label: "18mm Raf Azami Serbest Açıklık",
    defaultOperator: "max",
    defaultThresholdMm: 850,
    unit: "mm",
  },
  {
    metric: "min_plinth_height",
    label: "Zemin Modülü Asgari Baza Yüksekliği",
    defaultOperator: "min",
    defaultThresholdMm: 60,
    unit: "mm",
  },
  {
    metric: "max_single_door_width",
    label: "Tek Kanat Menteşeli Kapak Azami Genişlik",
    defaultOperator: "max",
    defaultThresholdMm: 600,
    unit: "mm",
  },
  {
    metric: "min_carcass_depth",
    label: "Gövde Asgari Derinliği",
    defaultOperator: "min",
    defaultThresholdMm: 350,
    unit: "mm",
  },
  {
    metric: "max_module_height",
    label: "Modül Azami Toplam Yüksekliği",
    defaultOperator: "max",
    defaultThresholdMm: 2600,
    unit: "mm",
  },
  {
    metric: "min_drawer_height",
    label: "Çekmece Klapa Asgari Yüksekliği",
    defaultOperator: "min",
    defaultThresholdMm: 100,
    unit: "mm",
  },
  {
    metric: "max_drawer_height",
    label: "Çekmece Klapa Azami Yüksekliği",
    defaultOperator: "max",
    defaultThresholdMm: 420,
    unit: "mm",
  },
  {
    metric: "min_wall_filler_gap",
    label: "Yan Duvar Asgari Kör Parça / Kulp Boşluğu",
    defaultOperator: "min",
    defaultThresholdMm: 40,
    unit: "mm",
  },
];

export const BIRIM_STANDARDS_CATALOG: StandardCatalogEntry[] = [
  {
    id: "STD_EN_16122_SHELF",
    category: "Güvenlik & Statik",
    title: "Raf Sehim ve Taşıma Kapasitesi",
    standardRef: "EN 16122:2012 & ISO 7170",
    thresholdSummary: "18mm raf ≤ 900mm açıklık ve sehim ≤ L/200 (cam raflarda L/300, ≥950mm için 10mm temperli cam / 25mm panel)",
    severity: "error",
    codeLocation: "packages/core/src/engineering-validation-engine.ts",
    isSystemLocked: true,
  },
  {
    id: "STD_EN_14749_TIPOVER",
    category: "Güvenlik & Statik",
    title: "Devrilme Önleyici Duvar Sabitleme & Asma Yük Kapasitesi",
    standardRef: "EN 14749:2016+A1:2022",
    thresholdSummary: "H ≥ 600mm narin modüllerde L-braket duvar sabitlemesi; asma dolaplarda dikme başı maks. 65 kg taşıma",
    severity: "error",
    codeLocation: "packages/core/src/engineering-validation-engine.ts",
    isSystemLocked: true,
  },
  {
    id: "STD_DIN_68871_SYS32",
    category: "Gövde & Karkas",
    title: "Sistem 32 Çoklu Delik ve Gövde Konstrüksiyonu",
    standardRef: "DIN 68871 / Birim Fabrika V4",
    thresholdSummary: "32mm delik adımı, 37mm ön set, min. 16mm panel kalınlığı; H > 1800mm gövdelerde sabit taşıyıcı raf",
    severity: "warning",
    codeLocation: "packages/core/src/rules.ts & packages/manufacturing/src/drilling-engine.ts",
    isSystemLocked: true,
  },
  {
    id: "STD_DIN_68935_PLINTH",
    category: "Gövde & Karkas",
    title: "Baza (Soket) Konstrüksiyonu & Yan Dikme İniş Kuralları",
    standardRef: "DIN 68935 / Birim Standartları",
    thresholdSummary: "Kutu baza (35mm girinti), Klipsli ayak (55mm girinti), Yan dikme inişli kayıtlı (dikmeler Y=0 zemine iner, 26mm girinti)",
    severity: "info",
    codeLocation: "packages/geometry/src/mesh-generator.ts & packages/core/src/v4-profiles.ts",
    isSystemLocked: true,
  },
  {
    id: "STD_BLUM_HINGE_LOAD",
    category: "Kapak & Menteşe",
    title: "Kapak Kanat Genişliği, Ağırlık ve Menteşe Sayısı",
    standardRef: "Blum CLIP top / Hettich Sensys Teknik Katalog",
    thresholdSummary: "Tek kanat maks. 650mm (sarkma sınırı 920mm); 2 menteşe ≤12kg, 3≤17kg, 4≤22kg, 5≤28kg; AVENTOS HK ≤600mm",
    severity: "error",
    codeLocation: "packages/core/src/v4-compatibility.ts",
    isSystemLocked: true,
  },
  {
    id: "STD_INTERNAL_DRAWER_CLEARANCE",
    category: "Çekmece & İç Düzen",
    title: "İç Çekmece Menteşe Sıfır Çıkıntı & Besleme Çıtası",
    standardRef: "Blum SPACE TOWER / LEGRABOX Kılavuzu",
    thresholdSummary: "Kapak arkası iç çekmecelerde 155° sıfır çıkıntılı menteşe (71B7550) veya 25mm besleme çıtası; çekmece H: 80–450mm",
    severity: "error",
    codeLocation: "packages/core/src/rules.ts & packages/core/src/engineering-validation-engine.ts",
    isSystemLocked: true,
  },
  {
    id: "STD_EN_1116_APPLIANCE",
    category: "Mutfak & Cihaz",
    title: "Ankastre Cihaz Koordinasyon Ölçüsü & 200 cm² Havalandırma",
    standardRef: "EN 1116:2018 & OEM Soğutma Şartnamesi",
    thresholdSummary: "Ankastre fırın/soğutucu kulesi dış genişlik 600mm, derinlik ≥560mm, baza menfezi ≥200 cm² ve 50mm arka baca",
    severity: "error",
    codeLocation: "packages/core/src/v4-compatibility.ts & engineering-validation-engine.ts",
    isSystemLocked: true,
  },
  {
    id: "STD_SHEET_USABLE_SIZE",
    category: "Üretim & Plaka",
    title: "Baş-Kesim Sonrası Net Plaka Ebadı (Selco WNT 600)",
    standardRef: "Birim Fabrika İmalat Standardı V4",
    thresholdSummary: "Standart 2800×2070mm plakada net kesilebilir sınır 2770×2040mm (Jumbo plakada 3630×1800mm)",
    severity: "error",
    codeLocation: "packages/core/src/tolerance-policy.ts & engineering-validation-engine.ts",
    isSystemLocked: true,
  },
  {
    id: "STD_TS_9111_ERGONOMICS",
    category: "Güvenlik & Statik",
    title: "Konforlu Raf/Askı Erişim Yüksekliği ve Geçiş Koridoru",
    standardRef: "TS 9111 / EN 17210 Ergonomi Profilleri",
    thresholdSummary: "TR Konut maks. konfor raf kotu 2050mm, geçiş koridoru ≥900mm (Engelsiz EN 17210 profilinde ≤1400mm ve ≥1500mm)",
    severity: "info",
    codeLocation: "packages/core/src/engineering-validation-engine.ts",
    isSystemLocked: true,
  },
];

export const HUMAN_ISSUE_TITLES_TR: Record<string, string> = {
  ERR_SHELF_STRUCTURAL_DEFLECTION: "Raf Taşıma / Esneme Sınırı Aşıldı",
  WARN_SHELF_SPAN_DEFLECTION: "Geniş Raf Açıklığı (25mm Raf Önerisi)",
  CHK_12_SHELF_SPAN_DEFLECTION: "Geniş Raf Açıklığı (Sehim Uyarısı)",
  ERR_SHELF_OVERFLOW: "Raf Dolap Yüksekliğini Aşıyor",
  WARN_SHELF_HEIGHT: "Raf Konfor Erişim Yüksekliği Uyarısı",
  INFO_ERGONOMIC_PROFILE_SHELF_REACH: "Üst Raf Erişim Kotu Bilgilendirmesi",
  INFO_TALL_CARCASS_NEEDS_FIXED_SHELF: "Boy Gövde Sabit Taşıyıcı Raf Önerisi",
  ERR_ADJUSTABLE_SHELF_WITHOUT_PIN_HOLES: "Hareketli Raf İçin Pim Deliği Kapalı",
  ERR_WIDTH_TOO_SMALL: "Modül Genişliği Asgari Sınırın Altında",
  ERR_WIDTH_TOO_LARGE: "Modül Genişliği Plaka Sınırını Aşıyor",
  ERR_HEIGHT_TOO_SMALL: "Modül Yüksekliği Asgari Sınırın Altında",
  ERR_HEIGHT_TOO_LARGE: "Modül Yüksekliği Plaka Boyunu Aşıyor",
  ERR_DEPTH_TOO_SMALL: "Modül Derinliği Asgari Sınırın Altında",
  ERR_BAY_TOO_NARROW: "Bölme İç Genişliği Çok Dar",
  ERR_PANEL_EXCEEDS_USABLE_SHEET_SIZE: "Panel Ebadı Standart Plakayı Aşıyor",
  ERR_MODULE_COLLISION: "Modüller Birbiriyle Çakışıyor",
  ERR_SPATIAL_MODULE_OVERLAP: "Yerleşim Çakışması",
  ERR_WALL_BOUNDARY_OVERFLOW: "Modül Duvar Sınırından Taşıyor",
  ERR_WINDOW_COLLISION: "Modül Pencere Açıklığını Kapatıyor",
  ERR_DOOR_OBSTACLE_COLLISION: "Oda Kapısı Açılış Alanı Engelleniyor",
  ERR_COLUMN_COLLISION: "Kolon / Kiriş Çakışması",
  ERR_CABINET_DOOR_BLOCKED: "Dolap Kapağı Engele Çarpıyor",
  ERR_CEILING_COLLISION: "Modül Tavan Yüksekliğini Aşıyor",
  ERR_CEILING_TYPE_COLLISION: "Asma Tavan / Kiriş Alt Kot Çakışması",
  WARN_CEILING_DOOR_SWEEP_TIGHT: "Kapak ile Tavan Arası Boşluk Çok Dar",
  ERR_STACKED_MODULE_UNSUPPORTED_MIDAIR: "Üst Modül Desteksiz / Duvar Askısız",
  ERR_STACKED_MODULE_CANTILEVER_OVERHANG: "Üst Modül Alt Gövdeden Desteksiz Taşıyor",
  WARN_STACKED_UPRIGHT_LOAD_PATH_OFFSET: "Alt-Üst Dikme Hizası Kaçık",
  ERR_FREESTANDING_TIPOVER_UNSAFE: "Devrilme Güvenliği: Duvar Sabitlemesi Gerekli",
  ERR_DRYWALL_UNREINFORCED_HEAVY_HANG: "Desteksiz Alçıpana Ağır Dolap Asılamaz",
  ERR_WALL_CABINET_HANGER_OVERLOAD: "Duvar Askı Kapasitesi Aşıldı",
  CHK_WALL_SUBSTRATE_VERIFICATION_REQUIRED: "Duvar Taşıyıcı Cinsi Onayı Bekleniyor",
  ERR_INTERNAL_DRAWER_HINGE_BODY_CLASH: "İç Çekmece Menteşe Gövdesiyle Çakışıyor",
  ERR_INTERNAL_DRAWER_HINGE_COLLISION: "İç Çekmece Menteşe Kotuyla Çakışıyor",
  WARN_INTERNAL_DRAWER_HINGE_PROTRUSION: "İç Çekmece İçin 155° Menteşe / Çıta Önerisi",
  CHK_07_INTERNAL_DRAWER_REQUIRES_ZERO_PROTRUSION: "İç Çekmece Sıfır Çıkıntılı Menteşe Gerektirir",
  ERR_INTERNAL_FITTING_ENVELOPE_VIOLATION: "İç Aksesuar Bölme Ölçülerine Sığmıyor",
  ERR_INTERNAL_FITTING_HINGE_BODY_CLASH: "Raylı Aksesuar Menteşeyle Çakışıyor",
  WARN_INTERNAL_PULLOUT_HINGE_SPACER_REQUIRED: "İç Mekanizma İçin Besleme Çıtası Önerisi",
  ERR_DRAWER_OVERFLOW: "Çekmece Yüksekliği Bölme İçini Aşıyor",
  WARN_DRAWER_HEIGHT: "Çekmece Yüksekliği Standart Dışı",
  CHK_09_RUNNER_EXCEEDS_CARCASS_DEPTH: "Çekmece Ray Boyu Gövde Derinliğini Aşıyor",
  CHK_13_HEAVY_DRAWER_LOAD_UPGRADE: "Geniş Çekmece İçin Ağır Hizmet Ray Önerisi",
  ERR_SINK_BOWL_DRAWER_COLLISION: "Üst Çekmece Eviye Haznesiyle Çakışıyor",
  ERR_PLUMBING_INCOMPATIBLE_MODULE: "Tesisat Önüne Uyumsuz Dolap Yerleştirildi",
  WARN_PLUMBING_UNASSIGNED: "Su Tesisatı Önünde Eviye Modülü Yok",
  WARN_PLUMBING_OFFSET: "Eviye Dolabı Tesisat Ekseninden Kaçık",
  ERR_MEP_OUTLET_BLOCKED_BY_UPRIGHT_PANEL: "Priz / Tesisat Yan Dikmeye Denk Geliyor",
  ERR_APPLIANCE_200CM2_AIRFLOW_VIOLATION: "Ankastre Cihaz 200 cm² Havalandırma Yetersiz",
  WARN_APPLIANCE_VENT_CLEARANCE: "Cihaz Havalandırma Boşluğu Uyarısı",
  CHK_14_APPLIANCE_WIDTH_EN1116: "Ankastre Cihaz Modülü 600mm Olmalıdır",
  CHK_14_APPLIANCE_DEPTH_CLEARANCE: "Ankastre Cihaz Derinliği Yetersiz",
  CHK_01_SLIDING_REQUIRES_MULTI_BAY: "Sürgü Kapak En Az 2 Bölme Gerektirir",
  WARN_SLIDING_DOOR_DEPTH: "Sürgü Kapak İçin Gövde Derinliği Az",
  ERR_SLIDING_DEAD_ZONE_DRAWER_CLASH: "Sürgü Kapak Ölü Bölgesinde Çekmece Çakışması",
  CHK_02_LIFT_STAY_HEIGHT_EXCEEDED: "Tek Parça Kalkar Kapak Yükseklik Sınırı Aşıldı",
  CHK_02_LIFT_BIFOLD_HEIGHT_RANGE: "Katlanır Kalkar Kapak Yükseklik Aralığı Dışı",
  CHK_03_DOOR_WEIGHT_EXCEEDS_HINGE_LIMIT: "Kapak Ağırlığı Menteşe Kapasitesini Aşıyor",
  CHK_03_LIFT_POWER_FACTOR_OVERLOAD: "Kalkar Kapak Güç Faktörü Sınırı Aşıldı",
  CHK_03_POCKET_DOOR_WEIGHT_LIMIT: "Pocket Kapak Ağırlık Sınırı Aşıldı",
  CHK_04_THICK_DOOR_REQUIRES_SPECIAL_HINGE: "Kalın Kapak İçin Özel Menteşe Gerekli",
  CHK_05_HINGED_LEAF_TOO_WIDE: "Menteşeli Kapak Kanadı Çok Geniş",
  CHK_05_HINGED_LEAF_WIDE_WARNING: "Geniş Kapak Kanadı Sarkma Uyarısı",
  CHK_05_SINGLE_LEAF_SAG_ADVISORY: "Geniş Tek Kapak (Çift Kapak Önerilir)",
  CHK_06_LIFT_DOOR_CEILING_CLEARANCE: "Kalkar Kapak Tavana Çarpabilir",
  WARN_LIFT_DOOR_CEILING_SWEEP: "Kalkar Kapak Açılımı Tavan Sınırını Aşıyor",
  CHK_08_GOLA_INCOMPATIBLE_WITH_INSET: "Gola Profil İçerlek Kapakla Uyumsuz",
  CHK_08_HANDLELESS_REQUIRES_PUSH_OR_SERVO: "Kulpsuz Kapak Bas-Aç Mekanizması Gerektirir",
  CHK_08_HANDLE_LENGTH_EXCEEDS_FRONT: "Kulp Boyu Kapak Genişliğini Aşıyor",
  ERR_HANDLE_CC_EXCEEDS_PANEL_SPAN: "Kulp Delik Ekseni Kapak Ölçüsünü Aşıyor",
  CHK_08_RECESSED_GRIP_MIN_THICKNESS: "Gömme Kulp İçin Kapak Kalınlığı Yetersiz",
  CHK_08_SLIDING_DOOR_PROTRUDING_HANDLE: "Sürgü Kapakta Çıkıntılı Kulp Çarpışması",
  CHK_10_POCKET_MIN_DIMENSIONS: "Pocket Kapak Minimum Gövde Ölçüsü Yetersiz",
  CHK_10_TAMBOUR_UNVERIFIED_PREVIEW_ONLY: "Tambur Kapak Fabrika Ön Onayı Gerektirir",
  CHK_11_PANEL_TOO_THIN_FOR_SYSTEM32: "Sistem 32 İçin Panel Kalınlığı Yetersiz",
  CHK_12_JPULL_MATERIAL_THICKNESS: "J-Kulp İçin En Az 19-22mm MDF/Lake Gerekli",
  CHK_SPATIAL_WALL_CORNER_HANDLE_SWING_CLASH: "Duvar Köşesinde Kulp Çarpma Riski (Kör Parça Önerisi)",
  WARN_FRONT_OPENING_SWEEP_COLLISION: "Köşe Kapak / Çekmece Açılım Çakışması",
  INFO_WALL_FILLER_REQUIRED: "Duvar Bitişi Kör Parça Önerisi",
  WARN_CORNER_MECHANISM_DOOR_OPENING: "Kör Köşe Mekanizması Kapak Açıklığı Dar",
  ERR_SLOPED_DOOR_HINGE_SIDE: "Eğimli Dolapta Menteşe Kısa Kenarda Olamaz",
  WARN_ISLAND_OVERHANG_BRACKET: "Ada Tezgâh Konsol Taşması Destek Gerektirir",
  ERR_COUNTERTOP_SEAM_OVER_CUTOUT: "Tezgâh Ek Yeri Ocak/Eviye Kesimine Denk Geliyor",
  WARN_PANTOGRAPH_BOUNDS: "Asansörlü Askı (Pantograf) Ölçü Uyarısı",
  WARN_RAIL_HEIGHT: "Askı Borusu Erişim Yüksekliği Uyarısı",
  WARN_NARROW_PASSAGE: "Geçiş Koridoru Mesafesi Dar",
  WARN_WORK_TRIANGLE: "Mutfak Çalışma Üçgeni Mesafe Uyarısı",
  WARN_WET_ZONE_MOISTURE_BOARD_RECOMMENDED: "Islak Hacim Neme Dayanıklı Gövde Önerisi",
  WARN_GRAIN_GROUP_EXCEEDS_SINGLE_SHEET: "Damar Takibi Tek Plaka Boyunu Aşıyor",
  CHK_TOP_BOTTOM_THROUGH_LEG_SHEAR: "Tip-B Birleşimde Ağır Yük Kesme Uyarısı",
  UNVERIFIED_CUSTOM_GEOMETRY: "Özel Üretim Geometrisi (Teknik Ofis Onayı)",
  V41_FACTORY_RULES_UNVERIFIED: "Fabrika Kalibrasyon Kontrolü",
  CHK_15_DRAFT_CATALOG_VERSION: "Taslak Katalog Sürümü",
  CHK_15_INCOMPLETE_VERIFICATION_SCOPE: "Donanım Teknik Kapsam Kontrolü",
  CHK_15_SOURCE_REVISION_MISMATCH: "Donanım Katalog Sürüm Güncellemesi",
  CHK_15_TAMPERED_PRODUCTION_APPROVAL: "Geçersiz Üretim Onay Statüsü",
  CHK_15_UNVERIFIED_HARDWARE_SOURCE: "Özel Donanım Teknik Kaynak Kontrolü",
  CHK_DATA_CUSTOM_DRAWER_FORMULA_UNVERIFIED: "Özel Çekmece Kesim Formülü Kontrolü",
  CHK_DATA_CUSTOM_MATERIAL_UNVERIFIED: "Özel Malzeme Yoğunluk/Kalınlık Kontrolü",
  ERR_PRODUCTION_GATE: "Üretim Öncesi Onay Engeli",
  ERR_UNIFIED_GATE: "Mühendislik Doğrulama Engeli",
};

export function formatIssueHumanTitle(
  code?: string | null,
  _tier: "simple" | "studio" = "simple"
): string {
  if (!code) return "Tasarım Kontrol Uyarısı";
  const direct = HUMAN_ISSUE_TITLES_TR[code];
  if (direct) return direct;
  if (code.startsWith("CUSTOM_STD_")) {
    return "Özel Standart Kuralı Uyarısı";
  }
  if (code.includes("SHELF")) return "Raf Açıklık / Kalınlık Uyarısı";
  if (code.includes("DRAWER")) return "Çekmece Yerleşim Uyarısı";
  if (code.includes("HINGE") || code.includes("DOOR")) return "Kapak & Menteşe Uyumluluk Uyarısı";
  if (code.includes("PLUMBING") || code.includes("SINK") || code.includes("MEP")) {
    return "Tesisat & Eviye Hizalama Uyarısı";
  }
  if (code.includes("WINDOW")) return "Pencere Kesişim Uyarısı";
  if (code.includes("CEILING")) return "Tavan Yüksekliği Uyarısı";
  if (code.includes("COLLISION") || code.includes("OVERLAP")) return "Yerleşim Çakışma Uyarısı";
  return "Standart ve Ölçü Kontrolü";
}

let inMemoryCustomStandards: CustomStandardRule[] | null = null;

export function loadCustomStandardRules(): CustomStandardRule[] {
  if (typeof window === "undefined") {
    return inMemoryCustomStandards || [];
  }
  try {
    const raw = window.localStorage.getItem(CUSTOM_STANDARDS_STORAGE_KEY);
    if (!raw) return inMemoryCustomStandards || [];
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      inMemoryCustomStandards = parsed as CustomStandardRule[];
      return inMemoryCustomStandards;
    }
  } catch {
    // Ignore storage read errors
  }
  return inMemoryCustomStandards || [];
}

export function saveCustomStandardRules(rules: CustomStandardRule[]): CustomStandardRule[] {
  inMemoryCustomStandards = [...rules];
  if (typeof window !== "undefined") {
    try {
      window.localStorage.setItem(CUSTOM_STANDARDS_STORAGE_KEY, JSON.stringify(inMemoryCustomStandards));
      window.dispatchEvent(new CustomEvent("birim-custom-standards-updated"));
    } catch {
      // Ignore storage quota errors
    }
  }
  return inMemoryCustomStandards;
}

export function addCustomStandardRule(
  input: Omit<CustomStandardRule, "id" | "createdAt">
): CustomStandardRule[] {
  const current = loadCustomStandardRules();
  const next: CustomStandardRule = {
    ...input,
    id: `cstd_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    createdAt: new Date().toISOString(),
  };
  return saveCustomStandardRules([next, ...current]);
}

export function toggleCustomStandardRule(id: string): CustomStandardRule[] {
  const current = loadCustomStandardRules();
  return saveCustomStandardRules(
    current.map((r) => (r.id === id ? { ...r, enabled: !r.enabled } : r))
  );
}

export function removeCustomStandardRule(id: string): CustomStandardRule[] {
  const current = loadCustomStandardRules();
  return saveCustomStandardRules(current.filter((r) => r.id !== id));
}

export function evaluateCustomStandardRules(project: DesignProject): ValidationIssue[] {
  const customRules = loadCustomStandardRules().filter((r) => r.enabled);
  if (customRules.length === 0) return [];
  const issues: ValidationIssue[] = [];

  for (const mod of project.modules) {
    if (mod.category === "complementary" || mod.complementaryRole) continue;
    const T = mod.carcass.panelThickness || 18;
    const numBays = Math.max(1, mod.bays.length);
    const avgBayW = Math.round((mod.dimensions.width - (numBays + 1) * T) / numBays);

    for (const rule of customRules) {
      if (rule.appliesToCategory !== "all" && mod.category !== rule.appliesToCategory) {
        continue;
      }
      const code = `CUSTOM_STD_${rule.id.toUpperCase()}`;

      if (rule.metric === "max_shelf_span_18mm") {
        const hasThinShelf = mod.bays.some((b) =>
          b.shelves.some((s) => !s.isHidden && (s.thickness || T) <= 18)
        );
        if (hasThinShelf && avgBayW > rule.thresholdMm) {
          issues.push({
            code,
            severity: rule.severity,
            targetId: mod.id,
            blockingProduction: rule.severity === "error",
            message: `[${rule.name}] "${mod.name}" 18mm raf açıklığı (${avgBayW}mm), tanımlanan özel sınırı (${rule.thresholdMm}mm) aşıyor.`,
          });
        }
      } else if (rule.metric === "min_plinth_height") {
        const isWallMod = mod.category === "kitchen_wall" || mod.position.y > 100;
        const pH = mod.carcass.plinthHeight ?? 0;
        if (!isWallMod && pH > 0 && pH < rule.thresholdMm) {
          issues.push({
            code,
            severity: rule.severity,
            targetId: mod.id,
            blockingProduction: rule.severity === "error",
            message: `[${rule.name}] "${mod.name}" baza yüksekliği (${pH}mm), özel standart alt sınırının (${rule.thresholdMm}mm) altında.`,
          });
        }
      } else if (rule.metric === "max_single_door_width") {
        mod.bays.forEach((b, bIdx) => {
          const isSingle =
            b.door.type === "single_left" ||
            b.door.type === "single_right" ||
            b.door.doorSystemId === "hinged_single";
          const leafW = (b.customWidth || avgBayW) + T;
          if (isSingle && !mod.isOpenFront && leafW > rule.thresholdMm) {
            issues.push({
              code,
              severity: rule.severity,
              targetId: b.door.id || mod.id,
              blockingProduction: rule.severity === "error",
              message: `[${rule.name}] "${mod.name}" Bölme ${bIdx + 1} tek kapak genişliği (${leafW}mm), özel sınırı (${rule.thresholdMm}mm) aşıyor.`,
            });
          }
        });
      } else if (rule.metric === "min_carcass_depth") {
        if (mod.dimensions.depth < rule.thresholdMm) {
          issues.push({
            code,
            severity: rule.severity,
            targetId: mod.id,
            blockingProduction: rule.severity === "error",
            message: `[${rule.name}] "${mod.name}" gövde derinliği (${mod.dimensions.depth}mm), özel alt sınırın (${rule.thresholdMm}mm) altında.`,
          });
        }
      } else if (rule.metric === "max_module_height") {
        if (mod.dimensions.height > rule.thresholdMm) {
          issues.push({
            code,
            severity: rule.severity,
            targetId: mod.id,
            blockingProduction: rule.severity === "error",
            message: `[${rule.name}] "${mod.name}" yüksekliği (${mod.dimensions.height}mm), özel üst sınırı (${rule.thresholdMm}mm) aşıyor.`,
          });
        }
      } else if (rule.metric === "min_drawer_height" || rule.metric === "max_drawer_height") {
        mod.bays.forEach((b) => {
          b.drawers.forEach((d, dIdx) => {
            if (rule.metric === "min_drawer_height" && d.height < rule.thresholdMm) {
              issues.push({
                code,
                severity: rule.severity,
                targetId: d.id,
                blockingProduction: rule.severity === "error",
                message: `[${rule.name}] "${mod.name}" Çekmece ${dIdx + 1} yüksekliği (${d.height}mm), alt sınırın (${rule.thresholdMm}mm) altında.`,
              });
            } else if (rule.metric === "max_drawer_height" && d.height > rule.thresholdMm) {
              issues.push({
                code,
                severity: rule.severity,
                targetId: d.id,
                blockingProduction: rule.severity === "error",
                message: `[${rule.name}] "${mod.name}" Çekmece ${dIdx + 1} yüksekliği (${d.height}mm), üst sınırı (${rule.thresholdMm}mm) aşıyor.`,
              });
            }
          });
        });
      } else if (rule.metric === "min_wall_filler_gap") {
        if (mod.position.x > 0 && mod.position.x < rule.thresholdMm) {
          issues.push({
            code,
            severity: rule.severity,
            targetId: mod.id,
            blockingProduction: rule.severity === "error",
            message: `[${rule.name}] "${mod.name}" sol duvar boşluğu (${mod.position.x}mm), özel kör parça alt sınırının (${rule.thresholdMm}mm) altında.`,
          });
        }
      }
    }
  }

  return issues;
}
