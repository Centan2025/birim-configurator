# BİRİM CONFIGURATOR V4 — ULUSLARARASI DONANIM ÜRETİCİLERİ VE YAZILIM BENCHMARK ARAŞTIRMASI (`RESEARCH_MANUFACTURERS.md`)

**Tarih:** 4 Kasım 2026  
**Sürüm:** V4.0  
**Durum:** `IMPLEMENTED` / `TESTED` (Faz 01 Tamamlandı)

---

## 1. MİMARİ KARAR: ÜRETİCİ BAĞIMSIZ BİRİM MODÜL STANDARDI

> **Değiştirilemez Mimari Kural:** Birim Configurator bir Blum veya Hettich yazılımı değildir. Birim kendi modül standardının sahibidir. Blum, Hettich, Häfele, Grass, Salice, Hawa ve Sugatsune; belirli mekanizmalar, delik şablonları ve uyumluluk kuralları için teknik veri sağlayıcılarıdır. Bir donanımın markası değiştirildiğinde dolap baştan tasarlanmaz; yalnızca uyumluluk, delik koordinatları, hareket kinematiği, maliyet ve BOM otomatik olarak yeniden hesaplanır.

---

## 2. DONANIM ÜRETİCİLERİ VE TEKNİK EKOSİSTEM PROFİLLERİ

