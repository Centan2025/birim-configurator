import type { DoorConfig, DrawerConfig, HandleCategory, ModuleInstance } from "./types";
import { calculateBayWidths, calculateNetInnerDepth, calculateNetInnerHeight, roundMm } from "./rules";
import { inferDoorSystemIdFromType } from "./v4-profiles";

export interface KlapaHingeResolution {
  hasLeftKlapa: boolean;
  hasRightKlapa: boolean;
  leftKlapaWidthMm: number;
  rightKlapaWidthMm: number;
  positionMode: "coplanar_front" | "recessed_inner";
  netDoorOpeningWidthMm: number;
  hingeAxisShiftedByKlapa: boolean;
  recommendedHingeSku: string;
  recommendedHingeLabelTr: string;
  autoSwitchedReasonTr: string | null;
}

export interface HardwareAlternativeOption {
  id: string;
  sku: string;
  labelTr: string;
  validRangeLabelTr: string;
  applyPatch: {
    target: "door" | "drawer" | "carcass";
    field: string;
    value: string | number | boolean;
  };
}

export interface HardwareCompatibilityAdvice {
  componentKind: "door_hinge" | "drawer_runner" | "lift_mechanism" | "handle_gola";
  bayIndex: number;
  targetId: string;
  compatible: boolean;
  severity: "ok" | "warning" | "error";
  selectedLabelTr: string;
  validRangeLabelTr: string;
  reasonTr: string;
  alternatives: HardwareAlternativeOption[];
}

const STANDARD_BLUM_NOMINAL_LENGTHS_MM = [270, 300, 350, 400, 450, 500, 550, 600, 650] as const;

/**
 * Resolves front blind panel ("Klapa") deductions and automatic hinge axis adaptation.
 * When a coplanar front filler (`coplanar_front`) sits on the hinge side, standard 110° full-overlay
 * hinges bind against the klapa edge; the engine automatically resolves to a blind-corner / inline
 * 95°–165° hinge (`BLUM_CLIP_BLIND_95` or `BLUM_CLIP_155_ZERO`), whereas an inner recessed klapa
 * (`recessed_inner`) allows standard straight overlay mounting.
 */
export function resolveKlapaAndHingeBehavior(
  door: DoorConfig | undefined,
  bayWidthMm: number,
  hasInternalDrawers = false
): KlapaHingeResolution {
  const leftMm = Math.max(0, roundMm(door?.frontFillerLeftMm || 0, 1));
  const rightMm = Math.max(0, roundMm(door?.frontFillerRightMm || 0, 1));
  const posMode = door?.frontFillerPosition || "coplanar_front";
  const netOpening = Math.max(120, roundMm(bayWidthMm - leftMm - rightMm, 1));

  const dType = door?.type || "open";
  const hingesLeft =
    dType === "single_left" ||
    dType === "inset_left" ||
    dType === "half_overlay_left" ||
    dType === "double" ||
    dType === "inset_double";
  const hingesRight =
    dType === "single_right" ||
    dType === "inset_right" ||
    dType === "half_overlay_right" ||
    dType === "double" ||
    dType === "inset_double";

  const klapaOnHingeSide = (hingesLeft && leftMm > 0) || (hingesRight && rightMm > 0);
  const axisShifted = klapaOnHingeSide && posMode === "coplanar_front";

  if (hasInternalDrawers) {
    return {
      hasLeftKlapa: leftMm > 0,
      hasRightKlapa: rightMm > 0,
      leftKlapaWidthMm: leftMm,
      rightKlapaWidthMm: rightMm,
      positionMode: posMode,
      netDoorOpeningWidthMm: netOpening,
      hingeAxisShiftedByKlapa: axisShifted,
      recommendedHingeSku: "71B7550",
      recommendedHingeLabelTr: "Blum CLIP top BLUMOTION 155° Sıfır Çıkıntı (Robot) Menteşe",
      autoSwitchedReasonTr:
        "Bölme içinde iç çekmece bulunduğu için kapak kalınlığının ray yolunu kapatmaması adına 155° sıfır çıkıntı (robot) menteşe seçildi.",
    };
  }

  if (axisShifted) {
    return {
      hasLeftKlapa: leftMm > 0,
      hasRightKlapa: rightMm > 0,
      leftKlapaWidthMm: leftMm,
      rightKlapaWidthMm: rightMm,
      positionMode: posMode,
      netDoorOpeningWidthMm: netOpening,
      hingeAxisShiftedByKlapa: true,
      recommendedHingeSku: "79B9550",
      recommendedHingeLabelTr: "Blum CLIP top BLUMOTION 95° Kör Köşe / Eş-Düzlem Klapa Menteşesi",
      autoSwitchedReasonTr:
        "Menteşe tarafına eş-düzlem ön klapa eklendiği için kapak dönme ekseni kaydı; menteşe tipi otomatik olarak 95° kör köşe / klapa menteşesine çevrildi.",
    };
  }

  if (klapaOnHingeSide && posMode === "recessed_inner") {
    return {
      hasLeftKlapa: leftMm > 0,
      hasRightKlapa: rightMm > 0,
      leftKlapaWidthMm: leftMm,
      rightKlapaWidthMm: rightMm,
      positionMode: posMode,
      netDoorOpeningWidthMm: netOpening,
      hingeAxisShiftedByKlapa: false,
      recommendedHingeSku: "71B3550",
      recommendedHingeLabelTr: "Blum CLIP top BLUMOTION 110° Düz (İç Klapa Uyumlu) Menteşe",
      autoSwitchedReasonTr:
        "İç klapa (geriye çekilmiş kayıt) kullanıldığı için standart 110° düz menteşe ekseni korundu.",
    };
  }

  return {
    hasLeftKlapa: leftMm > 0,
    hasRightKlapa: rightMm > 0,
    leftKlapaWidthMm: leftMm,
    rightKlapaWidthMm: rightMm,
    positionMode: posMode,
    netDoorOpeningWidthMm: netOpening,
    hingeAxisShiftedByKlapa: false,
    recommendedHingeSku: "71B3550",
    recommendedHingeLabelTr: "Blum CLIP top BLUMOTION 110° Frenli Düz Menteşe",
    autoSwitchedReasonTr: null,
  };
}

