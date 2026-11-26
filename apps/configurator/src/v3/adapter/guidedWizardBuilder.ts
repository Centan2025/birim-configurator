import {
  DEFAULT_MATERIALS,
  calculateBayWidths,
  computeSlidingSafeBayCustomWidths,
  createDefaultWardrobeModule,
  type DesignProject,
  type HandleCategory,
  type ModuleInstance,
} from "@birim/core";
import { KITCHEN_TEMPLATES, WARDROBE_TEMPLATES, getV4TemplateById, createSceneObjectInstanceFromCatalog } from "@birim/catalog";
import { generateBOMForProject } from "@birim/manufacturing";
import { calculateProjectPrice } from "@birim/pricing";

export interface GuidedWizardLayoutInput {
  spaceCategory: "wardrobe" | "walkin" | "kitchen" | "living";
  roomShape: "rectangular" | "l_shape" | "u_shape";
  wallWidthMm: number;
  targetHeightMm: number;
  targetDepthMm: number;
  autoFiller50Mm: boolean;
  interiorFocus: "hanging" | "balanced" | "shelves";
  doorStyle: "hinged" | "sliding" | "glass" | "open";
  conceptTier: "eco" | "smart" | "signature";
  colorSwatchId?: string;
  addLed: boolean;
  addTrouserRack: boolean;
  addJewelryTray: boolean;
  kitchenGripSystem?: "gola_profile" | "gola_melamine_box" | "bevel_backing" | "j_pull" | "bar_handle" | "push_to_open";
  kitchenWallOpening?: "lift_bi_fold" | "lift_up_stay" | "lift_parallel" | "hinged";
}

/**
 * Pure builder for the Guided Wardrobe / Kitchen Setup Wizard.
 * Guarantees sliding wardrobes use internal drawers, dead-zone-safe bay widths,
 * central pull-out zones on 3-door layouts, valid runner depths, and valid L/U wings.
 */
