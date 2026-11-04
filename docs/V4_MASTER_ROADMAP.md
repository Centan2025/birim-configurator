# BİRİM CONFIGURATOR V4 — MASTER ROADMAP & 15 FAZ SÖZLEŞMESİ (`V4_MASTER_ROADMAP.md`)

**Tarih:** 4 Kasım 2026  
**Proje:** `birim-configurator`  
**Mevcut Sürüm:** V3.1 $\to$ **Hedef Sürüm:** V4.0  
**Ana İlke:** **Professional Power — Radical Simplicity.**

---

## 1. DÖRT ANA KAPI (DEVELOPMENT & ACCEPTANCE GATES)

| Kapı | Kapsanan Fazlar | Teslimat & Doğrulama Kapsamı | Durum |
| :--- | :--- | :--- | :---: |
| **KAPI 1** | **Faz 00 – Faz 03** | Mevcut V3.1 sistem denetimi, uluslararası standart (EN 1116, EN 14749, ISO 7170, EN 15570, EN 15338, System 32) ve 7 donanım üreticisi araştırması, 6 aile / 92 parametrik modül taksonomisi, 4 katmanlı ölçü/gövde profil mimarisi. | `IMPLEMENTED` / `TESTED` |
| **KAPI 2** | **Faz 04 – Faz 07** | 12 kapak hareket kategorisi (menteşeli, içten, yarım bini, sürgülü, paralel/katlanır/döner kalkar, katlanır yan, pocket, tambur), 10 kulp + 10 açılma teknolojisi ayrımı, gerçek SKU'lu donanım kataloğu ve 15 kategorili Evrensel Uyumluluk Motoru (`COMPATIBLE`, `COMPATIBLE_WITH_CONDITIONS`, `INCOMPATIBLE`, `UNVERIFIED` + otomatik çözüm önerileri). | `IMPLEMENTED` / `TESTED` |
| **KAPI 3** | **Faz 08 – Faz 12** | Akıllı Modül Oluşturucu (duvar açıklığına göre 2/3/4/karma gövde önerileri, eşit/esnek genişlik dağıtımı, otomatik dolgu paneli), Gardırop (6 iç düzen sihirbazı) ve Mutfak (6 yerleşim + otomatik tezgâh/baza/dolgu/bitiş paneli) otomasyonu, 3D kinematik hareketler (kalkar, pocket, katlanır, sürgülü, menteşe/ray önizlemesi), dinamik BOM/CNC delik entegrasyonu ve Kütüphane Yönetim Paneli (`DRAFT` $\to$ `PUBLISHED`). | `IMPLEMENTED` / `TESTED` |
| **KAPI 4** | **Faz 13 – Faz 14** | Birim testleri, deterministik property-based testler, 10 referans üretim senaryosu testi, Playwright gerçek tarayıcı (Studio/Plan/Showroom) testleri, fiziksel üretim doğrulama ayrımı (`BLOCKED_BY_FACTORY_VALIDATION`) ve izole Store/ERP V4 entegrasyon sözleşmeleri. | `IMPLEMENTED` / `TESTED` |

---

## 2. 15 FAZ DURUM MATRİSİ

