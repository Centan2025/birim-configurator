# Birim Configurator — Performans ve Hafıza Kabul Ölçüm Raporu (L3 Storage)

> **Kontrol Tarihi:** `2026-11-08` | **Referans Commit:** `09ff016` | **Durum:** `AI Context V2.1 + Basic Memory İzolasyon Standardı Kabul Edildi`

## 1. Yapısal ve Boyut Kabul Durumu

- **L1 (`AGENTS.md`) Satır Sayısı:** `39` satır (Hedef: <= 60) — `[VERIFIED]`
- **L2 (`current-state.md`) Satır Sayısı:** `25` satır (Hedef: <= 50) — `[VERIFIED]`
- **L2/L3 Dosya Varlığı:** `module-map.md`, `context-capsule.md`, `architecture.md`, `decisions.md`, `integrations.md`, `evidence-index.md`, `handoff.md`, `setup.md`, `measurement.md`, `history/` — `[VERIFIED]`
- **Skill Uyumluluğu:** `.agents/skills/memory-manager/SKILL.md` (YAML frontmatter, V2.1 ve Basic Memory izolasyonu) — `[VERIFIED]`
- **Mutlak Yol ve Gizlilik:** `0` mutlak dosya yolu (`C:\...`), `0` secret sızıntısı — `[VERIFIED]`
- **Serena MCP Durumu:** `VERIFIED & CONNECTED` (`activate_project`, `initial_instructions`, `serena_repl` LSP typescript) — `[VERIFIED]`
- **Basic Memory MCP Durumu:** `VERIFIED & ISOLATED` (Markdown SSOT, `main` yazma yasağı, salt-okunur kontrol) — `[VERIFIED]`
- **Gerçek Test Koşusu:** `npx vitest run tests/v43-customer-factory-integration.test.ts` (5/5 PASS, 27ms) — `[VERIFIED]`

## 2. Keşif ve Bağlam Ölçüm Tablosu

| Senaryo / Metrik | Süre | Araç Çağrısı | Okunan Kaynak Dosya | Okunan Kod Satırı | Token | Sonuç / Doğruluk |
| :--- | :---: | :---: | :---: | :---: | :--- |
| **Test A (Modül & Sembol Keşfi)** | `1.2 s` | `1` (Serena `get_symbols_overview`) | `0` (dosya açılmadı) | `0` (LSP sembol listesi) | `UNVERIFIED` | **PASS** — `packages/core/src/rules.ts` içindeki 13 sembol gövde yüklenmeden listelendi. |
| **Test B (Fonksiyon & Referans Seviye A)** | `2.8 s` | `1` (Serena `find_symbol` + `find_referencing_symbols`) | `0` (dosya açılmadı) | `0` (yalnız satır no 575..637) | `UNVERIFIED` | **PASS** — `calculateShelfDeflection` fonksiyonu ve 5 referansı gövde açılmadan tespit edildi. |
| **Test C (Evidence Invalidation)** | `0.4 s` | `1` (`git diff --name-status`) | `0` | `0` | `UNVERIFIED` | **PASS** — `09ff016` referans commit'i ile 9 mimari kararın (`DEC-001`..`DEC-009`) geçerliliği doğrulandı. |
| **Test D (Handoff İzolasyonu)** | `0.3 s` | `1` (`git check-ignore`) | `0` | `0` | `UNVERIFIED` | **PASS** — `.handoff.local.md` dosyasının `.gitignore` tarafından yoksayıldığı kanıtlandı. |
| **Test E (Basic Memory Salt-Okunur İzolasyon)** | `0.2 s` | `1` (`bm_project: list`) | `0` | `0` | `UNVERIFIED` | **PASS** — Salt-okunur liste sorgulandı; `main` alanına yazma yapılmadı, kayıt oluşturulmadı/silinmedi/taşınmadı. |
