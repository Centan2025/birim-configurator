"use client";

import type {
  DoorCrossSectionProfile,
  EngineeringValidationFinding,
  MaterialDefinition,
} from "@birim/core";
import type { UserExperienceTier } from "../store/useConfiguratorStore";
import type { V4ModuleTemplateDefinition } from "@birim/catalog";

export type V11WorkspaceMode = "3d" | "2d" | "plan" | "showroom";
export type V11CadSubMode = "elevation" | "section" | "split";
export type V11LeftDrawerTab = null | "catalog" | "space" | "modules";
export type V11InspectorTab = "dimensions" | "interior" | "doors" | "hardware" | "materials";

export interface V11CatalogGroup {
  id: "wardrobe" | "kitchen" | "living" | "objects";
  label: string;
  subtitle: string;
}

export const V11_CATALOG_GROUPS: readonly V11CatalogGroup[] = [
  {
    id: "wardrobe",
    label: "Gardırop",
    subtitle: "Kapaklı, sürgülü, köşe gardırop ve giyinme odası modülleri",
  },
  {
    id: "kitchen",
    label: "Mutfak",
    subtitle: "Şelale mutfak adası, alt/üst dolaplar, boy kiler ve ankastre kuleler",
  },
  {
    id: "living",
    label: "Yaşam",
    subtitle: "TV bench/konsol, mutfak & yemek masaları, kitaplık, vestiyer ve banyo",
  },
  {
    id: "objects",
    label: "Eşya",
    subtitle: "Ankastre cihazlar, sandalyeler, bar taburesi, koltuk, yatak ve 65\" TV",
  },
] as const;

export function classifyTemplateGroup(
  tpl: V4ModuleTemplateDefinition
): "wardrobe" | "kitchen" | "living" {
  const id = tpl.templateId.toLowerCase();
  const name = tpl.name.toLowerCase();
  const cat = tpl.category;

  if (
    id.includes("tv_") ||
    id.includes("library") ||
    id.includes("capsule_dining") ||
    id.includes("capsule_bar") ||
    id.includes("bathroom") ||
    id.includes("vestiyer") ||
    id.includes("laundry") ||
    String(cat) === "bathroom" ||
    String(cat) === "hallway" ||
    String(cat) === "living" ||
    name.includes("tv") ||
    name.includes("konsol") ||
    name.includes("kitaplık") ||
    name.includes("masa") ||
    name.includes("banyo") ||
    name.includes("vestiyer")
  ) {
    return "living";
  }

  if (
    cat === "kitchen_base" ||
    cat === "kitchen_wall" ||
    cat === "kitchen_tall" ||
    cat === "kitchen_corner" ||
    cat === "kitchen_island" ||
    id.includes("kitchen") ||
    id.includes("coffee_pocket") ||
    name.includes("mutfak") ||
    name.includes("evye") ||
    name.includes("fırın") ||
    name.includes("kiler")
  ) {
    return "kitchen";
  }

  return "wardrobe";
}

export interface V11InteriorPresetOption {
  id: "rail_double" | "shelves_5" | "rail_drawers_3" | "mixed_combo";
  title: string;
  subtitle: string;
  diagram: "double_hang" | "shelves" | "hang_drawers" | "combo";
}

export const V11_INTERIOR_PRESETS: readonly V11InteriorPresetOption[] = [
  {
    id: "rail_double",
    title: "Çift Askı",
    subtitle: "Üst ve alt gömlek/ceket askısı",
    diagram: "double_hang",
  },
  {
    id: "shelves_5",
    title: "Çok Raflı",
    subtitle: "1 orta sabit + 4 hareketli raf",
    diagram: "shelves",
  },
  {
    id: "rail_drawers_3",
    title: "Askı + 3 Çekmece",
    subtitle: "Üst askı borusu ve 3 frenli çekmece",
    diagram: "hang_drawers",
  },
  {
    id: "mixed_combo",
    title: "Dengeli Karma",
    subtitle: "Üst raf, orta askı ve alt çekmece",
    diagram: "combo",
  },
] as const;

export interface V11DoorProfileOption {
  id: DoorCrossSectionProfile;
  label: string;
  subtitle: string;
  isGlass?: boolean;
}

export const V11_DOOR_PROFILES: readonly V11DoorProfileOption[] = [
  { id: "flat_slab", label: "Düz Modern", subtitle: "Minimalist düz panel kapak" },
  { id: "shaker_frame", label: "Çerçeveli", subtitle: "Klasik Shaker çerçeve profili" },
  { id: "fluted_ribbed", label: "Çıtalı / Fitilli", subtitle: "Dikey derzli mimari doku" },
  { id: "bevel_45", label: "45° Pahlı", subtitle: "Üst kenarı 45° kulpsuz kesim" },
  { id: "j_pull_bevel", label: "J-Kulplu", subtitle: "Entegre J-profil kulplu kapak" },
  { id: "cove_arch", label: "Kemerli", subtitle: "Yumuşak kavisli oyma profil" },
  { id: "glass_frame", label: "Füme Cam (Çerçeveli)", subtitle: "Alüminyum çerçeveli vitrin", isGlass: true },
  { id: "full_smoked_glass", label: "Tam Füme Cam", subtitle: "Kenardan kenara çerçevesiz füme cam", isGlass: true },
  { id: "center_glass_frame", label: "Ortası Camlı", subtitle: "4 kenar çerçeve + orta cam", isGlass: true },
  { id: "u_glass_open_top", label: "Ortası Camlı (Üstü Açık)", subtitle: "Üstü açık U çerçeve + orta cam", isGlass: true },
  { id: "mirror_door", label: "Aynalı (Çerçeveli)", subtitle: "İnce çerçeveli bronz/gümüş ayna" },
  { id: "mirror_frameless", label: "Aynalı (Çerçevesiz)", subtitle: "Kenardan kenara sıfır çerçeve ayna" },
] as const;

