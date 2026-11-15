# Modül — Mimari Modül Haritası (`module-map.md`)

| Dizin / Dosya | Katman | Sorumluluk |
| :--- | :--- | :--- |
| `packages/core/src/saas-tenant-core.ts` | SaaS Çekirdeği | `TenantWorkspaceProfile`, `ConstructionRuleProfile`, `TenantMachineProfile`, `TenantEntitlements`, 11 RBAC rolü, `Birim` (`Tenant #1`) ve `Anka` (`Tenant #2`) referans profilleri |
| `packages/core/src/v4-profiles.ts` | Mühendislik | 4-Uzay boyut hesabı (dış zarf, net gövde kesim, iç açıklık, kapak süpürme) |
| `packages/core/src/standards-registry.ts` | Mühendislik | EN/DIN/Blum standartlar kataloğu, merkezi Türkçe uyarı sözlüğü ve özel kural motoru |
| `packages/geometry/src/mesh-generator.ts` | Geometri | Parametrik gövde, kapak, çekmece, baza (`gable_rails` dahil) ve köşe dolap 3B parça üretimi |
| `packages/manufacturing/src/bom-generator.ts` | Üretim | Net kesim ölçüsü, kenar bandı, konstrüksiyon profili (`16/18/19/22/25 mm`) ve donanım BOM hesabı |
| `packages/manufacturing/src/drilling-engine.ts` | Üretim | Sistem 32 delik koordinatları, Minifiks+Kavela, Lamello Cabineo ve Confirmat birleşim şablonları |
| `packages/manufacturing/src/cnc-postprocessors.ts` | Üretim | Kiracı makine profiline göre Homag `.MPR`, Biesse `.CIX`, SCM `.XCS` ve ISO G-Code üretimi |
| `packages/pricing/src/pricing-engine.ts` | Fiyatlandırma | Plaka fire, kenar bandı, boyahane lake, CNC delik, kâr marjı ve bayi iskonto hesaplayıcısı |
| `apps/configurator/src/lib/tenant-auth-guard.ts` | BFF Güvenlik | Sıfır-güven oturum/JWT çözümleme, çapraz kiracı sahteciliği engelleme, RBAC & Entitlement denetimi |
| `apps/configurator/src/middleware.ts` | Edge / Yönlendirme | Özel alan adı (`modul.birim.com`, müşteri CNAME) -> kiracı slug çözümleme ve güvenlik başlıkları |
| `apps/configurator/src/v3/components/workspace/SaasTenantStudioModal.tsx` | SaaS UI | Organizasyon/Rol geçişi, Konstrüksiyon/CNC profili, Fiyat/Bayi kuralları, Plan Yetkileri ve Embed SDK |
| `supabase/migrations/20261115000100_modul_saas_multitenant_backbone.sql` | Veritabanı | Çok kiracılı PostgreSQL tabloları, bileşik FK kısıtları, Force RLS politikaları ve kilitli sipariş tetikleyicisi |
| `tests/v80-saas-multitenant-isolation.test.ts` | Doğrulama | `Tenant #1 (Birim)` ve `Tenant #2 (Anka)` arasında 10 maddelik uçtan uca bağımsızlık ve güvenlik testi |
| `packages/core/src/lru-cache.ts` | Performans Çekirdeği | Bellek güvenli `BoundedLruCache` ve deterministik modül/proje yapısal parmak izi motoru |
| `packages/core/src/hardware-compatibility-advisor.ts` | Mühendislik | Ön klapa otomatik menteşe eksen hesabı ve Türkçe donanım uyumluluk/alternatif çözücü |
| `packages/manufacturing/src/cnc-simulation.ts` | Üretim & CAM | CNC ön doğrulama (Z-derinlik, et kalınlığı, vakum papucu), çevrim süresi ve 2B SVG takım yolu simülasyonu |
| `apps/configurator/src/v3/components/workspace/SmartTaskLauncherModal.tsx` | Başlangıç UX | 4 seçenekli "Ne tasarlamak istersiniz?" akıllı görev başlatıcı ve deneyimli kullanıcı hızlı geçişi |
| `apps/configurator/src/v3/components/workspace/SmartContextualInspector.tsx` | Bağlamsal UX | Seçili nesneye (Dolap / Kapak / Çekmece) göre uyarlanan akıllı özellik ve hata önleyici panel |
| `apps/configurator/src/v3/components/workspace/CommandSearchModal.tsx` | Görev Odaklı UX | `Ctrl+K` hızlı komut arama, favori araçlar ve son kullanılan işlemler paleti |
| `apps/configurator/src/v3/components/workspace/LiveChangeImpactPill.tsx` | Canlı Özet UX | Ölçü, parça, plaka, maliyet ve üretim etkisini anlık gösteren canlı değişiklik rozeti |
| `apps/configurator/src/v3/components/workspace/QuickViewModeBar.tsx` | Görünüm UX | WebGL sıfırlamadan 9 çalışma görünümü (Katı, Tel Kafes, Şeffaf, Kapaksız, Patlatılmış, 2B) çubuğu |
| `tests/v90-kesapp-ux-engineering-performance.test.ts` | Doğrulama | 3D=2D=BOM=CNC değişmezlik, klapa, yamuk duvar, CNC simülasyon ve artımlı performans testi |
