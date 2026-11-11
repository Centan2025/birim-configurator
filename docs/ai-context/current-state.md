# Birim Configurator — Güncel Proje Durumu (L2 Cache)

- **Last Verified Commit:** `795f451` (`main` dalı) — `[VERIFIED]`
- **Son Güncelleme Tarihi:** `2026-11-08` (Europe/Istanbul)
- **Çalışma Ağacı Durumu:** AI Context V2.1 (Context Capsule, Evidence Index, Handoff, Serena Level A/B, Measurement) aktif.

## 1. Tamamlanan Son İşler (Delta Özeti)
- **[VERIFIED] PresentationQuoteModal ve 2D/3D Etkileşim İyileştirmeleri (2026-11-11):**
  - Müşteri ve bayi için canlı teklif sunum modalı (`PresentationQuoteModal.tsx`) eklendi.
  - 2D CAD ve 3D Three.js viewport etkileşimleri, PBR materyal sistemi ve BOM üretici entegrasyonu güncellendi.
  - Regresyon ve ticari uzantı testleri doğrulandı (`10/10 PASS`).
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
