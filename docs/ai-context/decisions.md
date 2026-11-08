# Birim Configurator — Mimari Kararlar Kaydı (L3 Storage)

Bu dosya yalnızca ihtiyaç halinde veya `git grep "#etiket" docs/ai-context/decisions.md` ile sorgulanmak üzere tasarlanmıştır. Her karar `#etiket`, göreli dosya yolu, commit hash ve güvenilirlik etiketi (`[VERIFIED]`, `[UNVERIFIED]`, `[STALE]`, `[CONFLICT]`) taşır.

---

## DEC-001 — 4-Mekân Tek Doğruluk Kaynağı (`fourSpace.doorLeaves`)
- **Etiketler:** `#geometry` `#4space` `#doors` `#bom`
- **Durum:** `[VERIFIED]`
- **Commit:** `1c1faf3` / `9169ec4`
- **İlgili Dosyalar:** `packages/core/src/v4-profiles.ts`, `packages/geometry/src/mesh-generator.ts`, `packages/manufacturing/src/bom-generator.ts`
- **Karar:** 3D sahne, 2D teknik çizim ve BOM kesim listesi arasında ölçü farkı oluşmasını önlemek için tüm karkas, iç bölme ve kapak kanat ölçüleri (`doorLeaves`) `calculateFourSpaceDimensions(module)` fonksiyonundan okunur.
- **Kısıt:** Menteşeli/katlanır kapaklarda `totalDoorSpanW > 600mm` ise otomatik çift kanada bölünür; hiçbir menteşeli kanat `600mm` genişliği aşamaz.

## DEC-002 — Fail-Closed Üretim Kapısı (`UNVERIFIED` / `canApproveProduction = false`)
- **Etiketler:** `#manufacturing` `#security` `#erp` `#cnc` `#fail-closed`
- **Durum:** `[VERIFIED]` (Fiziksel fabrika onayı: `[UNVERIFIED]`)
- **Commit:** `27e3938` / `1c1faf3`
- **İlgili Dosyalar:** `packages/core/src/v4-compatibility.ts`, `packages/core/src/v4-source-registry.ts`, `packages/integrations/src/erp-adapter.ts`, `packages/manufacturing/src/selco-adapter.ts`
- **Karar:** Fiziksel Biesse Selco / CNC tezgâh numune onayı (`physicalFactorySample`) bulunmayan şablonlar ve donanım kaynakları `UNVERIFIED` statüsünde kalır. `MockERPAdapter.publishProductionBlueprint` fonksiyonu `UNVERIFIED` veya `INCOMPATIBLE` projeleri reddeder; `CHK_15_TAMPERED_PRODUCTION_APPROVAL` sahte üretim onayını yakalar.
- **Kesin Kural:** Testleri geçirmek için `UNVERIFIED` engelini, ERP kontrolünü veya Selco `draft` statüsünü kaldırmak kesinlikle yasaktır.

## DEC-003 — Bitmiş Ölçü vs. Testere Net Kesim Ölçüsü ve `isManufacturablePanel` Ayrımı
- **Etiketler:** `#manufacturing` `#bom` `#nesting` `#edge-banding`
- **Durum:** `[VERIFIED]`
- **Commit:** `1c1faf3`
- **İlgili Dosyalar:** `packages/manufacturing/src/bom-generator.ts`, `packages/manufacturing/src/sheet-nesting.ts`, `packages/geometry/src/types.ts`
- **Karar:**
  1. Her ahşap panel için bitmiş anma ölçüsü (`lengthMm`, `widthMm`) ile kenar bandı kalınlıkları düşülmüş testere net kesim ölçüsü (`netCutLengthMm`, `netCutWidthMm`) ayrı tutulur.
  2. Mekanizma kolları, raylar, cihaz görselleri ve özel donanımlar `isManufacturablePanel: false` olarak işaretlenir; ahşap `cutList` ve plaka optimizasyonuna (`optimizeSheetNesting`) sızmaz.

## DEC-004 — Kulp Deliklerinin CNC Çıktısında Üretilmemesi ve Ortak Pivot Transformu
- **Etiketler:** `#handles` `#cnc` `#drilling` `#geometry`
- **Durum:** `[VERIFIED]` (Kulp CNC şablonları: `[UNVERIFIED]`)
- **Commit:** `27e3938` / `96756ca`
- **İlgili Dosyalar:** `packages/geometry/src/handle-geometry.ts`, `packages/geometry/src/component-transform.ts`, `packages/manufacturing/src/drilling-engine.ts`
- **Karar:**
  1. 10 kulp kategorisi 3D sahnede kapak açılma kenarına (`45mm` içeride) ve ergonomik yüksekliğe yerleşir; `resolveComponentTransform` ile kapak açıldığında kapakla birlikte döner.
  2. Üretici onaylı montaj/cep freze CAD verisi olmadığı için CNC delik motorunda (`drilling-engine.ts`) kulp delikleri bilerek üretilmez. System 32 raf pimi delikleri ile menteşe taban plakası delikleri arasında $\Delta Y \ge 12\text{ mm}$ çakışma koruması uygulanır.

