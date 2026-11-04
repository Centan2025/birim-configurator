# BİRİM CONFIGURATOR V4 — EVRENSEL UYUMLULUK MOTORU (`COMPATIBILITY_ENGINE.md`)

**Tarih:** 4 Kasım 2026  
**Sürüm:** V4.0  
**Durum:** `IMPLEMENTED` / `TESTED` (Faz 07 Tamamlandı)

---

## 1. MİMARİ AMAÇ VE SONUÇ SINIFLARI

Evrensel Uyumluluk Motoru (`packages/core/src/v4-compatibility.ts`), kullanıcının seçtiği modül, ölçü, malzeme, kapak sistemi, kulp, açılma teknolojisi, iç donanım ve mekân yerleşimini **15 deterministik kontrol kategorisinde** denetler.

### 1.1 Sonuç Sınıfları (`CompatibilityStatus`)
- **`COMPATIBLE`**: Tüm mühendislik, katalog ve üretim kurallarına tam uygun.
- **`COMPATIBLE_WITH_CONDITIONS`**: Uygun, ancak ek montaj elemanı veya dikkat gerektirir (ör. $W > 950\text{ mm}$ raf açıklığı uyarısı, duvar bitişinde $30\text{ mm}$ kör parça gereksinimi).
- **`INCOMPATIBLE`**: Fiziksel veya katalog sınırları dışında; **üretim onayını (`approveProduction`) kesin olarak engeller**.
- **`UNVERIFIED`**: Seçilen kombinasyon veya özel geometri (ör. tambur kapak, eğimli çatı kesimi, doğrulanmamış üçüncü taraf cihaz) katalog veya fabrika numune doğrulaması bekliyor; **önizlemeye izin verir ancak CNC üretim onayını engeller**.

---

## 2. 15 KONTROL KATEGORİSİ VE OTOMATİK ÇÖZÜM ÖNERİLERİ (`RemediationSuggestion`)

