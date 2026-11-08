# Birim Configurator — L1 Ajan Önbelleği ve Çalışma Kuralları (V2.1)

Bu depo (`birim-configurator`), mağaza müşterisi ve fabrika üretim planlamacısı için aynı deterministik 4-mekân parametrik modelinden 2D/3D CAD, BOM, CNC delik, plaka optimizasyonu ve fiyat üreten Next.js 15 + TypeScript monoreposudur (`apps/configurator`, `packages/*`).

## 1. Oturum Başlangıç (Wake-up) ve Görev Protokolü
1. **Oturum Başında (Zorunlu):** Yalnızca `AGENTS.md` ve `docs/ai-context/current-state.md` oku. `git status --short` ve `git diff <Last_Verified_Commit>..HEAD --name-status` ile `evidence-index.md` etki analizini yap. Serena aktifse `activate_project` çağır.
2. **Akıllı Kod Erişimi (Zorunlu Sıra):**
   - Önce `docs/ai-context/context-capsule.md` ile görevi sınıflandır; `module-map.md` ile dosya ve sembolü bul.
   - Serena Seviye A (`find_symbol(include_body=False)`, `get_symbols_overview`) ile satır aralığını al; gövdeyi (Seviye B) yalnızca kod yazarken oku. Fallback: `git grep -n` + satır aralıklı `read_file`.
   - Gerekmeyen belgeleri otomatik yükleme; tüm repository içeriğini tek seferde modele gönderme.
3. **Görev Sonunda (Check-in & Handoff):** Sadece değişen kısımları (delta) `docs/ai-context/current-state.md` ve `docs/NEXT_AGENT_HANDOFF.md` içine kaydet. Yeni kararları `decisions.md` (`#etiket`, göreli yol, commit hash) ve `evidence-index.md` içine ekle. Oturum devrinde `handoff.md` güncelle.

## 2. L2 / L3 Bağlam Yönlendirme Tablosu (İhtiyaç Halinde Oku)
| Durum / Görev Tipi | Okunacak Dosya (Göreli Yol) | Katman |
| :--- | :--- | :--- |
| Yeni oturum başlangıcı, son commit ve açık işler | `docs/ai-context/current-state.md` | **L2** |
| Hangi özellik hangi pakette/dosyada? Sembol ve giriş noktaları | `docs/ai-context/module-map.md` | **L2** |
| Görev sınıflandırma, bağlam bütçesi ve Context Capsule şeması | `docs/ai-context/context-capsule.md` | **L2/L3** |
| 4-Mekân geometri, 2D/3D render, BOM/CNC veri akışı | `docs/ai-context/architecture.md` | **L3** |
| Geçmiş mimari kararlar, kısıtlar ve nedenleri (`grep #etiket`) | `docs/ai-context/decisions.md` | **L3** |
| Karar kanıtları ve değişiklik geçerliliği (Evidence Index) | `docs/ai-context/evidence-index.md` | **L3** |
| Oturum devri ve sonraki ajan devir şablonu (Handoff) | `docs/ai-context/handoff.md` | **L3** |
| Store CPQ, ERP blueprint, Selco XML, DXF ve çoklu repo sınırları | `docs/ai-context/integrations.md` | **L3** |
| Yeni bilgisayarda MCP (`uv`, `serena`, `basic-memory`) kurulumu | `docs/ai-context/setup.md` | **L3** |
| Hafıza kabul testleri ve performans ölçüm sonuçları | `docs/ai-context/measurement.md` | **L3** |
| Arşivlenmiş eski faz/V4.1-V4.5 geçmişi ve kabul raporları | `docs/ai-context/history/` ve `docs/V41_ACCEPTANCE_REPORT.md` | **L3** |
| Hafıza yönetimi, Serena protokolü ve arşivleme kuralları | `.agents/skills/memory-manager/SKILL.md` | **Skill** |

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
