import {
  DEFAULT_MATERIALS,
  type DesignProject,
  type DoorCrossSectionProfile,
  type HandleCategory,
  type MaterialDefinition,
  type ModuleInstance,
} from "@birim/core";

export type QuickZoneScope =
  | "active_doors"
  | "active_carcass"
  | "active_plinth"
  | "active_module"
  | "base_cabinets"
  | "wall_cabinets"
  | "tall_and_island"
  | "countertops"
  | "carcass_all"
  | "plinths"
  | "handles_gola"
  | "all_fronts";

export type PaintClickBehavior =
  | "active_scope"
  | "clicked_part"
  | "clicked_module"
  | "replace_matching_project";

export type Active3DPaintToolMode = "none" | "paint" | "eyedropper";

export interface PaintTool3DState {
  mode: Active3DPaintToolMode;
  materialId: string;
  clickBehavior: PaintClickBehavior;
  zoneScope: QuickZoneScope;
}

export interface CuratedBirimMoodboard {
  id: string;
  titleTr: string;
  subtitleTr: string;
  badgeTr: string;
  baseFrontMaterialId: string;
  wallFrontMaterialId: string;
  tallFrontMaterialId: string;
  carcassMaterialId: string;
  countertopMaterialId: string;
  plinthMaterialId: string;
  handleMaterialId: string;
  enableGrainContinuity: boolean;
  surfaceFinishOverride?: "matte" | "satin" | "gloss";
}

export interface CopiedModuleStyleSnapshot {
  sourceModuleName: string;
  doorMaterialId: string;
  bodyMaterialId: string;
  plinthMaterialId?: string;
  countertopMaterialId?: string;
  surfaceFinishOverride?: "matte" | "satin" | "gloss";
  crossSectionProfile?: DoorCrossSectionProfile;
  isGlassFramed?: boolean;
  handleCategory?: HandleCategory;
  handleProfileId?: string;
  handleMaterialId?: string;
  handleLengthMm?: number;
}

export interface InModelMaterialUsage {
  material: MaterialDefinition;
  moduleCount: number;
  zonesLabelTr: string;
}

export const QUICK_ZONE_SCOPE_OPTIONS: ReadonlyArray<{
  id: QuickZoneScope;
  labelTr: string;
  shortTr: string;
  hintTr: string;
}> = [
  {
    id: "active_doors",
    labelTr: "Seçili Modül Cephesi",
    shortTr: "Bu Cephe",
    hintTr: "Yalnızca seçili dolabın kapak ve çekmece ön yüzlerini boyar",
  },
  {
    id: "active_carcass",
    labelTr: "Seçili Modül İç Gövdesi",
    shortTr: "Bu Gövde",
    hintTr: "Yalnızca seçili dolabın yan dikme, üst/alt tabla ve raflarını boyar",
  },
  {
    id: "active_plinth",
    labelTr: "Seçili Modül Bazası",
    shortTr: "Bu Baza",
    hintTr: "Yalnızca seçili dolabın zemin baza ön panelini boyar",
  },
  {
    id: "active_module",
    labelTr: "Seçili Modül (Tümü)",
    shortTr: "Bu Modül",
    hintTr: "Seçili dolabın gövde, kapak ve baza yüzeylerini birlikte günceller",
  },
  {
    id: "base_cabinets",
    labelTr: "Tüm Alt Dolaplar",
    shortTr: "Alt Dolaplar",
    hintTr: "Projedeki tüm mutfak alt ve köşe dolap cephelerini tek tıkla günceller",
  },
  {
    id: "wall_cabinets",
    labelTr: "Tüm Üst Dolaplar",
    shortTr: "Üst Dolaplar",
    hintTr: "Projedeki tüm duvar / üst dolap cephelerini tek tıkla günceller (Çift ton mutfak)",
  },
  {
    id: "tall_and_island",
    labelTr: "Boy Dolap, Ada & Gardırop",
    shortTr: "Boy & Ada",
    hintTr: "Boy kiler, ankastre kolon, mutfak adası ve gardırop cephelerini günceller",
  },
  {
    id: "all_fronts",
    labelTr: "Tüm Proje Cepheleri",
    shortTr: "Tüm Cepheler",
    hintTr: "Projedeki tüm modüllerin kapak ve çekmece önlerini tek renge eşitler",
  },
  {
    id: "countertops",
    labelTr: "Tezgâh & Ada Üst Tablaları",
    shortTr: "Tezgâhlar",
    hintTr: "Tüm alt dolap ve şelale ada kuvars / porselen / mermer tezgâhlarını değiştirir",
  },
  {
    id: "carcass_all",
    labelTr: "Tüm İç Gövdeler",
    shortTr: "İç Gövdeler",
    hintTr: "Tüm dolapların iç dikme, raf ve üst/alt tabla gövde malzemesini eşitler",
  },
  {
    id: "handles_gola",
    labelTr: "Kulp & Gola Profilleri",
    shortTr: "Kulp / Gola",
    hintTr: "Tüm kulp ve alüminyum Gola kanallarının eloksal metal rengini değiştirir",
  },
  {
    id: "plinths",
    labelTr: "Tüm Bazalar",
    shortTr: "Bazalar",
    hintTr: "Zemin baza ön panellerinin rengini tek adımda günceller",
  },
];

