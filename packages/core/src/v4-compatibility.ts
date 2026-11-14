import {
  CompatibilityStatus,
  DesignProject,
  ModuleInstance,
  ValidationIssue,
} from "./types";
import { DEFAULT_MATERIALS } from "./defaults";
import { validateProject } from "./rules";
import { loadCustomStandardRules } from "./standards-registry";
function loadCustomStandardRulesCount(): number {
  return loadCustomStandardRules().filter((r) => r.enabled).length;
}
import {
  calculateFourSpaceDimensions,
  inferDoorSystemIdFromType,
} from "./v4-profiles";
import {
  EvidenceCoverageMatrix,
  isSourceFullyVerifiedForProduction,
  PartOperationVerificationEntry,
} from "./v4-source-registry";

export interface CompatibilityReport {
  overallStatus: CompatibilityStatus;
  canApproveProduction: boolean;
  checkedCategoriesCount: number;
  issues: ValidationIssue[];
  evidenceMatrix: EvidenceCoverageMatrix;
}

export interface EvaluateCompatibilityOptions {
  hardwareSourceMap?: Record<string, { sourceId?: string; revision?: string; sku?: string }>;
  referenceDateIso?: string;
  activeCatalogVersion?: string;
}

const DEFAULT_HARDWARE_SOURCE_MAP: Record<string, { sourceId: string; revision: string }> = {
  hw_blum_71b3550: { sourceId: "SRC_BLUM_CAT_HINGE", revision: "2024.1" },
  hw_blum_71b3650: { sourceId: "SRC_BLUM_CAT_HINGE", revision: "2024.1" },
  hw_blum_71b3750: { sourceId: "SRC_BLUM_CAT_HINGE", revision: "2024.1" },
  hw_blum_71b7550: { sourceId: "SRC_BLUM_CAT_HINGE", revision: "2024.1" },
  hw_blum_71b9550: { sourceId: "SRC_BLUM_CAT_HINGE", revision: "2024.1" },
  hw_blum_79b9458: { sourceId: "SRC_BLUM_CAT_HINGE", revision: "2024.1" },
  hw_hettich_9071205: { sourceId: "SRC_HETTICH_SENSYS", revision: "2024.1" },
  hw_hettich_9099540: { sourceId: "SRC_HETTICH_SENSYS", revision: "2024.1" },
  hw_salice_c7p6ae9: { sourceId: "SRC_SALICE_SILENTIA", revision: "2024.1" },
  hw_blum_legrabox_m40: { sourceId: "SRC_BLUM_LEGRABOX", revision: "2024.1" },
  hw_blum_legrabox_c70: { sourceId: "SRC_BLUM_LEGRABOX", revision: "2024.1" },
  hw_blum_tandembox_m30: { sourceId: "SRC_BLUM_TANDEMBOX", revision: "2024.1" },
  hw_blum_movento_760h: { sourceId: "SRC_BLUM_MOVENTO", revision: "2024.1" },
  hw_hettich_avantech_m: { sourceId: "SRC_HETTICH_AVANTECH", revision: "2024.1" },
  hw_blum_aventos_hk_27: { sourceId: "SRC_BLUM_AVENTOS", revision: "2024.1" },
  hw_blum_aventos_hf_25: { sourceId: "SRC_BLUM_AVENTOS", revision: "2024.1" },
  hw_blum_aventos_hl_25: { sourceId: "SRC_BLUM_AVENTOS", revision: "2024.1" },
  hw_hettich_topline_l: { sourceId: "SRC_HETTICH_TOPLINE", revision: "2024.1" },
  hw_hafele_slido_bottom: { sourceId: "SRC_HAFELE_MATRIX", revision: "2024.1" },
  hw_hettich_wingline_l: { sourceId: "SRC_HETTICH_WINGLINE", revision: "2024.1" },
  hw_blum_revego_uno: { sourceId: "SRC_BLUM_REVEGO", revision: "2024.1" },
  hw_hawa_concepta3_25: { sourceId: "SRC_HAWA_CONCEPTA3", revision: "2024.1" },
};

/**
 * FAZ 07 — Universal Compatibility Engine (15 Deterministic Rule Categories)
 * Evaluates a module across all 15 engineering, hardware, door, handle, and manufacturing categories,
 * returning structured ValidationIssues with automatic remediation suggestions.
 */
