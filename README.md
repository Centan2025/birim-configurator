# Birim Configurator — Parametrik Dolap ve Mutfak Platformu

Birim markası için özel olarak geliştirilmiş bağımsız, yüksek performanslı **Parametrik Dolap ve Mutfak Konfigürasyon Motoru**.

> **Ajanlar için başlangıç:** [AGENTS.md](AGENTS.md), [sonraki ajan devir notu](docs/NEXT_AGENT_HANDOFF.md) ve [V4.2+ ayrıntılı yol haritası](docs/V42_PLUS_EXECUTION_ROADMAP.md). Güncel denetim sonucu [V4.1 kısmi kabul raporundadır](docs/V41_ACCEPTANCE_REPORT.md); aşağıdaki genel özellik listesi tam ürün/üretim kabulü anlamına gelmez.

Mağaza personelinin hızlı tasarımı, eş zamanlı 2D teknik kot çizimleri, 3D WebGL etkileşimli görselleştirmesi, deterministik fiyatlandırması, parça kesim listesi (BOM) ve Birim Store / ERP entegrasyon altyapısını içerir.

---

## 🚀 Temel Özellikler

1. **Ortak Parametrik Mobilya Çekirdeği**:
   - Milimetrik deterministik hesaplama.
   - 3D geometri tek doğruluk kaynağı değildir; 2D, 3D, fiyat ve BOM doğrudan parametrik modelden türetilir.
   - Otomatik raf sehim (deflection) ve imalat sınır kontrolleri.
2. **2D Teknik CAD Görünüşleri**:
   - Ön görünüş (Elevation) ve Üstten görünüş (Plan).
   - Gerçek ölçü oranları, milimetrik kot çizgileri ve bölme sınırları.
   - İnteraktif yakınlaştırma, kaydırma ve parça seçimi.
3. **3D Etkileşimli Görselleştirme**:
   - Three.js WebGL sahnesi, orbit kamera kontrolleri.
   - İzometrik, Ön, Yan, Üst hazır kamera açıları.
   - PBR mobilya kaplamaları (Doğal Meşe, Ceviz, Mat Lake, Melamin, Füme Cam).
   - Kapak açma/kapama animasyonu ($0^\circ - 90^\circ$).
4. **BOM ve Kesim Listesi (Manufacturing Engine)**:
   - Net parça ölçüleri (Boy x En x Kalınlık).
   - 4 kenar bağımsız kenar bandı hesabı (ABS 1mm / 2mm).
   - Standart $2800 \times 2070\text{ mm}$ plaka bazında %12 fire paylı plaka optimizasyon önizlemesi.
   - Selco WNT 600 testere minimum kesim boyutu (70mm) kontrolü.
   - Blum menteşeler, raylar, minifix bağlantı elemanları hırdavat dökümü.
5. **Dinamik Fiyatlandırma Motoru**:
   - Hammadde maliyeti, kenar bandı maliyeti, hırdavat maliyeti, işçilik saatleri, fabrika genel gider payı, kâr marjı ve KDV hesabı.
   - Döviz (EUR / TRY) desteği.
6. **Güvenli Store & ERP Entegrasyon Köprüsü**:
   - Mevcut Birim Store ve Birim ERP veritabanlarından tamamen izole.
   - Store CPQ teklif kalemine bağlama adaptörü (`MockStoreAdapter`).
   - ERP Üretim Reçetesi (`public.production_blueprints`) adaptörü (`MockERPAdapter`).

---

## 🛠️ Kurulum ve Çalıştırma

### Gereksinimler:
- Node.js >= 18.x
- npm >= 9.x

### Bağımlılıkları Kurma:
```bash
npm install
```

### Testleri Çalıştırma:
```bash
npm run test
```

### Geliştirme Sunucusunu Başlatma:
```bash
npm run dev
```
Uygulama `http://localhost:3300` adresinde çalışacaktır.

### Üretim Derlemesi:
```bash
npm run build
```

---

## 📁 Mimari ve Dokümantasyon

Detaylı teknik belgeler `docs/` klasöründedir:
- [Mimari Tasarım (ARCHITECTURE.md)](docs/ARCHITECTURE.md)
- [Parametrik Motor (PARAMETRIC_ENGINE.md)](docs/PARAMETRIC_ENGINE.md)
- [Veritabanı Tasarımı (DATABASE_DESIGN.md)](docs/DATABASE_DESIGN.md)
- [Store ve ERP Entegrasyonu (STORE_ERP_INTEGRATION.md)](docs/STORE_ERP_INTEGRATION.md)
- [İmalat ve Kesim Kuralları (MANUFACTURING_RULES.md)](docs/MANUFACTURING_RULES.md)
- [Güvenlik ve İzolasyon Sınırları (SECURITY_BOUNDARIES.md)](docs/SECURITY_BOUNDARIES.md)
- [Test Raporu (TEST_REPORT.md)](docs/TEST_REPORT.md)
- [Yol Haritası (ROADMAP.md)](docs/ROADMAP.md)