export const BIRIM_CURATED_MOODBOARDS: ReadonlyArray<CuratedBirimMoodboard> = [
  {
    id: "birim_japandi_nordic",
    titleTr: "Japandi İskandinav",
    subtitleTr: "Alt İskandinav Meşe · Üst Sahra Kumu Lake · Abu Dhabi Kuvars",
    badgeTr: "Çift Ton İmza",
    baseFrontMaterialId: "mat_camsan_iskandinav_mese",
    wallFrontMaterialId: "mat_lacquer_cream",
    tallFrontMaterialId: "mat_camsan_iskandinav_mese",
    carcassMaterialId: "mat_melamine_white",
    countertopMaterialId: "mat_neolith_abu_dhabi_white",
    plinthMaterialId: "mat_camsan_iskandinav_mese",
    handleMaterialId: "mat_handle_brass",
    enableGrainContinuity: true,
    surfaceFinishOverride: "matte",
  },
  {
    id: "birim_milano_walnut",
    titleTr: "Milano Ceviz & Kaşmir",
    subtitleTr: "Alt Barok Ceviz · Üst Kaşmir Gri · Dekton Entzo Gold",
    badgeTr: "Mimari Kontrast",
    baseFrontMaterialId: "mat_veneer_walnut",
    wallFrontMaterialId: "mat_ye_kasmir_gri",
    tallFrontMaterialId: "mat_veneer_walnut",
    carcassMaterialId: "mat_melamine_anthracite",
    countertopMaterialId: "mat_dekton_entzo",
    plinthMaterialId: "mat_melamine_anthracite",
    handleMaterialId: "mat_handle_matte_black",
    enableGrainContinuity: true,
    surfaceFinishOverride: "satin",
  },
  {
    id: "birim_bosphorus_sage",
    titleTr: "Boğaziçi Adaçayı & Meşe",
    subtitleTr: "Alt Adaçayı İpek Lake · Üst Freze Meşe · Belenco Calacatta",
    badgeTr: "Doğal Sıcak",
    baseFrontMaterialId: "mat_lacquer_sage",
    wallFrontMaterialId: "mat_veneer_oak",
    tallFrontMaterialId: "mat_lacquer_sage",
    carcassMaterialId: "mat_fabric_linen_sand",
    countertopMaterialId: "mat_quartz_calacatta",
    plinthMaterialId: "mat_lacquer_sage",
    handleMaterialId: "mat_handle_brass",
    enableGrainContinuity: true,
    surfaceFinishOverride: "matte",
  },
  {
    id: "birim_warm_cashmere",
    titleTr: "Nişantaşı Vizon & Keten",
    subtitleTr: "Alt Vizon Anti-Finger · Üst Sahra Krem · Calacatta Luxe",
    badgeTr: "Yumuşak Mat",
    baseFrontMaterialId: "mat_ke_mattplus_vizon",
    wallFrontMaterialId: "mat_lacquer_cream",
    tallFrontMaterialId: "mat_ke_mattplus_vizon",
    carcassMaterialId: "mat_fabric_linen_sand",
    countertopMaterialId: "mat_neolith_calacatta_luxe",
    plinthMaterialId: "mat_ke_mattplus_vizon",
    handleMaterialId: "mat_handle_anthracite",
    enableGrainContinuity: false,
    surfaceFinishOverride: "matte",
  },
  {
    id: "birim_monolith_dark",
    titleTr: "Monolit Antrasit & Bazalt",
    subtitleTr: "Antrasit Mat + Koyu Gri · Basalt Black Porselen · Mat Siyah Gola",
    badgeTr: "Loft Galeri",
    baseFrontMaterialId: "mat_melamine_anthracite",
    wallFrontMaterialId: "mat_ke_evogloss_p114",
    tallFrontMaterialId: "mat_melamine_anthracite",
    carcassMaterialId: "mat_melamine_anthracite",
    countertopMaterialId: "mat_neolith_basalt_black",
    plinthMaterialId: "mat_melamine_anthracite",
    handleMaterialId: "mat_handle_matte_black",
    enableGrainContinuity: false,
    surfaceFinishOverride: "matte",
  },
  {
    id: "birim_atelier_oak_mono",
    titleTr: "Atölye Freze Meşe & Pietra",
    subtitleTr: "Sürekli Damarlı Freze Meşe · Pietra di Piombo · Siyah Metal",
    badgeTr: "Desen Takipli",
    baseFrontMaterialId: "mat_veneer_oak",
    wallFrontMaterialId: "mat_veneer_oak",
    tallFrontMaterialId: "mat_veneer_oak",
    carcassMaterialId: "mat_melamine_anthracite",
    countertopMaterialId: "mat_neolith_pietra_di_piombo",
    plinthMaterialId: "mat_melamine_anthracite",
    handleMaterialId: "mat_handle_matte_black",
    enableGrainContinuity: true,
    surfaceFinishOverride: "satin",
  },
  {
    id: "birim_galata_ivory",
    titleTr: "Galata İpek Krem & Inox",
    subtitleTr: "Sahra Kumu İpek Lake · Neolith Estatuario · Satine Inox",
    badgeTr: "Zamansız Ferah",
    baseFrontMaterialId: "mat_lacquer_cream",
    wallFrontMaterialId: "mat_lacquer_cream",
    tallFrontMaterialId: "mat_lacquer_cream",
    carcassMaterialId: "mat_melamine_white",
    countertopMaterialId: "mat_neolith_estatuario",
    plinthMaterialId: "mat_lacquer_cream",
    handleMaterialId: "mat_handle_inox",
    enableGrainContinuity: false,
    surfaceFinishOverride: "matte",
  },
  {
    id: "birim_bebek_walnut_linen",
    titleTr: "Bebek Ceviz & Doğal Keten",
    subtitleTr: "Barok Ceviz Cephe · Keten İç Gövde · Light Emperador Mermer",
    badgeTr: "Gardırop & Mutfak",
    baseFrontMaterialId: "mat_veneer_walnut",
    wallFrontMaterialId: "mat_ke_mattplus_vizon",
    tallFrontMaterialId: "mat_veneer_walnut",
    carcassMaterialId: "mat_fabric_linen_sand",
    countertopMaterialId: "mat_marble_emperador",
    plinthMaterialId: "mat_veneer_walnut",
    handleMaterialId: "mat_handle_brass",
    enableGrainContinuity: true,
    surfaceFinishOverride: "satin",
  },
];

