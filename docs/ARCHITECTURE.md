# Birim Configurator — Mimari Tasarım Belgesi (ARCHITECTURE.md)

## 1. Mimari Vizyon ve İlkeler

`birim-configurator`, Birim markasının özel mobilya ve mutfak üretim standartlarını mağaza personeli için hızlı, hatasız ve doğrudan üretime bağlanabilir bir konfigürasyon platformuna dönüştürmek amacıyla tasarlanmıştır.

### Temel Mimari Kural
> **3D Geometri hiçbir zaman üretim verisinin tek doğruluk kaynağı değildir.**

Sistem mimarisinde doğruluk kaynağı (Single Source of Truth), **Parametrik Tasarım Modeli (`DesignProject` ve `ModuleInstance`)**'dir.
- **2D Görünüşler** (Elevation ve Plan),
- **3D Etkileşimli Görselleştirme** (Three.js WebGL),
- **Maliyet ve Fiyatlandırma** (Pricing Engine),
- **Kesim Listesi ve BOM** (Manufacturing Engine),
doğrudan bu ortak parametrik çekirdekten deterministik olarak türetilir.

---

## 2. Monorepo Paket Yapısı ve Sorumluluk Dağılımı

```text
birim-configurator/
├── apps/
│   └── configurator/           # Next.js App Router (UI, Viewport, Store entegrasyonu)
├── packages/
│   ├── core/                   # Tipler, Zod şemaları, parametrik kurallar, varsayılanlar
│   ├── geometry/               # 3D Mesh jeneratörü, 2D kot & projeksiyon hesaplayıcı
│   ├── catalog/                # Gardırop ve mutfak şablonları, oda/mekân düzenleri
│   ├── pricing/                # Sunucu doğrulanabilir fiyatlandırma motoru
│   ├── manufacturing/          # Net parça listesi, kenar bandı, donanım BOM ve plaka hesabı
│   └── integrations/           # Store CPQ ve ERP Blueprint adaptör sözleşmeleri
├── tests/                      # Kapsamlı Vitest birim ve entegrasyon testleri
└── docs/                       # Mimari, üretim, veritabanı ve güvenlik dokümantasyonu
```

### Paketlerin Görevleri:
1. **`@birim/core`**: Tüm sistemin paylaştığı saf veri tipleri, Zod doğrulama kuralları, min/max sınırları, sarkma (deflection) limitleri ve başlangıç durumları.
2. **`@birim/geometry`**: Parametrik modeli girdi alarak her panelin, kapağın, çekmecenin milimetrik lokal koordinatlarını, pivotlarını ve 2D teknik çizim kot çizgilerini hesaplar.
3. **`@birim/catalog`**: Birim mağazalarında en çok satan hazır modül şablonları (2 kapaklı, 3 kapaklı master, açık giyinme ünitesi, doğrusal mutfak blokları).
4. **`@birim/pricing`**: $m^2$ panel alanı, fire faktörü (%12), kenar bandı metresi, hırdavat kalemleri, işçilik saatleri, fabrika genel gider payı, kâr marjı ve KDV hesaplama motoru.
5. **`@birim/manufacturing`**: Selco WNT 600 ebatlama testeresi ve CNC delik merkezine uygun net kesim listesi, 4 kenar bant konfigürasyonu ve BOM dökümü.
6. **`@birim/integrations`**: Birim Store ve Birim ERP ile güvenli, tip korumalı API adaptör katmanı.

---

## 3. Veri Akışı Şeması

```mermaid
flowchart TD
    User([Mağaza Personeli]) -->|Genişlik / Malzeme / Donanım| UI[Next.js App / Zustand Store]
    UI -->|Doğrulama & Güncelleme| Core[@birim/core Parametrik Model]
    Core --> Geometry[@birim/geometry Motoru]
    Core --> Mfg[@birim/manufacturing BOM Motoru]
    Geometry --> View3D[Three.js 3D WebGL Sahnesi]
    Geometry --> View2D[SVG 2D Ön / Plan Çizimi]
    Mfg --> Pricing[@birim/pricing Motoru]
    Mfg --> ERPAdapter[Mock Birim ERP Blueprint]
    Pricing --> StoreAdapter[Mock Birim Store CPQ]
```
