# AGENTS.md — Modül Multi-Tenant 3D CAD-to-CAM SaaS Platformu (V12.0)

Bu dosya, **Modül / Birim Configurator** monorepo projesi üzerinde çalışan tüm geliştiriciler ve yapay zekâ kodlama ajanları için tekil mimari doğruluk kaynağıdır (SSOT).

## 1. Temel Mimari İlke (Altın Kural)
- **Modül**, firma bağımsız, çok kiracılı (multi-tenant) bir 3B/2B mobilya tasarım, mühendislik doğrulama, fiyatlandırma ve CNC/CAM üretime hazırlık platformudur.
- **Birim Mobilya Sanayi ve Ticaret A.Ş.** (`tenantId: "00000000-0000-0000-0000-000000000001"`, `slug: "birim"`), bu platformun **ilk kurumsal müşterisidir (`Tenant #1`)**.
- Ortak çekirdek paketlere (`packages/core`, `packages/geometry`, `packages/manufacturing`, `packages/pricing`) tek bir müşteriye özgü sabit ERP adresi veya yerel dosya yolu gömülmez. Tüm firma farklılıkları `TenantWorkspaceProfile` üzerinden enjekte edilir.
- **Tekil Tasarım Modeli (Single Parametric Source of Truth)**: 3B görünüm (`V3ThreeViewport`), 2B cephe/kesit/plan (`V3CadViewport2D`), müşteri sunum ekranı (`ShowroomPresentationOverlay`), kesim/delik listesi (`generateProjectBOM`), CNC çıktıları (`.DXF`, `.MPR`, `.CIX`, `.XCS`, `.BXF`) ve fiyatlandırma (`calculateProjectPricing`) aynı `DesignProject` (`schemaVersion: 4`) verisinden türetilir (`0.00 mm` sapma).

## 2. Aktif Çalışma Alanı ve Paket Sınırları
1. **`packages/core` (`@birim/core` / `@modul/core`)**: `DesignProject` şemaları, 4-uzay matematiği, CEN EN 14749 / ISO 7170 mühendislik kuralları, `computeModuleIntrinsicSignature` / `BoundedLruCache` önbellek katmanı, özel modül şablonu depolama ve SaaS kiracı sözleşmeleri.
2. **`packages/geometry` (`@birim/geometry`)**: Deterministik 3B parça geometrisi (`mesh-generator.ts`), 2B cephe/kesit/plan projeksiyonu (`projection2d.ts`) ve `.GLB/.OBJ/.USDA` dışa aktarıcılar.
3. **`packages/catalog` (`@birim/catalog`)**: Evrensel modül arketipleri, hazır V4/V5 modül şablonları, Blum / Hettich / Häfele donanım SKU tanımları.
4. **`packages/manufacturing` (`@birim/manufacturing`)**: Net kesim BOM üreteci, 90° suyolu (`crosswise`) delik/kenar bandı transpozisyonu ve CNC sınır bekçisi, Sistem 32 + Minifix / Rafix / Cabineo delik motoru, Homag `.MPR` / Biesse `.CIX` (4 kenar 8 mm arkalık kanalı dahil) / SCM `.XCS` / Blum `.BXF` ve Birim Portal ERP giyotin/MaxRects nesting köprüsü.
5. **`packages/pricing` (`@birim/pricing`)**: Hazır UV/PET lak levha ile boyahane ipek mat lake ayrımını (`requiresPaintshop`, `requiresEdgeBanding`) ve ticari cihazları (`sceneObjects`) dikkate alan deterministik EUR/TRY + KDV fiyat motoru.
6. **`packages/integrations` (`@birim/integrations`)**: `SupabaseStoreRpcAdapter`, `SupabaseErpNestingRpcAdapter` (atomik SQL migrasyonu `20261118160000_fix_store_erp_rpc_contracts.sql` ile uyumlu), webhook ve R2 depolama adaptörleri.
7. **`apps/configurator`**: Next.js 15 App Router çalışma alanı. Aktif kabuk `src/v11/BirimStudioWorkspace.tsx` olup `StudioHeaderBar`, `OnObjectQuickToolbar` (3B nesne üstü bağlamsal düzenleme), `GuidedSetupModal` (ölçüye uygun 4 hazır akıllı şablon), `LeftCatalogLauncher`, `RightParametricInspector` (`Kolay / Pro / Üretim` 3 kademeli mod) ve `BottomSceneDock` bileşenlerinden oluşur.

## 3. Güvenlik, Kiracı İzolasyonu ve Üretim Kapısı Kuralları
- `tenant-auth-guard.ts` içinde `middleware.ts` tarafından eklenen pasif `x-modul-resolved-tenant-slug` başlığı yalnızca varsayılan ipucu olarak okunur; doğrulanmış oturum bağlamı varken istemci gövdesindeki farklı `organizationId`/`tenantId` istekleri `403 TENANT_SPOOFING_BLOCKED` ile reddedilir. Production ortamında `BIRIM_SESSION_HMAC_SECRET` eksikse `503 SERVER_SECRET_MISSING` ile fail-closed çalışır.
- `UNVERIFIED` veya `INCOMPATIBLE` durumundaki tasarımlar üretim kapısından (`productionGate.isReadyForErp`) sessizce geçirilemez.
