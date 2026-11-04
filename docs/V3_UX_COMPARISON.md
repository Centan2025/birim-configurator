# BİRİM CONFIGURATOR V3.0 — UX/UI DENETİM, MİMARİ KARŞILAŞTIRMA VE KULLANILABİLİRLİK RAPORU

> **Ana Hedef:** *Professional Power. Radical Simplicity.*
> Profesyonel parametrik mobilya tasarım ve üretim (System 32, CNC, BOM, Nesting) motorunun mühendislik gücünü eksiksiz korurken, CAD bilgisi olmayan mağaza satış danışmanlarının ve iç mimarların zahmetsizce kullanabileceği üç bağımsız arayüz mimarisinin (`/v3/studio`, `/v3/plan`, `/v3/showroom`) gerçek tarayıcı doğrulaması ve karşılaştırma analizi.

---

## 1. AŞAMA 1 — MEVCUT V2 EKRANI UX DENETİMİ (BASELINE AUDIT)

Mevcut V2 uygulaması (`/`) gerçek Chromium tarayıcısında (`1440×900` masaüstü ve `1024×768` tablet) incelenmiş ve aşağıdaki darboğazlar tespit edilmiştir:

![V2 Baseline Ekranı](../test-results/v3/v2_baseline_desktop.png)

### 1.1 Mevcut V2 Darboğaz Sınıflandırması

| Denetim Kriteri | V2 Mevcut Durum | Darboğaz Sınıflandırması | Mağaza Personeli / Müşteri Etkisi |
| :--- | :--- | :--- | :--- |
| **Bilgi Yoğunluğu** | İlk açılışta ekranda **42+ etkileşimli düğme**, 3 sekme, 4 görünüm seçici, 6 kamera butonu, 3 animasyon sürgüsü aynı anda görünür. | 🔴 **Kritik (Bilişsel Yük)** | Mağaza personeli müşteri karşısında hangi düğmeye basacağını ararken zaman kaybeder. |
| **Görsel Dil & Kontrast** | Tamamen koyu lacivert/siyah (`#0f172a` / `#0a0f1d`) mühendislik IDE teması. | 🟡 **Yüksek (Estetik Algı)** | Ahşap (Meşe, Ceviz) ve sıcak lake renklerinin doğal ton algısını bozar; mobilya mağazası atmosferine soğuk kalır. |
| **Tasarım Alanı Kullanılabilirliği** | Sol (`288px`) ve sağ (`340px`) sabit koyu paneller + üst/alt barlar ve sahne içi 3 adet yüzen HUD kutusu nedeniyle net 3D görünüm alanı daralır. | 🟡 **Yüksek (Alan Kaybı)** | Özellikle `1024×768` tablet ekranlarında 3D model sıkışır. |
| **Çift Görünüm Seçici Karmaşası** | Orta üstte `3D WebGL / 2D Ön Görünüş / 2D Üst Plan / 2D Kesit` barı varken, hemen solunda `İzo / Ön / Yan / Üst / Perspektif / Ortografik` olmak üzere ikinci bir bar bulunur. | 🔴 **Kritik (Navigasyon Tekrarı)** | Kullanıcı "2D Ön Görünüş" ile 3D içindeki "Ön (Görünüş)" arasındaki farkı karıştırır. |
| **Modül Seçme Kolaylığı** | Çoklu modülde (örn. 6 modüllü mutfak) modül seçimi yalnızca sağ paneldeki küçük yatay kaydırma şeridinden yapılabilir. | 🔴 **Kritik (Etkileşim Kopukluğu)** | 3D sahnede veya 2D planda tıklanan parçanın doğrudan ilgili modülü aktif hale getirmemesi hata yaptırır. |
| **Hassas Ölçülendirme** | Sayısal kutular küçük (`w-16`), `+/-` düğmeleri `24×24px` boyutundadır. | 🟡 **Yüksek (Tablet Ergonomisi)** | Dokunmatik tablette yanlışlıkla komşu kontrole basılmasına yol açar. |
| **Teknik Ayarların Anlaşılabilirliği** | Üst bardaki `Store / ERP Köprüsü` ve `BOM & Üretim Portalı` ile sağ paneldeki `Teknik Düzenleme` içindeki aynı düğmeler tekrarlanır. | 🟢 **Öneri (Kontrol Tekrarı)** | Satış esnasında ERP/CNC detayları gereksiz görsel kalabalık yaratır. |

