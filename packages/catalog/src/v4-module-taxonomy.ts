import {
  DoorOverlayType,
  DoorSystemId,
  ModuleCategory,
  ModuleFamilyId,
  ModuleInstance,
  UnitLength,
} from "@birim/core";

export interface V4ModuleFamilyDefinition {
  id: ModuleFamilyId;
  code: string;
  name: string;
  description: string;
  targetTemplateCount: number;
}

export type V4ModuleTemplate = V4ModuleTemplateDefinition;
export interface V4ModuleTemplateDefinition {
  templateId: string;
  familyId: ModuleFamilyId;
  category: ModuleCategory;
  name: string;
  description: string;
  defaultDimensions: { width: UnitLength; height: UnitLength; depth: UnitLength };
  dimensionLimits: {
    minW: UnitLength;
    maxW: UnitLength;
    minH: UnitLength;
    maxH: UnitLength;
    minD: UnitLength;
    maxD: UnitLength;
  };
  defaultDoorSystemId: DoorSystemId;
  defaultOverlayType?: DoorOverlayType;
  defaultHardwareProductId?: string;
  compatibleDoorSystems: DoorSystemId[];
  isFixedWidth?: boolean;
  isCorner?: boolean;
  requiresFactoryValidation?: boolean;
  complementaryRole?: ModuleInstance["complementaryRole"];
  createInstance: (id: string, customName?: string) => ModuleInstance;
}

export const V4_MODULE_FAMILIES: V4ModuleFamilyDefinition[] = [
  {
    id: "fam_kitchen_base",
    code: "A",
    name: "A. Mutfak Alt Dolapları",
    description: "Tezgâh altı kapaklı, çekmeceli, evye, ankastre fırın, köşe ve şişelik modülleri",
    targetTemplateCount: 20,
  },
  {
    id: "fam_kitchen_wall",
    code: "B",
    name: "B. Mutfak Üst Dolapları",
    description: "Duvara asılan menteşeli, cam vitrin, AVENTOS/Free yukarı kalkar ve davlumbaz dolapları",
    targetTemplateCount: 15,
  },
  {
    id: "fam_kitchen_tall",
    code: "C",
    name: "C. Boy ve Cihaz Dolapları",
    description: "Kiler, SPACE TOWER iç çekmeceli, fırın/mikrodalga kulesi, buzdolabı ve REVEGO pocket dolaplar",
    targetTemplateCount: 12,
  },
  {
    id: "fam_wardrobe",
    code: "D",
    name: "D. Gardırop ve Giyinme Odası",
    description: "Menteşeli, sürgülü, açık walk-in, köşe, ada şifonyer, pantolonluk ve ayakkabılık modülleri",
    targetTemplateCount: 20,
  },
  {
    id: "fam_special_corner",
    code: "E",
    name: "E. Özel ve Köşe Modülleri",
    description: "İç/dış köşe, diyagonal, eğimli tavan, merdiven altı ve kademeli geçiş modülleri",
    targetTemplateCount: 10,
  },
  {
    id: "fam_complementary",
    code: "F",
    name: "F. Tamamlayıcı Modüller",
    description: "Baza, ayarlanabilir ayak, dolgu paneli, bitiş paneli, tezgâh, backsplash, taç ve LED profiller",
    targetTemplateCount: 15,
  },
];

interface TemplateSeed {
  templateId: string;
  familyId: ModuleFamilyId;
  category: ModuleCategory;
  name: string;
  description: string;
  w: number;
  h: number;
  d: number;
  minW: number;
  maxW: number;
  minH?: number;
  maxH?: number;
  minD?: number;
  maxD?: number;
  plinth?: number;
  baysCount?: number;
  bayCustomWidths?: (number | undefined)[];
  bayDoorSystems?: DoorSystemId[];
  bayDoorTypes?: ModuleInstance["bays"][0]["door"]["type"][];
  bayShelvesCount?: number[];
  bayHangingRailsCount?: number[];
  bayDrawersIndices?: number[];
  topDrawerCombo?: boolean;
  doorType?: ModuleInstance["bays"][0]["door"]["type"];
  doorSystemId: DoorSystemId;
  overlayType?: DoorOverlayType;
  hardwareProductId?: string;
  shelvesPerBay?: number;
  drawersHeights?: number[];
  isInternalDrawers?: boolean;
  hangingRailsPerBay?: number;
  specialFitting?: ModuleInstance["bays"][0]["specialFittings"][0]["type"];
  isOpenFront?: boolean;
  isCorner?: boolean;
  isFixedWidth?: boolean;
  requiresFactoryValidation?: boolean;
  complementaryRole?: ModuleInstance["complementaryRole"];
  bodyMaterialId?: string;
  doorMaterialId?: string;
}

