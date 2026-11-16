import { DEFAULT_MATERIALS } from "./defaults";
import { calculateBayWidths, roundMm } from "./rules";
import type {
  CeilingType,
  DesignProject,
  GrainContinuityMode,
  MaterialDefinition,
  ModuleInstance,
  MultiHoleBoringMode,
  SpaceCeilingConfig,
  SpaceDefinition,
} from "./types";

// ============================================================================
// 1. ÇOKLU DELİK SİSTEMİ (SYSTEM 32 MULTI-HOLE LINE BORING) KATALOĞU & ÇÖZÜCÜSÜ
// ============================================================================

export interface MultiHoleModeDescriptor {
  id: MultiHoleBoringMode;
  label: string;
  shortLabel: string;
  description: string;
}

export const MULTI_HOLE_MODE_CATALOG: MultiHoleModeDescriptor[] = [
  {
    id: "full_system_32",
    label: "Tam Boy Sistem 32 (32mm Adım)",
    shortLabel: "Tam Boy 32mm",
    description:
      "Alt ve üst kenar payları arasında 32mm adımlarla kesintisiz ön+arka (veya 3 sıra) endüstriyel çoklu delik dizisi.",
  },
  {
    id: "zone_32",
    label: "Bölgesel Orta Kuşak (32mm)",
    shortLabel: "Bölgesel 32mm",
    description:
      "Gövdenin yalnızca aktif orta %55 kuşağında 32mm adımlı sıra delik açar; alt ve üst görünür yüzeyler temiz kalır.",
  },
  {
    id: "cluster_5",
    label: "5'li Ayar Kümesi (±64mm)",
    shortLabel: "5'li Küme",
    description:
      "Her hareketli raf kotunun etrafında -64 / -32 / 0 / +32 / +64 mm olmak üzere 5 kademeli delik grubu açar.",
  },
  {
    id: "cluster_3",
    label: "3'lü Ayar Kümesi (±32mm)",
    shortLabel: "3'lü Küme",
    description:
      "Her hareketli raf kotunun etrafında -32 / 0 / +32 mm olmak üzere 3 kademeli delik grubu açar.",
  },
  {
    id: "single_pin",
    label: "Tekli Raf Pimi (Minimal)",
    shortLabel: "Tekli Delik",
    description:
      "Yalnızca rafların bulunduğu net kotta tekli Ø5mm pim deliği açar; vitrin ve açık raflarda delik izi bırakmaz.",
  },
  {
    id: "none",
    label: "Sıra Delik Yok (Sabit Raflı)",
    shortLabel: "Deliksiz",
    description:
      "Gövde iç yüzeylerinde Ø5mm raf pimi deliği açılmaz; yalnızca sabit (minifix/kavela) raflarla kullanılabilir.",
  },
];

export interface ResolvedMultiHoleSpec {
  mode: MultiHoleBoringMode;
  rowCount: 2 | 3;
  frontSetbackMm: number;
  edgeMarginMm: number;
  dividerThroughBore: boolean;
  showIn3DRender: boolean;
}

export function resolveMultiHoleSpec(
  mod: Pick<ModuleInstance, "carcass" | "dimensions">
): ResolvedMultiHoleSpec {
  const c = mod.carcass;
  const mode: MultiHoleBoringMode = c.multiHoleMode || "full_system_32";
  const requestedRows = c.multiHoleRowCount === 3 && mod.dimensions.depth >= 480 ? 3 : 2;
  const frontSetbackMm = Math.max(28, Math.min(120, c.multiHoleFrontSetbackMm ?? c.system32FrontSetback ?? 37));
  const edgeMarginMm = Math.max(48, Math.min(192, c.multiHoleEdgeMarginMm ?? 96));
  const dividerThroughBore = Boolean(c.multiHoleDividerThroughBore);
  const showIn3DRender = c.showMultiHolesIn3D !== false;

  return {
    mode,
    rowCount: requestedRows,
    frontSetbackMm,
    edgeMarginMm,
    dividerThroughBore,
    showIn3DRender,
  };
}

/**
 * Verilen yan dikme veya ara dikme yüksekliği (`panelHeightMm`), alt/üst ofsetler ve
 * hareketli raf kotlarına (`adjustableShelfYsMm`) göre delinmesi gereken net Y koordinatlarını
 * (32mm System 32 ızgarasına kilitli veya küme merkezli) döndürür.
 */
export function computeSystem32MultiHoleYs(params: {
  mode: MultiHoleBoringMode;
  panelHeightMm: number;
  bottomOffsetY?: number;
  panelThicknessMm?: number;
  edgeMarginMm?: number;
  adjustableShelfYsMm?: number[];
  blockedYsMm?: Array<{ y: number; clearanceMm: number }>;
}): number[] {
  const {
    mode,
    panelHeightMm,
    bottomOffsetY = 0,
    panelThicknessMm = 18,
    edgeMarginMm = 96,
    adjustableShelfYsMm = [],
    blockedYsMm = [],
  } = params;

  if (mode === "none" || panelHeightMm < 180) {
    return [];
  }

  const minSafeY = Math.max(bottomOffsetY + panelThicknessMm + Math.max(48, edgeMarginMm), panelThicknessMm > 0 ? 160 : 96);
  const maxSafeY = panelHeightMm - (panelThicknessMm + Math.max(48, edgeMarginMm));
  if (maxSafeY < minSafeY) return [];

  const candidateSet = new Set<number>();

  if (mode === "full_system_32") {
    for (let y = minSafeY; y <= maxSafeY + 0.01; y += 32) {
      candidateSet.add(roundMm(y, 2));
    }
  } else if (mode === "zone_32") {
    const span = maxSafeY - minSafeY;
    const zoneStart = minSafeY + Math.floor((span * 0.2) / 32) * 32;
    const zoneEnd = minSafeY + Math.ceil((span * 0.8) / 32) * 32;
    for (let y = Math.max(minSafeY, zoneStart); y <= Math.min(maxSafeY, zoneEnd) + 0.01; y += 32) {
      candidateSet.add(roundMm(y, 2));
    }
    // Ayrıca bu kuşağın dışında kalan hareketli raflar varsa onların kendi pim deliklerini de ekle
    for (const sy of adjustableShelfYsMm) {
      if (sy >= 32 && sy <= panelHeightMm - 32) {
        candidateSet.add(roundMm(sy, 2));
      }
    }
  } else if (mode === "single_pin" || mode === "cluster_3" || mode === "cluster_5") {
    const deltas =
      mode === "single_pin"
        ? [0]
        : mode === "cluster_3"
        ? [-32, 0, 32]
        : [-64, -32, 0, 32, 64];

    for (const baseY of adjustableShelfYsMm) {
      for (const dy of deltas) {
        const y = roundMm(baseY + dy, 2);
        if (y >= bottomOffsetY + panelThicknessMm + 28 && y <= panelHeightMm - panelThicknessMm - 28) {
          candidateSet.add(y);
        }
      }
    }
  }

  return Array.from(candidateSet)
    .sort((a, b) => a - b)
    .filter((y) => !blockedYsMm.some((blk) => Math.abs(blk.y - y) < blk.clearanceMm));
}

