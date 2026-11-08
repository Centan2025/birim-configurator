# Birim Configurator — Context Capsule & Görev Yönlendirme Rehberi (L2/L3)

Context Capsule, bir görevi tamamlamak için gereken **minimum ve hedefli bağlamı** taşıyan geçici çalışma özetidir. Gereksiz dosya okumasını ve token harcamasını önler.

## 1. Görev Sınıflandırma ve Kaynak Yönlendirme Tablosu

| Görev Tipi | Örnek Senaryo | Öncelikli Kaynak ve Giriş Noktaları |
| :--- | :--- | :--- |
| **Parametrik / 4-Mekân** | Karkas, raf, kapak ölçü zinciri | `module-map.md` -> `packages/core/src/v4-profiles.ts`, `rules.ts` |
| **3D / 2D CAD & Kinematik** | Menteşe/kalkar kapak dönüşü, 2D projeksiyon | `module-map.md` -> `packages/geometry/src/mesh-generator.ts`, `projection2d.ts` |
| **İmalat / BOM / CNC / Nesting** | Net kesim, System 32 delik, Selco XML, DXF | `module-map.md` -> `packages/manufacturing/src/bom-generator.ts`, `drilling-engine.ts` |
| **UI / Studio / Plan / Showroom** | 2D/3D sahne, denetçi paneli, snap, kütüphane | `module-map.md` -> `apps/configurator/src/v3/components/*`, `useV3Adapter.ts` |
| **Fiyatlandırma / CPQ** | Malzeme m², hırdavat SKU maliyeti, KDV | `module-map.md` -> `packages/pricing/src/pricing-engine.ts`, `integrations.md` |
| **ERP / Store Entegrasyon** | Sipariş blueprint aktarımı, teklif snapshot | `integrations.md` -> `packages/integrations/src/*` (Fail-Closed) |
| **Hafıza / Oturum Devri** | Oturum başı doğrulama, handoff, arşivleme | `current-state.md`, `evidence-index.md`, `handoff.md`, `SKILL.md` |

## 2. Context Capsule Şeması

```yaml
task:
  id: "task-id-or-wp-id"
  type: "parametric | cad_geometry | manufacturing | ui_workspace | pricing | integration | memory"
  summary: "Uygulanacak somut görev veya düzeltme özeti"

context:
  project: "birim-configurator"
  branch: "main"
  head: "09ff016"
  relevant_modules:
    - "@birim/core"
    - "@birim/geometry"
  relevant_files:
    - "packages/core/src/v4-profiles.ts"
  relevant_symbols:
    - "calculateFourSpaceDimensions"
  decisions:
    - "DEC-001"
  integration_contracts: []
  required_tests:
    - "tests/v43-customer-factory-integration.test.ts"
  risks:
    - "Fail-closed üretim kapısını gevşetme"

verification:
  source_commit: "09ff016"
  stale_records: []
  unverified_assumptions:
    - "Fiziksel CNC kesim onayı olmadan productionGate açılamaz"

budget:
  mode: "targeted" # targeted | broad
  expand_only_when_required: true
  symbol_level: "A" # Level A: include_body=False; Level B: targeted body
```

## 3. Ajan Bağlam Seçme Sırası
1. **Sınıflandır:** Görevin tipini belirle (Parametrik, 3D/2D, İmalat, UI vb.).
2. **L1 & L2 Kontrolü:** `AGENTS.md` ve `current-state.md` oku -> `Last Verified Commit` ile diff kontrol et.
3. **Modülü Bul:** `module-map.md` tablosundan hedef dosyayı ve giriş noktasını seç.
4. **L3 Karar/Sözleşme:** İlgili `decisions.md` (`#etiket`) veya `integrations.md` bölümünü gerekirse aç.
5. **Serena Seviye A:** `lsp.get_symbols_overview` veya `lsp.find_symbol(include_body=False)` ile sembol imzasını ve satır aralığını al.
6. **Kapsül Oluştur & Yürüt:** Küçük Context Capsule sınırlarında kal; Seviye B'ye (gövde okuma) yalnızca kod değiştirilecekse geç.
