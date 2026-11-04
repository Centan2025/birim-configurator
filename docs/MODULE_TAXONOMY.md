# BİRİM CONFIGURATOR V4 — EVRENSEL MODÜL SINIFLANDIRMASI (`MODULE_TAXONOMY.md`)

**Tarih:** 4 Kasım 2026  
**Sürüm:** V4.0  
**Durum:** `IMPLEMENTED` / `TESTED` (Faz 02 Tamamlandı)

---

## 1. MİMARİ İLKE: PARAMETRİK MODÜL AİLELERİ

Birim Configurator V4'te her dolap ayrı, sabit ve değiştirilemez bir ürün olarak kodlanmaz. Bunun yerine **6 Ana Modül Ailesi (`module_families`)** altında parametrik yapı kuralları, izin verilen ölçü aralıkları, uyumlu kapak sistemleri, iç donanım yuvaları ve teknik kısıtları tanımlanmış **92 işlevsel şablon (`module_templates`)** yer alır.

Her modül şablonu:
1. Parametrik `W × H × D` ölçülerine ve izin verilen min/maks sınırlara sahiptir.
2. Uyumlu kapak/cephe sistemlerini (`compatibleDoorSystems`) bildirir.
3. İç donanım (raf, çekmece, askı borusu, tel sepet, pantolonluk, kiler mekanizması, çöp kovası, aydınlatma) kabul eder.
4. Teknik kısıtlarını (`module_constraints` — sehim, havalandırma, tesisat boşluğu, minimum derinlik) taşır.
5. Otomatik BOM, kesim listesi ve System 32 delik koordinatları üretir.
6. 2D CAD (Plan/Görünüş/Kesit) ve 3D WebGL sahnede gerçek zamanlı gösterilir.
7. Yeniden boyutlandırılabilir, çoğaltılabilir ve kullanıcı/şube özel şablonu olarak kaydedilebilir.

---

## 2. MODÜL AİLELERİ VE 92 PARAMETRİK ŞABLON TAKSONOMİSİ

### A. MUTFAK ALT DOLAPLARI (`fam_kitchen_base`) — 20 Şablon
Standart gövde yüksekliği $720\text{ mm}$ (veya $780\text{ mm}$ XL), baza $100\text{ mm}$ (veya $150\text{ mm}$), gövde derinliği $560\text{–}580\text{ mm}$ (EN 1116:2018 tezgâh altı koordinasyon ölçüsü).