let moduleStyleClipboard: CopiedModuleStyleSnapshot | null = null;

export function getCopiedModuleStyleClipboard(): CopiedModuleStyleSnapshot | null {
  return moduleStyleClipboard;
}

export function setCopiedModuleStyleClipboard(snapshot: CopiedModuleStyleSnapshot | null): void {
  moduleStyleClipboard = snapshot;
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("birim:style-clipboard-changed", { detail: snapshot }));
  }
}

export function classifyModuleArchitecturalZone(
  mod: ModuleInstance
): "base" | "wall" | "tall_or_island" | "complementary" {
  if (mod.category === "complementary") return "complementary";
  if (
    mod.moduleFamilyId === "fam_kitchen_wall" ||
    mod.category === "kitchen_wall" ||
    (mod.position?.y ?? 0) >= 1050
  ) {
    return "wall";
  }
  if (
    mod.category === "kitchen_island" ||
    (mod.moduleFamilyId as string) === "fam_kitchen_island" ||
    mod.moduleFamilyId === "fam_kitchen_tall" ||
    mod.category === "kitchen_tall" ||
    mod.dimensions.height > 1150
  ) {
    return "tall_or_island";
  }
  return "base";
}

function clearDoorAndDrawerOverrides(mod: ModuleInstance): void {
  if (!mod.componentMaterialOverrides) return;
  for (const key of Object.keys(mod.componentMaterialOverrides)) {
    if (key.includes("_door_") || key.includes("_front") || key === "__doors__" || key === "__drawers__") {
      delete mod.componentMaterialOverrides[key];
    }
  }
}

function applyFrontMaterialToModule(mod: ModuleInstance, materialId: string): number {
  let touched = 1;
  mod.carcass.doorMaterialId = materialId;
  mod.bays.forEach((b) => {
    if (b.door) {
      b.door.doorMaterialId = materialId;
      touched++;
    }
    (b.drawers || []).forEach((d) => {
      d.frontMaterialId = materialId;
      touched++;
    });
  });
  clearDoorAndDrawerOverrides(mod);
  return touched;
}