## DEC-005 — Şema Sürümü (`schemaVersion: 4`), Atomik Undo/Redo ve Geriye Uyumluluk
- **Etiketler:** `#persistence` `#schema` `#state` `#undo-redo`
- **Durum:** `[VERIFIED]`
- **Commit:** `1c1faf3` / `9169ec4`
- **İlgili Dosyalar:** `packages/core/src/schemas.ts`, `apps/configurator/src/store/useConfiguratorStore.ts`, `apps/configurator/src/v3/adapter/useV3Adapter.ts`
- **Karar:**
  1. Tasarım projeleri `schemaVersion: 4` zarfıyla doğrulanır; V2/V3 projeleri otomatik migrate edilir, ileri şema sürümleri (`>4`) veri bozulmasını önlemek için reddedilir.
  2. Sürükleme ve slider işlemlerinde `beginHistoryTransaction` / `commitHistoryTransaction` kullanılarak tek adımlı atomik `Ctrl+Z` / `Ctrl+Y` sağlanır.
  3. `commitAdapterState` her geometri değişiminde BOM, fiyat ve uyumluluk durumunu senkron günceller.

## DEC-006 — Gerçek Tarayıcı Web Worker İzolasyonu ve Bounded Geometri Önbelleği
- **Etiketler:** `#performance` `#worker` `#cache` `#geometry`
- **Durum:** `[VERIFIED]`
- **Commit:** `1c1faf3`
- **İlgili Dosyalar:** `apps/configurator/src/workers/manufacturing-worker-client.ts`, `packages/geometry/src/mesh-generator.ts`
- **Karar:**
  1. BOM ve nesting hesaplamaları tarayıcıda gerçek `Blob` URL Web Worker thread'inde (`projectId + revisionId + sequenceId` zarfıyla) çalışır; yeni istek geldiğinde eski worker `worker.terminate()` ile sonlandırılır (Node/Vitest ortamında senkron fallback çalışır).
  2. `generateModuleGeometry` içinde bellek sızıntısını önleyen bounded önbellek (`moduleGeometryCache`) kullanılır.

## DEC-007 — İzole E2E Kabul Derlemesi (`.next-v41` ve Port `3311`)
- **Etiketler:** `#testing` `#playwright` `#nextjs` `#build`
- **Durum:** `[VERIFIED]`
- **Commit:** `27e3938` / `9169ec4`
- **İlgili Dosyalar:** `apps/configurator/next.config.mjs`, `playwright.v41.config.ts`, `package.json`
- **Karar:** Port `3300` üzerinde çalışan geliştirme sunucusunun `.next` klasörünü bozmamak için tarayıcı E2E kabul testleri `BIRIM_AUDIT_BUILD=1` ortam değişkeniyle `.next-v41` dizinine derlenir ve Playwright tarafından port `3311` üzerinde çalıştırılır.

## DEC-008 — L1/L2/L3 Kalıcı Proje Hafızası ve Serena Sembol Erişim Disiplini
- **Etiketler:** `#memory` `#token-optimization` `#serena` `#workflow`
- **Durum:** `[VERIFIED]`
- **Commit:** `9169ec4` (Sonrası çalışma ağacı — `2026-11-08`)
- **İlgili Dosyalar:** `AGENTS.md`, `docs/ai-context/*`, `.agents/skills/memory-manager/SKILL.md`, `.gitignore`
- **Karar:** Ajanların her oturumda tüm kod tabanını yeniden taramasını önlemek için L1 (`AGENTS.md` <=60 satır), L2 (`current-state.md` <=50 satır aktif özet, `module-map.md`) ve L3 (`architecture.md`, `decisions.md`, `integrations.md`, `setup.md`, `history/`) katmanlı hafıza yapısı kuruldu. Kaynak dosyaları baştan sona okumadan önce `module-map.md`, Serena sembol araçları veya `git grep` ile satır aralığı tespiti zorunlu kılındı.

## DEC-009 — V4.3–V4.5 (`1c1faf3..9169ec4`) TypeScript Tip Kontrolü Durumu Kaydı
- **Etiketler:** `#typescript` `#lint` `#v45` `#stale-report`
- **Durum:** `[CONFLICT]` / `[STALE]` (Eski rapor `27e3938` vs. Güncel `HEAD` `9169ec4`)
- **Commit:** `9169ec4`
- **İlgili Dosyalar:** `apps/configurator/src/v3/adapter/useV3Adapter.ts`, `apps/configurator/src/store/useConfiguratorStore.ts`, `packages/manufacturing/src/bom-generator.ts`
- **Karar:** `docs/NEXT_AGENT_HANDOFF.md` (`27e3938`) içinde `npm run lint` (`tsc --noEmit`) `0 hata` olarak kayıtlıydı (`[STALE]`). Ancak `9169ec4` üzerinde yapılan gerçek doğrulamada Vitest testleri (`tests/v43-customer-factory-integration.test.ts` — 5/5 PASS) geçerken `tsc --noEmit` katı tip kontrolünde V4.3–V4.5 hızlı geliştirmelerinden kalan tip uyumsuzlukları (`[CONFLICT]`) tespit edildi. Sonraki kod geliştirme görevinde bu tip tanımları hizalanmalıdır.
