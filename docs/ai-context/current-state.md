# Birim Configurator — Güncel Proje Durumu (L2 Cache)

- **Last Verified Commit:** `fdd818f` (`main` dalı) — `[VERIFIED]`
- **Son Güncelleme Tarihi:** `2026-11-13` (Europe/Istanbul)
- **Çalışma Ağacı Durumu:** AI Context V2.1 (Context Capsule, Evidence Index, Handoff, Serena Level A/B, Measurement) aktif.

## 1. Tamamlanan Son İşler (Delta Özeti)
- **[VERIFIED] 2D Cephe (Elevation) UX/UI Yeniden Düzenleme ve 3-Seviyeli Görünüm Sistemi (2026-11-14):**
  - `apps/configurator/src/v3/components/workspace/elevation2dHelpers.ts`: 3 seviyeli detay sistemi (`clean` Sade, `selected` Seçili Öğe Varsayılan, `technical` Teknik), kanonik `mm` verisini bozmayan `mm`/`cm` birim dönüştürücüleri (`formatElevationValue`, `toCanonicalMm`), dar bölme etiket kısaltıcı (`truncateCadLabel`) ve seçili öğe bağlamsal çözücüsü (`resolveSelectedElevationContext`) eklendi.
  - `apps/configurator/src/v3/components/workspace/Elevation2DChrome.tsx`: Gruplanmış üst kontrol çubuğu (`ElevationTopBar`), seçili iç parça/donanım için sürüklemeyi engellemeyen sağ üst bağlamsal düzenleme paneli (`ElevationContextualPanel`) ve tekrarları temizleyen birleşik alt durum/ölçü çubuğu (`ElevationBottomBar`) oluşturuldu.
  - `apps/configurator/src/v3/components/workspace/NeighborElevationModule.tsx`: Komşu modüller `React.memo` + `useMemo` ile izole edilerek aktif modüldeki sürükleme/seçim sırasında N+1 geometri hesabı ve SVG yeniden uzlaştırması kesildi.
  - `apps/configurator/src/v3/components/V3CadViewport2D.tsx`: `useV3Adapter({ lightweightViewport: true })`, aktif modül `breakdown`/`data` `useMemo`, `hoveredElevElId` yerine 0-render CSS `group-hover/el`, sürükleme başında önbelleğe alınan `interiorSnapTargetsRef` + `mmPerPx`, küçültülen arka plan ızgara katmanı (`vb.width + 8000`) ve Studio alt dock'uyla çakışmayan tek satır `shrink-0` alt bilgi şeridi uygulandı.
  - `tests/v4-elevation-2d-ux.test.ts`: 3 seviyeli görünüm, birim dönüşümü, etiket kısaltma ve bağlamsal parça çözümleme birim testleri eklendi (`4/4 PASS`).
- **[VERIFIED] Modül Kütüphanesi UX/UI Yeniden Tasarımı (2026-11-14):**
  - `apps/configurator/src/v3/components/workspace/moduleLibraryUtils.ts`: Gerçek `V4_MODULE_FAMILIES` / `V4_MODULE_TEMPLATES` ve `V4_HARDWARE_CATALOG` verilerinden kategori/alt kategori ağacı (`buildCategoryTreeGroups`), birleşik filtreleme (`filterCatalogTemplates`), `dimensionLimits` & `isFixedWidth` doğrulamalı parametrik ölçü kırpma (`clampTemplateDimensions`, `applyValidatedDimensionsToModule`) ve `localStorage` favori/son kullanılan yardımcıları eklendi.
  - `apps/configurator/src/v3/components/workspace/ModuleLibraryPanel.tsx`: Kompakt 2/3 sütunlu uyarlanabilir görsel kart ızgarası (`ResizeObserver`), kompakt teknik liste (`☰ Liste`), kategori odaklı keşif (`◫ Kategori`), sabit arama/filtre çubuğu, son kullanılanlar şeridi, çift tıklama koruması, geri bildirim bildirimi ve kütüphaneyi kapatmadan açılan parametrik Modül Detay & 3D İzometrik / 2D Cephe Önizleme paneli uygulandı.
  - `apps/configurator/src/v3/adapter/useV3Adapter.ts` & `V3UnifiedWorkspace.tsx`: `applyV4Template` ve `dropV4TemplateWithSnap` isteğe bağlı doğrulanmış `customDimensions` desteği ile güncellendi; aktif `V3UnifiedWorkspace` sol Modül Kütüphanesi yeni `ModuleLibraryPanel` bileşenine bağlandı.
  - `tests/v4-module-library-ux.test.ts`: Kategori ağacı, filtre tutarlılığı, parametrik ölçü sınırlandırma ve donanım eşleştirme birim testleri eklendi (`5/5 PASS`).
