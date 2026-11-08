# Birim Configurator — Görev Devir ve Durum Handoff Protokolü (L2/L3)

Bu belge, oturumlar arası veya ajanlar arası kesintisiz görev devri (handoff) için standart şablon ve kuralları tanımlar.

## 1. Standart Handoff Şeması

```yaml
task_id: "WP-00-AI-CONTEXT-V21"
task_summary: "Kurumsal AI Context V2.1 kalıcı hafıza ve token optimizasyonu yükseltmesi"
status: "completed" # in_progress | completed | blocked
branch: "main"
base_commit: "09ff016"
last_checked_commit: "09ff016"
working_tree_state: "clean" # clean | dirty
changed_files:
  - "AGENTS.md"
  - ".agents/skills/memory-manager/SKILL.md"
  - "docs/ai-context/current-state.md"
  - "docs/ai-context/context-capsule.md"
  - "docs/ai-context/evidence-index.md"
  - "docs/ai-context/handoff.md"
  - "docs/ai-context/measurement.md"
verified_findings:
  - "L1/L2/L3 dosya ve satır bütçeleri V2.1 standardına tam uyumlu."
  - "Serena MCP (activate_project, initial_instructions, serena_repl) aktif ve çalışır durumda."
  - "Basic Memory MCP (bm_project, bm_list) aktif ve izole edilmiş durumda."
  - "tests/v43-customer-factory-integration.test.ts 5/5 PASS geçti."
decisions:
  - "DEC-008 (V2.1 yükseltmesi)"
tests_run:
  - "npx vitest run tests/v43-customer-factory-integration.test.ts (5/5 PASS)"
  - "npm run lint (tsc --noEmit) - DEC-009 uyumsuzlukları tespit edildi"
tests_not_run:
  - "npm run test:e2e:v41 (Playwright Chromium - port 3311)"
  - "Fiziksel CNC tezgah deneme kesimi (fail-closed kilitli)"
known_issues:
  - "DEC-009: V4.3-V4.5 commitlerinden kalan tsc --noEmit tip uyumsuzlukları"
next_steps:
  - "Kullanıcı isteği doğrultusunda DEC-009 TypeScript tip düzeltmelerini uygulamak"
  - "Fiziksel fabrika doğrulama kapsamı tamamlandığında ilgili şablonların verificationScope bayraklarını güncellemek"
```

## 2. Handoff Kuralları ve Çakışma Önleme Politikası
1. **Yalnızca Gerçek Kanıt:** Gerçekte yapılan işlemleri, çalıştırılan/çalıştırılmayan testleri ve doğrulanmış bulguları yaz. Tam dosya içeriği veya ham log yazma.
2. **Yerel İzolasyon:** Anlık geçici devir notları için `.handoff.local.md` dosyası kullanılabilir. Bu dosya Git `.gitignore` tarafından yoksayılır.
3. **Arşivleme:** Tamamlanan ana kilometre taşları `docs/ai-context/history/` altında arşivlenir.