function applyCarcassMaterialToModule(mod: ModuleInstance, materialId: string): void {
  mod.carcass.bodyMaterialId = materialId;
  mod.edgeBandMaterialId = materialId;
  if (mod.componentMaterialOverrides) {
    for (const key of Object.keys(mod.componentMaterialOverrides)) {
      if (
        !key.includes("_door_") &&
        !key.includes("_front") &&
        key !== "__plinth__" &&
        !key.includes("plinth") &&
        !key.includes("countertop")
      ) {
        delete mod.componentMaterialOverrides[key];
      }
    }
  }
}

function applyPlinthMaterialToModule(mod: ModuleInstance, materialId: string): void {
  mod.carcass.plinthMaterialId = materialId;
  if (!mod.componentMaterialOverrides) mod.componentMaterialOverrides = {};
  mod.componentMaterialOverrides.__plinth__ = materialId;
}

function applyCountertopMaterialToModule(mod: ModuleInstance, materialId: string): boolean {
  const zone = classifyModuleArchitecturalZone(mod);
  let changed = false;
  if (zone === "base" || mod.category === "kitchen_island" || Boolean(mod.carcass.countertopMaterialId)) {
    mod.carcass.countertopMaterialId = materialId;
    changed = true;
  }
  if (mod.islandCountertopConfig) {
    mod.islandCountertopConfig.countertopMaterialId = materialId;
    changed = true;
  }
  if (mod.attachedTableConfig) {
    (mod.attachedTableConfig as unknown as { materialId?: string }).materialId = materialId;
    changed = true;
  }
  if (mod.complementaryRole === "countertop" || mod.id.includes("countertop")) {
    mod.carcass.bodyMaterialId = materialId;
    mod.carcass.doorMaterialId = materialId;
    changed = true;
  }
  return changed;
}

function applyHandleMetalToModule(mod: ModuleInstance, handleMaterialId: string): number {
  let count = 0;
  mod.bays.forEach((b) => {
    if (b.door) {
      b.door.handleMaterialId = handleMaterialId;
      count++;
    }
  });
  return count;
}

export function resolveEffectiveScopeForMaterial(
  requestedScope: QuickZoneScope,
  matDef: MaterialDefinition
): { effectiveScope: QuickZoneScope; autoRoutedNoteTr?: string; blockedErrorTr?: string } {
  if (matDef.category === "stone") {
    if (requestedScope === "countertops") {
      return { effectiveScope: "countertops" };
    }
    return {
      effectiveScope: "countertops",
      autoRoutedNoteTr: `"${matDef.name}" ağır taş/kuvars levha olduğu için otomatik olarak Tezgâh yüzeylerine uygulandı.`,
    };
  }
  if (matDef.category === "metal" || matDef.id.startsWith("mat_handle_")) {
    if (requestedScope === "handles_gola" || requestedScope === "plinths") {
      return { effectiveScope: requestedScope };
    }
    return {
      effectiveScope: "handles_gola",
      autoRoutedNoteTr: `"${matDef.name}" eloksal metal olduğu için Kulp & Gola profillerine uygulandı.`,
    };
  }
  if (
    (matDef.category === "glass" || matDef.category === "mirror") &&
    (requestedScope === "carcass_all" ||
      requestedScope === "active_carcass" ||
      requestedScope === "plinths" ||
      requestedScope === "active_plinth" ||
      requestedScope === "countertops")
  ) {
    return {
      effectiveScope: requestedScope,
      blockedErrorTr: `"${matDef.name}" taşıyıcı gövde, baza veya tezgâh olarak kullanılamaz; lütfen kapak kapsamı seçin.`,
    };
  }
  return { effectiveScope: requestedScope };
}

