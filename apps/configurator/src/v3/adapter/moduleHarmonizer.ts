import {
  alignModuleShelvesToSystem32,
  resolveSmartCompatibleDoorPatchForModuleBay,
  type ModuleInstance,
} from "@birim/core";

export type ModuleHeightClass =
  | "kitchen_wall"
  | "kitchen_base"
  | "kitchen_tall"
  | "wardrobe"
  | "living_or_special";


/**
 * Yükseklik (H) değiştiğinde bölme içindeki çekmecelerin aralıklarının açılmasını önler:
 * - Altta istifli gardırop/boy dolap çekmecelerini (örn. 4x180mm) kendi yüksekliğinde ve 5mm derzinde sabit tutar,
 *   sadece dolap çekmece bloğundan daha kısa hale gelirse orantılı daraltır.
 * - Gövdenin tamamını dolduran çekmeceli alt dolap/şifonyerlerde (>=%82 doluluk) çekmece yüksekliklerini
 *   orantılı ölçekleyip 5mm sabit derzle yeniden dizer.
 * - Üstte tek çekmece (topDrawerCombo) varsa üst sınıra yaslar.
 * - Çekmece üstündeki bölme rafını çekmece üst kotunda sabit tutup üstteki rafları/askıları kalan boşlukta ölçekler.
 */