// ============================================================================
// 2. MİMARİ TAVAN SİSTEMİ & TAVAN TİPLERİ (3D RENDER + 2D ÖN GÖRÜNÜŞ + KOT HESABI)
// ============================================================================

export interface CeilingTypeDescriptor {
  id: CeilingType;
  label: string;
  shortLabel: string;
  icon: string;
  defaultDropHeightMm: number;
  description: string;
}

export const CEILING_TYPE_CATALOG: CeilingTypeDescriptor[] = [
  {
    id: "flat_plaster",
    label: "Düz Alçıpan / Sıva Tavan",
    shortLabel: "Düz Tavan",
    icon: "━",
    defaultDropHeightMm: 0,
    description: "Standart düz sıva veya alçıpan tavan; net oda yüksekliği tam kullanılır.",
  },
  {
    id: "dropped_perimeter_cove",
    label: "Havuz Tavan (Gizli LED Bantlı)",
    shortLabel: "Havuz LED",
    icon: "⊏",
    defaultDropHeightMm: 160,
    description:
      "Çepeçevre alçıpan düşük bant ve iç havuzda 3000K gizli LED ışık bandı; duvar önündeki dolap kotunu düşüm kadar sınırlar.",
  },
  {
    id: "gypsum_soffit_bulkhead",
    label: "Dolap Üstü Alçıpan Alın Kutusu (Soffit)",
    shortLabel: "Alın Kutusu",
    icon: "▛",
    defaultDropHeightMm: 200,
    description:
      "Yalnızca dolap hattı boyunca inen alçıpan alın/tesisat kutusu; gömme dolap görünümü ve davlumbaz borusu gizleme sağlar.",
  },
  {
    id: "exposed_wood_beams",
    label: "Ahşap / Betonarme Kirişli Tavan",
    shortLabel: "Kirişli",
    icon: "╦",
    defaultDropHeightMm: 140,
    description:
      "Düzenli aralıklarla geçen mimari ahşap veya betonarme tavan kirişleri; kapak açılımı kiriş alt kotuna göre doğrulanır.",
  },
  {
    id: "coffered_baffle",
    label: "Akustik Ahşap Çıtalı (Baffle) Tavan",
    shortLabel: "Baffle Çıtalı",
    icon: "▤",
    defaultDropHeightMm: 90,
    description:
      "Lineer ahşap akustik çıtalar ve gömme lineer aydınlatma; tavan alt kotunda çıta yüksekliği kadar net düşüm oluşturur.",
  },
  {
    id: "sloped_attic",
    label: "Eğimli Çatı / Çatı Katı Tavanı",
    shortLabel: "Eğimli Çatı",
    icon: "⟋",
    defaultDropHeightMm: 0,
    description:
      "Diz duvarı kotundan (H_diz) belirli açıyla yükselen çatı tavanı; modüllerin her X/Z noktasındaki tavan yüksekliği analitik hesaplanır.",
  },
];

export function resolveSpaceCeilingConfig(space: SpaceDefinition): Required<SpaceCeilingConfig> {
  const raw = space.ceilingConfig;
  const ceilingType: CeilingType =
    raw?.ceilingType ||
    (space.slopedCeiling && space.slopedCeiling.mode !== "none" ? "sloped_attic" : "flat_plaster");

  const defaultDrop =
    ceilingType === "dropped_perimeter_cove"
      ? 160
      : ceilingType === "gypsum_soffit_bulkhead"
      ? 200
      : ceilingType === "exposed_wood_beams"
      ? 140
      : ceilingType === "coffered_baffle"
      ? 90
      : 0;

  return {
    enabled: raw?.enabled ?? false,
    ceilingType,
    showIn3D: raw?.showIn3D ?? true,
    showInElevation2D: raw?.showInElevation2D ?? true,
    translucentCutawayIn3D: raw?.translucentCutawayIn3D ?? false,
    dropHeightMm: Math.max(0, Math.min(1200, raw?.dropHeightMm ?? defaultDrop)),
    soffitDepthMm: Math.max(200, Math.min(1500, raw?.soffitDepthMm ?? 620)),
    beamHeightMm: Math.max(40, Math.min(600, raw?.beamHeightMm ?? 140)),
    beamWidthMm: Math.max(40, Math.min(400, raw?.beamWidthMm ?? 100)),
    beamSpacingMm: Math.max(300, Math.min(2400, raw?.beamSpacingMm ?? 900)),
    bafflePitchMm: Math.max(50, Math.min(400, raw?.bafflePitchMm ?? 120)),
    hasHiddenLedCove: raw?.hasHiddenLedCove ?? ceilingType === "dropped_perimeter_cove",
    hasRecessedSpots: raw?.hasRecessedSpots ?? true,
    slopeKneeHeightMm: Math.max(
      600,
      Math.min(
        space.ceilingHeight || 2600,
        raw?.slopeKneeHeightMm ?? space.slopedCeiling?.kneeHeightMm ?? 1850
      )
    ),
    slopeAngleDeg: Math.max(
      5,
      Math.min(65, raw?.slopeAngleDeg ?? space.slopedCeiling?.slopeAngleDeg ?? 22)
    ),
    slopeDirection:
      raw?.slopeDirection ??
      (space.slopedCeiling?.mode === "right_slope"
        ? "right_to_left"
        : space.slopedCeiling?.mode === "back_slope"
        ? "back_to_front"
        : "left_to_right"),
    colorHex: raw?.colorHex || "#F5F3EE",
  };
}