export function applyZoneMaterialToProjectDraft(
  draft: DesignProject,
  activeModuleIndex: number,
  requestedScope: QuickZoneScope,
  materialId: string,
  allMaterials: MaterialDefinition[] = DEFAULT_MATERIALS
): { ok: boolean; affectedModules: number; messageTr: string } {
  const matDef =
    allMaterials.find((m) => m.id === materialId) ||
    DEFAULT_MATERIALS.find((m) => m.id === materialId);
  if (!matDef) {
    return { ok: false, affectedModules: 0, messageTr: "Seçilen malzeme katalogda bulunamadı." };
  }

  const { effectiveScope, autoRoutedNoteTr, blockedErrorTr } = resolveEffectiveScopeForMaterial(
    requestedScope,
    matDef
  );
  if (blockedErrorTr) {
    return { ok: false, affectedModules: 0, messageTr: blockedErrorTr };
  }

  let affectedModules = 0;
  const safeActiveIdx = Math.max(0, Math.min(draft.modules.length - 1, activeModuleIndex));

  if (effectiveScope === "active_doors") {
    const mod = draft.modules[safeActiveIdx];
    if (mod) {
      applyFrontMaterialToModule(mod, materialId);
      affectedModules = 1;
    }
  } else if (effectiveScope === "active_carcass") {
    const mod = draft.modules[safeActiveIdx];
    if (mod) {
      applyCarcassMaterialToModule(mod, materialId);
      affectedModules = 1;
    }
  } else if (effectiveScope === "active_plinth") {
    const mod = draft.modules[safeActiveIdx];
    if (mod) {
      applyPlinthMaterialToModule(mod, materialId);
      affectedModules = 1;
    }
  } else if (effectiveScope === "active_module") {
    const mod = draft.modules[safeActiveIdx];
    if (mod) {
      applyFrontMaterialToModule(mod, materialId);
      if (matDef.category !== "glass" && matDef.category !== "mirror") {
        applyCarcassMaterialToModule(mod, materialId);
        applyPlinthMaterialToModule(mod, materialId);
      }
      affectedModules = 1;
    }
  } else if (effectiveScope === "base_cabinets") {
    draft.modules.forEach((m) => {
      if (classifyModuleArchitecturalZone(m) === "base") {
        applyFrontMaterialToModule(m, materialId);
        affectedModules++;
      }
    });
    if (affectedModules === 0 && draft.modules[safeActiveIdx]) {
      applyFrontMaterialToModule(draft.modules[safeActiveIdx], materialId);
      affectedModules = 1;
    }
  } else if (effectiveScope === "wall_cabinets") {
    draft.modules.forEach((m) => {
      if (classifyModuleArchitecturalZone(m) === "wall") {
        applyFrontMaterialToModule(m, materialId);
        affectedModules++;
      }
    });
    if (affectedModules === 0 && draft.modules[safeActiveIdx]) {
      applyFrontMaterialToModule(draft.modules[safeActiveIdx], materialId);
      affectedModules = 1;
    }
  } else if (effectiveScope === "tall_and_island") {
    draft.modules.forEach((m) => {
      if (classifyModuleArchitecturalZone(m) === "tall_or_island") {
        applyFrontMaterialToModule(m, materialId);
        affectedModules++;
      }
    });
    if (affectedModules === 0 && draft.modules[safeActiveIdx]) {
      applyFrontMaterialToModule(draft.modules[safeActiveIdx], materialId);
      affectedModules = 1;
    }
  } else if (effectiveScope === "all_fronts") {
    draft.modules.forEach((m) => {
      if (m.category === "complementary") return;
      applyFrontMaterialToModule(m, materialId);
      affectedModules++;
    });
  } else if (effectiveScope === "countertops") {
    draft.modules.forEach((m) => {
      if (applyCountertopMaterialToModule(m, materialId)) {
        affectedModules++;
      }
    });
    if (affectedModules === 0 && draft.modules[safeActiveIdx]) {
      draft.modules[safeActiveIdx].carcass.countertopMaterialId = materialId;
      affectedModules = 1;
    }
  } else if (effectiveScope === "carcass_all") {
    draft.modules.forEach((m) => {
      if (m.category === "complementary") return;
      applyCarcassMaterialToModule(m, materialId);
      affectedModules++;
    });
  } else if (effectiveScope === "plinths") {
    draft.modules.forEach((m) => {
      if (classifyModuleArchitecturalZone(m) === "wall") return;
      applyPlinthMaterialToModule(m, materialId);
      affectedModules++;
    });
  } else if (effectiveScope === "handles_gola") {
    draft.modules.forEach((m) => {
      if (m.category === "complementary") return;
      if (applyHandleMetalToModule(m, materialId) > 0) {
        affectedModules++;
      }
    });
  }

  const scopeMeta = QUICK_ZONE_SCOPE_OPTIONS.find((s) => s.id === effectiveScope);
  return {
    ok: true,
    affectedModules,
    messageTr:
      autoRoutedNoteTr ||
      `${matDef.name} → ${scopeMeta?.labelTr || "Seçili Bölge"} (${affectedModules} modül)`,
  };
}

