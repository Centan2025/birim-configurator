# BİRİM CONFIGURATOR (V12.0) — TAM MİMARİ VE AJAN DEVİR KILAVUZU (AGENT HANDOFF)

Bu depo **Birim Mobilya** ve çok kiracılı **Modül SaaS** altyapısı için geliştirilmiş parametrik 3B/2B mobilya tasarım stüdyosu, deterministik mühendislik doğrulama motoru ve **Birim Store / Portal ERP CNC Panel Nesting** üretim platformudur.

## 1. Aktif Uygulama Kabuğu (`apps/configurator/src/v11/`)
Tüm ana rotalar (`/`, `/v3`, `/v3/studio`, `/v3/plan`, `/v3/showroom`, `/embed/[tenantSlug]`, `/p/[code]`) `BirimStudioWorkspace.tsx` bileşenini çalıştırır:
- **Doğrudan Ürün Üzerinde Tasarım (`OnObjectQuickToolbar.tsx`)**: 3B sahnede kapak, raf, çekmece veya bölmeye dokunulduğunda sahne altında bağlamsal hızlı işlem çubuğu (+ Raf, + Çekmece, + Askı, İçini Gör, Kapak Yönü, Hızlı Renk) açılır.
- **Hazır Akıllı Tasarım Şablonları (`guidedWizardBuilder.ts` + `GuidedSetupModal.tsx`)**: Girilen duvar ölçüsüne göre 4 mühendislik onaylı, canlı fiyatlı başlangıç tasarımı (*Dengeli Günlük*, *Maksimum Askı*, *Bol Çekmeceli*, *Füme Cam Vitrin & LED Signature*) üretir.
- **3 Çalışma Seviyesi (`Kolay`, `Pro`, `Üretim`)**: `UserExperienceTier` (`simple`, `architect`, `factory`) aynı `DesignProject` verisini paylaşır; mod geçişlerinde veri kaybolmaz. Kolay modda yönlendirici 3 adım şeridi (*1. Ölçü & Şablon → 2. İç Düzen & Yüzey → 3. Tek Tık Sunum*) gösterilir, ileri düzey CNC/MEP/kertme ayarları gizlenir.
- **Mobil/Tablet (`<1024px`) ve Dokunmatik Ergonomisi**: Küçük ekranlarda sağ/sol çekmeceler çakışmasız (karşılıklı dışlamalı) çalışır; 3B/2B bölünmüş ekran ayırıcısı `PointerEvent` (`touch-none`) destekler; 3B sahnede sol tuş `ROTATE` (Orbit), sağ sürükleme `PAN`, sağ tık bağlam menüsü açar.

## 2. Kritik Mühendislik, CNC, Fiyat ve Entegrasyon Güvenceleri
1. **CNC Post-Processor & Suyolu Güvenliği (`packages/manufacturing`)**:
   - Homag `.MPR` ve Biesse `.CIX` çıktılarında üst/alt tablaların yanı sıra sol ve sağ yan dikmelere (`carcass_side_left`, `carcass_side_right`) 8 mm arkalık kanalı işlenir.
   - `crosswise` (yatay damarlı 90° döndürülmüş) parçalarda tüm delik koordinatları `(x, y) -> (y, x)` ve kenar bantları eksenleriyle birlikte transpoze edilir; parça sınırını aşan delikler `[ERR_CNC_HOLE_OUT_OF_BOUNDS]` ile yakalanır.
   - Sistem 32 raf pimi sütunları (içerlek kapak `57 mm` ön sıra dahil) sütun bazlı üretilir; sabit taşıyıcı raflar (`Minifix`/`Rafix`) 3B/2B sürüklemede Ø5 mm pim deliklerine zorlanmaz.
2. **Malzeme, Donanım ve Fiyat Doğruluğu (`packages/core`, `packages/pricing`)**:
   - Hazır UV/PET lak levhalar (`AGT Supramat`, `Kastamonu Mattplus`, `Evogloss`) `requiresEdgeBanding: true, requiresPaintshop: false` ile bantlanır; gerçek boyahane ipek mat lake (`requiresPaintshop: true`) bantsız üretilir ve boyahane işçiliği alır.
   - MDFLam / yonga levha elastisite modülü gerçek `3200–3400 MPa` aralığındadır; Blum AVENTOS `HF top` (`22F`), `HL top` (`22L`) ve `HK top` (`22K`) güç faktörü (`LF`) SKU tabloları ayrıştırılmıştır.
   - Alternatif malzeme fiyat karşılaştırması sahnedeki ticari cihazları (`commercialObjectsCostEur`) ve aktif KDV oranını korur.
3. **Artımlı Performans Önbelleği (`computeModuleIntrinsicSignature`)**:
   - `packages/core/src/lru-cache.ts` içindeki yatay konumdan (`position.x/z`) bağımsız modül imzası sayesinde 50 modüllü projelerde tek modül düzenlenip komşu 49 modül yatay kaydığında geometri ve modül BOM dilimleri `O(1)` önbellekten okunur.
4. **Supabase Atomik RPC ve SaaS Güvenliği**:
   - `supabase/migrations/20261118160000_fix_store_erp_rpc_contracts.sql` ile Store teklif ve ERP nesting RPC imzaları `@birim/integrations` adaptörleriyle birebir hizalanmıştır.

## 3. Çalıştırma ve Doğrulama Komutları
```bash
npm install
npm run dev          # Geliştirme sunucusu (apps/configurator)
npm run test         # Vitest birim, sınır ve E2E regresyon testleri (36 paket)
npm run build        # Tüm paketlerin ve Next.js uygulamasının derlenmesi
```