export interface EffectiveCeilingClearanceResult {
  rawCeilingHeightMm: number;
  minClearHeightMm: number;
  maxClearHeightMm: number;
  dropAmountMm: number;
  ceilingType: CeilingType;
  reasonLabel: string;
}

/**
 * Verilen (xMm..xMm+widthMm, zMm..zMm+depthMm) modül oturum alanında seçilen tavan tipinin
 * bıraktığı gerçek minimum kullanılabilir net yüksekliği (mm) analitik olarak hesaplar.
 */
export function computeEffectiveCeilingClearHeight(
  space: SpaceDefinition,
  xMm: number,
  widthMm: number,
  zMm = 0,
  depthMm = 600
): EffectiveCeilingClearanceResult {
  const rawH = space.ceilingHeight || 2600;
  const cfg = resolveSpaceCeilingConfig(space);

  // Tavan özelliği kapalıysa ve eski slopedCeiling de yoksa tam tavan yüksekliği geçerlidir
  if (!cfg.enabled && (!space.slopedCeiling || space.slopedCeiling.mode === "none")) {
    return {
      rawCeilingHeightMm: rawH,
      minClearHeightMm: rawH,
      maxClearHeightMm: rawH,
      dropAmountMm: 0,
      ceilingType: "flat_plaster",
      reasonLabel: "Düz Tavan",
    };
  }

  if (cfg.ceilingType === "flat_plaster") {
    return {
      rawCeilingHeightMm: rawH,
      minClearHeightMm: rawH,
      maxClearHeightMm: rawH,
      dropAmountMm: 0,
      ceilingType: cfg.ceilingType,
      reasonLabel: "Düz Alçıpan Tavan",
    };
  }

  if (cfg.ceilingType === "dropped_perimeter_cove" || cfg.ceilingType === "gypsum_soffit_bulkhead") {
    // Duvar önündeki soffitDepthMm kuşağında modül varsa düşüm uygulanır
    const overlapsSoffitZone = zMm < cfg.soffitDepthMm;
    const drop = overlapsSoffitZone ? cfg.dropHeightMm : 0;
    const clearH = Math.max(800, rawH - drop);
    return {
      rawCeilingHeightMm: rawH,
      minClearHeightMm: clearH,
      maxClearHeightMm: overlapsSoffitZone ? clearH : rawH,
      dropAmountMm: drop,
      ceilingType: cfg.ceilingType,
      reasonLabel:
        cfg.ceilingType === "dropped_perimeter_cove"
          ? `Havuz Tavan Kenar Bandı (-${drop}mm)`
          : `Dolap Üstü Alçıpan Alın Kutusu (-${drop}mm)`,
    };
  }

  if (cfg.ceilingType === "exposed_wood_beams") {
    const drop = cfg.beamHeightMm;
    const clearH = Math.max(800, rawH - drop);
    return {
      rawCeilingHeightMm: rawH,
      minClearHeightMm: clearH,
      maxClearHeightMm: rawH,
      dropAmountMm: drop,
      ceilingType: cfg.ceilingType,
      reasonLabel: `Kirişli Tavan Alt Kotu (-${drop}mm)`,
    };
  }

  if (cfg.ceilingType === "coffered_baffle") {
    const drop = cfg.dropHeightMm;
    const clearH = Math.max(800, rawH - drop);
    return {
      rawCeilingHeightMm: rawH,
      minClearHeightMm: clearH,
      maxClearHeightMm: clearH,
      dropAmountMm: drop,
      ceilingType: cfg.ceilingType,
      reasonLabel: `Akustik Baffle Çıta Alt Kotu (-${drop}mm)`,
    };
  }

  // Eğimli Çatı (`sloped_attic`)
  const mainWallLen = space.walls?.[0]?.length || 3600;
  const tanAlpha = Math.tan((cfg.slopeAngleDeg * Math.PI) / 180);
  const evalAt = (px: number, pz: number): number => {
    let dist = px;
    if (cfg.slopeDirection === "right_to_left") {
      dist = Math.max(0, mainWallLen - px);
    } else if (cfg.slopeDirection === "back_to_front") {
      dist = Math.max(0, pz);
    }
    return Math.min(rawH, roundMm(cfg.slopeKneeHeightMm + Math.max(0, dist) * tanAlpha, 1));
  };

  const h1 = evalAt(xMm, zMm);
  const h2 = evalAt(xMm + widthMm, zMm);
  const h3 = evalAt(xMm, zMm + depthMm);
  const h4 = evalAt(xMm + widthMm, zMm + depthMm);
  const minClear = Math.min(h1, h2, h3, h4);
  const maxClear = Math.max(h1, h2, h3, h4);

  return {
    rawCeilingHeightMm: rawH,
    minClearHeightMm: minClear,
    maxClearHeightMm: maxClear,
    dropAmountMm: roundMm(rawH - minClear, 1),
    ceilingType: "sloped_attic",
    reasonLabel: `Eğimli Çatı (Diz Kotu ${cfg.slopeKneeHeightMm}mm, ${cfg.slopeAngleDeg}°)`,
  };
}

