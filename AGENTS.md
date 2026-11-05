# Birim Configurator — ajan başlangıç kuralları

Bu dosya bu deponun tamamına uygulanır. Kullanıcının güncel talimatları önceliklidir.

## Önce oku

1. `docs/NEXT_AGENT_HANDOFF.md` — mevcut çalışma, kritik uyarılar ve ilk adımlar.
2. `docs/V41_ACCEPTANCE_REPORT.md` — nelerin gerçekten kabul edildiği ve edilmediği.
3. `docs/V42_PLUS_EXECUTION_ROADMAP.md` — bağımlılıklar, iş paketleri ve kabul koşulları.
4. Yapacağın işle ilgili `docs/V41_BUG_REGISTER.md` ve ilgili V41 doğrulama raporu.

## Çalışma sınırları

- Önce `git status --short`, mevcut dal ve son commitleri kontrol et. Önceki ajan değişikliklerinin commitlenmiş olduğunu varsayma. Var olan değişiklikleri silme, üzerine yazma veya körlemesine geri alma.
- Yalnız `birim-configurator` deposunu değiştir. `birim-portal` ve `birim-store` depolarını değiştirme.
- Ortak staging/production Supabase ortamlarına bağlanma veya yazma; gerçek müşteri/sipariş/üretim verisi kullanma. Production deployment yapma. Kullanıcı kapsamı açıkça değiştirmedikçe bu sınırlar geçerlidir.
- Doğrulanmamış montaj ölçüsü, ürün kinematiği veya CNC kuralı uydurma. Kaynak, sürüm ve doğrulama kapsamı olmadan üretim onayı verme.
- Mevcut `UNVERIFIED` üretim engelini, ERP kontrolünü veya Selco taslak statüsünü testi geçirmek için kaldırma. Yerel test fixture'ındaki doğrulama bayrağı gerçek fabrika onayı değildir.
- V2/V3 rotalarını ve önceki tasarımların yüklenmesini koru. Şema değişikliklerinde açık sürüm ve geriye uyumlu migration kullan.

## Doğrulama ve devamlılık

- Raporlardaki sayılar tarihli kanıttır; güncel başarı kanıtı olarak tekrar kullanma. Değişikliğe uygun testleri çalıştır ve sonuçları tarih/kapsamıyla kaydet.
- Geliştirme sunucusu 3300 portundadır. Tarayıcı kabulünde `BIRIM_AUDIT_BUILD=1` ile `.next-v41` derlemesini ve `playwright.v41.config.ts` üzerinden 3311 portunu kullan. Aynı `.next` klasöründe eşzamanlı dev/build çalıştırma; başka bir sunucuyu körlemesine kapatma.
- Geometri/kulp/kapak değişikliklerinde model → state → 2D/3D → BOM/fiyat → kaydet/yükle zincirini denetle. Yalnız DOM etiketi veya buton varlığı yeterli değildir.
- Bir işi test, kalıcılık ve ilgili veri doğrulaması olmadan `DONE` yapma. Görsel aday dosyalarını incelemeden onaylı referans sayma.
- Her anlamlı çalışma sonunda yol haritasının ilerleme kaydını ve `NEXT_AGENT_HANDOFF.md` dosyasını güncelle: değişiklikler, çalıştırılan testler, kalan sorun, somut sonraki adım ve commitlenmemiş dosyalar. Tarihli V41 kanıtlarını yeni sonuçlarla sessizce değiştirme.

