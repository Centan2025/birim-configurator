import { DesignProject, ModuleInstance, MaterialDefinition, DEFAULT_MATERIALS, calculateFourSpaceDimensions, calculateShelfDeflection, isBuiltInDishwasherModule, isBuiltInOvenOrFridgeTower, computeDividerTJunctionYs, isSinkModule, roundMm, computeProjectGrainContinuityMap, computeModuleIntrinsicSignature, evaluateFreestandingTipOverRisk } from "@birim/core";
import { generateModuleGeometry } from "@birim/geometry";
import { CutPiece, HardwareBOMItem, ShelfDeflectionBOMEntry } from "../types";
import { ModuleHardwareCallRecord, moduleBomSliceCache, computeCurvedKerfBendingSpec, hasSinkOrCooktopAppliance } from "./bom-helpers-and-kerf";
import { appendModuleComponentCutPiecesAndHardware } from "./module-component-cutpiece-builder";

export interface ModuleBomLoopParams {
  project: DesignProject;
  materialsMap: Map<string, MaterialDefinition>;
  matsFingerprint: string;
  spaceCeilingH: number;
  spaceWallsCount: number;
  grainContinuityMap: ReturnType<typeof computeProjectGrainContinuityMap>;
  cutList: CutPiece[];
  shelfDeflectionAnalyses: ShelfDeflectionBOMEntry[];
  validationWarnings: string[];
  addHardware: (
    sku: string,
    name: string,
    category: HardwareBOMItem["category"],
    quantity: number,
    unit?: HardwareBOMItem["unit"],
    unitPrice?: number
  ) => void;
  setActiveHardwareSink: (sink: ModuleHardwareCallRecord[] | null) => void;
}