| Üretici ID | Üretici Adı | Ülke | Ana Ürün Aileleri | Delik & Platform Standardı | Resmî Teknik Portal | Doğrulama Durumu |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **`mfr_blum`** | **Julius Blum GmbH** | Avusturya | • **Menteşe:** CLIP top BLUMOTION, CLIP top, MODUL<br>• **Çekmece (Box):** LEGRABOX, MERIVOBOX, TANDEMBOX<br>• **Gizli Ray:** MOVENTO, TANDEM<br>• **Kalkar Kapak:** AVENTOS (HK top, HF top, HL top, HS top, HK-XS)<br>• **Pocket:** REVEGO (*uno* / *duo*) | • Tas delik kalıbı: **$45 \times 9.5\text{ mm}$**, $\varnothing 35 \times 13.0\text{ mm}$ ($155^\circ$'de $11.7\text{ mm}$).<br>• Hareket teknolojileri: BLUMOTION, TIP-ON, TIP-ON BLUMOTION, SERVO-DRIVE.<br>• Veri formatı: BXF (Blum Exchange Format). | https://www.blum.com<br>https://e-services.blum.com | `VERIFIED` |
| **`mfr_hettich`** | **Hettich Holding GmbH & Co. oHG** | Almanya | • **Menteşe:** Sensys, Intermat<br>• **Çekmece (Box):** AvanTech YOU, ArciTech, InnoTech Atira<br>• **Gizli Ray:** Actro 5D, Actro YOU, Quadro YOU<br>• **Katlanır/Sürgülü:** WingLine L, TopLine L / XL | • Tas delik kalıbı: **$52 \times 5.5\text{ mm}$** (TH52), $\varnothing 35 \times 12.8\text{ mm}$ ($165^\circ$'de $11.6\text{ mm}$).<br>• AvanTech YOU platformunda Actro YOU ve Quadro YOU raylar birebir aynı çekmece taban kesim ölçüsünü ($LW - 24\text{ mm}$) kullanır. | https://www.hettich.com<br>https://eshop.hettich.com | `VERIFIED` |
| **`mfr_hafele`** | **Häfele SE & Co KG** | Almanya | • **Kalkar Kapak:** Free Ailesi (Free Flap 1.7/3.15, Free Fold, Free Up, Free Slide, Free Space)<br>• **Çekmece:** Matrix Box (S, P, Slim A30), Matrix Runner<br>• **Sürgülü:** Slido (F-Line, Classic)<br>• **Bağlantı & Gardırop:** Minifix 15, Raf Pimleri, Pantolonluk/Asansör | • System 32 tam uyumlu.<br>• Minifix 15 gövde bağlantısı ($\varnothing 15 \times 13.5\text{ mm}$ eksantrik yuva, $34\text{ mm}$ kenar mesafesi). | https://www.hafele.com | `VERIFIED` |
| **`mfr_grass`** | **Grass GmbH** | Avusturya / Almanya | • **Menteşe:** Tiomos ($110^\circ, 120^\circ, 160^\circ$, M0/M9/Mirro)<br>• **Çekmece:** Vionaro, Nova Pro Scala<br>• **Gizli Ray:** Dynapro<br>• **Kalkar Kapak:** Kinvaro (T-Slim, F-20, L-80, S-35) | • Tas delik kalıbı: **$45 \times 9.5\text{ mm}$** veya **$48 \times 9.0\text{ mm}$**, $\varnothing 35 \times 12.6\text{ mm}$.<br>• Kinvaro T-Slim ($12\text{ mm}$ kalınlık) gövde yan paneline gömülebilir. | https://www.grass.eu | `VERIFIED` |
| **`mfr_salice`** | **Arturo Salice S.p.A.** | İtalya | • **Menteşe:** Silentia+, Serie 200, Air (kompakt gizli menteşe)<br>• **Pocket:** Exedra, Exedra2 (*Star* / *Smart*)<br>• **Kalkar / Düşer Kapak:** Wind (kalkar), Pacta (düşer bar kapağı) | • Tas delik kalıbı: **$45 \times 9.5\text{ mm}$** veya **$48 \times 9.0\text{ mm}$**, $\varnothing 35 \times 12.0\text{ mm}$.<br>• Silentia+ çift silikon yağlı yavaşlatıcıyı doğrudan menteşe tasının içine entegre eder. | https://www.salice.com | `VERIFIED` |
| **`mfr_hawa`** | **Hawa Sliding Solutions AG** | İsviçre | • **Pocket & Katlanır Pocket:** Concepta III (25/35), Folding Concepta III (20/25)<br>• **Sürgülü:** Clipo (15/26/36), Junior (40/80/100) | • Concepta III ve Folding Concepta III sistemleri alt kılavuz kanalı gerektirmeden $90^\circ$ dönüp yan cebe sürülür. | https://www.hawa.com | `VERIFIED` |
| **`mfr_sugatsune`**| **Sugatsune Kogyo Co., Ltd.** | Japonya | • **Yanal Açılır Kapak:** MonoFlat LIN-X1000 / LIN-X800<br>• **Pocket:** ALT-ST20<br>• **Mimari 3D Menteşe:** HES3D (120, E160, E190) | • LIN-X1000 ağır tek kapakları ($90\text{ kg}$'a kadar) küçük bir dönüş yarıçapıyla yana paralel açar. | https://global.sugatsune.com | `VERIFIED` |

---

## 3. PROFESYONEL YAZILIM REFERANSLARI (BENCHMARK ANALİZİ)

Uluslararası mobilya CAD/CAM ve mağaza konfigürasyon yazılımlarının mimari yaklaşımlarının Birim Configurator V4'e uyarlanması:

| Referans Yazılım | Mimari Yaklaşım | Birim Configurator V4'e Kazandırılan Prensip |
| :--- | :--- | :--- |
| **Cabinet Vision (Hexagon)** | **UCS (User Created Standards) & S2M (Screen-to-Machine):** Tasarım geometrisi ile makine operasyonlarını (delik, kanal, ebatlama) birbirinden ayırır. | V4'te `construction_profiles` ve `manufacturing_rules` katmanları 3D görsel mesh'ten bağımsız olarak parametrik kesim ve delik operasyonları üretir. |
| **imos iX (imos AG)** | **Akıllı Bağlantı Nesnesi (Connector Principle):** Bir menteşe veya ray iki panel arasındaki birleşim nesnesidir; deliklerini hem kapak yüzeyine hem yan dikmeye otomatik yansıtır. | V4'te `hardware_drilling_templates` bir donanım seçildiğinde (ör. Blum vs Hettich menteşe) hem kapak arka yüzündeki tas/vida deliklerini hem gövde yan panelindeki taban deliklerini eşzamanlı günceller. |
| **Mozaik (Cyncly)** | **Hafif 2.5D Plaka Parametrizasyonu & Hızlı Donanım Takası:** Ağır katı modelleme çekirdeği yerine hızlı plaka-yüzey operasyonları ve anında marka değişimi. | V4'te tarayıcı içinde **< 15 ms** tam BOM/geometri hızı korunarak tek tıkla donanım ailesi değiştirilebilir. |
| **Winner Flex & 2020 Design Live** | **Kısıt Tabanlı Mağaza Kataloğu & Gerçek Zamanlı SKU Çözümleme:** Satış personelinin geçersiz kombinasyon seçmesini engelleyen uyumluluk motoru. | V4'te **Evrensel Uyumluluk Motoru (Faz 07)** kapak ağırlığı ve yüksekliğinden güç faktörünü ($LF$) hesaplayıp doğru AVENTOS/Free mekanizma SKU'sunu otomatik seçer. |
| **Blum Cabinet Configurator (E-SERVICES)** | **3D Çarpışma Hacmi & Sıfır Çıkıntı Doğrulaması:** İç çekmece olan bölmelerde standart $110^\circ$ menteşenin çekmeceyle çarpıştığını tespit edip $155^\circ$ sıfır çıkıntılı menteşe zorunluluğu getirir. | V4 Uyumluluk Motoru (`COMPATIBILITY_ENGINE.md`) iç çekmece + menteşeli kapak kombinasyonunda otomatik olarak `71B7550` ($155^\circ$) veya `8657i` ($165^\circ$) şartı koşar. |