- **[VERIFIED] Offline Blender 4.2 Cycles + OpenImageDenoise (OIDN) Stüdyo Render Motoru Entegrasyonu (2026-11-13):**
  - `apps/configurator/scripts/blender_studio_render.py`: Three.js sahnesinden aktarılan `.glb` dosyasını mm→m ölçekleyerek içe aktaran, 3-noktalı mimari softbox ışık düzeneği, mat stüdyo zemin, AgX renk yönetimi ve otomatik GPU (OptiX/CUDA/HIP → CPU fallback) + `OPENIMAGEDENOISE` ile Cycles render üreten headless Python betiği eklendi.
  - `apps/configurator/src/app/api/render/blender/route.ts`: Yerel `blender.exe` keşfi (`GET`) ve geçici `.glb` + kamera/çözünürlük meta verisiyle headless Blender Cycles çalıştırıp PNG döndüren (`POST`) Node.js API rotası eklendi.
  - `apps/configurator/src/v3/engine/blenderRenderClient.ts`, `V3ThreeViewport.tsx`, `StudioRenderModal.tsx`: `GLTFExporter` ile görünür 3D sahneyi `.glb` olarak dışa aktaran istemci bağlandı; `renderPathTracedPhoto` sahte döngüsü gerçek Blender Cycles motoruna geçirildi ve `StudioRenderModal` üzerine Blender durum rozeti ile hata/ilerleme bildirimleri eklendi.
- **[VERIFIED] 3D Sahne Genel & Açık Kapak / İç Elbise (GLB) Performans İyileştirmesi + Sürükleme Seçim Çerçevesi ve Askı Hizası (2026-11-13):**
  - `apps/configurator/src/v3/materials/wardrobeGlbAssetLoader.ts`: Yüksek poligonlu `.glb` iç aksesuarlar (`folded_cloth.glb` 115.2k, `silk_pouf.glb` 81.2k, `shoe.glb` 22.7k üçgen) için yükleme anında tek seferlik UV-korumalı O(V+T) vertex-clustering mesh sadeleştirici (`decimateHighPolyBufferGeometry`, `rawTris > 20500`) ve mikro alt-mesh (`<55` üçgen) ayıklama eklendi; raf aksesuarlarında 81k üçgenli `silk_pouf.glb` yerine 24 üçgenli paylaşımlı keten kutu kullanıldı; `jacket.glb` modelindeki yana açık A-pose kollar omuz ekleminden aşağı sarkıtılarak (`drapeOutstretchedGarmentSleeves`) gövde boy/en küçülmesi (`447mm -> 825mm`) ve dik yaka yüksekliği (`collarRiseMm`) kaynaklı omuzun askı altında kalması düzeltildi.
  - `apps/configurator/src/v3/adapter/useV3Adapter.ts` & `V3ThreeViewport.tsx`: 9 farklı noktadaki senkron `generateBOMForProject(nextProj)` plaka nesting çağrısı kaldırılarak `commitAdapterState` + 180ms Web Worker hattına geçirildi; `V3ThreeViewport.tsx` pozisyon/cache fast-path'inde geçici `createModuleGroup(m)` tahsisi yerine doğrudan `calculateModulePlacement(m)` kullanıldı.
  - `apps/configurator/src/v3/components/Viewport3DContextMenu.tsx` & `V3ThreeViewport.tsx` & `BirimTooltip.tsx`: Üst hızlı çubuk (`viewport-3d-top-quick-bar`) kaldırılıp `Modülü 90° Çevir` ve `Kapakları Gizle` düğmeleri alt çubuğa taşındı; alt çubuktaki hover genişleme kayması (`birim-expand-group`) kapatıldı; `BirimTooltip.tsx` SVG (`Element`) ve 4px boşluk geçiş toleransı düzeltildi; 3D sahneye sağ tıkla açılan bağlama duyarlı menü (`Viewport3DContextMenu` — kapak, raf, çekmece, askı, bölme içi, modül, mimari engel ve boş sahne işlemleri) eklendi.
  - `apps/configurator/src/v3/components/V3ThreeViewport.tsx`: Modül sürükleme (`module_3d`) esnasında seçili parça ve aktif modül çerçevelerinin (`selectionFrameGroupRef`, `activeModFrameGroupRef`) 0ms GPU ile senkron taşınması sağlandı; kapak açıldığında dinamik `PointLight` eklenip tüm PBR shader'ların yeniden derlenmesi engellendi; `Space` tuşunda 20 karelik rAF tam CAD sahne yeniden üretimi atomik tek güncellemeye çevrildi; `traverseCabinetObjectsOnly` ve `computeFastParametricSceneBounds` ile raycast/kamera sığdırma prop alt-ağaçlarından izole edildi; `storeBom` aboneliği yalnızca X-Ray moduna bağlandı.
  - `apps/configurator/src/v3/adapter/useV3Adapter.ts` & `apps/configurator/src/v3/components/V3UnifiedWorkspace.tsx`: `useV3Adapter({ lightweightViewport: true })` ile 3D viewport'un arka plan nesting/BOM/fiyat/validasyon yeniden hesaplarından etkilenmesi kesildi; `viewportSafeInsets`, `cad2DSafeInsets` ve `handleToggle3DDimensions` referansları stabilize edilerek `React.memo` korundu.
