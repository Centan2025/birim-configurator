# Birim Configurator — Yeni Bilgisayar, MCP (`uv`, `serena`, `basic-memory`) ve Ortam Kurulum Rehberi (L3 Storage)

Bu rehber, projenin farklı bir bilgisayara veya yeni bir yapay zekâ ajan oturumuna klonlandığında sıfır bağlam kaybıyla ve minimum token tüketimiyle çalışması için gerekli kurulum adımlarını içerir.

## 1. Önkoşullar ve Depo Kurulumu

1. **Node.js & NPM:** Node.js `>=20.x` önerilir.
2. **Bağımlılıkların Kurulumu:**
   ```powershell
   npm install
   ```
3. **Doğrulama Komutları:**
   ```powershell
   npm run lint      # TypeScript (tsc --noEmit) kontrolü
   npm test          # Vitest birim ve regresyon testleri
   npm run dev       # Port 3300 üzerinde geliştirme sunucusu
   ```

---

## 2. `uv` Kurulumu (MCP Sunucuları İçin Önkoşul)

Serena ve Basic Memory MCP sunucuları `uvx` üzerinden çalıştırılır. Sistemde `uv` kurulu değilse:

- **Windows (PowerShell):**
  ```powershell
  powershell -ExecutionPolicy ByPass -c "irm https://astral.sh/uv/install.ps1 | iex"
  ```
- **macOS / Linux:**
  ```bash
  curl -LsSf https://astral.sh/uv/install.sh | sh
  ```
- Doğrulama: `uv --version` ve `uvx --version`

---

## 3. Serena MCP (Sembol Tabanlı Akıllı Kod Erişimi) Kurulumu

Serena MCP, dosyaları baştan sona okumak yerine LSP (Language Server Protocol) üzerinden sembol ağacını (`get_symbols_overview`, `find_symbol`, `find_referencing_symbols`) sorgulamayı sağlar.

### 3.1 Antigravity / IDE MCP Yapılandırması (`mcp_config.json`)
Ajanın MCP ayar dosyasına (`~/.gemini/antigravity/mcp_config.json` veya IDE MCP ayarlarına) aşağıdaki sunucu tanımını ekleyin:

```json
{
  "mcpServers": {
    "serena": {
      "command": "uvx",
      "args": [
        "--from",
        "git+https://github.com/oraios/serena",
        "serena",
        "start-mcp-server",
        "--context",
        "ide-assistant"
      ]
    },
    "basic-memory": {
      "command": "uvx",
      "args": [
        "basic-memory",
        "mcp"
      ]
    }
  }
}
```

### 3.2 Proje Aktivasyonu ve `.serena` Klasörü
- Serena MCP aktif olduğunda oturum başında şu aracı çağırın:
  - `activate_project` (Proje kök dizini: depo kökü)
- `.gitignore` dosyası `.serena/*` önbelleğini dışlayacak, ancak `!.serena/project.yml` ve `!.serena/memories/` dosyalarını Git'te koruyacak şekilde yapılandırılmıştır.

### 3.3 Serena MCP Aktif Değilse Yedek (Fallback) Protokolü
Eğer mevcut ortamda Serena MCP henüz bağlanmamışsa ajan şu sırayı izlemek **zorundadır**:
1. `docs/ai-context/module-map.md` dosyasından hedef paketi ve dosya yolunu bul.
2. `git grep -n "<sembol_veya_fonksiyon_adı>" packages/ apps/` komutuyla tam satır numarasını tespit et.
3. `read_file` aracını **yalnızca ilgili `StartLine` ve `EndLine` aralığıyla** (ör. 40–80 satırlık pencere) çağır; 1000+ satırlık dosyaları baştan sona okuma.

---

## 4. Basic Memory MCP Politikası ve İzolasyon Standardı

- **Markdown SSOT:** Git deposundaki `docs/ai-context/*.md` dosyaları birincil tek doğruluk kaynağıdır (SSOT).
- **Projeye Özel Ad Alanı (`birim-configurator`):** Basic Memory üzerinde işlem yapılırken daima projeye özgü ad alanı (`project="birim-configurator"`) hedeflenir.
- **`main` Alanı Yasağı:** `main` alanı global/ortak sistem alanıdır; hiçbir projeye varsayılan yazma hedefi olarak **kullanılamaz**. `project` parametresi olmadan varsayılan yazma çağrıları yapılamaz.
- **Salt-Okunur Öncelik:** Bağlantı kontrolleri yalnızca salt-okunur `bm_project(command="list")` ve `bm_find(project="birim-configurator")` ile yapılır. Kullanıcı onayı olmadan izinsiz proje oluşturulmaz, veri taşınmaz veya silinmez.
- **Çift Yazma (Dual-Write) Yasağı:** Otomatik çift-yazma yapılmaz; başka projelerin notları bu projenin kararı gibi kullanılamaz.

---

## 5. Güvenlik ve Ortam Değişkenleri (`.env`)

- `.env.local` ve `.env.*.local` dosyaları `.gitignore` içindedir; hiçbir zaman Git'e veya `docs/ai-context/` dosyalarına yazılmaz.
- Canlı veya staging Supabase bağlantı bilgileri, API anahtarları veya token'lar hafıza belgelerine kaydedilemez.