| # | Şablon Kodu | Şablon Adı | Varsayılan Ölçü ($W \times H \times D$ mm) | Genişlik Aralığı (mm) | Kapak / Cephe Sistemi | Özel Mühendislik & Üretim Kuralı |
| :--- | :--- | :--- | :---: | :---: | :--- | :--- |
| **A01** | `tpl_kb_01_single_door` | Tek Kapaklı Alt Dolap | $450 \times 720 \times 580$ | $300\text{–}600$ | Tek Menteşeli (Sol/Sağ) | 1 hareketli orta raf (System 32). |
| **A02** | `tpl_kb_02_double_door` | Çift Kapaklı Alt Dolap | $800 \times 720 \times 580$ | $600\text{–}1200$ | Çift Menteşeli | $W > 950\text{ mm}$ için orta dikme veya 25mm raf uyarısı. |
| **A03** | `tpl_kb_03_single_drawer` | Tek Derin Çekmeceli Alt Dolap | $600 \times 720 \times 580$ | $400\text{–}1000$ | 1 Tam Boy Çekmece | 70 kg yüksek taşıma kapasiteli ray (MOVENTO 766H / LEGRABOX). |
| **A04** | `tpl_kb_04_two_drawers` | İki Çekmeceli Alt Dolap (2 Derin) | $800 \times 720 \times 580$ | $450\text{–}1200$ | 2 Eşit Derin Çekmece | $2 \times 355\text{ mm}$ klapa yüksekliği, C-yüksek bordürlü kasa. |
| **A05** | `tpl_kb_05_three_drawers` | Üç Çekmeceli Alt Dolap (1+2) | $800 \times 720 \times 580$ | $450\text{–}1200$ | 1 Çatal-Kaşık + 2 Tencere | Üst çekmece $140\text{ mm}$ (M kasa), alt 2 çekmece $280\text{ mm}$ (C kasa). |
| **A06** | `tpl_kb_06_four_drawers` | Dört Çekmeceli Alt Dolap | $600 \times 720 \times 580$ | $400\text{–}900$ | 4 Eşit Çekmece | $4 \times 176\text{ mm}$ klapa, M yanaklı çekmece seti. |
| **A07** | `tpl_kb_07_door_internal_drawer` | Kapak + İç Çekmeceli Alt Dolap | $600 \times 720 \times 580$ | $450\text{–}900$ | Tek/Çift Kapak + 2 İç Çekmece | **Kritik Kural:** İç çekmece yan çakışmasını önlemek için $155^\circ$ sıfır çıkıntılı menteşe (`71B7550`) veya $25\text{ mm}$ distans çıtası zorunlu. |
| **A08** | `tpl_kb_08_sink_base` | Evye Alt Dolabı | $800 \times 720 \times 580$ | $600\text{–}1200$ | Çift Kapak / Çekmeceli | Üst tabla yerine dikey kayıt (alüminyum/ahşap ön/arka travers), tesisat için açık/yarım arkalık, alüminyum su koruma alt sacı. |
| **A09** | `tpl_kb_09_oven_housing` | Ankastre Fırın Alt Dolabı | $600 \times 720 \times 580$ | $600\text{–}600$ (Sabit EN 1116) | Alt Klapa + Fırın Nişi | $595\text{–}600\text{ mm}$ niş yüksekliği, alt $115\text{ mm}$ bas-aç/düşer tepsi çekmecesi, arka arkalık iptal + $50\text{ mm}$ havalandırma. |
| **A10** | `tpl_kb_10_dishwasher_front` | Bulaşık Makinesi Entegrasyon Cephesi | $600 \times 720 \times 580$ | $450\text{ veya }600$ | Tam Ankastre Cihaz Kapağı | Gövdesiz modül; yalnızca cihaz kapağı ($596 \times 716 \times 18\text{ mm}$) ve baza geçişi üretir. |
| **A11** | `tpl_kb_11_narrow_spice` | Dar Baharatlık Modülü | $200 \times 720 \times 580$ | $150\text{–}300$ | Çekme Kapak (Pull-out) | 2 kademeli teleskopik şişelik/baharatlık mekanizması. |
| **A12** | `tpl_kb_12_waste_sorting` | Çöp Ayrıştırma Dolabı | $600 \times 720 \times 580$ | $450\text{–}800$ | Çekme Kapak | Raylı çöp kovası sistemi ($2\times 15\text{L} + 1\times 30\text{L}$), güçlendirilmiş ön klapa bağlantısı. |
| **A13** | `tpl_kb_13_blind_corner` | Kör Köşe Alt Dolabı | $1050 \times 720 \times 580$ | $900\text{–}1200$ | Tek Kapak + Kör Panel | Min. $50\text{ mm}$ köşe dönüş kör çıtası; LeMans / Magic Corner mekanizma uyumlu. |
| **A14** | `tpl_kb_14_l_corner` | L Köşe Alt Dolabı (90° Katlanır) | $900 \times 720 \times 900$ | $800\text{–}1050$ | Katlanır Köşe Kapak (Bi-fold) | $170^\circ$ gövde menteşesi + $60^\circ$ kapak arası köşe menteşesi; döner tel sepet (Carousel) uyumlu. |
| **A15** | `tpl_kb_15_diagonal_corner` | Diyagonal (45°) Köşe Alt Dolabı | $900 \times 720 \times 900$ | $900\text{–}1050$ | $45^\circ$ Açılı Tek Kapak | $+45^\circ$ özel açılı menteşe (`79B9458`). |
| **A16** | `tpl_kb_16_open_shelf` | Açık Raflı Alt Modül | $450 \times 720 \times 580$ | $200\text{–}900$ | Kapaksız (Açık) | İç gövde panelleri kapak/cephe malzemesinden üretilir; 4 kenar bantlı. |
| **A17** | `tpl_kb_17_bottle_rack` | Şaraplık / Şişelik Modülü | $300 \times 720 \times 580$ | $150\text{–}450$ | Açık Bölmeli / Çekmeli | Karesel ara bölmeler (`subDividers`) veya şişelik rayı. |
| **A18** | `tpl_kb_18_cooktop_base` | Ocak Altı Modülü | $900 \times 720 \times 580$ | $600\text{–}1200$ | 1 Kör Klapa / Sığ Çekmece + 2 Derin Çekmece | Üst tabla yerine ısı kalkanlı travers, indüksiyon ocağı için min. $20\text{ mm}$ üst hava boşluğu. |
| **A19** | `tpl_kb_19_drawer_door_combo` | Çekmece + Kapak Kombinasyonu | $600 \times 720 \times 580$ | $400\text{–}1000$ | 1 Üst Çekmece + Alt Kapak | Üstte $140\text{ mm}$ çekmece, altta $575\text{ mm}$ menteşeli kapak ve 1 raf. |
| **A20** | `tpl_kb_20_custom_base` | Özel Ölçü Alt Modül | $600 \times 720 \times 580$ | $150\text{–}1200$ | Serbest Seçim | Tüm bölme, raf, çekmece ve kapak parametreleri serbest. |