export function applyCuratedMoodboardToProjectDraft(
  draft: DesignProject,
  moodboard: CuratedBirimMoodboard
): { affectedModules: number } {
  let affectedModules = 0;
  draft.facadeGrainContinuity = moodboard.enableGrainContinuity;

  draft.modules.forEach((m) => {
    const zone = classifyModuleArchitecturalZone(m);
    if (zone === "complementary") {
      if (m.complementaryRole === "countertop" || m.id.includes("countertop")) {
        m.carcass.bodyMaterialId = moodboard.countertopMaterialId;
        m.carcass.doorMaterialId = moodboard.countertopMaterialId;
      } else if ((m.complementaryRole as string) === "plinth" || m.complementaryRole === "plinth_strip") {
        m.carcass.bodyMaterialId = moodboard.plinthMaterialId;
        m.carcass.doorMaterialId = moodboard.plinthMaterialId;
      } else {
        m.carcass.bodyMaterialId = moodboard.baseFrontMaterialId;
        m.carcass.doorMaterialId = moodboard.baseFrontMaterialId;
      }
      return;
    }

    const frontMat =
      zone === "wall"
        ? moodboard.wallFrontMaterialId
        : zone === "tall_or_island"
        ? moodboard.tallFrontMaterialId
        : moodboard.baseFrontMaterialId;

    applyCarcassMaterialToModule(m, moodboard.carcassMaterialId);
    applyFrontMaterialToModule(m, frontMat);
    if (zone !== "wall") {
      applyPlinthMaterialToModule(m, moodboard.plinthMaterialId);
    }
    if (zone === "base" || m.category === "kitchen_island" || Boolean(m.carcass.countertopMaterialId)) {
      applyCountertopMaterialToModule(m, moodboard.countertopMaterialId);
    }
    applyHandleMetalToModule(m, moodboard.handleMaterialId);
    m.surfaceFinishOverride = moodboard.surfaceFinishOverride;
    m.carcass.grainContinuityMode = moodboard.enableGrainContinuity
      ? "facade_continuous"
      : "none";
    affectedModules++;
  });

  return { affectedModules };
}

export function replaceExistingMaterialAcrossProjectDraft(
  draft: DesignProject,
  fromMaterialId: string,
  toMaterialId: string
): number {
  if (!fromMaterialId || !toMaterialId || fromMaterialId === toMaterialId) return 0;
  let replacedSlots = 0;

  draft.modules.forEach((m) => {
    if (m.carcass.doorMaterialId === fromMaterialId) {
      m.carcass.doorMaterialId = toMaterialId;
      replacedSlots++;
    }
    if (m.carcass.bodyMaterialId === fromMaterialId) {
      m.carcass.bodyMaterialId = toMaterialId;
      replacedSlots++;
    }
    if (m.carcass.plinthMaterialId === fromMaterialId) {
      m.carcass.plinthMaterialId = toMaterialId;
      replacedSlots++;
    }
    if (m.carcass.countertopMaterialId === fromMaterialId) {
      m.carcass.countertopMaterialId = toMaterialId;
      replacedSlots++;
    }
    if (m.edgeBandMaterialId === fromMaterialId) {
      m.edgeBandMaterialId = toMaterialId;
    }
    if (m.islandCountertopConfig?.countertopMaterialId === fromMaterialId) {
      m.islandCountertopConfig.countertopMaterialId = toMaterialId;
      replacedSlots++;
    }
    const tableCfg = m.attachedTableConfig as unknown as { materialId?: string } | undefined;
    if (tableCfg?.materialId === fromMaterialId) {
      tableCfg.materialId = toMaterialId;
      replacedSlots++;
    }
    m.bays.forEach((b) => {
      if (b.door?.doorMaterialId === fromMaterialId) {
        b.door.doorMaterialId = toMaterialId;
        replacedSlots++;
      }
      if (b.door?.handleMaterialId === fromMaterialId) {
        b.door.handleMaterialId = toMaterialId;
        replacedSlots++;
      }
      (b.drawers || []).forEach((d) => {
        if (d.frontMaterialId === fromMaterialId) {
          d.frontMaterialId = toMaterialId;
          replacedSlots++;
        }
      });
    });
    if (m.componentMaterialOverrides) {
      for (const [k, v] of Object.entries(m.componentMaterialOverrides)) {
        if (v === fromMaterialId) {
          m.componentMaterialOverrides[k] = toMaterialId;
          replacedSlots++;
        }
      }
    }
  });

  return replacedSlots;
}

export function extractModuleStyleSnapshot(mod: ModuleInstance): CopiedModuleStyleSnapshot {
  const firstBayDoor = mod.bays.find((b) => b.door && b.door.type !== "open")?.door || mod.bays[0]?.door;
  return {
    sourceModuleName: mod.name || "Modül",
    doorMaterialId: firstBayDoor?.doorMaterialId || mod.carcass.doorMaterialId,
    bodyMaterialId: mod.carcass.bodyMaterialId,
    plinthMaterialId: mod.carcass.plinthMaterialId,
    countertopMaterialId: mod.carcass.countertopMaterialId,
    surfaceFinishOverride: mod.surfaceFinishOverride,
    crossSectionProfile: firstBayDoor?.crossSectionProfile || mod.carcass.crossSectionProfile,
    isGlassFramed: firstBayDoor?.isGlassFramed,
    handleCategory: firstBayDoor?.handleCategory,
    handleProfileId: firstBayDoor?.handleProfileId,
    handleMaterialId: firstBayDoor?.handleMaterialId,
    handleLengthMm: firstBayDoor?.handleLengthMm,
  };
}

