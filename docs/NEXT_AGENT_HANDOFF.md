# Sonraki ajan için devir notu

Son güncelleme: **2026-11-11 — Europe/Istanbul**.

Bu dosya kısa başlangıç noktasıdır. Ayrıntılı uygulama sırası ve iş kabul koşulları [yürütme yol haritasındadır](V42_PLUS_EXECUTION_ROADMAP.md).

## 1. Şu an nerede kaldık?

- Proje: `birim-configurator`.
- Son gözlenen dal: `main`.
- Son gözlenen HEAD: `fdd818f`.
- Son delta (2026-11-11): `SimpleCustomerInspector.tsx` (`D` -> `depth`, `isSlidingModule` tanımı), `mesh-generator.ts` (`plinth` -> `plinthHeight`), `bom-generator.ts` (`mod` -> `module`) çalışma zamanı `ReferenceError` hataları ve çakışan `public/favicon.ico` kaynaklı `500` hatası giderildi.
- **V4.1 düzeltmeleri, raporları ve bu devam belgeleri henüz commitlenmiş değildir.** Yeni oturumda Git durumunu tekrar kontrol et; bu bilgi sonraki commitlerden sonra değişebilir.
- V4.1 + V4.2 temel sözleşme sonucu: **KISMİ KABUL (Yazılım Sözleşmeleri İlerletildi, Üretim Kapısı Fail-Closed Korundu)**. Tüm ürün/üretim sistemi fiziksel fabrika kanıtı olmadan tamamlanmış sayılmaz.
- Son kayıtlı test kanıtı (2026-11-05):
  - `npm test`: **18 test dosyası, 108/108 unit/regresyon testi geçti** (`tests/v42-source-geometry-persistence.test.ts` ve `tests/worker-race-condition.test.ts` dahil).
  - `npm run lint` (`tsc --noEmit`): **0 hata ile geçti**.
  - `apps/configurator/public/favicon.ico`, `public/icon.svg` ve `src/app/icon.svg` eklenerek Vercel/tarayıcı `404 (Not Found) /favicon.ico` hatası giderildi.
  - 92/92 V4 modül şablonu, mutfak mekân şablonları, aktif modül denetçisi ve V4 Kütüphane Yöneticisi için 3B izometrik SVG görsel önizlemeler (`V3IsometricModuleIcon.tsx`) eklendi.
  - Stüdyo görünümünde modül seçildiğinde veya özellik değiştirildiğinde kameranın zoom ve bakış açısının sıfırlanması engellendi (`V3ThreeViewport.tsx`); 2D Cephe (`V3CadViewport2D.tsx`) ve 3D Ön/Perspektif (`V3ThreeViewport.tsx`) ekranlarında iç elemanları (raf, çekmece, askı borusu) fare ile taşırken komşu bölmelerdeki ve yan modüllerdeki raf hizası, çekmece üstü/altı ve askı hizalarına mıknatıslı yakalama (`elevationSnapEngine.ts`) eklendi.
  - `BIRIM_AUDIT_BUILD=1 npm run build`: `.next-v41` izole derlemesi başarıyla üretildi.
  - `npm run test:e2e:v41`: **27/27 gerçek Chromium E2E testi geçti** (port `3311`).
  - 92/92 modül şablonunda 4-mekân (`calculateFourSpaceDimensions`) ile 3D kapak geometrisi (`generateModuleGeometry`) arasındaki ölçü farkı (`dimensionalMismatch`) **0**'a indirildi.

## 2. İlk 15 dakikada yapılacaklar

1. Kök `AGENTS.md` dosyasını oku.
2. `git status --short`, `git branch --show-current`, `git log -5 --oneline` ve ilgili `git diff` çıktılarını incele. Yeni/untracked kaynak dosyalarını da hesaba kat; yalnız HEAD mevcut uygulamayı temsil etmiyor.
3. [V41_ACCEPTANCE_REPORT.md](V41_ACCEPTANCE_REPORT.md), [V41_BUG_REGISTER.md](V41_BUG_REGISTER.md) ve yol haritasındaki **WP-00** işini oku.
4. Kullanıcı yeni bir öncelik belirtmediyse WP-00 ile mevcut temel durumu doğrula; ardından **WP-01 kaynak/üretim doğrulama sözleşmesini** oluştur. Fiziksel fabrika kanıtı beklerken WP-02 geometri sözleşmesi üzerinde ilerlenebilir.
5. Önce seçilen işin mevcut hata/eksik senaryosunu yeniden üret. Eski raporu doğru kabul ederek doğrudan yeniden yazıma başlama.
6. Sonraki değişikliği küçük, uçtan uca doğrulanabilir kapsamda uygula. Örneğin “bir cephe geometrisi + 2D + BOM + round-trip”; aynı anda bütün mekanizmaları yeniden yazma.