---

### B. MUTFAK ÜST DOLAPLARI (`fam_kitchen_wall`) — 15 Şablon
Standart gövde derinliği $320\text{–}360\text{ mm}$, yüksekliği $360\text{–}1040\text{ mm}$, duvar askı elemanı kapasitesi EN 14749 uyumlu.

| # | Şablon Kodu | Şablon Adı | Varsayılan Ölçü ($W \times H \times D$ mm) | Genişlik Aralığı (mm) | Kapak / Cephe Sistemi | Özel Mühendislik & Üretim Kuralı |
| :--- | :--- | :--- | :---: | :---: | :--- | :--- |
| **B01** | `tpl_kw_01_single_door` | Tek Kapaklı Üst Dolap | $450 \times 720 \times 350$ | $300\text{–}600$ | Tek Menteşeli | 2 hareketli raf, gizli duvar askı elemanı. |
| **B02** | `tpl_kw_02_double_door` | Çift Kapaklı Üst Dolap | $800 \times 720 \times 350$ | $600\text{–}1200$ | Çift Menteşeli | 2 hareketli raf. |
| **B03** | `tpl_kw_03_open_shelf` | Açık Raflı Üst Modül | $600 \times 720 \times 350$ | $200\text{–}1000$ | Kapaksız | Gövde cephe malzemesinden üretilir. |
| **B04** | `tpl_kw_04_glass_door` | Cam Kapaklı Vitrin Üst Dolap | $800 \times 720 \times 350$ | $400\text{–}1000$ | Alüminyum Çerçeve Cam Kapak | Cam/alüminyum profil menteşesi, cam iç raflar ($8\text{ mm}$ temperli). |
| **B05** | `tpl_kw_05_lift_stay_single` | Yukarı Kalkar Tek Kapak (HK top / Free Flap) | $800 \times 450 \times 350$ | $400\text{–}1200$ | Yukarı Kalkar (`lift_up_stay`) | $H \le 600\text{ mm}$; Güç faktörü $LF = H \times m_{\text{door}}$ otomatik hesaplanır. |
| **B06** | `tpl_kw_06_lift_bifold` | İki Parçalı Katlanır Kalkar (HF top / Free Fold) | $900 \times 780 \times 350$ | $450\text{–}1800$ | Katlanır Kalkar (`lift_bi_fold`) | $H: 480\text{–}1040\text{ mm}$; üst ve alt kapak yatay iki parçaya bölünür + orta menteşe. |
| **B07** | `tpl_kw_07_lift_parallel` | Paralel Yukarı Kalkar (HL top / Free Up) | $900 \times 500 \times 350$ | $450\text{–}1800$ | Paralel Kalkar (`lift_parallel`) | $H: 300\text{–}580\text{ mm}$; üstünde başka dolap bulunan nişler için uygun. |
| **B08** | `tpl_kw_08_lift_up_over` | Üstten Döner Kalkar (HS top / Free Swing) | $900 \times 720 \times 350$ | $450\text{–}1800$ | Döner Kalkar (`lift_up_over`) | $H: 350\text{–}800\text{ mm}$; tavan ile dolap üstü arasında min. $220\text{ mm}$ dönüş boşluğu kontrolü. |
| **B09** | `tpl_kw_09_hood_cabinet` | Ankastre Davlumbaz Üst Dolabı | $600 \times 720 \times 350$ | $600\text{–}900$ | Tek/Çift Kapak veya Kalkar | Alt panelde davlumbaz kesimi, içte baca borusu ($Ø150\text{ mm}$) geçiş kanalı. |
| **B10** | `tpl_kw_10_microwave_wall` | Mikrodalga Nişli Üst Dolap | $600 \times 720 \times 380$ | $600\text{–}600$ | Üst Kalkar Kapak + Alt Açık Niş | Min. $380\text{ mm}$ derinlik, altta $380\text{ mm}$ mikrodalga nişi. |
| **B11** | `tpl_kw_11_corner_wall` | Köşe Üst Dolabı (L / Diyagonal) | $650 \times 720 \times 650$ | $600\text{–}750$ | Köşe Katlanır veya $45^\circ$ Kapak | Alt köşe modülü ile düşey hizalama. |
| **B12** | `tpl_kw_12_horizontal_wide` | Yatay Geniş Üst Dolap | $1200 \times 360 \times 350$ | $800\text{–}1800$ | Yukarı Kalkar (`lift_up_stay`) | $W \ge 1000\text{ mm}$ için orta dikme (sehim önleyici) ve 2 adet kalkar mekanizma. |
| **B13** | `tpl_kw_13_narrow_wall` | Dar Üst Dolap | $300 \times 720 \times 350$ | $150\text{–}350$ | Tek Menteşeli / Açık | Küçük kalan duvar boşluklarını dengelemek için. |
| **B14** | `tpl_kw_14_led_shelf_unit` | Aydınlatmalı Üst Dolap / Raf | $900 \times 720 \times 350$ | $450\text{–}1200$ | Cam/Ahşap Kapak | Alt tablada gömme alüminyum LED profil kanalı ($16 \times 8\text{ mm}$ freze yuvası). |
| **B15** | `tpl_kw_15_custom_wall` | Özel Ölçü Üst Modül | $600 \times 720 \times 350$ | $150\text{–}1800$ | Serbest Seçim | Serbest parametrik üst dolap. |