export function applyCopiedStyleToProjectDraft(
  draft: DesignProject,
  targetModuleIndex: number,
  scope: "single_module" | "base_cabinets" | "wall_cabinets" | "all_project",
  style: CopiedModuleStyleSnapshot
): number {
  let count = 0;
  draft.modules.forEach((m, idx) => {
    if (m.category === "complementary") return;
    const zone = classifyModuleArchitecturalZone(m);
    const match =
      scope === "all_project" ||
      (scope === "single_module" && idx === targetModuleIndex) ||
      (scope === "base_cabinets" && zone === "base") ||
      (scope === "wall_cabinets" && zone === "wall");
    if (!match) return;

    applyCarcassMaterialToModule(m, style.bodyMaterialId);
    applyFrontMaterialToModule(m, style.doorMaterialId);
    if (style.plinthMaterialId && zone !== "wall") {
      applyPlinthMaterialToModule(m, style.plinthMaterialId);
    }
    if (style.countertopMaterialId && (zone === "base" || m.category === "kitchen_island")) {
      applyCountertopMaterialToModule(m, style.countertopMaterialId);
    }
    m.surfaceFinishOverride = style.surfaceFinishOverride;
    if (style.crossSectionProfile) {
      m.carcass.crossSectionProfile = style.crossSectionProfile;
    }
    m.bays.forEach((b) => {
      if (b.door && b.door.type !== "open") {
        if (style.crossSectionProfile) b.door.crossSectionProfile = style.crossSectionProfile;
        if (typeof style.isGlassFramed === "boolean") b.door.isGlassFramed = style.isGlassFramed;
        if (style.handleCategory) b.door.handleCategory = style.handleCategory;
        if (style.handleProfileId !== undefined) b.door.handleProfileId = style.handleProfileId;
        if (style.handleMaterialId) b.door.handleMaterialId = style.handleMaterialId;
        if (style.handleLengthMm) b.door.handleLengthMm = style.handleLengthMm;
      }
    });
    count++;
  });
  return count;
}

export function collectProjectUsedMaterials(
  project: DesignProject,
  allMaterials: MaterialDefinition[] = DEFAULT_MATERIALS
): InModelMaterialUsage[] {
  const matMap = new Map<string, MaterialDefinition>();
  DEFAULT_MATERIALS.forEach((m) => matMap.set(m.id, m));
  allMaterials.forEach((m) => matMap.set(m.id, m));

  const usage = new Map<string, { modules: Set<string>; roles: Set<string> }>();
  const record = (matId: string | undefined, modId: string, roleTr: string) => {
    if (!matId || !matMap.has(matId)) return;
    let entry = usage.get(matId);
    if (!entry) {
      entry = { modules: new Set(), roles: new Set() };
      usage.set(matId, entry);
    }
    entry.modules.add(modId);
    entry.roles.add(roleTr);
  };

  project.modules.forEach((m) => {
    if (m.category === "complementary") return;
    const zone = classifyModuleArchitecturalZone(m);
    const frontLabel =
      zone === "wall" ? "Üst Cephe" : zone === "tall_or_island" ? "Boy/Ada" : "Alt Cephe";
    record(m.carcass.doorMaterialId, m.id, frontLabel);
    record(m.carcass.bodyMaterialId, m.id, "Gövde");
    if (m.carcass.countertopMaterialId) {
      record(m.carcass.countertopMaterialId, m.id, "Tezgâh");
    }
    if (m.carcass.plinthMaterialId && zone !== "wall") {
      record(m.carcass.plinthMaterialId, m.id, "Baza");
    }
    m.bays.forEach((b) => {
      if (b.door?.doorMaterialId) record(b.door.doorMaterialId, m.id, frontLabel);
      if (b.door?.handleMaterialId) record(b.door.handleMaterialId, m.id, "Kulp/Gola");
      (b.drawers || []).forEach((d) => {
        if (d.frontMaterialId) record(d.frontMaterialId, m.id, frontLabel);
      });
    });
  });

  const out: InModelMaterialUsage[] = [];
  usage.forEach((val, matId) => {
    const mat = matMap.get(matId);
    if (!mat) return;
    out.push({
      material: mat,
      moduleCount: val.modules.size,
      zonesLabelTr: Array.from(val.roles).slice(0, 2).join(" · "),
    });
  });
  return out;
}

const FAV_STORAGE_KEY = "birim_v15_fav_materials";
const RECENT_STORAGE_KEY = "birim_v15_recent_materials";

