# Birim Configurator — Güncel Proje Durumu (L2 Cache)

- **Last Verified Commit:** `9169ec4` (`main` dalı) — `[VERIFIED]`
- **Son Güncelleme Tarihi:** `2026-11-08` (Europe/Istanbul)
- **Çalışma Ağacı Durumu:** L1/L2/L3 Kalıcı Proje Hafızası (`docs/ai-context/*`, `.agents/skills/memory-manager/SKILL.md`, `AGENTS.md`, `.gitignore`) eklendi.

## 1. Tamamlanan Son İşler (Delta Özeti)
- **[VERIFIED] V4.5 Etkileşimli Çoklu Seçim, Fiyat Matrisi, CAD Ölçülendirme (`9169ec4`):** `V3UnifiedWorkspace.tsx`, `V3CadViewport2D.tsx`, `useV3Adapter.ts` ve `pricing-engine.ts` üzerinde çoklu modül seçimi, fiyat kırılım matrisi ve 2D/3D CAD ölçülendirme iyileştirmeleri tamamlandı.
- **[VERIFIED] V4.4 2D CAD Snap & 3D Etkileşimli Viewport (`96756ca`):** 2D planda akıllı yakalama (snap), sürekli duvar çizimi ve 3D sahne içi etkileşimli düzenleme geliştirildi.
- **[VERIFIED] V4.3 Blum Mühendisliği, Katmanlı DXF ve Fabrika BOM (`1c1faf3`):** ISO 7170 Euler-Bernoulli raf sehim analizi (`calculateShelfDeflection`), tek tıkla otomatik düzeltme (`autoFixModuleIssues`), bitmiş ölçü vs. testere net kesim ölçüsü (`netCutLengthMm`), System 32 & menteşe delik çakışma koruması, kullanılabilir stok fire (`usableRemnants`) ve `$INSUNITS=4` katmanlı AutoCAD DXF ihracı (`generatePanelDXF`) eklendi.
- **[VERIFIED] V4.1/V4.2 Temel Geometri ve Kaynak Sözleşmesi (`27e3938` -> `1c1faf3`):** 92/92 modül şablonunda `calculateFourSpaceDimensions` ile `generateModuleGeometry` arasında `0` ölçü farkı sağlandı; `schemaVersion: 4`, atomik undo/redo ve gerçek tarayıcı Web Worker (`manufacturing-worker-client.ts`) devreye alındı.
- **[VERIFIED] Kalıcı L1/L2/L3 Hafıza Sistemi Kurulumu (2026-11-08):** `AGENTS.md` (L1), `current-state.md` ve `module-map.md` (L2), `architecture.md`, `decisions.md`, `integrations.md`, `setup.md`, `history/` (L3) ve `.agents/skills/memory-manager/SKILL.md` oluşturuldu.

## 2. Doğrulama ve Test Durumu (2026-11-08 Gerçek Ölçüm)
- **Vitest Birim/Regresyon (`npx vitest run tests/v43-customer-factory-integration.test.ts`):** `5/5 test PASS` (`24ms` test süresi) — `[VERIFIED]`
- **TypeScript (`npm run lint` / `tsc --noEmit`):** `[CONFLICT]` / `[STALE]` — `docs/NEXT_AGENT_HANDOFF.md` (`27e3938`) içinde `0 hata` raporlanmışsa da `1c1faf3..9169ec4` (V4.3–V4.5) commitlerinde eklenen alanlar nedeniyle `tsc --noEmit` üzerinde mevcut tip uyumsuzlukları (`useV3Adapter.ts`, `useConfiguratorStore.ts`, `bom-generator.ts`) tespit edildi. Uygulama koduna dokunmama kuralı gereği olduğu gibi kayıt altına alındı.
- **Üretim Kapısı Durumu:** `productionGate.isReadyForErp = false` ve `v4CompatibilityReport.canApproveProduction = false` (`UNVERIFIED` / Fail-Closed korunuyor) — `[VERIFIED]`

## 3. Açık Kalan Görevler ve Sınırlar
1. **[UNVERIFIED] Fiziksel Fabrika ve CNC Doğrulaması (`WP-01` / `WP-11`):** Biesse Selco WNT 600 ebatlama ve CNC delik makinesinde fiziksel deneme kesimi (`physicalFactorySample`) yapılana kadar üretim onayı kapalı tutulmalıdır.
2. **[UNVERIFIED] Özel Köşe/Eğimli ve Tambur Şablon Kalibrasyonu (`WP-04` / `WP-05`):** `requiresFactoryValidation: true` olan şablonlar için üretici CAD eğrisi ve fabrika teknik ofis onayı beklenmektedir.
3. **[UNVERIFIED] Kulp Delik / Cep Freze CAD Şablonları (`WP-03`):** Gömme/J-pull/bar kulplar için üretici onaylı delik koordinatları gelene kadar CNC kulp delikleri bilerek üretilmemektedir.
4. **[UNVERIFIED] Görsel Regresyon Baseline Ayrımı (`WP-10` / `WP-13`):** Kalibre edilmiş fiziksel PBR stüdyo numuneleri ile tarayıcı ekran görüntülerinin onaylı baseline ayrımı tamamlanacaktır.

> **Not:** Eski faz detayları `docs/ai-context/history/2026-11-v41-v45-archive.md` dosyasında arşivlenmiştir.
