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
      backMaterialId: styleRef.carcass.backMaterialId || newMod.carcass.backMaterialId,
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

    const refDoor =
      styleRef.bays.find((b) => b.door && b.door.type !== "open")?.door || styleRef.bays[0]?.door;
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
          !isOpenNoDrawers && refDoor.handleCategory
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