export function rescaleBayInteriorForHeightChange(
  bay: ModuleInstance["bays"][number],
  oldInner: number,
  newInner: number,
  panelThickness = 18
): void {
  const safeOldInner = Math.max(1, oldInner);
  const safeNewInner = Math.max(1, newInner);
  const roundInt = (n: number) => Math.round(n);
  const clamp = (n: number, min: number, max: number) => Math.max(min, Math.min(max, n));
  const GAP = 5;

  const drawers = bay.drawers || [];
  let oldDrawerTop = 0;
  let newDrawerTop = 0;

  if (drawers.length > 0) {
    const sorted = [...drawers].sort((a, b) => a.elevationY - b.elevationY);
    const oldMinY = sorted[0].elevationY;
    oldDrawerTop = Math.max(...sorted.map((d) => d.elevationY + d.height));
    const oldSpan = Math.max(1, oldDrawerTop - oldMinY);
    const isTopAnchoredSingle =
      sorted.length === 1 && oldMinY > safeOldInner * 0.55 && safeOldInner - oldDrawerTop <= 35;
    const isFullHeightBank = oldMinY <= 40 && oldSpan >= safeOldInner * 0.82;

    if (isTopAnchoredSingle) {
      const d = sorted[0];
      d.elevationY = roundInt(clamp(safeNewInner - d.height, 0, Math.max(0, safeNewInner - d.height)));
      newDrawerTop = 0; // üstte olduğu için alt raf bölgesini etkilemez
    } else if (isFullHeightBank) {
      const totalGap = GAP * Math.max(0, sorted.length - 1);
      const oldSumH = Math.max(1, sorted.reduce((s, d) => s + d.height, 0));
      const availH = Math.max(sorted.length * 60, safeNewInner - totalGap);
      let cursor = 0;
      sorted.forEach((d, idx) => {
        const nextH =
          idx === sorted.length - 1
            ? Math.max(60, roundInt(safeNewInner - cursor))
            : Math.max(60, roundInt((d.height / oldSumH) * availH));
        d.height = nextH;
        d.elevationY = roundInt(cursor);
        cursor += nextH + GAP;
      });
      newDrawerTop = Math.max(...sorted.map((d) => d.elevationY + d.height));
    } else {
      // Altta istifli çekmece bloğu: yükseklik artınca araları AÇMA, sabit derzle altta tut
      if (oldDrawerTop <= safeNewInner) {
        let cursor = Math.max(0, roundInt(oldMinY));
        sorted.forEach((d, idx) => {
          if (idx === 0) {
            d.elevationY = cursor;
          } else {
            const origGap = sorted[idx].elevationY - (sorted[idx - 1].elevationY + sorted[idx - 1].height);
            const keepGap = origGap >= 0 && origGap <= 25 ? roundInt(origGap) : GAP;
            d.elevationY = roundInt(cursor + keepGap);
          }
          cursor = d.elevationY + d.height;
        });
      } else {
        // Gövde çekmece bloğundan daha kısa olduysa orantılı daralt ve 5mm derzle istifle
        const totalGap = GAP * Math.max(0, sorted.length - 1);
        const oldSumH = Math.max(1, sorted.reduce((s, d) => s + d.height, 0));
        const availH = Math.max(sorted.length * 60, safeNewInner - totalGap);
        let cursor = 0;
        sorted.forEach((d) => {
          const nextH = Math.max(60, roundInt((d.height / oldSumH) * availH));
          d.height = nextH;
          d.elevationY = roundInt(clamp(cursor, 0, Math.max(0, safeNewInner - nextH)));
          cursor = d.elevationY + nextH + GAP;
        });
      }
      newDrawerTop = Math.max(...sorted.map((d) => d.elevationY + d.height));
    }
  }

  // Rafları ölçekle: çekmece üstündeki bölme rafını çekmece üst kotunda tut, üstündekileri üst bölgede orantıla
  // ve hiçbir rafın yeniden ölçekleme sonrası çekmece gövdesinin içine girmemesini garanti altına al.
  const oldUpperZone = Math.max(1, safeOldInner - oldDrawerTop);
  const newUpperZone = Math.max(1, safeNewInner - newDrawerTop);
  (bay.shelves || []).forEach((s) => {
    const shT = s.thickness ?? panelThickness;
    const maxY = Math.max(0, safeNewInner - shT);
    let nextY: number;
    if (oldDrawerTop > 0 && Math.abs(s.elevationY - oldDrawerTop) <= 32) {
      nextY = roundInt(clamp(newDrawerTop, 0, maxY));
    } else if (oldDrawerTop > 0 && s.elevationY > oldDrawerTop) {
      const rel = (s.elevationY - oldDrawerTop) / oldUpperZone;
      nextY = roundInt(clamp(newDrawerTop + rel * newUpperZone, newDrawerTop, maxY));
    } else {
      nextY = roundInt(clamp((s.elevationY * safeNewInner) / safeOldInner, 0, maxY));
    }
    // Çekmece gövdesi çakışma koruması: ölçeklenen raf herhangi bir çekmecenin içinden geçiyorsa üstüne al
    for (const d of drawers) {
      const drBot = d.elevationY || 0;
      const drTop = drBot + Math.max(80, d.height || 180);
      if (nextY + shT > drBot + 10 && nextY < drTop - 2) {
        nextY = roundInt(clamp(drTop, 0, maxY));
      }
    }
    s.elevationY = nextY;
  });

  // Askı borularını ölçekle
  (bay.hangingRails || []).forEach((r) => {
    const maxY = Math.max(0, safeNewInner - 25);
    if (oldDrawerTop > 0 && r.elevationY > oldDrawerTop) {
      const rel = (r.elevationY - oldDrawerTop) / oldUpperZone;
      r.elevationY = roundInt(clamp(newDrawerTop + rel * newUpperZone, Math.min(maxY, newDrawerTop + 100), maxY));
    } else {
      r.elevationY = roundInt(clamp((r.elevationY * safeNewInner) / safeOldInner, 0, maxY));
    }
  });
}

