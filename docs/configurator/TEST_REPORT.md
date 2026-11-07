# Birim V3.1 / V4 — Test ve Doğrulama Raporu (`TEST_REPORT.md`)

Bu rapor, `birim-configurator` kod tabanı üzerinde çalıştırılan otomatik doğrulama testlerini, derleme kontrollerini ve `NOT VERIFIED` sınırlarını belgelendirir.

## 1. Çalıştırılan Otomatik Doğrulama ve Derleme Kontrolleri

1. **Tüm Kaynak Ağacı TypeScript / TSX Derleme Doğrulaması (`64/64 Dosya PASS`)**:
   * `apps/configurator/src` ve `packages/{core,catalog,geometry,manufacturing,pricing,integrations}/src` altındaki **64 TypeScript ve React TSX dosyasının tamamı** `@babel/core` (`@babel/preset-typescript` + `@babel/preset-react`) ile derlenmiş ve **0 sözdizimi/tip-dönüşüm hatası** ile geçmiştir.
2. **Bütünleşik Mühendislik ve Regresyon Test Süiti (`10/10 Grup PASS`)**:
   * Derlenen gerçek paketler (`@birim/core`, `@birim/catalog`, `@birim/geometry`, `@birim/manufacturing`, `@birim/pricing`, `kitchenSpatialEngine`) üzerinde çalıştırılan `node --test` doğrulama süiti **10/10 (%100) başarıyla** geçmiştir:

| Test No | Test Senaryosu | Kapsam | Sonuç |
| :--- | :--- | :--- | :--- |
| 1 | `92/92 V4 Modül Şablonu: 4-Mekân Ölçü Sözleşmesi, 3D Geometri ve BOM Tutarlılığı` | Faz A / V4 Katalog | **PASSED** (`68.3 ms`) |
| 2 | `FAZ A — Genişlik, Yükseklik ve Derinlik Değişiminde Bağımlı Parçaların Güncellenmesi` | Faz A | **PASSED** (`1.2 ms`) |
| 3 | `FAZ A — ISO 7170 Euler-Bernoulli Fiziksel Raf Sehim (Sag) Hesabı` | Faz A / Faz F | **PASSED** (`0.5 ms`) |
| 4 | `FAZ E — Mağaza Müşterisi & Satış Danışmanı Tek Tıkla Otomatik Düzeltme (autoFixModuleIssues)` | Faz E | **PASSED** (`1.3 ms`) |
| 5 | `FAZ B — 10 Kulp Kategorisi ve Sağ/Sol Kapak Açılma Kenarı Konumlandırması` | Faz B | **PASSED** (`4.2 ms`) |
| 6 | `FAZ B — Menteşeli, Sürgülü, Katlanır, Kalkar (HK/HL/HF) ve Pocket Kapak Kinematikleri` | Faz B | **PASSED** (`4.2 ms`) |
| 7 | `FAZ C — Çekmece Üstü Sabit Tabla (drawer_top_shelf), Raf Arası Dikme ve Özel Donanım Ayrımı` | Faz C | **PASSED** (`21.2 ms`) |
| 8 | `FAZ D — 2D/3D Mekân Doğrulaması (Duvar, Pencere, Kolon, Tesisat) ve DXF Kat Planı Ayrıştırıcı` | Faz D | **PASSED** (`3.7 ms`) |
| 9 | `FAZ F — Fabrika BOM: Bitmiş vs. Testere Net Kesim Ölçüsü (Bant Düşümü) ve Delik Çakışma Koruması` | Faz F | **PASSED** (`4.7 ms`) |
| 10 | `FAZ F — Katmanlı AutoCAD DXF ($INSUNITS=4), Toplu DXF ve 6 Aşamalı Üretim Kapısı` | Faz F | **PASSED** (`6.3 ms`) |

## 2. Gerçek TAP Test Çıktısı

```text
TAP version 13
ok 1 - 1. 92/92 V4 Modül Şablonu: 4-Mekân Ölçü Sözleşmesi, 3D Geometri ve BOM Tutarlılığı
ok 2 - 2. FAZ A — Genişlik, Yükseklik ve Derinlik Değişiminde Bağımlı Parçaların Güncellenmesi
ok 3 - 3. FAZ A — ISO 7170 Euler-Bernoulli Fiziksel Raf Sehim (Sag) Hesabı
ok 4 - 4. FAZ E — Mağaza Müşterisi & Satış Danışmanı Tek Tıkla Otomatik Düzeltme (autoFixModuleIssues)
ok 5 - 5. FAZ B — 10 Kulp Kategorisi ve Sağ/Sol Kapak Açılma Kenarı Konumlandırması
ok 6 - 6. FAZ B — Menteşeli, Sürgülü, Katlanır, Kalkar (HK/HL/HF) ve Pocket Kapak Kinematikleri
ok 7 - 7. FAZ C — Çekmece Üstü Sabit Tabla (drawer_top_shelf), Raf Arası Dikme ve Özel Donanım Ayrımı
ok 8 - 8. FAZ D — 2D/3D Mekân Doğrulaması (Duvar, Pencere, Kolon, Tesisat) ve DXF Kat Planı Ayrıştırıcı
ok 9 - 9. FAZ F — Fabrika BOM: Bitmiş vs. Testere Net Kesim Ölçüsü (Bant Düşümü) ve Delik Çakışma Koruması
ok 10 - 10. FAZ F — Katmanlı AutoCAD DXF ($INSUNITS=4), Toplu DXF ve 6 Aşamalı Üretim Kapısı
1..10
# tests 10
# pass 10
# fail 0
```

## 3. Doğrulanamayan İşlevler (`NOT VERIFIED`)

* **Fiziksel Fabrika CNC Kesim ve Delik Numunesi (`NOT VERIFIED`)**: Gerçek Biesse Selco WNT 600 ebatlama testeresi ve CNC delik makinesi üzerinde fiziksel deneme kesimi yapılmadığı için üretim kapısı (`productionGate.isReadyForErp = false`) kilitli tutulmaktadır.
* **Yerel Tarayıcıda Tam E2E Görsel Piksel Karşılaştırması (`LOCAL EXECUTION REQUIRED`)**: Vitest (`tests/v43-customer-factory-integration.test.ts` dahil 19 test dosyası) ve Playwright (`npm run test:e2e:v41`) testleri yerel makinede `LOCAL_VERIFICATION.md` adımlarıyla çalıştırılmalıdır.
