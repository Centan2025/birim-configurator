import { describe, it, expect } from "vitest";
import { getV4TemplateById, V4_MODULE_TEMPLATES } from "@birim/catalog";
import { generateModuleGeometry } from "@birim/geometry";
import { computeBayDoorZones, computeModuleStructuralSignature, createInitialProject } from "@birim/core";
import { generateBOMForProject } from "@birim/manufacturing";
import { useConfiguratorStore } from "../apps/configurator/src/store/useConfiguratorStore";
import { build3DModuleMultiHoleInstancedMesh } from "../apps/configurator/src/v3/materials/ceilingAndMultiHole3DBuilder";

function setupStoreWithTemplate(templateId: string) {
  const tpl = getV4TemplateById(templateId);
  if (!tpl) throw new Error(`Template not found: ${templateId}`);
  const mod = tpl.createInstance(`test_${templateId}`);
  const proj = createInitialProject();
  proj.title = "Mutfak Kapak Testi";
  proj.modules = [mod];
  useConfiguratorStore.setState({
    project: proj,
    activeModuleIndex: 0,
    activeBayIndex: 0,
    batchStartProject: null,
  });
  return () => useConfiguratorStore.getState().project.modules[0];
}

describe("Kitchen module door system switching", () => {
  it("converts full-height external drawer kitchen base to internal drawers and renders doors on hinged switch", () => {
    const getMod = setupStoreWithTemplate("tpl_kb_05_three_drawers");
    expect(getMod().bays[0].door.type).toBe("open");
    expect(computeBayDoorZones(getMod(), 0).length).toBe(0);

    useConfiguratorStore.getState().setBayDoorType(0, "double");
    const afterDouble = getMod();
    expect(afterDouble.bays[0].door.type).toBe("double");
    expect(afterDouble.bays[0].drawers.every((d) => d.isInternal)).toBe(true);
    const doubleDoors = generateModuleGeometry(afterDouble).components.filter(
      (c) => c.role === "door_left" || c.role === "door_right"
    );
    expect(doubleDoors.length).toBe(2);

    useConfiguratorStore.getState().setBayDoorType(0, "single_left");
    const singleDoors = generateModuleGeometry(getMod()).components.filter(
      (c) => c.role === "door_left" || c.role === "door_right"
    );
    expect(singleDoors.length).toBe(1);
    expect(singleDoors[0].role).toBe("door_left");

    useConfiguratorStore.getState().setBayDoorType(0, "open");
    const openDoors = generateModuleGeometry(getMod()).components.filter(
      (c) => c.role === "door_left" || c.role === "door_right"
    );
    expect(openDoors.length).toBe(0);
  });

  it("preserves external top drawer on drawer+door combo kitchen base when switching door type", () => {
    const getMod = setupStoreWithTemplate("tpl_kb_19_drawer_door_combo");
    expect(computeBayDoorZones(getMod(), 0).length).toBeGreaterThan(0);

    useConfiguratorStore.getState().setBayDoorType(0, "double");
    const mod = getMod();
    expect(mod.bays[0].drawers.some((d) => !d.isInternal)).toBe(true);
    const doors = generateModuleGeometry(mod).components.filter(
      (c) => c.role === "door_left" || c.role === "door_right"
    );
    expect(doors.length).toBe(2);
  });

  it("updates 90-degree L-corner door geometry across folding, double, single_left, and open", () => {
    const getMod = setupStoreWithTemplate("tpl_kb_14_l_corner");

    useConfiguratorStore.getState().setBayDoorType(0, "double");
    const dblGeo = generateModuleGeometry(getMod(), { doorOpenAngleDeg: 45 });
    const dblHandleRoots = new Set(
      dblGeo.components
        .filter((c) => c.role === "door_handle")
        .map((c) => c.id.replace(/_(handle|standoff|bar).*$/, ""))
    );
    expect(dblHandleRoots.size).toBe(2);

    useConfiguratorStore.getState().setBayDoorType(0, "single_left");
    const leftGeo = generateModuleGeometry(getMod(), { doorOpenAngleDeg: 45 });
    const leftHinges = leftGeo.components.filter((c) => c.id.includes("_lcorner_left_hinge_170_"));
    expect(leftHinges.length).toBe(2);

    useConfiguratorStore.getState().setBayDoorType(0, "open");
    const openDoors = generateModuleGeometry(getMod()).components.filter(
      (c) => c.role === "door_left" || c.role === "door_right"
    );
    expect(openDoors.length).toBe(0);
  });

  it("updates 45-degree diagonal corner door geometry across single_left, single_right, double, and open", () => {
    const getMod = setupStoreWithTemplate("tpl_kb_15_diagonal_corner");

    useConfiguratorStore.getState().setBayDoorType(0, "single_right");
    const rightDoors = generateModuleGeometry(getMod()).components.filter(
      (c) => c.role === "door_left" || c.role === "door_right"
    );
    expect(rightDoors.length).toBe(1);
    expect(rightDoors[0].role).toBe("door_right");

    useConfiguratorStore.getState().setBayDoorType(0, "double");
    const doubleDoors = generateModuleGeometry(getMod()).components.filter(
      (c) => c.role === "door_left" || c.role === "door_right"
    );
    expect(doubleDoors.length).toBe(2);

    useConfiguratorStore.getState().setBayDoorType(0, "open");
    const openDoors = generateModuleGeometry(getMod()).components.filter(
      (c) => c.role === "door_left" || c.role === "door_right"
    );
    expect(openDoors.length).toBe(0);
  });

  it("updates kitchen wall cabinet across double, single_left, and lift systems", () => {
    const getMod = setupStoreWithTemplate("tpl_kw_02_double_door");

    useConfiguratorStore.getState().setBayDoorType(0, "single_left");
    const singleDoors = generateModuleGeometry(getMod()).components.filter(
      (c) => c.role === "door_left" || c.role === "door_right"
    );
    expect(singleDoors.length).toBe(1);

    const mod = structuredClone(getMod());
    mod.bays[0].door.type = "lift_bi_fold";
    mod.bays[0].door.doorSystemId = "lift_bi_fold";
    const biFoldDoors = generateModuleGeometry(mod).components.filter(
      (c) => (c.role === "door_left" || c.role === "door_right") && c.id.includes("_lift_bifold_")
    );
    expect(biFoldDoors.length).toBe(2);
  });

  it("renders 3-drawer hnd_bevel_30_backing with top-miter on #1, joined #1-#2 (3mm), bottom-miter on #2 + top-miter on #3 across #2-#3 gap", () => {
    const getMod = setupStoreWithTemplate("tpl_kb_05_three_drawers");
    const mod = structuredClone(getMod());
    mod.bays[0].door.handleCategory = "gola_profile";
    mod.bays[0].door.handleProfileId = "hnd_bevel_30_backing";
    mod.bays[0].door.crossSectionProfile = "bevel_45";

    const geo = generateModuleGeometry(mod);
    // Sorted bottom-to-top: fronts[0] = 3. çekmece (alt), fronts[1] = 2. çekmece (orta), fronts[2] = 1. çekmece (üst)
    const fronts = geo.components
      .filter((c) => c.role === "drawer_front")
      .sort((a, b) => a.position.y - b.position.y);
    expect(fronts.length).toBe(3);

    // 1. çekmece (üst): üstten gönye burun açılı; 2. çekmece (orta): alttan açılı; 3. çekmece (alt): üstten açılı
    expect(fronts[2].bevelPullEdge).toBe("top");
    expect(fronts[1].bevelPullEdge).toBe("bottom");
    expect(fronts[0].bevelPullEdge).toBe("top");

    // 1 ve 2 birleşik (3mm fuga); 2 ve 3 arasında 30mm tutma boşluğu
    expect(Math.round(fronts[2].position.y - (fronts[1].position.y + fronts[1].dimensions.height))).toBe(3);
    expect(Math.round(fronts[1].position.y - (fronts[0].position.y + fronts[0].dimensions.height))).toBe(30);

    // Sadece üstte (1. çekmece arkası) ve 2-3 arasında arka bant (toplam 2 adet), 0 adet C-Gola
    const backingStrips = geo.components.filter((c) => c.id.includes("gola_bevel_backing"));
    const cGolaChannels = geo.components.filter((c) => c.id.includes("gola_c_channel"));
    expect(backingStrips.length).toBe(2);
    expect(cGolaChannels.length).toBe(0);
  });

  it("suppresses System 32 shelf pin holes on drawer-only kitchen bases and aligns carcass_back + drawer bottom/back joinery", () => {
    const modMetal = getV4TemplateById("tpl_kb_05_three_drawers")!.createInstance("audit_3drw");
    const geoMetal = generateModuleGeometry(modMetal);

    // 1) Hareketli raf olmayan 3 çekmeceli alt dolapta 3B ve CNC çoklu delik (shelf_pin) üretilmez
    expect(build3DModuleMultiHoleInstancedMesh(modMetal, geoMetal.components)).toBeNull();
    const bomMetal = generateBOMForProject({ ...createInitialProject(), modules: [modMetal] });
    const leftSideBom = bomMetal.cutList.find((p) => p.componentRole === "carcass_side_left")!;
    expect((leftSideBom.holes || []).filter((h) => h.purpose === "shelf_pin").length).toBe(0);

    // 2) Mutfak alt dolap kanallı arkalığı altta 8mm taban kanalına, üstte 8mm üst arka kayıt kanalına (height - T + 8) oturur
    const backComp = geoMetal.components.find((c) => c.role === "carcass_back")!;
    const rearStretcher = geoMetal.components.find((c) => c.id.includes("_top_stretcher_rear"))!;
    expect(rearStretcher.position.z).toBe(0);
    expect(backComp.position.y).toBe((modMetal.carcass.plinthHeight || 0) + (modMetal.carcass.panelThickness || 18) - 8);
    expect(backComp.position.y + backComp.dimensions.height).toBe(
      modMetal.dimensions.height - (modMetal.carcass.panelThickness || 18) + 8
    );
    const rearStretcherBom = bomMetal.cutList.find((p) => p.id.includes("_top_stretcher_rear"))!;
    expect(rearStretcherBom.hasBackGroove).toBe(true);

    // 3) Metal kasa (LEGRABOX): üst çekmece >=75mm, alt tencere çekmeceleri >=140mm; arkalık tabanın tam üstünde biter
    const mSides = geoMetal.components
      .filter((c) => c.role === "drawer_side_left")
      .sort((a, b) => a.position.y - b.position.y);
    expect(mSides[2].dimensions.height).toBeGreaterThanOrEqual(75);
    expect(mSides[0].dimensions.height).toBeGreaterThanOrEqual(140);
    for (const dr of modMetal.bays[0].drawers) {
      const dBot = geoMetal.components.find((c) => c.id === `${dr.id}_bottom`)!;
      const dBack = geoMetal.components.find((c) => c.id === `${dr.id}_back`)!;
      expect(dBack.position.y).toBe(dBot.position.y + dBot.dimensions.height);
      expect(dBot.position.z).toBe(dBack.position.z);
    }

    // 4) Ahşap gizli raylı kasa (Blum MOVENTO): 4 parçalı iç ön kasalı (sub_front), TAM BOY 16mm arkalık (yanlarla aynı alt hizada, altta 13mm kanca eteği!),
    //    8mm taban 4 kenardan (sol/sağ yan + iç ön kasa + tam boy arkalık) 6mm kanala oturur
    const modWood = structuredClone(modMetal);
    modWood.carcass.drawerBoxSystem = "wooden_undermount";
    modWood.bays[0].drawers.forEach((d) => {
      d.boxSystemType = "wooden_undermount";
      d.hardwareProductId = "hw_blum_movento_760h";
    });
    const geoWood = generateModuleGeometry(modWood);
    for (const dr of modWood.bays[0].drawers) {
      const dSide = geoWood.components.find((c) => c.id === `${dr.id}_side_left`)!;
      const dSubFront = geoWood.components.find((c) => c.id === `${dr.id}_sub_front`)!;
      const dBot = geoWood.components.find((c) => c.id === `${dr.id}_bottom`)!;
      const dBack = geoWood.components.find((c) => c.id === `${dr.id}_back`)!;
      const dSlide = geoWood.components.find((c) => c.id === `${dr.id}_slide_left`)!;
      expect(dSubFront).toBeDefined();
      expect(dBot.dimensions.height).toBe(8);
      // Tam boy arkalık yanlarla aynı taban hizasında başlar (altta 13mm gizli ray arka kanca eteği!)
      expect(dBack.position.y).toBe(dSide.position.y);
      expect(dBot.position.y - dBack.position.y).toBe(13);
      // 8mm taban arkada 16mm arkalığın 6mm kanalına girer (z = back.z + 16 - 6 = back.z + 10)
      expect(dBot.position.z).toBe(dBack.position.z + 10);
      // 8mm taban önde 16mm iç ön kasanın 6mm kanalına girer (z = subFront.z + 6)
      expect(dBot.position.z + dBot.dimensions.depth).toBe(dSubFront.position.z + 6);
      // Gizli ray tabanın tam alt yüzüne kadar oturur (sıfır çakışma)
      expect(dSlide.position.y + dSlide.dimensions.height).toBeLessThanOrEqual(dBot.position.y + 0.5);
    }
    const bomWood = generateBOMForProject({ ...createInitialProject(), title: "Wood Drawer", modules: [modWood] });
    for (const role of ["drawer_side_left", "drawer_side_right", "drawer_box", "drawer_back"] as const) {
      const p = bomWood.cutList.find((item) => item.componentRole === role);
      expect(p?.hasDrawerBottomGroove, `BOM groove on ${role}`).toBe(true);
    }

    // 5) Blum TANDEMBOX Antaro: derin tencere çekmecelerinde 83mm metal yanak + üst galeri borusu üretilir
    const modTandem = structuredClone(modMetal);
    modTandem.carcass.drawerBoxSystem = "metal_box_tandembox";
    modTandem.bays[0].drawers.forEach((d) => {
      d.boxSystemType = "metal_box_tandembox";
      d.hardwareProductId = d.height >= 205 ? "hw_blum_tandembox_d65" : "hw_blum_tandembox_m30";
    });
    const geoTandem = generateModuleGeometry(modTandem);
    expect(geoTandem.components.some((c) => c.id.includes("_tandem_gallery_"))).toBe(true);
    expect(geoTandem.components.some((c) => c.id.includes("_sub_front"))).toBe(false);

    // 6) carcass.drawerBoxSystem değiştiğinde 3B önbellek imzası (computeModuleStructuralSignature) mutlaka yenilenir
    const modSigA = structuredClone(modMetal);
    modSigA.carcass.drawerBoxSystem = "metal_box_legrabox";
    const modSigB = structuredClone(modSigA);
    modSigB.carcass.drawerBoxSystem = "wooden_undermount";
    const modSigC = structuredClone(modSigA);
    modSigC.carcass.drawerBoxSystem = "metal_box_tandembox";
    const modSigD = structuredClone(modSigA);
    modSigD.carcass.drawerBoxSystem = "metal_box_avantech";
    const sigs = new Set([
      computeModuleStructuralSignature(modSigA),
      computeModuleStructuralSignature(modSigB),
      computeModuleStructuralSignature(modSigC),
      computeModuleStructuralSignature(modSigD),
    ]);
    expect(sigs.size).toBe(4);
  });

  it("enforces zero 3D mechanical collisions (drawer box vs Gola/backing, runners vs floor/bottom/Gola, stacked drawers, shelves) across all 45 kitchen templates and handle modes", () => {
    const kitchenTemplates = V4_MODULE_TEMPLATES.filter((t) =>
      t.familyId.startsWith("fam_kitchen_")
    );
    expect(kitchenTemplates.length).toBeGreaterThanOrEqual(40);

    const overlap1D = (a0: number, a1: number, b0: number, b1: number, tol = 0.5) =>
      Math.min(a1, b1) - Math.max(a0, b0) > tol;

    const assertZeroDrawerMechanicalCollisions = (label: string, mod: ReturnType<typeof kitchenTemplates[number]["createInstance"]>) => {
      const geo = generateModuleGeometry(mod);
      const T = mod.carcass.panelThickness || 18;
      const floorY = (mod.carcass.plinthHeight || 0) + T;
      const golas = geo.components.filter((c) => c.role === "gola_profile");
      const shelves = geo.components.filter((c) => c.role === "shelf");
      const backPanel = geo.components.find((c) => c.role === "carcass_back");
      const backFrontZ = backPanel ? backPanel.position.z + backPanel.dimensions.depth : 0;

      for (const bay of mod.bays) {
        const sortedDrws = [...(bay.drawers || [])]
          .filter((d) => !d.isHidden)
          .sort((a, b) => a.elevationY - b.elevationY);

        for (let i = 0; i < sortedDrws.length; i++) {
          const dr = sortedDrws[i];
          const dSide = geo.components.find((c) => c.id === `${dr.id}_side_left`);
          const dBack = geo.components.find((c) => c.id === `${dr.id}_back`);
          const dBot = geo.components.find((c) => c.id === `${dr.id}_bottom`);
          const dSlide = geo.components.find((c) => c.id === `${dr.id}_slide_left`);
          if (!dSide || !dBack || !dBot || !dSlide) continue;

          const boxY0 = dSide.position.y;
          const boxY1 = dSide.position.y + dSide.dimensions.height;
          const slideY0 = dSlide.position.y;
          const slideY1 = dSlide.position.y + dSlide.dimensions.height;
          const botY0 = dBot.position.y;

          // 1) Ray alt tablanın üstünde, çekmece tabanının altında olmalı (sıfır çakışma!)
          expect(slideY0, `${label}:${dr.id}:slideAboveFloor`).toBeGreaterThanOrEqual(floorY);
          expect(slideY1, `${label}:${dr.id}:slideBelowBottom`).toBeLessThanOrEqual(botY0 + 0.5);

          // 2) Çekmece kasası arkalığa çarpmamalı
          if (backPanel) {
            expect(dBack.position.z, `${label}:${dr.id}:clearOfBack`).toBeGreaterThanOrEqual(backFrontZ + 4);
          }

          // 3) Çekmece kasası (+Z açılma hattı boyunca) hiçbir sabit Gola / arka bant ile Y'de çakışmamalı!
          for (const g of golas) {
            if ((g.bayIndex ?? 0) !== (dr.bayIndex ?? 0)) continue;
            const gY0 = g.position.y;
            const gY1 = g.position.y + g.dimensions.height;
            const boxHitsGola = overlap1D(boxY0, boxY1, gY0, gY1, 0.5);
            expect(boxHitsGola, `${label}:${dr.id}:box[${boxY0}..${boxY1}] vs ${g.id}[${gY0}..${gY1}]`).toBe(false);

            // Ray da (+Z çekmece açılma hattı boyunca) hiçbir sabit Gola / gömme kutu ile Y'de çakışmamalı!
            const slideHitsGola = overlap1D(slideY0, slideY1, gY0, gY1, 0.5);
            expect(slideHitsGola, `${label}:${dr.id}:slide[${slideY0}..${slideY1}] vs ${g.id}[${gY0}..${gY1}]`).toBe(false);
          }

          // 4) Üst üste çekmecelerde alt çekmece kasası üst çekmece rayına/kasasına çarpmamalı!
          if (i < sortedDrws.length - 1) {
            const upperDr = sortedDrws[i + 1];
            const upperSlide = geo.components.find((c) => c.id === `${upperDr.id}_slide_left`);
            const upperSide = geo.components.find((c) => c.id === `${upperDr.id}_side_left`);
            if (upperSlide) {
              expect(boxY1, `${label}:${dr.id}->${upperDr.id}:boxBelowUpperSlide`).toBeLessThanOrEqual(
                upperSlide.position.y + 0.5
              );
            }
            if (upperSide) {
              expect(boxY1, `${label}:${dr.id}->${upperDr.id}:boxBelowUpperBox`).toBeLessThanOrEqual(
                upperSide.position.y + 0.5
              );
            }
          }

          // 5) Çekmece kasası bölmedeki raflarla çakışmamalı!
          for (const sh of shelves) {
            if ((sh.bayIndex ?? 0) !== (dr.bayIndex ?? 0)) continue;
            const shY0 = sh.position.y;
            const shY1 = sh.position.y + sh.dimensions.height;
            const hitsShelf = overlap1D(boxY0, boxY1, shY0, shY1, 0.5);
            expect(hitsShelf, `${label}:${dr.id}:box[${boxY0}..${boxY1}] vs shelf[${shY0}..${shY1}]`).toBe(false);
          }
        }
      }
    };

    // Test 3-drawer kitchen base across ALL handle styles & both box systems (LEGRABOX + MOVENTO)
    for (const boxSys of ["metal_box_legrabox", "wooden_undermount"] as const) {
      for (const hCfg of [
        { name: "bar", cat: "bar_handle" as const, pid: "hnd_bar_160", prof: "flat_slab" as const },
        { name: "gola_lc", cat: "gola_profile" as const, pid: "hnd_gola_c_drawer", prof: "flat_slab" as const },
        { name: "moulded_box", cat: "gola_profile" as const, pid: "hnd_gola_moulded_box", prof: "flat_slab" as const },
        { name: "melamine_box", cat: "gola_profile" as const, pid: "hnd_gola_melamine_box", prof: "flat_slab" as const },
        { name: "bevel30", cat: "gola_profile" as const, pid: "hnd_bevel_30_backing", prof: "bevel_45" as const },
        { name: "jpull", cat: "j_pull" as const, pid: "hnd_j_pull", prof: "j_pull_bevel" as const },
      ]) {
        const m = getV4TemplateById("tpl_kb_05_three_drawers")!.createInstance(`kin_${boxSys}_${hCfg.name}`);
        m.carcass.drawerBoxSystem = boxSys;
        m.bays[0].door.handleCategory = hCfg.cat;
        m.bays[0].door.handleProfileId = hCfg.pid;
        m.bays[0].door.crossSectionProfile = hCfg.prof;
        m.bays[0].drawers.forEach((d) => {
          d.boxSystemType = boxSys;
          d.hardwareProductId = boxSys === "wooden_undermount" ? "hw_blum_movento_760h" : "hw_blum_legrabox_c70";
        });
        assertZeroDrawerMechanicalCollisions(`3drw_${boxSys}_${hCfg.name}`, m);

        const gCheck = generateModuleGeometry(m);
        if (hCfg.name === "moulded_box") {
          expect(gCheck.components.some((c) => c.id.includes("gola_moulded_box_mid"))).toBe(true);
          expect(gCheck.components.some((c) => c.id.includes("gola_c_channel"))).toBe(false);
          expect(gCheck.components.some((c) => c.id.includes("gola_fixing_bracket"))).toBe(false);
        }
        if (hCfg.name === "melamine_box") {
          expect(gCheck.components.some((c) => c.id.includes("gola_melamine_box_mid"))).toBe(true);
          expect(gCheck.components.some((c) => c.id.includes("gola_c_channel"))).toBe(false);
          expect(gCheck.components.some((c) => c.id.includes("gola_fixing_bracket"))).toBe(false);
        }
        if (hCfg.name === "jpull") {
          const jFronts = gCheck.components.filter((c) => c.role === "drawer_front");
          expect(jFronts.length).toBe(3);
          for (const jf of jFronts) {
            expect(jf.crossSectionProfile).toBe("j_pull_bevel");
            expect(jf.jPullEdge).toBe("top");
            expect(jf.dimensions.depth).toBeGreaterThanOrEqual(22);
          }
          expect(gCheck.components.some((c) => c.role === "gola_profile")).toBe(false);
        }
      }
    }

    // Test ALL V4_MODULE_TEMPLATES across ALL categories (kitchen, wardrobe, walk-in, bath, tv, library, entryway, office)
    for (const tpl of V4_MODULE_TEMPLATES) {
      const mod = tpl.createInstance(`audit_${tpl.templateId}`);
      assertZeroDrawerMechanicalCollisions(tpl.templateId, mod);

      // Also stress-test every external-drawer template with L+C Gola and 45-deg Bevel + Arka Bant!
      const hasExtDrw = mod.bays.some((b) => b.drawers.some((d) => !d.isInternal && !d.isHidden));
      if (hasExtDrw && mod.category !== "kitchen_wall" && mod.category !== "complementary") {
        for (const hCfg of [
          { name: "gola_lc", pid: "hnd_gola_c_drawer", prof: "flat_slab" as const },
          { name: "bevel30", pid: "hnd_bevel_30_backing", prof: "bevel_45" as const },
        ]) {
          const gm = structuredClone(mod);
          gm.bays.forEach((b) => {
            b.door.handleCategory = "gola_profile";
            b.door.handleProfileId = hCfg.pid;
            b.door.crossSectionProfile = hCfg.prof;
          });
          assertZeroDrawerMechanicalCollisions(`${tpl.templateId}_${hCfg.name}`, gm);
        }
      }

      const geo = generateModuleGeometry(mod);
      expect(geo.components.length, tpl.templateId).toBeGreaterThan(0);

      for (const comp of geo.components) {
        expect(comp.dimensions.width, `${tpl.templateId}:${comp.id}:w`).toBeGreaterThan(0);
        expect(comp.dimensions.height, `${tpl.templateId}:${comp.id}:h`).toBeGreaterThan(0);
        expect(comp.dimensions.depth, `${tpl.templateId}:${comp.id}:d`).toBeGreaterThan(0);
      }

      const bom = generateBOMForProject({ ...createInitialProject(), modules: [mod] });
      for (const piece of bom.cutList) {
        for (const hole of piece.holes || []) {
          expect(hole.x, `${tpl.templateId}:${piece.id}:${hole.id}:x`).toBeGreaterThanOrEqual(0);
          expect(hole.x, `${tpl.templateId}:${piece.id}:${hole.id}:xMax`).toBeLessThanOrEqual(piece.widthMm + 0.5);
          expect(hole.y, `${tpl.templateId}:${piece.id}:${hole.id}:y`).toBeGreaterThanOrEqual(0);
          expect(hole.y, `${tpl.templateId}:${piece.id}:${hole.id}:yMax`).toBeLessThanOrEqual(piece.lengthMm + 0.5);
        }
      }
    }
  });
});