- **[VERIFIED] 3D/2D Viewport Geçişlerinde React startTransition INP Optimizasyonu (2026-11-10):**
  - Üst bar `studio-view-switcher` (3D Sahne, 2D Cephe, 2D Kesit, 2D Plan) ve `onViewChange` event handler'ı React 18/19 `startTransition` kapsamına alındı.
  - Viewport geçişleri non-blocking moda geçirilerek ~385ms'lik senkron render UI kilitlenmesi (INP issue) giderildi.
- **[VERIFIED] 3D/2D Seçili Çekmece Kartına Yükseklik (H) ve Kot (Y) Kontrolü (2026-11-10):**
  - 3D/2D sahnede çekmece önü/gövdesi tıklandığında sağ altta açılan seçili parça kartına (`studio-selected-component-card`), ilgili çekmecenin `matchedDrawer` tespiti üzerinden:
    - Hazır yükseklik presetleri (`140mm`, `180mm`, `240mm`, `300mm`),
    - Sayısal Yükseklik (`H`, 100-420mm) ve Yerden Kot (`Y`, 0 - netInnerHeight) giriş alanları eklendi.
  - Değişiklik doğrudan `setDrawerPlacement` çağrısını tetikleyerek anında geometri ve BOM'u senkronize eder.
- **[VERIFIED] AutoCAD DXF AC1015 Desteği ve Delik/Parça Koordinat Hizalaması (2026-11-10):**
  - DXF üreticisi (`packages/manufacturing/src/technical-outputs.ts`) AutoCAD 2000-2026 standardı olan `AC1015` formatına geçirildi.
  - Eksik olan `*Active` VPORT ve `ACAD_LAYOUT` Model tablosu eklenerek AutoCAD'in açılışta donma/takılma sorunu giderildi.
  - Parça dikdörtgen çiziminde X/Y ekseni (`widthMm` en ve `lengthMm` boy) ile delik koordinat motorunun (`drilling-engine.ts`) koordinat sistemi hizalandı. Boy dolabı yan panelleri ve kapaklardaki deliklerin (menteşe çanakları, minifiksler, raf delikleri) parça dışına taşarak havada kalması ve komşu parçaları delmesi önlendi.
- **[VERIFIED] Kiler/Boy Dolap Dönüşümü, 2D Kot İndirme ve 3D Ctrl İkon İyileştirmesi (2026-11-10):**
  - Üst dolaptan kiler/boy dolabına geçişte şablon ID eşleşmesi (`tpl_kt_01_pantry_shelved`, `tpl_kt_03_pantry_internal_drawers`) düzeltildi; `getV4TemplateById` içine alias eklendi.
  - Şablon değiştirildiğinde kot (`position.y`) boy dolabı için otomatik olarak zemine (`0`) çekildi.
  - 2D cephe görünüşünde seçili modülü yukarı/aşağı taşıma (kot Y desteği), gövdeden doğrudan sürükleme, araç çubuğuna Kot(Y) / "⬇ Zemine İndir" butonları eklendi.
  - 2D cephe viewBox üst sınırı dinamik yapılarak yüksek veya havada kalan dolapların tavan üstü kırpılması (`computedElevVb`) önlendi.
  - 3D sahnede `Ctrl` / `Cmd` basıldığında fare imlecinin `move` (dört yönlü taşıma) ve sürükleme esnasında `grabbing` ikonuna dönüşmesi sağlandı.