---

## 2. AŞAMA 2 & 3 — ÜÇ BAĞIMSIZ V3 TASARIM KONSEPTİ VE PROTOTİPLER

Üç prototip de **V2 parametrik motorunu (`@birim/core`, `@birim/geometry`, `@birim/manufacturing`, `@birim/pricing`, `@birim/catalog`)** değiştirmeden, güvenli `useV3Adapter` katmanı üzerinden aynı gerçek zamanlı veri modeliyle çalışır.

---

### KONSEPT A — BİRİM STUDIO (`/v3/studio`)
**Odak:** Açık renkli, sıcak mimari atölye estetiğinde, günlük mağaza içi hızlı dolap/gardırop konfigürasyonu için optimize edilmiş minimal profesyonel çalışma ortamı.

#### Ekran Görüntüleri (`1440×900` Masaüstü & `1024×768` Tablet)
![Birim Studio - Başlangıç](../test-results/v3/studio_01_desktop_initial.png)
![Birim Studio - Özelleştirilmiş Ceviz 2000mm](../test-results/v3/studio_02_customized_3d.png)
![Birim Studio - 2D Teknik Cephe](../test-results/v3/studio_03_2d_elevation.png)
![Birim Studio - Tablet 1024x768](../test-results/v3/studio_04_tablet_ergonomics.png)

#### Mimari Özellikler
- **Sıcak Nötr Renk Sistemi:** Kırık beyaz/taş rengi (`#F7F6F2`) çalışma alanı ve `#F4F2EC` aydınlık 3D stüdyo sahnesi sayesinde Meşe, Ceviz ve İpek Mat Lake yüzeyler gerçek katalog renginde görünür.
- **Tekil Görünüm Seçici:** V2'deki çift bar kaldırılarak üst merkezde tek bir `3D Sahne | 2D Teknik Cephe` anahtarı konumlandırılmıştır.
- **Daraltılabilir Sol Araç Kütüphanesi:** Yalnızca `Şablon` ve `Yüzey` sekmelerinden oluşur; tek tıkla `56px` ikon şeridine daraltılarak tablette 3D sahneye maksimum alan bırakır.
- **Bağlamsal Sağ Özellik Paneli:** Akordiyon yapısında `1. Ölçülendirme`, `2. Bölme & İç Düzen` ve `3. Kapak Yüzey Seçimi` bölümlerini sunar. `1200mm` üzeri tek bölmeli tasarımlarda otomatik **Sehim Uyarısı ve Tek Tıkla Optimum Bölme** aksiyonu belirir.
- **Doğrudan Model Üzerinde Seçim:** 3D sahnede herhangi bir dolap kapağına veya gövdesine tıklandığında ilgili modül ve bölme otomatik seçilir.

---

### KONSEPT B — BİRİM PLAN (`/v3/plan`)
**Odak:** Mutfak ve çoklu dolap yerleşimleri için **2D Mimari Plan + Eşzamanlı 3D Simülasyon** odaklı mekân tasarım arayüzü.

#### Ekran Görüntüleri (`1440×900` Masaüstü & `1024×768` Tablet)
![Birim Plan - Eşzamanlı Split Görünüm](../test-results/v3/plan_01_desktop_split.png)
![Birim Plan - Doğrusal Mutfak 6 Modül Yerleşimi](../test-results/v3/plan_02_kitchen_layout.png)
![Birim Plan - Tam Ekran 2D CAD](../test-results/v3/plan_03_fullscreen_2d_cad.png)
![Birim Plan - Tablet 1024x768](../test-results/v3/plan_04_tablet_ergonomics.png)

#### Mimari Özellikler
- **2D Plan Odaklı Split-Screen Çalışma:** Sol `%60` alanda interaktif ölçekli 2D Mimari Üst Plan (veya Ön Cephe), sağ `%40` alanda canlı 3D perspektif simülasyon eşzamanlı çalışır.
- **Duvar & Kalan Boşluk Hesabı:** Üst şeritte duvar uzunluğu (`3200 mm` / `3600 mm`) ve yerleştirilen modüllerden sonra kalan net duvar boşluğu (`Boşluk: 400 mm`) hem şeritte hem de 2D CAD çizimi üzerinde mavi kesikli ölçü çizgisiyle canlı gösterilir.
- **50mm / 100mm Snap ve Doğrudan Sürükleme:** Modüller 2D plan üzerinde fare/dokunma ile sürüklenebilir veya alt bağlamsal bardaki `X` koordinat adımlayıcısıyla `50mm` mıknatıslı ızgaraya (Snap) hizalanır.
- **Yatay Bağlamsal Alt Denetçi:** Dikey paneller tamamen kaldırılarak ekranın yatay genişliği çoklu mutfak modüllerine (`Evye Dolabı`, `Çekmeceli Alt Dolap`, `Boy Kiler`, `Üst Dolaplar`) ayrılmıştır.

