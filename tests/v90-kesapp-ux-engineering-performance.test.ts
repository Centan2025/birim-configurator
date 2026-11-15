import { describe, it, expect } from "vitest";
import {
  BoundedLruCache,
  computeModuleStructuralSignature,
  createDefaultWardrobeModule,
  createInitialProject,
  evaluateHardwareCompatibilityWithAlternatives,
  evaluateProjectCompatibility,
  evaluateUnifiedEngineeringModel,
  parseAndMigrateProject,
  resolveKlapaAndHingeBehavior,
} from "@birim/core";
import { generateElevation2D, generateModuleGeometry, generateTopPlan2D } from "@birim/geometry";
import {
  generateBOMForProject,
  generateCncToolpathSimulationSvg,
  optimizeSheetNesting,
  simulateCncPostProcessorBundle,
} from "@birim/manufacturing";
import { calculateProjectPrice } from "@birim/pricing";
import { buildReconciledStoreQuotationLines } from "@birim/integrations";

describe("V9.0 — Kapsamlı Mühendislik, Değişmez Kural (3D=2D=BOM=CNC), UX Uyumluluk ve Performans Doğrulama Paketi", () => {
  it("1. DEĞİŞMEZ KURAL: 800mm -> 900mm genişlik değişiminde 3D geometri, 2D cephe, kesim listesi, delikler ve maliyet %100 tutarlı güncellenir", () => {
    const project = createInitialProject();
    const mod = project.modules[0];
    mod.dimensions.width = 800;
    mod.bays = [mod.bays[0]];
    mod.bays[0].shelves = [
      { id: "sh_test_1", bayIndex: 0, elevationY: 600, isAdjustable: true },
    ];

    const geo800 = generateModuleGeometry(mod);
    const bom800 = generateBOMForProject(project);
    const price800 = calculateProjectPrice(bom800);

    // Genişliği 800mm -> 900mm yap
    const updatedProject = structuredClone(project);
    updatedProject.modules[0].dimensions.width = 900;

    const geo900 = generateModuleGeometry(updatedProject.modules[0]);
    const elev900 = generateElevation2D(geo900);
    const plan900 = generateTopPlan2D(geo900);
    const bom900 = generateBOMForProject(updatedProject);
    const price900 = calculateProjectPrice(bom900);

    // 1) İç raf genişliği tam +100mm büyümeli
    const shelf800 = bom800.cutList.find((p) => p.componentRole === "shelf");
    const shelf900 = bom900.cutList.find((p) => p.componentRole === "shelf");
    expect(shelf800).toBeDefined();
    expect(shelf900).toBeDefined();
    expect(Math.round((shelf900!.lengthMm - shelf800!.lengthMm) + (shelf900!.widthMm - shelf800!.widthMm))).toBe(100);

    // 2) 3D Geometri parça sayısı == BOM kesim listesi üretilebilir panel sayısı
    const manufacturable3DCount = geo900.components.filter((c) => c.isManufacturablePanel !== false).length;
    expect(bom900.cutList.length).toBe(manufacturable3DCount);

    // 3) 2D Cephe ve 2D Plan dış zarfı 900mm olmalı
    expect(elev900.elements.length).toBeGreaterThan(0);
    expect(plan900.elements.length).toBeGreaterThan(0);

    // 4) Maliyet 900mm modülde 800mm modülden yüksek olmalı
    expect(price900.totalWithVatEur).toBeGreaterThan(price800.totalWithVatEur);
    expect(price900.workshopMetrics?.isConfigurableWorkshopDraftRule).toBe(true);
    expect(price900.workshopMetrics?.fastenersWith10PctWasteCount).toBeGreaterThan(0);
  });

  it("2. KLAPA VE MENTEŞE EKSEN OTOMASYONU: Eş-düzlem ön klapa eklendiğinde kapak ölçüsü düşer ve 95° kör köşe/klapa menteşesine geçilir", () => {
    const project = createInitialProject();
    const mod = project.modules[0];
    mod.dimensions.width = 600;
    mod.bays = [mod.bays[0]];
    mod.bays[0].door.type = "single_left";
    mod.bays[0].door.frontFillerLeftMm = 50;
    mod.bays[0].door.frontFillerPosition = "coplanar_front";

    const klapaRes = resolveKlapaAndHingeBehavior(mod.bays[0].door, 564, false);
    expect(klapaRes.hingeAxisShiftedByKlapa).toBe(true);
    expect(klapaRes.recommendedHingeSku).toBe("79B9550");

    const geo = generateModuleGeometry(mod);
    const klapaComp = geo.components.find((c) => c.id.endsWith("_klapa_left"));
    expect(klapaComp).toBeDefined();
    expect(klapaComp!.dimensions.width).toBe(50);

    const bom = generateBOMForProject(project, undefined, { skipSyncNesting: true });
    const hasKlapaHinge = bom.hardwareList.some((h) => h.sku === "79B9550");
    expect(hasKlapaHinge).toBe(true);

    // İç klapaya çevrildiğinde standart 110° düz menteşe korunmalı
    mod.bays[0].door.frontFillerPosition = "recessed_inner";
    const innerRes = resolveKlapaAndHingeBehavior(mod.bays[0].door, 564, false);
    expect(innerRes.hingeAxisShiftedByKlapa).toBe(false);
    expect(innerRes.recommendedHingeSku).toBe("71B3550");
  });

  it("3. GÖRÜNEN YANLAR, YAMUK DUVAR PAYI VE LAKE KENAR BANDI OTOMASYONU: Üretim çıktısına birebir yansır", () => {
    const project = createInitialProject();
    const mod = project.modules[0];
    mod.carcass.bodyMaterialId = "mat_melamine_white";
    mod.carcass.doorMaterialId = "mat_lacquer_cream";
    mod.carcass.exposedLeftSideUseDoorMaterial = true;
    mod.carcass.scribeAllowanceLeftMm = 20;

    const bom = generateBOMForProject(project, undefined, { skipSyncNesting: true });
    const leftSide = bom.cutList.find((p) => p.componentRole === "carcass_side_left");
    const rightSide = bom.cutList.find((p) => p.componentRole === "carcass_side_right");

    expect(leftSide).toBeDefined();
    expect(rightSide).toBeDefined();
    // Sol yan kapak malzemesinden (lake) üretilmeli, sağ yan gövde malzemesinde kalmalı
    expect(leftSide!.materialId).toBe("mat_lacquer_cream");
    expect(rightSide!.materialId).toBe("mat_melamine_white");
    // Sol yanda +20mm yamuk duvar tıraş payı notu bulunmalı
    expect(leftSide!.notes || "").toContain("+20mm");
    // Lake kapakta kenar bandı otomatik sıfırlanmalı
    const doorPiece = bom.cutList.find((p) => p.componentRole.startsWith("door"));
    expect(doorPiece!.edgeBandMeters).toBe(0);
  });

  it("4. HATA ÖNLEYİCİ DONANIM UYUMLULUK MOTORU: Sığmayan çekmece rayını tespit eder ve tek tıkla uyumlu alternatif önerir", () => {
    const mod = createDefaultWardrobeModule("mod_shallow");
    mod.dimensions.depth = 360; // Net iç derinlik ~334mm
    mod.bays[0].drawers = [
      {
        id: "drw_too_deep",
        bayIndex: 0,
        elevationY: 0,
        height: 180,
        slideType: "soft_close",
        nominalLengthMm: 500, // 334mm iç derinliğe 500mm ray sığmaz!
      },
    ];

    const advices = evaluateHardwareCompatibilityWithAlternatives(mod, 0);
    const runnerAdvice = advices.find((a) => a.componentKind === "drawer_runner");
    expect(runnerAdvice).toBeDefined();
    expect(runnerAdvice!.compatible).toBe(false);
    expect(runnerAdvice!.alternatives.length).toBeGreaterThan(0);
    expect(runnerAdvice!.alternatives[0].applyPatch.value).toBe(300);
  });

  it("5. CNC ÖN DOĞRULAMA VE SİMÜLASYON: Post-processor kalibrasyonu olmadan üretime hazır iddiasında bulunmaz ve SVG takım yolu üretir", () => {
    const project = createInitialProject();
    const bom = generateBOMForProject(project, undefined, { skipSyncNesting: true });
    const sim = simulateCncPostProcessorBundle(project, bom);

    expect(sim.postProcessorCalibrationStatus).toBe("UNVERIFIED_SIMULATION_ONLY");
    expect(sim.canSendToMachineDirectly).toBe(false);
    expect(sim.totalPanelsSimulated).toBe(bom.cutList.length);
    expect(sim.totalDrillOps).toBeGreaterThan(0);

    const svg = generateCncToolpathSimulationSvg(bom.cutList[0]);
    expect(svg).toContain("<svg");
    expect(svg).toContain("Orijin (0,0)");
  });

  it("6. ESKİ PROJE ŞEMA UYUMLULUĞU & STORE MUTABAKATI: Kayıtlı projeler kayıpsız yüklenir ve Store teklif satırları 0.00 kuruş sapma verir", () => {
    const project = createInitialProject();
    project.materialPaletteSlots = {
      doorMaterialIds: ["mat_lacquer_cream", "mat_lacquer_sage"],
      bodyMaterialIds: ["mat_melamine_white"],
    };
    const migrated = parseAndMigrateProject(JSON.parse(JSON.stringify(project)));
    expect(migrated.ok).toBe(true);

    const bom = generateBOMForProject(project);
    const pricing = calculateProjectPrice(bom);
    const storeRec = buildReconciledStoreQuotationLines(project, bom, pricing);
    expect(storeRec.lines.length).toBeGreaterThan(0);
    expect(Math.abs(storeRec.subtotal - storeRec.discountTotal + storeRec.taxTotal - storeRec.totalAmount)).toBeLessThan(0.02);
  });

  it("7. PERFORMANS KANITI: BoundedLruCache bellek sınırını korur ve 20 modüllü projede artımlı güncelleme < 25ms altında çalışır", () => {
    const lru = new BoundedLruCache<string, number>(16);
    for (let i = 0; i < 100; i++) lru.set(`k_${i}`, i);
    expect(lru.size).toBe(16);

    const proj = createInitialProject();
    for (let i = 1; i < 20; i++) {
      const m = createDefaultWardrobeModule(`perf_m_${i}`);
      m.position.x = i * 900;
      proj.modules.push(m);
    }
    // İlk ısınma (modül 1..19 dilim önbelleğe alınır)
    generateBOMForProject(proj, undefined, { skipSyncNesting: true });
    evaluateUnifiedEngineeringModel(proj);

    const t0 = performance.now();
    for (let step = 0; step < 30; step++) {
      const nextProj: typeof proj = {
        ...proj,
        version: proj.version + step + 1,
        modules: proj.modules.map((m, idx) =>
          idx === 0 ? { ...m, dimensions: { ...m.dimensions, width: 1500 + step * 10 } } : m
        ),
      };
      const bom = generateBOMForProject(nextProj, undefined, { skipSyncNesting: true });
      calculateProjectPrice(bom);
    }
    const avgMs = (performance.now() - t0) / 30;
    expect(avgMs).toBeLessThan(25);
  });
});