export function evaluateModuleCompatibility(module: ModuleInstance): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  if (module.category === "complementary" || module.complementaryRole || module.carcass.hullShape === "capsule_table") {
    return issues;
  }
  const fourSpace = calculateFourSpaceDimensions(module);
  const { width, height, depth } = module.dimensions;
  const T_panel = module.carcass.panelThickness;
  const doorMat =
    DEFAULT_MATERIALS.find((m) => m.id === module.carcass.doorMaterialId) || DEFAULT_MATERIALS[2];

  // Unverified / Bespoke geometry check
  if (module.requiresFactoryValidation) {
    issues.push({
      severity: "warning",
      code: "UNVERIFIED_CUSTOM_GEOMETRY",
      message: `"${module.name}" özel üretim geometrisi içeriyor; CNC onayı öncesi fabrika mühendislik doğrulaması zorunludur.`,
      targetId: module.id,
      blockingProduction: true,
      compatibilityStatus: "UNVERIFIED",
      categoryIndex: 11,
      suggestions: [
        "Standart dikdörtgen modül şablonlarından birini seçin.",
        "Fabrika teknik ofis onayı talep edin (BLOCKED_BY_FACTORY_VALIDATION).",
      ],
      sourceId: "SRC_BIRIM_FACTORY_V3",
    });
  }

  // Category 14: Kitchen Built-in Appliance Recess Rules (EN 1116:2018)
  const isSoloSurround =
    module.templateId?.includes("fridge_surround") ||
    module.name.toLowerCase().includes("solo buzdolabı");
  const isApplianceHousing =
    !isSoloSurround &&
    (module.templateId?.includes("oven") ||
      module.templateId?.includes("fridge") ||
      module.templateId?.includes("microwave") ||
      module.name.toLowerCase().includes("fırın") ||
      module.name.toLowerCase().includes("ankastre"));

  if (isApplianceHousing) {
    if (width !== 600) {
      issues.push({
        severity: "error",
        code: "CHK_14_APPLIANCE_WIDTH_EN1116",
        message: `"${module.name}" ankastre cihaz modülü dış genişliği (${width}mm) EN 1116 standardına (600mm) uymuyor.`,
        targetId: module.id,
        blockingProduction: true,
        compatibilityStatus: "INCOMPATIBLE",
        categoryIndex: 14,
        suggestions: [
          "Modül genişliğini 600mm EN 1116 ankastre standardına sabitleyin.",
          "Kalan boşluğu yan dolaplara veya dolgu paneline (kör parça) aktarın.",
        ],
        sourceId: "SRC_STD_EN1116_2018",
      });
    }
    const minDepth = module.templateId?.includes("microwave_wall") ? 380 : 560;
    if (depth < minDepth) {
      issues.push({
        severity: "error",
        code: "CHK_14_APPLIANCE_DEPTH_CLEARANCE",
        message: `"${module.name}" derinliği (${depth}mm), cihaz montajı ve arka havalandırma boşluğu (min. ${minDepth}mm) için yetersiz.`,
        targetId: module.id,
        blockingProduction: true,
        compatibilityStatus: "INCOMPATIBLE",
        categoryIndex: 14,
        suggestions: [`Modül derinliğini en az ${minDepth}mm (önerilen 580-600mm) yapın.`],
        sourceId: "SRC_STD_EN1116_2018",
      });
    }
  }

  // Evaluate each bay for Categories 1..13
  module.bays.forEach((bay, bayIdx) => {
    const dSys = bay.door.doorSystemId || inferDoorSystemIdFromType(bay.door.type);
    const leafInfo = fourSpace.doorLeaves[bayIdx];
    const bayW = fourSpace.usableInternal.bayClearWidthsMm[bayIdx] || 0;
    const T_door = bay.door.doorThicknessMm || module.carcass.doorThickness || doorMat.thickness || 18;
    const handleCat =
      bay.door.handleCategory ||
      (bay.door.handleType === "push_to_open" || bay.door.handleType === "none"
        ? "handleless_plain"
        : bay.door.handleType === "integrated_profile"
        ? "gola_profile"
        : "bar_handle");
    const openTech =
      bay.door.openingTechnology ||
      (bay.door.handleType === "push_to_open"
        ? "push_to_open"
        : bay.door.softClose
        ? "soft_close"
        : "manual_standard");

    // Category 12: Material Suitability (Shelf Span Deflection & J-Pull Material Check)
    if ((bayW > 900 && bay.shelves.some((s) => !s.isGlass && s.isAdjustable && (s.thickness || 18) <= 18)) || (bayW > 1200 && (bay.shelves.length > 0 || bay.hangingRails.length > 0))) {
      issues.push({
        severity: "warning",
        code: "CHK_12_SHELF_SPAN_DEFLECTION",
        message: `Bölme ${bayIdx + 1} net iç genişliği (${bayW}mm), 18mm panel için 950mm sehim sınırını aşıyor.`,
        targetId: `bay_${bayIdx}`,
        compatibilityStatus: "COMPATIBLE_WITH_CONDITIONS",
        categoryIndex: 12,
        suggestions: [
          "Bölme sayısını artırarak orta dikme ekleyin.",
          "Raf kalınlığını 25mm'ye yükseltin veya arka destek kayıtı kullanın.",
        ],
        sourceId: "SRC_STD_ISO7170_2021",
      });
    }

    if (handleCat === "j_pull") {
      if (T_door < 19 || (doorMat.category !== "lacquer" && doorMat.category !== "wood")) {
        issues.push({
          severity: "error",
          code: "CHK_12_JPULL_MATERIAL_THICKNESS",
          message: `Bölme ${bayIdx + 1} J-Pull (kendinden kulplu) kapak seçimi en az 19-22mm kalınlık ve MDF/Lake veya Ahşap Kaplama malzeme gerektirir (Mevcut: ${T_door}mm ${doorMat.name}).`,
          targetId: bay.door.id,
          blockingProduction: true,
          compatibilityStatus: "INCOMPATIBLE",
          categoryIndex: 12,
          suggestions: [
            "Kapak malzemesini İpek Mat Lake veya Doğal Kaplama ve kalınlığı 22mm yapın.",
            "Alternatif olarak Gola Profil veya Kenar Kulpu (edge_profile) seçin.",
          ],
          sourceId: "SRC_BIRIM_FACTORY_V3",
        });
      }
    }

    // Category 1: Carcass / Door System Fit
    if (
      module.carcass.hullShape !== "capsule_stadium" &&
      (dSys === "sliding_top_hung" || dSys === "sliding_bottom_rolling") &&
      (module.bays.length < 2 || width < 1100)
    ) {
      issues.push({
        severity: "error",
        code: "CHK_01_SLIDING_REQUIRES_MULTI_BAY",
        message: `Sürgülü kapak sistemi ("${module.name}") en az 2 bölme ve 1100mm gövde genişliği gerektirir (Mevcut: ${module.bays.length} bölme, ${width}mm).`,
        targetId: bay.door.id,
        blockingProduction: true,
        compatibilityStatus: "INCOMPATIBLE",
        categoryIndex: 1,
        suggestions: [
          "Kapak sistemini Tek veya Çift Menteşeli (hinged_double) yapın.",
          "Gövde genişliğini en az 1400mm ve bölme sayısını 2 yapın.",
        ],
        sourceId: "SRC_HETTICH_TOPLINE",
      });
    }

    // Category 2: Door / Lift Mechanism Match
    if (dSys === "lift_up_stay" && fourSpace.netPanelCut.sidePanelHeightMm > 650) {
      issues.push({
        severity: "error",
        code: "CHK_02_LIFT_STAY_HEIGHT_EXCEEDED",
        message: `Tek parça yukarı kalkar kapak (AVENTOS HK top / Free Flap) maksimum 600-650mm gövde yüksekliğini destekler (Mevcut: ${fourSpace.netPanelCut.sidePanelHeightMm}mm).`,
        targetId: bay.door.id,
        blockingProduction: true,
        compatibilityStatus: "INCOMPATIBLE",
        categoryIndex: 2,
        suggestions: [
          "İki parçalı Katlanır Kalkar (lift_bi_fold / AVENTOS HF top, 480-1040mm) mekanizmaya geçin.",
          "Üst dolap yüksekliğini 600mm veya altına düşürün.",
        ],
        sourceId: "SRC_BLUM_AVENTOS",
      });
    }

    if (dSys === "lift_bi_fold" && (fourSpace.netPanelCut.sidePanelHeightMm < 450 || fourSpace.netPanelCut.sidePanelHeightMm > 1200)) {
      issues.push({
        severity: "error",
        code: "CHK_02_LIFT_BIFOLD_HEIGHT_RANGE",
        message: `Katlanır kalkar kapak (AVENTOS HF top / Free Fold) 480-1200mm gövde yüksekliği gerektirir (Mevcut: ${fourSpace.netPanelCut.sidePanelHeightMm}mm).`,
        targetId: bay.door.id,
        blockingProduction: true,
        compatibilityStatus: "INCOMPATIBLE",
        categoryIndex: 2,
        suggestions: [
          "450mm altı dolaplar için Tek Parça Kalkar (lift_up_stay / HK top) seçin.",
          "1200mm üstü dolaplar için Menteşeli Kapak (hinged_single/double) seçin.",
        ],
        sourceId: "SRC_BLUM_AVENTOS",
      });
    }

    // Category 3: Door Weight & Power Factor (LF) Limits
    if (leafInfo && leafInfo.leafCount > 0) {
      const maxKgByHinges: Record<number, number> = { 1: 6, 2: 12, 3: 17, 4: 22, 5: 28 };
      const activeHingeCount = Math.max(2, Math.min(5, leafInfo.effectiveHingeCount || 2));
      const maxAllowedLeafKg = maxKgByHinges[activeHingeCount] ?? 28;
      if (
        (dSys === "hinged_single" || dSys === "hinged_double" || dSys === "hinged_inset" || dSys === "hinged_overlay_variant") &&
        leafInfo.leafWeightKg > maxAllowedLeafKg
      ) {
        const exceedsAbsoluteMax = leafInfo.leafWeightKg > 28;
        issues.push({
          severity: "error",
          code: "CHK_03_DOOR_WEIGHT_EXCEEDS_HINGE_LIMIT",
          message: exceedsAbsoluteMax
            ? `Bölme ${bayIdx + 1} kapak kanat ağırlığı (${leafInfo.leafWeightKg} kg), 5 menteşe için bile azami 28 kg taşıma sınırını aşıyor.`
            : `Bölme ${bayIdx + 1} kapak kanat ağırlığı (${leafInfo.leafWeightKg} kg), seçili ${activeHingeCount} adet menteşenin güvenli taşıma sınırını (${maxAllowedLeafKg} kg) aşıyor (en az ${leafInfo.recommendedHingesPerLeaf} menteşe gerekir).`,
          targetId: bay.door.id,
          blockingProduction: true,
          compatibilityStatus: "INCOMPATIBLE",
          categoryIndex: 3,
          suggestions: exceedsAbsoluteMax
            ? [
                "Tek kapağı Çift Kapağa (hinged_double) bölün veya bölme genişliğini daraltın.",
                "Aynalı/ağır kapak yerine daha hafif kapak malzemesi seçin.",
              ]
            : [
                `Menteşe sayısını en az ${leafInfo.recommendedHingesPerLeaf} adede yükseltin.`,
                "Tek kapağı Çift Kapağa (hinged_double) bölün.",
              ],
          sourceId: "SRC_BLUM_CAT_HINGE",
        });
      }

      if (dSys === "lift_up_stay" && (leafInfo.powerFactorLf > 9000 || leafInfo.leafWeightKg > 18)) {
        issues.push({
          severity: "error",
          code: "CHK_03_LIFT_POWER_FACTOR_OVERLOAD",
          message: `Bölme ${bayIdx + 1} kalkar kapak güç faktörü (LF = ${leafInfo.powerFactorLf}, Ağırlık = ${leafInfo.leafWeightKg} kg) AVENTOS HK top üst sınırını (LF 9000 / 18 kg) aşıyor.`,
          targetId: bay.door.id,
          blockingProduction: true,
          compatibilityStatus: "INCOMPATIBLE",
          categoryIndex: 3,
          suggestions: [
            "Kapak malzemesini daha hafif bir malzemeyle değiştirin.",
            "Dolap genişliğini daraltın veya 2 bölmeye ayırın.",
            "3. bir kalkar güç ünitesi ekleyin.",
          ],
          sourceId: "SRC_BLUM_AVENTOS",
        });
      }

      if (dSys === "pocket_retractable" && leafInfo.leafWeightKg > 35) {
        issues.push({
          severity: "error",
          code: "CHK_03_POCKET_DOOR_WEIGHT_LIMIT",
          message: `Pocket kapak kanat ağırlığı (${leafInfo.leafWeightKg} kg), Blum REVEGO / Hawa Concepta III 35 kg üst sınırını aşıyor.`,
          targetId: bay.door.id,
          blockingProduction: true,
          compatibilityStatus: "INCOMPATIBLE",
          categoryIndex: 3,
          suggestions: [
            "18mm hafif MDF/Melamin kapak malzemesi kullanın.",
            "Tek kanat yerine REVEGO duo / Folding Concepta III çift kanat seçin.",
          ],
          sourceId: "SRC_BLUM_REVEGO",
        });
      }
    }

    // Category 4: Door Thickness Limits
    if (
      T_door > 24 &&
      bay.door.hardwareProductId !== "hw_blum_71b9550" &&
      bay.door.hardwareProductId !== "hw_blum_71b7550" &&
      bay.door.hardwareProductId !== "hw_hettich_9099540" &&
      dSys.startsWith("hinged")
    ) {
      issues.push({
        severity: "error",
        code: "CHK_04_THICK_DOOR_REQUIRES_SPECIAL_HINGE",
        message: `${T_door}mm kapak kalınlığı standart 110° menteşe sınırını (max 24mm) aşıyor; açılışta kenar çarpması oluşur.`,
        targetId: bay.door.id,
        blockingProduction: true,
        compatibilityStatus: "INCOMPATIBLE",
        categoryIndex: 4,
        suggestions: [
          "Kalın kapak menteşesi (Blum 71B9550 95° veya Hettich Sensys 8657i 165°) seçin.",
          "Kapak kalınlığını 18-22mm aralığına düşürün.",
        ],
        sourceId: "SRC_BLUM_CAT_HINGE",
      });
    }

    // Category 5: Leaf Width & Height Limits
    if (
      leafInfo &&
      (dSys === "hinged_single" || dSys === "hinged_double" || dSys === "hinged_inset") &&
      leafInfo.leafWidthMm > 920
    ) {
      issues.push({
        severity: "error",
        code: "CHK_05_HINGED_LEAF_TOO_WIDE",
        message: `Bölme ${bayIdx + 1} menteşeli kapak kanat genişliği (${leafInfo.leafWidthMm}mm) 920mm azami sarkma sınırını aşıyor.`,
        targetId: bay.door.id,
        blockingProduction: true,
        compatibilityStatus: "INCOMPATIBLE",
        categoryIndex: 5,
        suggestions: [
          "Tek kapak yerine Çift Kapak (hinged_double) seçin.",
          "Modülü 2 bölmeye ayırın.",
        ],
        sourceId: "SRC_BLUM_CAT_HINGE",
      });
    } else if (
      leafInfo &&
      (dSys === "hinged_single" || dSys === "hinged_double" || dSys === "hinged_inset") &&
      leafInfo.leafWidthMm > 900
    ) {
      issues.push({
        severity: "warning",
        code: "CHK_05_HINGED_LEAF_WIDE_WARNING",
        message: `Bölme ${bayIdx + 1} menteşeli kapak kanat genişliği (${leafInfo.leafWidthMm}mm) 900mm konfor sınırını aşıyor; ilave menteşe veya çift kapak önerilir.`,
        targetId: bay.door.id,
        compatibilityStatus: "COMPATIBLE_WITH_CONDITIONS",
        categoryIndex: 5,
        suggestions: [
          "Tek kapak yerine Çift Kapak (hinged_double) seçin.",
          "Menteşe sayısını +1 artırın.",
        ],
        sourceId: "SRC_BLUM_CAT_HINGE",
      });
    } else if (
      leafInfo &&
      leafInfo.leafCount === 1 &&
      (dSys === "hinged_single" || dSys === "hinged_inset") &&
      leafInfo.leafWidthMm > 650
    ) {
      issues.push({
        severity: "warning",
        code: "CHK_05_SINGLE_LEAF_SAG_ADVISORY",
        message: `Bölme ${bayIdx + 1} tek kanat menteşeli kapak genişliği (${leafInfo.leafWidthMm}mm > 650mm) uzun dönemde menteşe sarkma momenti oluşturabilir.`,
        targetId: bay.door.id,
        compatibilityStatus: "COMPATIBLE_WITH_CONDITIONS",
        categoryIndex: 5,
        suggestions: [
          "Kullanıcı onayıyla Çift Kanatlı Kapak (hinged_double) sistemine geçin.",
          "Geniş tek kanatta +1 ilave menteşe kullanın.",
        ],
        sourceId: "SRC_BLUM_CAT_HINGE",
      });
    }

    // Category 7: Internal Drawer & Hinge Protrusion Collision
    const hasInternalDrawer = bay.drawers.some((d) => d.isInternal);
    if (
      hasInternalDrawer &&
      dSys.startsWith("hinged") &&
      bay.door.hardwareProductId !== "hw_blum_71b7550" &&
      bay.door.hardwareProductId !== "hw_hettich_9099540"
    ) {
      issues.push({
        severity: "warning",
        code: "CHK_07_INTERNAL_DRAWER_REQUIRES_ZERO_PROTRUSION",
        message: `Bölme ${bayIdx + 1} içinde iç çekmece (İç Çekmece / SPACE TOWER) bulunuyor; standart 110° menteşe kapak iç çekmece çıkışını engeller.`,
        targetId: bay.door.id,
        compatibilityStatus: "COMPATIBLE_WITH_CONDITIONS",
        categoryIndex: 7,
        suggestions: [
          "Menteşeyi 155° Sıfır Çıkıntılı (Blum 71B7550) veya 165° (Hettich Sensys 8657i) modele yükseltin.",
          "İç çekmece yanına 25mm distans çıtası ekleyin.",
        ],
        sourceId: "SRC_BLUM_CAT_HINGE",
      });
    }

    // Category 8: Handle & Opening Mechanism Compatibility
    if (
      handleCat === "gola_profile" &&
      (dSys === "hinged_inset" || bay.door.overlayType === "inset" || bay.door.type.startsWith("inset"))
    ) {
      issues.push({
        severity: "error",
        code: "CHK_08_GOLA_INCOMPATIBLE_WITH_INSET",
        message: `Bölme ${bayIdx + 1}: Gola profil kanalı gövde ön kenarında kapak arkası parmak boşluğu gerektirir; içerlek (inset) kapakla kullanılamaz.`,
        targetId: bay.door.id,
        blockingProduction: true,
        compatibilityStatus: "INCOMPATIBLE",
        categoryIndex: 8,
        suggestions: [
          "Kapak biniş tipini Tam Binişli (full_overlay) yapın.",
          "İçerlek kapak için Düğme Kulp (knob), Çubuk Kulp (bar_handle) veya Bas-Aç seçin.",
        ],
        sourceId: "SRC_BIRIM_FACTORY_V3",
      });
    }

    if (handleCat === "recessed_grip" && T_door < 18) {
      issues.push({
        severity: "error",
        code: "CHK_08_RECESSED_GRIP_MIN_THICKNESS",
        message: `Bölme ${bayIdx + 1}: Gömme kulp (recessed_grip) havuz derinliği en az 18mm kapak kalınlığı gerektirir (Mevcut: ${T_door}mm).`,
        targetId: bay.door.id,
        blockingProduction: true,
        compatibilityStatus: "INCOMPATIBLE",
        categoryIndex: 8,
        suggestions: [
          "Kapak kalınlığını en az 18mm yapın.",
          "İnce kapak için Kenar Profil Kulpu (edge_profile) veya Kulpsuz Bas-Aç seçin.",
        ],
        sourceId: "SRC_HAFELE_HANDLES",
      });
    }

    if (
      handleCat === "long_profile_handle" &&
      leafInfo &&
      leafInfo.leafCount > 0 &&
      leafInfo.leafHeightMm < 1040
    ) {
      issues.push({
        severity: "error",
        code: "CHK_08_HANDLE_LENGTH_EXCEEDS_FRONT",
        message: `Bölme ${bayIdx + 1}: 1000mm Dikey Boy Profil Kulp (HANDLE_LONG_960), kapak kanat yüksekliğini (${leafInfo.leafHeightMm}mm, min 1040mm) aşıyor.`,
        targetId: bay.door.id,
        blockingProduction: true,
        compatibilityStatus: "INCOMPATIBLE",
        categoryIndex: 8,
        suggestions: [
          "Standart Çubuk Kulp (bar_handle, 184mm) veya Kenar Profil Kulpu (edge_profile) seçin.",
          "Kapak kanat yüksekliğini en az 1040mm olacak şekilde dolap boyunu büyütün.",
        ],
        sourceId: "SRC_HAFELE_HANDLES",
      });
    }

    if (
      handleCat === "long_profile_handle" &&
      bay.drawers.some((d) => !d.isInternal) &&
      bayW < 1040
    ) {
      issues.push({
        severity: "error",
        code: "CHK_08_HANDLE_LENGTH_EXCEEDS_FRONT",
        message: `Bölme ${bayIdx + 1}: 1000mm Boy Profil Kulp (HANDLE_LONG_960), dış çekmece klapa genişliğini (${bayW}mm, min 1040mm) aşıyor.`,
        targetId: bay.door.id,
        blockingProduction: true,
        compatibilityStatus: "INCOMPATIBLE",
        categoryIndex: 8,
        suggestions: [
          "Çekmeceli bölmede Çubuk Kulp (bar_handle) veya Kenar Profil Kulpu (edge_profile) seçin.",
        ],
        sourceId: "SRC_HAFELE_HANDLES",
      });
    }

    if (
      handleCat === "handleless_plain" &&
      (openTech === "manual_standard" || openTech === "soft_close") &&
      dSys !== "open"
    ) {
      issues.push({
        severity: "error",
        code: "CHK_08_HANDLELESS_REQUIRES_PUSH_OR_SERVO",
        message: `Bölme ${bayIdx + 1}: Kulpsuz düz cephe (handleless_plain) ile manuel/soft-close açılma seçildi; kapak tutulamayacağı için açılamaz!`,
        targetId: bay.door.id,
        blockingProduction: true,
        compatibilityStatus: "INCOMPATIBLE",
        categoryIndex: 8,
        suggestions: [
          "Açılma teknolojisini Bas-Aç (push_to_open / push_to_open_soft_close) veya Elektrikli (servo_electric) yapın.",
          "Kulp tipini Gola Profil, J-Pull veya Çubuk Kulp olarak değiştirin.",
        ],
        sourceId: "SRC_BLUM_CAT_HINGE",
      });
    }

    if (
      (dSys === "sliding_top_hung" || dSys === "sliding_bottom_rolling") &&
      (handleCat === "bar_handle" || handleCat === "knob")
    ) {
      issues.push({
        severity: "warning",
        code: "CHK_08_SLIDING_DOOR_PROTRUDING_HANDLE",
        message: `Bölme ${bayIdx + 1}: Sürgülü kapakta dışa çıkıntılı kulp (${handleCat}) arka kapağın tam geçişini kısıtlar.`,
        targetId: bay.door.id,
        compatibilityStatus: "COMPATIBLE_WITH_CONDITIONS",
        categoryIndex: 8,
        suggestions: [
          "Gömme Kulp (recessed_grip) veya Kenar Profil Kulpu (edge_profile) seçin.",
        ],
        sourceId: "SRC_HETTICH_TOPLINE",
      });
    }

    // Category 9 & 13: Runner / Drawer Depth & Load Capacity
    bay.drawers.forEach((drawer, dIdx) => {
      const requestedNl = drawer.nominalLengthMm || 0;
      const clearDepth = fourSpace.usableInternal.netInnerDepthMm;
      if (requestedNl > 0 && requestedNl + 10 > clearDepth) {
        issues.push({
          severity: "error",
          code: "CHK_09_RUNNER_EXCEEDS_CARCASS_DEPTH",
          message: `Bölme ${bayIdx + 1} Çekmece ${dIdx + 1} ray boyu (NL=${requestedNl}mm) kullanılabilir iç derinliği (${clearDepth}mm) aşıyor.`,
          targetId: drawer.id,
          blockingProduction: true,
          compatibilityStatus: "INCOMPATIBLE",
          categoryIndex: 9,
          suggestions: [
            `Ray nominal boyunu ${Math.floor((clearDepth - 15) / 50) * 50}mm kademesine düşürün.`,
            `Gövde derinliğini en az ${requestedNl + 35}mm yapın.`,
          ],
          sourceId: "SRC_BLUM_LEGRABOX",
        });
      }

      if (bayW >= 900 && drawer.height >= 240 && drawer.hardwareProductId === "hw_blum_tandembox_m30") {
        issues.push({
          severity: "warning",
          code: "CHK_13_HEAVY_DRAWER_LOAD_UPGRADE",
          message: `Bölme ${bayIdx + 1} geniş (${bayW}mm) ve derin (${drawer.height}mm) tencere çekmecesi için 30kg ray yerine 70kg ağır hizmet rayı önerilir.`,
          targetId: drawer.id,
          compatibilityStatus: "COMPATIBLE_WITH_CONDITIONS",
          categoryIndex: 13,
          suggestions: [
            "Çekmece sistemini Blum LEGRABOX 70kg (hw_blum_legrabox_c70) veya MOVENTO 766H (70kg) modeline yükseltin.",
          ],
          sourceId: "SRC_STD_EN15338",
        });
      }
    });

    // Category 10: Pocket & Tambour Clearances
    if (dSys === "pocket_retractable") {
      if (depth < 573 || height < 1200) {
        issues.push({
          severity: "error",
          code: "CHK_10_POCKET_MIN_DIMENSIONS",
          message: `Pocket (gizlenen) kapak sistemi en az 573mm gövde derinliği ve 1200mm yükseklik gerektirir (Mevcut: D=${depth}mm, H=${height}mm).`,
          targetId: bay.door.id,
          blockingProduction: true,
          compatibilityStatus: "INCOMPATIBLE",
          categoryIndex: 10,
          suggestions: [
            "Modül derinliğini en az 600-650mm ve yüksekliğini 1800-2200mm yapın.",
            "Sığ dolaplar için Katlanır Kapak (folding_side / WingLine L) seçin.",
          ],
          sourceId: "SRC_BLUM_REVEGO",
        });
      }
    }

    if (dSys === "tambour_roller") {
      issues.push({
        severity: "warning",
        code: "CHK_10_TAMBOUR_UNVERIFIED_PREVIEW_ONLY",
        message: `Tambur / panjur kapak sistemi şu an yalnızca 3D mimari önizleme düzeyindedir; fabrika sarım kutusu ve kanal freze doğrulaması tamamlanmadan CNC üretim onayı verilemez.`,
        targetId: bay.door.id,
        blockingProduction: true,
        compatibilityStatus: "UNVERIFIED",
        categoryIndex: 10,
        suggestions: [
          "Üretim onayı için Paralel Kalkar (lift_parallel) veya Pocket Kapak (pocket_retractable) sistemine geçin.",
        ],
        sourceId: "SRC_BIRIM_FACTORY_V3",
      });
    }

    // Category 11: Manufacturing & System 32 Drilling Rules
    if (T_panel < 16) {
      issues.push({
        severity: "error",
        code: "CHK_11_PANEL_TOO_THIN_FOR_SYSTEM32",
        message: `Gövde panel kalınlığı (${T_panel}mm), System 32 (12-13.5mm derinlikli) Minifix ve menteşe tas delikleri için asgari 16mm sınırının altında.`,
        targetId: module.id,
        blockingProduction: true,
        compatibilityStatus: "INCOMPATIBLE",
        categoryIndex: 11,
        suggestions: ["Gövde panel kalınlığını 18mm Birim fabrika standardına ayarlayın."],
        sourceId: "SRC_BIRIM_FACTORY_V3",
      });
    }
  });

  return issues;
}