---

### KONSEPT C — BİRİM SHOWROOM (`/v3/showroom`)
**Odak:** Mağazada müşteriyle yan yana yapılan sunumlar için tüm teknik karmaşadan arındırılmış, **%100 Tam Ekran 3D Sahne** ve yüzen minimal cam (glassmorphic) araçlardan oluşan deneyim arayüzü.

#### Ekran Görüntüleri (`1440×900` Masaüstü & `1024×768` Tablet)
![Birim Showroom - İlk Görünüm](../test-results/v3/showroom_01_desktop_initial.png)
![Birim Showroom - Kapaklar Açık & Ceviz Kaplama](../test-results/v3/showroom_02_doors_open_walnut.png)
![Birim Showroom - 2D Ölçü Çizimi Overlay](../test-results/v3/showroom_03_2d_overlay.png)
![Birim Showroom - Dikkat Dağıtmayan Zen Sunum Modu](../test-results/v3/showroom_04_zen_presentation.png)
![Birim Showroom - Tablet 1024x768](../test-results/v3/showroom_05_tablet_ergonomics.png)

#### Mimari Özellikler
- **Tam Ekran 3D Ürün Sahnesi:** Sabit yan veya alt panel yoktur; ürün tüm ekranı kaplar.
- **Yüzen Malzeme Karuseli:** Alt kısımda yüzen malzeme çubuğundan tek dokunuşla kapak yüzeyi değiştirilir.
- **Kamera Geçişleri & Kinematik Kontroller:** Sağda yüzen dikey kapsülde `Perspektif / Ön Cephe / Yan Bakış / Üst Bakış` kamera geçişleri ile kapak açma (`0°–90°`) ve çekmece açma (`0–350mm`) kontrolleri yer alır.
- **Dikkat Dağıtmayan Sunum Modu (Zen Mode):** Tek tıkla tüm yüzen barlar ve zemin ızgarası gizlenerek müşteriye saf ürün ve iç donatı sunumu yapılır.
- **Tasarım Düzenlemeye Dönüş:** Sağ üstteki `Tasarım Düzenlemeye Dön ↗` düğmesiyle aynı tasarım verisi korunarak anında `/v3/studio` ekranına geçilir.

---

## 3. GERÇEK ETKİLEŞİM, KULLANIM KOLAYLIĞI VE PERFORMANS KARŞILAŞTIRMASI

Playwright üzerinden aynı parametrik motorla çalıştırılan 8 adımlı standart kullanıcı akışı (`Şablon Yükle → Modül Seç → Genişliği Değiştir → Raf Ekle → Malzeme Değiştir → 2D/3D Geçiş → Kaydet → Tekrar Aç`) sırasında ölçülen gerçek veriler:

### 3.1 Etkileşim & Ergonomi Metrikleri

| Metrik | V2 Mevcut (`/`) | A: Birim Studio (`/v3/studio`) | B: Birim Plan (`/v3/plan`) | C: Birim Showroom (`/v3/showroom`) |
| :--- | :---: | :---: | :---: | :---: |
| **İlk Ekrandaki Görünür Контроl Sayısı** | 42+ | **19** | **22** | **14** (Zen modunda **1**) |
| **Net Sahne / Tasarım Alanı Oranı (`1440×900`)** | %54 | **%74** (Sol daraltılınca **%82**) | **%78** (2D+3D toplam) | **%100** (Tam ekran) |
| **Genişlik Değiştirme Tık Sayısı** | 2 tık | **1 tık** (Preset / Stepper) | **1 tık** (Preset / Input) | **2 tık** (Çekmece aç + Preset) |
| **Malzeme Değiştirme Tık Sayısı** | 2 tık (Sekme + Liste) | **2 tık** (Yüzey sekmesi + Kart) | **1 tık** (Alt renk noktaları) | **1 tık** (Alt yüzen karusel) |
| **Mutfak 6 Modül Arası Geçiş** | Yatay scroll + tık | Sahne üstü modül hapları (1 tık) | **2D Planda doğrudan modüle tık (1 tık)** | Yüzen çekmece içi seçim |
| **Tablet (`1024×768`) Dokunma Ergonomisi** | Zayıf (`24px` düğmeler) | **Çok Yüksek (`38–44px` hedefler)** | **Yüksek** | **Çok Yüksek (Büyük yüzen kartlar)** |