---

### C. BOY VE CİHAZ DOLAPLARI (`fam_kitchen_tall`) — 12 Şablon
Standart yükseklik $2000\text{–}2400\text{ mm}$, derinlik $580\text{–}650\text{ mm}$.

| # | Şablon Kodu | Şablon Adı | Varsayılan Ölçü ($W \times H \times D$ mm) | Genişlik Aralığı (mm) | Kapak / Cephe Sistemi | Özel Mühendislik & Üretim Kuralı |
| :--- | :--- | :--- | :---: | :---: | :--- | :--- |
| **C01** | `tpl_kt_01_pantry_shelved` | Raflı Boy Kiler Dolabı | $600 \times 2150 \times 580$ | $400\text{–}900$ | Tek/Çift Menteşeli (5 Menteşe) | 5 raf (1 sabit orta kuşak + 4 hareketli raf). |
| **C02** | `tpl_kt_02_pantry_pullout` | Çekmeceli / Tandem Kiler Dolabı | $450 \times 2150 \times 580$ | $300\text{–}600$ | Çekme Kiler veya Menteşeli | Häfele / Kesseböhmer Dispensa / Tandem kiler mekanizması (100 kg kapasite). |
| **C03** | `tpl_kt_03_pantry_internal_drawers` | İç Çekmeceli Boy Kiler (SPACE TOWER) | $600 \times 2150 \times 580$ | $450\text{–}900$ | Tek/Çift Kapak + 5 İç Çekmece | **Kritik Kural:** Blum $155^\circ$ sıfır çıkıntılı menteşe (`71B7550`) zorunludur; iç çekmeceler alt menteşelerle çakışmaz. |
| **C04** | `tpl_kt_04_oven_tower` | Ankastre Fırın Kulesi | $600 \times 2150 \times 580$ | $600\text{–}600$ | Alt 2 Çekmece + Fırın Nişi + Üst Kapak | Ergonomik fırın yüksekliği ($Y = 720\text{ mm}$), arka $50\text{ mm}$ baca boşluğu, $200\text{ cm}^2$ baza/üst menfez. |
| **C05** | `tpl_kt_05_oven_microwave_tower` | Fırın + Mikrodalga Kulesi | $600 \times 2150 \times 580$ | $600\text{–}600$ | Alt Çekmece + Fırın ($600$) + Mikro ($380$) + Üst Kapak | İki cihaz arası $18\text{ mm}$ sabit taşıyıcı raf (Minifix + Kavela), arka açık havalandırma. |
| **C06** | `tpl_kt_06_builtin_fridge` | Ankastre Buzdolabı Boy Dolabı | $600 \times 2150 \times 580$ | $600\text{–}600$ | Sürgülü/Sabit Cihaz Kapağı | $1780\text{ mm}$ cihaz nişi, alt bazada ve üst şapkada min. $200\text{ cm}^2$ havalandırma menfezi zorunlu. |
| **C07** | `tpl_kt_07_fridge_surround` | Solo Buzdolabı Çevresi Ünitesi | $1000 \times 2150 \times 650$ | $850\text{–}1200$ | Üst Kalkar Kapak + Yan Bitiş Panelleri | Solo buzdolabı üstü derin dolap + sol/sağ dikey bitiş panelleri. |
| **C08** | `tpl_kt_08_utility_cleaning` | Temizlik / Çamaşır Boy Dolabı | $600 \times 2150 \times 600$ | $450\text{–}800$ | Tek/Çift Menteşeli | Dikey ara bölme: bir yanda uzun ütü masası/paspas boşluğu, diğer yanda deterjan rafları. |
| **C09** | `tpl_kt_09_broom_vacuum` | Süpürge & Şarj İstasyonu Dolabı | $500 \times 2150 \times 580$ | $400\text{–}600$ | Tek Menteşeli | İç elektrik prizi/şarj hazırlığı notu ve $1450\text{ mm}$ dikey askı boşluğu. |
| **C10** | `tpl_kt_10_open_niche_tall` | Açık Kahve Nişli Boy Dolap | $800 \times 2150 \times 580$ | $600\text{–}1200$ | Alt Çekmece + Orta Açık Niş + Üst Kapak | Ortada $550\text{ mm}$ yüksekliğinde LED aydınlatmalı açık kahve köşesi. |
| **C11** | `tpl_kt_11_pocket_appliance` | Pocket (Gizlenen) Kapaklı Cihaz Dolabı | $1300 \times 2200 \times 650$ | $750\text{–}1500$ | Pocket Kapak (Blum REVEGO / Hawa Concepta III) | Yanlarda $100\text{ mm}$ (tek) veya $150\text{ mm}$ (çift) pocket cep boşluğu, min. $650\text{ mm}$ derinlik. |
| **C12** | `tpl_kt_12_custom_tall` | Özel Ölçü Boy Dolap | $600 \times 2150 \times 580$ | $300\text{–}1200$ | Serbest Seçim | Serbest parametrik boy dolap. |

