# BİRİM CONFIGURATOR V4 — AKILLI MODÜL OLUŞTURUCU VE DOLAP/MUTFAK OTOMASYONU (`SMART_MODULE_BUILDER.md`)

**Tarih:** 4 Kasım 2026  
**Sürüm:** V4.0  
**Durum:** `IMPLEMENTED` / `TESTED` (Faz 08 & Faz 09 Tamamlandı)

---

## 1. FAZ 08 — AKILLI MODÜL OLUŞTURUCU (`packages/catalog/src/v4-smart-builder.ts`)

Kullanıcı sıfırdan bütün parçaları çizmek zorunda kalmadan, duvar açıklığını (ör. $3600\text{ mm}$) girdiğinde sistem gerçek ölçü, sehim ($LW \le 950\text{ mm}$), plaka boyu, kapak ağırlığı ve donanım kurallarına uygun yerleşim alternatifleri üretir:

### 1.1 3600 mm Duvar Açıklığı İçin Otomatik Yerleşim Alternatifleri
1. **4 Eşit Gövdeli Yerleşim (`layout_4_equal`):**
   - $4 \times 882\text{ mm}$ gövde + $2 \times 36\text{ mm}$ sol/sağ duvar bitiş dolgu paneli (kör parça) = **$3600\text{ mm}$**.
   - Her gövde çift kapaklı ($W_{\text{leaf}} \approx 438\text{ mm}$), iç açıklık $LW = 846\text{ mm} < 950\text{ mm}$ (sehim riski sıfır).
2. **3 Eşit Gövdeli Yerleşim (`layout_3_equal`):**
   - $3 \times 1180\text{ mm}$ gövde + $2 \times 30\text{ mm}$ duvar dolgu paneli = **$3600\text{ mm}$**.
   - Her gövde 2 bölmeli (ara dikmeli, bölme başı $LW = 563\text{ mm}$) veya sürgülü kapaklı.
3. **Karma Fonksiyonel Yerleşim (`layout_mixed_functional`):**
   - Sol Askı Kulesi ($1000\text{ mm}$) + Orta Çekmece/Pantolonluk/Vitrin Kulesi ($900\text{ mm}$) + Sağ Uzun Askı Kulesi ($1000\text{ mm}$) + Ayakkabı/Çanta Kulesi ($640\text{ mm}$) + $2 \times 30\text{ mm}$ dolgu paneli = **$3600\text{ mm}$**.

### 1.2 Çoklu Seçim, Toplu İşlemler ve Dağıtım Fonksiyonları
- **Eşit Genişlik Dağıtımı (`distributeModulesEqually`):** Seçili modülleri verilen duvar açıklığına eşit böler, kalan $15\text{–}100\text{ mm}$ boşluk için otomatik duvar bitiş dolgu paneli (`tpl_cm_04_wall_filler`) önerir ve oluşturur.
- **Sabit / Esnek (Fixed / Flexible) Genişlik Dağıtımı (`distributeModulesWithFixedAndFlexible`):** Cihaz modüllerini (ör. $600\text{ mm}$ ankastre fırın veya bulaşık makinesi) sabit tutar (`isFixedWidth: true`), kalan duvar boşluğunu esnek dolaplara eşit dağıtır.
- **Toplu Ölçü ve Malzeme Değiştirme (`batchUpdateModules`):** Çoklu seçilen modüllerin yükseklik, derinlik, baza, gövde/kapak malzemesi, kapak sistemi, kulp ve donanım markasını tek işlemde günceller.

---

## 2. FAZ 09 — GARDIROP İÇ DÜZEN SİHİRBAZLARI VE MUTFAK OTOMASYONU

### 2.1 Gardırop İç Düzen Sihirbazları (6 Parametrik İç Şablon)
Seçilen iç düzen şablonu (`applyWardrobeInteriorWizard`), dolabın o anki gerçek net iç yüksekliğine ($H_{\text{inner}}$) ve bölme genişliğine ($LW_i$) otomatik ölçeklenir:
1. **`wiz_hanging_heavy` (Askılık Ağırlıklı):** Üstte Servetto/Häfele asansör askılık (`isLiftMechanism: true`, $Y = H_{\text{inner}} - 120\text{ mm}$), ortada sabit ara raf ve altta ikinci askı borusu.
2. **`wiz_shelf_heavy` (Raf Ağırlıklı):** System 32 adımlarına ($32\text{ mm}$) yuvarlanmış eşit aralıklı 5–6 katlı kıyafet rafı.
3. **`wiz_drawer_heavy` (Çekmeceli):** Altta 4 adet frenli çekmece ($180\text{ mm}$), üstte 3 adet raf.
4. **`wiz_shoe_tower` (Ayakkabılık):** Alttan yukarıya 5 adet eğimli raylı ayakkabılık rafı (`shoe_rack`, $160\text{ mm}$ adım) + üstte çanta rafları.
5. **`wiz_mixed_organizer` (Karma Düzen):** Üst bagaj rafı ($Y = H_{\text{inner}} - 350\text{ mm}$), altında askı borusu, alt kısımda 2 çekmece + teleskopik pantolonluk (`trouser_rack`).
6. **`wiz_walkin_luxury` (Lüks Giyinme Odası):** Açık cephe veya füme cam kapak, takı çekmecesi, LED aydınlatma profili (`led_profile`), raf arası dikme (`subDivider`) ve çift askı.

### 2.2 Mutfak Otomasyonu (6 Mutfak Tipi + Otomatik Tamamlayıcı Parçalar)
- **6 Mutfak Yerleşim Sihirbazı:** Düz (`kitchen_straight`), L Mutfak (`kitchen_l`), U Mutfak (`kitchen_u`), Paralel (`kitchen_parallel`), Ada (`kitchen_island`) ve Yarımada (`kitchen_peninsula`).
- **Otomatik Tamamlayıcı Parça Üretici (`generateKitchenComplementaryParts`):**
  Alt ve üst dolap diziliminden otomatik olarak:
  1. **Tezgâh (`countertop`):** Yan yana duran tüm alt dolapları ($H = 720\text{ mm}$) tek parça örten $40\text{ mm}$ kalınlığında, $600\text{ mm}$ derinliğinde tezgâh.
  2. **Tezgâh Arası (`backsplash`):** Alt ve üst dolap arasındaki $600\text{ mm}$ yüksekliğinde duvar kaplama paneli.
  3. **Boydan Ön Baza (`plinth_strip`):** Tüm alt ve boy dolapların altını birleştiren kesintisiz baza.
  4. **Duvar Bitiş Dolgusu (`wall_filler`) ve Görünür Yan Bitiş Paneli (`end_panel`):** Duvar tarafına kör parça, açıkta kalan uca kapak malzemesinden bitiş paneli.
  5. **Üst Kapama / Taç (`top_infill`) ve Servis Boşluğu (`service_spacer`):** Tavan boşluğu ve ankastre havalandırma payı.