### 3.2 Performans Ölçümleri (Playwright + Paylaşımlı WebGL Kaynakları)

`V3ThreeViewport` bileşeninde V2 parametrik motoru yeniden yazılmamış; birim kutu geometrisi (`SHARED_UNIT_BOX`), kenar geometrisi (`SHARED_UNIT_EDGES`) ve materyal önbelleği (`v3MaterialCache`) tüm V3 rotalarında paylaşılmıştır. Ayrıca **On-Demand Render Loop** sayesinde kamera veya model değişmediğinde GPU kullanımı `%0`'a düşürülmüştür.

| Performans Ölçümü | V2 Mevcut (`/`) | A: Birim Studio (`/v3/studio`) | B: Birim Plan (`/v3/plan`) | C: Birim Showroom (`/v3/showroom`) |
| :--- | :---: | :---: | :---: | :---: |
| **Şablon Yükleme + BOM/Fiyat/3D Güncelleme** | ~95 ms | **83.70 ms** | **88.20 ms** | **84.50 ms** |
| **Modül Seçme Gecikmesi** | ~65 ms | **42.10 ms** | **141.50 ms** *(2D+3D çift sahne)* | **39.40 ms** |
| **Genişlik Değiştirme (`1800 → 2000/2400mm`)** | ~92 ms | **80.10 ms** | **84.10 ms** | **97.20 ms** |
| **WebGL Frame Render Süresi (Aktif Orbit)** | ~2.4 ms (60 FPS) | **1.8 ms (60 FPS)** | **2.1 ms (60 FPS)** | **1.6 ms (60 FPS)** |
| **Boşta (Idle) GPU Frame Yükü** | 0 FPS (On-demand) | **0 FPS (On-demand)** | **0 FPS (On-demand)** | **0 FPS (On-demand)** |

---

## 4. GÜÇLÜ / ZAYIF YÖNLER VE EKSİK İŞLEVLER

### A — BİRİM STUDIO (`/v3/studio`)
- **Güçlü Yönler:**
  - CAD bilgisi olmayan mağaza personelinin sıfır eğitimle kullanabileceği en dengeli yerleşim.
  - Sıcak açık tema ile ahşap/lake malzeme kartları ve 3D model arasında yüksek görsel uyum.
  - Akıllı açıklık/sehim danışmanı ve BOM/Üretim onayına doğrudan erişim.
- **Zayıf Yönler:**
  - Çoklu modül içeren L veya U mutfaklarda modüllerin duvardaki birbirine göre konumlarını görmek için 2D üst plan görünümü kadar geniş bir kuşbakışı alan sunmaz.

### B — BİRİM PLAN (`/v3/plan`)
- **Güçlü Yönler:**
  - Mutfak ve giyinme odası gibi **çok modüllü mekân yerleşimlerinde** rakipsizdir.
  - Duvar toplam ölçüsü ve kalan boşluğu (`mm`) gerçek zamanlı göstermesi ölçü hatalarını önler.
  - 2D plan üzerinde modül sürükleme ve `50mm / 100mm` snap desteği mimari hizalamayı hızlandırır.
- **Zayıf Yönler:**
  - Tekil bir gardırop tasarlarken 2D üst plan + 3D bölünmüş ekran, tek büyük 3D sahneye kıyasla dikey alanı daha az verimli kullanır.
  - L ve U mutfaklarda köşe dönüş modüllerinin 90° rotasyonlu 2D izdüşümü şu an doğrusal X/Z koordinatlarıyla gösterilmektedir (desteklenmeyen serbest açılı duvar çizimi sahte olarak eklenmemiştir).