---

### D. GARDIROP VE GİYİNME ODASI (`fam_wardrobe`) — 20 Şablon
Standart yükseklik $2000\text{–}2750\text{ mm}$, derinlik menteşelide $580\text{–}600\text{ mm}$, sürgülüde $650\text{–}700\text{ mm}$, açık giyinmede $500\text{–}550\text{ mm}$.

| # | Şablon Kodu | Şablon Adı | Varsayılan Ölçü ($W \times H \times D$ mm) | Genişlik Aralığı (mm) | Kapak / Cephe Sistemi | Özel Mühendislik & Üretim Kuralı |
| :--- | :--- | :--- | :---: | :---: | :--- | :--- |
| **D01** | `tpl_wd_01_single_door` | Tek Kapaklı Gardırop | $500 \times 2200 \times 600$ | $400\text{–}600$ | Tek Menteşeli (4-5 Menteşe) | 1 üst raf + 1 askı borusu + 1 alt raf. |
| **D02** | `tpl_wd_02_two_door` | Çift Kapaklı Standart Gardırop (`tpl_wardrobe_2door`) | $1000 \times 2200 \times 600$ | $800\text{–}1200$ | Çift Menteşeli | Tek bölme, üst raf + askı borusu + alt raf. |
| **D03** | `tpl_wd_03_three_door` | Üç Kapaklı Master Gardırop (`tpl_wardrobe_3door_drawers`) | $1500 \times 2200 \times 600$ | $1200\text{–}1800$ | 1 Tek + 1 Çift Kapak | 2 bölme: sol raf kulesi, sağ askı + 2 çekmece. |
| **D04** | `tpl_wd_04_four_door` | Dört Kapaklı Geniş Gardırop | $2000 \times 2200 \times 600$ | $1600\text{–}2400$ | $2 \times$ Çift Menteşeli Kapak | 2 eşit bölme (ara dikmeli), simetrik askı ve iç çekmece düzeni. |
| **D05** | `tpl_wd_05_sliding_2door` | Sürgülü İki Kapaklı Gardırop | $1800 \times 2200 \times 650$ | $1400\text{–}2400$ | Sürgülü 2 Kapak (TopLine L / Slido) | Min. $650\text{ mm}$ dış derinlik ($80\text{ mm}$ ray payı); iç çekmeceler kapak binisiyle çakışmamalı. |
| **D06** | `tpl_wd_06_sliding_3door` | Sürgülü Üç Kapaklı Gardırop | $2700 \times 2200 \times 650$ | $2100\text{–}3600$ | Sürgülü 3 Kapak | 3 eşit bölme, yavaşlatıcılı çift ray sistemi. |
| **D07** | `tpl_wd_07_sliding_4door` | Sürgülü Dört Kapaklı Gardırop | $3200 \times 2200 \times 650$ | $2800\text{–}3600$ | Sürgülü 4 Kapak (Senkronize) | 4 bölme (veya 2 birleşik gövde), orta iki kapak senkronize açılım. |
| **D08** | `tpl_wd_08_open_walkin` | Açık Giyinme Modülü (`tpl_wardrobe_walkin_open`) | $1000 \times 2300 \times 550$ | $500\text{–}1200$ | Kapaksız (Açık) | Çift askı + 2 bas-aç çekmece. |
| **D09** | `tpl_wd_09_hanging_heavy` | Askılık Ağırlıklı Gardırop | $1000 \times 2300 \times 600$ | $800\text{–}1200$ | Çift Kapak / Açık | Üstte asansör askılık (pull-down lift), altta sabit askı borusu. |
| **D10** | `tpl_wd_10_shelf_heavy` | Raf Ağırlıklı Gardırop | $800 \times 2200 \times 600$ | $400\text{–}1000$ | Tek/Çift Kapak | 6 kademeli katlı kıyafet raf düzeni (System 32). |
| **D11** | `tpl_wd_11_drawer_heavy` | Çekmece Ağırlıklı Dolap Modülü | $900 \times 2200 \times 600$ | $600\text{–}1200$ | Açık / Dıştan 4 Çekmece + Üst Kapak | Altta 4 geniş çekmece, üstte 3 raf. |
| **D12** | `tpl_wd_12_mixed_organizer` | Karma İç Düzenli Master Modül | $1200 \times 2300 \times 600$ | $900\text{–}1600$ | Çift Kapak | Raf arası dikme (`subDivider`), askı, 2 çekmece ve yan raflar. |
| **D13** | `tpl_wd_13_corner_wardrobe` | L Köşe Gardırop Modülü | $1050 \times 2200 \times 1050$ | $950\text{–}1200$ | Katlanır Köşe Kapak (`folding`) | $90^\circ$ köşe dönüşlü askı ve raf alanı. |
| **D14** | `tpl_wd_14_walkin_l_unit` | L Giyinme Odası Köşe Ünitesi | $1000 \times 2300 \times 1000$ | $900\text{–}1200$ | Açık / Cam Kapaklı | L giyinme odası köşe bağlantısı, döner askı uyumlu. |
| **D15** | `tpl_wd_15_walkin_u_unit` | U Giyinme Odası Merkez Modülü | $1200 \times 2300 \times 550$ | $800\text{–}1600$ | Açık + Cam Çekmece Önü | LED aydınlatmalı vitrin raf ve takı çekmecesi. |
| **D16** | `tpl_wd_16_island_dresser` | Ada Çekmece / Takı Ünitesi | $1200 \times 900 \times 800$ | $800\text{–}1800$ | Çift Yönlü Çekmece + Cam Üst Tabla | Giyinme odası ortası için 4 bir yanı bantlı/bitiş panelli ada şifonyer. |
| **D17** | `tpl_wd_17_trouser_unit` | Pantolonluk & Gömlek Ünitesi | $900 \times 2200 \times 600$ | $600\text{–}1000$ | Çift Kapak / Açık | Altta teleskopik pantolonluk (`trouser_rack`), üstte gömlek askısı. |
| **D18** | `tpl_wd_18_shoe_tower` | Ayakkabılık & Çanta Kulesi | $800 \times 2200 \times 450$ | $600\text{–}1000$ | Çift Kapak / Açık | 5 adet eğimli metal ayakkabılık rafı (`shoe_rack`) + üst çanta rafları. |
| **D19** | `tpl_wd_19_glass_showcase` | Cam Kapaklı LED Vitrin Gardırop | $1000 \times 2300 \times 600$ | $800\text{–}1200$ | Füme Cam Alüminyum Çerçeve Kapak | Dikey yan panellerde boydan LED profil (`led_profile`) + cam kapak menteşeleri. |
| **D20** | `tpl_wd_20_builtin_niche` | Özel Ölçü Gömme Dolap | $1600 \times 2500 \times 600$ | $400\text{–}3600$ | Serbest Seçim | Duvar-tavan arası montaj boşluğu (kör parça) otomatik hesaplı. |

