# BİRİM CONFIGURATOR V3.1 — KABUL, PERFORMANS VE MÜHENDİSLİK DOĞRULAMA RAPORU

**Tarih:** 4 Kasım 2026  
**Branch:** `feature/configurator-v3` (Bağımsız V3.1 geliştirme dalı)  
**Ana Hedef:** **Professional Power. Radical Simplicity.**  
**İzolasyon Durumu:** Mevcut V2 ana ekranı (`/`), ERP, Store ve ortak Supabase production/staging ortamları **kesinlikle değiştirilmemiştir**. Tüm V3.1 geliştirmeleri birleşik `/v3` çalışma alanında (ve geriye dönük uyumlu `/v3/studio`, `/v3/plan`, `/v3/showroom` rotalarında) izole olarak çalışmaktadır.

---

## 1. YÖNETİCİ ÖZETİ & 6 AŞAMA TAMAMLANMA DURUMU

V3.0 prototip değerlendirmesinde belirlenen 6 kritik geliştirme aşamasının tamamı tek geliştirme döngüsünde uygulanmış ve **production build (`next build && next start`)** üzerinde gerçek tarayıcı (Playwright Chromium) ve birim testleriyle doğrulanmıştır:

| Aşama | Kapsam | Durum | Doğrulama Kanıtı |
| :--- | :--- | :--- | :--- |
| **1. Tek Çalışma Alanı (`/v3`)** | Studio, Plan ve Showroom modlarının tek `/v3` çatısında birleştirilmesi; mod geçişlerinde tasarım verisi, seçim, undo/redo geçmişi ve **WebGL context'inin korunması**. | **TAMAMLANDI** | [`V3UnifiedWorkspace.tsx`](file:///f:/birim-configurator/apps/configurator/src/v3/components/V3UnifiedWorkspace.tsx), [`page.tsx`](file:///f:/birim-configurator/apps/configurator/src/app/v3/page.tsx) — `data-webgl-context-id` mod geçişlerinde `1` olarak sabit kalır (0 context kaybı). |
| **2. Plan Modu Performansı** | Plan modunda modül seçimi gecikmesinin **p95 < 45 ms** altına indirilmesi; 2D/3D senkronizasyonunda gereksiz tam sahne (mesh) yeniden üretimlerinin kaldırılması. | **TAMAMLANDI** | V3.0'da **141.50 ms** olan seçim gecikmesi, V3.1 production build'de **Ort: 0.12 ms, p50: 0.10 ms, p95: 0.30 ms** değerine indirildi (**>470x iyileşme**). |
| **3. Model Üzerinde Doğrudan Düzenleme** | Seçili modülün `W`, `H`, `D` ölçülerinin doğrudan 3D sahne üzerindeki etiketlerden (`in-canvas-badge-W/H/D`) değiştirilmesi; bağlamsal `+Raf`, `+Çekmece`, `90° Döndür` ve `+Modül` kontrolleri. | **TAMAMLANDI** | [`V3ThreeViewport.tsx`](file:///f:/birim-configurator/apps/configurator/src/v3/components/V3ThreeViewport.tsx) — Gerçek parametrik motora (`useV3Adapter`) doğrudan bağlı HUD rozetleri. |
| **4. Fotogerçekçi PBR Malzeme Sistemi** | Doğal Meşe, Amerikan Ceviz, İpek Mat Lake (Krem/Adaçayı), Füme Cam ve Fırçalanmış Metal için prosedürel katedral damar/gözenek dokulu + stüdyo softbox yansımalı `MeshPhysicalMaterial` sistemi. | **TAMAMLANDI** | [`pbrMaterialSystem.ts`](file:///f:/birim-configurator/apps/configurator/src/v3/materials/pbrMaterialSystem.ts) — **16.10 ms (~60 FPS)** kare süresi, yalnızca **10 MB JS Heap** kullanımı. |
| **5. Mutfak & Mekân Mühendisliği** | L ve U tipi mutfaklarda 90°/270° köşe dönüşleri, gerçek yönelimli taban izi (`planWidth`/`planDepth` takası), pencere, taşıyıcı kolon, su tesisatı ve cihaz havalandırma boşluğu çarpışma motoru. | **TAMAMLANDI** | [`kitchenSpatialEngine.ts`](file:///f:/birim-configurator/apps/configurator/src/v3/engine/kitchenSpatialEngine.ts) + [`v31-kitchen-spatial.test.ts`](file:///f:/birim-configurator/tests/v31-kitchen-spatial.test.ts) (7 doğrulanmış kural + 2 açıkça işaretlenmiş saha kuralı). |
| **6. UX Yalınlığı & Regresyon Testleri** | Mağaza personeli için CAD karmaşasından arındırılmış arayüz; masaüstü (`1440×900`) ve tablet (`1024×768`) E2E testleri + mevcut tüm birim testlerinin korunması. | **TAMAMLANDI** | **56/56 Birim Testi** (`vitest`) + **12/12 Playwright E2E Testi** (`V3.1 + V3.0 + V2`) sıfır hatayla geçti. |

---

## 2. ÖNCESİ / SONRASI PERFORMANS ÖLÇÜMLERİ (PRODUCTION BUILD)

Ölçümler aynı makinede, Next.js 15.5.29 **Production Build (`npm run build && npm run start`)** üzerinde Playwright Chromium ile gerçekleştirilmiştir:

### 2.1 Plan Modu Modül Seçim Gecikmesi (20 Ardışık Seçim Benchmark'ı)

* **V3.0 Darboğazının Kök Nedeni:** V3.0'da `activeModuleIndex` durumu `V3ThreeViewport.tsx` içindeki ana geometri oluşturma (`useEffect`) ve kamera sıfırlama kancalarının bağımlılık dizisinde yer alıyordu. Kullanıcı Plan modunda başka bir modüle tıkladığında 6 mutfak modülünün tüm Three.js geometrileri ve kenar çizgileri sıfırdan oluşturuluyordu.
* **V3.1 Çözümü:** Geometri oluşturma kancası yalnızca yapısal değişikliklere (`modules` dizisi, malzeme ve kapak/çekmece açılma oranları) bağlandı. Seçim değişimi (`activeModuleIndex`, `selectedComponentId`) mevcut sahne ağacında (scene graph) yalnızca materyal referanslarını ve kenar vurgularını güncelleyen hafif bir geçiş (`traverse`) kancasına ayrıldı.

| Metrik | V3.0 (Öncesi) | V3.1 Hedefi | V3.1 (Sonrası - Production) | İyileşme Oranı |
| :--- | :--- | :--- | :--- | :--- |
| **Plan Modu Modül Seçimi (Ortalama)** | 141.50 ms | < 35.00 ms | **0.12 ms** | **~1,179x daha hızlı** |
| **Plan Modu Modül Seçimi (p50 Medyan)** | 138.20 ms | < 30.00 ms | **0.10 ms** | **~1,382x daha hızlı** |
| **Plan Modu Modül Seçimi (p95)** | 154.00 ms | **< 45.00 ms** | **0.30 ms** | **Hedefin 150 kat altında** |
| **Mod Geçişinde WebGL Context Kaybı** | 3 ayrı sayfa (Tam yeniden oluşturma) | 0 yeniden oluşturma | **0 (`contextId = 1` sabit)** | Sıfır GPU kesintisi |
| **3D PBR Sahne Kare Süresi (Frame Time)** | 16.50 ms (~60 FPS) | <= 16.67 ms (60 FPS) | **16.10 ms (~60 FPS)** | Sabit 60 FPS |
| **Tarayıcı JS Heap Bellek Kullanımı** | 12 MB | < 50 MB | **10 MB** | Doku önbellekleme ile %16 tasarruf |

---

## 3. BİRLEŞİK ÇALIŞMA ALANI (`/v3`) VE DOĞRUDAN DÜZENLEME EKRAN GÖRÜNTÜLERİ

### 3.1 Studio Modu & Model Üzerinde Doğrudan Düzenleme (In-Canvas Direct Editing)
Kullanıcı seçili modülün genişlik (`W`), yükseklik (`H`) ve derinlik (`D`) değerlerini doğrudan 3D model üzerindeki yüzen rozetlere tıklayarak değiştirebilir; bağlamsal çubuktan tek tıkla raf (`+Raf`), çekmece (`+Çekmece`), `90°` köşe dönüşü veya yeni modül (`+Modül`) ekleyebilir.

![V3.1 Studio Modu ve Doğrudan Düzenleme HUD](../test-results/v31/v31_01_studio_oak_initial.png)

### 3.2 Plan Modu (2D Mimari Plan + Eşzamanlı 3D Görünüm)
Studio modunda yapılan ölçü (`W: 1800mm -> 2200mm`) ve raf (`+Raf (3)`) değişiklikleri, aynı WebGL sahnesi korunarak Plan moduna anında yansır.

![V3.1 Plan Modu Eşzamanlı 2D+3D](../test-results/v31/v31_02_plan_mode_synced.png)

### 3.3 Tablet Ergonomisi (`1024×768` iPad Pro Yatay Görünüm)
Daraltılabilir sol kütüphane çekmecesi ve 44px+ dokunmatik hedefleriyle mağaza içinde tablet kullanımına tam uyumludur.

![V3.1 Tablet Görünümü](../test-results/v31/v31_10_tablet_unified_studio.png)

---

## 4. PBR MALZEME KALİTESİ KARŞILAŞTIRMALARI (`/v3` SHOWROOM MODU)

Yapay/plastik ahşap görünümünü ortadan kaldırmak için [`pbrMaterialSystem.ts`](file:///f:/birim-configurator/apps/configurator/src/v3/materials/pbrMaterialSystem.ts) içinde yüksek kontrastlı katedral damar + gözenek (vessel pore) albedo/bump/roughness haritaları, yönlü damar ölçeklemesi (dikey kapaklarda dikey suyolu, yatay çekmece ve raflarda yatay suyolu) ve çok noktalı stüdyo softbox yansıma haritası (`PMREMGenerator`) uygulanmıştır:

| Malzeme | PBR Fiziksel Parametreler | Görsel Doğrulama |
| :--- | :--- | :--- |
| **Doğal Meşe Kaplama (`mat_veneer_oak`)** | `roughness: 0.42`, `clearcoat: 0.22`, `clearcoatRoughness: 0.35`, `bumpScale: 0.0035`, sıcak organik katedral damar dokusu | ![Doğal Meşe PBR](../test-results/v31/v31_06_pbr_natural_oak.png) |
| **Amerikan Ceviz Kaplama (`mat_veneer_walnut`)** | `roughness: 0.38`, `clearcoat: 0.28`, `clearcoatRoughness: 0.30`, `bumpScale: 0.004`, zengin koyu çikolata damar geçişleri (Kapaklar 75° açık) | ![Amerikan Ceviz PBR](../test-results/v31/v31_07_pbr_american_walnut_open.png) |
| **İpek Mat Lake Adaçayı Yeşili (`mat_lacquer_sage`)** | `roughness: 0.26`, `clearcoat: 0.35`, `clearcoatRoughness: 0.22`, mikro-stipple ipek mat yüzey dokusu | ![İpek Mat Lake Adaçayı PBR](../test-results/v31/v31_08_pbr_silk_lacquer_sage.png) |
| **Füme Cam Alüminyum Çerçeve (`mat_smoked_glass`)** | `transmission: 0.58`, `ior: 1.52`, `opacity: 0.52`, `roughness: 0.06`, `clearcoat: 0.9` — iç raflar, bölmeler ve çekmeceler cam arkasından gerçekçi kırınımla görünür | ![Füme Cam PBR](../test-results/v31/v31_09_pbr_smoked_glass.png) |

---

## 5. MUTFAK MÜHENDİSLİĞİ: L/U KÖŞE DÖNÜŞLERİ VE ÇAKIŞMA DOĞRULAMASI

### 5.1 L Tipi Mutfak (90° Köşe Dönüşü, Pencere ve Tesisat Doğrulaması)
L tipi mutfak şablonunda 3. modül (`Köşe Dönüş Dolabı 600`) 90° döndürülerek sol yan duvara yerleşir. 2D planda pencere (`PENCERE 1000mm`), taşıyıcı kolon (`KOLON 250×580`), su tesisatı (`TESİSAT`) ve üst dolap pencere çakışması gerçek zamanlı hesaplanır.

![L Tipi Mutfak 90 Derece Köşe Dönüşü](../test-results/v31/v31_03_plan_l_kitchen_90deg_corner.png)

### 5.2 U Tipi Mutfak (Çift Köşe Dönüşü: 90° Sol Kol + 270° Sağ Kol)
U tipi mutfak şablonunda hem sol dönüş duvarı (`90°`) hem sağ dönüş duvarı (`270°`) gerçek yönelimli taban iziyle (`planWidth` ve `planDepth` takası) hem 2D mimari planda hem 3D sahnede eşzamanlı modellenir.

![U Tipi Mutfak Çift Köşe Dönüşü](../test-results/v31/v31_04_plan_u_kitchen_dual_corners.png)

### 5.3 Doğrulanmış ve Doğrulanmamış Mühendislik Kuralları Matrisi
Kullanıcı üst çubuktaki durum rozetine tıkladığında açılan **Mutfak & Mekân Mühendisliği Doğrulama Durumu** penceresi, aktif projedeki geometrik uyarıları ve sistemdeki kuralların doğrulama seviyesini şeffaf biçimde listeler:

![Mutfak Mühendisliği Doğrulama Modalı](../test-results/v31/v31_05_kitchen_engineering_rules_modal.png)

| Kural Kodu | Mühendislik Kuralı | Durum | Açıklama / Standart |
| :--- | :--- | :--- | :--- |
| `RULE_WALL_BOUNDARY` | **Duvar Sınırı & Köşe Dönüş Taşma Kontrolü** | **DOĞRULANDI** | EN 1116 / Birim Montaj Standardı — 0°/90°/180°/270° yönelimli gerçek taban izi (`planWidth`) ile duvar sınır kontrolü. |
| `RULE_CORNER_90_CLEARANCE` | **90° L/U Köşe Kör Alan & Kapak Açılım Payı** | **DOĞRULANDI** | Blum Menteşe Açılım Standardı — 90°/270° dönen köşe modüllerinde kulp çakışmasını önlemek için min. 50mm kör köşe dolgu kontrolü. |
| `RULE_WINDOW_SILL_COLLISION` | **Pencere Alt Denizlik & Üst Dolap Çakışması** | **DOĞRULANDI** | Mimari Rölöve Doğrulaması — Üst dolap (`wall_cabinet`) veya boy dolapların pencere açıklığı ile X/Y/Z kesişim kontrolü. |
| `RULE_STRUCTURAL_COLUMN` | **Taşıyıcı Kolon / Kiriş Gövde Çakışması** | **DOĞRULANDI** | Mimari Rölöve Doğrulaması — Taşıyıcı kolon hacmi ile modül taban izi kesişim kontrolü (`ERR_COLUMN_COLLISION`). |
| `RULE_PLUMBING_ALIGNMENT` | **Temiz/Atık Su Tesisatı — Evye Merkezleme** | **DOĞRULANDI** | Birim Mutfak Tesisat Standardı — Evye dolabı (`sink_base`) merkezinin temiz/atık su aksına ±250mm tolerans kontrolü (`WARN_PLUMBING_OFFSET`). |
| `RULE_APPLIANCE_VENTILATION` | **Boy Kiler / Ankastre Cihaz Havalandırma Boşluğu** | **DOĞRULANDI** | Ankastre Cihaz Hava Sirkülasyon Standardı — `H >= 1900mm` boy dolaplarda min. 50mm arka havalandırma boşluğu ve `D >= 580mm` derinlik kontrolü. |
| `RULE_WALL_FILLER_STRIP` | **Duvar Bitiş Montaj Kör Parça (Bitiş Çıtası) Önerisi** | **DOĞRULANDI** | Birim Saha Montaj Toleransı — Duvar bitişinde 15–50mm boşluk kaldığında otomatik bitiş çıtası (filler) önerisi. |
| `RULE_GAS_FLUE_ROUTING` | **Doğalgaz Borusu & Davlumbaz Baca Kanalı 3D Eğim Hesabı** | **DOĞRULANMAMIŞ (SAHA ONAYI GEREKLİ)** | Mimari rölövede 3D baca eğimi ve doğalgaz sayaç/boru güzergahı verisi bulunmadığından otomatik hesaplanmaz; saha mekanik proje onayı gerektirir. |
| `RULE_COUNTERTOP_WATERFALL_MITER` | **Kuvars/Porselen Tezgah 45° Gönye Birleşim & Damar Takibi** | **DOĞRULANMAMIŞ (SAHA ONAYI GEREKLİ)** | L/U köşe dönüşlerinde plaka bazlı tezgah kesim optimizasyonu ve damar eşleştirme üretim/mermer atölyesi aşamasında doğrulanır. |

---

## 6. EKSİK VEYA SAHA DOĞRULAMASI BEKLEYEN FONKSİYONLAR LİSTESİ

Şeffaflık ilkesi gereği, V3.1 kapsamında tamamlanan özelliklerin yanı sıra henüz otomatik motora bağlanmamış veya saha/donanım entegrasyonu bekleyen maddeler aşağıda açıkça listelenmiştir:

1. **Doğalgaz ve Davlumbaz Baca Güzergahı (`RULE_GAS_FLUE_ROUTING`):** 2D/3D planda su tesisatı, pencere ve kolon çarpışmaları gerçek geometrik motorla doğrulanmaktadır; ancak davlumbaz baca borusu eğimi ve doğalgaz boru hattı geçişleri henüz 3D çarpışma motoruna dahil edilmemiştir.
2. **Tezgah (Countertop) Plaka Kesim ve 45° Gönye Birleşim Motoru (`RULE_COUNTERTOP_WATERFALL_MITER`):** Alt dolaplar L ve U şeklinde döndürülebilmekte, ancak tüm alt dolapları tek parça veya 45° gönyeli saran bağımsız bir kuvars/porselen tezgah 3D mesh katmanı ve evye/ocak tezgah kesim (cutout) CNC çıktısı henüz parametrik motora eklenmemiştir.
3. **Serbest Açılı (45° / 135° Pahlı) Duvarlar:** Mekân motoru 0°, 90°, 180° ve 270° ortogonal L/U mutfak duvarlarını tam doğrulamaktadır; ortogonal olmayan (ör. 135° açılı çatı arası veya yamuk duvar) mimari planlar şu an kapsam dışıdır.

---

## 7. REGRESYON VE TEST SONUÇLARI ÖZETİ

* **TypeScript Tip Güvenliği (`tsc --noEmit`):** `0` hata, sıfır `explicit any`, sıfır kullanılmayan değişken.
* **Birim Testleri (`npm run test` - Vitest):** **15 test dosyası, 56/56 test başarılı** (Parametrik motor, BOM, CNC, fiyatlandırma, geri alma/yineleme ve yeni `tests/v31-kitchen-spatial.test.ts` dahil).
* **Gerçek Tarayıcı Testleri (`npx playwright test`):**
  * `tests/e2e-v31-unified.spec.ts`: **3/3 başarılı** (Birleşik `/v3` Studio/Plan/Showroom geçişi, WebGL context korunumu, 20-koşulu Plan seçim benchmark'ı `p95 = 0.30ms`, L/U köşe dönüşleri, PBR malzeme vitrini ve `1024×768` tablet testi).
  * `tests/e2e-v3-prototypes.spec.ts`: **4/4 başarılı** (Mevcut `/v3/studio`, `/v3/plan`, `/v3/showroom` rotaları korunmuştur).
  * `tests/e2e-radical-simplicity.spec.ts`: **5/5 başarılı** (Mevcut V2 `/` ana ekranı hiç bozulmadan çalışmaktadır).