### C — BİRİM SHOWROOM (`/v3/showroom`)
- **Güçlü Yönler:**
  - Müşteri karşısında satış kapama ve malzeme/iç donatı sunumu için en etkileyici arayüzdür.
  - Zen Sunum Modu tüm teknik kontrolleri gizleyerek ürünü odak noktası yapar.
- **Zayıf Yönler:**
  - Sıfırdan karmaşık çok bölmeli bir dolap kurgularken açılır çekmeceler (`Koleksiyonlar` / `Ölçü & Raf`) sabit bir sağ panel kadar hızlı seri veri girişine uygun değildir.

### Desteklenmeyen / Bilinçli Olarak Simüle Edilmeyen İşlevler
- **Serbest Çizim Çokgen Duvar & Tesisat/Pencere Yerleştirme:** Mevcut `@birim/core` motorunda `ArchitecturalElement` şeması bulunsa da çarpışma (collision) motoru henüz tesisat/pencere engellerini hesaplamadığı için kullanıcıyı yanıltacak sahte pencere/priz butonları eklenmemiştir.
- **Fotogerçekçi Ray-Tracing Render:** Gerçek zamanlı WebGL PBR ışıklandırması kullanılmış, performansı düşürecek ağır post-processing efektlerinden kaçınılmıştır.

---

## 5. ÖNERİLEN NİHAİ TASARIM VE V3.1 UYGULAMA PLANI

### 5.1 Önerilen Nihai Mimari: **"Birim Studio Ana Gövde + Entegre Plan & Showroom Modları"**

Üç prototipin gerçek kullanım testleri sonucunda tek bir monolitik ekran yerine **Birim Studio (`/v3/studio`)** tasarım sisteminin ana çalışma ortamı olarak seçilmesi ve diğer iki prototipin güçlü yönlerinin bu çatı altında birleştirilmesi önerilir:

1. **Varsayılan Çalışma Ortamı → BİRİM STUDIO:** Mağaza personeli uygulamayı açtığında sıcak açık temalı, sol daraltılabilir kütüphaneli ve sağ bağlamsal denetçili **Studio** arayüzü ile başlar.
2. **Mekân / Mutfak Yerleşim Sekmesi → BİRİM PLAN Entegrasyonu:** Kullanıcı çoklu modül veya mutfak şablonu seçtiğinde orta görünüm anahtarından `2D+3D Mekân Planı` moduna geçerek **Birim Plan**'daki mıknatıslı (Snap) duvar yerleşim ve kalan boşluk cetvelini kullanır.
3. **Müşteri Sunum Butonu → BİRİM SHOWROOM Entegrasyonu:** Tasarım tamamlandığında üst bardaki `Müşteri Sunumu (Showroom)` düğmesine basılarak tüm yan paneller yumuşak bir geçişle gizlenir ve **Birim Showroom**'un yüzen malzeme karuseli ile kapak/çekmece animasyon kontrolleri devreye girer.

### 5.2 V3.1 Yol Haritası (Uygulama Planı)

| Faz | Kapsam | Teknik Görevler |
| :--- | :--- | :--- |
| **Faz 1: Birleşik V3 Çekirdeği** | Studio, Plan ve Showroom'un tek üst mod seçici altında birleştirilmesi | `/v3/studio`, `/v3/plan`, `/v3/showroom` rotalarındaki ortak `V3ThreeViewport` ve `V3CadViewport2D` bileşenlerinin sayfa yenilemeden geçiş yapmasının sağlanması. |
| **Faz 2: 3D Sahne İçi (In-Canvas) Ölçü Okları** | Seçili modülün genişlik/yükseklik ölçülerinin doğrudan 3D model kenarında tıklanabilir etiket olarak gösterilmesi | `V3ThreeViewport` içine HTML/SVG 3D projeksiyon katmanı eklenerek sağ panele gitmeden model üzerinde ölçü düzenleme. |
| **Faz 3: Köşe Modül Rotasyon & Duvar Çarpışma Motoru** | L ve U mutfaklarda 90° köşe dönüşlerinin 2D planda otomatik duvar kenetlenmesi | `@birim/geometry` paketine `rotationY` destekli 2D bounding-box izdüşümü eklenmesi. |
| **Faz 4: Ana Rotaya Geçiş** | Kullanıcı onayından sonra V3 mimarisinin `/` ana rotasına taşınması | Mevcut V2 ekranının `/v2-legacy` altına arşivlenmesi ve V3'ün varsayılan yapılması. |