---

### E. ÖZEL VE KÖŞE MODÜLLERİ (`fam_special_corner`) — 10 Şablon

| # | Şablon Kodu | Şablon Adı | Varsayılan Ölçü ($W \times H \times D$ mm) | Açıklama & Mühendislik Kuralı |
| :--- | :--- | :--- | :---: | :--- |
| **E01** | `tpl_sc_01_inner_corner` | İç Köşe Dönüş Modülü ($90^\circ$) | $900 \times 2200 \times 900$ | İki dikey duvar birleşimi için $90^\circ$ iç köşe gövdesi. |
| **E02** | `tpl_sc_02_outer_corner` | Dış Köşe Kolon Sarma Modülü | $600 \times 2200 \times 600$ | Dışbükey köşe veya kolon etrafı dönüş ünitesi. |
| **E03** | `tpl_sc_03_blind_corner_tall` | Kör Köşe Boy Modül | $1100 \times 2200 \times 600$ | Yan modülün arkasına giren kör bölmeli boy dolap + $50\text{ mm}$ köşe çıtası. |
| **E04** | `tpl_sc_04_diagonal_tall` | Diyagonal ($45^\circ$) Köşe Gardırop | $1000 \times 2200 \times 1000$ | Beşgen taban izli, $45^\circ$ açılı tek kapaklı geniş köşe dolabı. |
| **E05** | `tpl_sc_05_sloped_ceiling` | Eğimli Tavan (Çatı Arası) Modülü | $900 \times 2100 \times 600$ | Üst/arka kesimi çatı eğimine göre parametrik (`topBackCutHeightMm` — CNC özel kesim onayı gerektirir). |
| **E06** | `tpl_sc_06_under_stairs` | Merdiven Altı Kademeli Modül | $1200 \times 1800 \times 600$ | Soldan sağa veya sağdan sola basamaklı yükseklik geçişi. |
| **E07** | `tpl_sc_07_narrow_niche` | Dar Niş Dolabı ($150\text{–}350\text{ mm}$) | $250 \times 2150 \times 580$ | Kolon yanı dar boşluklar için çekmeli veya açık niş ünitesi. |
| **E08** | `tpl_sc_08_stepped_depth` | Kademeli Derinlik Geçiş Modülü | $600 \times 2200 \times 450$ | $600\text{ mm}$ derinlikten $350\text{–}450\text{ mm}$ derinliğe geçiş sağlayan ara modül. |
| **E09** | `tpl_sc_09_terminal_end` | Pahlı / Açık Bitiş Modülü | $350 \times 2200 \times 600$ | Dolap dizisinin oda girişine bakan ucunda yumuşak geçiş sağlayan açık raflı sonlandırma. |
| **E10** | `tpl_sc_10_custom_geometry` | Özel Üretim Geometrisi (Bespoke) | $800 \times 2200 \times 600$ | Standart dışı kesim gerektiren özel mimari modül (`BLOCKED_BY_FACTORY_VALIDATION` bayrağı ile işaretlenir). |

