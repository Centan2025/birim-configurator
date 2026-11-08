# Birim Configurator — Modül ve Sembol Haritası (L2 Cache)

Bu belge, ajanların kaynak kod dosyalarını baştan sona okumadan önce hedef paketi, dosyayı ve anahtar sembolü hızla bulması için hazırlanmıştır. Tüm yollar depo köküne göre görelidir.

## 1. Monorepo Paketleri (`packages/*`)

### 1.1 `@birim/core` — Parametrik Çekirdek, Şema, 4-Mekân ve Uyumluluk
- **Giriş Noktası:** `packages/core/src/index.ts`
- **Anahtar Dosyalar ve Semboller:**
  - `packages/core/src/types.ts`: `DesignProject`, `FurnitureModuleConfig`, `BayConfig`, `DrawerConfig`, `DoorConfig`, `WallSegment`, `SpaceObstacle`, `CompatibilityStatus` — `[VERIFIED]`
  - `packages/core/src/schemas.ts`: `DesignProjectSchema` (`schemaVersion: 4`), `validateDesignProject`, `migrateProjectSchema` — `[VERIFIED]`
  - `packages/core/src/v4-profiles.ts`: `calculateFourSpaceDimensions` (4-Mekân tek doğruluk kaynağı: `externalCarcass`, `netPanelCut`, `usableInternal`, `doorLeaves`) — `[VERIFIED]`
  - `packages/core/src/rules.ts`: `calculateBayWidths`, `calculateModulePlacement`, `calculateShelfDeflection` (ISO 7170 Euler-Bernoulli sehim), `autoFixModuleIssues`, `validateModuleEngineering` — `[VERIFIED]`
  - `packages/core/src/v4-compatibility.ts`: `evaluateProjectCompatibility` (15 uyumluluk kuralı `CHK_01`..`CHK_15`, `canApproveProduction` fail-closed kapısı) — `[VERIFIED]`
  - `packages/core/src/v4-source-registry.ts`: `V4_SOURCE_REGISTRY` (16 teknik kaynak, `documentExplicitClaims`, `applicationInferences`, `verificationScope`) — `[VERIFIED]`
  - `packages/core/src/floorplan-parser.ts`: `parseFloorplanFile`, `convertUnderlayPolylinesToWalls` (ASCII DXF/DWG ve PDF kat planı ayrıştırıcı) — `[VERIFIED]`
  - `packages/core/src/defaults.ts`: `createInitialProject`, varsayılan malzeme, donanım ve modül sabitleri — `[VERIFIED]`

### 1.2 `@birim/catalog` — 92 Şablon, Donanım Kataloğu ve Kütüphane Yönetimi
- **Giriş Noktası:** `packages/catalog/src/index.ts`
- **Anahtar Dosyalar ve Semboller:**
  - `packages/catalog/src/v4-module-taxonomy.ts`: `V4_MODULE_TEMPLATES` (6 ailede 92 parametrik şablon), `instantiateV4Template` — `[VERIFIED]`
  - `packages/catalog/src/v4-hardware-catalog.ts`: `V4_HARDWARE_CATALOG` (Blum, Hettich, Häfele, Hawa, Kesseböhmer SKU ve güç faktörü kuralları) — `[VERIFIED]`
  - `packages/catalog/src/v4-library-admin.ts`: `V4LibraryAdminStore` (`createDraftTemplateEntry`, `rollbackToRelease`, `invalidateEntriesForSourceRevision`) — `[VERIFIED]`
  - `packages/catalog/src/kitchen-layouts.ts`: I, L, U, Galley ve Ada mutfak hazır yerleşim şablonları — `[VERIFIED]`
  - `packages/catalog/src/smart-advisor.ts` & `v4-smart-builder.ts`: Akıllı modül önerici ve sihirbaz fonksiyonları — `[VERIFIED]`

### 1.3 `@birim/geometry` — 3D Mesh, 10 Kulp, 12 Kapak Kinematik ve 2D Projeksiyon
- **Giriş Noktası:** `packages/geometry/src/index.ts`
- **Anahtar Dosyalar ve Semboller:**
  - `packages/geometry/src/mesh-generator.ts`: `generateModuleGeometry` (bounded cache destekli 3D parça ve kinematik üretici), `clearModuleGeometryCache` — `[VERIFIED]`
  - `packages/geometry/src/handle-geometry.ts`: `generateHandleComponents` (10 kulp kategorisi, sağ/sol açılma kenarı ve ergonomik kot hesabı) — `[VERIFIED]`
  - `packages/geometry/src/component-transform.ts`: `resolveComponentTransform` (V2 ve V3 ortak kapak/kulp pivot ve rotasyon matrisi) — `[VERIFIED]`
  - `packages/geometry/src/projection2d.ts`: `generate2DProjection` (Cephe, Kesit ve Plan 2D SVG projeksiyonu ve ölçü çizgileri) — `[VERIFIED]`
  - `packages/geometry/src/types.ts`: `ComponentGeometry`, `ModuleGeometryResult`, `ThicknessAxis` — `[VERIFIED]`

