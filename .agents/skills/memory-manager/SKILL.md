---
name: memory-manager
description: Kalıcı proje hafızası (L1/L2/L3), oturum başı wake-up doğrulaması, Serena/sembol tabanlı kod erişimi ve görev sonu delta/arşivleme yöneticisi.
---

# Memory Manager Skill (`birim-configurator`)

Bu skill, her yeni oturumda tüm kod tabanını yeniden taramayı önlemek, bağlam şişmesini engellemek ve L1/L2/L3 hafıza katmanlarını güncel tutmak için kullanılır.

## 1. Oturum Başlangıcı (Wake-up Protokolü)

Her yeni oturumda kod okumaya başlamadan önce sırasıyla şu adımları uygula:

1. **L1 & L2 Okuma:**
   - `AGENTS.md` (L1 — <= 60 satır) ve `docs/ai-context/current-state.md` (L2 — <= 50 satır) dosyalarını oku.
2. **Git & Delta Kontrolü:**
   - `git status --short` ve `git rev-parse --short HEAD` çalıştır.
   - `current-state.md` içindeki `Last Verified Commit` ile mevcut `HEAD` farklıysa:
     ```powershell
     git diff <Last_Verified_Commit>..HEAD --stat
     ```
     komutuyla yalnız değişen dosyaları tespit et ve hafızada eski kalan yerleri `[STALE]` olarak işaretle.
3. **Serena MCP / Sembol Aktivasyonu:**
   - Ortamda Serena MCP aktifse `activate_project` çağır ve sembol aramalarında `get_symbols_overview` / `find_symbol` kullan.
   - Serena MCP aktif değilse `docs/ai-context/module-map.md` + `git grep -n "<sembol>"` kullanarak hedef dosyanın tam satır numarasını bul ve `read_file` aracını yalnızca `StartLine` / `EndLine` aralığıyla çağır.

## 2. Görev Sırasında Akıllı Kod Erişimi

- **Yasak:** Kaynak dosyaları (`V3UnifiedWorkspace.tsx`, `V3CadViewport2D.tsx`, `mesh-generator.ts` vb.) `StartLine`/`EndLine` vermeden baştan sona okumak veya tüm `docs/` klasörünü otomatik yüklemek.
- **Zorunlu Sıra:**
  1. `docs/ai-context/module-map.md` üzerinden sorumlu paketi/dosyayı bul.
  2. Gerekirse `git grep -n "#etiket" docs/ai-context/decisions.md` ile geçmiş kararları sorgula.
  3. Hedef sembolün satır numarasını `find_symbol` veya `git grep -n` ile bulup yalnız ilgili 40–80 satırlık pencereyi oku.

## 3. Görev Sonu (Check-in ve Sıkıştırma Protokolü)

Anlamlı bir kod veya mimari değişiklik tamamlandığında:

1. **Delta Güncelleme (`docs/ai-context/current-state.md`):**
   - Dosyayı baştan sona yeniden yazma; yalnız `Last Verified Commit`, tarih, tamamlanan son iş ve açık görev satırlarını güncelle.
   - Aktif özet **50 satırı aşarsa**, eski tamamlanan maddeleri `docs/ai-context/history/YYYY-MM-<konu>.md` dosyasına taşı.
2. **Karar Kaydı (`docs/ai-context/decisions.md`):**
   - Yeni bir mimari karar veya kısıt eklendiyse `DEC-XXX` formatında `#etiket`, göreli dosya yolu (`packages/...`), commit hash ve güvenilirlik etiketi (`[VERIFIED]` / `[UNVERIFIED]`) ile ekle.
   - Eski bir kararla çelişki varsa `[CONFLICT]` veya `[STALE]` olarak işaretle.
3. **Güvenlik ve Taşınabilirlik Kontrolü:**
   - Hiçbir hafıza dosyasına `.env`, token, parola veya mutlak dosya yolu (`C:\...`) yazma.
   - Kullanıcı açıkça onaylamadan `git push` çalıştırma.