export function buildGuidedWizardProject(
  curProj: DesignProject,
  wiz: GuidedWizardLayoutInput
): DesignProject {
  const safeWallW = Math.max(1200, Math.min(6000, Math.round(wiz.wallWidthMm)));
  const fillerEach = wiz.autoFiller50Mm && safeWallW >= 1400 ? 50 : 0;
  const usableSpan = Math.max(800, safeWallW - fillerEach * 2);

  const effectiveDoorStyle: "hinged" | "sliding" | "glass" | "open" =
    wiz.spaceCategory === "walkin"
      ? "open"
      : wiz.spaceCategory === "kitchen"
      ? wiz.doorStyle === "glass"
        ? "glass"
        : "hinged"
      : wiz.doorStyle === "sliding" && usableSpan < 1200
      ? "hinged"
      : wiz.doorStyle;

  const effHeight =
    wiz.spaceCategory === "kitchen"
      ? 870
      : Math.max(1800, Math.min(2700, Math.round(wiz.targetHeightMm)));
  const effDepth =
    effectiveDoorStyle === "sliding"
      ? Math.max(600, Math.min(700, Math.round(wiz.targetDepthMm)))
      : wiz.spaceCategory === "kitchen"
      ? 580
      : Math.max(450, Math.min(700, Math.round(wiz.targetDepthMm)));
  const ceilH = Math.max(2550, effHeight + 150);

  const swatchMatMap: Record<string, { body: string; door: string }> = {
    cashmere: { body: "mat_veneer_oak", door: "mat_ye_kasmir_gri" },
    white: { body: "mat_melamine_white", door: "mat_melamine_white" },
    oak: { body: "mat_ke_safir_mese", door: "mat_veneer_oak" },
    walnut: { body: "mat_ke_mattplus_vizon", door: "mat_veneer_walnut" },
    anthracite: { body: "mat_melamine_anthracite", door: "mat_ke_d143_antrasit" },
  };
  const directMat = wiz.colorSwatchId
    ? DEFAULT_MATERIALS.find((dm) => dm.id === wiz.colorSwatchId)
    : undefined;
  const chosenMats = directMat
    ? {
        body: directMat.category === "glass" ? "mat_veneer_oak" : directMat.id,
        door: directMat.id,
      }
    : (wiz.colorSwatchId && swatchMatMap[wiz.colorSwatchId]) ||
      (wiz.conceptTier === "eco"
        ? swatchMatMap.white
        : wiz.conceptTier === "signature"
        ? swatchMatMap.walnut
        : swatchMatMap.cashmere);

  // Gerçek I-Tipi (Düz), L-Tipi (Köşe) ve U-Tipi (Üç Duvar) Mutfak Yerleşimi:
  // Alt + Üst dolaplar, 90° L-köşe, Gola üstten/alttan el sokmalı kulpsuz sistem, 45° J-Kulp ve Blum AVENTOS kalkar kapaklar
  if (wiz.spaceCategory === "kitchen") {
    const isU = wiz.roomShape === "u_shape";
    const isL = wiz.roomShape === "l_shape";
    const isStraight = !isU && !isL;
    const cornerSize = 900;
    const minBackW = isU ? 2600 : isL ? 2100 : 1400;
    const kitchenBackW = Math.max(minBackW, safeWallW);
    const kitchenDepth = 580;
    const gripSystem = wiz.kitchenGripSystem || "gola_profile";
    const wallOpening = wiz.kitchenWallOpening || "lift_bi_fold";
    const baseH = 870;
    const wallCabY = 1450;
    // Blum AVENTOS HK top maksimum 600mm (<=650mm), HL 540mm, HF ve menteşeli 720mm yükseklik gerektirir
    const wallCabH =
      wallOpening === "lift_up_stay"
        ? 560
        : wallOpening === "lift_parallel"
        ? 540
        : 720;
    const wallCabD = 350;
    const kitchenCeilH = Math.max(2650, wallCabY + wallCabH + 320);
    const armLen = Math.max(800, Math.min(1200, Math.round((kitchenBackW * 0.35) / 100) * 100));
    const returnWallLenK = Math.max(2100, cornerSize + armLen + 200);
    const tsK = Date.now() + Math.floor(Math.random() * 10000);
    const kModules: ModuleInstance[] = [];

    // J-Pull (45° pahlı) kapaklar mühendislik gereği >=19mm (22mm) ve Lake/Ahşap Kaplama malzeme gerektirir
    const chosenDoorMatObj = DEFAULT_MATERIALS.find((dm) => dm.id === chosenMats.door);
    const isJpullCompatibleMat =
      chosenDoorMatObj &&
      (chosenDoorMatObj.category === "lacquer" || chosenDoorMatObj.category === "wood");
    const safeKitchenDoorMatId =
      gripSystem === "j_pull" && !isJpullCompatibleMat ? "mat_lacquer_cream" : chosenMats.door;
    const safeKitchenDoorThick = gripSystem === "j_pull" ? 22 : 18;
    const isGolaVariant =
      gripSystem === "gola_profile" ||
      gripSystem === "gola_melamine_box" ||
      gripSystem === "bevel_backing";
    const baseHandleCat: HandleCategory = isGolaVariant
      ? "gola_profile"
      : gripSystem === "j_pull"
      ? "j_pull"
      : gripSystem === "push_to_open"
      ? "handleless_plain"
      : "bar_handle";
    const baseHandleProfileId =
      gripSystem === "gola_profile"
        ? "hnd_gola_profile"
        : gripSystem === "gola_melamine_box"
        ? "hnd_gola_melamine_box"
        : gripSystem === "bevel_backing"
        ? "hnd_bevel_30_backing"
        : gripSystem === "j_pull"
        ? "hnd_j_pull"
        : gripSystem === "push_to_open"
        ? "hnd_none"
        : "hnd_bar_160";
    const wallHandleProfileId =
      gripSystem === "gola_profile"
        ? "hnd_gola_wall_268"
        : gripSystem === "gola_melamine_box" || gripSystem === "bevel_backing"
        ? "hnd_overhang_recessed_lip"
        : baseHandleProfileId;
    const openingTech =
      gripSystem === "push_to_open" ? ("push_to_open" as const) : ("soft_close" as const);

    const applyKitchenStyle = (m: ModuleInstance, isWall = false) => {
      const isGlassWall = isWall && wiz.doorStyle === "glass";
      m.carcass = {
        ...m.carcass,
        wallAnchored: true,
        bodyMaterialId: chosenMats.body,
        doorMaterialId: isGlassWall ? "mat_smoked_glass" : safeKitchenDoorMatId,
        plinthMaterialId: chosenMats.body,
        doorThickness: safeKitchenDoorThick,
        plinthHeight: isWall ? 0 : 100,
        ledLightingEnabled: wiz.addLed && isWall,
        ledColorTempK: 3000,
      };
      m.bays = (m.bays || []).map((b, bIdx) => {
        const nextWallDoorType =
          wallOpening === "lift_bi_fold"
            ? ("lift_bi_fold" as const)
            : wallOpening === "lift_up_stay"
            ? ("lift_up_stay" as const)
            : wallOpening === "lift_parallel"
            ? ("lift_parallel" as const)
            : m.dimensions.width >= 700
            ? ("double" as const)
            : ("single_left" as const);
        const nextWallDoorSys =
          wallOpening === "lift_bi_fold"
            ? ("lift_bi_fold" as const)
            : wallOpening === "lift_up_stay"
            ? ("lift_up_stay" as const)
            : wallOpening === "lift_parallel"
            ? ("lift_parallel" as const)
            : m.dimensions.width >= 700
            ? ("hinged_double" as const)
            : ("hinged_single" as const);
        const wallLiftHwId =
          wallOpening === "lift_bi_fold"
            ? "hw_blum_aventos_hf_25"
            : wallOpening === "lift_parallel"
            ? "hw_blum_aventos_hl_25"
            : wallOpening === "lift_up_stay"
            ? "hw_blum_aventos_hk_27"
            : "hw_blum_71b3550";

        return {
          ...b,
          index: bIdx,
          door: {
            ...b.door,
            id: `door_${m.id}_${bIdx}`,
            bayIndex: bIdx,
            type: b.door?.type || "single_left",
            ...(isWall
              ? {
                  type: nextWallDoorType,
                  doorSystemId: nextWallDoorSys,
                  hardwareProductId: wallLiftHwId,
                }
              : {}),
            doorMaterialId: isGlassWall ? "mat_smoked_glass" : safeKitchenDoorMatId,
            isGlassFramed: isGlassWall,
            crossSectionProfile: isGlassWall
              ? ("glass_frame" as const)
              : gripSystem === "j_pull"
              ? ("j_pull_bevel" as const)
              : ("flat_slab" as const),
            handleCategory: baseHandleCat,
            handleProfileId: isWall ? wallHandleProfileId : baseHandleProfileId,
            handleType:
              gripSystem === "push_to_open"
                ? ("push_to_open" as const)
                : isGolaVariant || gripSystem === "j_pull"
                ? ("none" as const)
                : ("standard" as const),
            openingTechnology: openingTech,
            softClose: true,
          },
        };
      });
      return m;
    };

    const makeBaseCorner = (id: string, name: string, posX: number, rotY: number) => {
      const baseTpl =
        KITCHEN_TEMPLATES.find((t) => t.templateId === "tpl_kitchen_base_standard") ||
        getV4TemplateById("tpl_kb_02_double_door") ||
        WARDROBE_TEMPLATES[0];
      const m = baseTpl.createInstance(id, name);
      m.templateId = "tpl_kb_14_l_corner";
      m.category = "kitchen_corner";
      m.moduleFamilyId = "fam_kitchen_base";
      m.isCorner = true;
      m.cornerAngleDeg = 90;
      m.dimensions = { width: cornerSize, height: baseH, depth: cornerSize };
      m.position = { x: posX, y: 0, z: 0 };
      m.rotation = { x: 0, y: rotY, z: 0 };
      if (m.bays[0]?.door) {
        m.bays[0].door.type = "folding";
        m.bays[0].door.doorSystemId = "folding_side";
      }
      return applyKitchenStyle(m, false);
    };

    // 1. Sol 90° L-Köşe Alt Dolabı (L ve U mutfaklarda)
    if (isL || isU) {
      kModules.push(makeBaseCorner(`mod_wiz_k_cl_${tsK}`, "Sol 90° L-Köşe Alt Dolabı", 0, 0));
    }

    // 2. Arka Duvar Alt Dolapları
    const startX = isL || isU ? cornerSize : 0;
    const middleSpan = kitchenBackW - (isU ? cornerSize * 2 : isL ? cornerSize : 0);
    const midCount = isStraight
      ? middleSpan < 1600
        ? 2
        : middleSpan < 2600
        ? 3
        : 4
      : middleSpan >= 1400
      ? 2
      : 1;
    const midUnitW = Math.floor(middleSpan / midCount / 10) * 10;
    const midRem = middleSpan - midUnitW * midCount;
    let midX = startX;
    for (let i = 0; i < midCount; i++) {
      const w = i === midCount - 1 ? midUnitW + midRem : midUnitW;
      const preferDrawers = wiz.interiorFocus === "shelves";
      const tpl =
        i === 0
          ? KITCHEN_TEMPLATES.find((t) => t.templateId === "tpl_kitchen_base_sink") ||
            getV4TemplateById("tpl_kb_08_sink_base")
          : preferDrawers || i === 1
          ? KITCHEN_TEMPLATES.find((t) => t.templateId === "tpl_kitchen_base_drawers") ||
            getV4TemplateById("tpl_kb_05_three_drawers")
          : KITCHEN_TEMPLATES.find((t) => t.templateId === "tpl_kitchen_base_standard") ||
            getV4TemplateById("tpl_kb_02_double_door");
      const title =
        i === 0
          ? "Evye Alt Dolabı"
          : preferDrawers || i === 1
          ? `Çekmeceli Alt Dolap #${i}`
          : `Hazırlık Alt Dolabı #${i}`;
      const m = (tpl || WARDROBE_TEMPLATES[0]).createInstance(`mod_wiz_k_mid_${tsK}_${i + 1}`, title);
      m.dimensions = { width: w, height: baseH, depth: kitchenDepth };
      m.position = { x: midX, y: 0, z: 0 };
      m.rotation = { x: 0, y: 0, z: 0 };
      kModules.push(applyKitchenStyle(m, false));
      midX += w;
    }

    // 3. Sağ 90° L-Köşe Alt Dolabı (yalnızca U-Tipi)
    if (isU) {
      kModules.push(
        makeBaseCorner(
          `mod_wiz_k_cr_${tsK}`,
          "Sağ 90° L-Köşe Alt Dolabı",
          kitchenBackW - cornerSize,
          270
        )
      );
    }

    // 4. Sol Dönüş Kolu Alt Dolabı (L ve U mutfaklarda)
    if (isL || isU) {
      const leftArmTpl =
        KITCHEN_TEMPLATES.find((t) => t.templateId === "tpl_kitchen_base_drawers") ||
        getV4TemplateById("tpl_kb_05_three_drawers") ||
        WARDROBE_TEMPLATES[0];
      const leftArm = leftArmTpl.createInstance(`mod_wiz_k_arm_l_${tsK}`, "Sol Kol Çekmeceli Alt Dolap");
      leftArm.isCorner = false;
      leftArm.dimensions = { width: armLen, height: baseH, depth: kitchenDepth };
      leftArm.position = { x: 0, y: 0, z: cornerSize };
      leftArm.rotation = { x: 0, y: 90, z: 0 };
      kModules.push(applyKitchenStyle(leftArm, false));
    }

    // 5. Sağ Dönüş Kolu Alt Dolabı (yalnızca U-Tipi)
    if (isU) {
      const rightArmTpl =
        KITCHEN_TEMPLATES.find((t) => t.templateId === "tpl_kitchen_base_standard") ||
        getV4TemplateById("tpl_kb_02_double_door") ||
        WARDROBE_TEMPLATES[0];
      const rightArm = rightArmTpl.createInstance(`mod_wiz_k_arm_r_${tsK}`, "Sağ Kol Hazırlık Alt Dolabı");
      rightArm.isCorner = false;
      rightArm.dimensions = { width: armLen, height: baseH, depth: kitchenDepth };
      rightArm.position = { x: kitchenBackW - kitchenDepth, y: 0, z: cornerSize };
      rightArm.rotation = { x: 0, y: 270, z: 0 };
      kModules.push(applyKitchenStyle(rightArm, false));
    }

    // 6. Üst Duvar Dolapları (I, L ve U mutfakların TÜMÜNDE!)
    const wallTpl =
      KITCHEN_TEMPLATES.find((t) => t.templateId === "tpl_kitchen_wall_standard") ||
      getV4TemplateById("tpl_kw_01_single_wall");
    if (wallTpl) {
      const backWallStart = isStraight ? 0 : 600;
      const backWallSpan = isStraight
        ? kitchenBackW
        : Math.max(600, kitchenBackW - (isU ? 1200 : 600));
      const maxWallModW = wallOpening === "lift_up_stay" || wallOpening === "lift_parallel" ? 850 : 1000;
      const wCount = Math.max(isStraight ? 2 : 1, Math.ceil(backWallSpan / maxWallModW));
      const wUnitW = Math.floor(backWallSpan / wCount / 10) * 10;
      const wRem = backWallSpan - wUnitW * wCount;
      let curWX = backWallStart;
      for (let i = 0; i < wCount; i++) {
        const ww = i === wCount - 1 ? wUnitW + wRem : wUnitW;
        const wm = wallTpl.createInstance(`mod_wiz_k_wback_${tsK}_${i + 1}`, `Üst Dolap #${i + 1}`);
        wm.dimensions = { width: ww, height: wallCabH, depth: wallCabD };
        wm.position = { x: curWX, y: wallCabY, z: 0 };
        wm.rotation = { x: 0, y: 0, z: 0 };
        kModules.push(applyKitchenStyle(wm, true));
        curWX += ww;
      }

      if (isL || isU) {
        const wLeft = wallTpl.createInstance(`mod_wiz_k_wleft_${tsK}`, "Sol Kol Üst Dolap");
        wLeft.dimensions = { width: Math.min(800, armLen), height: wallCabH, depth: wallCabD };
        wLeft.position = { x: 0, y: wallCabY, z: cornerSize };
        wLeft.rotation = { x: 0, y: 90, z: 0 };
        kModules.push(applyKitchenStyle(wLeft, true));
      }

      if (isU) {
        const wRight = wallTpl.createInstance(`mod_wiz_k_wright_${tsK}`, "Sağ Kol Üst Dolap");
        wRight.dimensions = { width: Math.min(800, armLen), height: wallCabH, depth: wallCabD };
        wRight.position = { x: kitchenBackW - wallCabD, y: wallCabY, z: cornerSize };
        wRight.rotation = { x: 0, y: 270, z: 0 };
        kModules.push(applyKitchenStyle(wRight, true));
      }
    }

    const kWalls = [
      {
        id: "wall_main",
        name: "Ana Mutfak Duvarı",
        length: kitchenBackW,
        height: kitchenCeilH,
        thickness: 150,
        position: { x: 0, y: 0, z: 0 },
        rotationY: 0,
        elements: [],
      },
      ...(isL || isU
        ? [
            {
              id: "wall_left_return",
              name: "Sol Yan Duvar",
              length: returnWallLenK,
              height: kitchenCeilH,
              thickness: 150,
              position: { x: 0, y: 0, z: 0 },
              rotationY: 90,
              elements: [],
            },
          ]
        : []),
      ...(isU
        ? [
            {
              id: "wall_right_return",
              name: "Sağ Yan Duvar",
              length: returnWallLenK,
              height: kitchenCeilH,
              thickness: 150,
              position: { x: kitchenBackW, y: 0, z: 0 },
              rotationY: 90,
              elements: [],
            },
          ]
        : []),
    ];

    return {
      ...curProj,
      version: (curProj.version || 1) + 1,
      updatedAt: new Date().toISOString(),
      space: {
        ...curProj.space,
        type: isU ? ("kitchen_u" as const) : isL ? ("kitchen_l" as const) : ("kitchen_straight" as const),
        ceilingHeight: kitchenCeilH,
        walls: kWalls,
        elements: [],
        wizardCleanRoom: true,
      } as typeof curProj.space,
      modules: kModules,
      sceneObjects: [],
    };
  }

  // Gerçek Salon TV Duvarı / Vitrin / Oturmalı Vestiyer Yerleşimi (I-Tipi, L-Tipi, U-Tipi):
  if (wiz.spaceCategory === "living") {
    const isU = wiz.roomShape === "u_shape";
    const isL = wiz.roomShape === "l_shape";
    const isVestiyer = wiz.interiorFocus === "hanging";
    const isGlassTower = effectiveDoorStyle === "glass";
    const isOpenTower = effectiveDoorStyle === "open";
    const livingDepth = Math.max(380, Math.min(520, effDepth));
    const benchDepth = Math.min(480, livingDepth);
    const towerDepth = Math.min(420, livingDepth);
    const upperDepth = 350;
    const benchH = 460;
    const upperH = 400;
    const upperY = Math.max(1780, effHeight - upperH);
    const tsL = Date.now() + Math.floor(Math.random() * 10000);
    const lModules: ModuleInstance[] = [];
    const lSceneObjects: NonNullable<DesignProject["sceneObjects"]> = [];

    // Width distribution: Left Tower + Center Bench/TV + Right Tower
    const hasTwoTowers = usableSpan >= 1800;
    const towerW = hasTwoTowers
      ? Math.max(450, Math.min(800, Math.round((usableSpan * 0.25) / 50) * 50))
      : Math.max(450, Math.min(650, Math.round((usableSpan * 0.35) / 50) * 50));
    const centerW = hasTwoTowers
      ? Math.max(900, usableSpan - towerW * 2)
      : Math.max(800, usableSpan - towerW);

    const baseTpl = WARDROBE_TEMPLATES[0];

    const makeTallTower = (
      id: string,
      title: string,
      posX: number,
      posZ: number,
      rotY: number,
      wMm: number
    ): ModuleInstance => {
      const m = baseTpl ? baseTpl.createInstance(id, title) : createDefaultWardrobeModule(id);
      m.name = title;
      m.moduleSubType = isVestiyer ? "vestiyer_tower" : isOpenTower ? "tv_bookcase" : "tv_vitrine";
      m.dimensions = { width: wMm, height: effHeight, depth: towerDepth };
      m.position = { x: posX, y: 0, z: posZ };
      m.rotation = { x: 0, y: rotY, z: 0 };
      m.isOpenFront = isOpenTower;
      const T = m.carcass.panelThickness || 18;
      const plinthH = 80;
      const netH = Math.max(600, effHeight - plinthH - 2 * T);
      m.carcass = {
        ...m.carcass,
        wallAnchored: true,
        plinthHeight: plinthH,
        bodyMaterialId: chosenMats.body,
        doorMaterialId: isGlassTower ? "mat_smoked_glass" : chosenMats.door,
        crossSectionProfile: isGlassTower ? "glass_frame" : "flat_slab",
        ledLightingEnabled: wiz.addLed,
        ledColorTempK: 3000,
      };
      const bay0 = JSON.parse(JSON.stringify(m.bays[0]));
      const nextFittings: typeof bay0.specialFittings = wiz.addLed
        ? [
            {
              id: `fit_led_${id}_0`,
              bayIndex: 0,
              elevationY: Math.max(400, netH - 48),
              type: "led_profile",
              height: 20,
            },
          ]
        : [];
      const doorType = isOpenTower
        ? ("open" as const)
        : wMm >= 650
        ? ("double" as const)
        : posX <= fillerEach + 50
        ? ("single_left" as const)
        : ("single_right" as const);
      const doorSys =
        doorType === "open"
          ? ("open" as const)
          : doorType === "double"
          ? ("hinged_double" as const)
          : ("hinged_single" as const);

      const stepY = Math.floor(netH / 5 / 32) * 32;
      const shelves = isVestiyer
        ? [
            {
              id: `sh_${id}_top`,
              bayIndex: 0,
              elevationY: Math.round((netH - 340) / 32) * 32,
              isAdjustable: false,
              thickness: 18,
            },
            {
              id: `sh_${id}_shoe`,
              bayIndex: 0,
              elevationY: 256,
              isAdjustable: true,
              thickness: 18,
            },
          ]
        : [1, 2, 3, 4]
            .map((k) => ({
              id: `sh_${id}_${k}`,
              bayIndex: 0,
              elevationY: Math.max(288, stepY * k),
              isAdjustable: k !== 2,
              thickness: 18,
            }))
            .filter((s) => s.elevationY < netH - 140);

      const rails = isVestiyer
        ? [
            {
              id: `rl_${id}_coat`,
              bayIndex: 0,
              elevationY: Math.max(900, Math.round((netH - 404) / 32) * 32),
            },
          ]
        : [];

      m.bays = [
        {
          ...bay0,
          index: 0,
          customWidth: undefined,
          shelves,
          hangingRails: rails,
          drawers: [],
          specialFittings: nextFittings,
          door: {
            ...bay0.door,
            id: `door_${id}_0`,
            bayIndex: 0,
            type: doorType,
            doorSystemId: doorSys,
            handleCategory: isOpenTower ? "handleless_plain" : "bar_handle",
            handleProfileId: isOpenTower ? undefined : "K019",
            hardwareProductId: "hw_blum_71b3550",
            doorMaterialId: isGlassTower ? "mat_smoked_glass" : chosenMats.door,
            isGlassFramed: isGlassTower,
            crossSectionProfile: isGlassTower ? "glass_frame" : "flat_slab",
            softClose: true,
          },
        },
      ];
      return m;
    };

    // 1. Left Tall Tower (Vitrine / Bookcase / Coat Closet)
    const leftX = fillerEach;
    lModules.push(
      makeTallTower(
        `mod_liv_l_${tsL}`,
        isVestiyer
          ? "Vestiyer Portmanto Kulesi"
          : isGlassTower
          ? "Sol Füme Cam Vitrin"
          : isOpenTower
          ? "Sol Açık Kitaplık"
          : "Sol Depolama Kulesi",
        leftX,
        0,
        0,
        towerW
      )
    );

    // 2 & 3. Center Low TV Bench + Upper Bridge — Auto-split into <=2200mm manufacturable carcasses (zero 2770mm sheet or 1150mm drawer errors!)
    const centerX = leftX + towerW;
    const centerModCount = Math.max(1, Math.ceil(centerW / 2200));
    let curCenterX = centerX;
    for (let cIdx = 0; cIdx < centerModCount; cIdx++) {
      const thisCenterW =
        cIdx === centerModCount - 1
          ? centerX + centerW - curCenterX
          : Math.round(centerW / centerModCount / 10) * 10;
      const suffix = centerModCount > 1 ? ` #${cIdx + 1}` : "";

      const benchId = `mod_liv_bench_${tsL}_${cIdx + 1}`;
      const benchMod = baseTpl
        ? baseTpl.createInstance(benchId, `${isVestiyer ? "Oturmalı Vestiyer Bankı" : "TV Medya Konsolu"}${suffix}`)
        : createDefaultWardrobeModule(benchId);
      benchMod.name = `${isVestiyer ? "Oturmalı Vestiyer Bankı" : "TV Medya Konsolu"}${suffix}`;
      benchMod.moduleSubType = isVestiyer ? "vestiyer_bench" : "tv_bench";
      benchMod.dimensions = { width: thisCenterW, height: benchH, depth: benchDepth };
      benchMod.position = { x: curCenterX, y: 0, z: 0 };
      benchMod.rotation = { x: 0, y: 0, z: 0 };
      benchMod.isOpenFront = true;
      benchMod.carcass = {
        ...benchMod.carcass,
        wallAnchored: true,
        plinthHeight: 60,
        bodyMaterialId: chosenMats.body,
        doorMaterialId: chosenMats.door,
        crossSectionProfile: "flat_slab",
        ledLightingEnabled: false,
      };
      // Guarantee every drawer bay <= 850mm (well within 1150mm soft-close runner engineering limit)
      const benchBayCount = Math.max(2, Math.ceil(thisCenterW / 850));
      const bRef = JSON.parse(JSON.stringify(benchMod.bays[0]));
      benchMod.bays = Array.from({ length: benchBayCount }).map((_, bIdx) => ({
        ...bRef,
        index: bIdx,
        customWidth: undefined,
        shelves: [],
        hangingRails: [],
        specialFittings: [],
        drawers: [
          {
            id: `drw_liv_${tsL}_${cIdx}_${bIdx}`,
            bayIndex: bIdx,
            height: 320,
            elevationY: 0,
            slideType: "soft_close" as const,
            frontMaterialId: chosenMats.door,
          },
        ],
        door: {
          ...bRef.door,
          id: `door_liv_bench_${tsL}_${cIdx}_${bIdx}`,
          bayIndex: bIdx,
          type: "open" as const,
          doorSystemId: "open" as const,
          handleCategory: "handleless_plain" as const,
          softClose: true,
        },
      }));
      lModules.push(benchMod);

      const bridgeId = `mod_liv_top_${tsL}_${cIdx + 1}`;
      const bridgeMod = baseTpl
        ? baseTpl.createInstance(bridgeId, `${isVestiyer ? "Üst Vestiyer Köprü Dolabı" : "TV Üst Köprü Dolabı"}${suffix}`)
        : createDefaultWardrobeModule(bridgeId);
      bridgeMod.name = `${isVestiyer ? "Üst Vestiyer Köprü Dolabı" : "TV Üst Köprü Dolabı"}${suffix}`;
      bridgeMod.moduleSubType = isVestiyer ? "vestiyer_bridge" : "tv_bridge";
      bridgeMod.dimensions = { width: thisCenterW, height: upperH, depth: upperDepth };
      bridgeMod.position = { x: curCenterX, y: upperY, z: 0 };
      bridgeMod.rotation = { x: 0, y: 0, z: 0 };
      bridgeMod.isOpenFront = false;
      bridgeMod.carcass = {
        ...bridgeMod.carcass,
        wallAnchored: true,
        plinthHeight: 0,
        bodyMaterialId: chosenMats.body,
        doorMaterialId: chosenMats.door,
        crossSectionProfile: "flat_slab",
        ledLightingEnabled: wiz.addLed,
        ledColorTempK: 3000,
      };
      // Guarantee every double-door leaf <= 550mm (bay <= 1100mm)
      const brBayCount = Math.max(1, Math.ceil(thisCenterW / 1100));
      const brRef = JSON.parse(JSON.stringify(bridgeMod.bays[0]));
      bridgeMod.bays = Array.from({ length: brBayCount }).map((_, bIdx) => ({
        ...brRef,
        index: bIdx,
        customWidth: undefined,
        shelves: [],
        hangingRails: [],
        drawers: [],
        specialFittings: [],
        door: {
          ...brRef.door,
          id: `door_liv_top_${tsL}_${cIdx}_${bIdx}`,
          bayIndex: bIdx,
          type: "double" as const,
          doorSystemId: "hinged_double" as const,
          handleCategory: "handleless_plain" as const,
          openingTechnology: "push_to_open" as const,
          hardwareProductId: "hw_blum_71b3550",
          doorMaterialId: chosenMats.door,
          isGlassFramed: false,
          crossSectionProfile: "flat_slab" as const,
          softClose: true,
        },
      }));
      lModules.push(bridgeMod);

      curCenterX += thisCenterW;
    }

    // 4. Right Tall Tower (when wide enough)
    if (hasTwoTowers) {
      lModules.push(
        makeTallTower(
          `mod_liv_r_${tsL}`,
          isVestiyer
            ? "Sağ Ayakkabı & Depolama Kulesi"
            : isGlassTower
            ? "Sağ Füme Cam Vitrin"
            : isOpenTower
            ? "Sağ Açık Kitaplık"
            : "Sağ Depolama Kulesi",
          centerX + centerW,
          0,
          0,
          towerW
        )
      );
    }

    // 5. Mounted 65" OLED TV centered above the TV bench (for TV layouts, not Vestiyer)
    if (!isVestiyer) {
      const tvObj = createSceneObjectInstanceFromCatalog("obj_wall_tv_65", {
        position: {
          x: Math.max(centerX + 20, Math.round(centerX + (centerW - 1450) / 2)),
          y: Math.min(upperY - 880, benchH + 280),
          z: 20,
        },
      });
      if (tvObj) {
        if (centerW < 1500) {
          const fitTvW = Math.max(900, centerW - 100);
          tvObj.dimensions = {
            ...tvObj.dimensions,
            width: fitTvW,
            height: Math.round(fitTvW * 0.57),
          };
          tvObj.position.x = Math.round(centerX + (centerW - fitTvW) / 2);
          tvObj.position.y = Math.round(benchH + Math.max(180, (upperY - benchH - tvObj.dimensions.height) / 2));
        }
        lSceneObjects.push(tvObj);
      }
    }

    // 6. Optional L-Shape / U-Shape 90-degree return vitrine/storage wing(s)
    const wingW = 900;
    const wingStartZ = benchDepth + 80;
    const returnWallLenL = Math.max(2000, wingStartZ + wingW + 120);
    if (isL || isU) {
      lModules.push(
        makeTallTower(
          `mod_liv_wing_r_${tsL}`,
          isGlassTower ? "Sağ Dönüş Füme Cam Vitrin" : "Sağ Dönüş Ünitesi",
          safeWallW - towerDepth,
          wingStartZ,
          270,
          wingW
        )
      );
    }
    if (isU) {
      lModules.push(
        makeTallTower(
          `mod_liv_wing_l_${tsL}`,
          isGlassTower ? "Sol Dönüş Füme Cam Vitrin" : "Sol Dönüş Ünitesi",
          towerDepth,
          wingStartZ + wingW,
          90,
          wingW
        )
      );
    }

    const lWalls = [
      {
        id: "wall_main",
        name: "Ana Salon / Vestiyer Duvarı",
        length: safeWallW,
        height: ceilH,
        thickness: 150,
        position: { x: 0, y: 0, z: 0 },
        rotationY: 0,
        elements: [],
      },
      ...(isL || isU
        ? [
            {
              id: "wall_right_return",
              name: "Sağ Yan Duvar",
              length: returnWallLenL,
              height: ceilH,
              thickness: 150,
              position: { x: safeWallW, y: 0, z: 0 },
              rotationY: 90,
              elements: [],
            },
          ]
        : []),
      ...(isU
        ? [
            {
              id: "wall_left_return",
              name: "Sol Yan Duvar",
              length: returnWallLenL,
              height: ceilH,
              thickness: 150,
              position: { x: 0, y: 0, z: 0 },
              rotationY: 90,
              elements: [],
            },
          ]
        : []),
    ];

    return {
      ...curProj,
      version: (curProj.version || 1) + 1,
      updatedAt: new Date().toISOString(),
      space: {
        ...curProj.space,
        type: isU ? ("u_shape" as const) : isL ? ("l_shape" as const) : ("rectangular" as const),
        ceilingHeight: ceilH,
        walls: lWalls,
        elements: [],
        wizardCleanRoom: true,
      } as unknown as typeof curProj.space,
      modules: lModules,
      sceneObjects: lSceneObjects,
    };
  }

  const modCount =
    effectiveDoorStyle === "sliding"
      ? usableSpan <= 2600
        ? 1
        : Math.max(2, Math.ceil(usableSpan / 2400))
      : usableSpan < 1300
      ? 1
      : usableSpan < 2200
      ? 2
      : usableSpan < 3300
      ? 3
      : 4;

  const baseUnitW = Math.floor(usableSpan / modCount / 10) * 10;
  const remW = usableSpan - baseUnitW * modCount;

  let curX = fillerEach;
  const builtModules: ModuleInstance[] = [];
  const baseTs = Date.now();

  for (let i = 0; i < modCount; i++) {
    const thisW = i === modCount - 1 ? baseUnitW + remW : baseUnitW;
    const tplId =
      (wiz.spaceCategory as string) === "kitchen"
        ? i === 0
          ? "tpl_kb_08_sink_base"
          : i === 1
          ? "tpl_kb_05_three_drawers"
          : "tpl_kb_02_double_door"
        : effectiveDoorStyle === "sliding"
        ? thisW >= 1800
          ? "tpl_wd_06_sliding_3door"
          : "tpl_wd_05_sliding_2door"
        : "tpl_wd_02_two_door";

    const tpl = getV4TemplateById(tplId) || WARDROBE_TEMPLATES[0];
    const modTitle =
      (wiz.spaceCategory as string) === "kitchen"
        ? i === 0
          ? "Eviye Alt Dolabı"
          : i === 1
          ? "Çekmeceli Ocak Altı"
          : `Hazırlık Dolabı #${i + 1}`
        : effectiveDoorStyle === "sliding"
        ? modCount === 1
          ? "Sürgülü Gardırop Modülü"
          : `Sürgülü Gardırop #${i + 1}`
        : (wiz.spaceCategory as string) === "living"
        ? `Vitrin & Depolama #${i + 1}`
        : wiz.spaceCategory === "walkin"
        ? `Giyinme Ünitesi #${i + 1}`
        : `Gardırop Modülü #${i + 1}`;

    const m = tpl
      ? tpl.createInstance(`mod_wiz_${baseTs}_${i + 1}`, modTitle)
      : createDefaultWardrobeModule(`mod_wiz_${baseTs}_${i + 1}`);

    m.name = modTitle;
    m.position = { x: curX, y: 0, z: 0 };
    m.rotation = { x: 0, y: 0, z: 0 };
    m.dimensions = { width: thisW, height: effHeight, depth: effDepth };
    m.isOpenFront = effectiveDoorStyle === "open" || tplId === "tpl_kb_05_three_drawers";
    m.carcass = {
      ...m.carcass,
      wallAnchored: true,
      bodyMaterialId: chosenMats.body,
      doorMaterialId: effectiveDoorStyle === "glass" ? "mat_smoked_glass" : chosenMats.door,
      crossSectionProfile: effectiveDoorStyle === "glass" ? "glass_frame" : "flat_slab",
      ledLightingEnabled: wiz.addLed && (wiz.spaceCategory as string) !== "kitchen",
      ledColorTempK: 3000,
      ...(thisW > 2750 ? { allowJumboSheet3660: true } : {}),
    };

    const targetBayCount =
      (wiz.spaceCategory as string) === "kitchen"
        ? tplId === "tpl_kb_05_three_drawers"
          ? 1
          : thisW >= 700
          ? 2
          : 1
        : effectiveDoorStyle === "sliding"
        ? thisW >= 1800
          ? 3
          : 2
        : thisW >= 750
        ? 2
        : 1;

    while (m.bays.length < targetBayCount) {
      m.bays.push(JSON.parse(JSON.stringify(m.bays[0])));
    }
    if (m.bays.length > targetBayCount) {
      m.bays = m.bays.slice(0, targetBayCount);
    }

    const T = m.carcass.panelThickness || 18;
    const plinthH = m.carcass.plinthHeight ?? ((wiz.spaceCategory as string) === "kitchen" ? 100 : 80);
    m.carcass.plinthHeight = plinthH;
    const netH = Math.max(400, effHeight - plinthH - 2 * T);
    const topShelfY = Math.round((netH - 360) / 32) * 32;
    const railHighY = Math.max(400, topShelfY - 64);

    const isSlidingMod = effectiveDoorStyle === "sliding";
    const slidingPulloutBayIdx = targetBayCount === 3 ? 1 : 1;
    const slidingSafeCustomWidths = isSlidingMod
      ? computeSlidingSafeBayCustomWidths(thisW, T, targetBayCount, slidingPulloutBayIdx)
      : new Array<number | undefined>(targetBayCount).fill(undefined);

    m.bays.forEach((b, bIdx) => {
      b.customWidth = slidingSafeCustomWidths[bIdx];
    });
    const resolvedBayWidths = calculateBayWidths(m);
    const drawerNominalLenMm = isSlidingMod ? (effDepth >= 640 ? 500 : 450) : undefined;

    m.bays = m.bays.map((b, bIdx) => {
      const isKitchenDrawerUnit =
        (wiz.spaceCategory as string) === "kitchen" && tplId === "tpl_kb_05_three_drawers";
      const isSingleBayMod = targetBayCount === 1;
      const nextDoorType = isKitchenDrawerUnit
        ? ("open" as const)
        : effectiveDoorStyle === "open"
        ? ("open" as const)
        : effectiveDoorStyle === "sliding"
        ? ("sliding" as const)
        : isSingleBayMod
        ? thisW >= 650
          ? ("double" as const)
          : ("single_right" as const)
        : bIdx === 0
        ? ("single_left" as const)
        : ("single_right" as const);

      const nextDoorSys =
        nextDoorType === "open"
          ? ("open" as const)
          : nextDoorType === "sliding"
          ? ("sliding_top_hung" as const)
          : nextDoorType === "double"
          ? ("hinged_double" as const)
          : ("hinged_single" as const);

      const bayCustomW = slidingSafeCustomWidths[bIdx];
      const approxBayClearW = resolvedBayWidths[bIdx] || 600;
      const useThickShelf = approxBayClearW > 820 ? 25 : 18;

      let nextShelves = b.shelves || [];
      let nextRails = b.hangingRails || [];
      let nextDrawers = b.drawers || [];
      const nextFittings: typeof b.specialFittings = [];

      if (wiz.spaceCategory !== "kitchen") {
        const isDrawerBay =
          wiz.interiorFocus === "hanging"
            ? false
            : isSlidingMod
            ? bIdx === slidingPulloutBayIdx
            : bIdx === targetBayCount - 1;

        if (wiz.interiorFocus === "hanging") {
          nextShelves = [
            {
              id: `sh_${m.id}_${bIdx}_top`,
              bayIndex: bIdx,
              elevationY: topShelfY,
              isAdjustable: false,
              thickness: useThickShelf,
            },
          ];
          nextRails = [{ id: `rl_${m.id}_${bIdx}_1`, bayIndex: bIdx, elevationY: railHighY }];
          nextDrawers = [];
        } else if (wiz.interiorFocus === "shelves") {
          const stepS = Math.floor(netH / 5 / 32) * 32;
          nextShelves = [1, 2, 3, 4]
            .map((sIdx) => ({
              id: `sh_${m.id}_${bIdx}_${sIdx}`,
              bayIndex: bIdx,
              elevationY: Math.max(420, stepS * sIdx),
              isAdjustable: sIdx !== 2,
              thickness: useThickShelf,
            }))
            .filter((s) => s.elevationY < netH - 140);
          nextRails = [];
          nextDrawers = isDrawerBay
            ? [
                {
                  id: `drw_${m.id}_${bIdx}_1`,
                  bayIndex: bIdx,
                  height: 180,
                  elevationY: 0,
                  slideType: "soft_close" as const,
                  isInternal: isSlidingMod ? true : undefined,
                  nominalLengthMm: drawerNominalLenMm,
                  frontMaterialId: chosenMats.door,
                },
                {
                  id: `drw_${m.id}_${bIdx}_2`,
                  bayIndex: bIdx,
                  height: 180,
                  elevationY: 184,
                  slideType: "soft_close" as const,
                  isInternal: isSlidingMod ? true : undefined,
                  nominalLengthMm: drawerNominalLenMm,
                  frontMaterialId: chosenMats.door,
                },
              ]
            : [];
        } else {
          if (!isDrawerBay) {
            nextShelves = [
              {
                id: `sh_${m.id}_${bIdx}_top`,
                bayIndex: bIdx,
                elevationY: topShelfY,
                isAdjustable: false,
                thickness: useThickShelf,
              },
            ];
            nextRails = [{ id: `rl_${m.id}_${bIdx}_1`, bayIndex: bIdx, elevationY: railHighY }];
            nextDrawers = [];
          } else {
            nextDrawers = [
              {
                id: `drw_${m.id}_${bIdx}_1`,
                bayIndex: bIdx,
                height: 180,
                elevationY: 0,
                slideType: "soft_close" as const,
                isInternal: isSlidingMod ? true : undefined,
                nominalLengthMm: drawerNominalLenMm,
                frontMaterialId: chosenMats.door,
              },
              {
                id: `drw_${m.id}_${bIdx}_2`,
                bayIndex: bIdx,
                height: 180,
                elevationY: 184,
                slideType: "soft_close" as const,
                isInternal: isSlidingMod ? true : undefined,
                nominalLengthMm: drawerNominalLenMm,
                frontMaterialId: chosenMats.door,
              },
            ];
            nextShelves = [
              {
                id: `sh_${m.id}_${bIdx}_1`,
                bayIndex: bIdx,
                elevationY: 416,
                isAdjustable: false,
                thickness: useThickShelf,
              },
              {
                id: `sh_${m.id}_${bIdx}_2`,
                bayIndex: bIdx,
                elevationY: 864,
                isAdjustable: true,
                thickness: useThickShelf,
              },
              {
                id: `sh_${m.id}_${bIdx}_3`,
                bayIndex: bIdx,
                elevationY: 1312,
                isAdjustable: true,
                thickness: useThickShelf,
              },
              {
                id: `sh_${m.id}_${bIdx}_4`,
                bayIndex: bIdx,
                elevationY: topShelfY,
                isAdjustable: false,
                thickness: useThickShelf,
              },
            ].filter((s) => s.elevationY < netH - 150);
            nextRails = [];
          }
        }

        if (wiz.addLed) {
          nextFittings.push({
            id: `fit_led_${m.id}_${bIdx}`,
            bayIndex: bIdx,
            elevationY: Math.max(400, netH - 48),
            type: "led_profile",
            height: 20,
          });
        }

        const isPulloutTargetBay = isSlidingMod ? bIdx === slidingPulloutBayIdx : bIdx === 0;
        const canFitPulloutAccessory =
          approxBayClearW >= 460 &&
          approxBayClearW <= 1150 &&
          effDepth >= 530 &&
          (wiz.spaceCategory === "wardrobe" || wiz.spaceCategory === "walkin") &&
          isPulloutTargetBay;

        if (wiz.addTrouserRack && i === 0 && canFitPulloutAccessory) {
          if (nextDrawers.length === 0) {
            nextFittings.push({
              id: `fit_tr_${m.id}_${bIdx}`,
              bayIndex: bIdx,
              elevationY: 640,
              type: "trouser_rack",
              height: 85,
            });
          } else {
            const maxDrwTop = Math.max(
              0,
              ...nextDrawers.map((d) => (d.elevationY || 0) + (d.height || 180))
            );
            const safeTrY = Math.min(
              Math.max(896, Math.ceil((maxDrwTop + 520) / 32) * 32),
              Math.max(896, netH - 280)
            );
            nextShelves = nextShelves.filter(
              (s) => s.elevationY <= safeTrY - 512 || s.elevationY >= safeTrY + 160
            );
            nextFittings.push({
              id: `fit_tr_${m.id}_${bIdx}`,
              bayIndex: bIdx,
              elevationY: safeTrY,
              type: "trouser_rack",
              height: 85,
            });
          }
        }
        const canFitJewelryTray =
          approxBayClearW >= 360 &&
          approxBayClearW <= 1180 &&
          effDepth >= 450 &&
          (wiz.spaceCategory === "wardrobe" || wiz.spaceCategory === "walkin" || wiz.spaceCategory === "living") &&
          isDrawerBay;
        if (wiz.addJewelryTray && i === 0 && canFitJewelryTray) {
          nextShelves = nextShelves.map((s) =>
            s.elevationY >= 370 && s.elevationY < 512 ? { ...s, elevationY: 512 } : s
          );
          nextFittings.push({
            id: `fit_jw_${m.id}_${bIdx}`,
            bayIndex: bIdx,
            elevationY: 384,
            type: "jewelry_tray",
            height: 85,
          });
        }
      }

      const leafSpanEst = nextDoorType === "double" ? approxBayClearW / 2 : approxBayClearW;
      const safeHandleCat: HandleCategory =
        nextDoorType === "sliding"
          ? "recessed_grip"
          : nextDoorType === "open" && nextDrawers.length === 0
          ? "handleless_plain"
          : leafSpanEst < 380 || approxBayClearW < 380
          ? "knob"
          : "bar_handle";

      return {
        ...b,
        index: bIdx,
        customWidth: bayCustomW,
        shelves: nextShelves,
        hangingRails: nextRails,
        drawers: nextDrawers,
        specialFittings: nextFittings,
        door: {
          ...b.door,
          id: `door_${m.id}_${bIdx}`,
          bayIndex: bIdx,
          type: nextDoorType,
          doorSystemId: nextDoorSys,
          slidingMountingType: nextDoorType === "sliding" ? "top_hung_pelmet" : undefined,
          handleCategory: safeHandleCat,
          handleProfileId:
            safeHandleCat === "knob"
              ? "KNOB_ROUND_28"
              : safeHandleCat === "bar_handle"
              ? "K019"
              : undefined,
          hardwareProductId:
            nextDoorType === "sliding" ? "hw_hettich_topline_l" : "hw_blum_71b3550",
          doorMaterialId: effectiveDoorStyle === "glass" ? "mat_smoked_glass" : chosenMats.door,
          isGlassFramed: effectiveDoorStyle === "glass",
          crossSectionProfile: effectiveDoorStyle === "glass" ? "glass_frame" : "flat_slab",
          softClose: true,
        },
      };
    });

    builtModules.push(m);
    curX += thisW;
  }

  const returnModW = effectiveDoorStyle === "sliding" ? 1400 : 1000;
  const returnStartZ = effDepth + 50;
  const returnWallLen = Math.max(2200, returnStartZ + returnModW + 100);

  // Add 90-degree return wing modules when L-Shape or U-Shape is selected (with 50mm corner clearance)
  if (wiz.roomShape === "l_shape" || wiz.roomShape === "u_shape") {
    const baseRef = builtModules[0];
    if (baseRef) {
      const normalizeWingModule = (wingId: string, wingName: string, posX: number, posZ: number, rotY: number): ModuleInstance => {
        const wing: ModuleInstance = JSON.parse(JSON.stringify(baseRef));
        wing.id = wingId;
        wing.name = wingName;
        wing.dimensions = { width: returnModW, height: effHeight, depth: effDepth };
        wing.position = { x: posX, y: 0, z: posZ };
        wing.rotation = { x: 0, y: rotY, z: 0 };

        if (effectiveDoorStyle === "sliding" && wing.bays.length >= 2) {
          const hangingBay = wing.bays[0];
          const pulloutBay =
            wing.bays.find((b) => b.drawers.length > 0) ||
            wing.bays[wing.bays.length - 1];
          const twoBays = [hangingBay, pulloutBay === hangingBay ? wing.bays[1] : pulloutBay];
          const wingT = wing.carcass.panelThickness || 18;
          const safeWingCustoms = computeSlidingSafeBayCustomWidths(returnModW, wingT, 2, 1);
          wing.bays = twoBays.map((b, bIdx) => ({
            ...b,
            index: bIdx,
            customWidth: safeWingCustoms[bIdx],
            door: { ...b.door, id: `door_${wing.id}_${bIdx}`, bayIndex: bIdx },
            shelves: b.shelves.map((s, sI) => ({
              ...s,
              id: `sh_${wing.id}_${bIdx}_${sI}`,
              bayIndex: bIdx,
            })),
            hangingRails: b.hangingRails.map((r, rI) => ({
              ...r,
              id: `rl_${wing.id}_${bIdx}_${rI}`,
              bayIndex: bIdx,
            })),
            drawers: b.drawers.map((d, dI) => ({
              ...d,
              id: `drw_${wing.id}_${bIdx}_${dI}`,
              bayIndex: bIdx,
              isInternal: true,
            })),
            specialFittings: (b.specialFittings || []).map((f, fI) => ({
              ...f,
              id: `fit_${wing.id}_${bIdx}_${fI}`,
              bayIndex: bIdx,
            })),
          }));
        } else {
          wing.bays = wing.bays.map((b, bIdx) => ({
            ...b,
            index: bIdx,
            door: { ...b.door, id: `door_${wing.id}_${bIdx}`, bayIndex: bIdx },
            shelves: b.shelves.map((s, sI) => ({
              ...s,
              id: `sh_${wing.id}_${bIdx}_${sI}`,
              bayIndex: bIdx,
            })),
            hangingRails: b.hangingRails.map((r, rI) => ({
              ...r,
              id: `rl_${wing.id}_${bIdx}_${rI}`,
              bayIndex: bIdx,
            })),
            drawers: b.drawers.map((d, dI) => ({
              ...d,
              id: `drw_${wing.id}_${bIdx}_${dI}`,
              bayIndex: bIdx,
            })),
            specialFittings: (b.specialFittings || []).map((f, fI) => ({
              ...f,
              id: `fit_${wing.id}_${bIdx}_${fI}`,
              bayIndex: bIdx,
            })),
          }));
        }
        return wing;
      };

      builtModules.push(
        normalizeWingModule(
          `mod_wiz_left_${baseTs}`,
          "Sol Köşe Dönüş Ünitesi",
          0,
          returnStartZ,
          90
        )
      );

      if (wiz.roomShape === "u_shape") {
        builtModules.push(
          normalizeWingModule(
            `mod_wiz_right_${baseTs}`,
            "Sağ Köşe Dönüş Ünitesi",
            Math.max(0, safeWallW - effDepth),
            returnStartZ,
            270
          )
        );
      }
    }
  }

  // Build clean room walls matching roomShape and safeWallW
  const nextWalls = [
    {
      id: "wall_main",
      name: "Ana Duvar",
      length: safeWallW,
      height: ceilH,
      thickness: 150,
      position: { x: 0, y: 0, z: 0 },
      rotationY: 0,
      elements: [],
    },
    ...(wiz.roomShape === "l_shape" || wiz.roomShape === "u_shape"
      ? [
          {
            id: "wall_left_return",
            name: "Sol Yan Duvar",
            length: returnWallLen,
            height: ceilH,
            thickness: 150,
            position: { x: 0, y: 0, z: 0 },
            rotationY: 90,
            elements: [],
          },
        ]
      : []),
    ...(wiz.roomShape === "u_shape"
      ? [
          {
            id: "wall_right_return",
            name: "Sağ Yan Duvar",
            length: returnWallLen,
            height: ceilH,
            thickness: 150,
            position: { x: safeWallW, y: 0, z: 0 },
            rotationY: 90,
            elements: [],
          },
        ]
      : []),
  ];

  const nextSpace = {
    ...curProj.space,
    type:
      (wiz.spaceCategory as string) === "kitchen"
        ? ("kitchen_straight" as const)
        : ("wardrobe_zone" as const),
    ceilingHeight: ceilH,
    walls: nextWalls,
    elements: [],
    wizardCleanRoom: true,
  } as typeof curProj.space;

  return {
    ...curProj,
    version: (curProj.version || 1) + 1,
    updatedAt: new Date().toISOString(),
    space: nextSpace,
    modules: builtModules,
    sceneObjects: [],
  };
}


