# BİRİM CONFIGURATOR (V5.6) — TAM MİMARİ VE AJAN DEVİR KILAVUZU (AGENT HANDOFF)

Bu depo **Birim Mobilya** için geliştirilmiş parametrik 3D/2D mobilya tasarım stüdyosu, mühendislik doğrulama motoru ve **Birim Portal ERP CNC Panel Nesting** tam uyumlu üretim platformudur.

## 1. Monorepo Paket Mimarisi (npm workspaces)
- `packages/core` (`@birim/core`):
  - Temel veri modelleri (`DesignProject`, `ModuleInstance`, `BayConfig`, `CarcassConfig`, `MaterialDefinition`, `DrillingHole`).
  - 4-Uzay kapalı ölçü zinciri (`calculateFourSpaceDimensions`), Euler-Bernoulli ISO 7170 raf sehim hesabı, 3D kapak süpürme çakışma kontrolü ve V4 uyumluluk motoru.
- `packages/catalog` (`@birim/catalog`):
  - Gardırop, vestiyer, mutfak alt/üst/boy/köşe modül şablonları, Blum / Hettich / Häfele gerçek donanım SKU kataloğu, delik şablonları ve akıllı duvar dizilim sihirbazları.
- `packages/geometry` (`@birim/geometry`):
  - Parametrik 3D parça üreteci (`mesh-generator.ts`) ve 2D CAD teknik görünüş/kesit/plan projeksiyon motoru (`projection2d.ts`).
- `packages/manufacturing` (`@birim/manufacturing`):
  - Net kesim (PVC bant kalınlığı düşülmüş) BOM üreteci (`bom-generator.ts`), System 32 çift yüzeyli simetrik delik motoru (`drilling-engine.ts`), katmanlı AutoCAD `.DXF` (`dxf-template.ts`), Homag WoodWOP `.MPR` & Biesse `.CIX` (`cnc-postprocessors.ts`), Blum EASYSTICK `.BXF` (`technical-outputs.ts`).
  - **`src/erp-nesting/` (Birim Portal ERP Birebir Nesting Altyapısı)**:
    - `erp-nesting-types.ts`: ERP `nesting_projects`, `nesting_sheets`, `nesting_parts`, `nesting_placements` birebir şemaları.
    - `erp-serialization.ts`: U1/U2/K1/K2 kenar bandı (`0.40mm PVC`, `1.00mm PVC`, `2.00mm PVC`) ve arkalık kanalı (`hasGroove`, `grooveSide`, `grooveOffset`, `grooveWidth`, `grooveDepth`) JSON serileştirmesi (`serializeErpEdgeBanding` / `parseErpEdgeBanding`) ve `[grain:vertical|horizontal|none]` plaka suyolu etiketlemesi.
    - `erp-guillotine-engine.ts` & `erp-nesting-algorithm.ts`: `Auto`, `Guillotine` (şerit/kafa kesim + operatör kesim reçetesi) ve `MaxRects` yerleşim motorları + `extractErpReclaimableRemnants` (`>=400x400mm` ayrık artık plaka geri kazanımı).
    - `erp-exporters.ts`: ERP Selco WNT 600 OptiPlanning `.csv` ve CNC Router `.nc` G-Code üreticileri.
    - `erp-nesting-bridge.ts`: `buildBirimErpNestingBundle(project, bom, materialsMap, options)` — BOM kesim listesini malzeme + kalınlık bazlı ERP iş emirlerine dönüştürür.
- `packages/pricing` (`@birim/pricing`):
  - Plaka alanı, kenar bandı metrajı, donanım SKU ve işçilik bazlı EUR/TRY + KDV fiyat motoru.
- `packages/integrations` (`@birim/integrations`):
  - Mağaza CPQ (`store-adapter.ts`) ve Birim ERP Üretim & Nesting Köprüsü (`erp-adapter.ts`).
- `apps/configurator`:
  - Next.js (App Router) + React + Three.js + Zustand + Tailwind CSS v4 tabanlı Birleşik Tasarım Stüdyosu (`V3UnifiedWorkspace.tsx`, `V3ThreeViewport.tsx`, `V3CadViewport2D.tsx`, `WorkspaceTopBar.tsx`, `SimpleCustomerInspector.tsx`, `BomModal.tsx`, `StoreErpModal.tsx`).

## 2. Son Tamamlanan Kritik Mühendislik ve UI Özellikleri (V5.0 -> V5.6)
1. **Performans (INP < 50ms) & Seçim Çerçevesi Senkronizasyonu**:
   - Sekme, mod ve çizim aracı geçişleri `React.startTransition` kapsamındadır.
   - `V3ThreeViewport.tsx` içinde `doorOpenAngleDeg` / `drawerOpenMm` değiştiğinde parametrik mesh inşası biter bitmez `updateSelectionAndActiveFrames()` çağrılarak OBB seçim çerçevesi açılan kapakla anında senkronize edilir.
2. **Parametrik Gömme LED Kanal & Sıfır Sarı Bant Bloom**:
   - `ledFrontSetbackMm`, `ledShelfSetbackMm`, `ledAlignShelfAndSide`, `ledChannelWidthMm`, `ledChannelDepthMm` parametreleri 3D sahne, 2D kesit ve BOM ile tam senkrondur.
3. **Dünya Standartlarında 3 Gerçek Baza Konstrüksiyonu (`plinthConstruction`)**:
   - `pedestal_box` (4-taraf kapalı kutu baza + ara taşıyıcı kayıt + PVC sızdırmazlık fitili),
   - `adjustable_legs_clip` (Häfele Axilo 78 ayarlı ayaklar + C-klips geçmeli ön/yan baza + şeffaf su contası),
   - `gable_rails` (zemine inen yan dikmeler + ön/arka baza kayıtları + gizli çelik terazi pingoları).
4. **Birim ERP Nesting Modülü %100 Birebir Uyum**:
   - Parça net kesim ölçüleri, suyolu kanonikleştirmesi, U1/U2/K1/K2 kenar bantları ve arkalık kanalları Birim ERP veritabanı ve `/api/nesting` uç noktalarıyla %100 aynı yapıda üretilir.
5. **Buzlu Cam (Frosted Glass), Yarı Şeffaf & İkon Ağırlıklı Düğme Panelleri (`globals.css`)**:
   - `.birim-ice-bar`, `.birim-ice-rail`, `.birim-ice-pill`, `.birim-ice-popover`, `.birim-ice-btn` ve `.birim-ice-btn-active` sınıflarıyla tüm barlar, raylar ve 3D/2D sahne üstü HUD kapsülleri yarı şeffaf buzlu cam ve saf ikon odaklıdır (`title` ipuçları ve `sr-only` erişilebilirlik/test etiketleri korunmuştur).

## 3. Çalıştırma ve Doğrulama Komutları
```bash
npm install
npm run dev          # Geliştirme sunucusu (apps/configurator)
npm run test         # Vitest birim ve entegrasyon testleri
npm run build        # Tüm paketlerin ve Next.js uygulamasının derlenmesi
```
