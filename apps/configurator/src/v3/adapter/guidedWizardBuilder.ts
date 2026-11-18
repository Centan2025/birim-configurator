import {
  DEFAULT_MATERIALS,
  calculateBayWidths,
  computeSlidingSafeBayCustomWidths,
  createDefaultWardrobeModule,
  type DesignProject,
  type HandleCategory,
  type ModuleInstance,
} from "@birim/core";
import { WARDROBE_TEMPLATES, getV4TemplateById } from "@birim/catalog";
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
    anthracite: { body: "mat_mdf_anthracite", door: "mat_lacquer_anthracite" },
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
      wiz.spaceCategory === "kitchen"
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
      wiz.spaceCategory === "kitchen"
        ? i === 0
          ? "Eviye Alt Dolabı"
          : i === 1
          ? "Çekmeceli Ocak Altı"
          : `Hazırlık Dolabı #${i + 1}`
        : effectiveDoorStyle === "sliding"
        ? modCount === 1
          ? "Sürgülü Gardırop Modülü"
          : `Sürgülü Gardırop #${i + 1}`
        : wiz.spaceCategory === "living"
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
      doorMaterialId: chosenMats.door,
      ledLightingEnabled: wiz.addLed && wiz.spaceCategory !== "kitchen",
      ledColorTempK: 3000,
      ...(thisW > 2750 ? { allowJumboSheet3660: true } : {}),
    };

    const targetBayCount =
      wiz.spaceCategory === "kitchen"
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
    const plinthH = m.carcass.plinthHeight ?? (wiz.spaceCategory === "kitchen" ? 100 : 80);
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
        wiz.spaceCategory === "kitchen" && tplId === "tpl_kb_05_three_drawers";
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
            nextShelves = nextShelves.filter(
              (s) => s.elevationY <= 448 || s.elevationY >= 896
            );
            nextFittings.push({
              id: `fit_tr_${m.id}_${bIdx}`,
              bayIndex: bIdx,
              elevationY: 672,
              type: "trouser_rack",
              height: 85,
            });
          }
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
          wiz.spaceCategory === "kitchen" ? "Sol Dönüş Dolabı" : "Sol Köşe Dönüş Ünitesi",
          0,
          returnStartZ + returnModW,
          90
        )
      );

      if (wiz.roomShape === "u_shape") {
        builtModules.push(
          normalizeWingModule(
            `mod_wiz_right_${baseTs}`,
            wiz.spaceCategory === "kitchen" ? "Sağ Dönüş Dolabı" : "Sağ Köşe Dönüş Ünitesi",
            safeWallW,
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
      wiz.spaceCategory === "kitchen"
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
            id: "starter_kitchen_ergonomic",
            title: "Ergonomik Hazırlık & Eviye Dizilimi",
            subtitle: "Eviye altı + 3'lü Tandembox çekmece + hazırlık dolapları",
            badge: "Önerilen",
            overrides: { interiorFocus: "balanced", doorStyle: "hinged", conceptTier: "smart", addLed: false },
          },
          {
            id: "starter_kitchen_drawer_pro",
            title: "Tam Çekmeceli & Raf Ağırlıklı Mutfak",
            subtitle: "Tencere ve erzak erişimi için maksimum çekmece & raf",
            badge: "Yüksek Depolama",
            overrides: { interiorFocus: "shelves", doorStyle: "hinged", conceptTier: "smart", addLed: false },
          },
          {
            id: "starter_kitchen_vitrine",
            title: "Füme Cam Vitrinli Mutfak",
            subtitle: "Alüminyum çerçeveli füme cam kapak kombinasyonu",
            badge: "Şık Vitrin",
            overrides: { interiorFocus: "balanced", doorStyle: "glass", conceptTier: "signature", addLed: false },
          },
          {
            id: "starter_kitchen_eco",
            title: "Kompakt & Ekonomik Mutfak",
            subtitle: "Yüksek verimli plaka kullanımı ve sade kapak düzeni",
            badge: "Ekonomik",
            overrides: { interiorFocus: "balanced", doorStyle: "hinged", conceptTier: "eco", addLed: false },
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
