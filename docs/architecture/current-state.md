# Modül (Birim Configurator) — Güncel Mimari Durum (SSOT)

## Tamamlanan SaaS Katmanları (Faz 0 – Faz 6)
1. **Faz 0 & 1 — Firma-Bağımsız Mühendislik, CNC ve Fiyat Çekirdeği (`@modul/*` / `@birim/*`)**
   - `ConstructionRuleProfile` (16/18/19/22/25mm gövde, 8mm kanal/lamba veya 4mm çivili HDF arkalık, Minifiks/Lamello Cabineo/Konfirmat) ve `TenantMachineProfile` (`.MPR`, `.CIX`, `.XCS`, ISO G-Code).
   - `TenantPricingPolicy` (EUR/TRY, stoklu plaka kümesi, hedef marj ve B2B bayi net iskonto motoru).
2. **Faz 2A & 2B — Multi-Tenant PostgreSQL Force-RLS, Auth, Davet ve Değişmez Sipariş Versiyonları**
   - `supabase/migrations/20261115000100_modul_saas_multitenant_backbone.sql` (22 tablo, bileşik `(tenant_id, id)` FK, `FORCE ROW LEVEL SECURITY`, `ORDER_SNAPSHOT_IMMUTABLE` tetikleyicisi).
   - `ModulPostgresRepository`, `/api/saas/auth`, `/api/saas/projects`, `/login`, `/register`, `/onboarding` ve `{tenantId}` önekli tam `localStorage` izolasyonu (projeler, özel standartlar ve özel şablonlar).
3. **Faz 3 — Müstakil Firma Yönetim Konsolu (`/[orgSlug]/admin`) ve CSV Katalog Aktarıcı**
   - CSV malzeme/fiyat içe aktarıcı (`tenant-catalog-importer.ts`), yayın öncesi otomatik BOM/mühendislik doğrulamalı şablon yayınlayıcı ve `/platform-admin` SuperAdmin gözlem merkezi.
4. **Faz 4 — Birim `Tenant #1` Gölge Doğrulama ve Dış ERP HMAC Webhook/Outbox Adaptörü**
   - `runBirimTenant1ShadowVerification` (`0.00 EUR` ve `0` delik/parça sapması kanıtı) ve `OutboundWebhookErpAdapter` (`X-Modul-Signature-256` + Outbox yeniden deneme + DLQ tekrar oynatma).
5. **Faz 5 — Abonelik Yaşam Döngüsü, Kota Sayacı (`UsageMeteringEngine`) ve İyzico / Stripe Faturalama**
   - `saas-billing-and-metering.ts` (`IyzicoBillingAdapter` TR KDV + `StripeBillingAdapter` Global, ödeme gecikmesinde 7 gün veri kayıpsız `past_due` salt-okunur koruma, Blender/CAM/Proje kota sayaçları).
6. **Faz 6 — Gömülebilir White-Label `embed.js` SDK ve Özel Domain Yönlendirme**
   - `public/sdk/v1/embed.js` + `/embed/[tenantSlug]` (`postMessage` sepet/teklif köprüsü) + `middleware.ts` CNAME/subdomain çözümleyici.

## Faz 7 — Yüksek Performanslı Artımlı Motor, Kademeli Karmaşıklık (3 Seviye UX) ve Ön-Doğrulamalı CNC Simülasyonu (V9.0)
1. **Performans ve Bellek Mimarisi (`packages/core/src/lru-cache.ts`)**
   - Sınırsız `Map` önbellekleri yerine bellek sızıntısını önleyen `BoundedLruCache<K, V>` ve hızlı yapısal parmak izi (`computeModuleStructuralSignature` / `computeProjectStructuralSignature`) devreye alındı.
   - `bom-generator.ts` modül bazlı artımlı dilim önbelleği (`moduleBomSliceCache`), `sheet-nesting.ts` malzeme grubu bazlı nesting önbelleği (`nestingMaterialGroupCache`), `rules.ts` modül doğrulama önbelleği ve `useConfiguratorStore.ts` tekil modül yapısal paylaşımı (`cloneProjectForSingleModule`) ile 20 modüllü projede 100 ardışık ölçü değişimi **7.156,6 ms (71,57 ms/işlem) -> 790,5 ms (7,91 ms/işlem)** seviyesine (~9,05× hızlanma) indirildi.
   - `V3ThreeViewport.tsx` her efektte `JSON.stringify` yerine yapısal imza ve sıfır WebGL bağlam sıfırlamalı anlık `Tel Kafes` / `Şeffaf` / `Kapaksız Gövde` / `Patlatılmış` görünüm geçişlerini kullanır; kapalı modalların (`BomModal`, `StoreErpModal`) arka plan abonelik yükü sıfırlandı.
2. **Mühendislik, Aksesuar ve CNC Simülasyon Geliştirmeleri**
   - `hardware-compatibility-advisor.ts`: Ön klapa (`frontFillerLeftMm` / `frontFillerRightMm`) eksen kaymasında otomatik 95° kör köşe / 155° sıfır çıkıntı robot menteşe geçişi ve sığmayan çekmece/kapak donanımlarında Türkçe neden + tek tıkla uyumlu alternatif önerici.
   - Görünen yanların doğrudan kapak malzemesinden üretilmesi (`exposedLeftSideUseDoorMaterial`/`Right`), yamuk duvar montaj/tıraş payı (`scribeAllowanceLeftMm`/`Right`), 5+5 proje hızlı malzeme paleti (`materialPaletteSlots`) ve yapılandırılabilir taslak kural etiketli atölye metrikleri (`workshopMetrics`).
   - `cnc-simulation.ts`: Makineye aktarım öncesi Z-derinlik patlatma, vakum papucu tutuş, delikler arası et kalınlığı kontrolü, 2B SVG takım yolu simülasyonu ve post-processor kalibrasyon kilidi (`UNVERIFIED_SIMULATION_ONLY`).
3. **Sıfır Öğrenme Eğrisine Yakın Kademeli Deneyim**
   - `SmartTaskLauncherModal.tsx` & `EmptyStageRecoveryCard.tsx`: 4 seçenekli "Ne tasarlamak istersiniz?" başlangıç akışı ve deneyimli kullanıcı doğrudan sahne geçiş tercihi.
   - `SmartContextualInspector.tsx`, `CommandSearchModal.tsx` (`Ctrl+K`), `LiveChangeImpactPill.tsx`, `QuickViewModeBar.tsx` ve `WorkspaceTopBar.tsx` isimli/kompakt araç modu.