| # | Kontrol Kategorisi | Kural Kodu | Koşul / Formül | Sonuç Sınıfı | Otomatik Çözüm Önerileri (`suggestions`) |
| :--- | :--- | :--- | :--- | :---: | :--- |
| **1** | **Gövde / Kapak Uyumu** | `CHK_01_CARCASS_DOOR_FIT` | Sürgülü kapak (`sliding_*`) tek bölmeli ($N_{\text{bay}} < 2$) veya $W < 1200\text{ mm}$ gövdede seçildiğinde | `INCOMPATIBLE` | 1. Kapak sistemini Çift Menteşeli (`hinged_double`) yap.<br>2. Gövdeyi $\ge 1400\text{ mm}$ ve $\ge 2$ bölmeye çıkar. |
| **2** | **Kapak / Mekanizma Uyumu** | `CHK_02_DOOR_MECHANISM_MATCH` | Kalkar kapak (`lift_up_stay` / HK top) $H_{\text{carcass}} > 600\text{ mm}$ dolapta seçildiğinde | `INCOMPATIBLE` | 1. İki parçalı Katlanır Kalkar (`lift_bi_fold` / AVENTOS HF top, $480\text{–}1040\text{ mm}$) mekanizmaya geç.<br>2. Üst dolap yüksekliğini $\le 600\text{ mm}$'ye düşür. |
| **3** | **Kapak Ağırlığı ve Güç Faktörü ($LF$)** | `CHK_03_DOOR_WEIGHT_LIMIT` | Menteşeli kapakta $m_{\text{door}} > 24\text{ kg}$ veya kalkar kapakta $LF > LF_{\max}$ ($9000$ HK top / $19300$ HF top) | `INCOMPATIBLE` | 1. Daha hafif kapak malzemesi seç (Kompakt/Cam yerine MDF/Melamin).<br>2. Tek kapağı Çift Kapağa (`hinged_double`) böl.<br>3. Kapak genişliğini daralt veya 3. güç ünitesi ekle. |
| **4** | **Kapak Kalınlığı ($T_{\text{door}}$)** | `CHK_04_DOOR_THICKNESS` | $T_{\text{door}} > 24\text{ mm}$ kapakta standart $110^\circ$ menteşe (`71B3550`) seçildiğinde | `INCOMPATIBLE` | 1. Kalın kapak menteşesine (`71B9550` $95^\circ$ veya Hettich `8657i` $165^\circ$) geç.<br>2. Kapak kalınlığını $18\text{–}22\text{ mm}$ aralığına düşür. |
| **5** | **Genişlik / Yükseklik Limitleri** | `CHK_05_DIMENSION_LIMITS` | Tek menteşeli kanat genişliği $W_{\text{leaf}} > 650\text{ mm}$ veya plaka boyu $H > 2770\text{ mm}$ | `INCOMPATIBLE` | 1. Bölme kapak tipini Çift Kapak (`hinged_double`) yap.<br>2. $H > 2400\text{ mm}$ için üst tepe (mezzanine) modülü ekle. |
| **6** | **Açılma Alanı (3D Sweep Volume)** | `CHK_06_OPENING_CLEARANCE` | Üstten döner kalkar kapak (`lift_up_over` / HS top) tavan mesafesi $< 220\text{ mm}$ olduğunda | `INCOMPATIBLE` | 1. Paralel kalkar (`lift_parallel` / HL top) veya Katlanır kalkar (`lift_bi_fold` / HF top) seç.<br>2. Üst dolap montaj kotunu aşağı çek. |
| **7** | **Komşu Modül & İç Çekmece Çarpışması** | `CHK_07_INTERNAL_DRAWER_HINGE` | Menteşeli kapak arkasında iç çekmece (`isInternal: true`) varken standart $110^\circ$ menteşe kullanıldığında | `COMPATIBLE_WITH_CONDITIONS` / `INCOMPATIBLE` | 1. Menteşeyi $155^\circ$ Sıfır Çıkıntılı (`hw_blum_71b7550`) veya $165^\circ$ (`hw_hettich_9099540`) modele yükselt.<br>2. İç çekmece yanına $25\text{ mm}$ distans çıtası ekle. |
| **8** | **Kulp / Mekanizma Uyumu** | `CHK_08_HANDLE_MECHANISM` | Kulpsuz düz cephe (`handleless_plain`) ile manuel/frenli (`soft_close`) açılma seçildiğinde; veya sürgülü kapakta dışa çıkıntılı çubuk kulp (`bar_handle`) seçildiğinde | `INCOMPATIBLE` | 1. Açılma teknolojisini Bas-Aç (`push_to_open` / `push_to_open_soft_close`) veya Elektrikli (`servo_electric`) yap.<br>2. Sürgülü kapakta Gömme Kulp (`recessed_grip`) veya Kenar Profili seç. |
| **9** | **Ray / Çekmece Derinlik Uyumu** | `CHK_09_RUNNER_DEPTH_MATCH` | Seçilen ray boyu ($NL$, ör. $500\text{ mm}$) net iç derinlikten ($D_{\text{inner}} = D - 20\text{ mm}$) büyük olduğunda ($NL + 10 > D_{\text{inner}}$) | `INCOMPATIBLE` | 1. Ray nominal boyunu otomatik olarak bir alt kademeye ($450\text{ mm}$ veya $400\text{ mm}$) düşür.<br>2. Gövde derinliğini $\ge NL + 30\text{ mm}$ değerine artır. |
| **10** | **Montaj & Cep Boşlukları (Pocket / Sürgü)** | `CHK_10_MOUNTING_POCKET_CLEARANCE`| Pocket kapak (`pocket_retractable`) seçildiğinde $D < 573\text{ mm}$ veya $H < 1800\text{ mm}$ (REVEGO) olduğunda | `INCOMPATIBLE` | 1. Gövde derinliğini $\ge 600\text{ mm}$ ve yüksekliğini $\ge 1800\text{ mm}$ yap.<br>2. Daha kısa dolaplar için Hawa Concepta III 25 ($H \ge 1200\text{ mm}$) seç. |
| **11** | **Üretim & System 32 Delik Kuralları** | `CHK_11_MANUFACTURING_DRILLING` | Parça kesim boyutu $< 70\text{ mm}$ (Selco WNT 600 sınırı) veya delik derinliği panel kalınlığını aştığında ($d_{\text{hole}} > T_{\text{panel}} - 2\text{ mm}$) | `INCOMPATIBLE` | 1. Panel kalınlığını min. $18\text{ mm}$ yap.<br>2. $70\text{ mm}$ altındaki çıtaları boydan plaka şeridi olarak grupla. |
| **12** | **Malzeme Uygunluğu (Sehim & J-Pull)** | `CHK_12_MATERIAL_SUITABILITY` | J-Pull kulp $18\text{ mm}$ altında veya melamin/cam kapakta seçildiğinde; ya da raf açıklığı $LW > 950\text{ mm}$ olduğunda | `INCOMPATIBLE` / `COMPATIBLE_WITH_CONDITIONS` | 1. J-Pull için kapak malzemesini Lake (`lacquer`) veya Kaplama (`wood`) ve kalınlığı $\ge 19\text{ mm}$ yap.<br>2. Geniş rafa ara dikme ekle veya raf kalınlığını $25\text{ mm}$ yap. |
| **13** | **Donanım Yük Kapasitesi** | `CHK_13_HARDWARE_LOAD_CAPACITY` | $W \ge 900\text{ mm}$ geniş ve derin ($H \ge 250\text{ mm}$) tencere çekmecesinde $30\text{ kg}$ ray seçildiğinde | `COMPATIBLE_WITH_CONDITIONS` | 1. Ray sistemini $70\text{ kg}$ ağır hizmet serisine (`hw_blum_legrabox_c70` veya `hw_blum_movento_766h`) yükselt. |
| **14** | **Mutfak Ankastre Cihaz Boşluğu** | `CHK_14_APPLIANCE_CLEARANCE` | Ankastre fırın/buzdolabı modülünde dış genişlik $\ne 600\text{ mm}$ veya iç derinlik $< 550\text{ mm}$ olduğunda (EN 1116) | `INCOMPATIBLE` | 1. Cihaz modülü genişliğini $600\text{ mm}$ ve derinliğini $\ge 580\text{ mm}$ standardına sabitle. |
| **15** | **Duvar & Mekân Montaj Koşulları** | `CHK_15_SPACE_MOUNTING` | Kolon, pencere, tavan çakışması, L/U köşe kör alan eksikliği veya evye-tesisat kaçıklığı | `INCOMPATIBLE` / `COMPATIBLE_WITH_CONDITIONS` | 1. Modülü çakışma dışına kaydır.<br>2. Köşe dönüşüne $50\text{ mm}$ kör köşe çıtası ekle. |