## 3. Mutlaka korunacak V4.1 kazanımları

| Kazanım | Ana dosyalar | Kaybolmaması gereken davranış |
|---|---|---|
| Kulp geometrisi | `packages/geometry/src/handle-geometry.ts`, `mesh-generator.ts` | On kategori, kulpsuz seçim, iç çekmece istisnası; tutarlı kategori ve parent kimliği |
| Ortak transform | `packages/geometry/src/component-transform.ts`, `apps/configurator/src/components/componentMesh.ts` | Kapak/kulp aynı pivot/rotasyon; V2 ve V3 aynı render yorumunu kullanır |
| Yerleşim | `packages/core/src/rules.ts:calculateModulePlacement` | Döndürülmüş minimum köşe, 90/180/270° ve plan/3D tutarlılığı |
| BOM | `packages/manufacturing/src/bom-generator.ts` | Tam girdili bounded cache; panel kalınlığı/kesim eksenleri; çekmece başına ray ve malzeme |
| Nesting | `packages/manufacturing/src/sheet-nesting.ts` | Ondalıklı kerf koordinatları, trim, kalınlık bazlı ayrı gruplar, iki eksenli sığma kontrolü |
| Kalıcılık | `apps/configurator/src/store/useConfiguratorStore.ts` | Başarısız yazmada başarı kimliği döndürmeme; şema doğrulama; unique kopya kimlikleri; düzenleme sonrası draft |
| Adaptör işlemleri | `apps/configurator/src/v3/adapter/useV3Adapter.ts:commitAdapterState` | Geometri değişirken BOM/fiyat/validasyon eski kalmamalı |
| Kayıt geri bildirimi | `V3ProjectModal.tsx`, `app/page.tsx` | Sahte otomatik kayıt iddiası yok; kota hatası alert ve hata görünümü |
| Büyük sahne etkileşimi | `V3UnifiedWorkspace.tsx`, `V3ThreeViewport.tsx` | Ekle düğmesi listeyle örtüşmez; tüm sahneyi sığdır gerçek bounding box kullanır |
| Üretim güvenliği | `packages/core/src/v4-compatibility.ts`, `bom-generator.ts`, `selco-adapter.ts` | UNVERIFIED gate, draft BOM, taslak Selco ve ERP fail-closed korunur |

## 4. Sık karıştırılan gerçekler

- **92 şablonun hesap testinden geçmesi, 92 fiziksel olarak doğru ürün olduğu anlamına gelmez.** Özel köşe/eğim/cihaz açıklıkları ve bazı donanımlar hâlâ temsili.
- Kulp geometrisi çalışır; gömme/J-pull dahil mevcut görsel temsilin her biri gerçek işleme/CAD verisi değildir. Doğrulanmış montaj verisi olmadığı için kulp delikleri bilerek üretilmiyor.
- Katlanır, pocket, tambur ve gelişmiş kalkar hareketleri üretici kinematiği olarak kabul edilmedi. Matrisin değişmesi fiziksel doğruluk kanıtı değildir.
- `manufacturing-worker-client.ts` içindeki `setTimeout` yaklaşımı gerçek Web Worker değildir. Eski sonuçların iptali, hesaplamanın ana thread dışında olduğunu kanıtlamaz.
- Kütüphane ekranı salt okunur. Metadata lifecycle sınıfı, tam veri tabanlı şablon editörü veya kalıcı release rollback sistemi değildir. SHA-256 bütünlüğü, ürünün teknik doğruluğunu kanıtlamaz.
- Ekran görüntüleri **aday kanıttır**; tamamlanmış piksel regresyon sistemi değildir.
- `renderCpuMs` GPU süresi değildir. Yaklaşık 60 Hz rAF örneklemesi hareketli sahnenin 60 FPS render edildiğini kanıtlamaz.
- Fiyatlar ve EUR/TRY/KDV varsayımları örnektir; canlı, doğrulanmış ticari fiyatlandırma değildir.
- Geçerli üst seviye üretim engeli bugün proje genelindedir. Bunu tamamen kaldırmak yerine ileride kapsamlı, kanıt tabanlı parça/işlem doğrulamasına dönüştürmek gerekir.

## 5. Test ve yerel çalışma komutları

