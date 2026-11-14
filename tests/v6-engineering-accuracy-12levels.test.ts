import { describe, it, expect } from "vitest";
import {
  createInitialProject,
  createDefaultWardrobeModule,
  calculateFourSpaceDimensions,
  doModulesOverlapOBB2D,
  validateModule,
  validateProject,
  evaluateFreestandingTipOverRisk,
  evaluateLongTermShelfDeflection,
  evaluateUnifiedEngineeringModel,
  applyApprovedRemediationProposal,
  assertProductionExportAllowed,
  ProductionGateBlockedError,
  ENGINEERING_TOLERANCE_POLICY,
  getErgonomicProfile,
  resolveCanonicalDrawerCuttingFormula,
} from "@birim/core";
import { getV4TemplateById, createKitchenLinearProject, V5_SPECIALIZED_MODULE_TEMPLATES } from "@birim/catalog";
import { generateModuleGeometry, generateTopPlan2D } from "@birim/geometry";
import {
  generateBOMForProject,
  generatePanelDXF,
  exportAllPanelsDXF,
  exportNestingSheetsDXF,
  exportCutListToCSV,
  exportOptiCutCutListCsv,
  exportIndustrialCamZipArchive,
  generateThermalPartLabelsHtml,
  generateNestingDiagramSvg,
  generateAssemblyInstructions,
  generateHomagMprPrograms,
  generateBiesseCixProgram,
  generateScmXcsProgram,
  mapCutPieceToCncPieceInput,
} from "@birim/manufacturing";
import { useConfiguratorStore } from "../apps/configurator/src/store/useConfiguratorStore";