/**
 * Evaluates all doors, hinges, drawers, lift mechanisms, and handles/Gola profiles
 * in a module (or a specific bay) and returns human-friendly Turkish compatibility
 * diagnostics along with valid dimension ranges and 1-click compatible alternatives.
 */
export function evaluateHardwareCompatibilityWithAlternatives(
  module: ModuleInstance,
  targetBayIndex?: number
): HardwareCompatibilityAdvice[] {
  const results: HardwareCompatibilityAdvice[] = [];
  const bayWidths = calculateBayWidths(module);
  const netInnerDepth = calculateNetInnerDepth(module);
  const netInnerHeight = calculateNetInnerHeight(module);
  const T_door = module.carcass.doorThickness || 18;

  module.bays.forEach((bay, bIdx) => {
    if (targetBayIndex !== undefined && bIdx !== targetBayIndex) return;
    const bayW = bayWidths[bIdx] || 450;
    const door = bay.door;
    const hasInternalDrawers = (bay.drawers || []).some((d) => d.isInternal && !d.isHidden);

    // 1. Door & Hinge / Lift Compatibility Check
    if (door && door.type !== "open") {
      const dSys = door.doorSystemId || inferDoorSystemIdFromType(door.type);
      const isDouble = door.type === "double" || door.type === "inset_double" || dSys === "hinged_double";
      const klapa = resolveKlapaAndHingeBehavior(door, bayW, hasInternalDrawers);
      const leafWidthMm = isDouble ? roundMm(klapa.netDoorOpeningWidthMm / 2, 1) : klapa.netDoorOpeningWidthMm;

      if (dSys.startsWith("lift")) {
        const liftMinH = 240;
        const liftMaxH = 1040;
        const liftMaxW = 1800;
        const outOfBounds = netInnerHeight < liftMinH || netInnerHeight > liftMaxH || bayW > liftMaxW;
        results.push({
          componentKind: "lift_mechanism",
          bayIndex: bIdx,
          targetId: door.id,
          compatible: !outOfBounds,
          severity: outOfBounds ? "error" : "ok",
          selectedLabelTr: "Blum AVENTOS Kalkar Kapak Sistemi",
          validRangeLabelTr: `Yükseklik: ${liftMinH}–${liftMaxH} mm • Genişlik: 300–${liftMaxW} mm`,
          reasonTr: outOfBounds
            ? `Bölme yüksekliği (${Math.round(netInnerHeight)} mm) veya genişliği (${Math.round(bayW)} mm) AVENTOS kalkar mekanizma çalışma aralığının dışında.`
            : `AVENTOS güç faktörü (LF) kapak ölçüsüyle (${Math.round(bayW)}×${Math.round(netInnerHeight)} mm) uyumlu.`,
          alternatives: outOfBounds
            ? [
                {
                  id: "alt_double_hinged",
                  sku: "71B3550",
                  labelTr: "Çift Açılır Menteşeli Kapak (Blum CLIP top 110°)",
                  validRangeLabelTr: "Yükseklik: 250–2600 mm • Kanat Genişliği: 200–600 mm",
                  applyPatch: { target: "door", field: "type", value: bayW >= 700 ? "double" : "single_left" },
                },
              ]
            : [],
        });
      } else if (!dSys.startsWith("sliding")) {
        const leafTooWide = leafWidthMm > 600;
        const leafTooNarrow = leafWidthMm < 180;
        const wrongInternalHinge =
          hasInternalDrawers &&
          door.hardwareProductId &&
          !door.hardwareProductId.includes("155") &&
          !door.hardwareProductId.includes("71B7550");

        if (leafTooWide || leafTooNarrow || wrongInternalHinge) {
          const alts: HardwareAlternativeOption[] = [];
          if (leafTooWide && !isDouble) {
            alts.push({
              id: "alt_split_double_door",
              sku: "71B3550x2",
              labelTr: `Çift Kanat Kapağa Böl (2 × ${Math.round(leafWidthMm / 2)} mm)`,
              validRangeLabelTr: "Tek kanat azami 600 mm (çift kanatta toplam 1200 mm)",
              applyPatch: { target: "door", field: "type", value: "double" },
            });
          }
          if (wrongInternalHinge) {
            alts.push({
              id: "alt_155_hinge",
              sku: "71B7550",
              labelTr: "Blum CLIP top BLUMOTION 155° Sıfır Çıkıntı Menteşe",
              validRangeLabelTr: "İç çekmeceli bölmeler için sıfır iç girişim",
              applyPatch: { target: "door", field: "hardwareProductId", value: "HW_HINGE_BLUM_155_ZERO" },
            });
          }
          results.push({
            componentKind: "door_hinge",
            bayIndex: bIdx,
            targetId: door.id,
            compatible: false,
            severity: "error",
            selectedLabelTr: klapa.recommendedHingeLabelTr,
            validRangeLabelTr: "Tek kanat genişliği: 180–600 mm",
            reasonTr: leafTooWide
              ? `Tek kapak kanadı (${Math.round(leafWidthMm)} mm) güvenli menteşe taşıma sınırını (600 mm) aşıyor; zamanla kapak sarkması oluşur.`
              : leafTooNarrow
              ? `Kapak kanadı (${Math.round(leafWidthMm)} mm) 35 mm menteşe tası ve kulp montajı için çok dar (en az 180 mm olmalı).`
              : "Bölme içinde iç çekmece varken standart 110° menteşe kapak kalınlığıyla çekmece çıkışını engeller.",
            alternatives: alts,
          });
        } else {
          results.push({
            componentKind: "door_hinge",
            bayIndex: bIdx,
            targetId: door.id,
            compatible: true,
            severity: "ok",
            selectedLabelTr: klapa.recommendedHingeLabelTr,
            validRangeLabelTr: "Tek kanat genişliği: 180–600 mm",
            reasonTr:
              klapa.autoSwitchedReasonTr ||
              `Kapak kanadı (${Math.round(leafWidthMm)} mm) ve ${T_door} mm kapak kalınlığı seçili menteşe sistemiyle tam uyumlu.`,
            alternatives: [],
          });
        }
      }

      // 2. Gola & Handle Compatibility Check
      const hCat: HandleCategory | undefined = door.handleCategory;
      if (hCat === "gola_profile") {
        const incompatibleSliding = dSys.startsWith("sliding") || door.type.startsWith("inset");
        results.push({
          componentKind: "handle_gola",
          bayIndex: bIdx,
          targetId: `${door.id}_gola`,
          compatible: !incompatibleSliding,
          severity: incompatibleSliding ? "error" : "ok",
          selectedLabelTr:
            module.category === "kitchen_wall"
              ? "Üst Dolap Alt Sarkıtma / Gola Kanal Sistemi"
              : "Alüminyum L/C Gola Profil Sistemi (57×26 mm Kertmeli)",
          validRangeLabelTr: "Tam binili menteşeli kapak veya çekmece • Gövde derinliği ≥ 320 mm",
          reasonTr: incompatibleSliding
            ? "Gola alüminyum profil kertmesi sürgülü veya içerlek (inset) kapak geometrisiyle kullanılamaz."
            : "Yan dikme Gola kertmeleri, kapak düşüm payı ve alüminyum boy profil metrajı kesim/maliyet listesine otomatik işlendi.",
          alternatives: incompatibleSliding
            ? [
                {
                  id: "alt_bar_handle",
                  sku: "HND-BAR-160",
                  labelTr: "160 mm Standart Kulp (Kertmesiz)",
                  validRangeLabelTr: "Tüm kapak tipleriyle uyumlu",
                  applyPatch: { target: "door", field: "handleCategory", value: "bar_handle" },
                },
                {
                  id: "alt_push_open",
                  sku: "956A1004",
                  labelTr: "Blum TIP-ON Bas-Aç Mekanizma",
                  validRangeLabelTr: "Kulpsuz düz kapaklar için",
                  applyPatch: { target: "door", field: "openingTechnology", value: "push_to_open" },
                },
              ]
            : [],
        });
      }
    }

    // 3. Drawer Runner Compatibility Check (Nominal Length, Clearances, Capacity, Minimum Inner Space)
    (bay.drawers || []).forEach((drw: DrawerConfig) => {
      if (drw.isHidden) return;
      const reqRearClearanceMm = 15;
      const maxFitNominal = netInnerDepth - reqRearClearanceMm;
      const validNominals = STANDARD_BLUM_NOMINAL_LENGTHS_MM.filter((nl) => nl <= maxFitNominal);
      const optimalNominal = validNominals.length > 0 ? validNominals[validNominals.length - 1] : 0;
      const chosenNominal = drw.nominalLengthMm || optimalNominal;

      const depthTooShallow = netInnerDepth < 285 || chosenNominal > maxFitNominal;
      const widthTooNarrow = bayW < 250;
      const widthTooWide = bayW > 1200;
      const frontTooLow = drw.height < 90;

      const isIncompatible = depthTooShallow || widthTooNarrow || widthTooWide || frontTooLow;
      const boxSys = drw.boxSystemType || "wooden_undermount";
      const loadCapacityKg =
        boxSys === "metal_box_legrabox"
          ? chosenNominal >= 500
            ? 70
            : 40
          : chosenNominal >= 500
          ? 60
          : 40;

      const alts: HardwareAlternativeOption[] = [];
      if (chosenNominal > maxFitNominal && optimalNominal >= 270) {
        alts.push({
          id: `alt_runner_${optimalNominal}`,
          sku: `750.${optimalNominal}1S`,
          labelTr: `Blum MOVENTO ${optimalNominal} mm Tam Açılım Frenli Ray`,
          validRangeLabelTr: `Gereken minimum net iç derinlik: ${optimalNominal + reqRearClearanceMm} mm`,
          applyPatch: { target: "drawer", field: "nominalLengthMm", value: optimalNominal },
        });
      }
      if (depthTooShallow && netInnerDepth < 285) {
        alts.push({
          id: "alt_deepen_cabinet_350",
          sku: "DIM-DEPTH-350",
          labelTr: "Modül Derinliğini 350 mm'ye Çıkar (270 mm Ray İçin)",
          validRangeLabelTr: "En kısa standart frenli ray (270 mm) için min. 320–350 mm dış derinlik gerekir",
          applyPatch: { target: "carcass", field: "depth", value: 350 },
        });
      }
      if (frontTooLow) {
        alts.push({
          id: "alt_drawer_h_140",
          sku: "DRW-H-140",
          labelTr: "Çekmece Yüksekliğini 140 mm (N/M Kasa Uyumlu) Yap",
          validRangeLabelTr: "Standart çekmece ön yüksekliği: 110–400 mm",
          applyPatch: { target: "drawer", field: "height", value: 140 },
        });
      }

      results.push({
        componentKind: "drawer_runner",
        bayIndex: bIdx,
        targetId: drw.id,
        compatible: !isIncompatible,
        severity: isIncompatible ? "error" : "ok",
        selectedLabelTr:
          boxSys === "metal_box_legrabox"
            ? `Blum LEGRABOX ${chosenNominal || 500} mm (${loadCapacityKg} kg)`
            : boxSys === "metal_box_tandembox"
            ? `Blum TANDEMBOX antaro ${chosenNominal || 500} mm (30/65 kg)`
            : `Blum MOVENTO / TANDEM ${chosenNominal || 500} mm Gizli Ray (${loadCapacityKg} kg)`,
        validRangeLabelTr: `Net İç Derinlik ≥ ${
          (chosenNominal || 270) + reqRearClearanceMm
        } mm (Mevcut: ${Math.round(netInnerDepth)} mm) • Bölme Genişliği: 250–1200 mm`,
        reasonTr: depthTooShallow
          ? `Seçilen çekmece rayı (${chosenNominal || 270} mm) modülün net iç derinliğine (${Math.round(
              netInnerDepth
            )} mm) sığmıyor. Arkalık önüne en az 15 mm boşluk kalmalıdır.`
          : widthTooNarrow
          ? `Bölme iç genişliği (${Math.round(bayW)} mm) çekmece mekanizması ve kilit mandalları için çok dar (min. 250 mm).`
          : widthTooWide
          ? `Bölme genişliği (${Math.round(bayW)} mm) senkronizasyon mili olmadan 1200 mm ray sınırını aşıyor.`
          : frontTooLow
          ? `Çekmece ön klapa yüksekliği (${Math.round(drw.height)} mm) ray ve taban montaj yüksekliğinin (min. 90 mm) altında.`
          : `Ray boyu (${chosenNominal} mm), kullanılabilir net iç derinlik (${Math.round(
              netInnerDepth
            )} mm) ve ${loadCapacityKg} kg dinamik taşıma kapasitesi uyumlu.`,
        alternatives: alts,
      });
    });
  });

  return results;
}
