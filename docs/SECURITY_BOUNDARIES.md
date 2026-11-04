# Güvenlik Sınırları ve İzolasyon Raporu (SECURITY_BOUNDARIES.md)

## 1. ERP ve Store İzolasyon Garantisi

Mevcut Birim sistemlerinde devam eden bağımsız güvenlik çalışmaları nedeniyle aşağıdaki kurallar mutlak olarak uygulanmıştır:

1. `Centan2025/birim-portal` ve `Centan2025/birim-store` kod tabanları **hiçbir şekilde değiştirilmemiştir**.
2. Bu repolarda commit, branch, PR veya deployment oluşturulmamıştır.
3. Canlı veya staging Supabase veritabanlarına hiçbir bağlantı açılmamış, DDL/DML çalıştırılmamıştır.
4. ERP/Store servis anahtarları, gizli JWT anahtarları bu projeye kopyalanmamıştır.
5. Entegrasyonlar `@birim/integrations` paketi altında **yalnızca tip sözleşmeleri ve mock adaptörler** seviyesinde tutulmuştur.

---

## 2. Uygulama İçi Güvenlik Katmanları

1. **Giriş Doğrulama (Zod Validation)**:
   - İstemciden veya dış sistemlerden gelen tüm JSON yükleri `DesignProjectSchema` ve `ModuleInstanceSchema` ile çalışma zamanında sıkı şekilde doğrulanır.
   - Negatif ölçüler, devasa limit aşımları ve geçersiz parametreler anında reddedilir.
2. **Şube İzolasyonu (Branch Isolation)**:
   - Veri modeli ve entegrasyon snapshot yapısı baştan `branch_id` (örn: `branch_vadistanbul`) içerecek şekilde kurgulanmıştır.
   - İlerideki Supabase RLS politikalarında şube personeli yalnızca kendi şubesine ait tasarımları sorgulayabilecektir.
3. **Versiyon Bütünlüğü ve İmmutability**:
   - Teklife veya siparişe bağlanan bir tasarım versiyonu (`is_locked = true`) değiştirilemez.
   - Her değişiklik yeni bir versiyon numarası (`v2, v3...`) ile ayrı kayıt altına alınır.
