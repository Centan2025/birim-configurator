import type {
  DesignProject,
  DoorCrossSectionProfile,
  HandleCategory,
  ModuleInstance,
} from "@birim/core";
import { KITCHEN_TEMPLATES, WARDROBE_TEMPLATES, getV4TemplateById } from "@birim/catalog";

export type DoorShowcaseMode = "kitchen_opening_systems" | "door_profiles";

export interface ShowcaseItemSummary {
  id: string;
  index: number;
  title: string;
  subtitle: string;
  profileId?: string;
  category?: string;
}

/**
 * Generates a parallel side-by-side 3D inspection lineup on the stage so the user
 * can visually inspect every handleless/grip cross-section, upper lift mechanism,
 * and door profile model next to each other in 3D, open doors, and verify geometry.
 */
export function buildDoorSystemsShowcaseProject(
  curProj: DesignProject,
  mode: DoorShowcaseMode
): DesignProject {
  const ts = Date.now();
  const modules: ModuleInstance[] = [];
  const gapMm = 90;
  const bodyMat = "mat_melamine_white";
  const doorMat = "mat_melamine_white";
  const lacquerMat = "mat_lacquer_cream";

  const baseDoorTpl =
    KITCHEN_TEMPLATES.find((t) => t.templateId === "tpl_kitchen_base_standard") ||
    getV4TemplateById("tpl_kb_02_double_door") ||
    WARDROBE_TEMPLATES[0];
  const baseDrawerTpl =
    KITCHEN_TEMPLATES.find((t) => t.templateId === "tpl_kitchen_base_drawers") ||
    getV4TemplateById("tpl_kb_05_three_drawers") ||
    baseDoorTpl;
  const wallTpl =
    KITCHEN_TEMPLATES.find((t) => t.templateId === "tpl_kitchen_wall_standard") ||
    getV4TemplateById("tpl_kw_01_single_door") ||
    baseDoorTpl;

  if (mode === "kitchen_opening_systems") {
    const baseSpecs: Array<{
      title: string;
      isDrawer?: boolean;
      handleCategory: HandleCategory;
      handleProfileId: string;
      crossSectionProfile?: DoorCrossSectionProfile;
      useLacquer22?: boolean;
      pushToOpen?: boolean;
    }> = [
      {
        title: "1. Alüminyum Gola L-Profil (49×26)",
        handleCategory: "gola_profile",
        handleProfileId: "hnd_gola_profile",
      },
      {
        title: "2. Alüminyum Gola C-Profil (3 Çekmece)",
        isDrawer: true,
        handleCategory: "gola_profile",
        handleProfileId: "hnd_gola_c_drawer",
      },
      {
        title: "3. Melamin Gola Kutusu (60×38)",
        handleCategory: "gola_profile",
        handleProfileId: "hnd_gola_melamine_box",
      },
      {
        title: "4. Şekillendirilmiş Gömme Kutu (60×25)",
        handleCategory: "gola_profile",
        handleProfileId: "hnd_gola_moulded_box",
      },
      {
        title: "5. 30°/45° Pah + Arka Kapama Bandı",
        handleCategory: "gola_profile",
        handleProfileId: "hnd_bevel_30_backing",
        crossSectionProfile: "bevel_45",
      },
      {
        title: "6. CNC J-Kulp (22 mm Lake)",
        handleCategory: "j_pull",
        handleProfileId: "hnd_j_pull",
        crossSectionProfile: "j_pull_bevel",
        useLacquer22: true,
      },
      {
        title: "7. Kenar Geçme Alüminyum Profil",
        handleCategory: "edge_profile",
        handleProfileId: "hnd_edge_profile",
      },
      {
        title: "8. Bas-Aç Kulpsuz (TIP-ON)",
        handleCategory: "handleless_plain",
        handleProfileId: "hnd_none",
        pushToOpen: true,
      },
      {
        title: "9. Standart Çubuk Kulp (160 mm)",
        handleCategory: "bar_handle",
        handleProfileId: "hnd_bar_160",
      },
    ];

    const unitW = 600;
    const baseH = 870;
    const baseD = 580;

    baseSpecs.forEach((spec, idx) => {
      const tpl = spec.isDrawer ? baseDrawerTpl : baseDoorTpl;
      const m = tpl.createInstance(`mod_show_base_${ts}_${idx + 1}`, spec.title);
      if (spec.isDrawer && m.bays[0]) {
        m.bays[0].shelves = [];
        m.bays[0].drawers = [
          { id: `drw_${m.id}_0`, bayIndex: 0, elevationY: 0, height: 270, slideType: "soft_close" },
          { id: `drw_${m.id}_1`, bayIndex: 0, elevationY: 273, height: 220, slideType: "soft_close" },
          { id: `drw_${m.id}_2`, bayIndex: 0, elevationY: 496, height: 220, slideType: "soft_close" },
        ];
      }
      m.name = spec.title;
      m.dimensions = { width: unitW, height: baseH, depth: baseD };
      m.position = { x: idx * (unitW + gapMm), y: 0, z: 0 };
      m.rotation = { x: 0, y: 0, z: 0 };
      m.carcass = {
        ...m.carcass,
        wallAnchored: true,
        bodyMaterialId: bodyMat,
        doorMaterialId: spec.useLacquer22 ? lacquerMat : doorMat,
        plinthMaterialId: bodyMat,
        doorThickness: spec.useLacquer22 ? 22 : 18,
        plinthHeight: 100,
      };
      m.bays = (m.bays || []).map((b, bIdx) => ({
        ...b,
        index: bIdx,
        door: {
          ...b.door,
          id: `door_${m.id}_${bIdx}`,
          bayIndex: bIdx,
          type: b.door?.type || "single_left",
          doorMaterialId: spec.useLacquer22 ? lacquerMat : doorMat,
          handleCategory: spec.handleCategory,
          handleProfileId: spec.handleProfileId,
          handleType: spec.pushToOpen
            ? "push_to_open"
            : spec.handleCategory === "gola_profile" || spec.handleCategory === "j_pull"
            ? "none"
            : "standard",
          crossSectionProfile: spec.crossSectionProfile || "flat_slab",
          openingTechnology: spec.pushToOpen ? "push_to_open" : "soft_close",
          softClose: true,
        },
      }));
      modules.push(m);
    });

    // Üst Duvar Dolabı Açılım Sistemleri (Alt sıranın hemen üstünde, paralel dizili)
    const wallSpecs: Array<{
      title: string;
      doorType: "lift_bi_fold" | "lift_up_stay" | "lift_parallel" | "double";
      doorSystemId: "lift_bi_fold" | "lift_up_stay" | "lift_parallel" | "hinged_double";
      hardwareProductId: string;
      height: number;
      handleCategory: HandleCategory;
      handleProfileId: string;
      isGlass?: boolean;
      led?: boolean;
    }> = [
      {
        title: "Ü1. AVENTOS HF Katlanır + Gola 268",
        doorType: "lift_bi_fold",
        doorSystemId: "lift_bi_fold",
        hardwareProductId: "hw_blum_aventos_hf_25",
        height: 720,
        handleCategory: "gola_profile",
        handleProfileId: "hnd_gola_wall_268",
        led: true,
      },
      {
        title: "Ü2. AVENTOS HK top Tek Kalkar + Ters Dudak",
        doorType: "lift_up_stay",
        doorSystemId: "lift_up_stay",
        hardwareProductId: "hw_blum_aventos_hk_27",
        height: 560,
        handleCategory: "gola_profile",
        handleProfileId: "hnd_overhang_recessed_lip",
      },
      {
        title: "Ü3. AVENTOS HL Paralel + Bas-Aç",
        doorType: "lift_parallel",
        doorSystemId: "lift_parallel",
        hardwareProductId: "hw_blum_aventos_hl_25",
        height: 540,
        handleCategory: "handleless_plain",
        handleProfileId: "hnd_none",
      },
      {
        title: "Ü4. Füme Cam Vitrin (Çift Kapak)",
        doorType: "double",
        doorSystemId: "hinged_double",
        hardwareProductId: "hw_blum_71b3550",
        height: 720,
        handleCategory: "gola_profile",
        handleProfileId: "hnd_gola_wall_268",
        isGlass: true,
        led: true,
      },
      {
        title: "Ü5. Menteşeli Üst + Gola 268 LED",
        doorType: "double",
        doorSystemId: "hinged_double",
        hardwareProductId: "hw_blum_71b3550",
        height: 720,
        handleCategory: "gola_profile",
        handleProfileId: "hnd_gola_wall_268",
        led: true,
      },
    ];

    wallSpecs.forEach((ws, idx) => {
      const wm = wallTpl.createInstance(`mod_show_wall_${ts}_${idx + 1}`, ws.title);
      wm.name = ws.title;
      wm.dimensions = { width: unitW, height: ws.height, depth: 350 };
      wm.position = { x: idx * (unitW + gapMm), y: 1450, z: 0 };
      wm.rotation = { x: 0, y: 0, z: 0 };
      wm.carcass = {
        ...wm.carcass,
        wallAnchored: true,
        bodyMaterialId: bodyMat,
        doorMaterialId: ws.isGlass ? "mat_smoked_glass" : doorMat,
        plinthHeight: 0,
        ledLightingEnabled: Boolean(ws.led),
        ledColorTempK: 3000,
      };
      wm.bays = (wm.bays || []).map((b, bIdx) => ({
        ...b,
        index: bIdx,
        door: {
          ...b.door,
          id: `door_${wm.id}_${bIdx}`,
          bayIndex: bIdx,
          type: ws.doorType,
          doorSystemId: ws.doorSystemId,
          hardwareProductId: ws.hardwareProductId,
          doorMaterialId: ws.isGlass ? "mat_smoked_glass" : doorMat,
          isGlassFramed: Boolean(ws.isGlass),
          crossSectionProfile: ws.isGlass ? "glass_frame" : "flat_slab",
          handleCategory: ws.handleCategory,
          handleProfileId: ws.handleProfileId,
          handleType: ws.handleCategory === "handleless_plain" ? "push_to_open" : "none",
          openingTechnology: ws.handleCategory === "handleless_plain" ? "push_to_open" : "soft_close",
          softClose: true,
        },
      }));
      modules.push(wm);
    });

    // Boy Dolap — Dikey Alüminyum Gola 1020 örneği (en sağda)
    const tallTpl =
      KITCHEN_TEMPLATES.find((t) => t.templateId === "tpl_kitchen_tall_pantry") ||
      WARDROBE_TEMPLATES[0];
    const tallMod = tallTpl.createInstance(
      `mod_show_tall_${ts}`,
      "10. Dikey Gola 1020 (Boy Dolap)"
    );
    tallMod.name = "10. Dikey Gola 1020 (2 Bölmeli Boy Dolap)";
    tallMod.dimensions = { width: 900, height: 2170, depth: baseD };
    tallMod.position = { x: baseSpecs.length * (unitW + gapMm), y: 0, z: 0 };
    tallMod.rotation = { x: 0, y: 0, z: 0 };
    tallMod.carcass = {
      ...tallMod.carcass,
      wallAnchored: true,
      bodyMaterialId: bodyMat,
      doorMaterialId: doorMat,
      plinthMaterialId: bodyMat,
      plinthHeight: 100,
    };
    const baseTallBay = tallMod.bays[0];
    tallMod.bays = [0, 1].map((bIdx) => {
      const cloned = JSON.parse(JSON.stringify(baseTallBay)) as typeof baseTallBay;
      return {
        ...cloned,
        index: bIdx,
        customWidth: undefined,
        shelves: (cloned.shelves || []).map((sh, sIdx) => ({
          ...sh,
          id: `shelf_${tallMod.id}_${bIdx}_${sIdx + 1}`,
          bayIndex: bIdx,
        })),
        drawers: (cloned.drawers || []).map((dr, dIdx) => ({
          ...dr,
          id: `drw_${tallMod.id}_${bIdx}_${dIdx + 1}`,
          bayIndex: bIdx,
          isInternal: true,
        })),
        hangingRails: (cloned.hangingRails || []).map((hr, rIdx) => ({
          ...hr,
          id: `rail_${tallMod.id}_${bIdx}_${rIdx + 1}`,
          bayIndex: bIdx,
        })),
        specialFittings: (cloned.specialFittings || []).map((sf, fIdx) => ({
          ...sf,
          id: `fit_${tallMod.id}_${bIdx}_${fIdx + 1}`,
          bayIndex: bIdx,
        })),
        door: {
          ...baseTallBay.door,
          id: `door_${tallMod.id}_${bIdx}`,
          bayIndex: bIdx,
          type: bIdx === 0 ? ("single_left" as const) : ("single_right" as const),
          doorSystemId: "hinged_single" as const,
          handleCategory: "gola_profile" as const,
          handleProfileId: "hnd_gola_vertical",
          handleType: "none" as const,
          doorMaterialId: doorMat,
          softClose: true,
        },
      };
    });
    modules.push(tallMod);

    const totalWallLen = baseSpecs.length * (unitW + gapMm) + 900 + 300;
    return {
      ...curProj,
      title: "Kapak Açma & Kulpsuz Sistemler Karşılaştırma Galerisi",
      version: (curProj.version || 1) + 1,
      updatedAt: new Date().toISOString(),
      space: {
        ...curProj.space,
        type: "kitchen_straight",
        ceilingHeight: 2700,
        walls: [
          {
            id: "wall_showcase_main",
            name: "Galeri Duvarı",
            length: totalWallLen,
            height: 2700,
            thickness: 150,
            position: { x: 0, y: 0, z: 0 },
            rotationY: 0,
            elements: [],
          },
        ],
        elements: [],
        wizardCleanRoom: true,
      } as typeof curProj.space,
      modules,
    };
  }

  // Mode 2: Door Cross-Section Profiles Showcase (9 parallel full-height cabinets)
  const profileSpecs: Array<{
    title: string;
    profile: DoorCrossSectionProfile;
    isGlass?: boolean;
    matId?: string;
    useLacquer22?: boolean;
  }> = [
    { title: "1. Düz Modern (Flat Slab)", profile: "flat_slab" },
    { title: "2. Çerçeveli (Shaker)", profile: "shaker_frame", useLacquer22: true },
    { title: "3. Çıtalı / Fitilli (Fluted)", profile: "fluted_ribbed", useLacquer22: true },
    { title: "4. 45° Pahlı", profile: "bevel_45", useLacquer22: true },
    { title: "5. J-Kulplu (22 mm Lake)", profile: "j_pull_bevel", useLacquer22: true },
    { title: "6. İçbükey Kemerli (Cove)", profile: "cove_arch", useLacquer22: true },
    { title: "7. Füme Cam Çerçeveli", profile: "glass_frame", isGlass: true, matId: "mat_smoked_glass" },
    { title: "8. Tam Füme Cam (Çerçevesiz)", profile: "full_smoked_glass", isGlass: true, matId: "mat_smoked_glass" },
    { title: "9. Bronz Aynalı Çerçeveli", profile: "mirror_door", matId: "mat_bronze_mirror" },
  ];

  const unitW = 600;
  profileSpecs.forEach((ps, idx) => {
    const m = WARDROBE_TEMPLATES[0].createInstance(`mod_show_prof_${ts}_${idx + 1}`, ps.title);
    m.name = ps.title;
    m.dimensions = { width: unitW, height: 2100, depth: 560 };
    m.position = { x: idx * (unitW + gapMm), y: 0, z: 0 };
    m.rotation = { x: 0, y: 0, z: 0 };
    m.bays = [m.bays[0]];
    const resolvedDoorMat = ps.matId || (ps.useLacquer22 ? lacquerMat : doorMat);
    m.carcass = {
      ...m.carcass,
      wallAnchored: true,
      bodyMaterialId: bodyMat,
      doorMaterialId: resolvedDoorMat,
      plinthMaterialId: bodyMat,
      doorThickness: ps.useLacquer22 ? 22 : 18,
      plinthHeight: 80,
    };
    m.bays[0] = {
      ...m.bays[0],
      index: 0,
      customWidth: undefined,
      door: {
        ...m.bays[0].door,
        id: `door_${m.id}_0`,
        bayIndex: 0,
        type: "single_left",
        doorSystemId: "hinged_single",
        doorMaterialId: resolvedDoorMat,
        isGlassFramed: Boolean(ps.isGlass),
        crossSectionProfile: ps.profile,
        handleCategory: ps.profile === "j_pull_bevel" ? "j_pull" : "bar_handle",
        handleProfileId: ps.profile === "j_pull_bevel" ? "hnd_j_pull" : "hnd_bar_160",
        softClose: true,
      },
    };
    modules.push(m);
  });

  const totalWallLen = profileSpecs.length * (unitW + gapMm) + 200;
  return {
    ...curProj,
    title: "Kapak Modelleri & Kesitleri Karşılaştırma Galerisi",
    version: (curProj.version || 1) + 1,
    updatedAt: new Date().toISOString(),
    space: {
      ...curProj.space,
      type: "wardrobe_zone",
      ceilingHeight: 2600,
      walls: [
        {
          id: "wall_showcase_profiles",
          name: "Kapak Kesitleri Duvarı",
          length: totalWallLen,
          height: 2600,
          thickness: 150,
          position: { x: 0, y: 0, z: 0 },
          rotationY: 0,
          elements: [],
        },
      ],
      elements: [],
      wizardCleanRoom: true,
    } as typeof curProj.space,
    modules,
  };
}