### 1.4 `@birim/manufacturing` — BOM, Bant Düşümü, System 32 Delik, Nesting, DXF & Selco
- **Giriş Noktası:** `packages/manufacturing/src/index.ts`
- **Anahtar Dosyalar ve Semboller:**
  - `packages/manufacturing/src/bom-generator.ts`: `generateManufacturingBOM` (bitmiş ölçü vs. `netCutLengthMm`/`netCutWidthMm`, `productionGate`, raf sehim raporu) — `[VERIFIED]`
  - `packages/manufacturing/src/drilling-engine.ts`: `generateModuleDrilling` (System 32 raf pimi, 35mm menteşe tası, minifix ve delik çakışma koruması) — `[VERIFIED]`
  - `packages/manufacturing/src/sheet-nesting.ts`: `optimizeSheetNesting` (2D giyotin kesim, `4.4mm` kerf, `15mm` trim, `usableRemnants` stok fire) — `[VERIFIED]`
  - `packages/manufacturing/src/technical-outputs.ts`: `generatePanelDXF` (`$INSUNITS=4` katmanlı AutoCAD DXF), `exportAllPanelsDXF`, `generateTechnicalCutListCSV` — `[VERIFIED]`
  - `packages/manufacturing/src/selco-adapter.ts`: `generateSelcoXml` (Biesse Selco WNT 600 ebatlama XML postprocessor — taslak statüsü) — `[VERIFIED]`

### 1.5 `@birim/pricing` & `@birim/integrations` — Ticari Fiyat ve Store/ERP Sözleşmeleri
- `packages/pricing/src/pricing-engine.ts`: `calculateProjectPricing` (Malzeme m², kenar bandı, donanım SKU, işçilik, EUR/TRY ve KDV kırılımı) — `[VERIFIED]`
- `packages/integrations/src/store-adapter.ts`: `MockStoreAdapter` (`createOrUpdateQuoteItem` — CPQ teklif snapshot) — `[VERIFIED]`
- `packages/integrations/src/erp-adapter.ts`: `MockERPAdapter` (`publishProductionBlueprint` — `UNVERIFIED`/`INCOMPATIBLE` durumunda fail-closed engel) — `[VERIFIED]`

---

## 2. Next.js Uygulaması (`apps/configurator`)

| Göreli Dosya Yolu | Sorumluluk ve Anahtar Semboller |
| :--- | :--- |
| `apps/configurator/src/store/useConfiguratorStore.ts` | Ana Zustand state, `schemaVersion: 4` kalıcılık, `beginHistoryTransaction`/`commitHistoryTransaction` atomik undo/redo, çoklu modül seçimi (`selectedModuleIds`), revizyon snapshot (`createRevisionSnapshot`). |
| `apps/configurator/src/v3/adapter/useV3Adapter.ts` | V3/V4 UI ile Zustand store arasındaki senkronizasyon köprüsü (`commitAdapterState`), BOM/fiyat/geometri yeniden hesaplama tetikleyicisi, `autoFixActiveModule`. |
| `apps/configurator/src/v3/components/V3UnifiedWorkspace.tsx` | Ana V3/V4 çalışma alanı (Studio, Plan 2D+3D, Showroom, V4 Kütüphane Yöneticisi, sağ/sol denetçi panelleri). |
| `apps/configurator/src/v3/components/V3CadViewport2D.tsx` | 2D CAD görünümü: sürekli duvar çizimi (polyline chain), akıllı snap, DWG/DXF/PDF altlık, engel/duvar/modül seçip taşıma ve silme. |
| `apps/configurator/src/v3/components/V3ThreeViewport.tsx` | 3D Three.js sahnesi: modül seçimi, 3B ölçü çizgileri, kamera koruma, iç eleman sürükleme ve açılır kapak/çekmece animasyonu. |
| `apps/configurator/src/v3/components/V3IsometricModuleIcon.tsx` | 92 şablon ve modül kartları için parametrik 3B izometrik SVG ikon üreticisi. |
| `apps/configurator/src/v3/engine/elevationSnapEngine.ts` | Cephede raf/çekmece/askı borusu taşırken komşu bölme hizalarına mıknatıslı yakalama (snap) motoru. |
| `apps/configurator/src/v3/engine/kitchenSpatialEngine.ts` | Mutfak mekân kuralları, duvar/engel (pencere, kolon, tesisat) ve kapak açılım süpürme çakışma denetimi. |
| `apps/configurator/src/v3/materials/pbrMaterialSystem.ts` | `computePhysicalUvScale` (milimetre bazlı gerçek ölçekli UV tekrar ve lif yönü rotasyonu) ve Three.js PBR malzeme önbelleği. |
| `apps/configurator/src/workers/manufacturing-worker-client.ts` | Gerçek tarayıcı `Worker` (`Blob` URL) izolasyonu, `projectId + revisionId + sequenceId` zarfı ve eski hesaplamayı sonlandırma (`worker.terminate()`). |
| `apps/configurator/src/components/BomModal.tsx` | Fabrika BOM, kesim listesi, plaka optimizasyonu, sehim doğrulaması, DXF/CSV/Selco ihracı modalı. |

---

## 3. Hızlı Sembol Arama İpuçları (Serena / Grep)
- **Geometri & 4-Mekân:** `git grep -n "calculateFourSpaceDimensions" packages/`
- **BOM & Net Kesim:** `git grep -n "netCutLengthMm" packages/manufacturing/`
- **Uyumluluk & Üretim Kapısı:** `git grep -n "canApproveProduction" packages/`
- **State Aksiyonları:** `git grep -n "commitAdapterState" apps/configurator/src/`