---

### F. TAMAMLAYICI MODÜLLER (`fam_complementary`) — 15 Şablon
Mutfak ve gardırop projelerinde otomatik veya manuel eklenen bitiş, kapama ve montaj bileşenleri:

| # | Şablon Kodu | Şablon Adı | Varsayılan Ölçü ($W \times H \times D$ mm) | BOM / Üretim Rolü |
| :--- | :--- | :--- | :---: | :--- |
| **F01** | `tpl_cm_01_plinth_strip` | Baza Ön/Yan Bandı | $2400 \times 100 \times 18$ | Alt dolap/gardırop ön baza boy parçası (`plinth`), üst kenar su yalıtım contalı. |
| **F02** | `tpl_cm_02_leveling_feet` | Ayarlanabilir Baza Ayağı Seti | $100 \times 100 \times 100$ | $80\text{–}150\text{ mm}$ ayarlanabilir plastik/metal baza ayağı + klipsi (`HW_LEVELING_FEET`). |
| **F03** | `tpl_cm_03_skirting` | Süpürgelik / Baza Köşe Dönüşü | $600 \times 100 \times 18$ | Yan baza dönüş parçası ve $90^\circ$ köşe profili. |
| **F04** | `tpl_cm_04_wall_filler` | Duvar Bitiş Dolgu Paneli (Kör Parça) | $50 \times 2200 \times 18$ | Duvar eğriliği ve kulp açılım payı için $15\text{–}150\text{ mm}$ boydan L-kayıtlı kör parça. |
| **F05** | `tpl_cm_05_end_panel` | Görünür Yan Bitiş Paneli | $600 \times 2200 \times 18$ | Dolap dizisinin açıkta kalan yan yüzeyi için kapak malzemesinden 4 kenarı bantlı bitiş paneli. |
| **F06** | `tpl_cm_06_top_infill` | Tavana Kadar Üst Kapama (Alın) Paneli | $2400 \times 150 \times 18$ | Dolap üstü ile tavan arasındaki boşluğu kapatan alın parçası. |
| **F07** | `tpl_cm_07_fascia_panel` | Cihaz / Tesisat Alın Paneli | $600 \times 100 \times 18$ | Ankastre fırın altı veya evye önü sabit klapa/alın parçası. |
| **F08** | `tpl_cm_08_back_cladding` | Dekoratif Arkalık / Duvar Kaplama Paneli | $1200 \times 2200 \times 18$ | Açık niş veya giyinme odası duvar arkası dekoratif panel. |
| **F09** | `tpl_cm_09_countertop` | Mutfak Tezgâhı (Countertop) | $2400 \times 40 \times 600$ | Alt dolapların üstünü örten $20\text{–}40\text{ mm}$ kuvars/kompakt/masif tezgâh plakası ($+20\text{ mm}$ ön damlalık çıkıntısı). |
| **F10** | `tpl_cm_10_waterfall_edge` | Tezgâh Yan Düşey Bitişi (Waterfall) | $600 \times 860 \times 40$ | Tezgâh malzemesinin ada veya bitiş yanında zemine kadar ($45^\circ$ gönyeli) inen dikey plakası. |
| **F11** | `tpl_cm_11_backsplash` | Tezgâh Arası Paneli (Backsplash) | $2400 \times 600 \times 18$ | Tezgâh ile üst dolap arasındaki $550\text{–}650\text{ mm}$ duvar kaplama paneli. |
| **F12** | `tpl_cm_12_crown_molding` | Üst Taç / Işık Bandı Profili | $2400 \times 60 \times 40$ | Клаsik/modern üst taç veya üst dolap altı ışık gizleme çıtası. |
| **F13** | `tpl_cm_13_led_channel` | Alüminyum Gömme LED Profili | $1000 \times 8 \times 16$ | Yan dikme veya üst tabla içine açılan LED kanal profili + difüzör. |
| **F14** | `tpl_cm_14_wall_bracket` | Ağır Yük Duvar Bağlantı Rayı | $2400 \times 45 \times 15$ | EN 14749 uyumlu çelik duvar askı rayı ve devrilme önleyici L-braket. |
| **F15** | `tpl_cm_15_service_spacer` | Tesisat / Havalandırma Servis Boşluğu | $600 \times 2150 \times 50$ | Su/doğalgaz borusu veya ankastre cihaz arkası için $50\text{ mm}$ derinlik ofset elemanı. |