/**
 * 2D Ön Görünüşte herhangi bir X (mm) koordinatındaki tavan alt kotunu döndürür.
 */
export function sampleCeilingClearHeightAtX(space: SpaceDefinition, xMm: number): number {
  return computeEffectiveCeilingClearHeight(space, xMm, 1, 0, 580).minClearHeightMm;
}

// ============================================================================
// 3. DESENLİ MALZEMEDE DESEN TAKİBİ (CONTINUOUS GRAIN & VEIN MATCHING ENGINE)
// ============================================================================

export interface GrainContinuityModeDescriptor {
  id: GrainContinuityMode;
  label: string;
  shortLabel: string;
  description: string;
}

export const GRAIN_CONTINUITY_CATALOG: GrainContinuityModeDescriptor[] = [
  {
    id: "none",
    label: "Bağımsız Kesim (Standart)",
    shortLabel: "Bağımsız",
    description: "Her kapak ve çekmece klapası en az fire verecek şekilde bağımsız yerleştirilir.",
  },
  {
    id: "module_vertical",
    label: "Dikey Suyolu Takibi (Bölme İçi)",
    shortLabel: "Dikey Suyolu",
    description:
      "Aynı bölmedeki üst üste çekmeceler ve kapaklar tek plaka şeridinden sırayla kesilir; damar alttan üste kesintisiz akar.",
  },
  {
    id: "module_4way",
    label: "Modül Tam Cephe (4-Yönlü Takip)",
    shortLabel: "Modül Cephe",
    description:
      "Modüldeki tüm kapak ve çekmeceler hem dikey hem yatayda tek bir kaplama/mermer plaka koordinatından eşlenir.",
  },
  {
    id: "facade_continuous",
    label: "Modüller Arası Sürekli Cephe Takibi",
    shortLabel: "Tam Cephe",
    description:
      "Yan yana dizili tüm modüllerin desenli ön yüzleri 2770mm plaka boyu boyunca modülden modüle kesintisiz devam eder.",
  },
];

export function isPatternedMaterial(mat: MaterialDefinition | undefined | null): boolean {
  if (!mat) return false;
  return Boolean(
    mat.hasGrain ||
      mat.category === "wood" ||
      mat.category === "stone" ||
      mat.textureUrl
  );
}

export interface ContinuousGrainPartAssignment {
  componentId: string;
  moduleId: string;
  bayIndex: number;
  role: "door" | "drawer_front";
  grainGroupId: string;
  mode: GrainContinuityMode;
  /** Grup sol-alt referansından milimetrik X ofseti (3D UV & 2D Nesting X koordinatı) */
  offsetXMm: number;
  /** Grup sol-alt referansından milimetrik Y ofseti (3D UV & 2D Nesting Y koordinatı) */
  offsetYMm: number;
  widthMm: number;
  heightMm: number;
  /** Plaka 2770mm sınırını aştığında kaçıncı plaka dilimine geçtiği (1-tabanlı) */
  sheetSliceIndex: number;
  sequenceIndex: number;
  totalInGroup: number;
  sequenceLabel: string;
  grainDirection: "lengthwise" | "crosswise";
}

/**
 * Projede desen takibi aktif olan tüm modül kapak ve çekmece klapaları için
 * **hem 3D GPU UV faz ofsetlerini hem de üretim/ERP Nesting `grainGroupId` kesim koordinatlarını**
 * tek bir merkezden deterministik olarak hesaplar.
 */