PowerShell; depo kökünde:

```powershell
git status --short
git branch --show-current
git log -5 --oneline
npm test
npm run lint

$previousAuditBuild = $env:BIRIM_AUDIT_BUILD
try {
    $env:BIRIM_AUDIT_BUILD = '1'
    npm run build
    if ($LASTEXITCODE -ne 0) { throw 'Audit build başarısız.' }
    npm run test:e2e:v41
    if ($LASTEXITCODE -ne 0) { throw 'Chromium testleri başarısız.' }
} finally {
    if ($null -eq $previousAuditBuild) {
        Remove-Item Env:BIRIM_AUDIT_BUILD -ErrorAction SilentlyContinue
    } else {
        $env:BIRIM_AUDIT_BUILD = $previousAuditBuild
    }
}
```

`npm run lint` şu anda ESLint değil, `tsc --noEmit` çalıştırır. Adını doğrulama kapsamından daha geniş yorumlama. Normal dev komutu `npm run dev`, port 3300'dür. İzole test sunucusunu Playwright 3311'de başlatır; önceden derleme gerekir. Port doluysa sahibini araştır; mevcut süreci körlemesine sonlandırma.

Next build `next-env.d.ts`, `tsconfig.json` ve `*.tsbuildinfo` dosyalarını değiştirebilir. Diff'i incele; gerçek kaynak değişikliğini koru, yalnız kendi üretilmiş değişikliklerini ayır. `git reset --hard` veya toplu restore kullanma.

## 6. Kanıtlar nerede?

- Kalıcı test özeti: [v41-evidence/test-summary.json](v41-evidence/test-summary.json).
- Kalıcı görüntü/ölçüm indeksi: [v41-evidence/README.md](v41-evidence/README.md).
- 92 satırlık katalog verisi: [v41-evidence/catalog.json](v41-evidence/catalog.json).
- Ayrıntılı log/trace: ignored `test-results/`; dosyalar yeni test koşusunda değişebilir veya silinebilir.
- Ana regresyonlar: `tests/v41-independent-audit.test.ts`, `tests/e2e-v41-audit.spec.ts`.
- Kullanılabilir eski V2/V3 regresyonları: `tests/e2e-browser.spec.ts`, `e2e-radical-simplicity.spec.ts`, `e2e-v3-prototypes.spec.ts`, `e2e-v31-unified.spec.ts`, `e2e-v4-library.spec.ts`.

Eski V41 kanıtlarını yeni koşu çıktısıyla üzerine yazarak “aynı sonuç” varsayma. Yeni sonuçları ayrı tarih/sürüm dizininde sakla.

## 7. Her oturum sonunda bu alanı güncelle