function buildTemplateFromSeed(seed: TemplateSeed): V4ModuleTemplateDefinition {
  const compatibleDoorSystems: DoorSystemId[] =
    seed.familyId === "fam_complementary"
      ? ["open"]
      : seed.familyId === "fam_kitchen_wall"
      ? [
          "hinged_single",
          "hinged_double",
          "hinged_inset",
          "lift_up_stay",
          "lift_bi_fold",
          "lift_parallel",
          "open",
        ]
      : [
          "hinged_single",
          "hinged_double",
          "hinged_inset",
          "hinged_overlay_variant",
          "sliding_top_hung",
          "sliding_bottom_rolling",
          "folding_side",
          "pocket_retractable",
          "open",
        ];

  return {
    templateId: seed.templateId,
    familyId: seed.familyId,
    category: seed.category,
    name: seed.name,
    description: seed.description,
    defaultDimensions: { width: seed.w, height: seed.h, depth: seed.d },
    dimensionLimits: {
      minW: seed.minW,
      maxW: seed.maxW,
      minH: seed.minH ?? Math.min(seed.h, 150),
      maxH: seed.maxH ?? 2800,
      minD: seed.minD ?? Math.min(seed.d, 150),
      maxD: seed.maxD ?? 1000,
    },
    defaultDoorSystemId: seed.doorSystemId,
    defaultOverlayType: seed.overlayType || "full_overlay",
    defaultHardwareProductId: seed.hardwareProductId,
    compatibleDoorSystems,
    isFixedWidth: seed.isFixedWidth,
    isCorner: seed.isCorner,
    requiresFactoryValidation: seed.requiresFactoryValidation,
    complementaryRole: seed.complementaryRole,
    createInstance: (id: string, customName?: string): ModuleInstance => {
      const baysCount = seed.baysCount || 1;
      const plinthHeight =
        seed.plinth !== undefined
          ? seed.plinth
          : seed.familyId === "fam_kitchen_wall" || seed.familyId === "fam_complementary"
          ? 0
          : seed.familyId.startsWith("fam_kitchen")
          ? 100
          : 80;
      const innerH = Math.max(100, seed.h - plinthHeight - 36);

      const bays: ModuleInstance["bays"] = Array.from({ length: baysCount }, (_, bayIdx) => {
        const bayDoorSys = seed.bayDoorSystems?.[bayIdx] || seed.doorSystemId;
        const hasDrawersInBay = !seed.bayDrawersIndices || seed.bayDrawersIndices.includes(bayIdx);
        const rawDrawerHeights = hasDrawersInBay ? seed.drawersHeights || [] : [];
        const shelvesCount = seed.bayShelvesCount?.[bayIdx] ?? seed.shelvesPerBay ?? (rawDrawerHeights.length && !seed.isInternalDrawers ? 0 : 1);
        const shelves = Array.from({ length: shelvesCount }, (__, sIdx) => ({
          id: `shelf_${id}_${bayIdx}_${sIdx}`,
          bayIndex: bayIdx,
          elevationY: !seed.topDrawerCombo && rawDrawerHeights.length > 0 && rawDrawerHeights.reduce((s, h) => s + h + 5, -5) + 120 < innerH ? (sIdx === 0 ? rawDrawerHeights.reduce((s, h) => s + h + 5, -5) : Math.round(rawDrawerHeights.reduce((s, h) => s + h + 5, -5) + (sIdx * (innerH - rawDrawerHeights.reduce((s, h) => s + h + 5, -5))) / shelvesCount)) : Math.round(((sIdx + 1) * innerH) / (shelvesCount + 1)),
          isAdjustable: true,
        }));

        const drawers = rawDrawerHeights.map((dh, dIdx) => ({
          id: `drw_${id}_${bayIdx}_${dIdx}`,
          bayIndex: bayIdx,
          elevationY: seed.topDrawerCombo ? Math.max(0, innerH - dh) : rawDrawerHeights.slice(0, dIdx).reduce((sum, h) => sum + h + 5, 0),
          height: dh,
          slideType: "soft_close" as const,
          isInternal: seed.isInternalDrawers,
          hardwareProductId: dh >= 220 ? "hw_blum_legrabox_c70" : "hw_blum_legrabox_m40",
        }));

        const hangingRails = Array.from({ length: seed.bayHangingRailsCount?.[bayIdx] ?? (seed.hangingRailsPerBay || 0) }, (__, rIdx) => ({
          id: `rail_${id}_${bayIdx}_${rIdx}`,
          bayIndex: bayIdx,
          elevationY: rIdx === 0 ? Math.max(400, innerH - 120) : Math.round(innerH * 0.48),
          isLiftMechanism: seed.templateId.includes("hanging_heavy") && rIdx === 0,
        }));

        const specialFittings = seed.specialFitting
          ? [
              {
                id: `fit_${id}_${bayIdx}_0`,
                bayIndex: bayIdx,
                elevationY: 320,
                type: seed.specialFitting,
                height: 120,
              },
            ]
          : [];

        const defaultType =
          seed.bayDoorTypes?.[bayIdx] ||
          seed.doorType ||
          (bayDoorSys === "hinged_double"
            ? "double"
            : bayDoorSys === "hinged_inset"
            ? "inset_left"
            : bayDoorSys === "sliding_top_hung"
            ? "sliding"
            : bayDoorSys === "sliding_bottom_rolling"
            ? "sliding_bottom"
            : bayDoorSys === "lift_parallel"
            ? "lift_parallel"
            : bayDoorSys === "lift_bi_fold"
            ? "lift_bi_fold"
            : bayDoorSys === "lift_up_stay"
            ? "lift_up_stay"
            : bayDoorSys === "folding_side"
            ? "folding"
            : bayDoorSys === "pocket_retractable"
            ? "pocket"
            : bayDoorSys === "open"
            ? "open"
            : "single_left");
          void (seed.doorSystemId === "hinged_double"
            ? "double"
            : seed.doorSystemId === "hinged_inset"
            ? "inset_left"
            : seed.doorSystemId === "sliding_top_hung"
            ? "sliding"
            : seed.doorSystemId === "sliding_bottom_rolling"
            ? "sliding_bottom"
            : seed.doorSystemId === "lift_parallel"
            ? "lift_parallel"
            : seed.doorSystemId === "lift_bi_fold"
            ? "lift_bi_fold"
            : seed.doorSystemId === "lift_up_stay"
            ? "lift_up_stay"
            : seed.doorSystemId === "folding_side"
            ? "folding"
            : seed.doorSystemId === "pocket_retractable"
            ? "pocket"
            : seed.doorSystemId === "open"
            ? "open"
            : "single_left");

        return {
          index: bayIdx,
          customWidth: seed.bayCustomWidths?.[bayIdx],
          shelves,
          hangingRails,
          drawers,
          specialFittings,
          door: {
            id: `door_${id}_${bayIdx}`,
            bayIndex: bayIdx,
            type: defaultType,
            doorSystemId: bayDoorSys,
            overlayType: seed.overlayType || "full_overlay",
            openingTechnology: seed.doorSystemId === "pocket_retractable" ? "pocket_assisted" : "soft_close",
            handleCategory:
              seed.doorSystemId.startsWith("sliding")
                ? "recessed_grip"
                : seed.doorSystemId === "open" && !(seed.drawersHeights?.length && !seed.isInternalDrawers)
                ? "handleless_plain"
                : "bar_handle",
            hardwareProductId:
              seed.hardwareProductId ||
              (seed.isInternalDrawers
                ? "hw_blum_71b7550"
                : seed.doorSystemId === "hinged_inset"
                ? "hw_blum_71b3750"
                : seed.doorSystemId === "lift_up_stay"
                ? "hw_blum_aventos_hk_27"
                : seed.doorSystemId === "lift_bi_fold"
                ? "hw_blum_aventos_hf_25"
                : seed.doorSystemId === "lift_parallel"
                ? "hw_blum_aventos_hl_25"
                : seed.doorSystemId === "sliding_top_hung"
                ? "hw_hettich_topline_l"
                : seed.doorSystemId === "folding_side"
                ? "hw_hettich_wingline_l"
                : seed.doorSystemId === "pocket_retractable"
                ? "hw_blum_revego_uno"
                : "hw_blum_71b3550"),
            softClose: true,
          },
        };
      });

      return {
        id,
        name: customName || seed.name,
        category: seed.category,
        moduleFamilyId: seed.familyId,
        templateId: seed.templateId,
        position: { x: 0, y: seed.familyId === "fam_kitchen_wall" ? 1450 : 0, z: 0 },
        dimensions: { width: seed.w, height: seed.h, depth: seed.d },
        carcass: {
          panelThickness: 18,
          backPanelThickness: 8,
          backPanelType: "grooved",
          plinthHeight,
          doorPerimeterGap: 2,
          edgeBandThickness: 1,
          bodyMaterialId: seed.bodyMaterialId || "mat_melamine_white",
          doorMaterialId:
            seed.doorMaterialId ||
            (seed.familyId.startsWith("fam_kitchen") ? "mat_lacquer_sage" : "mat_veneer_oak"),
          jointType: "minifix_dowel",
          constructionProfileId: "profile_birim_factory_std",
        },
        isOpenFront: seed.isOpenFront ?? seed.doorSystemId === "open",
        isCorner: seed.isCorner,
        isFixedWidth: seed.isFixedWidth,
        requiresFactoryValidation: seed.requiresFactoryValidation,
        complementaryRole: seed.complementaryRole,
        bays,
      };
    },
  };
}