export function computeProjectGrainContinuityMap(
  project: Pick<DesignProject, "modules" | "customMaterials" | "facadeGrainContinuity">,
  materialsMap?: Map<string, MaterialDefinition>
): Map<string, ContinuousGrainPartAssignment> {
  const matLookup =
    materialsMap ||
    new Map([...DEFAULT_MATERIALS, ...(project.customMaterials || [])].map((m) => [m.id, m]));

  const assignments = new Map<string, ContinuousGrainPartAssignment>();
  const USABLE_SHEET_ALONG_MM = 2770; // 2800mm - 2*15mm baş kesim tıraş payı
  const USABLE_SHEET_ACROSS_MM = 2040; // 2070mm - 2*15mm kenar tıraş payı

  // Modülleri soldan sağa sırala (modüller arası cephe takibi için)
  const sortedModules = [...(project.modules || [])].sort(
    (a, b) => a.position.x - b.position.x || a.position.z - b.position.z
  );

  // Önce tüm ön cephe parçalarını topla
  interface RawFrontEntry {
    componentId: string;
    moduleId: string;
    modIndex: number;
    bayIndex: number;
    role: "door" | "drawer_front";
    materialId: string;
    explicitGroupId?: string;
    effectiveMode: GrainContinuityMode;
    grainDirection: "lengthwise" | "crosswise";
    worldLeftXMm: number;
    worldBottomYMm: number;
    localLeftXMm: number;
    localBottomYMm: number;
    widthMm: number;
    heightMm: number;
  }

  const rawEntries: RawFrontEntry[] = [];

  sortedModules.forEach((mod, modOrderIdx) => {
    if (mod.isOpenFront || mod.category === "complementary") return;
    const mode: GrainContinuityMode = project.facadeGrainContinuity
      ? "facade_continuous"
      : mod.carcass.grainContinuityMode || "none";

    const T = mod.carcass.panelThickness || 18;
    const plinthH = mod.carcass.plinthHeight || 0;
    const gap = mod.carcass.doorPerimeterGap ?? 2;
    const bayWidths = calculateBayWidths(mod);

    let cursorBayX = T;
    mod.bays.forEach((bay, bIdx) => {
      const bayW = bayWidths[bIdx] || 500;
      const bayLeftLocalX = cursorBayX - T / 2 + gap;
      const bayOuterW = Math.max(60, bayW + T - 2 * gap);
      cursorBayX += bayW + T;

      const resolveDoorMatId =
        mod.componentMaterialOverrides?.[`door_${bay.index}`] ||
        bay.door?.doorMaterialId ||
        mod.carcass.doorMaterialId;
      const doorMat = matLookup.get(resolveDoorMatId);
      const grainOverride =
        mod.componentGrainOverrides?.__doors__ ||
        mod.componentGrainOverrides?.__all__ ||
        "lengthwise";
      const grainDir: "lengthwise" | "crosswise" =
        grainOverride === "crosswise" ? "crosswise" : "lengthwise";

      // Dış çekmeceler (isInternal !== true)
      const extDrawers = (bay.drawers || [])
        .filter((d) => !d.isHidden && !d.isInternal)
        .sort((a, b) => a.elevationY - b.elevationY);

      let maxExtDrawerTopLocalY = plinthH;
      extDrawers.forEach((drw) => {
        const drwCompId = `${drw.id}_front`;
        const drwMatId =
          mod.componentMaterialOverrides?.[drwCompId] ||
          drw.frontMaterialId ||
          resolveDoorMatId;
        const drwMat = matLookup.get(drwMatId);
        if (!drw.grainGroupId && (mode === "none" || !isPatternedMaterial(drwMat))) {
          maxExtDrawerTopLocalY = Math.max(
            maxExtDrawerTopLocalY,
            plinthH + drw.elevationY + drw.height
          );
          return;
        }
        const localBottomY = plinthH + drw.elevationY + gap;
        const drwH = Math.max(60, drw.height - gap);
        maxExtDrawerTopLocalY = Math.max(
          maxExtDrawerTopLocalY,
          plinthH + drw.elevationY + drw.height
        );

        const drwGrainOvr =
          mod.componentGrainOverrides?.[drwCompId] ||
          mod.componentGrainOverrides?.__drawers__ ||
          grainDir;

        rawEntries.push({
          componentId: drwCompId,
          moduleId: mod.id,
          modIndex: modOrderIdx,
          bayIndex: bIdx,
          role: "drawer_front",
          materialId: drwMatId,
          explicitGroupId: drw.grainGroupId,
          effectiveMode: drw.grainGroupId ? "module_vertical" : mode,
          grainDirection: drwGrainOvr === "crosswise" ? "crosswise" : "lengthwise",
          worldLeftXMm: roundMm(mod.position.x + bayLeftLocalX, 1),
          worldBottomYMm: roundMm(mod.position.y + localBottomY, 1),
          localLeftXMm: roundMm(bayLeftLocalX, 1),
          localBottomYMm: roundMm(localBottomY, 1),
          widthMm: roundMm(bayOuterW, 1),
          heightMm: roundMm(drwH, 1),
        });
      });

      // Kapaklar
      if (bay.door && bay.door.type !== "open" && bay.door.doorSystemId !== "open") {
        if (!bay.door.grainGroupId && (mode === "none" || !isPatternedMaterial(doorMat))) {
          return;
        }
        const doorBottomLocalY = Math.max(plinthH + gap, maxExtDrawerTopLocalY + gap);
        const doorTopLocalY = mod.dimensions.height - gap;
        const doorH = Math.max(80, doorTopLocalY - doorBottomLocalY);
        const isLiftBiFold =
          bay.door.type === "lift_bi_fold" || bay.door.doorSystemId === "lift_bi_fold";
        const isDouble =
          bay.door.type === "double" ||
          bay.door.type === "inset_double" ||
          bay.door.doorSystemId === "hinged_double" ||
          bay.door.type === "sliding" ||
          bay.door.type === "sliding_bottom" ||
          bay.door.doorSystemId === "folding_bifold";

        if (isLiftBiFold) {
          const halfGap = 2;
          const halfH = Math.max(60, (doorH - halfGap) / 2);
          [
            { suffix: "lift_bifold_bot", yOff: 0 },
            { suffix: "lift_bifold_top", yOff: halfH + halfGap },
          ].forEach((seg) => {
            rawEntries.push({
              componentId: `${bay.door!.id}_${seg.suffix}`,
              moduleId: mod.id,
              modIndex: modOrderIdx,
              bayIndex: bIdx,
              role: "door",
              materialId: resolveDoorMatId,
              explicitGroupId: bay.door!.grainGroupId,
              effectiveMode: bay.door!.grainGroupId ? "module_vertical" : mode,
              grainDirection: grainDir,
              worldLeftXMm: roundMm(mod.position.x + bayLeftLocalX, 1),
              worldBottomYMm: roundMm(mod.position.y + doorBottomLocalY + seg.yOff, 1),
              localLeftXMm: roundMm(bayLeftLocalX, 1),
              localBottomYMm: roundMm(doorBottomLocalY + seg.yOff, 1),
              widthMm: roundMm(bayOuterW, 1),
              heightMm: roundMm(halfH, 1),
            });
          });
        } else if (isDouble) {
          const centerGap = mod.carcass.centerRevealGapMm ?? 3;
          const leafW = Math.max(50, (bayOuterW - centerGap) / 2);
          (["left", "right"] as const).forEach((side, sIdx) => {
            const leafId = `${bay.door!.id}_leaf_${side}`;
            const lx = bayLeftLocalX + sIdx * (leafW + centerGap);
            rawEntries.push({
              componentId: leafId,
              moduleId: mod.id,
              modIndex: modOrderIdx,
              bayIndex: bIdx,
              role: "door",
              materialId: resolveDoorMatId,
              explicitGroupId: bay.door!.grainGroupId,
              effectiveMode: bay.door!.grainGroupId ? "module_4way" : mode,
              grainDirection: grainDir,
              worldLeftXMm: roundMm(mod.position.x + lx, 1),
              worldBottomYMm: roundMm(mod.position.y + doorBottomLocalY, 1),
              localLeftXMm: roundMm(lx, 1),
              localBottomYMm: roundMm(doorBottomLocalY, 1),
              widthMm: roundMm(leafW, 1),
              heightMm: roundMm(doorH, 1),
            });
          });
        } else {
          // Tek kapak (3D mesh-generator `${door.id}_left` / `${door.id}_right` üretir)
          rawEntries.push({
            componentId: bay.door.id,
            moduleId: mod.id,
            modIndex: modOrderIdx,
            bayIndex: bIdx,
            role: "door",
            materialId: resolveDoorMatId,
            explicitGroupId: bay.door.grainGroupId,
            effectiveMode: bay.door.grainGroupId ? "module_vertical" : mode,
            grainDirection: grainDir,
            worldLeftXMm: roundMm(mod.position.x + bayLeftLocalX, 1),
            worldBottomYMm: roundMm(mod.position.y + doorBottomLocalY, 1),
            localLeftXMm: roundMm(bayLeftLocalX, 1),
            localBottomYMm: roundMm(doorBottomLocalY, 1),
            widthMm: roundMm(bayOuterW, 1),
            heightMm: roundMm(doorH, 1),
          });
        }
      }
    });
  });

  // Gruplama anahtarlarını oluştur
  const buckets = new Map<string, RawFrontEntry[]>();
  for (const entry of rawEntries) {
    let groupKey: string;
    if (entry.explicitGroupId) {
      groupKey = entry.explicitGroupId;
    } else if (entry.effectiveMode === "facade_continuous") {
      // Plaka 2770mm sınırını aşan çok geniş cepheleri malzeme bazında dilimle
      groupKey = `DT_CEPHE_${entry.materialId}`;
    } else if (entry.effectiveMode === "module_4way") {
      groupKey = `DT_MOD_${entry.moduleId}_${entry.materialId}`;
    } else {
      groupKey = `DT_DIKEY_${entry.moduleId}_B${entry.bayIndex}_${entry.materialId}`;
    }
    const arr = buckets.get(groupKey) || [];
    arr.push(entry);
    buckets.set(groupKey, arr);
  }

  buckets.forEach((members, baseGroupId) => {
    // Soldan sağa, alttan üste deterministik sıralama
    members.sort(
      (a, b) =>
        a.worldLeftXMm - b.worldLeftXMm ||
        a.worldBottomYMm - b.worldBottomYMm ||
        a.componentId.localeCompare(b.componentId)
    );

    const minWorldX = Math.min(...members.map((m) => m.worldLeftXMm));
    const minWorldY = Math.min(...members.map((m) => m.worldBottomYMm));

    members.forEach((m, idx) => {
      const relX = roundMm(m.worldLeftXMm - minWorldX, 1);
      const relY = roundMm(m.worldBottomYMm - minWorldY, 1);
      const spanAlongSheet =
        m.grainDirection === "crosswise" ? relX + m.widthMm : relY + m.heightMm;
      const spanAcrossSheet =
        m.grainDirection === "crosswise" ? relY + m.heightMm : relX + m.widthMm;
      const sliceAlong = Math.max(1, Math.ceil(Math.max(1, spanAlongSheet) / USABLE_SHEET_ALONG_MM));
      const sliceAcross = Math.max(1, Math.ceil(Math.max(1, spanAcrossSheet) / USABLE_SHEET_ACROSS_MM));
      const sliceIdx = (sliceAcross - 1) * 10 + sliceAlong;
      const finalGroupId =
        !m.explicitGroupId && (sliceAlong > 1 || sliceAcross > 1)
          ? `${baseGroupId}_P${sliceAcross}x${sliceAlong}`
          : baseGroupId;

      const localSliceOffsetX =
        m.grainDirection === "crosswise"
          ? roundMm(relX - (sliceAlong - 1) * USABLE_SHEET_ALONG_MM, 1)
          : roundMm(relX - (sliceAcross - 1) * USABLE_SHEET_ACROSS_MM, 1);
      const localSliceOffsetY =
        m.grainDirection === "crosswise"
          ? roundMm(relY - (sliceAcross - 1) * USABLE_SHEET_ACROSS_MM, 1)
          : roundMm(relY - (sliceAlong - 1) * USABLE_SHEET_ALONG_MM, 1);

      const assignment: ContinuousGrainPartAssignment = {
        componentId: m.componentId,
        moduleId: m.moduleId,
        bayIndex: m.bayIndex,
        role: m.role,
        grainGroupId: finalGroupId,
        mode: m.effectiveMode,
        // 3D UV kesintisiz cephe koordinatını korurken 2D plaka dilimi sınır bilgisini sheetSliceIndex ile taşır
        offsetXMm: !m.explicitGroupId && (sliceAlong > 1 || sliceAcross > 1) ? Math.max(0, localSliceOffsetX) : relX,
        offsetYMm: !m.explicitGroupId && (sliceAlong > 1 || sliceAcross > 1) ? Math.max(0, localSliceOffsetY) : relY,
        widthMm: m.widthMm,
        heightMm: m.heightMm,
        sheetSliceIndex: sliceIdx,
        sequenceIndex: idx + 1,
        totalInGroup: members.length,
        sequenceLabel: `${finalGroupId} [${idx + 1}/${members.length}]`,
        grainDirection: m.grainDirection,
      };

      assignments.set(m.componentId, assignment);
      // 3D mesh-generator (`_leaf_left`, `_leaf_right`, `_left`, `_right`, `_sliding_front`, `_fold_wing_1` vb.) ve BOM takma adlarını birebir eşle
      if (m.role === "door") {
        if (m.componentId.endsWith("_leaf_left")) {
          const baseDoorId = m.componentId.slice(0, -"_leaf_left".length);
          assignments.set(`${baseDoorId}_left`, assignment);
          assignments.set(`${baseDoorId}_sliding_front`, assignment);
          assignments.set(`${baseDoorId}_fold_wing_1`, assignment);
        } else if (m.componentId.endsWith("_leaf_right")) {
          const baseDoorId = m.componentId.slice(0, -"_leaf_right".length);
          assignments.set(`${baseDoorId}_right`, assignment);
          assignments.set(`${baseDoorId}_sliding_rear`, assignment);
          assignments.set(`${baseDoorId}_fold_wing_2`, assignment);
        } else if (!m.componentId.includes("_lift_bifold_")) {
          assignments.set(`${m.componentId}_left`, assignment);
          assignments.set(`${m.componentId}_right`, assignment);
          assignments.set(`${m.componentId}_single`, assignment);
          assignments.set(`${m.componentId}_leaf`, assignment);
          assignments.set(`${m.componentId}_lift_stay`, assignment);
          assignments.set(`${m.componentId}_lift_parallel`, assignment);
          assignments.set(`${m.componentId}_pocket_leaf`, assignment);
          assignments.set(`${m.componentId}_tambour_curtain`, assignment);
        }
      }
    });
  });

  return assignments;
}