export function loadFavoriteMaterialIds(): string[] {
  if (typeof window === "undefined") {
    return [
      "mat_camsan_iskandinav_mese",
      "mat_veneer_walnut",
      "mat_lacquer_cream",
      "mat_ke_mattplus_vizon",
      "mat_neolith_calacatta_luxe",
    ];
  }
  try {
    const raw = window.localStorage.getItem(FAV_STORAGE_KEY);
    if (!raw) {
      return [
        "mat_camsan_iskandinav_mese",
        "mat_veneer_walnut",
        "mat_lacquer_cream",
        "mat_ke_mattplus_vizon",
        "mat_neolith_calacatta_luxe",
      ];
    }
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((x) => typeof x === "string") : [];
  } catch {
    return [];
  }
}

export function saveFavoriteMaterialIds(ids: string[]): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(FAV_STORAGE_KEY, JSON.stringify(ids.slice(0, 24)));
  } catch {
    // ignore storage quota
  }
}

export function loadRecentMaterialIds(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(RECENT_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((x) => typeof x === "string") : [];
  } catch {
    return [];
  }
}

export function pushRecentMaterialId(id: string): string[] {
  const prev = loadRecentMaterialIds().filter((x) => x !== id);
  const next = [id, ...prev].slice(0, 10);
  if (typeof window !== "undefined") {
    try {
      window.localStorage.setItem(RECENT_STORAGE_KEY, JSON.stringify(next));
    } catch {
      // ignore
    }
  }
  return next;
}

export interface Live3DMaterialPreviewPayload {
  materialId: string;
  scope: QuickZoneScope;
  activeModuleIndex?: number;
  replaceFromMaterialId?: string;
}

export function dispatchLive3DMaterialPreview(
  payload: Live3DMaterialPreviewPayload | null
): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent("birim:preview-material-3d", { detail: payload }));
}

export function dispatchLive3DMoodboardPreview(
  moodboard: CuratedBirimMoodboard | null
): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent("birim:preview-moodboard-3d", { detail: moodboard }));
}

export function dispatchPaintToolState3D(state: PaintTool3DState): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent("birim:set-paint-tool-3d", { detail: state }));
}


/**
 * Resolves the exact target QuickZoneScope when clicking or hovering a specific 3D mesh role
 * with the 3D Paint Brush (`mode === "paint"`), so clicking a side panel or shelf paints the
 * carcass instead of mistakenly painting doors!
 */
export function resolveSmartPaintScopeForClickedRole(
  clickedRole: string,
  configuredZoneScope: QuickZoneScope
): { scope: QuickZoneScope; surfaceLabelTr: string } {
  const r = (clickedRole || "").toLowerCase();
  if (r === "countertop") {
    return { scope: "countertops", surfaceLabelTr: "Tezgâh Tablası" };
  }
  if (r === "plinth") {
    return {
      scope: configuredZoneScope === "plinths" ? "plinths" : "active_plinth",
      surfaceLabelTr: configuredZoneScope === "plinths" ? "Tüm Bazalar" : "Bu Dolap Bazası",
    };
  }
  if (r === "door_handle" || r === "drawer_handle" || r === "gola_profile") {
    return { scope: "handles_gola", surfaceLabelTr: "Kulp & Gola Metali" };
  }
  if (
    r.startsWith("carcass_") ||
    r === "shelf" ||
    r === "sub_divider" ||
    r === "drawer_box" ||
    r === "blind_panel" ||
    r === "corner_filler"
  ) {
    return {
      scope: configuredZoneScope === "carcass_all" ? "carcass_all" : "active_carcass",
      surfaceLabelTr:
        configuredZoneScope === "carcass_all" ? "Tüm İç Gövdeler" : "Bu Dolap İç Gövdesi",
    };
  }
  if (
    configuredZoneScope === "base_cabinets" ||
    configuredZoneScope === "wall_cabinets" ||
    configuredZoneScope === "tall_and_island" ||
    configuredZoneScope === "all_fronts" ||
    configuredZoneScope === "active_module"
  ) {
    const scopeMap: Record<string, string> = {
      base_cabinets: "Tüm Alt Dolap Cepheleri",
      wall_cabinets: "Tüm Üst Dolap Cepheleri",
      tall_and_island: "Boy & Ada Cepheleri",
      all_fronts: "Tüm Proje Cepheleri",
      active_module: "Bu Dolabın Tümü",
    };
    return {
      scope: configuredZoneScope,
      surfaceLabelTr: scopeMap[configuredZoneScope] || "Dolap Cephesi",
    };
  }
  return { scope: "active_doors", surfaceLabelTr: "Bu Dolap Kapak/Çekmece Cephesi" };
}