export interface V11MaterialGroup {
  id: "all" | "mdflam_uni" | "wood" | "lacquer" | "agt_suntalam" | "glass_stone";
  label: string;
}

export const V11_MATERIAL_GROUPS: readonly V11MaterialGroup[] = [
  { id: "all", label: "Tümü" },
  { id: "agt_suntalam", label: "AGT & Suntalam" },
  { id: "mdflam_uni", label: "Düz MDFLam" },
  { id: "wood", label: "Ahşap & MDFLam" },
  { id: "lacquer", label: "Supramat & Lake" },
  { id: "glass_stone", label: "Cam & Taş" },
] as const;

export function filterMaterialsByGroup(
  materials: MaterialDefinition[],
  group: V11MaterialGroup["id"]
): MaterialDefinition[] {
  // Exclude hardware-only materials (handles, LED strips, 4mm HDF back) from cabinet surface swatches
  const surfaceMaterials = materials.filter(
    (m) =>
      !m.id.startsWith("mat_led_") &&
      !m.id.startsWith("mat_handle_") &&
      m.id !== "mat_egger_4mm_hdf_back"
  );
  if (group === "all") return surfaceMaterials;
  if (group === "agt_suntalam") {
    return surfaceMaterials.filter(
      (m) =>
        m.brand === "AGT" ||
        m.name.toLowerCase().includes("suntalam") ||
        m.id.includes("suntalam") ||
        m.id.includes("_agt_")
    );
  }
  if (group === "mdflam_uni") {
    return surfaceMaterials.filter((m) => m.category === "laminate" && !m.hasGrain);
  }
  if (group === "wood") {
    return surfaceMaterials.filter(
      (m) => m.category === "wood" || (m.category === "laminate" && Boolean(m.hasGrain))
    );
  }
  if (group === "lacquer") {
    return surfaceMaterials.filter((m) => m.category === "lacquer" && !m.hasGrain);
  }
  return surfaceMaterials.filter(
    (m) =>
      m.category === "glass" ||
      m.category === "mirror" ||
      m.category === "stone" ||
      m.category === "compact"
  );
}

export function formatFindingForTier(
  finding: EngineeringValidationFinding,
  tier: "simple" | "architect" | "factory"
): { title: string; detail: string } {
  const raw = finding.message || "";
  const codeUpper = (finding.code || "").toUpperCase();

  const resolveTurkishTitle = (): string => {
    if (codeUpper === "INFO_TALL_CARCASS_NEEDS_FIXED_SHELF") {
      return "Sabit Taşıyıcı Raf Önerisi";
    }
    if (codeUpper.includes("SPAN") || codeUpper.includes("DEFLECTION") || raw.toLowerCase().includes("sehim")) {
      return "Raf Sehim & Açıklık Kontrolü";
    }
    if (codeUpper.includes("TIP") || raw.toLowerCase().includes("devrilme")) {
      return "Duvar Sabitleme Önerisi";
    }
    if (codeUpper.includes("HINGE") || raw.toLowerCase().includes("menteşe")) {
      return "Menteşe Yerleşim Kontrolü";
    }
    if (codeUpper.includes("DRAWER") || raw.toLowerCase().includes("çekmece")) {
      return "Çekmece & Donanım Kontrolü";
    }
    if (codeUpper.includes("COLLISION") || raw.toLowerCase().includes("çakış")) {
      return "Parça Çakışma Kontrolü";
    }
    return tier === "factory" ? "Teknik Üretim Kontrolü" : "Tasarım İyileştirme Önerisi";
  };

  if (tier === "factory") {
    return {
      title: resolveTurkishTitle(),
      detail: raw,
    };
  }

  const cleaned = raw
    .replace(/\b(?:DIN|TS\s*EN|EN|ISO)\s*\d+(?:[-:]\d+)?\s*(?:standardına göre\s*)?/gi, "")
    .replace(/\(\d+\s*mm\)/g, (m) => {
      const num = parseInt(m.replace(/\D/g, ""), 10);
      return Number.isFinite(num) && tier === "simple" ? `(${Math.round(num / 10)} cm)` : m;
    })
    .replace(/\s{2,}/g, " ")
    .trim();

  if (finding.code === "INFO_TALL_CARCASS_NEEDS_FIXED_SHELF") {
    return {
      title: "Sabit Taşıyıcı Raf Önerisi",
      detail:
        tier === "simple"
          ? "Yüksek raflı dolaplarda yan panellerin bel vermesini önlemek için orta kottaki rafın Sabit Raf (Minifix/Rafix) olması önerilir."
          : cleaned,
    };
  }

  if (finding.code.includes("SPAN") || raw.toLowerCase().includes("sehim")) {
    return {
      title: "Geniş Bölme Desteği Önerisi",
      detail:
        tier === "simple"
          ? "Bu bölme geniş olduğu için zamanla raf esnemesini önlemek adına 25 mm kalın raf veya ara dikme önerilir."
          : cleaned,
    };
  }

  if (finding.code.includes("TIP") || raw.toLowerCase().includes("devrilme")) {
    return {
      title: "Duvar Sabitleme Önerisi",
      detail:
        tier === "simple"
          ? "Yüksek modüllerin güvenli kullanımı için montajda duvara L-braket ile sabitlenmesi önerilir."
          : cleaned,
    };
  }

  return {
    title: "Tasarım İyileştirme Önerisi",
    detail: cleaned.charAt(0).toUpperCase() + cleaned.slice(1),
  };
}

export type ExperienceTierKey = UserExperienceTier;
