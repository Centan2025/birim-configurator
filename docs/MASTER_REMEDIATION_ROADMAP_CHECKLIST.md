# Birim Configurator — Uçtan Uca Kontrollü İyileştirme Yol Haritası ve Uygulama Kontrol Listesi (Aşama B)

**Belge Durumu:** Uygulandı ve Regresyon Testleriyle Doğrulandı (`36/36` Test Paketi, `204/204` Test Başarılı)
**Mimari Kapsam:** `@birim/core`, `@birim/catalog`, `@birim/geometry`, `@birim/manufacturing`, `@birim/pricing`, `@birim/integrations` ve `apps/configurator` (`V12.0 BirimStudioWorkspace`)
**Öncelik Sıralaması:** 1) Mühendislik, CNC ve veri doğruluğunu güvenceye almak → 2) Kullanım akışını radikal biçimde sadeleştirmek (Kolay Mod, Profesyonel Mod ve 5 Fark Yaratan Özellik) → 3) 3B sunum kalitesi, büyük sahne performansı ve akıllı otomasyonu geliştirmek → 4) Çok kiracılı SaaS güvenliği ve Store/ERP sözleşmesini doğrulamak.

## 1. Güvenlik İlkeleri, Şema Koruma ve Geri Dönüş (Rollback) Stratejisi

* \[x\] **Geriye Dönük Veri Şeması Uyumluluğu (`schemaVersion: 4`):** `DesignProject`, `ModuleInstance`, `CarcassConfig` ve `MaterialDefinition` modellerine eklenen tüm yeni alanlar (`requiresEdgeBanding`, `requiresPaintshop` vb.) isteğe bağlı (`optional`) tanımlandı; mevcut kayıtlı projeler ve paylaşım bağlantıları sıfır veri kaybıyla açılır.

* \[x\] **Tekil Parametrik Doğruluk Kaynağı (`0.00 mm` Sapma):** 3B çalışma sahnesi (`V3ThreeViewport`), 2B cephe/kesit/plan (`V3CadViewport2D`), müşteri sunum modu (`ShowroomPresentationOverlay`), kesim ve delik listesi (`generateBOMForProject`), CNC çıktıları (`.DXF`, `.MPR`, `.CIX`, `.XCS`, `.BXF`) ve fiyatlandırma (`calculateProjectPrice`) tek bir `DesignProject` modelinden türetilir.

* \[x\] **Fail-Closed Üretim Kapısı (`GATE_06` & Uyumluluk Motoru):** Fiziksel fabrika deneme kesimi yapılmamış (`UNVERIFIED`) veya mühendislik/panel sınırı hatası (`INCOMPATIBLE`, `[ERR_CNC_HOLE_OUT_OF_BOUNDS]`) taşıyan hiçbir tasarım Birim Portal ERP üretim hattına sessizce aktarılamaz.

* \[x\] **İzole ve Geri Alınabilir Faz Yapısı:** Tüm veritabanı değişiklikleri `supabase/migrations/20261118160000_fix_store_erp_rpc_contracts.sql` içinde eklemeli (`CREATE OR REPLACE FUNCTION`, `IF NOT EXISTS`) ve açık `ROLLBACK` komutlarıyla hazırlandı; açık onay olmadan canlı veritabanına migration veya production deploy çalıştırılmaz.

## 2. Faz Bazlı Özet Uygulama Matrisi