export interface GrainNeighborRef {
  componentId: string;
  shortSeqBadge: string;
  partShortLabel: string;
  gapMm: number;
}

export interface GrainPartNeighborInfo {
  componentId: string;
  cutPieceId: string;
  moduleId: string;
  bayIndex: number;
  role: "door" | "drawer_front";
  partShortLabel: string;
  grainGroupId: string;
  mode: GrainContinuityMode;
  sequenceIndex: number;
  totalInGroup: number;
  shortSeqBadge: string;
  grainDirection: "lengthwise" | "crosswise";
  arrowSymbol: "↑" | "→";
  directionLabelTr: string;
  directionLabelAscii: string;
  offsetXMm: number;
  offsetYMm: number;
  widthMm: number;
  heightMm: number;
  sheetSliceIndex: number;
  leftNeighbor?: GrainNeighborRef;
  rightNeighbor?: GrainNeighborRef;
  bottomNeighbor?: GrainNeighborRef;
  topNeighbor?: GrainNeighborRef;
  compactNeighborTextTr: string;
  compactNeighborAscii: string;
}

function inferGrainPartShortLabel(componentId: string, bayIndex: number, role: "door" | "drawer_front"): string {
  const bayNo = bayIndex + 1;
  if (role === "drawer_front") {
    return `${bayNo}.Bölme Çekmece`;
  }
  if (componentId.endsWith("_leaf_left") || componentId.endsWith("_left")) {
    return `${bayNo}.Bölme Sol Kapak`;
  }
  if (componentId.endsWith("_leaf_right") || componentId.endsWith("_right")) {
    return `${bayNo}.Bölme Sağ Kapak`;
  }
  if (componentId.endsWith("_lift_bifold_bot")) {
    return `${bayNo}.Bölme Alt Katlanır Kapak`;
  }
  if (componentId.endsWith("_lift_bifold_top")) {
    return `${bayNo}.Bölme Üst Katlanır Kapak`;
  }
  return `${bayNo}.Bölme Tek Kapak`;
}