export function classifyModuleHeightClass(mod: ModuleInstance): ModuleHeightClass {
  const tpl = (mod.templateId || "").toLowerCase();
  if (
    tpl.startsWith("v5_tv_") ||
    tpl.startsWith("v5_bathroom_") ||
    tpl.startsWith("v5_capsule_") ||
    mod.carcass.hullShape === "capsule_stadium" ||
    mod.carcass.hullShape === "capsule_table"
  ) {
    return "living_or_special";
  }
  if (
    mod.moduleFamilyId === "fam_kitchen_wall" ||
    mod.category === "kitchen_wall" ||
    (!mod.category.startsWith("wardrobe") && mod.position.y >= 1100)
  ) {
    return "kitchen_wall";
  }
  if (
    mod.category === "kitchen_tall" ||
    mod.moduleFamilyId === "fam_kitchen_tall"
  ) {
    return "kitchen_tall";
  }
  if (
    mod.moduleFamilyId === "fam_kitchen_base" ||
    mod.category === "kitchen_base" ||
    mod.category === "kitchen_corner" ||
    mod.category === "kitchen_island"
  ) {
    return "kitchen_base";
  }
  if (
    mod.category === "wardrobe" ||
    mod.category === "wardrobe_walkin" ||
    mod.category === "wardrobe_corner" ||
    mod.moduleFamilyId === "fam_wardrobe"
  ) {
    return "wardrobe";
  }
  return "living_or_special";
}

/**
 * Yeni eklenen veya mevcut bir modülün yerine konulan hazır katalog şablonunu,
 * sahnedeki mevcut tasarımın malzeme ve uyumlu kulp stiliyle eşleştirir;
 * ANCAK hazır şablonun kendi mühendislik ölçülerini (örn. 600mm EN 1116 fırın/buzdolabı,
 * 450mm AVENTOS HK üst dolap, 650×650mm köşe üst dolap, 1800mm sürgülü gardırop, 380mm mikrodalga)
 * ASLA bozmaz!
 */
