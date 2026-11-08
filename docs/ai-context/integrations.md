# Birim Configurator — Çoklu Proje, Veritabanı ve Dış Servis Entegrasyon Sözleşmeleri (L3 Storage)

> **Güvenilirlik Durumu:** Yazılım adaptör sözleşmeleri `[VERIFIED]` (`packages/integrations/src/*`). Canlı/Staging Supabase, `birim-store` ve `birim-portal` dış bağlantı entegrasyonları yerel geliştirme ortamında izole edilmiştir (`[UNVERIFIED]` canlı bağlantı — güvenlik gereği kapalı).

## 1. Çoklu Proje Ekosistemi ve Repo Sınırları

Birim ekosistemi üç ayrı depodan oluşur:
1. **`birim-configurator` (Bu Depo):** 2D/3D parametrik tasarım, 4-mekân geometri, BOM, CNC delik, 2D plaka optimizasyonu ve ticari fiyat hesaplama motoru.
2. **`birim-store` (Harici Depo — Dokunulmaz):** Mağaza satış temsilcisi CPQ (Configure-Price-Quote) sepet, teklif ve müşteri yönetimi.
3. **`birim-portal` / Birim ERP (Harici Depo — Dokunulmaz):** Fabrika üretim planlama, iş emri rotalama, stok ve sevkiyat yönetimi.

> **Kesin Sınır Kuralı:** Ajanlar yalnızca `birim-configurator` deposunda değişiklik yapabilir. `birim-store` ve `birim-portal` depolarına, ortak staging/production Supabase veritabanlarına bağlanmak veya yazmak yasaktır.

---

## 2. Birim Store CPQ Entegrasyon Sözleşmesi (`IStoreAdapter`)

- **Tanım Dosyası:** `packages/integrations/src/types.ts` ve `packages/integrations/src/store-adapter.ts` (`[VERIFIED]`)
- **Metot:** `createOrUpdateQuoteItem(project, bom, pricing, quoteId, idempotencyKey?)`
- **Sözleşme Özeti (`StoreQuoteItemPayload`):**
  - `quoteId`, `cartItemId`, `branchId`, `idempotencyKey`, `signature` (`SIG_HMAC_SHA256_*`)
  - `configuratorSnapshot`:
    - `designId`, `version`, `libraryVersionId`
    - `calculatedPriceEur`, `calculatedPriceTry` (KDV dahil doğrulanmış tutarlar)
    - `selectedDoorSystems`, `selectedHardwareSkus`
    - `compatibilityStatus` (`VALID` | `WARNING` | `INCOMPATIBLE` | `UNVERIFIED`)
    - `bomSummary`: `{ totalPieces, totalAreaM2, totalHardwareCount, totalDrillingHolesCount }`
    - `rawProjectData`: Tam `DesignProject` (`schemaVersion: 4`) JSON kopyası.

---

## 3. Birim ERP Production Blueprint Sözleşmesi (`IERPAdapter`)

- **Tanım Dosyası:** `packages/integrations/src/types.ts` ve `packages/integrations/src/erp-adapter.ts` (`[VERIFIED]`)
- **Hedef Tablo Sözleşmesi:** `public.production_blueprints` (Supabase / PostgreSQL şema sözleşmesi: `docs/DATABASE_DESIGN.md` ve `docs/LIBRARY_DATABASE_DESIGN.md`)
- **Metot:** `publishProductionBlueprint(project, bom, orderId, idempotencyKey?)`
- **Fail-Closed Güvenlik Kapısı (`[VERIFIED]`):**
  1. `bom.validationWarnings` içinde `ERR_` varsa işlem hata fırlatarak reddedilir.
  2. `evaluateProjectCompatibility(project).overallStatus` değeri `INCOMPATIBLE` veya `UNVERIFIED` ise ERP/CNC aktarımı **kesin olarak engellenir**.
- **Sözleşme Özeti (`ERPBlueprintPayload`):**
  - `order_id`, `version`, `branch_id`, `idempotency_key`, `status: "draft"`
  - `items[]`: Her ahşap parça için `piece_id`, `label`, `material`, `dimensions_mm: [length, width, thickness]`, `edge_banding`, `grain`, `workshops` (`["ebatlama", "kenar_bantlama", "cnc_delik_ve_freze", "boyahane", "montaj_paketleme"]`), `drilling_count`.
  - `hardware_items[]`: `sku`, `name`, `quantity`, `unit`.
  - `metadata`: `compatibility_status`, `cnc_production_approved`.

---

## 4. Fabrika Makine ve CAD Çıktı Sözleşmeleri (`@birim/manufacturing`)

1. **Biesse Selco WNT 600 Ebatlama XML (`packages/manufacturing/src/selco-adapter.ts`)**:
   - `generateSelcoXml(bom, nesting)` fonksiyonu kesim planını XML formatında üretir.
   - Fiziksel fabrika postprocessor onayı tamamlanana kadar çıktı taslak (`draft`) statüsündedir (`[UNVERIFIED]` fiziksel makine testi).
2. **Katmanlı AutoCAD DXF (`packages/manufacturing/src/technical-outputs.ts`)**:
   - `generatePanelDXF(piece)` ve `exportAllPanelsDXF(bom)` fonksiyonları `$INSUNITS = 4` (mm) standardında `PANEL_CONTOUR`, `NET_CUT_CONTOUR`, `BACK_GROOVE_8MM`, `BORE_35MM`, `CAM_15MM`, `DRILL_8MM`, `DRILL_5MM` katmanlarıyla CAD çıktısı üretir (`[VERIFIED]`).
3. **DWG/DXF/PDF Kat Planı İçe Aktarma (`packages/core/src/floorplan-parser.ts`)**:
   - `parseFloorplanFile` ASCII DXF/DWG (`LINE`, `LWPOLYLINE`) ve PDF (`/MediaBox`) dosyalarından mimari duvar poligonlarını çıkarır (`[VERIFIED]`; ikili/binary DWG dönüştürücü `[UNVERIFIED]`).
