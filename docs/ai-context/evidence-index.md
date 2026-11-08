# Birim Configurator — Hafıza Kanıt İndeksi ve Geçerlilik Matrisi (L3 Storage)

Bu indeks, mimari kararların (`DEC-001`..`DEC-009`), üretim sözleşmelerinin ve uyumluluk kurallarının hangi kaynak dosyalara ve hangi doğrulanmış commit'e dayandığını izler. Oturum başında bu indeks üzerinden etki analizi yapılır.

## 1. Kanıt Kayıtları Dizini

```yaml
records:
  - record_id: "DEC-001"
    title: "4-Mekân Tek Doğruluk Kaynağı (fourSpace.doorLeaves)"
    source_paths:
      - "packages/core/src/v4-profiles.ts"
      - "packages/geometry/src/mesh-generator.ts"
      - "packages/manufacturing/src/bom-generator.ts"
    verified_commit: "09ff016"
    verified_date: "2026-11-08"
    evidence_type: "code_implementation_and_unit_tests"
    status: "VERIFIED"

  - record_id: "DEC-002"
    title: "Fail-Closed Üretim Kapısı (canApproveProduction = false / UNVERIFIED)"
    source_paths:
      - "packages/core/src/v4-compatibility.ts"
      - "packages/core/src/v4-source-registry.ts"
      - "packages/integrations/src/erp-adapter.ts"
      - "packages/manufacturing/src/selco-adapter.ts"
    verified_commit: "09ff016"
    verified_date: "2026-11-08"
    evidence_type: "architecture_boundary_and_fail_closed_tests"
    status: "VERIFIED"

  - record_id: "DEC-003"
    title: "Bitmiş Ölçü vs. Testere Net Kesim Ölçüsü ve isManufacturablePanel Ayrımı"
    source_paths:
      - "packages/manufacturing/src/bom-generator.ts"
      - "packages/manufacturing/src/sheet-nesting.ts"
      - "packages/geometry/src/types.ts"
    verified_commit: "09ff016"
    verified_date: "2026-11-08"
    evidence_type: "bom_calculation_and_nesting_tests"
    status: "VERIFIED"

  - record_id: "DEC-004"
    title: "Kulp Deliklerinin CNC Çıktısında Üretilmemesi ve Ortak Pivot Transformu"
    source_paths:
      - "packages/geometry/src/handle-geometry.ts"
      - "packages/geometry/src/component-transform.ts"
      - "packages/manufacturing/src/drilling-engine.ts"
    verified_commit: "09ff016"
    verified_date: "2026-11-08"
    evidence_type: "mesh_kinematics_and_drilling_tests"
    status: "VERIFIED"

  - record_id: "DEC-005"
    title: "Şema Sürümü (schemaVersion: 4), Atomik Undo/Redo ve Geriye Uyumluluk"
    source_paths:
      - "packages/core/src/schemas.ts"
      - "apps/configurator/src/store/useConfiguratorStore.ts"
      - "apps/configurator/src/v3/adapter/useV3Adapter.ts"
    verified_commit: "09ff016"
    verified_date: "2026-11-08"
    evidence_type: "persistence_schema_and_store_tests"
    status: "VERIFIED"

  - record_id: "DEC-006"
    title: "Gerçek Tarayıcı Web Worker İzolasyonu ve Bounded Geometri Önbelleği"
    source_paths:
      - "apps/configurator/src/workers/manufacturing-worker-client.ts"
      - "packages/geometry/src/mesh-generator.ts"
    verified_commit: "09ff016"
    verified_date: "2026-11-08"
    evidence_type: "worker_client_and_mesh_cache"
    status: "VERIFIED"

  - record_id: "DEC-007"
    title: "İzole E2E Kabul Derlemesi (.next-v41 ve Port 3311)"
    source_paths:
      - "apps/configurator/next.config.mjs"
      - "playwright.v41.config.ts"
      - "package.json"
    verified_commit: "09ff016"
    verified_date: "2026-11-08"
    evidence_type: "build_config_and_e2e_scripts"
    status: "VERIFIED"

  - record_id: "DEC-008"
    title: "Üç Katmanlı (L1/L2/L3) Kalıcı Proje Hafızası ve Serena Sembol Protokolü (V2.1)"
    source_paths:
      - "AGENTS.md"
      - "docs/ai-context/current-state.md"
      - "docs/ai-context/module-map.md"
      - "docs/ai-context/context-capsule.md"
      - "docs/ai-context/evidence-index.md"
      - "docs/ai-context/handoff.md"
      - ".agents/skills/memory-manager/SKILL.md"
    verified_commit: "09ff016"
    verified_date: "2026-11-08"
    evidence_type: "memory_architecture_v21"
    status: "VERIFIED"

  - record_id: "DEC-009"
    title: "V4.3–V4.5 (1c1faf3..9169ec4) TypeScript Tip Kontrolü Durumu Kaydı"
    source_paths:
      - "apps/configurator/src/v3/adapter/useV3Adapter.ts"
      - "apps/configurator/src/store/useConfiguratorStore.ts"
      - "packages/manufacturing/src/bom-generator.ts"
    verified_commit: "09ff016"
    verified_date: "2026-11-08"
    evidence_type: "typecheck_audit_tsc_noEmit"
    status: "CONFLICT"
```

## 2. Değişiklik Tespiti ve Evidence Invalidation Akışı
1. Oturum başında `git diff --name-status 09ff016..HEAD` çalıştır.
2. Değişen dosyaları yukarıdaki `source_paths` listeleriyle eşleştir.
3. Değişen kaynaklarla ilgili kararları incele:
   - Kod davranışı değişmişse: `[STALE]`
   - Karar iptal edilmiş veya zıttı uygulanmışsa: `[CONFLICT]`
   - Kod güncellenmiş ve testlerle onaylanmışsa: yeni commit SHA ile `[VERIFIED]`
4. Değişmeyen kayıtlara dokunma; doğrulama kanıtı geçerliliğini korur.
