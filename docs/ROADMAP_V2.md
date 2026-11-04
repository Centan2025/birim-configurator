# Geliştirme Yol Haritası V2 (ROADMAP_V2.md)

## V2 Tamamlanan Fazlar Durumu

| Faz | Başlık | Durum |
| :--- | :--- | :--- |
| **Faz 0** | Mevcut Kodun Derin Denetimi (P0/P1 Analizi) | **TESTED** |
| **Faz 1** | Parametrik Mobilya Motoru V2 (Çoklu Modül, Kısıt Çözücü, Kararlı ID'ler) | **TESTED** |
| **Faz 2** | Profesyonel Dolap Tasarımcısı (Sürgülü, Açık, Köşe, Pantolonluk, Ayakkabılık) | **TESTED** |
| **Faz 3** | Profesyonel Mutfak Tasarımcısı (Doğrusal, L, U Yerleşimleri, Evye, Kiler) | **TESTED** |
| **Faz 4** | Gelişmiş 2D/3D Editör (Patlatılmış Montaj, Çekmece Hareketi, Düşey Kesit) | **TESTED** |
| **Faz 5** | İmalat Mühendisliği V2 (System 32 Delikler, 2D Giyotin Nesting, Selco XML) | **TESTED** |
| **Faz 6** | Fiyatlandırma & Satış V2 (CNC Maliyeti, Alternatif Malzeme Kıyaslaması) | **TESTED** |
| **Faz 7** | Profesyonel Teknik Çıktılar (CSV Kesim, DXF Çizim, Montaj Sırası Kılavuzu) | **TESTED** |
| **Faz 8** | Store & ERP Entegrasyonuna Hazırlık (Idempotency, Audit Log, İzolasyon) | **TESTED** |
| **Faz 12** | Akıllı Tasarım Yardımcısı (3600mm/1800mm Açıklık Bölme & Menteşe Hesabı) | **TESTED** |
| **Faz 13** | Test Sistemi (8 Referans Senaryo, 34 Test) | **TESTED** |

---

## Sonraki Geliştirme Öncelikleri (V3)

1. **Selco Fiziksel Saha Doğrulaması**: Fabrikadaki Selco WNT 600 operatörü ile `UNVERIFIED` bıçak kalınlığı ve kıskaç parametrelerinin fiziksel test parçası kesilerek doğrulanması.
2. **Canlı Supabase Entegrasyonu**: Birim ERP ve Store ekiplerinin devam eden güvenlik ve RLS güncellemeleri tamamlandığında `configurator.*` şemasının canlı veritabanına bağlanması.
3. **Mutfak Tezgâhında Evye/Ocak Boşluk Çizimi**: 2D/3D tezgâh üzerinde evye ve ankastre ocak yerleşim boşluklarının etkileşimli sürüklenip bırakılması.
