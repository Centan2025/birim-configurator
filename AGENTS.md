# AGENTS.md — Modül Multi-Tenant 3D CAD-to-CAM SaaS Platformu

Bu dosya, **Modül** monorepo projesi üzerinde çalışan tüm geliştiriciler ve yapay zekâ kodlama ajanları için tekil mimari doğruluk kaynağıdır (SSOT).

## 1. Temel Mimari İlke (Altın Kural)
- **Modül**, firma bağımsız, çok kiracılı (multi-tenant) bir 3B/2B mobilya tasarım, mühendislik, fiyatlandırma ve CNC/CAM üretime hazırlık platformudur.
- **Birim Mobilya Sanayi ve Ticaret A.Ş.** (`tenantId: "00000000-0000-0000-0000-000000000001"`, `slug: "birim"`), bu platformun **ilk kurumsal müşterisidir (`Tenant #1`)**.
- Ortak çekirdek paketlere (`packages/core`, `packages/geometry`, `packages/manufacturing`, `packages/pricing`) hiçbir zaman tek bir müşteriye özgü sabit iş kuralı, sabit ERP adresi veya yerel dosya yolu gömülemez. Tüm firma farklılıkları `TenantWorkspaceProfile` (`ConstructionRuleProfile`, `TenantMachineProfile`, `PricingParameters`, `TenantBrandTheme`) üzerinden enjekte edilir.
- Birim markası aktif kiracı olduğunda orijinal `BirimLogo` (`B1R1M®` geometrik wordmark) ve gerçek ürün tasarımları değiştirilmeden korunur.

## 2. Katman Sınırları ve Bağımlılık Yönü
1. **`packages/core` (`@modul/core` / `@birim/core`)**: Şemalar, 4-uzay matematiği, EN/DIN fiziksel kuralları, standartlar sicili ve çok kiracılı SaaS sözleşmeleri (`saas-tenant-core.ts`). Hiçbir üst katmanı import etmez.
2. **`packages/geometry` (`@modul/geometry`)**: Deterministik 3B parça geometrisi (`mesh-generator.ts`), 2B cephe/kesit/plan projeksiyonu (`projection2d.ts`) ve `.GLB/.OBJ/.USDA` dışa aktarıcılar.
3. **`packages/catalog` (`@modul/catalog`)**: Evrensel modül arketipleri, 108 hazır modül şablonu, donanım SKU tanımları ve kütüphane yaşam döngüsü yöneticisi.
4. **`packages/manufacturing` (`@modul/manufacturing`)**: BOM kesim listesi, Sistem 32 + Minifiks / Lamello Cabineo / Confirmat delik motoru (`drilling-engine.ts`), Homag `.MPR` / Biesse `.CIX` / SCM `.XCS` post-processor ve giyotin nesting.
5. **`packages/pricing` (`@modul/pricing`)**: Firma bazlı `PricingParameters` ve bayi/şube iskonto katmanlarıyla çalışan deterministik maliyet/teklif motoru.
6. **`packages/integrations` (`@modul/integrations`)**: Kiracı bazlı dış sistem konnektörleri (`SupabaseStoreRpcAdapter`, `SupabaseErpNestingRpcAdapter`, genel Webhook/ERP adaptörleri ve R2 depolama köprüsü).
7. **`apps/configurator`**: Next.js 15 çalışma alanı, `middleware.ts` ve `tenant-auth-guard.ts` sıfır-güven API katmanı, `SaasTenantStudioModal` firma yönetim stüdyosu.

## 3. Güvenlik ve Kiracı İzolasyon Kuralları
- Hiçbir API rotası doğrulanmış oturum bağlamı varken istemci gövdesinden gelen `organizationId` veya `sessionRole` değerine güvenerek başka bir kiracıya yazma yapamaz (`403 TENANT_SPOOFING_BLOCKED`).
- Veritabanı tabloları (`supabase/migrations/`) bileşik yabancı anahtar (`tenant_id, id`) ve `FORCE ROW LEVEL SECURITY` kullanır.
- Tarayıcı `localStorage` anahtarları `buildTenantScopedStorageKey(tenantId, key)` üzerinden izole edilir; kiracı değişiminde Zustand belleği sıfırlanır.
- Kopya metinlerinde, arayüz etiketlerinde ve kod yorumlarında yasaklı kelimeler kesinlikle kullanılmaz; net mühendislik ve üretim dili kullanılır.