/**
 * Evaluates full project compatibility combining base V3.1 geometric validations
 * with the 15-category V4 Universal Compatibility Engine.
 */
const defaultCompatCache = new WeakMap<DesignProject, CompatibilityReport>();

export function evaluateProjectCompatibility(
  project: DesignProject,
  options: EvaluateCompatibilityOptions = {}
): CompatibilityReport {
  const isDefaultCall =
    !options.hardwareSourceMap &&
    !options.referenceDateIso &&
    !options.activeCatalogVersion &&
    loadCustomStandardRulesCount() === 0;
  if (isDefaultCall) {
    const cached = defaultCompatCache.get(project);
    if (cached) return cached;
  }
  const baseIssues = validateProject(project);
  const hwMap = { ...DEFAULT_HARDWARE_SOURCE_MAP, ...(options.hardwareSourceMap || {}) };
  const refDate = options.referenceDateIso || "2026-11-05";
  const activeCatalogVersion = options.activeCatalogVersion || project.libraryVersionId || "lib_v4_0_0";

  const matrixEntries: PartOperationVerificationEntry[] = [];
  const v4Issues: ValidationIssue[] = [];

  // 1. Check factory CNC / beam saw baseline source
  const factoryCheck = isSourceFullyVerifiedForProduction("SRC_BIRIM_FACTORY_V3", "3.1", refDate);
  matrixEntries.push({
    targetId: "Biesse_Selco_WNT_600",
    targetType: "cnc_machine",
    sourceId: "SRC_BIRIM_FACTORY_V3",
    requiredSourceRevision: "3.1",
    status: factoryCheck.verified ? "VERIFIED" : "NEEDS_EVIDENCE",
    missingDomains: factoryCheck.missingDomains,
    blockingReason: factoryCheck.reason,
  });

  if (!factoryCheck.verified) {
    v4Issues.push({
      code: "V41_FACTORY_RULES_UNVERIFIED",
      severity: "warning",
      blockingProduction: true,
      compatibilityStatus: "UNVERIFIED",
      targetId: project.id,
      sourceId: "SRC_BIRIM_FACTORY_V3",
      message:
        "Üretim kuralları, kulp montaj ölçüleri ve CNC postprocessor fiziksel fabrika doğrulaması bekliyor. Görselleştirme ve fiyatlar temsilidir.",
    });
  }

  // 2. Check draft catalog / libraryVersionId
  if (activeCatalogVersion.includes("draft") || activeCatalogVersion.includes("unverified")) {
    matrixEntries.push({
      targetId: activeCatalogVersion,
      targetType: "catalog_release",
      status: "NEEDS_EVIDENCE",
      missingDomains: ["physicalFactorySample"],
      blockingReason: `Taslak katalog sürümü (${activeCatalogVersion}) ile üretim onayı verilemez.`,
    });
    v4Issues.push({
      code: "CHK_15_DRAFT_CATALOG_VERSION",
      severity: "warning",
      blockingProduction: true,
      compatibilityStatus: "UNVERIFIED",
      targetId: project.id,
      message: `Proje taslak katalog sürümüne (${activeCatalogVersion}) bağlı; üretim onayı için yayınlanmış ve doğrulanmış sürüm gereklidir.`,
    });
  }

  project.modules.forEach((mod) => {
    v4Issues.push(...evaluateModuleCompatibility(mod));

    // Evaluate module hardware & handle verification coverage
    mod.bays.forEach((bay, bayIdx) => {
      const dSys = bay.door.doorSystemId || inferDoorSystemIdFromType(bay.door.type);

      // Overhead Lift Opening Sweep vs Ceiling Height
      if (
        (dSys === "lift_up_stay" || dSys === "lift_parallel" || dSys === "lift_bi_fold") &&
        mod.position.y + mod.dimensions.height + 180 > project.space.ceilingHeight
      ) {
        v4Issues.push({
          severity: "warning",
          code: "CHK_06_LIFT_DOOR_CEILING_CLEARANCE",
          message: `"${mod.name}" yukarı kalkar kapağı açıldığında tavan (${project.space.ceilingHeight}mm) ile çarpışabilir; 86° açı sınırlayıcı klips kullanılmalıdır.`,
          targetId: bay.door.id,
          compatibilityStatus: "COMPATIBLE_WITH_CONDITIONS",
          categoryIndex: 6,
          suggestions: [
            "AVENTOS entegre açı sınırlayıcıyı 86° konumuna ayarlayın.",
            "Üst dolap montaj kotunu 100mm aşağı çekin.",
          ],
          sourceId: "SRC_BLUM_AVENTOS",
        });
      }

      // Check door hardware source & revision
      if (bay.door.hardwareProductId) {
        const hwId = bay.door.hardwareProductId;
        const hwMeta = hwMap[hwId];
        if (!hwMeta || !hwMeta.sourceId) {
          matrixEntries.push({
            targetId: `${mod.id}_bay_${bayIdx}_${hwId}`,
            targetType: "hardware_sku",
            sourceId: undefined,
            status: "INVALID_SOURCE",
            missingDomains: ["sourceTechData", "cadGeometry", "bomFormula", "drillingPattern", "physicalFactorySample"],
            blockingReason: `Donanım "${hwId}" için kayıtlı teknik kaynak (sourceId) bulunamadı.`,
          });
          v4Issues.push({
            code: "CHK_15_UNVERIFIED_HARDWARE_SOURCE",
            severity: "warning",
            blockingProduction: true,
            compatibilityStatus: "UNVERIFIED",
            targetId: bay.door.id,
            message: `Donanım (${hwId}) için doğrulanmış birincil teknik kaynak bulunamadı.`,
          });
        } else {
          const check = isSourceFullyVerifiedForProduction(hwMeta.sourceId, hwMeta.revision, refDate);
          const isRevMismatch = check.reason?.includes("sürüm uyuşmazlığı") || check.reason?.includes("süresi");
          matrixEntries.push({
            targetId: `${mod.id}_bay_${bayIdx}_${hwId}`,
            targetType: "hardware_sku",
            sourceId: hwMeta.sourceId,
            requiredSourceRevision: hwMeta.revision,
            status: check.verified ? "VERIFIED" : isRevMismatch ? "REVISION_MISMATCH" : "NEEDS_EVIDENCE",
            missingDomains: check.missingDomains,
            blockingReason: check.reason,
          });
          if (!check.verified) {
            v4Issues.push({
              code: isRevMismatch ? "CHK_15_SOURCE_REVISION_MISMATCH" : "CHK_15_INCOMPLETE_VERIFICATION_SCOPE",
              severity: "warning",
              blockingProduction: true,
              compatibilityStatus: "UNVERIFIED",
              targetId: bay.door.id,
              sourceId: hwMeta.sourceId,
              message: check.reason || `Donanım (${hwId}) doğrulama kapsamı eksik.`,
            });
          }
        }
      }
    });
  });

  // 3. Detect forged/tampered production_approved status when unverified items exist
  const unverifiedPartOrOpCount = matrixEntries.filter((e) => e.status !== "VERIFIED").length;
  if (project.status === "production_approved" && unverifiedPartOrOpCount > 0) {
    matrixEntries.push({
      targetId: project.id,
      targetType: "module",
      status: "TAMPERED_APPROVAL",
      missingDomains: ["physicalFactorySample"],
      blockingReason: "Proje JSON statüsü 'production_approved' olarak işaretlenmiş ancak doğrulanmamış üretim/kaynak kapsamları mevcut.",
    });
    v4Issues.push({
      code: "CHK_15_TAMPERED_PRODUCTION_APPROVAL",
      severity: "error",
      blockingProduction: true,
      compatibilityStatus: "UNVERIFIED",
      targetId: project.id,
      message: "Doğrulanmamış teknik kaynak veya fiziksel numune eksiği varken dışarıdan 'production_approved' statüsü kabul edilemez.",
    });
  }

  const mergedMap = new Map<string, ValidationIssue>();
  [...baseIssues, ...v4Issues].forEach((issue) => {
    const key = `${issue.code}_${issue.targetId || "global"}`;
    if (!mergedMap.has(key)) {
      mergedMap.set(key, {
        ...issue,
        compatibilityStatus:
          issue.compatibilityStatus ||
          (issue.severity === "error"
            ? "INCOMPATIBLE"
            : issue.severity === "warning"
            ? "COMPATIBLE_WITH_CONDITIONS"
            : "COMPATIBLE"),
      });
    }
  });

  const allIssues = Array.from(mergedMap.values());
  const hasUnverified =
    unverifiedPartOrOpCount > 0 || allIssues.some((i) => i.compatibilityStatus === "UNVERIFIED");
  const hasIncompatible = allIssues.some(
    (i) =>
      i.compatibilityStatus === "INCOMPATIBLE" ||
      i.severity === "error" ||
      (i.blockingProduction && i.compatibilityStatus !== "UNVERIFIED")
  );
  const hasConditions = allIssues.some(
    (i) => i.compatibilityStatus === "COMPATIBLE_WITH_CONDITIONS" || i.severity === "warning"
  );

  const overallStatus: CompatibilityStatus = hasIncompatible
    ? "INCOMPATIBLE"
    : hasUnverified
    ? "UNVERIFIED"
    : hasConditions
    ? "COMPATIBLE_WITH_CONDITIONS"
    : "COMPATIBLE";

  const canApproveProduction = !hasIncompatible && !hasUnverified;

  const finalCompatReport: CompatibilityReport = {
    overallStatus,
    canApproveProduction,
    checkedCategoriesCount: 15,
    issues: allIssues,
    evidenceMatrix: {
      evaluatedAt: new Date().toISOString(),
      activeCatalogVersion,
      entries: matrixEntries,
      unverifiedPartOrOpCount,
      allProductionGatesSatisfied: canApproveProduction,
    },
  };
  if (isDefaultCall) {
    defaultCompatCache.set(project, finalCompatReport);
  }
  return finalCompatReport;
}
