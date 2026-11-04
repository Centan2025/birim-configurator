# Geliştirme Yol Haritası (ROADMAP.md)

## Faz Durum Özeti

| Aşama | Başlık | Durum |
| :--- | :--- | :--- |
| **Faz 0** | İnceleme, İzolasyon Sınırları ve Mimari Tasarım | **Tamamlandı** |
| **Faz 1** | Monorepo Kurulumu, Next.js App, TypeScript Paketleri | **Tamamlandı** |
| **Faz 2** | Ortak Parametrik Çekirdek, Validasyonlar & Birim Testleri | **Tamamlandı** |
| **Faz 3** | Dolap MVP (2D CAD Görünüş, 3D WebGL, Malzeme, Undo/Redo) | **Tamamlandı** |
| **Faz 4** | Hesaplama Motorları (Fiyatlandırma, BOM, Kesim Listesi) | **Tamamlandı** |
| **Faz 5** | Mutfak Temeli (Modül Şablonları, Doğrusal Mekân Yerleşimi) | **Tamamlandı** |
| **Faz 6** | Entegrasyon Hazırlığı (Store CPQ & ERP Blueprint Adaptörleri) | **Tamamlandı** |

---

## Gelecek Aşamalar (Faz 7+)

1. **Selco WNT 600 Doğrudan Sawing Pattern Export**:
   - Selco ebatlama yazılımı için `.cix` veya XML formatında kesim planı üretimi.
2. **Köşe ve L-Mutfak 3D Ray-Tracing Render**:
   - Gelişmiş mutfak yerleşimleri için köşe dolap mekanizmalarının ve tezgâh bindirmelerinin 3D görselleştirmesi.
3. **Canlı Supabase Entegrasyonu**:
   - Birim ERP ve Store ekiplerinin güvenlik çalışmaları tamamlandığında, `configurator.*` şemasının canlı Supabase veritabanına kontrollü migrasyonu.