| Faz | Odak Alanı | Kapsanan Bulgu ve Özellikler | Ana Dosyalar | Geri Dönüş (Rollback) Yöntemi | Doğrulama Kanıtı | 
| ----- | ----- | ----- | ----- | ----- | ----- | 
| **Faz 1A** | CNC Post-Processor ve Suyolu Delik Güvenliği | `P0-CNC-01`, `P0-CNC-02`, `P1-ENG-02` | `cnc-postprocessors.ts`, `bom-generator.ts`, `drilling-engine.ts`, `elevationSnapEngine.ts` | Modül bazlı izole fonksiyon revert; veri şeması değişmez | `v4-universal-library` (`10/10`) ve `v12-audit-remediation-e2e` | 
| **Faz 1B** | Malzeme, Sehim, Donanım ve Fiyat Doğruluğu | `P0-MFG-03`, `P0-PRC-06`, `P1-ENG-01`, `P1-ENG-03`, `P2-ARC-01` | `defaults.ts`, `rules.ts`, `pricing-engine.ts`, `custom-template-storage.ts`, `v5-scene-object-catalog.ts` | İsteğe bağlı malzeme bayrakları varsayılana döner | `pricing-engine`, `v6-engineering-accuracy-12levels` (`23/23`), `v12` | 
| **Faz 1C** | Sıfır-Güven SaaS, Render Kotası ve SQL RPC | `P0-SEC-05`, `P0-INT-04`, `P1-INT-07` | `tenant-auth-guard.ts`, `blender/route.ts`, `20261118160000_fix_store_erp_rpc_contracts.sql` | SQL dosyası sonundaki `ROLLBACK` bloğu ve guard revert | `v73-supabase-store-erp-rpc` (`9/9`), `v80` (`10/10`), `v81` (`6/6`), `v12` | 
| **Faz 2** | Radikal UX Sadeleştirme ve 5 Fark Yaratan Özellik | `P1-UX-04..06`, `P2-UX-04`, `P3-STR-01..05` | `OnObjectQuickToolbar.tsx`, `GuidedSetupModal.tsx`, `guidedWizardBuilder.ts`, `RightParametricInspector.tsx`, `StudioHeaderBar.tsx`, `BirimStudioWorkspace.tsx`, `V3ThreeViewport.tsx` | UI katmanı bileşen bazlı ayrık; `DesignProject` verisi etkilenmez | `v11-studio-ui-architecture` (`12/12`), `v90` (`7/7`), `v91` (`4/4`), `v12` | 
| **Faz 3** | Artımlı Büyük Sahne Önbelleği ve Mimari Hafıza | `P2-PERF-02`, `P2-ARC-01` | `lru-cache.ts`, `mesh-generator.ts`, `bom-generator.ts`, `rules.ts`, `v4-compatibility.ts`, `AGENTS.md`, `AGENT_HANDOFF.md` | `computeModuleIntrinsicSignature` yerine tam imza çağrısına dönüş | `performance-profiling` (`6/6`), `v92` (`4/4`), `v12` (50 modül testi) | 
| **Faz 4** | Uçtan Uca 10 Senaryo ve Sınır Test Sertifikasyonu | 10 Gerçek Kullanıcı Senaryosu + Property-Based CNC Sınır Testi | `tests/v12-audit-remediation-e2e.test.ts` ve mevcut 35 test paketi | Test paketi eklemesi (üretim kodunu etkilemez) | Toplam **36 dosya, 204 test %100 PASS** | 

## 3. Aşama B — Adım Adım Teknik Uygulama Kontrol Listesi

### Faz 1: Mühendislik, CNC Üretim, Fiyat, Güvenlik ve Veritabanı Sözleşmesi (P0 ve Kritik P1)

#### 1.1 CNC Post-Processor, Suyolu Rotasyonu ve Sistem 32 Delik Motoru

