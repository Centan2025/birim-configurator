# Birim Configurator V2 — Mimari Tasarım Belgesi (ARCHITECTURE_V2.md)

## 1. Mimari Vizyon ve V2 İlkeleri

`birim-configurator` V2, Birim markasının özel mobilya ve mutfak imalat standartlarını mağaza personeli için hızlı, hatasız ve doğrudan CNC makinelerine bağlanabilir profesyonel bir CAD/CAM ve konfigürasyon platformuna dönüştürmüştür.

### Değişmez Temel Prensip
> **3D Geometri hiçbir zaman üretim verisinin tek doğruluk kaynağı değildir.**
> 
> Doğruluk kaynağı (Single Source of Truth), **Parametrik Tasarım Modeli (`DesignProject` & `ModuleInstance`)**'dir.

---

## 2. Monorepo Paketleri ve Sorumluluk Dağılımı

```text
birim-configurator/
├── apps/
│   └── configurator/           # Next.js 15 App Router (WebGL 3D, SVG 2D CAD, Kesit Görünüşü, Zustand)
├── packages/
│   ├── core/                   # Saf veri modelleri, Zod şemaları, kısıt çözücü, çarpışma tespiti
│   ├── geometry/               # 3D mesh jeneratörü, 2D kot & düşey kesit hesaplayıcı, patlatılmış montaj
│   ├── catalog/                # Gardırop ve mutfak şablonları, akıllı açıklık danışmanı
│   ├── pricing/                # CNC delik, fire, genel gider ve alternatif malzeme kıyaslama motoru
│   ├── manufacturing/          # System 32 delik motoru, 2D giyotin plaka optimizasyonu, Selco adaptörü
│   └── integrations/           # Store CPQ ve ERP Blueprint adaptörleri (Idempotent & Audit loglu)
├── tests/                      # 10 test paketi, 34 birim & entegrasyon testi
└── docs/                       # 11 adet kapsamlı V2 teknik dokümanı
```

---

## 3. V2 Veri Akışı ve Boru Hattı

```mermaid
flowchart TD
    User([Mağaza Personeli]) -->|Ölçü / Şablon / Donanım| UI[Next.js App / Zustand Store]
    UI -->|Doğrulama & Kısıt Çözücü| Core[@birim/core Parametrik Model]
    Core --> Geo[@birim/geometry Motoru]
    Core --> Mfg[@birim/manufacturing İmalat Motoru]
    Geo --> View3D[Three.js 3D Sahne - Patlatılmış / Çekmece Hareketli]
    Geo --> View2D[2D CAD Ön / Üst Plan / Düşey Kesit]
    Mfg --> Drilling[System 32 CNC Delik Motoru]
    Mfg --> Nesting[2D Giyotin Plaka Optimizasyonu]
    Mfg --> Pricing[@birim/pricing Maliyet & Alternatif Kıyaslama]
    Mfg --> Outputs[CSV / DXF / Montaj Adımları]
    Pricing --> StoreAdapter[Birim Store CPQ Adaptörü]
    Mfg --> ERPAdapter[Birim ERP Üretim Reçetesi]
```