const TEMPLATE_SEEDS: TemplateSeed[] = [
  // ============================================================================
  // A. MUTFAK ALT DOLAPLARI (20 Şablon)
  // ============================================================================
  { templateId: "tpl_kb_01_single_door", familyId: "fam_kitchen_base", category: "kitchen_base", name: "Tek Kapaklı Alt Dolap", description: "450mm tek kapaklı, 1 orta raflı alt modül", w: 450, h: 720, d: 580, minW: 300, maxW: 600, doorSystemId: "hinged_single", shelvesPerBay: 1 },
  { templateId: "tpl_kb_02_double_door", familyId: "fam_kitchen_base", category: "kitchen_base", name: "Çift Kapaklı Alt Dolap", description: "800mm çift kapaklı alt modül", w: 800, h: 720, d: 580, minW: 600, maxW: 1200, doorSystemId: "hinged_double", shelvesPerBay: 1 },
  { templateId: "tpl_kb_03_single_drawer", familyId: "fam_kitchen_base", category: "kitchen_base", name: "Tek Derin Çekmeceli Alt Dolap", description: "600mm 70kg ağır hizmet tek çekmeceli alt dolap", w: 600, h: 720, d: 580, minW: 400, maxW: 1000, doorSystemId: "open", drawersHeights: [560] },
  { templateId: "tpl_kb_04_two_drawers", familyId: "fam_kitchen_base", category: "kitchen_base", name: "İki Çekmeceli Alt Dolap (2 Derin)", description: "800mm 2 eşit derin tencere çekmeceli modül", w: 800, h: 720, d: 580, minW: 450, maxW: 1200, doorSystemId: "open", drawersHeights: [285, 285] },
  { templateId: "tpl_kb_05_three_drawers", familyId: "fam_kitchen_base", category: "kitchen_base", name: "Üç Çekmeceli Alt Dolap (1+2)", description: "1 çatal-kaşık + 2 derin tencere çekmeceli modül", w: 800, h: 720, d: 580, minW: 450, maxW: 1200, doorSystemId: "open", drawersHeights: [215, 215, 140] },
  { templateId: "tpl_kb_06_four_drawers", familyId: "fam_kitchen_base", category: "kitchen_base", name: "Dört Çekmeceli Alt Dolap", description: "600mm 4 eşit çekmeceli bıçak/baharat/servis modülü", w: 600, h: 720, d: 580, minW: 400, maxW: 900, doorSystemId: "open", drawersHeights: [140, 140, 140, 140] },
  { templateId: "tpl_kb_07_door_internal_drawer", familyId: "fam_kitchen_base", category: "kitchen_base", name: "Kapak + İç Çekmeceli Alt Dolap", description: "155° sıfır çıkıntılı menteşeli kapak + 2 iç çekmece", w: 600, h: 720, d: 580, minW: 450, maxW: 900, doorSystemId: "hinged_single", hardwareProductId: "hw_blum_71b7550", drawersHeights: [160, 160], isInternalDrawers: true, shelvesPerBay: 1 },
  { templateId: "tpl_kb_08_sink_base", familyId: "fam_kitchen_base", category: "kitchen_base", name: "Evye Alt Dolabı", description: "800mm tesisat geçişli çift kapaklı evye dolabı", w: 800, h: 720, d: 580, minW: 600, maxW: 1200, doorSystemId: "hinged_double", shelvesPerBay: 0 },
  { templateId: "tpl_kb_09_oven_housing", familyId: "fam_kitchen_base", category: "kitchen_base", name: "Ankastre Fırın Alt Dolabı", description: "EN 1116 600mm ankastre fırın yuvası + alt tepsi çekmecesi", w: 600, h: 720, d: 580, minW: 600, maxW: 600, doorSystemId: "open", drawersHeights: [115], shelvesPerBay: 1, isFixedWidth: true },
  { templateId: "tpl_kb_10_dishwasher_front", familyId: "fam_kitchen_base", category: "kitchen_base", name: "Bulaşık Makinesi Entegrasyon Cephesi", description: "600mm tam ankastre bulaşık makinesi mobilya kapağı", w: 600, h: 720, d: 580, minW: 450, maxW: 600, doorSystemId: "hinged_single", shelvesPerBay: 0, isFixedWidth: true },
  { templateId: "tpl_kb_11_narrow_spice", familyId: "fam_kitchen_base", category: "kitchen_base", name: "Dar Baharatlık Modülü", description: "200mm teleskopik raylı şişelik ve baharatlık", w: 200, h: 720, d: 580, minW: 150, maxW: 300, doorSystemId: "hinged_single", specialFitting: "spice_pullout", shelvesPerBay: 0 },
  { templateId: "tpl_kb_12_waste_sorting", familyId: "fam_kitchen_base", category: "kitchen_base", name: "Çöp Ayrıştırma Dolabı", description: "600mm raylı geri dönüşüm çöp kovası modülü", w: 600, h: 720, d: 580, minW: 450, maxW: 800, doorSystemId: "hinged_single", specialFitting: "waste_bin", shelvesPerBay: 0 },
  { templateId: "tpl_kb_13_blind_corner", familyId: "fam_kitchen_base", category: "kitchen_corner", name: "Kör Köşe Alt Dolabı (LeMans)", description: "1050mm kör köşe + LeMans II fasulye mekanizmalı alt dolap", w: 1050, h: 720, d: 580, minW: 900, maxW: 1200, doorSystemId: "hinged_single", specialFitting: "corner_lemans", isCorner: true },
  { templateId: "tpl_kb_14_l_corner", familyId: "fam_kitchen_base", category: "kitchen_corner", name: "L Köşe Alt Dolabı (90° Katlanır)", description: "900x900mm katlanır köşe kapaklı alt dolap", w: 900, h: 720, d: 900, minW: 800, maxW: 1050, doorSystemId: "folding_side", isCorner: true },
  { templateId: "tpl_kb_15_diagonal_corner", familyId: "fam_kitchen_base", category: "kitchen_corner", name: "Diyagonal (45°) Köşe Alt Dolabı", description: "900mm +45° açılı menteşeli köşe alt dolap", w: 900, h: 720, d: 900, minW: 850, maxW: 1050, doorSystemId: "hinged_single", hardwareProductId: "hw_blum_79b9458", isCorner: true },
  { templateId: "tpl_kb_16_open_shelf", familyId: "fam_kitchen_base", category: "kitchen_base", name: "Açık Raflı Alt Modül", description: "450mm kapaksız dekoratif açık raflı alt dolap", w: 450, h: 720, d: 580, minW: 200, maxW: 900, doorSystemId: "open", isOpenFront: true, shelvesPerBay: 2 },
  { templateId: "tpl_kb_17_bottle_rack", familyId: "fam_kitchen_base", category: "kitchen_base", name: "Şaraplık / Şişelik Modülü", description: "300mm bölmeli şişelik alt modülü", w: 300, h: 720, d: 580, minW: 150, maxW: 450, doorSystemId: "open", isOpenFront: true, shelvesPerBay: 4 },
  { templateId: "tpl_kb_18_cooktop_base", familyId: "fam_kitchen_base", category: "kitchen_base", name: "Ocak Altı Modülü", description: "900mm indüksiyon ocağı ısı boşluklu 3 çekmeceli modül", w: 900, h: 720, d: 580, minW: 600, maxW: 1200, doorSystemId: "open", drawersHeights: [220, 220, 120] },
  { templateId: "tpl_kb_19_drawer_door_combo", familyId: "fam_kitchen_base", category: "kitchen_base", name: "Çekmece + Kapak Kombinasyonu", description: "Üstte 1 çatal-kaşık çekmecesi + altta kapaklı bölme", w: 600, h: 720, d: 580, minW: 400, maxW: 1000, doorSystemId: "hinged_single", drawersHeights: [140], topDrawerCombo: true, shelvesPerBay: 1 },
  { templateId: "tpl_kb_20_custom_base", familyId: "fam_kitchen_base", category: "kitchen_base", name: "Özel Ölçü Alt Modül", description: "Serbest parametrik tezgâh altı modül", w: 600, h: 720, d: 580, minW: 150, maxW: 1200, doorSystemId: "hinged_single", shelvesPerBay: 1 },

  // ============================================================================
  // B. MUTFAK ÜST DOLAPLARI (15 Şablon)
  // ============================================================================
  { templateId: "tpl_kw_01_single_door", familyId: "fam_kitchen_wall", category: "kitchen_wall", name: "Tek Kapaklı Üst Dolap", description: "450mm tek kapaklı 2 raflı üst dolap", w: 450, h: 720, d: 350, minW: 300, maxW: 600, doorSystemId: "hinged_single", shelvesPerBay: 2 },
  { templateId: "tpl_kw_02_double_door", familyId: "fam_kitchen_wall", category: "kitchen_wall", name: "Çift Kapaklı Üst Dolap", description: "800mm çift kapaklı 2 raflı üst dolap", w: 800, h: 720, d: 350, minW: 600, maxW: 1200, doorSystemId: "hinged_double", shelvesPerBay: 2 },
  { templateId: "tpl_kw_03_open_shelf", familyId: "fam_kitchen_wall", category: "kitchen_wall", name: "Açık Raflı Üst Modül", description: "600mm kapaksız açık üst raf ünitesi", w: 600, h: 720, d: 350, minW: 200, maxW: 1000, doorSystemId: "open", isOpenFront: true, shelvesPerBay: 2 },
  { templateId: "tpl_kw_04_glass_door", familyId: "fam_kitchen_wall", category: "kitchen_wall", name: "Cam Kapaklı Vitrin Üst Dolap", description: "800mm füme cam çerçeve kapaklı üst vitrin dolabı", w: 800, h: 720, d: 350, minW: 400, maxW: 1000, doorSystemId: "hinged_double", doorMaterialId: "mat_smoked_glass", shelvesPerBay: 2 },
  { templateId: "tpl_kw_05_lift_stay_single", familyId: "fam_kitchen_wall", category: "kitchen_wall", name: "Yukarı Kalkar Tek Kapak (HK top)", description: "800x450mm Blum AVENTOS HK top tek parça kalkar üst dolap", w: 800, h: 450, d: 350, minW: 400, maxW: 1200, maxH: 600, doorSystemId: "lift_up_stay", hardwareProductId: "hw_blum_aventos_hk_27", shelvesPerBay: 1 },
  { templateId: "tpl_kw_06_lift_bifold", familyId: "fam_kitchen_wall", category: "kitchen_wall", name: "İki Parçalı Katlanır Kalkar (HF top)", description: "900x780mm Blum AVENTOS HF top katlanır kalkar üst dolap", w: 900, h: 780, d: 350, minW: 450, maxW: 1800, minH: 480, maxH: 1040, doorSystemId: "lift_bi_fold", hardwareProductId: "hw_blum_aventos_hf_25", shelvesPerBay: 2 },
  { templateId: "tpl_kw_07_lift_parallel", familyId: "fam_kitchen_wall", category: "kitchen_wall", name: "Paralel Yukarı Kalkar (HL top)", description: "900x500mm Blum AVENTOS HL top paralel kalkar üst dolap", w: 900, h: 500, d: 350, minW: 450, maxW: 1800, minH: 300, maxH: 580, doorSystemId: "lift_parallel", hardwareProductId: "hw_blum_aventos_hl_25", shelvesPerBay: 1 },
  { templateId: "tpl_kw_08_lift_up_over", familyId: "fam_kitchen_wall", category: "kitchen_wall", name: "Üstten Döner Kalkar (HS top)", description: "900x720mm üstten aşarak döner kalkar üst dolap", w: 900, h: 720, d: 350, minW: 450, maxW: 1800, doorSystemId: "lift_up_stay", shelvesPerBay: 2 },
  { templateId: "tpl_kw_09_hood_cabinet", familyId: "fam_kitchen_wall", category: "kitchen_wall", name: "Davlumbaz Üst Dolabı", description: "600mm ankastre davlumbaz ve baca geçişli üst dolap", w: 600, h: 720, d: 350, minW: 600, maxW: 900, doorSystemId: "lift_up_stay", shelvesPerBay: 1 },
  { templateId: "tpl_kw_10_microwave_wall", familyId: "fam_kitchen_wall", category: "kitchen_wall", name: "Mikrodalga Nişli Üst Dolap", description: "600x720x380mm mikrodalga yuvalı üst dolap", w: 600, h: 720, d: 380, minW: 600, maxW: 600, minD: 380, doorSystemId: "lift_up_stay", shelvesPerBay: 1, isFixedWidth: true },
  { templateId: "tpl_kw_11_corner_wall", familyId: "fam_kitchen_wall", category: "kitchen_wall", name: "Köşe Üst Dolabı", description: "650x650mm L köşe üst dolabı", w: 650, h: 720, d: 650, minW: 600, maxW: 750, doorSystemId: "folding_side", isCorner: true, shelvesPerBay: 2 },
  { templateId: "tpl_kw_12_horizontal_wide", familyId: "fam_kitchen_wall", category: "kitchen_wall", name: "Yatay Geniş Üst Dolap", description: "1200x360mm geniş yatay kalkar kapaklı modül", w: 1200, h: 360, d: 350, minW: 800, maxW: 1800, baysCount: 2, doorSystemId: "lift_up_stay", shelvesPerBay: 0 },
  { templateId: "tpl_kw_13_narrow_wall", familyId: "fam_kitchen_wall", category: "kitchen_wall", name: "Dar Üst Dolap", description: "300mm dar tamamlayıcı üst dolap", w: 300, h: 720, d: 350, minW: 150, maxW: 350, doorSystemId: "hinged_single", shelvesPerBay: 2 },
  { templateId: "tpl_kw_14_led_shelf_unit", familyId: "fam_kitchen_wall", category: "kitchen_wall", name: "Aydınlatmalı Üst Dolap", description: "900mm gömme LED profilli vitrin üst dolap", w: 900, h: 720, d: 350, minW: 450, maxW: 1200, doorSystemId: "hinged_double", specialFitting: "led_profile", shelvesPerBay: 2 },
  { templateId: "tpl_kw_15_custom_wall", familyId: "fam_kitchen_wall", category: "kitchen_wall", name: "Özel Ölçü Üst Modül", description: "Serbest parametrik üst dolap", w: 600, h: 720, d: 350, minW: 150, maxW: 1800, doorSystemId: "hinged_single", shelvesPerBay: 2 },

  // ============================================================================
  // C. BOY VE CİHAZ DOLAPLARI (12 Şablon)
  // ============================================================================
  { templateId: "tpl_kt_01_pantry_shelved", familyId: "fam_kitchen_tall", category: "kitchen_tall", name: "Raflı Boy Kiler Dolabı", description: "600x2150mm 5 raflı standart boy kiler", w: 600, h: 2150, d: 580, minW: 400, maxW: 900, doorSystemId: "hinged_single", shelvesPerBay: 5 },
  { templateId: "tpl_kt_02_pantry_pullout", familyId: "fam_kitchen_tall", category: "kitchen_tall", name: "Çekmeceli / Tandem Kiler Dolabı", description: "450x2150mm Dispensa 100kg çekme kiler mekanizmalı boy dolap", w: 450, h: 2150, d: 580, minW: 300, maxW: 600, doorSystemId: "hinged_single", specialFitting: "pantry_pullout", shelvesPerBay: 0 },
  { templateId: "tpl_kt_03_pantry_internal_drawers", familyId: "fam_kitchen_tall", category: "kitchen_tall", name: "İç Çekmeceli Boy Kiler (SPACE TOWER)", description: "600x2150mm 155° sıfır çıkıntılı menteşe + 4 iç çekmece", w: 600, h: 2150, d: 580, minW: 450, maxW: 900, doorSystemId: "hinged_single", hardwareProductId: "hw_blum_71b7550", drawersHeights: [180, 180, 180, 180], isInternalDrawers: true, shelvesPerBay: 2 },
  { templateId: "tpl_kt_04_oven_tower", familyId: "fam_kitchen_tall", category: "kitchen_tall", name: "Ankastre Fırın Kulesi", description: "600x2150mm EN 1116 fırın kulesi + alt 2 çekmece + üst dolap", w: 600, h: 2150, d: 580, minW: 600, maxW: 600, doorSystemId: "hinged_single", drawersHeights: [180, 180], shelvesPerBay: 2, isFixedWidth: true },
  { templateId: "tpl_kt_05_oven_microwave_tower", familyId: "fam_kitchen_tall", category: "kitchen_tall", name: "Fırın + Mikrodalga Kulesi", description: "600x2150mm çift ankastre cihaz kulesi", w: 600, h: 2150, d: 580, minW: 600, maxW: 600, doorSystemId: "hinged_single", drawersHeights: [180, 180], shelvesPerBay: 3, isFixedWidth: true },
  { templateId: "tpl_kt_06_builtin_fridge", familyId: "fam_kitchen_tall", category: "kitchen_tall", name: "Ankastre Buzdolabı Boy Dolabı", description: "600x2150mm 200cm² havalandırma menfezli ankastre soğutucu kulesi", w: 600, h: 2150, d: 580, minW: 600, maxW: 600, doorSystemId: "hinged_single", shelvesPerBay: 1, isFixedWidth: true },
  { templateId: "tpl_kt_07_fridge_surround", familyId: "fam_kitchen_tall", category: "kitchen_tall", name: "Solo Buzdolabı Çevresi Ünitesi", description: "950x2150x650mm solo buzdolabı üstü ve yan kapama modülü", w: 950, h: 2150, d: 650, minW: 850, maxW: 1200, doorSystemId: "lift_up_stay", shelvesPerBay: 1 },
  { templateId: "tpl_kt_08_utility_cleaning", familyId: "fam_kitchen_tall", category: "kitchen_tall", name: "Temizlik Dolabı", description: "600x2150mm ütü masası ve temizlik malzemesi boy dolabı", w: 600, h: 2150, d: 600, minW: 450, maxW: 800, doorSystemId: "hinged_single", shelvesPerBay: 3 },
  { templateId: "tpl_kt_09_broom_vacuum", familyId: "fam_kitchen_tall", category: "kitchen_tall", name: "Süpürge & Şarj İstasyonu Dolabı", description: "500x2150mm dikey şarjlı süpürge dolabı", w: 500, h: 2150, d: 580, minW: 400, maxW: 600, doorSystemId: "hinged_single", shelvesPerBay: 2 },
  { templateId: "tpl_kt_10_open_niche_tall", familyId: "fam_kitchen_tall", category: "kitchen_tall", name: "Açık Kahve Nişli Boy Dolap", description: "800x2150mm LED aydınlatmalı kahve nişli boy modül", w: 800, h: 2150, d: 580, minW: 600, maxW: 1200, doorSystemId: "hinged_double", drawersHeights: [200, 200], shelvesPerBay: 2, specialFitting: "led_profile" },
  { templateId: "tpl_kt_11_pocket_appliance", familyId: "fam_kitchen_tall", category: "kitchen_tall", name: "Pocket Kapaklı Cihaz Dolabı (REVEGO)", description: "1300x2200x650mm Blum REVEGO / Hawa Concepta III gizlenen kapaklı kahvaltı/cihaz dolabı", w: 1300, h: 2200, d: 650, minW: 750, maxW: 1500, minD: 573, baysCount: 2, doorSystemId: "pocket_retractable", hardwareProductId: "hw_blum_revego_uno", drawersHeights: [180, 180], isInternalDrawers: true, shelvesPerBay: 2 },
  { templateId: "tpl_kt_12_custom_tall", familyId: "fam_kitchen_tall", category: "kitchen_tall", name: "Özel Ölçü Boy Dolap", description: "Serbest parametrik boy dolap", w: 600, h: 2150, d: 580, minW: 300, maxW: 1200, doorSystemId: "hinged_single", shelvesPerBay: 4 },

  // ============================================================================
  // D. GARDIROP VE GİYİNME ODASI (20 Şablon)
  // ============================================================================
  { templateId: "tpl_wd_01_single_door", familyId: "fam_wardrobe", category: "wardrobe", name: "Tek Kapaklı Gardırop", description: "500x2200x600mm tek kapaklı askı ve raflı gardırop", w: 500, h: 2200, d: 600, minW: 400, maxW: 600, doorSystemId: "hinged_single", shelvesPerBay: 2, hangingRailsPerBay: 1 },
  { templateId: "tpl_wd_02_two_door", familyId: "fam_wardrobe", category: "wardrobe", name: "Çift Kapaklı Gardırop", description: "1000x2200x600mm çift kapaklı standart gardırop", w: 1000, h: 2200, d: 600, minW: 800, maxW: 1200, doorSystemId: "hinged_double", shelvesPerBay: 2, hangingRailsPerBay: 1 },
  { templateId: "tpl_wd_03_three_door", familyId: "fam_wardrobe", category: "wardrobe", name: "Üç Kapaklı Gardırop", description: "1500x2200x600mm 2 bölmeli, 3 kapaklı master gardırop", w: 1500, h: 2200, d: 600, minW: 1200, maxW: 1800, baysCount: 2, bayCustomWidths: [475, undefined], bayDoorSystems: ["hinged_single", "hinged_double"], bayDoorTypes: ["single_left", "double"], bayShelvesCount: [4, 2], bayHangingRailsCount: [0, 1], bayDrawersIndices: [1], doorSystemId: "hinged_double", shelvesPerBay: 2, hangingRailsPerBay: 1, drawersHeights: [180, 180], isInternalDrawers: false },
  { templateId: "tpl_wd_04_four_door", familyId: "fam_wardrobe", category: "wardrobe", name: "Dört Kapaklı Gardırop", description: "2000x2200x600mm 2 eşit bölmeli, 4 kapaklı geniş gardırop", w: 2000, h: 2200, d: 600, minW: 1600, maxW: 2400, baysCount: 2, doorSystemId: "hinged_double", shelvesPerBay: 2, hangingRailsPerBay: 1 },
  { templateId: "tpl_wd_05_sliding_2door", familyId: "fam_wardrobe", category: "wardrobe", name: "Sürgülü İki Kapaklı Gardırop", description: "1800x2200x650mm Hettich TopLine L 2 kapaklı sürgülü gardırop", w: 1800, h: 2200, d: 650, minW: 1400, maxW: 2400, minD: 580, baysCount: 2, doorSystemId: "sliding_top_hung", hardwareProductId: "hw_hettich_topline_l", shelvesPerBay: 2, hangingRailsPerBay: 1 },
  { templateId: "tpl_wd_06_sliding_3door", familyId: "fam_wardrobe", category: "wardrobe", name: "Sürgülü Üç Kapaklı Gardırop", description: "2700x2200x650mm 3 bölmeli sürgülü gardırop", w: 2700, h: 2200, d: 650, minW: 2100, maxW: 3600, minD: 580, baysCount: 3, doorSystemId: "sliding_top_hung", hardwareProductId: "hw_hettich_topline_l", shelvesPerBay: 2, hangingRailsPerBay: 1 },
  { templateId: "tpl_wd_07_sliding_4door", familyId: "fam_wardrobe", category: "wardrobe", name: "Sürgülü Dört Kapaklı Gardırop", description: "3200x2200x650mm 4 bölmeli senkronize sürgülü gardırop", w: 3200, h: 2200, d: 650, minW: 2600, maxW: 3600, minD: 580, baysCount: 4, doorSystemId: "sliding_top_hung", hardwareProductId: "hw_hettich_topline_l", shelvesPerBay: 2, hangingRailsPerBay: 1 },
  { templateId: "tpl_wd_08_open_walkin", familyId: "fam_wardrobe", category: "wardrobe_walkin", name: "Açık Gövde Giyinme Modülü", description: "1000x2300x550mm kapaksız modern walk-in giyinme modülü", w: 1000, h: 2300, d: 550, minW: 500, maxW: 1200, doorSystemId: "open", isOpenFront: true, shelvesPerBay: 2, hangingRailsPerBay: 2, drawersHeights: [160, 160] },
  { templateId: "tpl_wd_09_hanging_heavy", familyId: "fam_wardrobe", category: "wardrobe", name: "Askılık Ağırlıklı Gardırop (Asansörlü)", description: "1000x2300x600mm üstte asansör askılık + altta sabit askı", w: 1000, h: 2300, d: 600, minW: 800, maxW: 1200, doorSystemId: "hinged_double", shelvesPerBay: 1, hangingRailsPerBay: 2, specialFitting: "wardrobe_lift" },
  { templateId: "tpl_wd_10_shelf_heavy", familyId: "fam_wardrobe", category: "wardrobe", name: "Raf Ağırlıklı Gardırop", description: "800x2200x600mm 5 hareketli raflı katlı kıyafet dolabı", w: 800, h: 2200, d: 600, minW: 400, maxW: 1000, doorSystemId: "hinged_double", shelvesPerBay: 5 },
  { templateId: "tpl_wd_11_drawer_heavy", familyId: "fam_wardrobe", category: "wardrobe", name: "Çekmece Ağırlıklı Gardırop", description: "900x2200x600mm 4 dış çekmeceli + üst raflı gardırop", w: 900, h: 2200, d: 600, minW: 600, maxW: 1200, doorSystemId: "hinged_double", drawersHeights: [180, 180, 180, 180], shelvesPerBay: 3 },
  { templateId: "tpl_wd_12_mixed_organizer", familyId: "fam_wardrobe", category: "wardrobe", name: "Karma İç Düzenli Gardırop", description: "1200x2300x600mm askı, raf ve iç çekmece kombinasyonu", w: 1200, h: 2300, d: 600, minW: 900, maxW: 1600, baysCount: 2, bayDoorSystems: ["hinged_single", "hinged_single"], bayDoorTypes: ["single_left", "single_right"], bayShelvesCount: [4, 2], bayHangingRailsCount: [0, 1], bayDrawersIndices: [1], doorSystemId: "hinged_single", shelvesPerBay: 2, hangingRailsPerBay: 1, drawersHeights: [180, 180], isInternalDrawers: true },
  { templateId: "tpl_wd_13_corner_wardrobe", familyId: "fam_wardrobe", category: "wardrobe_corner", name: "Köşe Gardırop Modülü", description: "1050x2200x1050mm katlanır kapaklı L köşe gardırop", w: 1050, h: 2200, d: 1050, minW: 950, maxW: 1200, doorSystemId: "folding_side", isCorner: true, shelvesPerBay: 2, hangingRailsPerBay: 1 },
  { templateId: "tpl_wd_14_walkin_l_unit", familyId: "fam_wardrobe", category: "wardrobe_walkin", name: "L Giyinme Odası Modülü", description: "1000x2300x1000mm L dönüşlü açık giyinme odası ünitesi", w: 1000, h: 2300, d: 1000, minW: 800, maxW: 1200, minD: 800, maxD: 1200, doorSystemId: "open", isOpenFront: true, isCorner: true, shelvesPerBay: 3, hangingRailsPerBay: 1 },
  { templateId: "tpl_wd_15_walkin_u_unit", familyId: "fam_wardrobe", category: "wardrobe_walkin", name: "U Giyinme Odası Merkez Modülü", description: "1200x2300x550mm LED aydınlatmalı ve takı çekmeceli U giyinme modülü", w: 1200, h: 2300, d: 550, minW: 800, maxW: 1600, doorSystemId: "open", isOpenFront: true, shelvesPerBay: 2, hangingRailsPerBay: 1, drawersHeights: [180, 120], specialFitting: "jewelry_tray" },
  { templateId: "tpl_wd_16_island_dresser", familyId: "fam_wardrobe", category: "wardrobe_walkin", name: "Ada Çekmece & Takı Ünitesi", description: "1200x900x800mm giyinme odası orta ada şifonyer ünitesi", w: 1200, h: 900, d: 800, minW: 800, maxW: 1800, maxH: 1050, baysCount: 2, doorSystemId: "open", drawersHeights: [200, 200, 140], specialFitting: "jewelry_tray" },
  { templateId: "tpl_wd_17_trouser_unit", familyId: "fam_wardrobe", category: "wardrobe", name: "Pantolonluk Ünitesi", description: "900x2200x600mm teleskopik pantolonluk ve gömlek askılı modül", w: 900, h: 2200, d: 600, minW: 600, maxW: 1000, doorSystemId: "hinged_double", shelvesPerBay: 1, hangingRailsPerBay: 1, specialFitting: "trouser_rack" },
  { templateId: "tpl_wd_18_shoe_tower", familyId: "fam_wardrobe", category: "wardrobe", name: "Ayakkabılık Ünitesi", description: "800x2200x450mm raylı eğimli ayakkabılık kulesi", w: 800, h: 2200, d: 450, minW: 600, maxW: 1000, doorSystemId: "hinged_double", shelvesPerBay: 4, specialFitting: "shoe_rack" },
  { templateId: "tpl_wd_19_glass_showcase", familyId: "fam_wardrobe", category: "wardrobe", name: "Cam Kapaklı Vitrin Gardırop", description: "1000x2300x600mm füme cam kapaklı ve boydan LED aydınlatmalı vitrin", w: 1000, h: 2300, d: 600, minW: 800, maxW: 1200, doorSystemId: "hinged_double", doorMaterialId: "mat_smoked_glass", shelvesPerBay: 3, specialFitting: "led_profile" },
  { templateId: "tpl_wd_20_builtin_niche", familyId: "fam_wardrobe", category: "wardrobe", name: "Özel Ölçü / Gömme Dolap", description: "Duvar-tavan arası nişlere tam uyumlu parametrik gömme gardırop", w: 1600, h: 2500, d: 600, minW: 400, maxW: 3600, baysCount: 2, doorSystemId: "hinged_double", shelvesPerBay: 2, hangingRailsPerBay: 1 },

  // ============================================================================
  // E. ÖZEL VE KÖŞE MODÜLLERİ (10 Şablon)
  // ============================================================================
  { templateId: "tpl_sc_01_inner_corner", familyId: "fam_special_corner", category: "special_corner", name: "İç Köşe Dönüş Modülü (90°)", description: "900x2200x900mm 90° iç köşe bağlantı dolabı", w: 900, h: 2200, d: 900, minW: 800, maxW: 1200, doorSystemId: "folding_side", isCorner: true, shelvesPerBay: 3 },
  { templateId: "tpl_sc_02_outer_corner", familyId: "fam_special_corner", category: "special_corner", name: "Dış Köşe Kolon Sarma Modülü", description: "600x2200x600mm dışbükey köşe/kolon dönüş ünitesi", w: 600, h: 2200, d: 600, minW: 400, maxW: 900, doorSystemId: "hinged_single", isCorner: true, shelvesPerBay: 4 },
  { templateId: "tpl_sc_03_blind_corner_tall", familyId: "fam_special_corner", category: "special_corner", name: "Kör Köşe Boy Modül", description: "1100x2200x600mm kör bölmeli boy köşe dolabı", w: 1100, h: 2200, d: 600, minW: 950, maxW: 1300, doorSystemId: "hinged_single", isCorner: true, shelvesPerBay: 3 },
  { templateId: "tpl_sc_04_diagonal_tall", familyId: "fam_special_corner", category: "special_corner", name: "Diyagonal (45°) Köşe Dolabı", description: "1000x2200x1000mm +45° açılı kapaklı köşe gardırop", w: 1000, h: 2200, d: 1000, minW: 900, maxW: 1200, doorSystemId: "hinged_single", hardwareProductId: "hw_blum_79b9458", isCorner: true, shelvesPerBay: 2, hangingRailsPerBay: 1 },
  { templateId: "tpl_sc_05_sloped_ceiling", familyId: "fam_special_corner", category: "special_corner", name: "Eğimli Tavan (Çatı Arası) Modülü", description: "Çatı eğimine göre açılı kesim gerektiren özel modül", w: 900, h: 2100, d: 600, minW: 450, maxW: 1200, doorSystemId: "hinged_double", shelvesPerBay: 3, requiresFactoryValidation: true },
  { templateId: "tpl_sc_06_under_stairs", familyId: "fam_special_corner", category: "special_corner", name: "Merdiven Altı Kademeli Modül", description: "1200x1800x600mm merdiven altı kademeli depolama modülü", w: 1200, h: 1800, d: 600, minW: 600, maxW: 1800, baysCount: 2, bayDoorSystems: ["hinged_single", "hinged_single"], bayDoorTypes: ["single_left", "single_right"], doorSystemId: "hinged_single", shelvesPerBay: 2, requiresFactoryValidation: true },
  { templateId: "tpl_sc_07_narrow_niche", familyId: "fam_special_corner", category: "special_corner", name: "Dar Niş Dolabı (250mm)", description: "250x2150x580mm kolon yanı dar niş değerlendirme modülü", w: 250, h: 2150, d: 580, minW: 150, maxW: 350, doorSystemId: "hinged_single", shelvesPerBay: 5 },
  { templateId: "tpl_sc_08_stepped_depth", familyId: "fam_special_corner", category: "special_corner", name: "Kademeli Derinlik Geçiş Modülü", description: "600x2200x450mm derinlik farkı dengeleme dolabı", w: 600, h: 2200, d: 450, minW: 400, maxW: 900, doorSystemId: "hinged_single", shelvesPerBay: 4 },
  { templateId: "tpl_sc_09_terminal_end", familyId: "fam_special_corner", category: "special_corner", name: "Serbest Biçimli Açık Bitiş Modülü", description: "350x2200x600mm dolap dizisi yan bitiş açık vitrin modülü", w: 350, h: 2200, d: 600, minW: 250, maxW: 500, doorSystemId: "open", isOpenFront: true, shelvesPerBay: 5 },
  { templateId: "tpl_sc_10_custom_geometry", familyId: "fam_special_corner", category: "special_corner", name: "Özel Üretim Geometrisi (Bespoke)", description: "Fabrika teknik ofis onayı gerektiren özel kesim modül", w: 800, h: 2200, d: 600, minW: 300, maxW: 1600, doorSystemId: "hinged_double", shelvesPerBay: 3, requiresFactoryValidation: true },

  // ============================================================================
  // F. TAMAMLAYICI MODÜLLER (15 Şablon)
  // ============================================================================
  { templateId: "tpl_cm_01_plinth_strip", familyId: "fam_complementary", category: "complementary", name: "Baza Ön Boy Bandı", description: "2400x100x18mm su contalı boydan ön baza", w: 2400, h: 100, d: 18, minW: 200, maxW: 2800, minH: 60, maxH: 200, minD: 16, maxD: 30, doorSystemId: "open", isOpenFront: true, shelvesPerBay: 0, complementaryRole: "plinth_strip" },
  { templateId: "tpl_cm_02_leveling_feet", familyId: "fam_complementary", category: "complementary", name: "Ayarlanabilir Baza Ayağı Seti", description: "100mm ayarlanabilir ağır yük baza ayağı takımı", w: 600, h: 100, d: 500, minW: 300, maxW: 1200, minH: 60, maxH: 180, doorSystemId: "open", isOpenFront: true, shelvesPerBay: 0, complementaryRole: "leveling_feet" },
  { templateId: "tpl_cm_03_skirting", familyId: "fam_complementary", category: "complementary", name: "Süpürgelik / Yan Baza Dönüşü", description: "580x100x18mm yan baza kapama parçası", w: 580, h: 100, d: 18, minW: 200, maxW: 1000, minH: 60, maxH: 200, minD: 16, maxD: 30, doorSystemId: "open", isOpenFront: true, shelvesPerBay: 0, complementaryRole: "skirting" },
  { templateId: "tpl_cm_04_wall_filler", familyId: "fam_complementary", category: "complementary", name: "Duvar Bitiş Dolgu Paneli (Kör Parça)", description: "50x2200x18mm L-kayıtlı duvar montaj ve kulp açılım kör parçası", w: 50, h: 2200, d: 100, minW: 15, maxW: 200, minH: 300, maxH: 2800, minD: 18, maxD: 600, doorSystemId: "open", isOpenFront: true, shelvesPerBay: 0, complementaryRole: "wall_filler" },
  { templateId: "tpl_cm_05_end_panel", familyId: "fam_complementary", category: "complementary", name: "Görünür Yan Bitiş Paneli", description: "18x2200x600mm 4 kenar bantlı cephe malzemesinden yan bitiş paneli", w: 18, h: 2200, d: 600, minW: 16, maxW: 50, minH: 300, maxH: 2800, minD: 300, maxD: 700, doorSystemId: "open", isOpenFront: true, shelvesPerBay: 0, complementaryRole: "end_panel" },
  { templateId: "tpl_cm_06_top_infill", familyId: "fam_complementary", category: "complementary", name: "Üst Tavan Kapama Paneli", description: "2400x150x18mm dolap üstü ile tavan arası kapama parçası", w: 2400, h: 150, d: 18, minW: 300, maxW: 2800, minH: 30, maxH: 500, minD: 16, maxD: 100, doorSystemId: "open", isOpenFront: true, shelvesPerBay: 0, complementaryRole: "top_infill" },
  { templateId: "tpl_cm_07_fascia_panel", familyId: "fam_complementary", category: "complementary", name: "Cihaz / Evye Alın Paneli", description: "600x110x18mm sabit ön klapa / alın parçası", w: 600, h: 110, d: 18, minW: 300, maxW: 1200, minH: 50, maxH: 300, minD: 16, maxD: 30, doorSystemId: "open", isOpenFront: true, shelvesPerBay: 0, complementaryRole: "fascia_panel" },
  { templateId: "tpl_cm_08_back_cladding", familyId: "fam_complementary", category: "complementary", name: "Dekoratif Arkalık / Duvar Lambri", description: "1200x2200x18mm açık giyinme veya kahve nişi arka kaplama paneli", w: 1200, h: 2200, d: 18, minW: 300, maxW: 2800, minH: 300, maxH: 2800, minD: 8, maxD: 36, doorSystemId: "open", isOpenFront: true, shelvesPerBay: 0, complementaryRole: "back_cladding" },
  { templateId: "tpl_cm_09_countertop", familyId: "fam_complementary", category: "complementary", name: "Mutfak Tezgâhı (Countertop)", description: "2400x40x600mm Calacatta kuvars / kompakt mutfak tezgâhı", w: 2400, h: 40, d: 600, minW: 300, maxW: 3600, minH: 12, maxH: 80, minD: 500, maxD: 1200, doorSystemId: "open", isOpenFront: true, shelvesPerBay: 0, bodyMaterialId: "mat_quartz_calacatta", complementaryRole: "countertop" },
  { templateId: "tpl_cm_10_waterfall_edge", familyId: "fam_complementary", category: "complementary", name: "Tezgâh Yan Düşey Bitişi (Waterfall)", description: "40x860x600mm 45° gönyeli tezgâh yan dikmesi", w: 40, h: 860, d: 600, minW: 12, maxW: 80, minH: 700, maxH: 1100, minD: 500, maxD: 1200, doorSystemId: "open", isOpenFront: true, shelvesPerBay: 0, bodyMaterialId: "mat_quartz_calacatta", complementaryRole: "waterfall_edge" },
  { templateId: "tpl_cm_11_backsplash", familyId: "fam_complementary", category: "complementary", name: "Tezgâh Arası Paneli (Backsplash)", description: "2400x600x18mm tezgâh ile üst dolap arası kaplama paneli", w: 2400, h: 600, d: 18, minW: 300, maxW: 3600, minH: 100, maxH: 900, minD: 12, maxD: 40, doorSystemId: "open", isOpenFront: true, shelvesPerBay: 0, bodyMaterialId: "mat_quartz_calacatta", complementaryRole: "backsplash" },
  { templateId: "tpl_cm_12_crown_molding", familyId: "fam_complementary", category: "complementary", name: "Üst Taç / Işık Bandı Profili", description: "2400x60x40mm üst dolap taç veya ışık gizleme profili", w: 2400, h: 60, d: 40, minW: 300, maxW: 2800, minH: 30, maxH: 150, minD: 18, maxD: 100, doorSystemId: "open", isOpenFront: true, shelvesPerBay: 0, complementaryRole: "crown_molding" },
  { templateId: "tpl_cm_13_led_channel", familyId: "fam_complementary", category: "complementary", name: "Gömme LED Aydınlatma Profili", description: "1000x16x16mm difüzörlü alüminyum şerit LED kanalı", w: 1000, h: 16, d: 16, minW: 200, maxW: 2600, minH: 15, maxH: 40, minD: 15, maxD: 40, doorSystemId: "open", isOpenFront: true, shelvesPerBay: 0, complementaryRole: "led_channel" },
  { templateId: "tpl_cm_14_wall_bracket", familyId: "fam_complementary", category: "complementary", name: "Duvar Askı Rayı & Devrilme Önleyici", description: "EN 14749 uyumlu çelik duvar askı rayı", w: 2400, h: 45, d: 16, minW: 300, maxW: 2800, minH: 30, maxH: 80, minD: 15, maxD: 30, doorSystemId: "open", isOpenFront: true, shelvesPerBay: 0, complementaryRole: "wall_bracket" },
  { templateId: "tpl_cm_15_service_spacer", familyId: "fam_complementary", category: "complementary", name: "Montaj / Tesisat Servis Boşluğu Elemanı", description: "600x2150x50mm arka havalandırma ve tesisat boşluk modülü", w: 600, h: 2150, d: 50, minW: 200, maxW: 1200, minH: 300, maxH: 2600, minD: 20, maxD: 150, doorSystemId: "open", isOpenFront: true, shelvesPerBay: 0, complementaryRole: "service_spacer" },
];

export const V4_MODULE_TEMPLATES: V4ModuleTemplateDefinition[] = TEMPLATE_SEEDS.map(buildTemplateFromSeed);

export function getTemplatesByFamily(familyId: ModuleFamilyId): V4ModuleTemplateDefinition[] {
  return V4_MODULE_TEMPLATES.filter((t) => t.familyId === familyId);
}

export function getV4TemplateById(templateId: string): V4ModuleTemplateDefinition | undefined {
  const direct = V4_MODULE_TEMPLATES.find((t) => t.templateId === templateId);
  if (direct) return direct;
  // Aliases for legacy/shorthand template IDs
  const aliasMap: Record<string, string> = {
    tpl_kt_01_single_door_pantry: "tpl_kt_01_pantry_shelved",
    tpl_kt_03_space_tower: "tpl_kt_03_pantry_internal_drawers",
    tpl_kb_04_three_drawer: "tpl_kb_05_three_drawers",
  };
  const alias = aliasMap[templateId];
  return alias ? V4_MODULE_TEMPLATES.find((t) => t.templateId === alias) : undefined;
}
