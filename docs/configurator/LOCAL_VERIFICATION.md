# Birim V3.1 / V4 — Yerel Kurulum, GitHub Push ve Doğrulama Rehberi (`LOCAL_VERIFICATION.md`)

Bu rehber, teslim edilen tam `birim-configurator-v4-complete.zip` paketini kendi bilgisayarınıza açtıktan sonra nasıl çalıştıracağınızı, test edeceğinizi ve GitHub'a (`feat/configurator-parametric-engine-v4` dalına) nasıl göndereceğinizi adım adım açıklar.

## 1. Paketi Proje Klasörünüze Çıkartma ve GitHub'a Push Etme

1. İndirdiğiniz **`birim-configurator-v4-complete.zip`** dosyasını yerel `birim-configurator` proje klasörünüzün içine çıkartın (mevcut dosyaların üzerine yazmasına izin verin; `node_modules` ve `.git` klasörleriniz korunur):
   ```bash
   unzip -o birim-configurator-v4-complete.zip
   ```
2. Otomatik dal, test, commit ve GitHub push betiğini çalıştırın:
   ```bash
   bash apply-v4-branch.sh
   ```
   *(Bu betik `feat/configurator-parametric-engine-v4` dalına geçer, tüm V4.1/V4.2/V4.3 dosyalarını ve `docs/configurator/` raporlarını ekler, birim testlerini çalıştırır ve `--force-with-lease` / `--force` ile GitHub'a push eder.)*

## 2. Yerel Bilgisayarda Çalıştırma ve Test Komutları

```bash
# 1. TypeScript tip kontrolü (0 hata beklenir)
npm run lint

# 2. Vitest birim ve regresyon testleri (tests/v43-customer-factory-integration.test.ts dahil)
npm test

# 3. Geliştirme sunucusunu başlatma (varsayılan port: 3300)
npm run dev
```

## 3. Tarayıcı Üzerinde Doğrulanacak Senaryolar (`http://localhost:3300`)

### Senaryo A — Mağazada Müşteri & Satış Danışmanı Deneyimi (`/v3/studio` & `/v3/showroom`)
1. `http://localhost:3300/v3/studio` adresini açın.
2. **Tek Tıkla Otomatik Düzeltme (`✨ Oto-Düzelt`)**: Genişliği `1600 mm` ve bölme sayısını `1` yapın. Sağ paneldeki **V4 Uyumluluk** kartında yer alan **`✨ Oto-Düzelt`** butonuna tıklayın; modülün otomatik olarak güvenli bölmelere ayrıldığını ve kapak/sehim uyarılarının giderildiğini doğrulayın.
3. **Tüm Modüllere Malzeme Eşitleme (`Tümüne Uygula`)**: Alt bardan `+ Aynı Modülden Ekle` ile ikinci bir modül ekleyin. Sol panelden **Yüzey** sekmesine geçip bir kapak malzemesi seçin ve **`Tümüne Uygula`** butonuna tıklayarak tüm modüllerin aynı yüzeye güncellendiğini görün.
4. **Showroom & Patlatılmış Görünüm (`Exploded View`)**: Üst bardan **Showroom** moduna geçin. Sağdaki kaydırıcılarla **Kapak (`0°–90°`)**, **Çekmece (`0–350mm`)** ve **Patlatılmış (`%0–%100`)** görünümü hareket ettirerek gövde, arkalık, raf, çekmece ve kulpların gerçek zamanlı ayrıştığını inceleyin.

### Senaryo B — 2D + 3D Mekân Planlama (`/v3/plan`)
1. Üst bardan **Plan (2D+3D)** moduna geçin.
2. Üst şeritten **L Tipi Mutfak (90° Köşe)** veya **Doğrusal Mutfak (3.2m)** şablonunu seçin.
3. 2D planda modülleri sürükleyin, duvar/engel ekleyin veya `Ctrl+Z` / `Ctrl+Y` ile geri/ileri alın; sağdaki 3D/2D görünüş panelinin anında senkronize olduğunu doğrulayın.

### Senaryo C — Fabrikada Üretim Planlamacısı Portalı (`Kesim & BOM`)
1. Alt bardaki **`Kesim & BOM`** butonuna tıklayın.
2. **Net Kesim & Delik Tablosu** sekmesinde her parçanın hem **Bitmiş (Boy×En)** hem de kenar bandı kalınlığı düşülmüş **Testere Net (mm)** ölçüsünü, **Bant Kodunu** (`4K (2B+2E) 1mm` vb.) ve satır sonundaki **`DXF`** indirme butonunu kontrol edin.
3. Üst bardaki **`Tüm Paneller DXF`** butonuna tıklayarak tüm projenin katmanlı AutoCAD DXF (`$INSUNITS = 4`) dosyasını indirin.
4. **`Fabrika Doğrulama & Sehim`** sekmesine geçerek **6 Aşamalı Deterministik Üretim Doğrulama Kapısı** kartlarını ve **ISO 7170 Euler-Bernoulli Fiziksel Raf Sehim Tablosunu** inceleyin.
