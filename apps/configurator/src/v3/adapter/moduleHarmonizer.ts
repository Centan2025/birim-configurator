import type { ModuleInstance } from "@birim/core";

export type ModuleHeightClass = "kitchen_wall" | "kitchen_base" | "tall_or_wardrobe";

export function classifyModuleHeightClass(mod: ModuleInstance): ModuleHeightClass {
  if (
    mod.moduleFamilyId === "fam_kitchen_wall" ||
    mod.category === "kitchen_wall" ||
    mod.position.y >= 1100
  ) {
    return "kitchen_wall";
  }
  if (
    mod.moduleFamilyId === "fam_kitchen_base" ||
    mod.category === "kitchen_base" ||
    mod.category === "kitchen_corner" ||
    mod.category === "kitchen_island" ||
    mod.dimensions.height <= 1050
  ) {
    return "kitchen_base";
  }
  return "tall_or_wardrobe";
}

/**
 * Yeni eklenen veya mevcut bir modülün yerine konulan hazır şablonu,
 * sahnedeki mevcut mutfak/gardırop tasarımının renk, malzeme, kulp/Gola stili,
 * yükseklik, derinlik, baza yüksekliği ve (değiştirme modunda) genişlik/açı değerleriyle
 * otomatik olarak uyumlu hale getirir.
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

  // Stil (renk/malzeme/kulp) referansı: önce değiştirilen hedef modül, yoksa aynı sınıf veya ilk ana modül
  const styleRef =
    targetMod ||
    mainExisting.find((m) => classifyModuleHeightClass(m) === newClass) ||
    mainExisting[0];

  // Ölçü (yükseklik/derinlik/baza) referansı: mutlaka aynı yükseklik sınıfından bir modül!
  const dimRef =
    targetMod && classifyModuleHeightClass(targetMod) === newClass
      ? targetMod
      : mainExisting.find((m) => classifyModuleHeightClass(m) === newClass) || null;

  const isNewCorner = Boolean(newMod.isCorner || newMod.category === "kitchen_corner");
  const isTargetCorner = Boolean(targetMod?.isCorner || targetMod?.category === "kitchen_corner");

  // 1. Renk, Gövde/Kapak Malzemesi, Kalınlık ve Sistem 32 Ayarları
  if (styleRef) {
    newMod.carcass = {
      ...newMod.carcass,
      bodyMaterialId: styleRef.carcass.bodyMaterialId || newMod.carcass.bodyMaterialId,
      doorMaterialId: styleRef.carcass.doorMaterialId || newMod.carcass.doorMaterialId,
      backMaterialId: styleRef.carcass.backMaterialId || newMod.carcass.backMaterialId,
      ...(styleRef.carcass.countertopMaterialId
        ? { countertopMaterialId: styleRef.carcass.countertopMaterialId }
        : {}),
      plinthMaterialId:
        styleRef.carcass.plinthMaterialId ||
        styleRef.carcass.bodyMaterialId ||
        styleRef.carcass.doorMaterialId ||
        newMod.carcass.plinthMaterialId,
      ...(styleRef.carcass.panelThickness
        ? { panelThickness: styleRef.carcass.panelThickness }
        : {}),
      ...(styleRef.carcass.doorThickness
        ? { doorThickness: styleRef.carcass.doorThickness }
        : {}),
      ...(styleRef.carcass.multiHoleMode
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

    // Kapak rengi & kulp/Gola/J-Kulp stilini aktar (yeni şablon özel cam vitrin değilse)
    const refDoor = styleRef.bays.find((b) => b.door && b.door.type !== "open")?.door || styleRef.bays[0]?.door;
    if (refDoor) {
      newMod.bays = (newMod.bays || []).map((bay) => {
        if (!bay.door) return bay;
        const keepGlass = Boolean(bay.door.isGlassFramed || bay.door.doorMaterialId === "mat_smoked_glass");
        const isSlidingNew = bay.door.type === "sliding" || bay.door.doorSystemId?.startsWith("sliding");
        const isWallNew = newClass === "kitchen_wall";
        const inheritedHandleProfileId =
          refDoor.handleCategory === "gola_profile"
            ? isWallNew
              ? "hnd_gola_wall_268"
              : "hnd_gola_profile"
            : refDoor.handleProfileId;

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
            ...(!isSlidingNew && refDoor.handleCategory
              ? {
                  handleCategory: refDoor.handleCategory,
                  handleProfileId: inheritedHandleProfileId,
                  handleType: refDoor.handleType,
                  openingTechnology: refDoor.openingTechnology || bay.door.openingTechnology,
                  crossSectionProfile: keepGlass
                    ? bay.door.crossSectionProfile
                    : refDoor.crossSectionProfile || bay.door.crossSectionProfile,
                }
              : {}),
          },
        };
      });
    }
  }

  // 2. Yükseklik, Derinlik ve Baza Uyumu (Aynı sınıf modüller arasında)
  const customW = options.customDimensions?.width;
  const customH = options.customDimensions?.height;
  const customD = options.customDimensions?.depth;

  if (dimRef) {
    if (typeof customH !== "number" && dimRef.dimensions.height > 0) {
      newMod.dimensions = {
        ...newMod.dimensions,
        height: dimRef.dimensions.height,
      };
    }
    if (
      typeof customD !== "number" &&
      !isNewCorner &&
      !(dimRef.isCorner || dimRef.category === "kitchen_corner") &&
      dimRef.dimensions.depth > 0
    ) {
      newMod.dimensions = {
        ...newMod.dimensions,
        depth: dimRef.dimensions.depth,
      };
    }
    if (newClass !== "kitchen_wall" && typeof dimRef.carcass.plinthHeight === "number") {
      newMod.carcass = {
        ...newMod.carcass,
        plinthHeight: dimRef.carcass.plinthHeight,
      };
    }
    if (newClass === "kitchen_wall" && options.mode === "append" && dimRef.position.y >= 1100) {
      newMod.position = {
        ...newMod.position,
        y: dimRef.position.y,
      };
    }
  }

  // 3. Değiştirme (replace) modunda: mevcut modülün genişliğini ve dönüş açısını (L/U kol yönünü) koru
  if (options.mode === "replace" && targetMod) {
    if (targetMod.rotation) {
      newMod.rotation = { ...targetMod.rotation };
    }
    if (
      typeof customW !== "number" &&
      !isNewCorner &&
      !isTargetCorner &&
      classifyModuleHeightClass(targetMod) === newClass &&
      targetMod.dimensions.width >= 200
    ) {
      newMod.dimensions = {
        ...newMod.dimensions,
        width: targetMod.dimensions.width,
      };
    }
  }

  return newMod;
}
