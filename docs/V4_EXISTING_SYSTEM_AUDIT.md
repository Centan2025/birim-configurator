# BİRİM CONFIGURATOR V4 — MEVCUT SİSTEM VE MİMARİ DENETİM RAPORU (`V4_EXISTING_SYSTEM_AUDIT.md`)

**Tarih:** 4 Kasım 2026  
**Mevcut Sürüm:** V3.1 (`feature/configurator-v3`)  
**Hedef Sürüm:** V4.0 (Universal Furniture Module & Hardware Library)  
**Durum:** `IMPLEMENTED` / `TESTED` (Faz 00 Tamamlandı)

---

## 1. MONOREPO VE PAKET MİMARİSİ DENETİMİ

Mevcut `birim-configurator` kod tabanı TypeScript 5.7+ ve NPM Workspaces tabanlı modüler bir monorepo yapısındadır:

| Paket / Uygulama | Dizin | Sorumluluk Alanı | V4 Uyumluluk Durumu |
| :--- | :--- | :--- | :--- |
| **`@birim/core`** | [`packages/core`](file:///f:/birim-configurator/packages/core/src/index.ts) | Kanonik veri tipleri (`UnitLength = mm`), Zod şemaları (`schemas.ts`), gövde/bölme hesapları ve doğrulama kuralları (`rules.ts`). | **Genişletilmeli:** Kapak sistemleri, kulp profilleri, açılma mekanizmaları, yapı/ölçü profilleri ve donanım referansları eklenmeli. |
| **`@birim/catalog`** | [`packages/catalog`](file:///f:/birim-configurator/packages/catalog/src/index.ts) | Hazır gardırop ve mutfak şablonları (`templates.ts`), L/U mutfak yerleşimleri (`kitchen-layouts.ts`), akıllı açıklık danışmanı (`smart-advisor.ts`). | **Genişletilmeli:** 8 şablondan 6 ana modül ailesine (Mutfak Alt, Mutfak Üst, Boy/Cihaz, Gardırop, Köşe/Özel, Tamamlayıcı) ve gerçek donanım kataloğuna çıkarılmalı. |
| **`@birim/geometry`** | [`packages/geometry`](file:///f:/birim-configurator/packages/geometry/src/index.ts) | 3D bileşen kutu geometrisi (`mesh-generator.ts`) ve 2D görünüş/plan/kesit projeksiyonları (`projection2d.ts`). | **Genişletilmeli:** Kalkar kapak (AVENTOS / Free), katlanır kapak, pocket (gizlenen) kapak, içten kapak (inset) ve kulp/menteşe/ray 3D kinematik hacimleri eklenmeli. |
| **`@birim/manufacturing`** | [`packages/manufacturing`](file:///f:/birim-configurator/packages/manufacturing/src/index.ts) | BOM üretimi (`bom-generator.ts`), System 32 delik motoru (`drilling-engine.ts`), giyotin plaka nesting (`sheet-nesting.ts`), Selco WNT 600 adaptörü (`selco-adapter.ts`), CSV/DXF çıktıları (`technical-outputs.ts`). | **Kritik Bağımlılık:** `bom-generator.ts` ve `drilling-engine.ts` içinde sabit kodlanmış (hardcoded) menteşe ve ray varsayımları parametrik donanım profillerine bağlanmalı. |
| **`@birim/pricing`** | [`packages/pricing`](file:///f:/birim-configurator/packages/pricing/src/index.ts) | Plaka alanı, kenar bandı, CNC delik sayısı, işçilik ve alternatif malzeme maliyet motoru (`pricing-engine.ts`). | **Uyumlu:** BOM içindeki `hardwareList` üzerinden dinamik donanım fiyatlarını zaten topluyor; gerçek donanım kataloğu fiyat referanslarıyla doğrudan çalışır. |
| **`@birim/integrations`** | [`packages/integrations`](file:///f:/birim-configurator/packages/integrations/src/index.ts) | İzole `MockStoreAdapter` ve `MockERPAdapter` (idempotency, HMAC imza, audit log). | **Genişletilmeli (Faz 14):** Seçilen kapak/kulp/donanım SKU'ları, doğrulama kayıtları (`verification_records`) ve kilitli kütüphane versiyonu snapshot'a eklenmeli. |
| **`@birim/configurator-app`** | [`apps/configurator`](file:///f:/birim-configurator/apps/configurator/src/app/v3/page.tsx) | V2 ana ekranı (`/`) ve V3.1 birleşik çalışma alanı (`/v3` Studio, Plan, Showroom). | **Korunacak & Geliştirilecek:** V2 (`/`) ve V3.1 (`/v3`) çalışma modları korunarak V4 modül sihirbazları, uyumluluk motoru ve Kütüphane Yönetim Paneli (Faz 12) eklenecek. |

---

## 2. MEVCUT MODÜL, KAPAK VE DONANIM VERİ MODELLERİ

### 2.1 Modül Kategorileri (`ModuleCategory`)
[`packages/core/src/types.ts`](file:///f:/birim-configurator/packages/core/src/types.ts#L7-L15) içinde yalnızca 8 kategori tanımlıdır:
- `wardrobe`, `wardrobe_corner`, `wardrobe_walkin`
- `kitchen_base`, `kitchen_wall`, `kitchen_tall`, `kitchen_corner`, `kitchen_island`

**Tespit Edilen Eksik:** Tamamlayıcı modüller (baza, taç, tezgâh, dolgu/kör parça, yan bitiş paneli, backsplash, aydınlatma profili) ve özel/niş modüller (eğimli tavan, merdiven altı, cihaz kulesi, çöp/şişelik modülü) için `moduleFamilyId` ve `subType` ayrımı bulunmamaktadır.

### 2.2 Kapak ve Kulp Veri Modeli (`DoorConfig`)
[`packages/core/src/types.ts`](file:///f:/birim-configurator/packages/core/src/types.ts#L123-L132) içinde `DoorConfig`:
```typescript
export interface DoorConfig {
  id: string;
  bayIndex: number;
  type: "single_left" | "single_right" | "double" | "sliding" | "folding" | "open";
  doorMaterialId?: string;
  handleType?: "standard" | "integrated_profile" | "push_to_open" | "none";
  softClose: boolean;
  hingeCount?: number;
  isGlassFramed?: boolean;
}
```
**Tespit Edilen Uyumsuzluklar:**
1. **Kulp ve Açılma Teknolojisi Karışıklığı:** `handleType` alanında `"push_to_open"` bir kulp tipi olarak tanımlanmış. Oysa Faz 05 mimari kuralına göre **Kulp Tipi** (`knob`, `bar`, `gola`, `j_pull`, `recessed`, `handleless`) ile **Açılma Teknolojisi** (`manual`, `soft_close`, `push_to_open`, `push_to_open_soft_close`, `servo_electric`) birbirinden bağımsız alanlar olmalıdır (ör. Gola profil + Soft-close veya Kulpsuz + Push-to-open).
2. **Eksik Kapak Hareket Kategorileri:** Mevcut `type` alanı yalnızca 5 hareket tipini destekliyor. Faz 04'teki 12 kategoriyi (içten menteşeli `inset`, yarım bini `half_overlay`, üstten/alttan sürgülü, paralel kalkar `lift_parallel`, katlanır kalkar `lift_bi_fold`, döner kalkar `lift_up_stay`, yatay döner kalkar `lift_flap`, `pocket` gizlenen kapak ve `tambour` panjur kapak) temsil etmek için `DoorSystemId`, `OverlayType` ve `OpeningMechanism` ayrımı şarttır.
3. **Kapak Ağırlığı ve Malzeme Yoğunluğu Eksikliği:** `MaterialDefinition` içinde `densityKgPerM3` alanı yoktur. Bu nedenle kapak ağırlığı ($m = W \times H \times T \times \rho$) hesaplanamamakta ve kalkar kapak güç faktörü ($LF = \text{Kabine Yüksekliği (mm)} \times \text{Kapak Ağırlığı (kg)}$) veya menteşe/pocket taşıma kapasitesi doğrulanamamaktadır.

---

## 3. GEOMETRY, BOM VE DELİK MOTORU BAĞIMLILIK ANALİZİ

### 3.1 Geometri Motoru (`packages/geometry/src/mesh-generator.ts`)
- **Sabit Kalınlık ve Bini Varsayımı:** [`mesh-generator.ts`](file:///f:/birim-configurator/packages/geometry/src/mesh-generator.ts#L318-L396) yalnızca tam bini (`full_overlay`) kapakları ve `single_left`, `single_right`, `double`, `sliding` tiplerini 3D sahnede oluşturmaktadır. `folding`, `lift` veya `pocket` seçildiğinde kapak 3D sahnede çizilmemektedir!
- **Sabit Çekmece Kasa Boşluğu:** Çekmece kasası yan boşluğu `boxX0 = bayStartX + 18` ve `boxW = bayW - 36` olarak sabit kodlanmıştır. Oysa Blum MOVENTO (760H/766H) gizli rayda iç kasa genişliği $LW - 42\text{ mm}$ (16mm yanak için), Blum LEGRABOX veya Hettich AvanTech YOU metal yanaklı sistemlerde taban/sırt kesim formülleri üreticiye özeldir.

### 3.2 BOM Motoru (`packages/manufacturing/src/bom-generator.ts`)
- **Sabit Kodlanmış (Hardcoded) Donanım SKU'ları:** [`bom-generator.ts`](file:///f:/birim-configurator/packages/manufacturing/src/bom-generator.ts#L93-L169) içinde seçilen kapak veya çekmece mekanizmasına bakılmaksızın her zaman sabit SKU'lar basılmaktadır:
  - Gövde bağlantısı: Her zaman `"HW_MINIFIX_SET"` ve `"HW_DOWEL_8X35"`.
  - Kapaklar: Her zaman `"HW_BLUM_HINGE_110"` (`Blum Clip Top Blumotion 110°`) ve `"HW_HANDLE_BAR"` (Sürgülü kapak veya kulpsuz kapak seçilse bile menteşe ve çubuk kulp eklenmektedir!).
  - Çekmeceler: Her zaman `"HW_BLUM_TANDEM_BOX"` (`500mm` sabit boy; dolap derinliği 350mm veya 450mm olsa bile 500mm ray yazılmaktadır!).
- **BOM Önbellek Anahtarı (`computeProjectBOMKey`):** [`bom-generator.ts`](file:///f:/birim-configurator/packages/manufacturing/src/bom-generator.ts#L12-L23) yalnızca `bay.door.type` değerine bakmaktadır. V4'te donanım ürünü (ör. standart 110° menteşe → 155° sıfır çıkıntılı menteşe), kulp tipi veya yapı profili değiştiğinde önbelleğin deterministik olarak geçersiz kılınması (cache invalidation) için bu alanlar `computeProjectBOMKey` içine dahil edilmelidir.

### 3.3 Delik Motoru (`packages/manufacturing/src/drilling-engine.ts`)
- **Sabit Menteşe Tas ve Taban Delikleri:** [`drilling-engine.ts`](file:///f:/birim-configurator/packages/manufacturing/src/drilling-engine.ts#L148-L187) her kapak için sabit `cupX = 21.5mm` ($35/2 + 4\text{ mm}$ kenar mesafesi) ve `±22.5mm` ($45\text{ mm}$ eksen aralığı, `9.5mm` ofset — Blum şablonu) delmektedir.
  - Eğer kullanıcı Hettich Sensys seçerse, vida delik ekseni $52\text{ mm}$ (`±26mm`) ve ofseti $5.5\text{ mm}$ olmalıdır!
  - Eğer kullanıcı Salice seçerse, vida delik ekseni $48\text{ mm}$ (`±24mm`) ve ofseti $6\text{ mm}$ olmalıdır!
  - Sürgülü kapak veya kalkar kapakta yan panel yerine üst/alt panel veya mekanizma koordinatlarına delik açılmalıdır.

---

## 4. MEVCUT PRESETLER VE TASARIM SAKLAMA YAPISI

### 4.1 Mevcut Kütüphane Presetleri (`packages/catalog/src/templates.ts`)
Şu an sistemde toplam **8 adet** modül şablonu ve **3 adet** hazır mutfak yerleşimi bulunmaktadır:
- **Gardırop (3 adet):**
  1. `tpl_wardrobe_2door` (1200×2200×600mm, 2 kapaklı standart)
  2. `tpl_wardrobe_3door_drawers` (1800×2200×600mm, 3 kapaklı, 2 çekmeceli)
  3. `tpl_wardrobe_walkin_open` (1000×2300×550mm, açık giyinme modülü)
- **Mutfak (5 adet):**
  4. `tpl_kitchen_base_standard` (600×720×580mm, tek kapaklı alt dolap)
  5. `tpl_kitchen_base_drawers` (800×720×580mm, 3 çekmeceli alt dolap)
  6. `tpl_kitchen_base_sink` (800×720×580mm, çift kapaklı evye alt dolabı)
  7. `tpl_kitchen_wall_standard` (600×720×350mm, 2 raflı üst dolap)
  8. `tpl_kitchen_tall_pantry` (600×2150×580mm, boy kiler dolabı)
- **Mutfak Yerleşimleri (3 adet):** Doğrusal (`proj_kitchen_linear`), L Mutfak (`proj_kitchen_l`), U Mutfak (`proj_kitchen_u`).

### 4.2 V3.1 Tasarım Verisinin Saklanması ve Geriye Dönük Göç (Migration) Planı
- **Saklama Mekanizması:** Tasarımlar istemci tarafında `localStorage` (`"birim_saved_projects"` anahtarı altında) ve JSON dışa/içe aktarma (`DesignProjectSchema`) ile saklanmaktadır. Ayrıca `packages/integrations` içinde `StoreQuoteItemPayload` ve `ERPBlueprintPayload` sözleşmeleri mevcuttur.
- **Sıfır Veri Kaybı Göç Stratejisi (V3.1 → V4.0):**
  1. `DesignProject`, `ModuleInstance`, `CarcassConfig`, `BayConfig`, `DoorConfig` ve `DrawerConfig` üzerindeki tüm mevcut V3.1 alanları **birebir korunacaktır**.
  2. Yeni V4 alanları (`moduleFamilyId`, `templateId`, `constructionProfileId`, `doorSystem`, `openingMechanism`, `handleProfile`, `hardwareSelections`, `applianceConfig`, `complementaryConfig`) Zod şemasında (`.optional()`) ve çalışma zamanı adaptöründe **varsayılan (default) çözümleyicilerle** desteklenecektir.
  3. Bir V3.1 projesi yüklendiğinde (`importProjectJSON` veya `loadFromStorage`), `migrateV3ProjectToV4(project)` saf fonksiyonu eksik V4 alanlarını mevcut V3.1 özelliklerinden (ör. `door.type === "single_left"` → `hinged_single`, `full_overlay`, `HW_BLUM_CLIP_TOP_110`) otomatik türetecek, böylece eski tasarımlar hiçbir veri kaybı olmadan V4 motorunda çalışacaktır.

---

## 5. PERFORMANS BAŞLANGIÇ ÖLÇÜMLERİ (V3.1 BASELINE)

Vitest (`tests/performance-profiling.test.ts` ve `tests/performance-stress.test.ts`) ve Playwright Production Build üzerinde alınan V4 öncesi başlangıç metrikleri:

| Senaryo / Metrik | V3.1 Başlangıç Ölçümü | V4 Kabul Hedefi | Durum |
| :--- | :---: | :---: | :---: |
| **A. 2 Modüllü Standart Dolap (Tam Pipeline)** | **7.69 ms** (Geo: 1.72ms, BOM: 4.69ms) | < 15.0 ms | **KORUNACAK** |
| **B. 10 Modüllü Gardırop (Tam Pipeline)** | **5.69 ms** (230 parça) | < 20.0 ms | **KORUNACAK** |
| **C. 20 Modüllü Çekmeceli Gardırop (760 parça)** | **12.41 ms** (Geo: 0.56ms, BOM: 8.97ms) | < 30.0 ms | **KORUNACAK** |
| **F. 50+ Modüllü Stres Testi (1200 parça)** | **33.19 ms** | < 60.0 ms | **KORUNACAK** |
| **100 Ardışık Ölçü Değişimi (20 Modül)** | **3.24 ms / adım** (Toplam 323.5 ms) | < 10.0 ms / adım | **KORUNACAK** |
| **50 Undo/Redo Bellek Büyümesi** | **325 KB** | Sızıntı yok (< 2 MB) | **KORUNACAK** |
| **Plan Modu Modül Seçimi (p95)** | **0.30 ms** | **p95 < 45 ms** | **KORUNACAK** |
| **3D PBR Sahne Kare Süresi** | **16.10 ms (~60 FPS)** | 60 FPS | **KORUNACAK** |

---

## 6. TEKRARLANAN VEYA KULLANILMAYAN SİSTEMLERİN TESPİTİ

1. **Çift Doğrulama Kanalı (`rules.ts` vs `kitchenSpatialEngine.ts`):**
   - `packages/core/src/rules.ts` içinde 0° yönelimli basit AABB çakışma kontrolü (`validateProject`) yer alırken, `apps/configurator/src/v3/engine/kitchenSpatialEngine.ts` içinde 90°/270° dönüşleri destekleyen gelişmiş mekân doğrulaması bulunmaktadır.
   - **V4 Çözümü:** Mekân, modül, kapak, kulp ve donanım uyumluluk kuralları `@birim/core` ve `@birim/catalog` altındaki **Evrensel Uyumluluk Motoru (Universal Compatibility Engine)** içinde birleştirilecek; hem V2 hem V3/V4 arayüzleri tek deterministik doğrulama motorunu kullanacaktır.
2. **Eski Prototip Rotaları (`/v3/studio`, `/v3/plan`, `/v3/showroom`):**
   - V3.1'de tüm çalışma modları `/v3` altında (`V3UnifiedWorkspace.tsx`) birleştirilmiştir; alt rotalar geriye dönük E2E test uyumluluğu için aynı birleşik bileşeni sarmalamaktadır. Bu sarmalayıcılar hafif olduğu için regresyon testlerini bozmamak adına korunacaktır.