describe("Birim Configurator V6 — 12 Seviyeli Mühendislik Doğruluğu ve Üretilebilirlik Doğrulama Paketi", () => {
  it("Seviye 1: Parametrik Ölçü ve Geometri Tutarlılığı (18mm -> 25mm kalınlık değişiminde tüm parçaların güncellenmesi)", () => {
    const mod18 = createDefaultWardrobeModule("wd_t18");
    mod18.dimensions = { width: 1600, height: 2200, depth: 600 };
    mod18.carcass.panelThickness = 18;

    const mod25 = JSON.parse(JSON.stringify(mod18));
    mod25.id = "wd_t25";
    mod25.carcass.panelThickness = 25;

    const fs18 = calculateFourSpaceDimensions(mod18);
    const fs25 = calculateFourSpaceDimensions(mod25);

    const sum18 =
      fs18.usableInternal.bayClearWidthsMm.reduce((a, b) => a + b, 0) +
      (mod18.bays.length + 1) * 18;
    const sum25 =
      fs25.usableInternal.bayClearWidthsMm.reduce((a, b) => a + b, 0) +
      (mod25.bays.length + 1) * 25;

    expect(Math.abs(sum18 - 1600)).toBeLessThanOrEqual(
      ENGINEERING_TOLERANCE_POLICY.DIMENSION_CHAIN_EPSILON_MM
    );
    expect(Math.abs(sum25 - 1600)).toBeLessThanOrEqual(
      ENGINEERING_TOLERANCE_POLICY.DIMENSION_CHAIN_EPSILON_MM
    );
    // 2 bölmeli (3 dikmeli) modülde 18mm -> 25mm geçişi toplam iç net genişliği tam 3 * 7 = 21mm daraltmalıdır!
    const clear18 = fs18.usableInternal.bayClearWidthsMm.reduce((a, b) => a + b, 0);
    const clear25 = fs25.usableInternal.bayClearWidthsMm.reduce((a, b) => a + b, 0);
    expect(clear18 - clear25).toBe(21);
  });

  it("Seviye 2: Parça Birleşim, Dinamik Inset Geri Çekilme (22mm -> 61mm) ve Eş-Eksenli Ara Dikme Delik Hizalaması (P0-05)", () => {
    const proj = createInitialProject();
    const mod = proj.modules[0]; // 2 bölmeli gardırop (ortada 1 ara dikme var)
    mod.bays.forEach((b) => {
      b.door.type = "inset_left";
      b.door.doorSystemId = "hinged_inset";
      b.door.overlayType = "inset";
      b.door.doorThicknessMm = 22; // 22mm kalın kapak -> 37 + 22 + 2 = 61mm geri çekilme!
    });
    mod.carcass.doorPerimeterGap = 2;

    const bom = generateBOMForProject(proj);
    const sideLeft = bom.cutList.find((p) => p.componentRole === "carcass_side_left")!;
    const bottomPanel = bom.cutList.find((p) => p.componentRole === "carcass_bottom")!;
    const divider = bom.cutList.find((p) => p.componentRole === "carcass_divider")!;

    // 1) 22mm içerlek kapakta menteşe tabanı sabit 57mm değil tam 61mm olmalıdır!
    const hingeMounts = (sideLeft.holes || []).filter((h) => h.purpose === "hinge_mount");
    expect(hingeMounts.length).toBeGreaterThanOrEqual(4);
    expect(hingeMounts[0].x).toBe(61);

    // 2) Ara dikme alt cumbasındaki (`edge_bottom`) minifix milleri ile alt tabladaki karşılık delikleri birebir aynı X eksenindedir!
    const divBottomEdgeBolts = (divider.holes || [])
      .filter((h) => h.direction === "edge_bottom" && h.purpose === "minifix_bolt")
      .map((h) => h.x)
      .sort((a, b) => a - b);
    const botMateBolts = Array.from(
      new Set(
        (bottomPanel.holes || [])
          .filter((h) => h.id.includes("_div_mate_bolt_"))
          .map((h) => h.x)
      )
    ).sort((a, b) => a - b);

    expect(divBottomEdgeBolts.length).toBeGreaterThanOrEqual(2);
    expect(botMateBolts).toEqual(divBottomEdgeBolts);
  });

  it("Seviye 3: Dinamik Menteşe Y Kotu – İç Çekmece Çarpışması (P1-02) ve Duvar Köşesi Kulplu Kapak Açılım Kontrolü (P2-01)", () => {
    const proj = createInitialProject();
    const mod = proj.modules[0];
    mod.dimensions.height = 2200; // 4 menteşe: gerçek orta-alt menteşe ~767mm kotundadır (eski sabit [100,850,1500,2050] bunu kaçırıyordu!)
    mod.position.x = 0; // Sol duvara sıfır!
    const fs = calculateFourSpaceDimensions(mod);
    const doorBaseInnerOffset =
      (fs.doorLeaves[0].doorY0Mm || 0) - ((mod.carcass.plinthHeight || 0) + mod.carcass.panelThickness);
    const secondHingeInnerY = Math.round(doorBaseInnerOffset + fs.doorLeaves[0].hingePositionsY[1]);

    mod.bays[0].drawers = [
      {
        id: "drw_clash_dynamic_hinge",
        bayIndex: 0,
        elevationY: Math.max(0, secondHingeInnerY - 20),
        height: 160,
        slideType: "soft_close",
        isInternal: true,
      },
    ];
    mod.bays[0].door.type = "single_left";
    mod.bays[0].door.doorSystemId = "hinged_single";
    mod.bays[0].door.handleCategory = "bar_handle";
    mod.bays[0].door.hardwareProductId = "hw_blum_71b3550"; // Standart 110° menteşe

    const modIssues = validateModule(mod);
    expect(modIssues.some((i) => i.code === "ERR_INTERNAL_DRAWER_HINGE_COLLISION")).toBe(true);

    const eng = evaluateUnifiedEngineeringModel(proj);
    expect(
      eng.blockingSafetyAndEngineeringErrors.some(
        (e) => e.code === "ERR_INTERNAL_DRAWER_HINGE_BODY_CLASH"
      )
    ).toBe(true);
    expect(
      eng.findings.some((e) => e.code === "CHK_SPATIAL_WALL_CORNER_HANDLE_SWING_CLASH")
    ).toBe(true);
  });

  it("Seviye 4: Sınır Değer ve Sayısal Tolerans Politikası (OBB 0.00mm Sıfır Temas vs 0.30mm Çakışma & Ön Freze Payları)", () => {
    const mA = createDefaultWardrobeModule("obb_a");
    mA.dimensions = { width: 800, height: 2100, depth: 600 };
    mA.position = { x: 0, y: 0, z: 0 };

    const mFlush = JSON.parse(JSON.stringify(mA));
    mFlush.id = "obb_flush";
    mFlush.position = { x: 800, y: 0, z: 0 }; // Tam 0.00mm sıfır temas: çakışma OLMAMALI!
    expect(doModulesOverlapOBB2D(mA, mFlush)).toBe(false);

    const mOverlap03 = JSON.parse(JSON.stringify(mA));
    mOverlap03.id = "obb_pen_03";
    mOverlap03.position = { x: 799.7, y: 0, z: 0 }; // 0.30mm gerçek iç içe geçme (eski shrinkMm=0.5 bunu kaçırıyordu!): YAKALANMALI!
    expect(doModulesOverlapOBB2D(mA, mOverlap03)).toBe(true);
  });

  it("Seviye 5: Uyumsuz Donanım Kombinasyonları — Sessiz 600mm Kapak Kırpmasının İptali (P1-01) & Kulpsuz J-Pull Sıfır Delik (P0-04)", () => {
    // 1) P1-01: 960mm tek kapaklı modülde leafWidthMm 600mm'ye kırpılmaz ve CHK_05_HINGED_LEAF_TOO_WIDE hatası üretir!
    const wideMod = createDefaultWardrobeModule("wide_single_960");
    wideMod.dimensions.width = 960;
    wideMod.bays = [wideMod.bays[0]];
    wideMod.bays[0].customWidth = undefined;
    wideMod.bays[0].door.type = "single_left";
    wideMod.bays[0].door.doorSystemId = "hinged_single";

    const fsWide = calculateFourSpaceDimensions(wideMod);
    expect(fsWide.doorLeaves[0].leafCount).toBe(1);
    expect(fsWide.doorLeaves[0].leafWidthMm).toBeGreaterThan(920);

    const projWide = { ...createInitialProject(), modules: [wideMod] };
    const engWide = evaluateUnifiedEngineeringModel(projWide);
    expect(
      engWide.blockingSafetyAndEngineeringErrors.some(
        (e) => e.code === "CHK_05_HINGED_LEAF_TOO_WIDE"
      )
    ).toBe(true);

    // 2) P0-04: `j_pull` kulpsuz kapakta ne kapak üstünde Ø5mm delik açılır ne de BOM'a bar kulp eklenir!
    const projJPull = createInitialProject();
    projJPull.modules[0].bays.forEach((b) => {
      b.door.handleCategory = "j_pull";
      b.door.crossSectionProfile = "j_pull_bevel";
    });
    const bomJPull = generateBOMForProject(projJPull);
    const jDoors = bomJPull.cutList.filter((p) => p.componentRole.startsWith("door_"));
    expect(jDoors.length).toBeGreaterThan(0);
    for (const dp of jDoors) {
      expect((dp.holes || []).filter((h) => h.purpose === "handle").length).toBe(0);
      // P1-03: `j_pull_bevel` kenarda PVC bant düşümü yapılmaz!
      expect(dp.netCutLengthMm).toBe(dp.lengthMm);
      expect(dp.netCutWidthMm).toBe(dp.widthMm);
    }
    expect(bomJPull.hardwareList.filter((h) => h.category === "handle").length).toBe(0);
  });

  it("Seviye 6: Modüller Arası Bağlantı ve Tavan Diyagonal Kaldırma (√(H²+D²)) Montaj Erişimi Kontrolü (P2-03)", () => {
    const proj = createInitialProject();
    proj.space.ceilingHeight = 2420;
    proj.modules[0].dimensions.height = 2380;
    proj.modules[0].dimensions.depth = 600; // √(2380² + 600²) = 2454.5mm > 2420mm tavan!

    const bom = generateBOMForProject(proj);
    const steps = generateAssemblyInstructions(proj, bom);
    expect(steps.length).toBeGreaterThanOrEqual(4);
    expect(steps[0].safetyNotes).toContain("DİK OLARAK kurunuz");
  });

  it("Seviye 7: EN 14749 Serbest Duran Yüksek Dolap Devrilme Güvenliği (P0-03) ve Uzun Dönem Raf Sünme Sehimi", () => {
    const proj = createInitialProject();
    const tallSlender = proj.modules[0];
    tallSlender.dimensions = { width: 800, height: 2200, depth: 340 };
    tallSlender.position = { x: 1200, y: 0, z: 1400 }; // Odanın ortasında serbest duruyor (arkasında duvar yok!)

    const tipUnsafe = evaluateFreestandingTipOverRisk(tallSlender, proj.space);
    expect(tipUnsafe.requiresWallAnchor).toBe(true);
    expect(tipUnsafe.isBackedByWall).toBe(false);
    expect(tipUnsafe.isSafe).toBe(false);

    const engUnsafe = evaluateUnifiedEngineeringModel(proj);
    expect(
      engUnsafe.blockingSafetyAndEngineeringErrors.some(
        (e) => e.code === "ERR_FREESTANDING_TIPOVER_UNSAFE"
      )
    ).toBe(true);

    // Duvara yaslandığında güvenli olur ve BOM'a otomatik `HW_ANTI_TIP_EN14749_L` eklenir!
    tallSlender.position.z = 0;
    const bomAnchored = generateBOMForProject(proj);
    expect(bomAnchored.hardwareList.some((h) => h.sku === "HW_ANTI_TIP_EN14749_L")).toBe(true);

    // Uzun dönem sünme (creep k_def = 0.8) kontrolü: anlık sehimin 1.8 katıdır!
    const creepCheck = evaluateLongTermShelfDeflection({
      spanMm: 900,
      depthMm: 500,
      thicknessMm: 18,
      materialCategory: "laminate",
    });
    expect(creepCheck.longTermDeflectionMm).toBeGreaterThan(creepCheck.instantDeflectionMm);
  });

  it("Seviye 8: BOM ve Kesim Listesi Bütünlüğü — Kapsül Modül Tekillik/CSV İhracatı (P0-01), Lake Kapak & 5-Parça Çerçeve Kapak (P1-03)", () => {
    // 1) P0-01: `capsule_stadium` modülde düz yan paneller üretilmez, OptiCut ve Standart CSV çökmeden çalışır!
    const capProj = createInitialProject();
    capProj.modules[0].carcass.hullShape = "capsule_stadium";
    capProj.modules[0].dimensions = { width: 1400, height: 950, depth: 480 };

    const capBom = generateBOMForProject(capProj);
    expect(capBom.cutList.some((p) => p.componentRole === "carcass_side_left")).toBe(false);
    expect(capBom.cutList.filter((p) => p.componentRole === "kerf_curve").length).toBe(2);

    const optiCsv = exportOptiCutCutListCsv(capBom, undefined, { allowBlockedDraftExport: true });
    const stdCsv = exportCutListToCSV(capBom);
    expect(optiCsv).toContain("Kapsül Kavisli Yan Gövde Açınımı");
    expect(stdCsv).toContain("Kapsül Stadyum Üst Tabla");

    // 2) P1-03: Gerçek 5-parçalı çerçeve kapak (`five_piece_rail_stile`) seçildiğinde 2 seren + 2 başlık + 1 göbek BOM'a düşer!
    const shakerProj = createInitialProject();
    shakerProj.modules[0].bays[0].door.crossSectionProfile = "shaker_frame";
    shakerProj.modules[0].bays[0].door.doorFrameConstruction = "five_piece_rail_stile";
    const shakerBom = generateBOMForProject(shakerProj);
    expect(shakerBom.cutList.filter((p) => p.componentRole === "door_stile_left").length).toBeGreaterThanOrEqual(1);
    expect(shakerBom.cutList.filter((p) => p.componentRole === "door_rail_top").length).toBeGreaterThanOrEqual(1);
    expect(shakerBom.cutList.filter((p) => p.componentRole === "door_center_panel").length).toBeGreaterThanOrEqual(1);
  });

  it("Seviye 9: Nesting DXF Delik/Kanal Dönüşümü (P1-04), 45° Gönye Koruması (P1-05), Eğimli Tavan Çokgeni ve Üretim Kapısı Kilidi (P0-02)", () => {
    const proj = createInitialProject();
    proj.modules[0].carcass.slopedCeiling = {
      mode: "back_slope",
      kneeHeightMm: 1500,
      slopeAngleDeg: 35,
    };
    const bom = generateBOMForProject(proj);

    // 1) Eğimli tavan sol yan paneli LWPOLYLINE çokgen kontura sahiptir
    const leftSide = bom.cutList.find((p) => p.componentRole === "carcass_side_left")!;
    expect(leftSide.polygonContourMm?.length).toBe(5);
    const singleDxf = generatePanelDXF(leftSide);
    expect(singleDxf).toContain("LWPOLYLINE");

    // 2) P1-04: Nesting DXF içinde artık hem `DRILL_V_D` delikleri hem `BACK_GROOVE_8MM` kanalları yer alır!
    const nestDxf = exportNestingSheetsDXF(bom);
    expect(nestDxf).toContain("NET_CUT_CONTOUR");
    expect(nestDxf).toContain("DRILL_V_D");
    expect(nestDxf).toContain("BACK_GROOVE_8MM");

    // 3) P1-05: `miter_45` seçildiğinde gövde yan paneline pahı patlatacak cumbadan kavela/minifix açılmaz!
    const miterProj = createInitialProject();
    miterProj.modules[0].carcass.carcassJoineryTopology = "miter_45";
    const miterBom = generateBOMForProject(miterProj);
    const miterSide = miterBom.cutList.find((p) => p.componentRole === "carcass_side_left")!;
    expect(
      (miterSide.holes || []).filter(
        (h) => h.purpose === "minifix_bolt" || h.purpose === "minifix_cam"
      ).length
    ).toBe(0);

    // 4) P3-01: Termal etikette U1 ve [0,0] CNC referans köşesi yer alır
    const htmlLabels = generateThermalPartLabelsHtml(proj, bom);
    expect(htmlLabels).toContain("[0,0]");

    // 5) P0-02: Çakışmalı / hatalı bir projede `exportIndustrialCamZipArchive` ve `assertProductionExportAllowed` ProductionGateBlockedError fırlatır!
    const badProj = createInitialProject();
    badProj.modules.push({
      ...JSON.parse(JSON.stringify(badProj.modules[0])),
      id: "mod_colliding",
    }); // Birebir aynı koordinatta üst üste binen 2 modül!
    const badBom = generateBOMForProject(badProj);
    expect(() => assertProductionExportAllowed(badProj)).toThrow(ProductionGateBlockedError);
    expect(() => exportIndustrialCamZipArchive(badProj, badBom)).toThrow(
      ProductionGateBlockedError
    );
  });

  it("Seviye 10: Kaydetme, Yeniden Açma, Bölgesel Ergonomi Profilleri (P2-02) ve Kullanıcı Onaylı Düzeltme Yaması (P2-04)", () => {
    const proj = createInitialProject();
    proj.ergonomicProfileId = "ACCESSIBLE_EN17210";
    expect(getErgonomicProfile(proj.ergonomicProfileId).minFrontPassageClearanceMm).toBe(1500);

    // Serbest duran devrilme riskli dolap oluşturup kullanıcı onaylı öneriyle düzeltme ve JSON serileştirme bütünlüğü
    proj.modules[0].dimensions = { width: 800, height: 2200, depth: 340 };
    proj.modules[0].position = { x: 1000, y: 0, z: 1200 };

    const engBefore = evaluateUnifiedEngineeringModel(proj);
    const tipErr = engBefore.blockingSafetyAndEngineeringErrors.find(
      (e) => e.code === "ERR_FREESTANDING_TIPOVER_UNSAFE"
    )!;
    expect(tipErr).toBeDefined();
    expect(tipErr.remediationProposals && tipErr.remediationProposals.length).toBeGreaterThan(0);

    // Orijinal proje sessizce DEĞİŞMEZ (immutability); yalnızca applyApprovedRemediationProposal çağrıldığında yeni proje döner!
    expect(proj.modules[0].carcass.floorAnchored).toBeUndefined();
    const fixedProj = applyApprovedRemediationProposal(proj, tipErr.remediationProposals![0]);
    const reloadedProj = JSON.parse(JSON.stringify(fixedProj));
    const engAfter = evaluateUnifiedEngineeringModel(reloadedProj);
    expect(
      engAfter.blockingSafetyAndEngineeringErrors.some(
        (e) => e.code === "ERR_FREESTANDING_TIPOVER_UNSAFE"
      )
    ).toBe(false);
  });

  it("Seviye 11: Otomatik Özellik Tabanlı (Property-Based) Parametrik Değişmezlik Testi — 300 Kombinasyonda 3D == 2D == BOM == CNC == DXF Eşliği", () => {
    // Deterministik Mulberry32 PRNG ile 300 farklı parametrik kombinasyon üretimi
    let seed = 20261113;
    const rand = () => {
      seed |= 0;
      seed = (seed + 0x6d2b79f5) | 0;
      let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
    const pick = <T,>(arr: readonly T[]): T => arr[Math.floor(rand() * arr.length)];

    const widths = [450, 600, 800, 900, 1200, 1600, 2000];
    const heights = [720, 900, 1800, 2100, 2400];
    const depths = [360, 450, 560, 600, 650];
    const thicknesses = [18, 25];
    const preMills = [0, 0.5, 1.0];
    const handleCats = ["bar_handle", "knob", "j_pull", "gola_profile", "handleless_plain"] as const;
    const profiles = ["flat_slab", "shaker_frame", "bevel_45", "j_pull_bevel"] as const;

    for (let run = 0; run < 300; run++) {
      const proj = createInitialProject();
      const mod = proj.modules[0];
      const w = pick(widths);
      const h = pick(heights);
      const d = pick(depths);
      const t = pick(thicknesses);
      const preMill = pick(preMills);
      const hCat = pick(handleCats);
      const prof = pick(profiles);
      const bayCount = w >= 1200 ? 2 : 1;

      mod.dimensions = { width: w, height: h, depth: d };
      mod.position = { x: 100, y: 0, z: 0 }; // Duvara yaslı
      mod.carcass.panelThickness = t;
      mod.carcass.preMillingMm = preMill;
      mod.carcass.crossSectionProfile = prof;
      mod.bays = mod.bays.slice(0, bayCount).map((b, idx) => ({
        ...b,
        index: idx,
        customWidth: undefined,
        drawers: idx === 0 && d >= 500 && h >= 900 ? b.drawers.slice(0, 1) : [],
        door: {
          ...b.door,
          type: w / bayCount > 650 ? "double" : "single_left",
          doorSystemId: w / bayCount > 650 ? "hinged_double" : "hinged_single",
          handleCategory: hCat,
          openingTechnology: hCat === "handleless_plain" ? "push_to_open" : "soft_close",
          crossSectionProfile: prof,
        },
      }));

      const geo = generateModuleGeometry(mod);
      const plan2d = generateTopPlan2D(geo);
      const bom = generateBOMForProject(proj, undefined, { skipSyncNesting: true });

      // Değişmez 1: 2D Plan modül genişliği ve derinliği ile 3D modül dış ölçüleri özdeştir
      expect(plan2d.elements.length).toBeGreaterThan(0);

      // Değişmez 2: 3D `isManufacturablePanel === true` parça adedi ile `bom.cutList` parça adedi birebir eşittir!
      const mfgPanels3D = geo.components.filter((c) => c.isManufacturablePanel);
      expect(bom.cutList.length).toBe(mfgPanels3D.length);

      // Değişmez 3: Her parçada net kesim ölçüsü = bitmiş ölçü - bantlanan_kenar * (bant - ön_freze), NaN veya negatif olamaz!
      for (const cp of bom.cutList) {
        expect(Number.isFinite(cp.lengthMm)).toBe(true);
        expect(Number.isFinite(cp.widthMm)).toBe(true);
        expect(cp.netCutLengthMm!).toBeGreaterThanOrEqual(10);
        expect(cp.netCutWidthMm!).toBeGreaterThanOrEqual(10);

        const eb = cp.edgeBanding;
        const delta = (eb.thickness || 0) - preMill;
        const expLenDed = (eb.top ? delta : 0) + (eb.bottom ? delta : 0);
        const expWidDed = (eb.left ? delta : 0) + (eb.right ? delta : 0);
        expect(Math.abs(cp.netCutLengthMm! - (cp.lengthMm - expLenDed))).toBeLessThanOrEqual(0.15);
        expect(Math.abs(cp.netCutWidthMm! - (cp.widthMm - expWidDed))).toBeLessThanOrEqual(0.15);

        // Değişmez 4: Tüm delik koordinatları parça sınırları içinde kalır!
        for (const hole of cp.holes || []) {
          expect(hole.x).toBeGreaterThanOrEqual(0);
          expect(hole.x).toBeLessThanOrEqual(cp.widthMm + 0.05);
          expect(hole.y).toBeGreaterThanOrEqual(0);
          expect(hole.y).toBeLessThanOrEqual(cp.lengthMm + 0.05);
        }
      }

      // Değişmez 5: İlk gövde yan paneli için Homag .MPR LPX/LPY iş parçası ebadı ile BOM net kesim ebadı birebir özdeştir!
      const sideCp = bom.cutList.find((p) => p.componentRole === "carcass_side_left")!;
      const scmPropCheck = generateScmXcsProgram(mapCutPieceToCncPieceInput(sideCp));
      expect(scmPropCheck.content).toContain("CreateFinishedWorkpieceBox");
      // Değişmez 5b (V7.1): 300 kombinasyonun tamamında SCM .XCS delik koordinatları [0..LPX, 0..LPY] zarfındadır!
      const drillMatches = [...scmPropCheck.content.matchAll(/CreateDrill\([^,]+,\s*([0-9.]+),\s*([0-9.]+),/g)];
      for (const dm of drillMatches) {
        const sx = Number(dm[1]);
        const sy = Number(dm[2]);
        expect(sx).toBeGreaterThanOrEqual(0);
        expect(sx).toBeLessThanOrEqual(sideCp.netCutLengthMm! + 0.05);
        expect(sy).toBeGreaterThanOrEqual(0);
        expect(sy).toBeLessThanOrEqual(sideCp.netCutWidthMm! + 0.05);
      }

      // Değişmez 6 (V7.1): 3B kulp bileşeni merkezi ile CNC kapak kulp deliklerinin ağırlık merkezi birebir örtüşür!
      for (const doorComp of geo.components.filter((c) => c.role === "door_left" || c.role === "door_right")) {
        const h3d = geo.components.find((c) => c.id === `${doorComp.id}_handle_0`);
        const doorCut = bom.cutList.find((p) => p.id === `P_${mod.id}_${doorComp.id}`);
        if (h3d && doorCut) {
          const handleHoles = (doorCut.holes || []).filter((hh) => hh.purpose === "handle");
          if (handleHoles.length > 0) {
            const rel3dX = h3d.position.x + h3d.dimensions.width / 2 - doorComp.position.x;
            const rel3dY = h3d.position.y + h3d.dimensions.height / 2 - doorComp.position.y;
            const cncAvgX = handleHoles.reduce((s, hh) => s + hh.x, 0) / handleHoles.length;
            const cncAvgY = handleHoles.reduce((s, hh) => s + hh.y, 0) / handleHoles.length;
            expect(Math.abs(rel3dX - cncAvgX)).toBeLessThanOrEqual(1.0);
            expect(Math.abs(rel3dY - cncAvgY)).toBeLessThanOrEqual(1.0);
          }
        }
      }
      const mprFiles = generateHomagMprPrograms({
        id: sideCp.id,
        moduleId: sideCp.moduleId,
        moduleName: sideCp.moduleName,
        partRole: "carcass_side",
        pieceName: sideCp.pieceName,
        thicknessMm: sideCp.thicknessMm,
        lengthMm: sideCp.lengthMm,
        widthMm: sideCp.widthMm,
        netCutLengthMm: sideCp.netCutLengthMm,
        netCutWidthMm: sideCp.netCutWidthMm,
        rawOriginOffsetXMm: sideCp.rawOriginOffsetXMm,
        rawOriginOffsetYMm: sideCp.rawOriginOffsetYMm,
        drillingOperations: [],
      });
      expect(mprFiles[0].content).toContain(`LPX="${sideCp.netCutLengthMm!.toFixed(2)}"`);
      expect(mprFiles[0].content).toContain(`LPY="${sideCp.netCutWidthMm!.toFixed(2)}"`);
    }
  });

  it("Seviye 12: Fabrika Altın Referans (Golden Master) Üretim Örnekleriyle Birebir Karşılaştırma (Eviye, Ankastre Fırın Kulesi ve Doğrusal Mutfak)", () => {
    // Altın Referans 1: Eviye modülünde sifon kesimsiz üst çekmece eklendiğinde kural motoru yakalar, onaylı yamayla sifon kesimi açılır!
    const sinkMod = getV4TemplateById("tpl_kb_08_sink_base")!.createInstance("golden_sink");
    sinkMod.bays[0].drawers = [
      {
        id: "sink_top_drw",
        bayIndex: 0,
        elevationY: 420,
        height: 220,
        slideType: "soft_close",
        hasSiphonCutout: false,
      },
    ];
    const sinkProj = { ...createInitialProject(), modules: [sinkMod] };
    const sinkEng = evaluateUnifiedEngineeringModel(sinkProj);
    const siphonErr = sinkEng.blockingSafetyAndEngineeringErrors.find(
      (e) => e.code === "ERR_SINK_BOWL_DRAWER_COLLISION"
    )!;
    expect(siphonErr).toBeDefined();

    const fixedSinkProj = applyApprovedRemediationProposal(
      sinkProj,
      siphonErr.remediationProposals![0]
    );
    const fixedSinkBom = generateBOMForProject(fixedSinkProj);
    expect(fixedSinkBom.hardwareList.some((h) => h.sku === "HW_SIPHON_TRIM_U")).toBe(true);

    // Altın Referans 2: Ankastre fırın kulesinde baza 40mm (<60mm -> <200cm² hava girişi) yapıldığında zorunlu güvenlik hatası verir!
    const ovenMod = getV4TemplateById("tpl_kt_05_oven_microwave_tower")!.createInstance("golden_oven");
    ovenMod.carcass.plinthHeight = 40;
    const ovenProj = { ...createInitialProject(), modules: [ovenMod] };
    const ovenEng = evaluateUnifiedEngineeringModel(ovenProj);
    expect(
      ovenEng.blockingSafetyAndEngineeringErrors.some(
        (e) => e.code === "ERR_APPLIANCE_200CM2_AIRFLOW_VIOLATION"
      )
    ).toBe(true);

    // Altın Referans 3: Standart Doğrusal Mutfak (createKitchenLinearProject) üretime hazır CAM ZIP ve OptiCut CSV üretir!
    const kLin = createKitchenLinearProject();
    const kBom = generateBOMForProject(kLin);
    const kZip = exportIndustrialCamZipArchive(kLin, kBom);
    expect(kZip[0]).toBe(0x50);
    expect(kZip[1]).toBe(0x4b);
    expect(kBom.engineeringReadiness?.canExportToCncAndSaw).toBe(true);
  });

  it("V6.1 Ek Doğrulama A: Üst Üste İstiflenen Modüllerde (Stacked Modules) Yük Aktarımı, Konsol Taşma, Dikme Hizası ve M6 Cıvata", () => {
    const proj = createInitialProject();
    const baseMod = proj.modules[0];
    baseMod.dimensions = { width: 1200, height: 1800, depth: 600 };
    baseMod.position = { x: 200, y: 0, z: 0 };

    const upperMod = JSON.parse(JSON.stringify(baseMod));
    upperMod.id = "wd_top_box";
    upperMod.name = "Üst Yüklük Modülü";
    upperMod.dimensions = { width: 1200, height: 500, depth: 600 };
    upperMod.carcass.plinthHeight = 0;
    upperMod.position = { x: 200, y: 1950, z: 0 };
    proj.modules.push(upperMod);

    const repMidAir = evaluateUnifiedEngineeringModel(proj);
    expect(
      repMidAir.blockingSafetyAndEngineeringErrors.some(
        (e) => e.code === "ERR_STACKED_MODULE_UNSUPPORTED_MIDAIR"
      )
    ).toBe(true);

    upperMod.position = { x: 200, y: 1800, z: 0 };
    upperMod.dimensions.width = 1350;
    const repOverhang = evaluateUnifiedEngineeringModel(proj);
    const overhangErr = repOverhang.blockingSafetyAndEngineeringErrors.find(
      (e) => e.code === "ERR_STACKED_MODULE_CANTILEVER_OVERHANG"
    )!;
    expect(overhangErr).toBeDefined();

    const alignedProj = applyApprovedRemediationProposal(proj, overhangErr.remediationProposals![0]);
    const repAligned = evaluateUnifiedEngineeringModel(alignedProj);
    expect(
      repAligned.blockingSafetyAndEngineeringErrors.some(
        (e) => e.code === "ERR_STACKED_MODULE_CANTILEVER_OVERHANG"
      )
    ).toBe(false);

    const bomStacked = generateBOMForProject(alignedProj);
    expect(bomStacked.hardwareList.some((h) => h.sku === "HW_STACKING_BOLT_M6" && h.quantity === 4)).toBe(
      true
    );
  });

  it("V6.1 Ek Doğrulama B: Özel Malzeme/Donanım Eksik Veri Koruması (VERIFICATION_REQUIRED), Katalog Ray Formülü ve REVEGO Cep Bölmesi", () => {
    expect(resolveCanonicalDrawerCuttingFormula("hw_blum_legrabox_m").bottomWidthDeductionMm).toBe(38);
    expect(resolveCanonicalDrawerCuttingFormula("hw_blum_tandembox_m").bottomWidthDeductionMm).toBe(75);
    expect(resolveCanonicalDrawerCuttingFormula("custom_unknown_runner_999").isVerifiedCatalogFormula).toBe(
      false
    );

    const proj = createInitialProject();
    proj.customMaterials = [
      {
        id: "mat_custom_unverified_board",
        name: "Özel Test Levhası (Mekanik Föysüz)",
        category: "wood",
        thickness: 18,
        colorHex: "#d6c7b2",
        roughness: 0.6,
        metalness: 0,
        costPerM2: 24,
        edgeBandCostPerM: 1.2,
        hasGrain: true,
      },
    ];
    proj.modules[0].carcass.bodyMaterialId = "mat_custom_unverified_board";
    proj.modules[0].bays[1].drawers[0].hardwareProductId = "custom_unknown_runner_999";
    proj.modules[0].bays[0].door.doorSystemId = "pocket_retractable";
    proj.modules[0].bays[0].door.type = "pocket";

    const rep = evaluateUnifiedEngineeringModel(proj);
    expect(
      rep.verificationRequiredFindings.some((f) => f.code === "CHK_DATA_CUSTOM_MATERIAL_UNVERIFIED")
    ).toBe(true);
    expect(
      rep.verificationRequiredFindings.some(
        (f) => f.code === "CHK_DATA_CUSTOM_DRAWER_FORMULA_UNVERIFIED"
      )
    ).toBe(true);
    expect(rep.canApproveFinalErpRelease).toBe(false);

    const bom = generateBOMForProject(proj);
    expect(bom.cutList.some((p) => p.id.includes("_pocket_partition"))).toBe(true);
  });

  it("V6.2 Ek Doğrulama C: Kapsül Stadyum ve Eğik Tavan Parçalarında .MPR / .CIX / .XCS Poligon Kontur ve CNC Kerf-Büküm Kanal Döngüleri", () => {
    const capProj = createInitialProject();
    const capMod = capProj.modules[0];
    capMod.name = "Kapsül Stadyum Bar Dolabı";
    capMod.dimensions = { width: 1400, height: 1100, depth: 500 };
    capMod.carcass.hullShape = "capsule_stadium";
    capMod.bays.forEach((b, bi) => {
      b.shelves = [{ id: `cap_sh_${bi}`, bayIndex: bi, elevationY: 420, isAdjustable: true }];
      b.hangingRails = [];
    });

    const capBom = generateBOMForProject(capProj);
    const stadiumTop = capBom.cutList.find((p) => p.id.includes("_capsule_top"))!;
    const curvedShell = capBom.cutList.find((p) => Boolean(p.kerfBendingMeta))!;
    expect(stadiumTop.polygonContourMm?.length).toBeGreaterThanOrEqual(8);
    expect(curvedShell.kerfBendingMeta?.kerfCount).toBeGreaterThan(5);

    const topCnc = mapCutPieceToCncPieceInput(stadiumTop);
    const shellCnc = mapCutPieceToCncPieceInput(curvedShell);

    // Homag WoodWOP 5.0 (.MPR)
    const topMpr = generateHomagMprPrograms(topCnc)[0];
    expect(topMpr.content).toContain("$E1");
    expect(topMpr.content).toContain("\\Konturfraesen\\");
    expect(topMpr.content).toContain("POLYGON_OUTER_CONTOUR");

    const shellMpr = generateHomagMprPrograms(shellCnc)[0];
    expect(shellMpr.content).toContain("CNC_KERF_BEND_SLOT_1_OF_");

    // BiesseWorks (.CIX)
    const topCix = generateBiesseCixProgram(topCnc);
    expect(topCix.content).toContain('PARAM,NAME=ID,VALUE="POLY_GEO_1"');
    expect(topCix.content).toContain("NAME=ROUTG");
    const shellCix = generateBiesseCixProgram(shellCnc);
    expect(shellCix.content).toContain('PARAM,NAME=ID,VALUE="KERF_SLOT_1"');

    // SCM Maestro (.XCS)
    const topXcs = generateScmXcsProgram(topCnc);
    expect(topXcs.content).toContain(`POLY_CONTOUR_${stadiumTop.id}`);
    expect(topXcs.content).toContain("POLYGON_SIZING_PASS");
    const shellXcs = generateScmXcsProgram(shellCnc);
    expect(shellXcs.content).toContain("KERF_SAW_3_2MM");

    // Endüstriyel CAM ZIP arşivi mpr/, cix/ ve xcs/ klasörlerini eksiksiz barındırır
    const zipBytes = exportIndustrialCamZipArchive(capProj, capBom);
    const zipLatin = Buffer.from(zipBytes).toString("latin1");
    expect(zipLatin).toContain("mpr/");
    expect(zipLatin).toContain("cix/");
    expect(zipLatin).toContain("xcs/");
  });

  it("V6.2 Ek Doğrulama D: İç Aksesuar Net Derinlik / Genişlik Zarfı, Menteşe Plakası Y-Çakışması ve Katalog Şablon Uyumluluğu", () => {
    const proj = createInitialProject();
    const mod = proj.modules[0];
    mod.dimensions = { width: 900, height: 2200, depth: 380 }; // netInnerD = 380 - 26 = 354mm (< 450mm pantolonluk sınırı!)
    mod.bays[0].specialFittings = [
      {
        id: "fit_tr_shallow",
        bayIndex: 0,
        elevationY: 600,
        type: "trouser_rack",
        height: 90,
      },
    ];

    const repShallow = evaluateUnifiedEngineeringModel(proj);
    const envErr = repShallow.blockingSafetyAndEngineeringErrors.find(
      (e) => e.code === "ERR_INTERNAL_FITTING_ENVELOPE_VIOLATION"
    )!;
    expect(envErr).toBeDefined();
    expect(repShallow.canExportToCncAndSaw).toBe(false);

    // Kullanıcı onaylı derinlik artırma önerisiyle hata temizlenir
    const fixedDepthProj = applyApprovedRemediationProposal(proj, envErr.remediationProposals![0]);
    const repAfterDepth = evaluateUnifiedEngineeringModel(fixedDepthProj);
    expect(
      repAfterDepth.blockingSafetyAndEngineeringErrors.some(
        (e) => e.code === "ERR_INTERNAL_FITTING_ENVELOPE_VIOLATION"
      )
    ).toBe(false);

    // Menteşe taban plakası Y kotuna (alt menteşe ~84mm) tam denk gelen tel sepet çakışması + 25mm besleme çıtasıyla çözüm
    fixedDepthProj.modules[0].bays[0].specialFittings = [
      {
        id: "fit_basket_hinge_clash",
        bayIndex: 0,
        elevationY: 76,
        type: "wire_basket",
        height: 150,
      },
    ];
    const repClash = evaluateUnifiedEngineeringModel(fixedDepthProj);
    const clashErr = repClash.blockingSafetyAndEngineeringErrors.find(
      (e) => e.code === "ERR_INTERNAL_FITTING_HINGE_BODY_CLASH"
    )!;
    expect(clashErr).toBeDefined();

    const fixedSpacerProj = applyApprovedRemediationProposal(
      fixedDepthProj,
      clashErr.remediationProposals![0]
    );
    const repAfterSpacer = evaluateUnifiedEngineeringModel(fixedSpacerProj);
    expect(
      repAfterSpacer.blockingSafetyAndEngineeringErrors.some(
        (e) => e.code === "ERR_INTERNAL_FITTING_HINGE_BODY_CLASH"
      )
    ).toBe(false);

    // Katalogdaki geçerli özel aksesuarlı şablonlar (Vestiyer, Pantolonluk, Baharatlık, Boy Kiler) üretim kapısından geçer
    const vestiyerTpl = V5_SPECIALIZED_MODULE_TEMPLATES.find((t) => t.templateId === "v5_entryway_vestiyer_180")!;
    const catalogMods = [
      vestiyerTpl.createInstance("cat_vest"),
      getV4TemplateById("tpl_wd_17_trouser_unit")!.createInstance("cat_tr"),
      getV4TemplateById("tpl_kb_11_narrow_spice")!.createInstance("cat_sp"),
      getV4TemplateById("tpl_kt_02_pantry_pullout")!.createInstance("cat_pt"),
    ];
    catalogMods.forEach((cm, idx) => {
      cm.position = { x: idx * 2000, y: 0, z: 0 };
      const singleProj = { ...createInitialProject(), modules: [cm] };
      singleProj.space.walls[0].length = 9000;
      const r = evaluateUnifiedEngineeringModel(singleProj);
      expect(r.canExportToCncAndSaw).toBe(true);
    });
  });

  it("V7 Doğrulama E (P0-01 & P3-01): SCM Maestro .XCS X/Y Eksen Doğruluğu, Arkalık Kanalı Yönü ve Nesting SVG Poligon Kontur Senkronu", () => {
    const scm = generateScmXcsProgram({
      id: "side_scm_v7",
      moduleId: "m1",
      moduleName: "Gardırop",
      partRole: "carcass_side_left",
      pieceName: "Sol Yan Dikme",
      thicknessMm: 18,
      lengthMm: 2200,
      widthMm: 600,
      hasBackGroove: true,
      backGrooveOffsetMm: 20,
      drillingOperations: [
        { x: 37, y: 1800, diameter: 5, depth: 12, face: "top", type: "shelf_pin" },
        { x: 37, y: 1800, diameter: 5, depth: 12, face: "bottom", type: "shelf_pin_flip" },
      ],
    });
    // X = 1800.00 (boy ekseni), Y = 37.00 (en ekseni) ve arka yüzeyde Y = 600 - 37 = 563.00!
    expect(scm.content).toContain('CreateDrill("V_DRILL_1", 1800.00, 37.00, 12.00, 5.00');
    expect(scm.content).toContain('CreateDrill("V_DRILL_2", 1800.00, 563.00, 12.00, 5.00');
    expect(scm.content).toContain(
      'CreateBladeCut("BACK_GROOVE_8_5MM", "GROOVE_SAW", TypeOfProcess.Groove, 0.00, 584.00, 2200.00, 584.00'
    );

    // P3-01: Kapsül stadyum modülünde Nesting SVG gerçek <polygon> konturu çizer
    const capProj = createInitialProject();
    capProj.modules[0].dimensions = { width: 1200, height: 1000, depth: 500 };
    capProj.modules[0].carcass.hullShape = "capsule_stadium";
    capProj.modules[0].bays.forEach((b, bi) => {
      b.shelves = [{ id: `s_${bi}`, bayIndex: bi, elevationY: 360, isAdjustable: true }];
      b.hangingRails = [];
    });
    const capBom = generateBOMForProject(capProj);
    const svg = generateNestingDiagramSvg(capBom);
    expect(svg).toContain("<polygon points=");
  });

  it("V7 Doğrulama F (P0-02 & P1-01): AVENTOS HF Üst Kanatta Sıfır Kulp Deliği, Alt Kanatta Yatay Kulp ve Dar Çekmecede Sessiz C-C Kırpma Engeli", () => {
    const hfMod = getV4TemplateById("tpl_kw_06_lift_bifold")!.createInstance("kw_hf");
    hfMod.dimensions = { width: 900, height: 760, depth: 350 };
    hfMod.bays[0].door.doorSystemId = "lift_bi_fold";
    hfMod.bays[0].door.type = "lift_bi_fold";
    hfMod.bays[0].door.handleCategory = "bar_handle";
    const hfProj = { ...createInitialProject(), modules: [hfMod] };

    const hfGeo = generateModuleGeometry(hfMod);
    expect(hfGeo.components.some((c) => c.id.includes("_lift_bifold_top_handle_"))).toBe(false);
    expect(hfGeo.components.some((c) => c.id.includes("_lift_bifold_bot_handle_"))).toBe(true);

    const hfBom = generateBOMForProject(hfProj);
    const upperLeaf = hfBom.cutList.find((p) => p.id.includes("_lift_bifold_top"))!;
    const lowerLeaf = hfBom.cutList.find((p) => p.id.includes("_lift_bifold_bot"))!;
    expect((upperLeaf.holes || []).filter((h) => h.purpose === "handle").length).toBe(0);

    const lowerHandleHoles = (lowerLeaf.holes || []).filter((h) => h.purpose === "handle");
    expect(lowerHandleHoles.length).toBe(2);
    // Yatay kulp: iki delik aynı Y kotunda (40mm) ve tam C-C aralığında!
    expect(lowerHandleHoles[0].y).toBe(lowerHandleHoles[1].y);
    expect(Math.abs(lowerHandleHoles[1].x - lowerHandleHoles[0].x)).toBe(160);

    // Dar çekmeceye (280mm dış en) 320mm uzun kulp seçildiğinde sessiz kırpma yerine ERR_HANDLE_CC_EXCEEDS_PANEL_SPAN verir!
    const narrowDrwMod = getV4TemplateById("tpl_kb_05_three_drawers")!.createInstance("kb_narrow_drw");
    narrowDrwMod.dimensions.width = 280;
    narrowDrwMod.bays[0].door.handleCategory = "long_profile_handle";
    const narrowProj = { ...createInitialProject(), modules: [narrowDrwMod] };
    const repNarrow = evaluateUnifiedEngineeringModel(narrowProj);
    const ccErr = repNarrow.blockingSafetyAndEngineeringErrors.find(
      (e) => e.code === "ERR_HANDLE_CC_EXCEEDS_PANEL_SPAN"
    )!;
    expect(ccErr).toBeDefined();
    expect(repNarrow.canExportToCncAndSaw).toBe(false);

    const fixedKnobProj = applyApprovedRemediationProposal(
      narrowProj,
      ccErr.remediationProposals![0]
    );
    expect(evaluateUnifiedEngineeringModel(fixedKnobProj).canExportToCncAndSaw).toBe(true);
  });

  it("V7 Doğrulama G (P0-03, P1-02, P1-03, P1-04 & P1-05): 2770mm Net Plaka Sınırı, 6mm Cam Raf Sehimi, Aynalı Kapak Kütlesi, Asma TV Askısı ve 0.4mm OBB Çakışması", () => {
    // 1) P0-03: 2790mm bazasız dolap (yan dikme 2790mm > 2770mm baş-kesimli net plaka!) engellenir
    const tallProj = createInitialProject();
    tallProj.space.ceilingHeight = 3000;
    tallProj.modules[0].dimensions.height = 2790;
    tallProj.modules[0].carcass.plinthHeight = 0;
    const repTall = evaluateUnifiedEngineeringModel(tallProj);
    const sheetErr = repTall.blockingSafetyAndEngineeringErrors.find(
      (e) => e.code === "ERR_PANEL_EXCEEDS_USABLE_SHEET_SIZE"
    )!;
    expect(sheetErr).toBeDefined();
    const clampedProj = applyApprovedRemediationProposal(tallProj, sheetErr.remediationProposals![0]);
    expect(
      evaluateUnifiedEngineeringModel(clampedProj).blockingSafetyAndEngineeringErrors.some(
        (e) => e.code === "ERR_PANEL_EXCEEDS_USABLE_SHEET_SIZE"
      )
    ).toBe(false);

    // 2) P1-02: 880mm açıklıkta 6mm ince cam raf kırılma/sehim riskiyle engellenir
    const glassProj = createInitialProject();
    glassProj.modules[0].dimensions.width = 920;
    glassProj.modules[0].bays = [glassProj.modules[0].bays[0]];
    glassProj.modules[0].bays[0].customWidth = undefined;
    glassProj.modules[0].bays[0].door.type = "double";
    glassProj.modules[0].bays[0].door.doorSystemId = "hinged_double";
    glassProj.modules[0].bays[0].shelves = [
      { id: "sh_thin_glass", bayIndex: 0, elevationY: 900, isAdjustable: true, isGlass: true, thickness: 6 },
    ];
    const repGlass = evaluateUnifiedEngineeringModel(glassProj);
    expect(
      repGlass.blockingSafetyAndEngineeringErrors.some(
        (e) => e.code === "ERR_SHELF_STRUCTURAL_DEFLECTION"
      )
    ).toBe(true);

    // 3) P1-03: 596x2350mm tek kanat aynalı kapak (+10 kg/m² gümüş ayna kütlesiyle >28 kg) menteşe sınırına takılır
    const mirrorProj = createInitialProject();
    mirrorProj.modules[0].dimensions = { width: 600, height: 2450, depth: 600 };
    mirrorProj.modules[0].bays = [mirrorProj.modules[0].bays[0]];
    mirrorProj.modules[0].bays[0].customWidth = undefined;
    mirrorProj.modules[0].bays[0].door.crossSectionProfile = "mirror_door";
    const repMirror = evaluateUnifiedEngineeringModel(mirrorProj);
    expect(
      repMirror.blockingSafetyAndEngineeringErrors.some(
        (e) => e.code === "CHK_03_DOOR_WEIGHT_EXCEEDS_HINGE_LIMIT"
      )
    ).toBe(true);

    // 4) P1-04: Asma TV ünitesi (2400mm) BOM'a >=3 adet EN 14749 askı alır ve desteksiz alçıpanda engellenir
    const tvTpl = V5_SPECIALIZED_MODULE_TEMPLATES.find((t) => t.templateId === "v5_tv_media_console_240")!;
    const tvMod = tvTpl.createInstance("tv_float");
    tvMod.position.y = 350;
    tvMod.carcass.plinthHeight = 0;
    const tvProj = { ...createInitialProject(), modules: [tvMod] };
    const tvBom = generateBOMForProject(tvProj);
    const hangerItem = tvBom.hardwareList.find((h) => h.sku === "HW_WALL_HANGER_EN14749")!;
    expect(hangerItem.quantity).toBeGreaterThanOrEqual(3);
    tvProj.space.wallSubstrateType = "drywall_unreinforced";
    expect(
      evaluateUnifiedEngineeringModel(tvProj).blockingSafetyAndEngineeringErrors.some(
        (e) => e.code === "ERR_DRYWALL_UNREINFORCED_HEAVY_HANG"
      )
    ).toBe(true);

    // 5) P1-05: 0.4mm fiziksel iç içe geçme ERR_MODULE_COLLISION verirken 0.0mm tam temas hatasız geçer
    const obbProj = createInitialProject();
    const mA = obbProj.modules[0];
    mA.dimensions.width = 1000;
    mA.bays[0].customWidth = undefined;
    const mB = JSON.parse(JSON.stringify(mA));
    mB.id = "mod_b_overlap";
    mB.position.x = 999.6; // 0.4mm iç içe geçme!
    obbProj.modules = [mA, mB];
    expect(
      evaluateUnifiedEngineeringModel(obbProj).blockingSafetyAndEngineeringErrors.some(
        (e) => e.code === "ERR_MODULE_COLLISION"
      )
    ).toBe(true);
    mB.position.x = 1000.0; // 0.0mm sıfır temas!
    expect(
      evaluateUnifiedEngineeringModel(obbProj).blockingSafetyAndEngineeringErrors.some(
        (e) => e.code === "ERR_MODULE_COLLISION"
      )
    ).toBe(false);
  });

  it("V7 Doğrulama H (P0-04, P2-01, P2-02 & P2-03): 90° Döndürülmüş Modül Priz-Dikme Çakışması, Bulaşık Buhar Bariyeri ve Mağaza approveProduction Kapısı", () => {
    // 1) P2-01: Yan duvarda 90° döndürülmüş alt dolabın yan dikmesi (Z=1200mm) yan duvardaki prizle çakışınca yakalanır!
    const rotMod = getV4TemplateById("tpl_kb_02_double_door")!.createInstance("kb_rot90");
    rotMod.position = { x: 0, y: 0, z: 1200 };
    rotMod.rotation = { x: 0, y: 90, z: 0 };
    const rotProj = { ...createInitialProject(), modules: [rotMod] };
    rotProj.space.elements = [
      {
        id: "elec_side_wall",
        type: "electrical",
        name: "Yan Duvar Fırın Prizi",
        position: { x: 10, y: 300, z: 1190 },
        dimensions: { width: 80, height: 80, depth: 40 },
      },
    ];
    expect(
      evaluateUnifiedEngineeringModel(rotProj).blockingSafetyAndEngineeringErrors.some(
        (e) => e.code === "ERR_MEP_OUTLET_BLOCKED_BY_UPRIGHT_PANEL"
      )
    ).toBe(true);

    // 2) P2-03: Bulaşık makinesi ve eviye modüllerinde koruyucu buhar bariyeri ve su sızdırmaz alt sac BOM'a eklenir
    const dshMod = getV4TemplateById("tpl_kb_10_dishwasher_front")!.createInstance("kb_dsh");
    const snkMod = getV4TemplateById("tpl_kb_08_sink_base")!.createInstance("kb_snk");
    snkMod.position.x = 700;
    const wetBom = generateBOMForProject({ ...createInitialProject(), modules: [dshMod, snkMod] });
    expect(wetBom.hardwareList.some((h) => h.sku === "HW_STEAM_BARRIER_DIFFUSER")).toBe(true);
    expect(wetBom.hardwareList.some((h) => h.sku === "HW_SINK_DRIP_MAT_ALU")).toBe(true);

    // 3) P0-04: useConfiguratorStore.approveProduction merkezi motorun yakaladığı devrilme riskinde onay vermez!
    const unstableProj = createInitialProject();
    unstableProj.modules[0].dimensions = { width: 800, height: 2200, depth: 340 };
    unstableProj.modules[0].bays[0].customWidth = undefined;
    unstableProj.modules[0].position = { x: 900, y: 0, z: 1200 }; // Duvara dayanmayan devrilme riskli dolap!
    useConfiguratorStore.setState({ project: unstableProj });
    const appRes = useConfiguratorStore.getState().approveProduction();
    expect(appRes.success).toBe(false);
    expect(appRes.message).toContain("ERR_FREESTANDING_TIPOVER_UNSAFE");
  });

  it("V7 Doğrulama I: Kapsül Stadyum Tabla Temizliği, Nesting DXF LED/Askı Katmanları ve ERP Adaptör Merkezi Kapı Kilidi", async () => {
    // 1) Kapsül stadyum alt ve üst tablalarında düz arkalık kanalı veya kenar minifix deliği açılmaz
    const capProj = createInitialProject();
    capProj.modules[0].carcass.hullShape = "capsule_stadium";
    capProj.modules[0].dimensions = { width: 1300, height: 920, depth: 480 };
    capProj.modules[0].bays.forEach((b, bi) => {
      b.shelves = [{ id: `s_cap_${bi}`, bayIndex: bi, elevationY: 340, isAdjustable: true }];
      b.hangingRails = [];
    });
    const capBom = generateBOMForProject(capProj);
    const capBottom = capBom.cutList.find((p) => p.id.includes("_capsule_bottom"))!;
    const capTop = capBom.cutList.find((p) => p.id.includes("_capsule_top"))!;
    expect(capBottom.hasBackGroove).toBe(false);
    expect(capTop.hasBackGroove).toBe(false);
    expect((capBottom.holes || []).length).toBe(0);
    expect((capTop.holes || []).length).toBe(0);

    // 2) Nesting DXF içinde gömme LED kanalı (GROOVE_W12_Z8) ve üst dolap askı kertmesi (NOTCH_WALL_HANGER) yer alır
    const wallLedMod = getV4TemplateById("tpl_kw_14_led_shelf_unit")!.createInstance("kw_led_nest");
    wallLedMod.carcass.ledLightingEnabled = true;
    wallLedMod.carcass.ledPlacementMode = "full_showcase";
    const wallLedProj = { ...createInitialProject(), modules: [wallLedMod] };
    const wallLedBom = generateBOMForProject(wallLedProj);
    const wallNestDxf = exportNestingSheetsDXF(wallLedBom);
    expect(wallNestDxf).toContain("GROOVE_W12_Z8");
    expect(wallNestDxf).toContain("NOTCH_WALL_HANGER");

    // 3) MockERPAdapter.publishProductionBlueprint merkezi doğrulama motorunun yakaladığı hatalarda üretimi reddeder
    const { MockERPAdapter } = require("../packages/integrations/src/erp-adapter");
    const erpAdapter = new MockERPAdapter();
    const badTipProj = createInitialProject();
    badTipProj.modules[0].dimensions = { width: 800, height: 2200, depth: 340 };
    badTipProj.modules[0].bays[0].customWidth = undefined;
    badTipProj.modules[0].position = { x: 900, y: 0, z: 1200 };
    const badTipBom = generateBOMForProject(badTipProj);
    await expect(
      erpAdapter.publishProductionBlueprint(badTipProj, badTipBom, "ORD_FAIL_01")
    ).rejects.toThrow("ERR_FREESTANDING_TIPOVER_UNSAFE");
  });

  it("V7.1 Doğrulama J: Suyolu Kompozit Blok (`grainGroupId`) Aynı Plaka Garantisi, 90° Yan Duvar Tesisat/45° OBB Engel Hassasiyeti ve Tip-B Yük Kuralı", () => {
    // 1) grainGroupId tanımlı 3 meşe çekmece klapası plaka optimizasyonunda AYNI plakada, aynı hizada ve kerf aralıklı kesilir!
    const drwMod = getV4TemplateById("tpl_kb_05_three_drawers")!.createInstance("kb_grain_strip");
    drwMod.carcass.doorMaterialId = "mat_veneer_oak";
    drwMod.bays[0].drawers.forEach((d) => {
      d.grainGroupId = "grp_oak_continuous_01";
    });
    const fillerMod = getV4TemplateById("tpl_wd_02_two_door")!.createInstance("wd_oak_other");
    fillerMod.position.x = 900;
    fillerMod.carcass.doorMaterialId = "mat_veneer_oak";

    const grainProj = { ...createInitialProject(), modules: [drwMod, fillerMod] };
    const grainBom = generateBOMForProject(grainProj);
    const oakNest = grainBom.nestingResults.find((nr) => nr.materialId === "mat_veneer_oak")!;
    expect(oakNest).toBeDefined();

    const frontIds = grainBom.cutList
      .filter((p) => p.grainGroupId === "grp_oak_continuous_01")
      .map((p) => p.id);
    expect(frontIds.length).toBe(3);

    const hostingSheetIndices = new Set<number>();
    const placedFronts: Array<{ x: number; y: number; width: number; length: number }> = [];
    for (const sh of oakNest.sheets) {
      for (const pp of sh.placedPieces) {
        if (frontIds.includes(pp.pieceId)) {
          hostingSheetIndices.add(sh.sheetIndex);
          placedFronts.push(pp);
        }
      }
    }
    // Üç çekmece klapasının tamamı tek ve aynı plakada yer alır ve X koordinatları birebir hizalıdır!
    expect(hostingSheetIndices.size).toBe(1);
    expect(placedFronts.length).toBe(3);
    expect(placedFronts[0].x).toBe(placedFronts[1].x);
    expect(placedFronts[1].x).toBe(placedFronts[2].x);

    // 2) 90° döndürülmüş yan duvar modülünde su tesisatı uyumsuzluğu yakalanır; eviye modülü konduğunda hem hata hem WARN_PLUMBING_UNASSIGNED kalkar!
    const sideBase = getV4TemplateById("tpl_kb_02_double_door")!.createInstance("kb_side_wrong");
    sideBase.position = { x: 0, y: 0, z: 1000 };
    sideBase.rotation = { x: 0, y: 90, z: 0 };
    const sidePlumbProj = { ...createInitialProject(), modules: [sideBase] };
    sidePlumbProj.space.elements = [
      {
        id: "plumb_left_wall",
        type: "plumbing",
        name: "Sol Duvar Eviye Tesisatı",
        position: { x: 0, y: 450, z: 1300 },
        rotationY: 90,
        dimensions: { width: 120, height: 120, depth: 80 },
      },
    ];
    const repWrongSide = evaluateUnifiedEngineeringModel(sidePlumbProj);
    expect(
      repWrongSide.blockingSafetyAndEngineeringErrors.some(
        (e) => e.code === "ERR_PLUMBING_INCOMPATIBLE_MODULE"
      )
    ).toBe(true);

    const sideSink = getV4TemplateById("tpl_kb_08_sink_base")!.createInstance("kb_side_sink");
    sideSink.position = { x: 0, y: 0, z: 1000 };
    sideSink.rotation = { x: 0, y: 90, z: 0 };
    sidePlumbProj.modules = [sideSink];
    const repRightSide = evaluateUnifiedEngineeringModel(sidePlumbProj);
    expect(
      repRightSide.blockingSafetyAndEngineeringErrors.some(
        (e) => e.code === "ERR_PLUMBING_INCOMPATIBLE_MODULE"
      )
    ).toBe(false);
    expect(
      repRightSide.findings.some((f) => f.code === "WARN_PLUMBING_UNASSIGNED")
    ).toBe(false);

    // 3) 45° açılı ada/masa modülü AABB kutusu kolona değse bile gerçek OBB gövdesi 60mm uzaktayken sahte ERR_COLUMN_COLLISION üretmez!
    const angledMod = getV4TemplateById("tpl_kb_02_double_door")!.createInstance("kb_angled_45");
    angledMod.dimensions = { width: 1000, height: 720, depth: 500 };
    angledMod.bays[0].door.type = "open";
    angledMod.bays[0].door.doorSystemId = "open";
    angledMod.position = { x: 800, y: 0, z: 800 };
    angledMod.rotation = { x: 0, y: 45, z: 0 };
    const angledProj = { ...createInitialProject(), modules: [angledMod] };
    // AABB sol-üst köşesi (800, 800) civarında ama 45° döndürülmüş gerçek kutunun dışında kalan kolon:
    angledProj.space.elements = [
      {
        id: "col_near_aabb_corner",
        type: "column",
        name: "Köşe Kolon",
        position: { x: 810, y: 0, z: 810 },
        dimensions: { width: 120, height: 2600, depth: 120 },
      },
    ];
    const repAngled = evaluateUnifiedEngineeringModel(angledProj);
    expect(
      repAngled.blockingSafetyAndEngineeringErrors.some((e) => e.code === "ERR_COLUMN_COLLISION")
    ).toBe(false);

    // 4) Tip-B (`top_bottom_through`) ağır boy dolapta kesme yükü uyarısı ve kullanıcı onaylı Tip-A geçişi çalışır!
    const tipBProj = createInitialProject();
    tipBProj.modules[0].carcass.carcassJoineryTopology = "top_bottom_through";
    const repTipB = evaluateUnifiedEngineeringModel(tipBProj);
    const shearWarn = repTipB.findings.find(
      (f) => f.code === "CHK_TOP_BOTTOM_THROUGH_LEG_SHEAR"
    )!;
    expect(shearWarn).toBeDefined();
    const fixedTipA = applyApprovedRemediationProposal(
      tipBProj,
      shearWarn.remediationProposals![0]
    );
    expect(fixedTipA.modules[0].carcass.carcassJoineryTopology).toBe("sides_through");
  });

  it("V7.2 Doğrulama K: Gerçek Zod Anahtar Kırpma Altında Sıfır Veri Kaybı (48+ V5/V6/V7 Alanı) ve Mağaza Atomik Onaylı Düzeltme Senkronu", () => {
    const { parseAndMigrateProject } = require("../packages/core/src/schemas");
    const richProj = createInitialProject();
    richProj.ergonomicProfileId = "ACCESSIBLE_EN17210";
    richProj.space.wallSubstrateType = "reinforced_concrete";
    richProj.customMaterials = [
      {
        id: "mat_custom_test_hpl",
        name: "Özel Kompakt HPL",
        category: "compact",
        thickness: 18,
        densityKgPerM3: 1350,
        elasticModulusMpa: 9000,
        mechanicalDataVerified: true,
        colorHex: "#222222",
        roughness: 0.4,
        metalness: 0.05,
        costPerM2: 95,
        edgeBandCostPerM: 3,
        hasGrain: false,
      },
    ];
    const m0 = richProj.modules[0];
    m0.carcass.preMillingMm = 1.0;
    m0.carcass.allowJumboSheet3660 = true;
    m0.carcass.carcassJoineryTopology = "miter_45";
    m0.carcass.wallAnchored = true;
    m0.carcass.floorAnchored = true;
    m0.carcass.slopedCeiling = { mode: "back_slope", kneeHeightMm: 1450, slopeAngleDeg: 32 };
    m0.bays[0].shelves[0].isGlass = true;
    m0.bays[0].shelves[0].thickness = 6;
    m0.bays[0].door.doorFrameConstruction = "five_piece_rail_stile";
    m0.bays[0].door.grainGroupId = "grp_veneer_01";
    m0.bays[1].drawers[0].hasSiphonCutout = true;
    m0.bays[1].drawers[0].hasCooktopHeatShield = true;
    m0.bays[1].drawers[0].grainGroupId = "grp_veneer_01";

    // Açılı masa (0 bölmeli tamamlayıcı modül) da şemadan kayıpsız geçer!
    richProj.modules.push({
      id: "mod_angled_tbl_schema",
      name: "Açılı Ada Masası",
      category: "complementary",
      complementaryRole: "attached_table",
      position: { x: 1200, y: 0, z: 600 },
      rotation: { x: 0, y: 315, z: 0 },
      dimensions: { width: 1600, height: 750, depth: 850 },
      bays: [],
      carcass: { ...m0.carcass, slopedCeiling: undefined },
      attachedTableConfig: {
        anchorModuleId: m0.id,
        angleDeg: 45,
        legStyle: "pedestal_column",
        topThicknessMm: 40,
      },
    });

    const parsed = parseAndMigrateProject(JSON.parse(JSON.stringify(richProj)));
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.ergonomicProfileId).toBe("ACCESSIBLE_EN17210");
      expect(parsed.data.space.wallSubstrateType).toBe("reinforced_concrete");
      expect(parsed.data.customMaterials?.[0]?.elasticModulusMpa).toBe(9000);
      expect(parsed.data.modules[0].carcass.preMillingMm).toBe(1.0);
      expect(parsed.data.modules[0].carcass.allowJumboSheet3660).toBe(true);
      expect(parsed.data.modules[0].carcass.wallAnchored).toBe(true);
      expect(parsed.data.modules[0].carcass.slopedCeiling?.kneeHeightMm).toBe(1450);
      expect(parsed.data.modules[0].bays[0].shelves[0].isGlass).toBe(true);
      expect(parsed.data.modules[0].bays[0].shelves[0].thickness).toBe(6);
      expect(parsed.data.modules[0].bays[0].door.doorFrameConstruction).toBe("five_piece_rail_stile");
      expect(parsed.data.modules[0].bays[1].drawers[0].hasSiphonCutout).toBe(true);
      expect(parsed.data.modules[0].bays[1].drawers[0].grainGroupId).toBe("grp_veneer_01");
      expect(parsed.data.modules[1].attachedTableConfig?.angleDeg).toBe(45);
    }

    // Store atomik onaylı düzeltme: 18mm sarkan raf 25mm rafa yükseltildiğinde BOM raf kalınlığı da ANINDA 25mm olur!
    const sagProj = createInitialProject();
    sagProj.modules[0].dimensions.width = 1150;
    sagProj.modules[0].bays = [sagProj.modules[0].bays[0]];
    sagProj.modules[0].bays[0].customWidth = undefined;
    sagProj.modules[0].bays[0].door.type = "double";
    sagProj.modules[0].bays[0].door.doorSystemId = "hinged_double";
    useConfiguratorStore.getState().importProjectJSON(JSON.stringify(sagProj));
    const repBefore = evaluateUnifiedEngineeringModel(useConfiguratorStore.getState().project);
    const sagErr = repBefore.blockingSafetyAndEngineeringErrors.find(
      (e) => e.code === "ERR_SHELF_STRUCTURAL_DEFLECTION"
    )!;
    expect(sagErr).toBeDefined();
    useConfiguratorStore.getState().applyApprovedEngineeringFix(sagErr.remediationProposals![0]);
    const updatedShelfCut = useConfiguratorStore
      .getState()
      .bom.cutList.find((p) => p.id.includes(sagErr.targetComponentId!))!;
    expect(updatedShelfCut.thicknessMm).toBe(25);
  });
});