export interface SmartStarterTemplateProposal {
  id: string;
  title: string;
  subtitle: string;
  badge: string;
  moduleCount: number;
  bayCount: number;
  shelfCount: number;
  drawerCount: number;
  hangingRailCount: number;
  estimatedTotalWithVatEur: number;
  payload: GuidedWizardLayoutInput;
  previewProject: DesignProject;
}

/**
 * Generates 4 dimension-fitted, engineering-validated starter proposals
 * from the single parametric model (0.00 mm drift between preview, BOM & pricing).
 */
export function generateSmartStarterTemplates(
  baseProject: DesignProject,
  opts: {
    spaceCategory: GuidedWizardLayoutInput["spaceCategory"];
    roomShape: GuidedWizardLayoutInput["roomShape"];
    wallWidthMm: number;
    targetHeightMm: number;
    targetDepthMm: number;
    colorSwatchId?: string;
  }
): SmartStarterTemplateProposal[] {
  const safeW = Math.max(1200, Math.min(6000, Math.round(opts.wallWidthMm || 2400)));
  const safeH = opts.spaceCategory === "kitchen" ? 870 : Math.max(1800, Math.min(2800, Math.round(opts.targetHeightMm || 2400)));
  const safeD = Math.max(450, Math.min(700, Math.round(opts.targetDepthMm || 600)));
  const slidingSupported =
    opts.spaceCategory !== "kitchen" && opts.spaceCategory !== "walkin" && safeW >= 1500;

  const recipes: Array<{
    id: string;
    title: string;
    subtitle: string;
    badge: string;
    overrides: Partial<GuidedWizardLayoutInput>;
  }> =
    opts.spaceCategory === "kitchen"
      ? [
          {
            id: "starter_kitchen_gola_hf",
            title: "Gola Kulpsuz & AVENTOS HF Katlanır",
            subtitle: "Üstten el sokmalı Gola L/C profil + üstte katlanır kalkar kapak ve 3000K LED",
            badge: "En Popüler",
            overrides: {
              interiorFocus: "balanced",
              doorStyle: "hinged",
              kitchenGripSystem: "gola_profile",
              kitchenWallOpening: "lift_bi_fold",
              conceptTier: "smart",
              addLed: true,
            },
          },
          {
            id: "starter_kitchen_jpull_hk",
            title: "45° Pahlı (J-Kulp) & AVENTOS HK Tek Kalkar",
            subtitle: "Kapak üstünden 45° eğimli gizli tutamak + bol çekmeceli alt + tek parça kalkar üst",
            badge: "Yüksek Depolama",
            overrides: {
              interiorFocus: "shelves",
              doorStyle: "hinged",
              kitchenGripSystem: "j_pull",
              kitchenWallOpening: "lift_up_stay",
              conceptTier: "smart",
              addLed: true,
            },
          },
          {
            id: "starter_kitchen_vitrine_hl",
            title: "Füme Cam Vitrin & AVENTOS HL Paralel",
            subtitle: "Üst dolaplarda paralel yükselen füme cam kapaklar + bas-aç kulpsuz cephe",
            badge: "Şık Vitrin",
            overrides: {
              interiorFocus: "balanced",
              doorStyle: "glass",
              kitchenGripSystem: "push_to_open",
              kitchenWallOpening: "lift_parallel",
              conceptTier: "signature",
              addLed: true,
            },
          },
          {
            id: "starter_kitchen_classic",
            title: "Klasik Çubuk Kulp & Menteşeli Mutfak",
            subtitle: "160 mm modern çubuk kulp ve frenli Blum CLIP top menteşeli ekonomik kurulum",
            badge: "Ekonomik",
            overrides: {
              interiorFocus: "balanced",
              doorStyle: "hinged",
              kitchenGripSystem: "bar_handle",
              kitchenWallOpening: "hinged",
              conceptTier: "eco",
              addLed: false,
            },
          },
        ]
      : opts.spaceCategory === "living"
      ? [
          {
            id: "starter_living_tv_vitrine",
            title: "TV Duvarı & Füme Cam Vitrin",
            subtitle: "Alçak medya konsolu, 65\" OLED TV, üst köprü ve iki yanda LED füme cam vitrin",
            badge: "En Çok Seçilen",
            overrides: {
              interiorFocus: "balanced",
              doorStyle: "glass",
              conceptTier: "smart",
              addLed: true,
              addTrouserRack: false,
              addJewelryTray: false,
            },
          },
          {
            id: "starter_living_tv_bookcase",
            title: "Modern TV Ünitesi & Açık Kitaplık",
            subtitle: "Ortada 65\" TV ve çekmeceli konsol, iki yanda 3000K LED aydınlatmalı açık kitaplık",
            badge: "Modern Salon",
            overrides: {
              interiorFocus: "shelves",
              doorStyle: "open",
              conceptTier: "smart",
              addLed: true,
              addTrouserRack: false,
              addJewelryTray: false,
            },
          },
          {
            id: "starter_living_vestiyer_bench",
            title: "Oturmalı Antre & Vestiyer",
            subtitle: "Portmanto askı kulesi, ortada çekmeceli oturma bankı, üst köprü ve ayakkabı dolabı",
            badge: "Antre / Vestiyer",
            overrides: {
              interiorFocus: "hanging",
              doorStyle: "hinged",
              conceptTier: "smart",
              addLed: true,
              addTrouserRack: false,
              addJewelryTray: false,
            },
          },
          {
            id: "starter_living_vitrine_signature",
            title: "Füme Cam Vitrin & LED Signature",
            subtitle: "Ceviz/vizon gövde, çerçeveli füme cam vitrin kuleleri, 65\" TV ve 3000K gömme LED",
            badge: "Signature",
            overrides: {
              interiorFocus: "balanced",
              doorStyle: "glass",
              conceptTier: "signature",
              addLed: true,
              addTrouserRack: false,
              addJewelryTray: false,
            },
          },
        ]
      : [
          {
            id: "starter_balanced",
            title: "Dengeli Günlük Gardırop",
            subtitle: "Askı borusu, katlama rafları ve alt çekmece dengesi",
            badge: "En Çok Seçilen",
            overrides: {
              interiorFocus: "balanced",
              doorStyle: opts.spaceCategory === "walkin" ? "open" : "hinged",
              conceptTier: "smart",
              addLed: true,
              addTrouserRack: false,
              addJewelryTray: false,
            },
          },
          {
            id: "starter_max_hanging",
            title: slidingSupported ? "Sürgü Kapaklı Maksimum Askı" : "Maksimum Askı & Uzun Elbise",
            subtitle: slidingSupported
              ? "Dar geçişlere uygun sürgü kapak ve kesintisiz askı alanı"
              : "Gömlek, ceket ve uzun elbiseler için geniş askı hacmi",
            badge: slidingSupported ? "Sürgü Sistem" : "Geniş Askı",
            overrides: {
              interiorFocus: "hanging",
              doorStyle: opts.spaceCategory === "walkin" ? "open" : slidingSupported ? "sliding" : "hinged",
              targetDepthMm: slidingSupported ? Math.max(600, safeD) : safeD,
              conceptTier: "smart",
              addLed: true,
              addTrouserRack: true,
              addJewelryTray: false,
            },
          },
          {
            id: "starter_drawer_folded",
            title: "Bol Çekmeceli & Katlama Düzeni",
            subtitle: "Triko rafları, frenli çekmece grubu ve teleskopik pantolonluk",
            badge: "Maksimum Düzen",
            overrides: {
              interiorFocus: "shelves",
              doorStyle: opts.spaceCategory === "walkin" ? "open" : "hinged",
              conceptTier: "smart",
              addLed: true,
              addTrouserRack: true,
              addJewelryTray: false,
            },
          },
          {
            id: "starter_vitrine_signature",
            title: opts.spaceCategory === "walkin" ? "Açık Giyinme Odası & Takı Adası" : "Füme Cam Vitrin & LED Signature",
            subtitle:
              opts.spaceCategory === "walkin"
                ? "Kapaksız butik sergileme, 3000K LED ve kadife takı çekmecesi"
                : "Füme cam çerçeve kapaklar, 3000K gömme LED ve takı çekmecesi",
            badge: "Signature",
            overrides: {
              interiorFocus: "balanced",
              doorStyle: opts.spaceCategory === "walkin" ? "open" : "glass",
              conceptTier: "signature",
              addLed: true,
              addTrouserRack: true,
              addJewelryTray: true,
            },
          },
        ];

  return recipes.map((r) => {
    const payload: GuidedWizardLayoutInput = {
      spaceCategory: opts.spaceCategory,
      roomShape: opts.roomShape,
      wallWidthMm: safeW,
      targetHeightMm: safeH,
      targetDepthMm: r.overrides.targetDepthMm ?? safeD,
      autoFiller50Mm: true,
      interiorFocus: r.overrides.interiorFocus ?? "balanced",
      doorStyle: r.overrides.doorStyle ?? "hinged",
      conceptTier: r.overrides.conceptTier ?? "smart",
      colorSwatchId: opts.colorSwatchId,
      addLed: r.overrides.addLed ?? true,
      addTrouserRack: r.overrides.addTrouserRack ?? false,
      addJewelryTray: r.overrides.addJewelryTray ?? false,
      kitchenGripSystem: r.overrides.kitchenGripSystem,
      kitchenWallOpening: r.overrides.kitchenWallOpening,
    };
    const previewProject = buildGuidedWizardProject(baseProject, payload);
    const mainMods = previewProject.modules.filter((m) => m.category !== "complementary");
    let bayCount = 0;
    let shelfCount = 0;
    let drawerCount = 0;
    let hangingRailCount = 0;
    for (const m of mainMods) {
      bayCount += m.bays.length;
      for (const b of m.bays) {
        shelfCount += b.shelves.length;
        drawerCount += b.drawers.length;
        hangingRailCount += b.hangingRails.length;
      }
    }
    let estimatedTotalWithVatEur = 0;
    try {
      const bom = generateBOMForProject(previewProject, undefined, { skipSyncNesting: true });
      const pr = calculateProjectPrice(bom, undefined, undefined, previewProject.sceneObjects || []);
      estimatedTotalWithVatEur = Math.round(pr.totalWithVatEur);
    } catch {
      estimatedTotalWithVatEur = Math.round((safeW / 1000) * 680);
    }
    return {
      id: r.id,
      title: r.title,
      subtitle: r.subtitle,
      badge: r.badge,
      moduleCount: mainMods.length,
      bayCount,
      shelfCount,
      drawerCount,
      hangingRailCount,
      estimatedTotalWithVatEur,
      payload,
      previewProject,
    };
  });
}
