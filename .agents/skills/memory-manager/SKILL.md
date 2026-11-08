---
name: memory-manager
description: Kurumsal AI Context V2.1 kalıcı hafıza (L1/L2/L3), Context Capsule, Serena Seviye A/B protokolü, Evidence Invalidation, Basic Memory izolasyonu ve Handoff yöneticisi.
---

# Memory Manager Skill (`birim-configurator` — V2.1)

Bu skill; oturum başlangıcı doğrulaması (Wake-up), görev bağlamı yönetimi (Context Capsule), Serena sembol protokolü (Seviye A/B), kanıt geçerliliği (Evidence Index), Basic Memory izolasyonu, oturum devri (Handoff) ve görev sonu sıkıştırma (Check-in) süreçlerini otomatikleştirir.

## 1. Oturum Başlangıç (Wake-up) Protokolü

Her yeni oturumda kod okumaya başlamadan önce sırasıyla:
1. **L1 & L2 Yükle:** `AGENTS.md` (<= 60 satır) ve `docs/ai-context/current-state.md` (<= 50 satır) dosyalarını oku.
2. **Git & Delta Kontrolü:** `git status --short` ve `git rev-parse --short HEAD` çalıştır.
3. **Evidence Invalidation:**
   - Eğer `current-state.md` içindeki `Last Verified Commit` ile mevcut `HEAD` farklıysa:
     ```powershell
     git diff <Last_Verified_Commit>..HEAD --name-status
     ```
   - Değişen dosyaları `docs/ai-context/evidence-index.md` içindeki `source_paths` ile eşleştir.
   - İlgili kararları gözden geçir: etki varsa `[STALE]`, çelişki varsa `[CONFLICT]`, güncellenmişse yeni commit ile `[VERIFIED]` olarak güncelle. Değişmeyen kayıtlara dokunma.
4. **Serena MCP Aktivasyonu:**
   - Serena MCP aktifse `activate_project` çağır. Sembol keşfinde Seviye A protokolünü uygula.
   - Serena MCP aktif değilse `docs/ai-context/module-map.md` + `git grep -n` fallback zincirini kullan.
5. **Basic Memory Salt-Okunur Kontrol:**
   - İhtiyaç halinde `bm_project(command="list")` ile projeyi salt-okunur kontrol et. Asla otomatik `main` alanına yazma yapma.

## 2. Görev Sırasında Akıllı Kod Erişimi ve Context Capsule

1. **Context Capsule Belirle:** `docs/ai-context/context-capsule.md` rehberine göre görevi sınıflandır (Parametrik, 3D/2D, İmalat, UI vb.) ve hedef modül/sembol sınırlarını çiz.
2. **Serena Seviye A — Kısa Sembol Keşfi (Varsayılan):**
   - Dosya sembol yapısı için: `s.lsp.get_symbols_overview(relative_path)`
   - Sembol arama için: `s.lsp.find_symbol(name_path_pattern, include_body=False, include_info=True)`
   - Referanslar için: `s.lsp.find_referencing_symbols(name_path, relative_path)`
   - Fonksiyon gövdesi ilk adımda **yüklenmez**; yalnızca satır aralığı ve imza alınır.
3. **Serena Seviye B — Hedefli Gövde Okuma (Genişletilmiş):**
   - Yalnızca kod değiştirilecekse, veri akışı anlaşılamıyorsa veya güvenlik denetimi gerekiyorsa sembol gövdesi açılır veya `read_file` ile `StartLine`/`EndLine` penceresi okunur.
   - Tüm kaynak dosyalarını baştan sona okumak (`StartLine`/`EndLine` olmaksızın) kesinlikle yasaktır.

## 3. Görev Sonu (Check-in, Handoff ve Sıkıştırma) Protokolü

1. **Delta Güncelleme (`docs/ai-context/current-state.md`):**
   - Yalnızca `Last Verified Commit`, tarih, son tamamlanan işler ve açık görevleri güncelle.
   - Aktif özet **50 satırı aşarsa** eski maddeleri `docs/ai-context/history/YYYY-MM-archive.md` içine taşı.
2. **Karar ve Kanıt Kaydı (`docs/ai-context/decisions.md` & `evidence-index.md`):**
   - Yeni mimari kararı `DEC-XXX` olarak `#etiket`, göreli dosya yolu, commit hash ve `[VERIFIED]`/`[UNVERIFIED]` ile kaydet.
   - `docs/ai-context/evidence-index.md` içine kaynak dosyalarıyla birlikte yeni kanıt kaydını ekle.
3. **Oturum Devri (`docs/ai-context/handoff.md`):**
   - Oturum tamamlandığında veya başka bir ajana devredilirken `docs/ai-context/handoff.md` şablonunu güncel durum, testler ve sonraki adımlarla doldur.
4. **Güvenlik ve Sınırlar:**
   - Hafıza dosyalarına asla `.env`, token, parola veya mutlak dosya yolu (`C:\...`) yazma.
   - Kullanıcı açıkça talep etmedikçe `git commit`, `git push` veya deploy yapma.

## 4. Basic Memory İzolasyon ve Senkronizasyon Standardı

1. **Markdown SSOT:** Git deposundaki `docs/ai-context/*.md` dosyaları daima projenin birincil tek doğruluk kaynağıdır (SSOT).
2. **Projeye Özel Ad Alanı (`birim-configurator`):** Basic Memory üzerinde işlem yapılırken daima projeye özgü ad alanı (`project="birim-configurator"`) hedeflenir.
3. **`main` Alanına Yazma Yasağı:** `main` alanı global/ortak sistem alanıdır. Hiçbir projeye varsayılan yazma hedefi olarak **kullanılamaz**. `project` parametresi olmadan varsayılan yazma çağrıları kesinlikle yapılamaz.
4. **Salt-Okunur Doğrulama:** Oturum başında veya bağlantı testlerinde `bm_project(command="list")` ve hedef proje için `bm_find(project="birim-configurator")` yalnızca salt-okunur kullanılır. Kullanıcıdan açık onay alınmadan proje oluşturulmaz, kayıt yazılmaz, taşınmaz veya silinmez.
5. **Çift Yazma (Dual-Write) Yasağı:** Her kod değişikliğinde Markdown dosyalarıyla Basic Memory arasında otomatik çift yazma döngüsü kurulmaz.
