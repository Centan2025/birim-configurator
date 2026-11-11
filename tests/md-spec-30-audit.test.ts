import { describe, it, expect } from "vitest";
import {
  createInitialProject,
  createDefaultWardrobeModule,
  calculateNetInnerDepth,
  calculateFourSpaceDimensions,
  validateModule,
  validateProject,
  autoFixModuleIssues,
  buildRecursivePartitionTree,
  evaluateSlidingDoorDeadZones,
  computeContinuousKitchenLayers,
  computeGolaSidePanelNotches,
} from "@birim/core";
import { getV4TemplateById, createKitchenLinearProject } from "@birim/catalog";
import { generateModuleGeometry, generateCrossSection2D } from "@birim/geometry";
import {
  generateBOMForProject,
  generatePanelDXF,
  exportOptiCutCutListCsv,
  generateNestingDiagramSvg,
  generateThermalPartLabelsHtml,
  exportIndustrialCamZipArchive,
} from "@birim/manufacturing";

describe("MD Teknik Spesifikasyon — 30 Kritik Mühendislik Maddesi Doğrulama Test Paketi", () => {
  it("Madde 1 & 2: Kanallı arkalık net iç derinlik formülü (560 - 18 - 8 = 534mm -> 550mm ray sığmaz!) ve 5 arkalık modu", () => {
    const kb = getV4TemplateById("tpl_kb_05_three_drawers")!.createInstance("kb_560");
    kb.dimensions.depth = 560;
    kb.carcass.backPanelType = "grooved";
    kb.carcass.backOffsetMm = 18;
    kb.carcass.backPanelThickness = 8;

    expect(calculateNetInnerDepth(kb)).toBe(534);

    // 550mm ray 534mm iç derinliğe sığmaz -> autoFix 500mm raya düşürür
    kb.bays[0].drawers[0].nominalLengthMm = 550;
    const { updatedModule } = autoFixModuleIssues(kb);
    expect(updatedModule.bays[0].drawers[0].nominalLengthMm).toBe(500);

    // Arkadan çakma (nailed) modunda iç derinlik tam gövde derinliğidir (560mm), toplam derinlik +8mm artar
    kb.carcass.backPanelType = "nailed";
    expect(calculateNetInnerDepth(kb)).toBe(560);
    const fsNailed = calculateFourSpaceDimensions(kb);
    expect(fsNailed.externalCarcass.depthMm).toBe(568);
  });

  it("Madde 3 & 4: Kenar bandı + Ön Freze (Pre-milling) kesim düşümü ve Suyolu (crosswise) Boy/En eksen takası", () => {
    const proj = createInitialProject();
    const mod = proj.modules[0];
    // Ön frezesiz (p_mill = 0), 1mm 4 kenar bant -> bitmiş ölçüden 2mm düşer
    mod.carcass.preMillingMm = 0;
    const bom0 = generateBOMForProject(proj);
    const door0 = bom0.cutList.find((p) => p.componentRole === "door_left")!;
    expect(door0.netCutLengthMm).toBe(door0.lengthMm - 2);
    expect(door0.netCutWidthMm).toBe(door0.widthMm - 2);

    // Ön freze = 1mm, bant = 1mm -> makine 1mm kazıyıp 1mm yapıştırır, net kesim = bitmiş ölçü!
    const projMill = JSON.parse(JSON.stringify(proj));
    projMill.modules[0].carcass.preMillingMm = 1;
    const bomMill = generateBOMForProject(projMill);
    const doorMill = bomMill.cutList.find((p) => p.componentRole === "door_left")!;
    expect(doorMill.netCutLengthMm).toBe(doorMill.lengthMm);
    expect(doorMill.netCutWidthMm).toBe(doorMill.widthMm);

    // Suyolu crosswise seçildiğinde Boy (lengthMm) ve En (widthMm) yer değiştirir!
    const projCross = JSON.parse(JSON.stringify(proj));
    projCross.modules[0].componentGrainOverrides = { __doors__: "crosswise" };
    const bomCross = generateBOMForProject(projCross);
    const doorCross = bomCross.cutList.find((p) => p.componentRole === "door_left")!;
    expect(doorCross.lengthMm).toBe(door0.widthMm);
    expect(doorCross.widthMm).toBe(door0.lengthMm);
  });

  it("Madde 5, 6 & 8: İç çekmece 25mm besleme çıtası / 155° menteşe, Sürgü ölü bölge çakışması ve Yarım/Tam deveboynu menteşe", () => {
    // Sürgü kapak ölü bölge (dead zone) testi: 2 kanat sürgüde 3 bölmeli gardırobun orta bölmesine çekmece konulursa kapağa çarpar!
    const slideMod = createDefaultWardrobeModule("slide_dead");
    slideMod.dimensions.width = 1800;
    slideMod.bays = [
      { ...slideMod.bays[0], index: 0, drawers: [] },
      { ...slideMod.bays[1], index: 1 }, // Orta bölmede çekmeceler var!
      { ...slideMod.bays[0], index: 2, drawers: [] },
    ];
    slideMod.bays.forEach((b) => {
      b.customWidth = undefined;
      b.door.type = "sliding";
      b.door.doorSystemId = "sliding_top_hung";
    });
    // 2 kanat sürgü varsayımıyla 3 bölmede orta bölme [606..1194] her iki yanda da binme bölgesine girer
    const deadIssues = evaluateSlidingDoorDeadZones(slideMod, 80);
    // 3 eşit bölmede 3 kanat kapak olduğunda (width=640) orta bölme [606..1194] sol istifte 658mm'de kaldığı için çakışır!
    expect(deadIssues.some((i) => i.code === "ERR_SLIDING_DEAD_ZONE_DRAWER_CLASH")).toBe(true);

    // İçerlek (inset) kapakta otomatik Tam Deveboynu (71B3750) ve Yarım Binme kapakta Yarım Deveboynu (71B3650) BOM ataması
    const projHalf = createInitialProject();
    projHalf.modules[0].bays[0].door.overlayType = "half_overlay";
    const bomHalf = generateBOMForProject(projHalf);
    expect(bomHalf.hardwareList.some((h) => h.sku === "71B3650")).toBe(true);

    const projInset = createInitialProject();
    projInset.modules[0].bays[0].door.overlayType = "inset";
    const bomInset = generateBOMForProject(projInset);
    expect(bomInset.hardwareList.some((h) => h.sku === "71B3750")).toBe(true);

    // İç çekmece 25mm besleme çıtası (spacer_block_25mm) çözümü
    const pantry = getV4TemplateById("tpl_kt_03_pantry_internal_drawers")!.createInstance("pantry_sp");
    pantry.carcass.internalDrawerHingeSolution = "spacer_block_25mm";
    const geoPantry = generateModuleGeometry(pantry);
    expect(geoPantry.components.some((c) => c.id.includes("_spacer_"))).toBe(true);
  });

  it("Madde 9, 10, 11 & 12: Gola L/C kertmeleri, Mutfak alt modül üst kayıtları, Eviye 3B boşaltma ve Karkassız bulaşık makinesi", () => {
    // Mutfak çekmeceli alt modülde Gola seçildiğinde L_TOP ve C_MID kertmeleri üretilir, tam üst tabla yerine 90mm ön/arka kayıt kullanılır
    const kbGola = getV4TemplateById("tpl_kb_05_three_drawers")!.createInstance("kb_gola");
    kbGola.bays[0].door.handleCategory = "gola_profile";
    const notches = computeGolaSidePanelNotches(kbGola, 100, 760);
    expect(notches.some((n) => n.kind === "L_TOP" && n.widthMm === 26 && n.heightMm === 57)).toBe(true);
    expect(notches.some((n) => n.kind === "C_MID" && n.widthMm === 26 && n.heightMm === 73.5)).toBe(true);

    const geoKb = generateModuleGeometry(kbGola);
    const stretchers = geoKb.components.filter((c) => c.id.includes("_top_stretcher_"));
    expect(stretchers.length).toBe(2);

    // Eviye modülünde ön kayıt dikeydir, arkalık iptal edilir ve tezgâhta gerçek 3B cutoutHole bulunur!
    const sinkMod = getV4TemplateById("tpl_kb_08_sink_base")!.createInstance("kb_sink");
    const geoSink = generateModuleGeometry(sinkMod);
    expect(geoSink.components.some((c) => c.id.includes("_top_stretcher_front_vert"))).toBe(true);
    expect(geoSink.components.some((c) => c.role === "carcass_back")).toBe(false);
    const sinkCtop = geoSink.components.find((c) => c.id.includes("_auto_countertop"))!;
    expect(sinkCtop.cutoutHole).toBeDefined();
    expect(sinkCtop.cutoutHole!.widthMm).toBeGreaterThan(300);

    // Tam ankastre bulaşık makinesi: ahşap yan/alt/üst/arka panel YOKTUR, sadece mobilya kapağı + baza + tezgâh vardır!
    const dshMod = getV4TemplateById("tpl_kb_01_single_door")!.createInstance("kb_dishwasher");
    dshMod.name = "Tam Ankastre Bulaşık Makinesi 600";
    dshMod.isFreestandingDishwasher = true;
    const geoDsh = generateModuleGeometry(dshMod);
    expect(geoDsh.components.some((c) => c.role === "carcass_side_left")).toBe(false);
    expect(geoDsh.components.some((c) => c.role === "door_left")).toBe(true);
  });

  it("Madde 13, 18, 19 & 20: Fırın 50mm baca boşluğu, Metal kutu çekmece (ahşap yanaksız!), Görünen yan ve Kesintisiz tezgâh katmanı", () => {
    // Metal kutu çekmece (LEGRABOX): yan paneller kesim listesine GİRMEZ, sadece ön klapa + 16mm taban + 16mm sırt kesilir!
    const kbLegra = getV4TemplateById("tpl_kb_05_three_drawers")!.createInstance("kb_legra");
    kbLegra.carcass.appliedEndPanelLeft = "floor_to_top";
    const projLegra = { ...createInitialProject(), modules: [kbLegra] };
    const bomLegra = generateBOMForProject(projLegra);
    expect(bomLegra.cutList.some((p) => p.componentRole === "drawer_side_left")).toBe(false);
    expect(bomLegra.cutList.filter((p) => p.componentRole === "drawer_bottom").length).toBe(3);
    expect(bomLegra.cutList.some((p) => p.componentRole === "end_panel")).toBe(true);

    // Fırın kulesinde sabit/hareketli raflar arkadan 50mm baca boşluğu bırakır ve menfez BOM'a eklenir
    const ovenTower = getV4TemplateById("tpl_kt_05_oven_microwave_tower")!.createInstance("kt_oven");
    const bomOven = generateBOMForProject({ ...createInitialProject(), modules: [ovenTower] });
    expect(bomOven.hardwareList.some((h) => h.sku === "HW_VENT_GRILLE_200CM2")).toBe(true);

    // Kesintisiz mutfak tezgâh & baza katmanı
    const linProj = createKitchenLinearProject();
    const layers = computeContinuousKitchenLayers(linProj);
    expect(layers.countertops.length).toBeGreaterThanOrEqual(1);
    expect(layers.countertops[0].cutouts.some((c) => c.kind === "sink")).toBe(true);
  });

  it("Madde 4.1, 23, 24 & 30: Özyinelemeli Hücre Ağacı, Sistem 32 32mm katı, Parapet kontrolü ve Katmanlı CAM DXF ZIP + 100x50 Etiket", () => {
    const proj = createInitialProject();
    proj.modules[0].carcass.ledLightingEnabled = true;
    proj.modules[0].carcass.ledPlacementMode = "full_showcase";

    const tree = buildRecursivePartitionTree(proj.modules[0]);
    expect(tree.splitType).toBe("VERTICAL_COLUMNS");
    expect(tree.children.length).toBe(2);

    const bom = generateBOMForProject(proj);
    const leftSide = bom.cutList.find((p) => p.componentRole === "carcass_side_left")!;
    const pinXs = Array.from(
      new Set(leftSide.holes!.filter((h) => h.purpose === "shelf_pin").map((h) => h.x))
    ).sort((a, b) => a - b);
    expect(pinXs[0]).toBe(37);
    expect((pinXs[1] - pinXs[0]) % 32).toBe(0); // İkinci sıra tam 32mm katında!

    // Endüstriyel CAM DXF katmanları & ZIP arşivi
    const dxf = generatePanelDXF(leftSide);
    expect(dxf).toContain("OUTLINE_T18");
    expect(dxf).toContain("DRILL_V_D5_Z12");
    expect(dxf).toContain("GROOVE_W8.5_Z10");
    expect(dxf).toContain("GROOVE_W12_Z8");

    const optiCsv = exportOptiCutCutListCsv(bom);
    expect(optiCsv).toContain("Sira_No;Modul_Kodu;Parca_Adi;Malzeme_Adi;Kalinlik;Net_Kesim_Boy");

    const nestSvg = generateNestingDiagramSvg(bom);
    expect(nestSvg).toContain("<svg");

    const labelsHtml = generateThermalPartLabelsHtml(proj, bom);
    expect(labelsHtml).toContain("100mm 50mm");

    const zipBytes = exportIndustrialCamZipArchive(proj, bom);
    // ZIP PK\x03\x04 magic signature check
    expect(zipBytes[0]).toBe(0x50);
    expect(zipBytes[1]).toBe(0x4b);
    expect(zipBytes.length).toBeGreaterThan(2000);

    // Pencere parapeti < tezgâh üst kotu kontrolü
    const kProj = createKitchenLinearProject();
    kProj.modules[0].dimensions.height = 830; // 830 + 40 tezgâh = 870mm > 820mm parapet!
    kProj.space.elements = [
      {
        id: "win_low",
        type: "window",
        name: "Alçak Mutfak Penceresi",
        position: { x: 100, y: 820, z: 0 },
        dimensions: { width: 1000, height: 1100, depth: 150 },
      },
    ];
    const kIssues = validateProject(kProj);
    expect(kIssues.some((i) => i.message.includes("Tezgâh pencere kanadını bloke ediyor"))).toBe(true);
  });

  it("Endüstriyel Birleşim Standartları: Ahşap çekmece kanallı taban (LW-30mm & GROOVE_W8.5_Z6), Tip B/D karkas, üst dolap askı kertmesi ve M4 civata", () => {
    // 1. Ahşap gizli ray çekmece (Blum MOVENTO): 8mm taban 2x6mm kanala girdiği için sırtlıktan (LW-42) tam +12mm geniştir (LW-30)!
    const wMod = createDefaultWardrobeModule("wood_drw_test");
    wMod.bays[1].drawers[0].boxSystemType = "wooden_undermount";
    wMod.bays[1].drawers[0].hardwareProductId = "hw_blum_movento_760h";
    const projWood = { ...createInitialProject(), modules: [wMod] };
    const bomWood = generateBOMForProject(projWood);

    const dSide = bomWood.cutList.find((p) => p.componentRole === "drawer_side_left")!;
    const dBack = bomWood.cutList.find((p) => p.componentRole === "drawer_back")!;
    const dBot = bomWood.cutList.find((p) => p.componentRole === "drawer_bottom")!;
    const dFront = bomWood.cutList.find((p) => p.componentRole === "drawer_front")!;

    expect(dSide.hasDrawerBottomGroove).toBe(true);
    expect(dBot.lengthMm - dBack.lengthMm).toBe(12); // LW-30 vs LW-42 -> +12mm (sağ/sol 6mm kanal payı!)
    expect(dBack.holes!.some((h) => h.purpose === "drawer_hook" && h.diameter === 6)).toBe(true);
    expect(dFront.holes!.some((h) => h.purpose === "drawer_front_fixer" && h.diameter === 10)).toBe(true);
    expect(dFront.holes!.some((h) => h.purpose === "handle" && h.diameter === 5)).toBe(true);
    expect(bomWood.hardwareList.some((h) => h.sku === "T51.1700")).toBe(true);

    const dSideDxf = generatePanelDXF(dSide);
    expect(dSideDxf).toContain("DRAWER_BOTTOM_GROOVE_8MM");
    expect(dSideDxf).toContain("GROOVE_W8.5_Z6");

    // 2. Mutfak Dikey Eviye Ön Kaydı (90mm genişlik korunur, arkalık kanalı açılmaz!) + Üst Dolap NOTCH_WALL_HANGER + Yan Yana M4 Civata
    const kLin = createKitchenLinearProject();
    const bomKitchen = generateBOMForProject(kLin);
    const sinkVertStretcher = bomKitchen.cutList.find((p) => p.id.includes("_top_stretcher_front_vert"))!;
    expect(sinkVertStretcher.widthMm).toBe(90);
    expect(sinkVertStretcher.hasBackGroove).toBe(false);
    expect(bomKitchen.hardwareList.some((h) => h.sku === "HW_CABINET_CONN_M4")).toBe(true);

    const wallBack = bomKitchen.cutList.find(
      (p) => p.componentRole === "carcass_back" && p.wallHangerCornerNotches !== undefined
    )!;
    expect(wallBack).toBeDefined();
    expect(generatePanelDXF(wallBack)).toContain("NOTCH_WALL_HANGER");

    // 3. Tip B (top_bottom_through): Alt/üst tabla yüzüne minifiks mili, yan dikme cumbasına minifiks gövde + kenar deliği açılır!
    const tipBMod = createDefaultWardrobeModule("tip_b_mod");
    tipBMod.carcass.carcassJoineryTopology = "top_bottom_through";
    const bomTipB = generateBOMForProject({ ...createInitialProject(), modules: [tipBMod] });
    const sideTipB = bomTipB.cutList.find((p) => p.componentRole === "carcass_side_left")!;
    const botTipB = bomTipB.cutList.find((p) => p.componentRole === "carcass_bottom")!;
    expect(sideTipB.holes!.some((h) => h.purpose === "minifix_cam" && h.diameter === 15)).toBe(true);
    expect(sideTipB.holes!.some((h) => h.direction === "edge_bottom")).toBe(true);
    expect(botTipB.holes!.some((h) => h.purpose === "minifix_bolt" && h.direction === "face_front")).toBe(true);
  });

  it("2D A-A Yan Kesit ve B-B Boyuna Kesit: Çekmece arkalıkları (drawer_back) kesit görünümünde eksiksiz yer alır", () => {
    const mod = createDefaultWardrobeModule("sec_drw_mod");
    const breakdown = generateModuleGeometry(mod, { doorOpenAngleDeg: 0 });
    // Bay 2 (sağ bölme, X ~ 1350mm) içinde 2 çekmece vardır -> A-A Yan Kesit
    const secAA = generateCrossSection2D(breakdown, undefined, { direction: "Z", cutCoordMm: 1350 });
    const aaBackRects = secAA.elements.filter((el) => el.role === "drawer_back");
    expect(aaBackRects.length).toBeGreaterThanOrEqual(2);

    // B-B Boyuna Kesit (Z = 300mm derinlikten arkaya doğru bakış) -> Çekmece arkalıkları görünür olmalıdır!
    const secBB = generateCrossSection2D(breakdown, undefined, { direction: "X", cutCoordMm: 300 });
    const bbBackRects = secBB.elements.filter((el) => el.role === "drawer_back");
    expect(bbBackRects.length).toBeGreaterThanOrEqual(2);
  });
});