/**
 * Desen takibi aktif olan tüm kapak ve çekmece klapaları için:
 * - `[1/N]` montaj sıra rozetini,
 * - Damar (suyolu) akış yönü okunu (`↑ DİKEY SUYOLU` / `→ YATAY SUYOLU`),
 * - Sol / Sağ / Alt / Üst bitişik cephe komşu parça referanslarını
 * hem `componentId` hem de BOM kesim parça kimliği (`P_${moduleId}_${componentId}`) ile indeksleyerek döndürür.
 */
export function computeProjectGrainNeighborMap(
  project: Pick<DesignProject, "modules" | "customMaterials" | "facadeGrainContinuity">,
  materialsMap?: Map<string, MaterialDefinition>
): Map<string, GrainPartNeighborInfo> {
  const continuityMap = computeProjectGrainContinuityMap(project, materialsMap);
  const result = new Map<string, GrainPartNeighborInfo>();
  if (continuityMap.size === 0) return result;

  // Yalnızca birincil (alias olmayan) atamaları grupla
  const groupBuckets = new Map<string, ContinuousGrainPartAssignment[]>();
  continuityMap.forEach((assign, key) => {
    if (key !== assign.componentId) return;
    const arr = groupBuckets.get(assign.grainGroupId) || [];
    arr.push(assign);
    groupBuckets.set(assign.grainGroupId, arr);
  });

  const primaryByCompId = new Map<string, GrainPartNeighborInfo>();

  groupBuckets.forEach((members) => {
    members.sort((a, b) => a.sequenceIndex - b.sequenceIndex);

    for (const cur of members) {
      let bestLeft: { cand: ContinuousGrainPartAssignment; gap: number; overlap: number } | null = null;
      let bestRight: { cand: ContinuousGrainPartAssignment; gap: number; overlap: number } | null = null;
      let bestBottom: { cand: ContinuousGrainPartAssignment; gap: number; overlap: number } | null = null;
      let bestTop: { cand: ContinuousGrainPartAssignment; gap: number; overlap: number } | null = null;

      const curX0 = cur.offsetXMm;
      const curX1 = cur.offsetXMm + cur.widthMm;
      const curY0 = cur.offsetYMm;
      const curY1 = cur.offsetYMm + cur.heightMm;

      for (const other of members) {
        if (other.componentId === cur.componentId) continue;
        const othX0 = other.offsetXMm;
        const othX1 = other.offsetXMm + other.widthMm;
        const othY0 = other.offsetYMm;
        const othY1 = other.offsetYMm + other.heightMm;

        const yOverlap = Math.min(curY1, othY1) - Math.max(curY0, othY0);
        const xOverlap = Math.min(curX1, othX1) - Math.max(curX0, othX0);

        if (yOverlap > 25) {
          const leftGap = curX0 - othX1;
          if (leftGap >= -6 && leftGap <= 85) {
            if (
              !bestLeft ||
              (Math.abs(leftGap - bestLeft.gap) > 8
                ? leftGap < bestLeft.gap
                : yOverlap > bestLeft.overlap)
            ) {
              bestLeft = { cand: other, gap: roundMm(Math.max(0, leftGap), 1), overlap: yOverlap };
            }
          }
          const rightGap = othX0 - curX1;
          if (rightGap >= -6 && rightGap <= 85) {
            if (
              !bestRight ||
              (Math.abs(rightGap - bestRight.gap) > 8
                ? rightGap < bestRight.gap
                : yOverlap > bestRight.overlap)
            ) {
              bestRight = { cand: other, gap: roundMm(Math.max(0, rightGap), 1), overlap: yOverlap };
            }
          }
        }

        if (xOverlap > 25) {
          const bottomGap = curY0 - othY1;
          if (bottomGap >= -6 && bottomGap <= 85) {
            if (
              !bestBottom ||
              (Math.abs(bottomGap - bestBottom.gap) > 8
                ? bottomGap < bestBottom.gap
                : xOverlap > bestBottom.overlap)
            ) {
              bestBottom = { cand: other, gap: roundMm(Math.max(0, bottomGap), 1), overlap: xOverlap };
            }
          }
          const topGap = othY0 - curY1;
          if (topGap >= -6 && topGap <= 85) {
            if (
              !bestTop ||
              (Math.abs(topGap - bestTop.gap) > 8
                ? topGap < bestTop.gap
                : xOverlap > bestTop.overlap)
            ) {
              bestTop = { cand: other, gap: roundMm(Math.max(0, topGap), 1), overlap: xOverlap };
            }
          }
        }
      }

      const toRef = (
        hit: { cand: ContinuousGrainPartAssignment; gap: number } | null
      ): GrainNeighborRef | undefined => {
        if (!hit) return undefined;
        return {
          componentId: hit.cand.componentId,
          shortSeqBadge: `[${hit.cand.sequenceIndex}/${hit.cand.totalInGroup}]`,
          partShortLabel: inferGrainPartShortLabel(
            hit.cand.componentId,
            hit.cand.bayIndex,
            hit.cand.role
          ),
          gapMm: hit.gap,
        };
      };

      const leftNeighbor = toRef(bestLeft);
      const rightNeighbor = toRef(bestRight);
      const bottomNeighbor = toRef(bestBottom);
      const topNeighbor = toRef(bestTop);

      const trParts: string[] = [];
      const asciiParts: string[] = [];
      if (leftNeighbor) {
        trParts.push(`← SOL:${leftNeighbor.shortSeqBadge}`);
        asciiParts.push(`SOL:${leftNeighbor.shortSeqBadge}`);
      }
      if (rightNeighbor) {
        trParts.push(`→ SAĞ:${rightNeighbor.shortSeqBadge}`);
        asciiParts.push(`SAG:${rightNeighbor.shortSeqBadge}`);
      }
      if (bottomNeighbor) {
        trParts.push(`↓ ALT:${bottomNeighbor.shortSeqBadge}`);
        asciiParts.push(`ALT:${bottomNeighbor.shortSeqBadge}`);
      }
      if (topNeighbor) {
        trParts.push(`↑ ÜST:${topNeighbor.shortSeqBadge}`);
        asciiParts.push(`UST:${topNeighbor.shortSeqBadge}`);
      }

      const isVerticalVein = cur.grainDirection !== "crosswise";
      const shortSeqBadge = `[${cur.sequenceIndex}/${cur.totalInGroup}]`;
      const cutPieceId = `P_${cur.moduleId}_${cur.componentId}`;

      const info: GrainPartNeighborInfo = {
        componentId: cur.componentId,
        cutPieceId,
        moduleId: cur.moduleId,
        bayIndex: cur.bayIndex,
        role: cur.role,
        partShortLabel: inferGrainPartShortLabel(cur.componentId, cur.bayIndex, cur.role),
        grainGroupId: cur.grainGroupId,
        mode: cur.mode,
        sequenceIndex: cur.sequenceIndex,
        totalInGroup: cur.totalInGroup,
        shortSeqBadge,
        grainDirection: cur.grainDirection,
        arrowSymbol: isVerticalVein ? "↑" : "→",
        directionLabelTr: isVerticalVein ? "DİKEY SUYOLU ↑" : "YATAY SUYOLU →",
        directionLabelAscii: isVerticalVein ? "DIKEY SUYOLU (^)" : "YATAY SUYOLU (->)",
        offsetXMm: cur.offsetXMm,
        offsetYMm: cur.offsetYMm,
        widthMm: cur.widthMm,
        heightMm: cur.heightMm,
        sheetSliceIndex: cur.sheetSliceIndex,
        leftNeighbor,
        rightNeighbor,
        bottomNeighbor,
        topNeighbor,
        compactNeighborTextTr: trParts.length > 0 ? trParts.join(" • ") : "Tekil Referans",
        compactNeighborAscii: asciiParts.length > 0 ? asciiParts.join(" ") : "TEKIL REFERANS",
      };

      primaryByCompId.set(cur.componentId, info);
      result.set(cur.componentId, info);
      result.set(cutPieceId, info);
    }
  });

  // Takma ad (alias) anahtarlarını da hem componentId hem P_<modId>_<alias> olarak eşle
  continuityMap.forEach((assign, aliasKey) => {
    const primary = primaryByCompId.get(assign.componentId);
    if (!primary) return;
    result.set(aliasKey, primary);
    result.set(`P_${assign.moduleId}_${aliasKey}`, primary);
  });

  return result;
}