```text
Tarih / ajan / dal / HEAD:
  2026-11-05 / Antigravity / codex/v41-independent-audit / 27e3938 (feat(v4): universal furniture module & hardware library v4)
Kullanıcının güncel kapsamı:
  V4.2+ yol haritasında WP-00'dan başlayarak bağımlılık sırasına göre gerçek kod düzeltmeleri + "Oda & Duvar Ölçüsü / Engel Ekleme", "serbest elle duvar çizimi veya dışarıdan DWG/DXF/PDF kat planı ekleme", "Ctrl+Z geri alma", "2D planda obje (duvar/engel/modül) seçip silme", "duvar çizerken akıllı yakalama (snap) ve sürekli çizgi (polyline chain) çizebilme", "engelin nereye ekleneceği (hedef duvar / X-Z koordinatı / planda tıklayarak veya sürükleyerek yerleştirme)" özelliklerinin uygulanması ve kalan WP paketlerinin tamamlanması.
Çalışılan WP ve bug ID'leri:
  WP-00, WP-01, WP-02, WP-03, WP-04, WP-05, WP-06, WP-07, WP-08, WP-08.1, WP-09, WP-10, WP-12.
Tamamlanan somut davranış:
  1. WP-01: packages/core/src/v4-source-registry.ts ile 16 teknik kaynakta açık belge iddiası (documentExplicitClaims) ve uygulama çıkarımı (applicationInferences) ayrıldı; 5 doğrulama alanı tanımlandı. evaluateProjectCompatibility içine evidenceMatrix, CHK_15_* fail-closed kapıları ve sahte 'production_approved' statüsünü yakalayan CHK_15_TAMPERED_PRODUCTION_APPROVAL eklendi. V4LibraryAdminStore.invalidateEntriesForSourceRevision eklendi.
  2. WP-02, WP-04 & WP-05: calculateFourSpaceDimensions.doorLeaves tek kaynak sözleşmesi haline getirildi; 92/92 şablonda 4-mekân ile 3D kapak geometrisi uyumsuzluğu 0'a indirildi. Hiçbir menteşeli/katlanır kapak kanadının 600mm (60 cm) genişliği aşmaması kuralı (totalDoorSpanW > 600 ise otomatik çift kanat bölünmesi ve <=600mm sınırlandırması) eklendi. Dış çekmeceli (alt çekmece istifi veya üst çekmece + alt kapak kombinasyonu tpl_kb_19_drawer_door_combo) ve ankastre cihaz/kahve nişli (oven_tower, oven_microwave_tower, niche_tall, microwave_wall, fridge_surround) bölmelerde kapak yüksekliği ve Y başlangıç kotu otomatik kesilerek kapak-çekmece çakışması sıfırlandı. Dıştan görünür çekmece klapaları (drawer_front) üstteki kapaklarla aynı Z düzlemine (z = depth) ve sol/sağ dikme bini paylarına (doorX0Mm, fullDoorSpanWidthMm) hizalandı; en alt dış çekmecenin alt karkas tablasını da örterek yandaki tam boy kapakla aynı alt hizada bitmesi sağlandı; mutfak alt dolaplarında en üstteki dış çekmece klapasının üst hizası dolap üst hizasıyla (height - doorPerimeterGap) birebir eşitlendi. İç çekmeceler (tpl_wd_12_mixed_organizer vb.) dahil tüm çekmecelerde çekmece gövdesi yan dikmeleri, tabanı, arkalığı ve raylarının (boxZ0 = frontZ - boxD) klapanın (drawer_front) arka yüzünden sonra başlaması ve klapa önüne taşmaması sağlandı. Alt çekmeceli tüm standart dolap bölmelerinde çekmece istifinin hemen üstüne sabit raf/tabla (drawer_top_shelf) zorunluluğu eklendi. Yan menteşeli kapakların dönüş ekseni (pivot.z = front.position.z + front.dimensions.depth) dış menteşe mafsalına taşınarak ortak orta dikmeye bağlı komşu kapakların açıldığında kesişmesi engellendi. Üç kapaklı gardıroplarda (tpl_wd_03_three_door, tpl_wardrobe_3door_drawers ve createInitialProject) 1 tek kapaklı sol bölme + 1 çift kapaklı sağ bölme (toplam 3 eşit genişlikli kapak <= 60cm ve sağ bölmede alt 2 çekmece) oluşturuldu; tpl_wd_12_mixed_organizer ve tpl_sc_06_under_stairs 2 kapaklı olarak düzeltildi; çekmece dizilimleri aşağıdan yukarıya (üstte sığ çatal-kaşık/takı çekmecesi) hizalandı; 3D ankastre fırın/mikrodalga cihaz görselleri eklendi. 3D Perspektif ekranlarına (V3ThreeViewport.tsx) istediğimiz zaman açıp kapatılabilen 3B ölçü çizgileri ve milimetre etiketleri (G, Y, D ve bölme iç genişlikleri B1..Bn; viewport-3d-dimensions-toggle, in-canvas-toggle-dimensions, studio-toggle-dimensions, plan-right-toggle-dimensions) eklendi. Hem Stüdyo (studio-view-switcher: 3D Perspektif, 3D Ön, 3D Yan, 3D Üst, 2D Cephe, 2D Kesit, 2D Plan, Ölçü) hem Plan (2D+3D) ekranının sağ bölümüne görünüş alternatifleri eklendi; Stüdyo sol/sağ panelleri ile Plan 2D/3D bölme oranının fareyle tutulup sürüklenerek boyutlandırılması eklendi; "+ Aynı Modülden Ekle" (addAdjacentModule) düğmesinin aktif modülün kopyasını yanına eklemesi ve eklenen modüllerin/parçaların Stüdyo ve Plan ekranlarında hem modül sekmesi üzerindeki çöp kutusu (studio-delete-mod-*, plan-delete-mod-*), hem sağ denetçi "Sil / Parçayı Sil" düğmeleri, hem de Delete/Backspace tuşuyla elle silinebilmesi sağlandı. lift_parallel (AVENTOS HL), lift_bi_fold (AVENTOS HF), folding_side (WingLine L) ve pocket_retractable (REVEGO 2 aşamalı pivot + cep sürüşü) kinematik eğrileri ve BOM'a sızmayan (isManufacturablePanel: false) mekanizma kolu/ray bileşenleri eklendi (WP-04). 92/92 V4 şablonu ve tüm arayüz modül kartları için bölme bazlı gerçek kapak kanat sayısını (1/2/3/4 kapak), bölme bazlı çekmeceleri ve kulp çizgilerini birebir çizen mimari 3B izometrik SVG görsel önizlemeler (V3IsometricModuleIcon.tsx) eklendi. ComponentGeometry içine thicknessAxis ve isManufacturablePanel eklendi; specialFittings ve donanım tipi tamamlayıcı modüllerin ahşap kesim listesine (cutList) ve plaka optimizasyonuna sızması engellendi. Kör köşe (_blind_panel, _corner_filler), L-köşe (_corner_post) ve ankastre fırın (_appliance_shelf, _appliance_vent_strip) modüllerine çok parçalı karkas bileşenleri eklendi. 2D projeksiyonlarda açık kapak ve çekmecelerin kırpılmaması için dinamik viewBox genişletmesi eklendi.
  3. WP-03: Bölme bazlı setBayHandleCategory store aksiyonu, çekmece kulplarının kapak sınırları içine kenetlenmesi, üst/boy dolaplarda kendinden kulpların (j_pull, gola_profile, edge_profile) ergonomik erişim kotuna taşınması ve CHK_08_GOLA_INCOMPATIBLE_WITH_INSET, CHK_08_RECESSED_GRIP_MIN_THICKNESS, CHK_08_HANDLE_LENGTH_EXCEEDS_FRONT uyumluluk kuralları eklendi.
  4. WP-06 (Oda/Duvar/Engel + Sürekli Duvar Çizimi & Snap + Duvar Taşıma + Obje Seçip Silme + DWG/DXF/PDF Kat Planı):
     - packages/core/src/floorplan-parser.ts ile ASCII DXF/DWG (LINE, LWPOLYLINE) ve PDF (/MediaBox) kat planı ayrıştırıcısı ve CAD çizgilerinden parametrik duvar üreticisi (convertUnderlayPolylinesToWalls) eklendi.
     - V3CadViewport2D.tsx ve V3UnifiedWorkspace.tsx içine global Ctrl+Z (undo) ve Ctrl+Y / Ctrl+Shift+Z (redo) klavye kısayolları ve araç çubuğu butonları eklendi.
     - 2D Planda herhangi bir Duvar, Engel veya Modüle tıklayarak seçme (selectedPlanObject) ve Delete / Backspace tuşu veya "🗑 Seçiliyi Sil (Del)" butonuyla silme eklendi; seçili duvarları fareyle sürükleyerek taşıma ve X/Z/Boy/Açı° düzenleme (updateWallSegment) eklendi.
     - Duvar çiziminde iç yüz referanslı (y = z - thickness) 90°/270° köşe hizalaması, uç nokta, orta nokta, iç/dış köşe, CAD altlık köşesi, zincir başlangıcı ve 45°/90° açı yakalama ile kesintisiz çoklu çizgi (continuous polyline wall drawing) desteği eklendi.
     - Engel eklemede hedef duvar seçimi (Ana Duvar, yan/serbest duvarlar veya Serbest X,Z), X/Z/Genişlik girişleri, "🎯 Planda Tıkla Ekle" modu ve mevcut engelleri 2D planda fareyle sürükleyerek veya X/Z kutularından (updateSpaceObstacle) taşıma eklendi.
  5. WP-07: DesignProject ve DesignProjectSchema içine schemaVersion=4 zarfı, ileri sürüm (>4) reddi, V3->V4 migration, beginHistoryTransaction/commitHistoryTransaction atomik sürükleme/slider undo ve createRevisionSnapshot/diffRevisions/restoreRevisionSnapshot eklendi.
  6. WP-08, WP-08.1, WP-09, WP-10 & WP-12: V4LibraryAdminStore içine parametrik W/H/D ve kapak sistemi destekli createDraftTemplateEntry (WP-08.1), rollbackToRelease, saveToLocalStorage, loadFromLocalStorage ve V3UnifiedWorkspace.tsx kütüphane modalına canlı 3B görsel önizlemeli taslak oluşturma / release geri alma çubuğu (v4-library-authoring-bar) eklendi (WP-08). Çoklu modül seçimi (selectedModuleIds, Shift+Click, selectAllModules) ve tek adımlı atomik undo destekli toplu taşıma/malzeme/silme aksiyonları eklendi (WP-09). computePhysicalUvScale ile milimetre bazlı gerçek ölçekli UV tekrar ve lif yönü rotasyonu eklendi (WP-10). generateModuleGeometry içine bounded modül geometri önbelleği (moduleGeometryCache) ve manufacturing-worker-client.ts içine gerçek tarayıcı Web Worker (Blob URL worker thread) izolasyonu, projectId + revisionId + sequenceId zarfı ve eski worker'ı anında sonlandırma (worker.terminate()) eklendi (WP-12).
Değişen dosyalar / migration:
  - Yeni: packages/core/src/v4-source-registry.ts, packages/core/src/floorplan-parser.ts, apps/configurator/public/favicon.ico, apps/configurator/public/icon.svg, apps/configurator/src/app/favicon.ico, apps/configurator/src/app/icon.svg, tests/v42-source-geometry-persistence.test.ts
  - Güncellenen: packages/core/src/index.ts, packages/core/src/types.ts, packages/core/src/schemas.ts, packages/core/src/defaults.ts, packages/core/src/rules.ts, packages/core/src/v4-profiles.ts, packages/core/src/v4-compatibility.ts, packages/catalog/src/v4-library-admin.ts, packages/geometry/src/types.ts, packages/geometry/src/mesh-generator.ts, packages/geometry/src/handle-geometry.ts, packages/geometry/src/projection2d.ts, packages/manufacturing/src/bom-generator.ts, apps/configurator/src/app/layout.tsx, apps/configurator/src/store/useConfiguratorStore.ts, apps/configurator/src/v3/adapter/useV3Adapter.ts, apps/configurator/src/v3/components/V3CadViewport2D.tsx, apps/configurator/src/v3/components/V3IsometricModuleIcon.tsx, apps/configurator/src/v3/components/V3UnifiedWorkspace.tsx, apps/configurator/src/v3/materials/pbrMaterialSystem.ts, apps/configurator/src/workers/manufacturing-worker-client.ts, tests/worker-race-condition.test.ts, docs/V42_PLUS_EXECUTION_ROADMAP.md, docs/NEXT_AGENT_HANDOFF.md
Çalıştırılan komutlar ve gerçek sonuçları:
  - npm run lint (tsc --noEmit) -> 0 hata (PASS)
  - npm test (vitest run) -> 18 test dosyası, 108/108 test geçti (PASS)
  - BIRIM_AUDIT_BUILD=1 npm run build -> .next-v41 derlemesi başarılı (PASS)
  - npm run test:e2e:v41 -> 27/27 Chromium E2E testi geçti (PASS, port 3311)
Kanıt dosyaları / görüntü incelemesi:
  - Yeni regresyon paketi: tests/v42-source-geometry-persistence.test.ts (20 test) ve güncellenen tests/worker-race-condition.test.ts (2 test)
  - Tarihli V4.1 kanıtları (docs/V41_*.md ve docs/v41-evidence/*) değiştirilmeden korundu.
Çalıştırılmayan kontroller:
  - Fiziksel CNC makine (Biesse/Selco) kesim/delik doğrulaması (donanım ve fabrika erişimi kapsam dışı).
Kalan hata ve tam tekrar üretme adımı:
  - requiresFactoryValidation=true olan şablonlar ve donanım kaynakları fiziksel fabrika numune onayı (physicalFactorySample) olmadığı için UNVERIFIED statüsünde kalmaktadır.
Beklenen harici teknik kanıt:
  - Üretici (Blum/Hettich/Häfele/Hawa/Kesseböhmer) montaj CAD şablonları ve Birim fabrika fiziksel numune onayı (physicalFactorySample).
Sonraki tek somut adım:
  - WP-11 / WP-01 kapsamında üretici teknik föyleri ve fabrika fiziksel numuneleri onaylandıkça ilgili kaynakların verificationScope bayraklarını kanıtlarıyla güncellemek.
Commitlenmemiş çalışmalar / çalışan sunucular:
  - Tüm V4.1 ve V4.2 değişiklikleri çalışma ağacındadır (henüz commitlenmedi). Port 3300 üzerinde mevcut dev sunucusu (PID 17344) dokunulmadan bırakıldı.
Kabul durumu ve üretim kapısı:
  - Yazılım sözleşmeleri ve regresyon testleri GEÇTİ; Üretim kapısı FAIL-CLOSED (UNVERIFIED) olarak korunmaktadır.
```

Sonraki ajan bu özeti kaynak kodun yerine kullanmamalı; özetin amacı kaybolan bağlamı bulmayı hızlandırmaktır.