| Faz | Faz Başlığı | Temel Kod Modülleri | Dokümantasyon Teslimatı | Durum |
| :--- | :--- | :--- | :--- | :---: |
| **FAZ 00** | Mevcut Kod Tabanı Denetimi | Monorepo & V3.1 baseline analizi | [`docs/V4_EXISTING_SYSTEM_AUDIT.md`](file:///f:/birim-configurator/docs/V4_EXISTING_SYSTEM_AUDIT.md) | `TESTED` |
| **FAZ 01** | Uluslararası Üretici ve Standart Araştırması | Kaynak ve standart kayıt defteri | [`docs/RESEARCH_MANUFACTURERS.md`](file:///f:/birim-configurator/docs/RESEARCH_MANUFACTURERS.md), [`docs/RESEARCH_STANDARDS.md`](file:///f:/birim-configurator/docs/RESEARCH_STANDARDS.md), [`docs/RESEARCH_HARDWARE_SYSTEMS.md`](file:///f:/birim-configurator/docs/RESEARCH_HARDWARE_SYSTEMS.md), [`docs/SOURCE_REGISTER.md`](file:///f:/birim-configurator/docs/SOURCE_REGISTER.md) | `TESTED` |
| **FAZ 02** | Evrensel Modül Sınıflandırması (92 Şablon) | `packages/catalog/src/v4-module-taxonomy.ts` | [`docs/MODULE_TAXONOMY.md`](file:///f:/birim-configurator/docs/MODULE_TAXONOMY.md) | `TESTED` |
| **FAZ 03** | Ölçü, Gövde ve Üretim Kuralları | `packages/core/src/v4-profiles.ts` | [`docs/MODULE_DIMENSION_RULES.md`](file:///f:/birim-configurator/docs/MODULE_DIMENSION_RULES.md) | `TESTED` |
| **FAZ 04** | Kapak ve Cephe Sistemleri (12 Kategori) | `packages/core/src/v4-types.ts`, `packages/geometry/src/mesh-generator.ts` | [`docs/DOOR_SYSTEMS.md`](file:///f:/birim-configurator/docs/DOOR_SYSTEMS.md) | `TESTED` |
| **FAZ 05** | Kulp ve Açılma Teknolojileri (10+10) | `packages/core/src/v4-types.ts`, `packages/catalog/src/v4-hardware-catalog.ts` | [`docs/HANDLE_OPENING_SYSTEMS.md`](file:///f:/birim-configurator/docs/HANDLE_OPENING_SYSTEMS.md) | `TESTED` |
| **FAZ 06** | Gerçek Donanım ve Aksesuar Kataloğu | `packages/catalog/src/v4-hardware-catalog.ts` | [`docs/HARDWARE_CATALOG.md`](file:///f:/birim-configurator/docs/HARDWARE_CATALOG.md) | `TESTED` |
| **FAZ 07** | Evrensel Uyumluluk Motoru (15 Kategori) | `packages/core/src/v4-compatibility.ts` | [`docs/COMPATIBILITY_ENGINE.md`](file:///f:/birim-configurator/docs/COMPATIBILITY_ENGINE.md) | `TESTED` |
| **FAZ 08** | Akıllı Modül Oluşturucu | `packages/catalog/src/v4-smart-builder.ts` | [`docs/SMART_MODULE_BUILDER.md`](file:///f:/birim-configurator/docs/SMART_MODULE_BUILDER.md) | `TESTED` |
| **FAZ 09** | Dolap ve Mutfak Otomasyonu | `packages/catalog/src/v4-smart-builder.ts` | [`docs/SMART_MODULE_BUILDER.md`](file:///f:/birim-configurator/docs/SMART_MODULE_BUILDER.md) | `TESTED` |
| **FAZ 10** | Profesyonel 3D, Malzeme ve Hareket | `packages/geometry/src/mesh-generator.ts`, `V3ThreeViewport.tsx` | [`docs/DOOR_SYSTEMS.md`](file:///f:/birim-configurator/docs/DOOR_SYSTEMS.md) | `TESTED` |
| **FAZ 11** | BOM, CNC ve Üretim Motoru Entegrasyonu | `packages/manufacturing/src/bom-generator.ts`, `drilling-engine.ts` | [`docs/MANUFACTURING_INTEGRATION.md`](file:///f:/birim-configurator/docs/MANUFACTURING_INTEGRATION.md) | `TESTED` |
| **FAZ 12** | Kütüphane Yönetim Paneli | `packages/catalog/src/v4-library-admin.ts`, `V3UnifiedWorkspace.tsx` | [`docs/LIBRARY_ADMIN.md`](file:///f:/birim-configurator/docs/LIBRARY_ADMIN.md) | `TESTED` |
| **FAZ 13** | Test ve Fiziksel Üretim Doğrulama | `tests/v4-*.test.ts`, `tests/e2e-v4-*.spec.ts` | [`docs/V4_TEST_REPORT.md`](file:///f:/birim-configurator/docs/V4_TEST_REPORT.md) | `TESTED` |
| **FAZ 14** | Store ve ERP Entegrasyon Hazırlığı | `packages/integrations/src/types.ts`, `store-adapter.ts`, `erp-adapter.ts` | [`docs/V4_ACCEPTANCE_REPORT.md`](file:///f:/birim-configurator/docs/V4_ACCEPTANCE_REPORT.md) | `TESTED` |