* \[x\] **`[P0-CNC-01]` Homag `.MPR` ve Biesse `.CIX` Yan Dikme 8 mm Arkalık Kanalı:**

  * `packages/manufacturing/src/cnc-postprocessors.ts` içindeki `generateHomagMprPrograms` (`<109 \Nut\`) ve `generateBiesseCixProgram` (`NAME=CUT_G`) koşulları `"carcass_side_left"`, `"carcass_side_right"`, `"side_left"`, `"side_right"` rollerini kapsayacak biçimde SCM `.XCS` ve AutoCAD `.DXF` ile eşitlendi.

  * Sağ yan dikmede `mirrorInnerFaceX` aktifken kanal merkezinin `grooveOff - 4` olarak aynalandığı doğrulandı.

* \[x\] **`[P0-CNC-02]` Yatay Suyolu (`grain === "crosswise"`) 90° CNC Delik ve Kenar Bandı Transpozisyonu:**

  * `packages/manufacturing/src/bom-generator.ts` içinde 90° suyolu rotasyonu uygulanan kapak ve panellerde tüm `DrillingHole` koordinatları ve kenar yönleri (`edge_top ↔ edge_left`, `edge_bottom ↔ edge_right`) yeni `(nominalWidthMm, nominalLengthMm)` eksenlerine transpoze edildi.

  * Dikey damar sürekliliği (`facadeGrainContinuity`) aktif çekmece klapalarında [Blum TANDEMBOX antaro Montaj Ölçüleri](https://publications.blum.com/2022/catalogue/en/311/) ZSF ön bağlantı delik ekseni parça yönüne göre hizalandı.

  * Her kesim parçasında `0 <= hole.x <= nominalWidthMm` ve `0 <= hole.y <= nominalLengthMm` sınır kontrolü yapan `[ERR_CNC_HOLE_OUT_OF_BOUNDS]` bekçisi devreye alındı.

* \[x\] **`[P1-ENG-02]` Sistem 32 Raf Pimi Sütun Sıralaması ve Sabit Raf Mıknatıslama Ayrımı:**

  * `packages/manufacturing/src/drilling-engine.ts` içinde [Avrupa Sistem 32 Standardı](https://assistent-system.fr/en/content/6-system-32) (`37 mm` ön gerileme + `32 mm` adım; içerlek kapakta `57 mm`) raf pimi delikleri ön sütun → orta sütun → arka sütun sırasıyla gruplandı.

  * `apps/configurator/src/v3/engine/elevationSnapEngine.ts` içinde [Häfele Minifix 15 Eksantrik Bağlantı](https://fixingking.com/products/hafele-minifix-15-cam-lock-connector-housings-zinc-alloy-15mm-without-rim) veya Rafix 20 kullanan sabit taşıyıcı rafları (`isAdjustable === false`) zorla Ø5 mm pim deliklerine yakalatan `{ includeFixedShelves: true }` zorlaması kaldırıldı.

#### 1.2 Malzeme Fiziği, Raf Sehimi, Blum Donanım Kataloğu ve Fiyat Motoru

* \[x\] **`[P0-MFG-03]` Hazır UV/PET Lak Plakalar ile Boyahane İpek Mat Lake Ayrımı:**

  * `MaterialDefinition` tipine ve Zod şemasına `requiresEdgeBanding?: boolean` ve `requiresPaintshop?: boolean` eklendi.

  * Hazır ebatlanan UV/PET levhalar (`mat_lacquer_white` AGT Supramat, `mat_ke_mattplus_vizon`, `mat_ke_evogloss_p114`) `requiresEdgeBanding: true, requiresPaintshop: false` olarak tanımlanarak 1 mm PVC kenar bandı ve net kesim düşümü korundu; boyahane işçiliği yalnızca gerçek `Birim Boyahane İpek Mat Lake` (`requiresPaintshop: true`) kalemlerine sınırlandı.

* \[x\] **`[P0-PRC-06]` Alternatif Malzeme Fiyat Tablosunda Ticari Cihazlar ve Dinamik KDV:**

  * `packages/pricing/src/pricing-engine.ts` içindeki `materialAlternatives` hesabına sahnedeki fiyatlı cihazların (`commercialObjectsCostEur`) ve aktif `vatRatePercent` değerinin dahil edilmesi sağlandı.

* \[x\] **`[P1-ENG-01]` MDFLam / Yonga Levha Elastisite Modülü ve Geniş Açıklık Sehim Koruması:**

  * [CEN EN 14749:2016 Ev ve Mutfak Depolama Birimleri Güvenlik Standardı](https://standards.iteh.ai/catalog/standards/cen/e286887d-f605-48db-89fc-7c4ba3154ba5/en-14749-2016) ve [ISO 7170:2021 Raf Sehim Dayanım Test Yöntemleri](https://cdn.standards.iteh.ai/samples/76864/6dd74627d5b54503b585035f49c812ef/ISO-7170-2021.pdf) uyarınca ahşap dekorlu MDFLam malzemelerdeki masif meşe (`8500 MPa`) varsayımı gerçek kompozit levha modülüne (`3200–3400 MPa`) çekildi; `v5_entryway_vestiyer_180` şablonundaki `1166 mm` açıklıklı sabit bank/üst raflar `25 mm` taşıyıcı kalınlığa yükseltildi.

* \[x\] **`[P1-ENG-03]` Blum AVENTOS Kalkar Kapak Güç Faktörü (`LF`) ve SKU Ayrımı:**

  * [Blum AVENTOS Kalkar Kapak Sistemleri Kataloğu](https://publications.blum.com/2022/catalogue/en/704/) ve [Blum AVENTOS HK top Güç Faktörü Aralıkları](https://www.richelieu.com/ca/en/category/hinges-slides-and-opening-systems/opening-systems/integrated-vertical-opening-systems/lift-up-opening/aventos-hk-top-kits/1210573/sku-WEBKIT1219847) doğrultusunda katlanır `lift_bi_fold` (`22F`), paralel `lift_parallel` (`22L`) ve dik kalkar `lift_up_stay` (`22K2300..22K2900`) mekanizma seçimleri ayrıştırıldı; ayrıca menteşeli kapaklarda [Blum CLIP top BLUMOTION Menteşe Kataloğu](https://publications.blum.com/2022/catalogue/en/105/) ([110° Montaj Kılavuzu](https://d2.blum.com/services/BEC003/cme198264_ma_dok_bus_%24sen-us_%24aof_%24v1.pdf)) ve çekmecelerde [Blum LEGRABOX Kurulum Ölçüleri](https://publications.blum.com/2022/catalogue/en/195/) uyumu korundu.

* \[x\] **`[P2-ARC-01]` `@birim/core` ve `@birim/catalog` Özel Şablon Depolama İhraçları:**

  * `loadSavedCustomModuleTemplates`, `persistCustomModuleTemplates` ve `resolveCustomTemplatesStorageKey` fonksiyonları `packages/core/src/custom-template-storage.ts` içine alınıp her iki paketten temiz biçimde ihraç edildi.

#### 1.3 Sıfır-Güven SaaS Kiracı İzolasyonu, Render Kotası ve Store/ERP SQL Migrasyonu

* \[x\] **`[P0-SEC-05]` Middleware Pasif Slug Ayrımı ve Production Secret Zorunluluğu:**

  * `apps/configurator/src/lib/tenant-auth-guard.ts` içinde `middleware.ts` tarafından eklenen pasif `x-modul-resolved-tenant-slug` başlığı ile istemcinin açıkça iddia ettiği `organizationId`/`tenantId` ayrıştırıldı; harici SaaS kiracılarının meşru oturum isteklerindeki yanlış pozitif `403` engeli kaldırılırken gerçek kiracı sahteciliği (`403 TENANT_SPOOFING_BLOCKED`) ve production ortamında eksik sır (`503 SERVER_SECRET_MISSING`) korumaları güçlendirildi.

* \[x\] **`[P1-INT-07]` Blender Stüdyo Render Bulut Kuyruğu ve Kota Koruma Sırası:**

  * `apps/configurator/src/app/api/render/blender/route.ts` içinde yerel Blender ikilisi bulunmadığında harici kiracılar `202 cloud_gpu_render_queue` yanıtına yönlendirildi; `consumeTenantUsageQuota` çağrısı erişilebilirlik kontrolünden sonraya alınarak `503` hatalarında kota yanması engellendi.

* \[x\] **`[P0-INT-04]` Store Teklif ve ERP Nesting Atomik PostgreSQL Migrasyonu:**

  * `supabase/migrations/20261118160000_fix_store_erp_rpc_contracts.sql` ile `upsert_configurator_store_quotation_atomic` ve `publish_configurator_erp_nesting_atomic` fonksiyonları `SupabaseStoreRpcAdapter` ve `SupabaseErpNestingRpcAdapter` parametre sözleşmeleriyle birebir hizalandı (`p_nesting_bundle->'jobs'` iterasyonu ve `pg_advisory_xact_lock` idempotency kilidi dahil).

### Faz 2: Radikal UX Sadeleştirme, Kolay/Profesyonel Mod ve 5 Stratejik Özellik

* \[x\] **Özellik #1 — Doğrudan Ürün Üzerinde Tasarım (`OnObjectQuickToolbar.tsx`):**

  * 3B sahnede dolabın kapağına, rafına, çekmecesine veya bölmesine tıklandığında menüler arasında dolaşmadan sahne üzerinde açılan bağlamsal hızlı işlem kapsülü (*+ Raf*, *+ Çekmece / İç Çekmece*, *+ Askı*, *İçini Gör / Kapağı Kapat*, *Kapak Yönü*, *4 Hızlı Yüzey Kartelası* ve mobil *Detaylar* düğmesi) eklendi.

* \[x\] **Özellik #2 — Ölçüye Uygun 4 Hazır Akıllı Tasarım Şablonu (`guidedWizardBuilder.ts` + `GuidedSetupModal.tsx`):**

  * `generateSmartStarterTemplates` motoru girilen genişlik, yükseklik ve derinliğe göre sıfır mühendislik hatalı ve canlı fiyatlı 4 başlangıç tasarımı (*1. Dengeli Günlük Gardırop*, *2. Sürgü/Menteşeli Maksimum Askı*, *3. Bol Çekmeceli & Katlama Düzeni*, *4. Füme Cam Vitrin & LED Signature*) üretir ve tek tıkla sahneye uygular.

* \[x\] **Özellik #3 — Tek Tıkla Ölçü Korumalı Sunum Kalitesi (`StudioHeaderBar.tsx` + `ShowroomPresentationOverlay.tsx`):**

  * Canlı çalışma ekranındaki tasarım, tek tıkla (`v12-one-click-presentation-btn` ve üst mod seçici) tüm karkas/kapak ölçüleri `0.00 mm` korunarak tam ekran müşteri sunum ve teklif görünümüne dönüştürülür.

* \[x\] **Özellik #4 — Tasarımdan Otomatik Üretim Paketi (`@birim/manufacturing`):**

  * Tekil modelden net kesim listesi, Sistem 32 + Minifix/Cabineo delik koordinatları, Blum/Hettich donanım listesi ve `.DXF`, `.MPR`, `.CIX`, `.XCS`, `.BXF` üretim dosyaları çelişkisiz üretilir.

* \[x\] **Özellik #5 — Kullanıcıyı Yönlendiren Sistem ve Kolay / Pro / Üretim Modları:**

  * Sağ denetçide **Kolay** (`simple`), **Pro** (`architect`) ve **Üretim** (`factory`) mod seçici netleştirildi; mod değiştirildiğinde tasarım verisi kaybolmaz (`cm` ↔ `mm` birim gösterimi otomatik uyum sağlar).

  * **Kolay Mod** aktifken üst çubuk altında *"1. Ölçü & Şablon → 2. İç Düzen & Yüzey → 3. Tek Tık Sunum"* yönlendirme şeridi gösterilir; kavisli tambur karkas formu, lamel adımı, süpürgelik çentiği, panel kertme, tesisat (MEP) ve ERP/firma yönetim kalemleri gizlenerek ilk kez kullanan kişi teknik karmaşadan korunur.

* \[x\] **3B Kamera Standardı, Bölme Kopyalama/Simetri ve Mobil/Tablet (`<1024px`) Ergonomisi:**

  * `V3ThreeViewport.tsx` içinde sol tuş sürükleme `THREE.MOUSE.ROTATE` (Orbit), sağ tuş sürükleme `THREE.MOUSE.PAN` (sürükleme yoksa sağ tık bağlam menüsü) olarak standartlaştırıldı.

  * `useV3Adapter.ts` ve `RightParametricInspector.tsx` içine **İç Düzeni Tüm Bölmelere Kopyala** ve **Simetri (Ayna)** araçları eklendi.

  * `<1024px` ekranlarda ilk açılışta sağ panel kapalı başlar, `<1200px` ekranlarda sol katalog ve sağ denetçi birbirini otomatik kapatarak sıfır çakışma sağlar; 3B/2B bölünmüş ekran ayırıcısı `onPointerDown` (`touch-none`) ile tablet dokunmatiğini destekler.

### Faz 3: Büyük Sahne Artımlı Performans Önbelleği ve Mimari Hafıza

* \[x\] **`[P2-PERF-02]` Yatay Konumdan Bağımsız Modül İmzası (`computeModuleIntrinsicSignature`):**

  * `packages/core/src/lru-cache.ts` içine eklenen `computeModuleIntrinsicSignature` ile `mesh-generator.ts`, `bom-generator.ts`, `rules.ts` ve `v4-compatibility.ts` önbellekleri yatay `position.x / position.z` kaymalarına karşı korundu; 50 modüllü projede tek modül genişliği değişip 49 komşu modül yatay kaydığında değişmeyen 49 modül `O(1)` önbellekten okunur.

* \[x\] **`[P2-ARC-01]` Proje Hafızası Senkronizasyonu:**

  * `AGENTS.md`, `AGENT_HANDOFF.md` ve `docs/ai-context/current-state.md` belgeleri aktif `V12.0 BirimStudioWorkspace` mimarisi ve yeni mühendislik/güvenlik sözleşmeleriyle güncellendi.

### Faz 4: Uçtan Uca 10 Kullanıcı Senaryosu, Sınır Testleri ve Fiziksel Onay Sınırları

#### 4.1 Yazılım ve Matematiksel Regresyon Doğrulaması (`36/36` Test Dosyası PASS)

* \[x\] **Senaryo 1 (Acemi kullanıcı sıfırdan dolap oluşturur):** 4 hazır akıllı şablon üretimi, 0 mühendislik hatası ve 3B geometri ↔ BOM `0.00 mm` ölçü uyumu (`v12-audit-remediation-e2e.test.ts`).

* \[x\] **Senaryo 2 (Deneyimli kullanıcı çok bölmeli dolap tasarlar):** Bölme ekleme, iç düzen kopyalama, simetri aynalama ve `Kolay / Pro / Üretim` mod geçişi (`v11` ve `v12`).

* \[x\] **Senaryo 3 (Kapak ve çekmece donanımları değiştirilir):** Blum CLIP top 110°/155°, TANDEMBOX/LEGRABOX ve AVENTOS `22F/22L/22K` SKU doğrulaması (`v6`, `v91` ve `v12`).

* \[x\] **Senaryo 4 (Ölçü ve suyolu değiştiğinde tüm parçalar yeniden hesaplanır):** Farklı genişlik/yükseklik/derinlik ve `crosswise` yatay suyolu kombinasyonlarında tüm deliklerin panel sınırları içinde kalması ve 4 kenar arkalık kanalı (`v12` property-based sınır testi).

* \[x\] **Senaryo 5 (Geçersiz aksesuar veya ölçü kombinasyonu denenir):** Deterministik mühendislik motoru uyarıları, anlaşılır neden açıklaması ve tek tıkla onaylı düzeltme önerileri (`v6`, `v11`, `smart-advisor`).

* \[x\] **Senaryo 6 (Malzeme değişikliğinin fiyat ve BOM etkisi):** Hazır UV/PET lak levha vs boyahane ipek mat lake kenar bandı/işçilik farkı ve ticari cihazlı projede alternatif malzeme fiyat doğruluğu (`pricing-engine` ve `v12`).

* \[x\] **Senaryo 7 (Tasarım kaydedilir, yeniden açılır, revize edilir ve geri alınır):** `DesignProjectSchema` (`schemaVersion: 4`) serileştirme ve 50 adımlı Undo/Redo yığını (`v73`, `performance-stress` ve `v12`).

* \[x\] **Senaryo 8 (Üretim çıktıları tasarımla karşılaştırılır):** AutoCAD `.DXF`, Homag `.MPR`, Biesse `.CIX`, SCM `.XCS`, Blum `.BXF` ve Birim ERP Nesting paketlerinin tekil modelle uyumu (`technical-outputs`, `erp-nesting-parity`, `v12`).

* \[x\] **Senaryo 9 (50 modüllü büyük tasarımda performans ölçülür):** 50 modülde yatay kaymalı tek modül düzenlemesinde `computeModuleIntrinsicSignature` önbellek hızlandırması (`performance-profiling`, `v92`, `v12`).

* \[x\] **Senaryo 10 (Masaüstü, tablet ve mobil etkileşimler doğrulanır):** `<1024px` ve `<1200px` çakışmasız çekmece kuralları, `PointerEvent` bölünmüş ekran ayırıcısı ve `OnObjectQuickToolbar` (`v11`, `v12`).

#### 4.2 Açık Kullanıcı / Fabrika Onayı Bekleyen Canlı Ortam Adımları (`[UNVERIFIED]` Koruma Sınırları)

* \[ \] **\[Canlı Veritabanı Migrasyonu — Onay Gerekli\]:** `supabase/migrations/20261118160000_fix_store_erp_rpc_contracts.sql` dosyasının önce staging veritabanında denenmesi ve açık onay sonrası canlı Supabase ortamına uygulanması.

* \[ \] **\[Fiziksel CNC Deneme Kesimi — `GATE_06`\]:** Homag WoodWOP `.MPR`, Biesse `.CIX` ve Selco WNT 600 `.CSV` çıktılarından bir örnek dolabın fabrikada fiziksel deneme kesiminin yapılması ve operatör imzasından sonra `physicalFactorySample` kilidinin açılması.

* \[ \] **\[Özel Kulp Cep Freze ve Kavisli Tambur Kalıp Kalibrasyonu\]:** Üretici onaylı kulp cep freze şablonları ve `kerf_curve` kalıp pres yarıçapları fabrika tarafından onaylanana kadar `requiresFactoryValidation` uyarısının korunması.