export function populateModuleBomSlices(params: ModuleBomLoopParams): {
  totalDrillingHolesCount: number;
  allDimensionChainsClosed: boolean;
} {
  const {
    project,
    materialsMap,
    matsFingerprint,
    spaceCeilingH,
    spaceWallsCount,
    grainContinuityMap,
    cutList,
    shelfDeflectionAnalyses,
    validationWarnings,
    addHardware,
    setActiveHardwareSink,
  } = params;
  let totalDrillingHolesCount = 0;
  let allDimensionChainsClosed = true;
  let activeModuleHardwareSink: ModuleHardwareCallRecord[] | null = null;
  project.modules.forEach((module: ModuleInstance) => {
    if (module.includeInProduction === false) return;
    const isCountertopMod = module.category === "complementary" && module.complementaryRole === "countertop";
    const hasBelowSupport =
      (module.position?.y || 0) >= 150 &&
      (module.carcass.plinthHeight ?? 0) === 0 &&
      module.category !== "complementary" &&
      project.modules.some(
        (bm) =>
          bm.id !== module.id &&
          bm.category !== "complementary" &&
          Math.abs(bm.position.y + bm.dimensions.height - module.position.y) <= 20 &&
          bm.position.x < module.position.x + module.dimensions.width - 20 &&
          bm.position.x + bm.dimensions.width > module.position.x + 20
      );
    let modGrainSig = "";
    if (grainContinuityMap.size > 0) {
      grainContinuityMap.forEach((gv, gk) => {
        if (gv.moduleId === module.id && gk === `${gv.moduleId}::${gv.componentId}`) {
          modGrainSig += `${gv.componentId}:${gv.grainGroupId}:${gv.sequenceLabel}:${gv.offsetXMm}:${gv.offsetYMm};`;
        }
      });
    }
    const sliceCacheKey = !isCountertopMod
      ? `${computeModuleIntrinsicSignature(module)}|BS:${hasBelowSupport ? 1 : 0}|SP:${spaceCeilingH}:${spaceWallsCount}|GR:${modGrainSig}|MM:${matsFingerprint}`
      : null;
    if (sliceCacheKey) {
      const cachedSlice = moduleBomSliceCache.get(sliceCacheKey);
      if (cachedSlice) {
        for (let i = 0; i < cachedSlice.cutPieces.length; i++) cutList.push(cachedSlice.cutPieces[i]);
        for (let i = 0; i < cachedSlice.hardwareCalls.length; i++) {
          const hc = cachedSlice.hardwareCalls[i];
          addHardware(hc.sku, hc.name, hc.category, hc.quantity, hc.unit, hc.unitPrice);
        }
        for (let i = 0; i < cachedSlice.shelfDeflections.length; i++) shelfDeflectionAnalyses.push(cachedSlice.shelfDeflections[i]);
        for (let i = 0; i < cachedSlice.warnings.length; i++) validationWarnings.push(cachedSlice.warnings[i]);
        totalDrillingHolesCount += cachedSlice.drillingHolesDelta;
        if (!cachedSlice.dimChainClosed) allDimensionChainsClosed = false;
        return;
      }
    }

    const sliceCutStart = cutList.length;
    const sliceDeflStart = shelfDeflectionAnalyses.length;
    const sliceWarnStart = validationWarnings.length;
    const sliceDrillStart = totalDrillingHolesCount;
    const prevDimChainClosed = allDimensionChainsClosed;
    const recordedHwCalls: ModuleHardwareCallRecord[] = [];
    activeModuleHardwareSink = recordedHwCalls; setActiveHardwareSink(recordedHwCalls);

    const geo = generateModuleGeometry(module);
    const fourSpace = calculateFourSpaceDimensions(module, project.customMaterials);
    const bodyMat = materialsMap.get(module.carcass.bodyMaterialId) || DEFAULT_MATERIALS[0];
    const doorMat = materialsMap.get(module.carcass.doorMaterialId) || DEFAULT_MATERIALS[2];
    const isCapsuleModule =
      module.carcass.hullShape === "capsule_stadium" ||
      module.carcass.hullShape === "rounded_corners" ||
      module.carcass.hullShape === "capsule_table";
    const hasGroovedBack =
      module.category !== "complementary" &&
      !module.isOpenFront &&
      !isCapsuleModule &&
      module.carcass.backPanelType === "grooved";

    // Canonical Capsule Stadium, Rounded-Corner Tambour & Capsule Table Engineering BOM:
    // Both `capsule_stadium` (2×180° kerf shells) and `rounded_corners` (4×90° kerf shells)
    // emit their exact `kerf_curve` panels via `generateModuleGeometry(module)` with zero duplicate flat outer side panels!
    if (
      module.carcass.hullShape === "capsule_stadium" ||
      module.carcass.hullShape === "rounded_corners"
    ) {
      const capR =
        module.carcass.hullShape === "rounded_corners"
          ? Math.max(65, Math.min(module.dimensions.depth / 2 - 20, module.carcass.cornerRadiusMm || 110))
          : Math.min(module.dimensions.depth / 2, module.carcass.cornerRadiusMm || module.dimensions.depth / 2);
      const pocketR = Math.max(52, capR - 32);
      const bendDeg = module.carcass.hullShape === "capsule_stadium" ? 180 : 90;
      const curveCount = module.carcass.hullShape === "capsule_stadium" ? 2 : 4;
      const kerf = computeCurvedKerfBendingSpec(
        pocketR,
        bendDeg,
        module.carcass.panelThickness || 18
      );
      addHardware(
        "HW_CNC_KERF_BENDING",
        `CNC Kerf-Bending Kavis Çentikleme & Kalıp Pres (${kerf.kerfCount * curveCount} kanal)`,
        "special",
        curveCount,
        "adet",
        34.0
      );
      if (!module.isOpenFront && module.bays.some((b) => b.door?.type !== "open")) {
        const perimMeters = roundMm(
          (2 * Math.max(0, module.dimensions.width - 2 * capR) + 2 * Math.PI * Math.max(30, capR - 18)) * 2 / 1000,
          2
        );
        addHardware(
          "HW_TAMBOUR_FLEX_TRACK",
          "Kavisli Tambur Sürgü Kapak Rayı & Akustik Keçe Sırt Seti",
          "slide",
          1,
          "takım",
          68.0
        );
        addHardware(
          "HW_TAMBOUR_GLIDE_PROFILE",
          "8.5×7.5mm CNC Kanal İçi Polipropilen Sessiz Kayar Fitil (Üst + Alt)",
          "slide",
          Math.max(2, perimMeters),
          "metre",
          6.8
        );
        addHardware(
          "HW_TAMBOUR_MAGNET_STOP",
          "Tambur Kapak Mıknatıslı Merkez Karşılık & Çekme Çıtası Seti",
          "handle",
          2,
          "adet",
          12.5
        );
      }
      if (module.carcass.plinthHeight >= 110) {
        addHardware(
          "HW_CAPSULE_METAL_LEG",
          `Torna Pirinç / Mat Siyah Silindirik Ayak + M8 Flanş (${module.carcass.plinthHeight}mm)`,
          "leg",
          module.dimensions.width >= 1800 ? 6 : 4,
          "adet",
          16.5
        );
      }
    } else if (module.carcass.hullShape === "capsule_table") {
      const pedR = Math.round(Math.min(185, Math.max(95, module.dimensions.depth * 0.21)));
      const kerfPed = computeCurvedKerfBendingSpec(pedR, 360, 18);
      const pedCount = module.dimensions.width >= 1450 ? 2 : 1;
      addHardware(
        "HW_CNC_SWISS_CAPSULE_TOP",
        `5 Eksen CNC Kapsül Masa Kontur & 45° Swiss-Edge Pah İşleme (R=${Math.round(module.carcass.cornerRadiusMm || module.dimensions.depth / 2)}mm)`,
        "special",
        1,
        "adet",
        55.0
      );
      addHardware(
        "HW_CNC_FLUTED_PEDESTAL",
        `Silindirik Yivli Kapsül Sütun Ayak Seti (Açınım ${kerfPed.unfoldedArcLengthMm}mm)`,
        "leg",
        pedCount,
        "adet",
        95.0
      );
      addHardware(
        "HW_TABLE_MOUNT_FLANGE_M8",
        "Çelik Masa Sütun Bağlantı Flanşı + M8 Gövde Cıvata Takımı",
        "connector",
        pedCount,
        "takım",
        18.5
      );
      addHardware(
        "HW_TABLE_LEVELING_GLIDE",
        "Gizli Masa Terazi Pabucu M10 (Keçe Tabanlı)",
        "leg",
        pedCount * 4,
        "adet",
        1.8
      );
      if (module.dimensions.width >= 1500) {
        addHardware(
          "HW_TABLE_ANTI_SAG_BEAM",
          "Masa Tablası Altı 40×30mm Çelik Sarkma Önleyici Travers Profil",
          "special",
          1,
          "adet",
          32.0
        );
      }
    }

    if (module.category !== "complementary") {
      // P0-03: EN 14749 / EN 16122 Tall & Slender Freestanding Cabinet Anti-Tip Restraint Hardware
      const tipEval = evaluateFreestandingTipOverRisk(module, project.space);
      if (tipEval.requiresWallAnchor && module.carcass.wallAnchored !== false) {
        addHardware(
          "HW_ANTI_TIP_EN14749_L",
          "EN 14749 Devrilme Önleyici Çelik L-Duvar Sabitleme Braketi + Dübel Seti",
          "fastener",
          2,
          "adet",
          2.65
        );
      }

      const baySum = fourSpace.usableInternal.bayClearWidthsMm.reduce((a, b) => a + b, 0);
      const expectedTotalW =
        baySum + (module.bays.length + 1) * (module.carcass.panelThickness || 18);
      if (Math.abs(expectedTotalW - module.dimensions.width) > 1) {
        allDimensionChainsClosed = false;
      }

      module.bays.forEach((bay) => {
        const prof =
          bay.door?.crossSectionProfile || module.carcass.crossSectionProfile || "flat_slab";
        if (
          prof !== "flat_slab" &&
          bay.door?.type !== "open" &&
          bay.door?.doorSystemId !== "open"
        ) {
          const doorAreaM2 = roundMm(
            (module.dimensions.width * module.dimensions.height) /
              (Math.max(1, module.bays.length) * 1_000_000),
            2
          );
          const rateMap: Record<
            string,
            { sku: string; name: string; price: number } | undefined
          > = {
            shaker_frame: {
              sku: "HW_CNC_DOOR_PROFILE_SHAKER",
              name: "5 Eksen CNC Çerçeve (Shaker) Kapak Göbek İşleme",
              price: 18.0,
            },
            fluted_ribbed: {
              sku: "HW_CNC_DOOR_PROFILE_FLUTED",
              name: "CNC Dikey Mikro-Derz (Fitilli / Fluted) Yüzey İşleme",
              price: 22.0,
            },
            bevel_45: {
              sku: "HW_CNC_DOOR_PROFILE_BEVEL45",
              name: "CNC 45° Pahlı Kapak Kenar Kesit İşleme",
              price: 14.0,
            },
            j_pull_bevel: {
              sku: "HW_CNC_DOOR_PROFILE_JPULL",
              name: "CNC 45° Gizli Eğimli J-Kulp Parmak Kanalı İşleme",
              price: 19.0,
            },
            cove_arch: {
              sku: "HW_CNC_DOOR_PROFILE_COVE",
              name: "5 Eksen CNC İçbükey Kavisli (Cove) Çerçeve İşleme",
              price: 21.0,
            },
            custom_cad_profile: {
              sku: "HW_CNC_DOOR_PROFILE_CUSTOM",
              name: "Özel CAD (DXF/SVG) Kapak Kesit Profili İşleme",
              price: 25.0,
            },
          };
          const spec = rateMap[prof];
          if (spec && doorAreaM2 > 0) {
            addHardware(
              spec.sku,
              spec.name,
              "special",
              Math.max(0.5, doorAreaM2),
              "metre",
              spec.price
            );
          }
        }
      });

      module.bays.forEach((bay, bIdx) => {
        if (bay.shelves.length > 0) {
          const spanMm = fourSpace.usableInternal.bayClearWidthsMm[bIdx] || 600;
          const depthMm = Math.max(120, fourSpace.usableInternal.netInnerDepthMm - 10);
          const shelfT = bay.shelves[0]?.thickness || module.carcass.panelThickness || 18;
          const matCat =
            bodyMat.category === "wood"
              ? "wood"
              : bodyMat.category === "lacquer"
              ? "lacquer"
              : bodyMat.category === "glass" || bodyMat.category === "mirror"
              ? "glass"
              : bodyMat.category === "metal"
              ? "metal"
              : "melamine";
          const defl = calculateShelfDeflection(spanMm, depthMm, shelfT, matCat, 45);
          shelfDeflectionAnalyses.push({
            moduleId: module.id,
            moduleName: module.name,
            bayIndex: bIdx,
            spanMm: defl.spanMm,
            depthMm: defl.depthMm,
            thicknessMm: defl.thicknessMm,
            deflectionMm: defl.deflectionMm,
            maxAllowedMm: defl.maxAllowedDeflectionMm,
            passed: defl.passed,
            recommendation: defl.recommendation,
          });
        }
      });
    }

    const isDishwasherSlot = isBuiltInDishwasherModule(module);
    if (isDishwasherSlot) {
      addHardware(
        "HW_STEAM_BARRIER_DIFFUSER",
        "Ankastre Bulaşık Makinesi Tezgâh Altı Buhar Bariyer Sacı",
        "special",
        1,
        "adet",
        6.5
      );
    }
    const isWetSinkOrVanity =
      isSinkModule(module) ||
      Boolean(module.templateId?.includes("bathroom")) ||
      module.name.toLowerCase().includes("banyo") ||
      module.name.toLowerCase().includes("lavabo");
    if (isWetSinkOrVanity) {
      addHardware(
        "HW_SINK_DRIP_MAT_ALU",
        "Eviye / Lavabo Alt Tabla Alüminyum Su Sızdırmaz Koruma Sacı",
        "special",
        1,
        "adet",
        14.5
      );
    }
    if (module.category !== "complementary" && !isDishwasherSlot && module.carcass.hullShape !== "capsule_table") {
      const modJoinery =
        module.carcass.carcassJoineryTopology ||
        (module.category === "kitchen_base" || module.category === "kitchen_island"
          ? "kitchen_stretchers"
          : "sides_through");
      const effBackMode =
        hasSinkOrCooktopAppliance(module) && module.name.toLowerCase().includes("eviye")
          ? "none"
          : module.carcass.backPanelType || "grooved";
      const numDividers = Math.max(0, module.bays.length - 1);
      const perJointMinifix = module.dimensions.depth > 500 ? 3 : 2;
      const perJointDowel = module.dimensions.depth < 250 ? 0 : perJointMinifix;
      const minifixCount = 4 * perJointMinifix + numDividers * 2 * perJointMinifix;
      const dowelCount = 4 * perJointDowel + numDividers * 2 * perJointDowel;
      const effJointType = module.carcass.jointType || "minifix_dowel";
      if (modJoinery === "miter_45" || effJointType === "miter_45") {
        addHardware(
          "HW_LAMELLO_CLAMEX_P14",
          "Lamello Clamex P-14 Sökülebilir 45° Gönye Bağlantı Elemanı",
          "connector",
          8 + numDividers * 4,
          "adet",
          2.1
        );
      } else if (effJointType === "confirmat") {
        addHardware(
          "HW_CONFIRMAT_7X50",
          "Konfirmat Gövde Vidası 7×50mm + Renkli Tapa",
          "connector",
          minifixCount,
          "adet",
          0.14
        );
      } else if (effJointType === "dowel_only") {
        addHardware(
          "HW_DOWEL_8X35_GLUED",
          "Ahşap Kavela 8×35mm (Tutkallı Çift Kavela Birleşim)",
          "fastener",
          Math.max(8, minifixCount * 2),
          "adet",
          0.06
        );
      } else {
        addHardware(
          "HW_MINIFIX_SET",
          "Häfele Minifix 15 + Mil Bağlantı Elemanı",
          "connector",
          minifixCount,
          "adet",
          0.45
        );
      }
      if (effBackMode === "rebated" || effBackMode === "nailed") {
        addHardware(
          "HW_BACK_SCREW_35X25",
          "Arkalık Sabitleme Vidası & Köşe Gönye Klipsi 3.5×25mm",
          "fastener",
          12,
          "adet",
          0.08
        );
      } else if (effBackMode === "flush") {
        addHardware(
          "HW_MINIFIX_SET",
          "Häfele Minifix 15 + Mil Bağlantı Elemanı",
          "connector",
          4,
          "adet",
          0.45
        );
      } else if (effBackMode === "grooved" && modJoinery === "kitchen_stretchers") {
        addHardware(
          "HW_BACK_SCREW_35X25",
          "Üst Arka Kayıt Arkalık Sabitleme Vidası 3.5×25mm",
          "fastener",
          4,
          "adet",
          0.08
        );
      }
      if (dowelCount > 0) {
        addHardware(
          "HW_DOWEL_8X35",
          "Ahşap Kavela 8x35mm",
          "fastener",
          dowelCount,
          "adet",
          0.05
        );
      }

      let totalTJunctions = 0;
      for (let divI = 0; divI < numDividers; divI++) {
        totalTJunctions += computeDividerTJunctionYs(module, divI).length;
      }
      if (totalTJunctions > 0) {
        addHardware(
          "HW_MINIFIX_DOUBLE_BOLT",
          "Häfele Çift Taraflı Ara Dikme Bağlantı Mili (T-Birleşim)",
          "connector",
          totalTJunctions * 2,
          "adet",
          0.75
        );
      }

      if (isBuiltInOvenOrFridgeTower(module)) {
        addHardware(
          "HW_VENT_GRILLE_200CM2",
          "Alüminyum Ankastre Baza Havalandırma Menfezi (Min 200cm²)",
          "special",
          1,
          "adet",
          8.5
        );
      }

      if (module.carcass.wallSuspensionType === "concealed_camar_807") {
        addHardware(
          "HW_CAMAR_807_CONCEALED",
          "Camar 807 Gizli Çelik Askı Elemanı + Duvar Rayı",
          "connector",
          2,
          "adet",
          6.8
        );
      }

      if (module.carcass.plinthHeight > 0 && !isDishwasherSlot) {
        const isWardrobeMod =
          module.category === "wardrobe" ||
          String(module.category) === "vestiyer" ||
          String(module.category) === "living" ||
          String(module.category) === "tall";
        const effPType =
          module.carcass.plinthConstruction ||
          (module.carcass.hasAdjustableLegs === false
            ? isWardrobeMod
              ? "gable_rails"
              : "pedestal_box"
            : isWardrobeMod
            ? "pedestal_box"
            : "adjustable_legs_clip");
        const supportColumns = Math.max(2, module.bays.length + 1);
        const feetCount = supportColumns * 2;
        const sealMeters = roundMm(
          (module.dimensions.width +
            (effPType !== "gable_rails" ? module.dimensions.depth * 2 : 0)) /
            1000,
          2
        );

        if (effPType === "adjustable_legs_clip") {
          addHardware(
            "637.76.331",
            `Häfele Axilo™ 78 Ayarlanabilir Baza Ayağı + Yan Destek Tablası (H:${module.carcass.plinthHeight}mm)`,
            "leg",
            feetCount,
            "adet",
            2.35
          );
          addHardware(
            "637.76.420",
            "Häfele Axilo™ Geçmeli Ön Baza C-Klips Bağlantı Aparatı",
            "connector",
            supportColumns,
            "adet",
            0.85
          );
          addHardware(
            "637.90.810",
            "Ko-Ekstrüze PVC Baza Altı Su Sızdırmazlık Contası (18mm)",
            "special",
            Math.max(1, sealMeters),
            "metre",
            2.9
          );
        } else {
          addHardware(
            "651.09.310",
            "Ağır Yük Gizli Çelik Baza Terazi Pingosu M10 + Çakma Somun",
            "leg",
            feetCount,
            "adet",
            1.45
          );
          addHardware(
            "637.90.805",
            "PVC Baza Altı Nem ve Toz Sızdırmazlık Fitili (18mm)",
            "special",
            Math.max(1, sealMeters),
            "metre",
            2.4
          );
        }
      }

      const isSuspendedWallUnit =
        module.category === "kitchen_wall" ||
        Boolean(module.templateId?.includes("floating")) ||
        ((module.position?.y || 0) >= 150 &&
          (module.carcass.plinthHeight ?? 0) === 0 &&
          String(module.category) !== "complementary" &&
          !project.modules.some(
            (bm) =>
              bm.id !== module.id &&
              String(bm.category) !== "complementary" &&
              Math.abs(bm.position.y + bm.dimensions.height - module.position.y) <= 20 &&
              bm.position.x < module.position.x + module.dimensions.width - 20 &&
              bm.position.x + bm.dimensions.width > module.position.x + 20
          ));
      if (isSuspendedWallUnit && module.carcass.wallSuspensionType !== "concealed_camar_807") {
        const volM3 =
          (module.dimensions.width * module.dimensions.height * module.dimensions.depth) / 1_000_000_000;
        const estLoadedMassKg = volM3 * 165;
        const hangerQty = Math.max(
          2,
          Math.ceil(module.dimensions.width / 900),
          Math.ceil(estLoadedMassKg / 65)
        );
        addHardware(
          "HW_WALL_HANGER_EN14749",
          "EN 14749 Ağır Yük Üst Dolap Duvar Askı Elemanı",
          "connector",
          hangerQty,
          "adet",
          4.2
        );
      }
    } else {
      if (module.complementaryRole === "leveling_feet") {
        addHardware(
          "HW_LEVELING_FEET",
          "Ayarlanabilir Baza Ayağı 80-100mm",
          "leg",
          4,
          "adet",
          1.2
        );
      } else if (module.complementaryRole === "led_channel") {
        const meters = Math.max(1, roundMm(module.dimensions.width / 1000, 2));
        addHardware(
          "HW_FITTING_LED",
          "Alüminyum Gömme LED Aydınlatma Profili (Metretül)",
          "special",
          meters,
          "metre",
          14.0
        );
      } else if (module.complementaryRole === "wall_bracket") {
        addHardware(
          "HW_WALL_HANGER_EN14749",
          "EN 14749 Ağır Yük Üst Dolap Duvar Askı Elemanı",
          "connector",
          2,
          "adet",
          4.2
        );
      } else if (module.complementaryRole === "service_spacer") {
        addHardware(
          "HW_SERVICE_SPACER",
          "Tesisat Boşluğu Ayar Aparatı",
          "connector",
          2,
          "adet",
          2.5
        );
      } else if (module.complementaryRole === "attached_table") {
        const legSt = module.attachedTableConfig?.legStyle || "metal_u_frame";
        addHardware(
          "HW_WORKTOP_CANTILEVER_PLATE",
          "Ada / Masa Çelik Konsol Ankraj Plakası + M8 Cıvata Seti",
          "connector",
          1,
          "takım",
          24.0
        );
        if (legSt === "waterfall_slab") {
          addHardware(
            "HW_MITER_BOLT_WORKTOP",
            "Şelale Masa 45° Gönye Çektirme & Lamello Clamex Bağlantı Seti",
            "connector",
            4,
            "adet",
            3.8
          );
          addHardware(
            "HW_WATERFALL_FLOOR_GLIDE",
            "Şelale Yan İniş Nem Yalıtımlı Zemin Terazi Pabucu",
            "leg",
            2,
            "adet",
            1.9
          );
        } else if (legSt === "pedestal_column") {
          addHardware(
            "HW_PEDESTAL_STEEL_COLUMN",
            "Elektrostatik Boyalı Çelik Silindirik Masa Sütun Ayağı + Flanş",
            "leg",
            1,
            "takım",
            68.0
          );
        } else {
          addHardware(
            "HW_UFRAME_STEEL_LEG",
            "50×24mm Elektrostatik Boyalı Mimari U-Profil Masa Ayağı + Terazi Pabucu",
            "leg",
            1,
            "takım",
            54.0
          );
        }
      }
    }

    const bayMechanismAdded = new Set<number>();

    totalDrillingHolesCount += appendModuleComponentCutPiecesAndHardware({ geo, addHardware, materialsMap, bodyMat, module, hasGroovedBack, fourSpace, project, doorMat, bayMechanismAdded, grainContinuityMap, validationWarnings, cutList });
    // Special Fittings hardware
    module.bays.forEach((bay) => {
      bay.specialFittings?.forEach((fit) => {
        if (fit.isHidden) return;
        if (fit.type === "trouser_rack") {
          addHardware(
            "807.95.122",
            "Häfele Teleskopik Pantolonluk Mekanizması",
            "special",
            1,
            "adet",
            38.0
          );
        } else if (fit.type === "shoe_rack") {
          addHardware(
            "807.96.310",
            "Häfele Eğimli Metal Ayakkabılık Rafı",
            "special",
            1,
            "adet",
            26.0
          );
        } else if (fit.type === "wire_basket") {
          addHardware(
            "807.52.220",
            "Frenli Raylı Tel Çamaşır Sepeti",
            "special",
            1,
            "adet",
            32.0
          );
        } else if (fit.type === "tie_rack") {
          addHardware(
            "HW_FITTING_TIE",
            "Häfele Yandan Çıkışlı Teleskopik Kravatlık",
            "special",
            1,
            "adet",
            19.5
          );
        } else if (fit.type === "belt_rack") {
          addHardware(
            "HW_FITTING_BELT",
            "Häfele Teleskopik Kemerlik Mekanizması",
            "special",
            1,
            "adet",
            21.5
          );
        } else if (
          fit.type === "led_profile" ||
          fit.type === "led_vertical_strip" ||
          fit.type === "led_rod_strip"
        ) {
          const bW = fourSpace.usableInternal.bayClearWidthsMm[bay.index] || 600;
          const nH = fourSpace.usableInternal.netInnerHeightMm || 2000;
          const ledMeters =
            fit.type === "led_vertical_strip"
              ? roundMm((2 * nH) / 1000, 2)
              : fit.type === "led_profile"
              ? roundMm(((bay.shelves.length + 1) * bW) / 1000, 2)
              : roundMm(bW / 1000, 2);
          const reqWatts = Math.ceil(ledMeters * 14.4 * 1.25);
          const driverSpec =
            reqWatts > 60
              ? {
                  sku: "833.95.003",
                  name: "Häfele Loox5 24V / 100W LED Sürücü Trafo",
                  price: 48.0,
                }
              : reqWatts > 36
              ? {
                  sku: "833.95.002",
                  name: "Häfele Loox5 24V / 60W LED Sürücü Trafo",
                  price: 34.0,
                }
              : {
                  sku: "833.95.001",
                  name: "Häfele Loox5 24V / 36W LED Sürücü Trafo",
                  price: 24.0,
                };
          const ledKelvin = module.carcass.ledColorTempK || 3000;
          const chanW = module.carcass.ledChannelWidthMm ?? 12;
          const chanD = module.carcass.ledChannelDepthMm ?? 8;
          const setbackMm =
            fit.type === "led_profile" && module.carcass.ledAlignShelfAndSide === false
              ? module.carcass.ledShelfSetbackMm ?? module.carcass.ledFrontSetbackMm ?? 75
              : module.carcass.ledFrontSetbackMm ?? 75;
          const unitPricePerMeter = Number((13.5 + chanW * 0.25).toFixed(2));
          addHardware(
            `LED.CH.${chanW}X${chanD}`,
            `Alüminyum Gömme LED Kanal (${chanW}×${chanD}mm, Önden ${setbackMm}mm CNC Freze) + ${ledKelvin}K COB LED`,
            "special",
            Math.max(1, ledMeters),
            "metre",
            unitPricePerMeter
          );
          addHardware(driverSpec.sku, driverSpec.name, "special", 1, "adet", driverSpec.price);
          addHardware(
            "833.89.142",
            "Häfele Loox5 Kapak Açıldı IR Kızılötesi Sensör Anahtarı",
            "special",
            1,
            "adet",
            14.5
          );
        } else if (fit.type === "wardrobe_lift") {
          addHardware(
            "805.20.232",
            "Servetto / Häfele Frenli Gardırop Asansörü (10kg)",
            "special",
            1,
            "adet",
            64.0
          );
        } else if (fit.type === "jewelry_tray") {
          addHardware(
            "807.88.150",
            "Kadife Bölmeli Takı & Saat Çekmece Düzenleyici",
            "special",
            1,
            "adet",
            48.0
          );
        } else if (fit.type === "corner_lemans") {
          addHardware(
            "541.32.240",
            "Kesseböhmer LeMans II Kör Köşe Mekanizması (2x25kg)",
            "special",
            1,
            "takım",
            195.0
          );
        } else if (fit.type === "pantry_pullout") {
          addHardware(
            "545.13.251",
            "Kesseböhmer Dispensa Boy Kiler Mekanizması (100kg)",
            "special",
            1,
            "takım",
            260.0
          );
        } else if (fit.type === "waste_bin") {
          addHardware(
            "502.70.252",
            "Häfele Raylı Çöp Ayrıştırma Sistemi (2x15L+30L)",
            "special",
            1,
            "takım",
            85.0
          );
        } else if (fit.type === "spice_pullout") {
          addHardware(
            "545.61.211",
            "Teleskopik Dar Modül Şişelik & Baharatlık",
            "special",
            1,
            "takım",
            42.0
          );
        } else if (fit.type === "cutlery_tray") {
          addHardware(
            "556.86.322",
            "Blum AMBIA-LINE Çatal-Kaşık Düzenleyici",
            "special",
            1,
            "adet",
            34.0
          );
        } else if (fit.type === "dish_drainer") {
          addHardware("544.11.280", "Üst Dolap İçi Alüminyum Paslanmaz Bulaşıklık + Damla Tepsisi", "special", 1, "takım", 56.0);
        } else if (fit.type === "imove_pull_down") {
          addHardware("504.68.932", "Kesseböhmer iMove Asansörlü Üst Dolap Rafı", "special", 1, "takım", 148.0);
        } else if (fit.type === "magic_corner") {
          addHardware("546.17.241", "Kesseböhmer Magic Corner Comfort Kör Köşe", "special", 1, "takım", 310.0);
        } else if (fit.type === "foldable_ironing_board") {
          addHardware("568.60.710", "Häfele IRONFIX Dolap İçi Katlanır Ütü Masası", "special", 1, "takım", 165.0);
        } else if (fit.type === "swivel_mirror") {
          addHardware("806.25.710", "Häfele Raylı 90° Döner Dolap İçi Boy Aynası", "special", 1, "adet", 112.0);
        }
      });
    });

    // Attached Island/Countertop Table Structural Hardware (Cantilever Steel Flange + Support Leg + Worktop Bolts)
    if (module.complementaryRole === "attached_table" && module.attachedTableConfig) {
      addHardware(
        "HW_TABLE_CANTILEVER_FLANGE",
        "Ağır Hizmet Ada/Tezgâh Çelik Konsol Bağlantı Plakası + 2×Gizli Çektirme Mili",
        "connector",
        1,
        "takım",
        34.0
      );
      const legStyle = module.attachedTableConfig.legStyle || "metal_u_frame";
      if (legStyle === "metal_u_frame") {
        addHardware(
          "HW_TABLE_LEG_U_FRAME",
          "Elektrostatik Mat Siyah Çelik U-Profil Masa Ayağı (50×25mm Kutu Profil)",
          "leg",
          1,
          "adet",
          58.0
        );
      } else if (legStyle === "pedestal_column") {
        addHardware(
          "HW_TABLE_PEDESTAL_COL",
          "Silindirik Çelik Sütun Masa Ayağı + Ağır Taban Flanşı",
          "leg",
          1,
          "adet",
          74.0
        );
      } else {
        addHardware(
          "HW_WATERFALL_MITER_DOWEL_SET",
          "Şelale Yan İniş 45° Lamello Clamex P-14 & Ayarlı Zemin Pabucu Seti",
          "connector",
          1,
          "takım",
          22.0
        );
      }
    }

    const hasExplicitLedFit = module.bays.some((b) =>
      (b.specialFittings || []).some((f) => !f.isHidden && f.type.startsWith("led_"))
    );
    if (module.carcass.ledLightingEnabled && !hasExplicitLedFit) {
      const netH = fourSpace.usableInternal.netInnerHeightMm || 2000;
      const totShelfMeters = module.bays.reduce((acc, b, idx) => {
        const bw = fourSpace.usableInternal.bayClearWidthsMm[idx] || 600;
        return acc + ((b.shelves.length + 1) * bw) / 1000;
      }, 0);
      const mode = module.carcass.ledPlacementMode || "full_showcase";
      const ledMeters = roundMm(
        mode === "vertical_sides"
          ? (module.bays.length * 2 * netH) / 1000
          : mode === "full_showcase"
          ? (module.bays.length * 2 * netH) / 1000 + totShelfMeters
          : totShelfMeters,
        2
      );
      const reqWatts = Math.ceil(ledMeters * 14.4 * 1.2);
      const driverSpec =
        reqWatts > 100
          ? { sku: "833.95.004", name: "Häfele Loox5 24V / 150W İnce LED Trafo", price: 64.0 }
          : reqWatts > 60
          ? { sku: "833.95.003", name: "Häfele Loox5 24V / 100W İnce LED Trafo", price: 48.0 }
          : reqWatts > 36
          ? { sku: "833.95.002", name: "Häfele Loox5 24V / 60W İnce LED Trafo", price: 34.0 }
          : { sku: "833.95.001", name: "Häfele Loox5 24V / 36W İnce LED Trafo", price: 24.0 };
      const chanW = module.carcass.ledChannelWidthMm ?? 12;
      const chanD = module.carcass.ledChannelDepthMm ?? 8;
      addHardware(
        `LED.CH.${chanW}X${chanD}`,
        `Alüminyum Gömme LED Kanal (${chanW}×${chanD}mm) + ${module.carcass.ledColorTempK || 3000}K Şerit LED`,
        "special",
        Math.max(1, ledMeters),
        "metre",
        15.5
      );
      addHardware(driverSpec.sku, driverSpec.name, "special", 1, "adet", driverSpec.price);
      const sensorType = module.carcass.ledSensorType || "ir_door";
      addHardware(
        sensorType === "pir_motion" ? "833.89.145" : "833.89.142",
        sensorType === "pir_motion"
          ? "Häfele Loox5 PIR Hareket Sensörü + 6'lı Dağıtıcı"
          : "Häfele Loox5 Kapak Açılım IR Sensörü + 6'lı Dağıtıcı",
        "special",
        1,
        "adet",
        16.5
      );
    }

    activeModuleHardwareSink = null; setActiveHardwareSink(null);
    if (sliceCacheKey) {
      moduleBomSliceCache.set(sliceCacheKey, {
        cutPieces: cutList.slice(sliceCutStart),
        hardwareCalls: recordedHwCalls,
        shelfDeflections: shelfDeflectionAnalyses.slice(sliceDeflStart),
        warnings: validationWarnings.slice(sliceWarnStart),
        drillingHolesDelta: totalDrillingHolesCount - sliceDrillStart,
        dimChainClosed: prevDimChainClosed ? allDimensionChainsClosed : true,
      });
    }
  });
  void activeModuleHardwareSink;
  return { totalDrillingHolesCount, allDimensionChainsClosed };
}