export function harmonizeModuleWithProjectContext(
  newMod: ModuleInstance,
  existingModules: ModuleInstance[],
  options: {
    mode: "replace" | "append";
    targetModule?: ModuleInstance | null;
    customDimensions?: { width?: number; height?: number; depth?: number };
  }
): ModuleInstance {
  if (newMod.category === "complementary" || newMod.moduleFamilyId === "fam_complementary") {
    return newMod;
  }

  const mainExisting = existingModules.filter(
    (m) => m.category !== "complementary" && m.moduleFamilyId !== "fam_complementary"
  );
  if (mainExisting.length === 0 && !options.targetModule) {
    return newMod;
  }

  const newClass = classifyModuleHeightClass(newMod);
  const targetMod = options.targetModule || null;

  // Stil referansı: aynı mobilya ailesinden (mutfak vs gardırop) modül varsa onu baz al
  const isNewKitchen = newClass.startsWith("kitchen_");
  const sameDomainExisting = mainExisting.find(
    (m) => classifyModuleHeightClass(m).startsWith("kitchen_") === isNewKitchen
  );
  const styleRef =
    (targetMod && classifyModuleHeightClass(targetMod).startsWith("kitchen_") === isNewKitchen
      ? targetMod
      : null) ||
    mainExisting.find((m) => classifyModuleHeightClass(m) === newClass) ||
    sameDomainExisting ||
    null;

  const dimRef =
    targetMod && classifyModuleHeightClass(targetMod) === newClass
      ? targetMod
      : mainExisting.find((m) => classifyModuleHeightClass(m) === newClass) || null;

  // 1. Gövde / Kapak Malzemesi ve Uyumlu Kulp Stili Aktarımı
  if (styleRef) {
    const keepSpecialHull =
      newMod.carcass.hullShape === "capsule_stadium" ||
      newMod.carcass.hullShape === "capsule_table" ||
      newMod.carcass.carcassJoineryTopology === "miter_45";
    const keepHeavy25mmCarcass = (newMod.carcass.panelThickness || 18) >= 25;

    newMod.carcass = {
      ...newMod.carcass,
      bodyMaterialId: styleRef.carcass.bodyMaterialId || newMod.carcass.bodyMaterialId,
      doorMaterialId:
        newMod.carcass.doorMaterialId === "mat_smoked_glass"
          ? "mat_smoked_glass"
          : styleRef.carcass.doorMaterialId || newMod.carcass.doorMaterialId,
      ...(styleRef.carcass.countertopMaterialId
        ? { countertopMaterialId: styleRef.carcass.countertopMaterialId }
        : {}),
      plinthMaterialId:
        styleRef.carcass.plinthMaterialId ||
        styleRef.carcass.bodyMaterialId ||
        styleRef.carcass.doorMaterialId ||
        newMod.carcass.plinthMaterialId,
      ...(!keepSpecialHull && !keepHeavy25mmCarcass && styleRef.carcass.panelThickness
        ? { panelThickness: styleRef.carcass.panelThickness }
        : {}),
      ...(styleRef.carcass.multiHoleMode && styleRef.carcass.multiHoleMode !== "none"
        ? { multiHoleMode: styleRef.carcass.multiHoleMode }
        : {}),
      ...(styleRef.carcass.multiHoleRowCount
        ? { multiHoleRowCount: styleRef.carcass.multiHoleRowCount }
        : {}),
      ...(styleRef.carcass.grainContinuityMode
        ? { grainContinuityMode: styleRef.carcass.grainContinuityMode }
        : {}),
    };
    if (styleRef.surfaceFinishOverride) {
      newMod.surfaceFinishOverride = styleRef.surfaceFinishOverride;
    }

    const isBayHandleSource = (b: ModuleInstance["bays"][number]) =>
      Boolean(
        b.door &&
          (b.door.type !== "open" ||
            (b.drawers || []).some((d) => !d.isInternal && !d.isHidden))
      );
    const refDoorFromStyle = styleRef.bays.find(isBayHandleSource)?.door || null;
    const refDoorFromAny =
      refDoorFromStyle ||
      mainExisting
        .filter((m) => classifyModuleHeightClass(m).startsWith("kitchen_") === isNewKitchen)
        .flatMap((m) => m.bays || [])
        .find(isBayHandleSource)?.door ||
      null;
    const refDoor = refDoorFromAny || styleRef.bays[0]?.door;
    const allowHandleTransfer = Boolean(refDoorFromAny);
    if (refDoor) {
      let needs22mmForJPull = false;
      newMod.bays = (newMod.bays || []).map((bay, bIdx) => {
        if (!bay.door) return bay;
        const keepGlass = Boolean(
          bay.door.isGlassFramed || bay.door.doorMaterialId === "mat_smoked_glass"
        );
        const hasExtDrawers = (bay.drawers || []).some((d) => !d.isInternal && !d.isHidden);
        const isOpenNoDrawers = bay.door.type === "open" && !hasExtDrawers;

        const adaptedHandle =
          allowHandleTransfer && !isOpenNoDrawers && refDoor.handleCategory
            ? resolveSmartCompatibleDoorPatchForModuleBay(
                {
                  handleProfileId: refDoor.handleProfileId,
                  handleCategory: refDoor.handleCategory,
                  crossSectionProfile: keepGlass
                    ? bay.door.crossSectionProfile
                    : refDoor.crossSectionProfile || bay.door.crossSectionProfile,
                },
                newMod,
                bIdx
              )
            : null;

        if (adaptedHandle?.handleCategory === "j_pull") {
          needs22mmForJPull = true;
        }

        const syncedDrawers = (bay.drawers || []).map((drw) => ({
          ...drw,
          ...(refDoor.handleMaterialId ? { handleMaterialId: refDoor.handleMaterialId } : {}),
        }));

        return {
          ...bay,
          drawers: syncedDrawers,
          door: {
            ...bay.door,
            doorMaterialId: keepGlass
              ? bay.door.doorMaterialId
              : refDoor.doorMaterialId || styleRef.carcass.doorMaterialId || bay.door.doorMaterialId,
            ...(refDoor.handleMaterialId ? { handleMaterialId: refDoor.handleMaterialId } : {}),
            ...(adaptedHandle
              ? {
                  handleCategory: adaptedHandle.handleCategory,
                  handleProfileId: adaptedHandle.handleProfileId,
                  ...(adaptedHandle.crossSectionProfile
                    ? { crossSectionProfile: adaptedHandle.crossSectionProfile }
                    : {}),
                  openingTechnology:
                    adaptedHandle.handleCategory === "handleless_plain"
                      ? "push_to_open_soft_close"
                      : bay.door.openingTechnology || "soft_close",
                }
              : {}),
          },
        };
      });

      if (needs22mmForJPull) {
        newMod.carcass.doorThickness = Math.max(22, newMod.carcass.doorThickness || 22);
        const curDoorMat = newMod.carcass.doorMaterialId || "";
        if (
          !curDoorMat.includes("lacquer") &&
          !curDoorMat.includes("veneer") &&
          !curDoorMat.includes("mattplus")
        ) {
          newMod.carcass.doorMaterialId = "mat_lacquer_cashmere";
        }
      }
    }
  }

  // 2. Baza & Üst Kot Hizası (Şablonun kendi W/H/D mühendislik ölçülerini ASLA ezmeden!)
  const tplLc = (newMod.templateId || "").toLowerCase();
  const isBuiltInVentTower =
    !tplLc.includes("fridge_surround") &&
    (tplLc.includes("oven") || tplLc.includes("fridge"));

  if (dimRef) {
    if (
      newClass !== "kitchen_wall" &&
      newClass !== "living_or_special" &&
      (newMod.carcass.plinthHeight ?? 0) > 0 &&
      typeof dimRef.carcass.plinthHeight === "number" &&
      dimRef.carcass.plinthHeight > 0
    ) {
      const safePlinth = isBuiltInVentTower
        ? Math.max(100, dimRef.carcass.plinthHeight)
        : dimRef.carcass.plinthHeight;
      newMod.carcass = {
        ...newMod.carcass,
        plinthHeight: safePlinth,
      };
    }

    if (newClass === "kitchen_wall" && options.mode === "append" && dimRef.position.y >= 1100) {
      newMod.position = {
        ...newMod.position,
        y: dimRef.position.y,
      };
    }

    // Gardırop / giyinme odası diziliminde yeni eklenen boy dolabı mevcut boy dolap yüksekliğine hizala (ada/şifonyer hariç)
    if (
      newClass === "wardrobe" &&
      options.mode === "append" &&
      !options.customDimensions?.height &&
      newMod.dimensions.height >= 1800 &&
      dimRef.dimensions.height >= 1800 &&
      newMod.dimensions.height !== dimRef.dimensions.height
    ) {
      const panelT = newMod.carcass.panelThickness || 18;
      const plinthH = newMod.carcass.plinthHeight ?? 80;
      const oldInner = Math.max(1, newMod.dimensions.height - plinthH - 2 * panelT);
      const nextH = dimRef.dimensions.height;
      const newInner = Math.max(1, nextH - plinthH - 2 * panelT);
      (newMod.bays || []).forEach((b) => {
        rescaleBayInteriorForHeightChange(b, oldInner, newInner, panelT);
      });
      newMod.dimensions = {
        ...newMod.dimensions,
        height: nextH,
      };
    }
  }

  // Yalnızca açıkça customDimensions geçirildiyse (örn. Kalan Boşluğu Doldur) ölçü uygula
  if (options.customDimensions) {
    if (typeof options.customDimensions.width === "number" && !newMod.isFixedWidth) {
      newMod.dimensions.width = options.customDimensions.width;
    }
    if (typeof options.customDimensions.height === "number") {
      newMod.dimensions.height = options.customDimensions.height;
    }
    if (typeof options.customDimensions.depth === "number") {
      newMod.dimensions.depth = options.customDimensions.depth;
    }
    alignModuleShelvesToSystem32(newMod, { includeFixedShelves: true });
  }

  // 3. Değiştirme (replace) modunda yalnızca L/U duvar dönüş açısını koru (köşe olmayan -> köşe olmayan ise)
  const isNewCorner = Boolean(newMod.isCorner || newMod.category === "kitchen_corner");
  const isTargetCorner = Boolean(targetMod?.isCorner || targetMod?.category === "kitchen_corner");
  if (options.mode === "replace" && targetMod?.rotation && isNewCorner === isTargetCorner) {
    newMod.rotation = { ...targetMod.rotation };
  }

  return newMod;
}
