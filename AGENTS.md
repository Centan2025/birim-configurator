# Birim Configurator — L1 Ajan Önbelleği ve Çalışma Kuralları

Bu depo (`birim-configurator`), mağaza müşterisi ve fabrika üretim planlamacısı için aynı deterministik 4-mekân parametrik modelinden 2D/3D CAD, BOM, CNC delik, plaka optimizasyonu ve fiyat üreten Next.js 15 + TypeScript monoreposudur (`apps/configurator`, `packages/*`).

## 1. Oturum Başlangıç (Wake-up) ve Görev Sonu (Check-in) Protokolü
1. **Oturum Başında (Zorunlu):** Yalnızca `AGENTS.md` ve `docs/ai-context/current-state.md` dosyasını oku. Ardından `git status --short` ve `git diff <Last_Verified_Commit>..HEAD --stat` çalıştır. Serena MCP aktifse `activate_project` çağır.
2. **Akıllı Kod Erişimi (Zorunlu Sıra):**
   - Önce `docs/ai-context/module-map.md` veya sembol/grep araması (`find_symbol`, `get_symbols_overview`, `git grep`) ile hedef dosya ve satır aralığını bul.
   - Ardından `read_file` ile **yalnızca ilgili satır aralığını** (`StartLine`/`EndLine`) oku; kaynak dosyaları baştan sona yükleme.
   - Gerekmeyen belgeleri otomatik yükleme; tüm repo içeriğini tek seferde modele gönderme.
3. **Görev Sonunda (Check-in):** Sadece değişen kısımları (delta) `docs/ai-context/current-state.md` ve `docs/NEXT_AGENT_HANDOFF.md` içine kaydet, yeni mimari kararları `docs/ai-context/decisions.md` içine `#etiket`, göreli yol, commit hash ve `[VERIFIED]`/`[UNVERIFIED]` ile ekle.

## 2. L2 / L3 Bağlam Yönlendirme Tablosu (İhtiyaç Halinde Oku)
| Durum / Görev Tipi | Okunacak Dosya (Göreli Yol) | Katman |
| :--- | :--- | :--- |
| Yeni oturum başlangıcı, son commit ve açık işler | `docs/ai-context/current-state.md` | **L2** |
| Hangi özellik hangi pakette/dosyada? Sembol ve giriş noktaları | `docs/ai-context/module-map.md` | **L2** |
| 4-Mekân geometri, 2D/3D render, BOM/CNC veri akışı | `docs/ai-context/architecture.md` | **L3** |
| Geçmiş mimari kararlar, kısıtlar ve nedenleri (`grep #etiket`) | `docs/ai-context/decisions.md` | **L3** |
| Store CPQ, ERP blueprint, Selco XML, DXF ve çoklu repo sınırları | `docs/ai-context/integrations.md` | **L3** |
| Yeni bilgisayarda MCP (`uv`, `serena`, `basic-memory`) kurulumu | `docs/ai-context/setup.md` | **L3** |
| Arşivlenmiş eski faz/V4.1-V4.5 geçmişi ve kabul raporları | `docs/ai-context/history/` ve `docs/V41_ACCEPTANCE_REPORT.md` | **L3** |
| Hafıza yönetimi ve arşivleme otomasyon kuralları | `.agents/skills/memory-manager/SKILL.md` | **Skill** |

## 3. Temel Komutlar
- **Birim / Regresyon Testi:** `npm test` (Vitest)
- **Tip Kontrolü:** `npm run lint` (`tsc --noEmit`)
- **Geliştirme Sunucusu:** `npm run dev` (Port `3300` — çalışan sunucuyu körlemesine kapatma)
- **İzole E2E Kabul:** `$env:BIRIM_AUDIT_BUILD='1'; npm run build; npm run test:e2e:v41` (Port `3311`, `.next-v41`)

## 4. Kesin Çalışma ve Güvenlik Sınırları
- **Repo Sınırı:** Yalnızca `birim-configurator` deposunu değiştir; `birim-portal` ve `birim-store` depolarına, canlı/staging Supabase ortamlarına dokunma ve kullanıcı onayı olmadan `git push` veya production deploy yapma.
- **Üretim Kapısı (Fail-Closed):** Fiziksel fabrika/CNC numune onayı (`physicalFactorySample`) olmayan şablonlarda `UNVERIFIED` üretim engelini, `productionGate` kontrolünü veya Selco taslak statüsünü testi geçirmek için kaldırma.
- **Sırlar ve Yollar:** `.env`, token veya API anahtarlarını hafıza dosyalarına yazma; tüm belgelerde mutlak yol (`C:\...`) yerine proje köküne göre göreli yol (`packages/...`, `apps/...`) kullan.
- **Tam Zincir Denetimi:** Geometri/kulp/kapak değişikliklerinde `model -> state -> 2D/3D -> BOM/fiyat -> kaydet/yükle` zincirini doğrula.