- **[VERIFIED] AI Context V2.1 Yükseltmesi (2026-11-08):** `context-capsule.md`, `evidence-index.md`, `handoff.md`, `measurement.md` eklendi; `AGENTS.md` (39 satır) ve `SKILL.md` V2.1 protokolleriyle güncellendi; Serena ve Basic Memory MCP bağlantıları doğrulandı.
- **[VERIFIED] Kalıcı L1/L2/L3 Hafıza Temeli (`09ff016`):** `AGENTS.md` (L1), `current-state.md` ve `module-map.md` (L2), `architecture.md`, `decisions.md`, `integrations.md`, `setup.md`, `history/` (L3) yerel olarak yapılandırıldı.
- **[VERIFIED] V4.5 Çoklu Seçim, Fiyat Matrisi, CAD Ölçülendirme (`9169ec4`):** Çoklu modül seçimi, fiyat kırılım matrisi ve 2D/3D CAD ölçülendirme iyileştirmeleri tamamlandı.
- **[VERIFIED] V4.4 2D CAD Snap & 3D Etkileşimli Viewport (`96756ca`):** 2D planda akıllı snap, sürekli polyline duvar çizimi ve 3D sahne içi etkileşim geliştirildi.
- **[VERIFIED] V4.3 Blum Mühendisliği, Katmanlı DXF ve Fabrika BOM (`1c1faf3`):** ISO 7170 Euler raf sehim analizi, `autoFixModuleIssues`, net kesim ölçüsü, delik çakışma koruması, stok fire ve katmanlı DXF ihracı eklendi.

## 2. Doğrulama ve Test Durumu (2026-11-08 Gerçek Ölçüm)
- **Vitest Birim/Regresyon (`npx vitest run tests/v43-customer-factory-integration.test.ts`):** `5/5 test PASS` (`24ms` test süresi) — `[VERIFIED]`
- **TypeScript (`npm run lint` / `tsc --noEmit`):** `[CONFLICT]` / `[STALE]` — `docs/NEXT_AGENT_HANDOFF.md` (`27e3938`) içinde `0 hata` kayıtlıydı; `1c1faf3..9169ec4` commitlerindeki yeni alanlar nedeniyle `tsc --noEmit` üzerinde tip uyumsuzlukları (`useV3Adapter.ts`, `useConfiguratorStore.ts`, `bom-generator.ts`) tespit edildi.
- **Üretim Kapısı Durumu:** `productionGate.isReadyForErp = false` ve `v4CompatibilityReport.canApproveProduction = false` (`UNVERIFIED` / Fail-Closed korunuyor) — `[VERIFIED]`

## 3. Açık Kalan Görevler ve Sınırlar
1. **[UNVERIFIED] Fiziksel Fabrika ve CNC Doğrulaması (`WP-01` / `WP-11`):** Biesse Selco WNT 600 ve CNC makinesinde fiziksel deneme kesimi (`physicalFactorySample`) yapılana kadar üretim onayı kapalı tutulmalıdır.
2. **[UNVERIFIED] Özel Köşe/Eğimli ve Tambur Şablon Kalibrasyonu (`WP-04` / `WP-05`):** `requiresFactoryValidation: true` şablonları için üretici CAD eğrisi ve fabrika teknik onayı beklenmektedir.
3. **[UNVERIFIED] Kulp Delik / Cep Freze CAD Şablonları (`WP-03`):** Üretici onaylı delik koordinatları gelene kadar CNC kulp delikleri bilerek üretilmemektedir.
4. **[UNVERIFIED] Görsel Regresyon Baseline Ayrımı (`WP-10` / `WP-13`):** Kalibre edilmiş fiziksel PBR stüdyo numuneleri ile tarayıcı ekran görüntülerinin onaylı baseline ayrımı tamamlanacaktır.

> **Not:** Eski faz detayları `docs/ai-context/history/2026-11-v41-v45-archive.md` dosyasında arşivlenmiştir.
