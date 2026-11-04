# Birim Store ve ERP Entegrasyon Sözleşmesi (STORE_ERP_INTEGRATION.md)

## 1. Entegrasyon Akışı

```text
Mağaza Personeli
     │
     ▼
[Birim Configurator]
  • 3D & 2D Parametrik Tasarım
  • Otomatik Parça & Fiyat Hesaplama
     │
     ├── (1. Teklif Aşaması) ──► [Birim Store CPQ]
     │                           • Teklif kalemine snapshot bağlama
     │                           • Satış fiyatını teklif sepetine ekleme
     │                           • Tasarım versiyonunu kilitleme (is_locked=true)
     │
     └── (2. Sipariş Onayı)  ──► [Birim ERP]
                                 • Sipariş onaylandıktan sonra tetikleme
                                 • public.production_blueprints tablosuna yazma
                                 • Selco WNT 600 ebatlama & CNC iş emri rotalama
```

---

## 2. API Kontratları

### 2.1 Birim Store CPQ Adaptörü (`MockStoreAdapter`)
- **İstek**: `createOrUpdateQuoteItem(project, bom, pricing, quoteId)`
- **Payload Biçimi**:
  - `quoteId`: Mevcut teklif ID'si
  - `configuratorSnapshot`:
    - `designId`: Tasarım UUID
    - `version`: Kilitleme yapılan versiyon
    - `calculatedPriceEur` / `calculatedPriceTry`: Sunucuda doğrulanmış fiyat
    - `materialsSummary`: Seçilen gövde/kapak malzemeleri
    - `bomSummary`: Toplam parça adedi, $m^2$ alan ve hırdavat sayısı

### 2.2 Birim ERP Production Blueprint Adaptörü (`MockERPAdapter`)
- **Hedef ERP Tablosu**: `public.production_blueprints`
- **Payload Biçimi**:
  - `order_id`: Sipariş numarası
  - `version`: Tasarım versiyonu
  - `items`: Her bir net ebatlı panel parça kaydı
    - `piece_id`: Tekil parça kimliği
    - `label`: Parça adı (Sol Yan, Alt Tabla vb.)
    - `material`: Hammadde adı
    - `dimensions_mm`: `[boy, en, kalınlık]`
    - `edge_banding`: Üst, Alt, Sol, Sağ bant bayrakları ve kalınlığı (1mm/2mm)
    - `grain`: Damar yönü (boyuna/enine)
    - `workshops`: İş merkezi rota dizisi: `["ebatlama", "kenar_bantlama", "delik_ve_freze", "boyahane", "montaj_paketleme"]`
  - `hardware_items`: Blum menteşeler, raylar, kulplar, bağlantı elemanları dökümü
