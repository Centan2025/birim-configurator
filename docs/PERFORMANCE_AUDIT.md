# BİRİM CONFIGURATOR — PERFORMANCE AUDIT REPORT
**Versiyon:** 1.0 (Performance Engineering & Bottleneck Analysis)  
**Tarih:** 4 Kasım 2026  
**Mühendislik Kapsamı:** CAD Render Akıcılığı, Parametrik Hesaplama Zinciri, WebGL/Three.js Optimizasyonu, React & Zustand Bellek Yönetimi

---

## 1. GİRİŞ VE AMAÇ

Bu denetim, `birim-configurator` platformunun çok modüllü büyük ölçekli tasarımlarda (10, 20 ve 50+ gövdeli gardırop ve karmaşık ada/köşe mutfak projeleri) milimetrik parametrik CAD doğruluğunu korurken 60 FPS akıcılık, p95 < 100ms etkileşim tepki süresi ve sıfır bellek sızıntısı ile çalışmasını sağlamak amacıyla gerçekleştirilmiştir.

---

## 2. FAZ 0 — BAŞLANGIÇ DARBOĞAZLARI (BOTTLENECK AUDIT)

Ayrıntılı profil çıkarma (Chrome Performance Profiler, Three.js renderer.info ve Node benchmark süiti) sonucunda tespit edilen kritik ve yüksek öncelikli darboğazlar:

### 🔴 Darboğaz 1 (Kritik): Three.js Her Render Döngüsünde Geometri & Materyal Yıkımı ve Tahsisi
- **Konum:** `apps/configurator/src/components/ThreeCanvas.tsx:204`
- **Mekanizma:** Herhangi bir React state değişiminde (sürgü hareketi, kapak açısı değişimi, ölçü kaydırıcı, parça tıklama) `meshGroup` içindeki tüm mesh'ler `geometry.dispose()` ve `material.dispose()` ile tamamen siliniyor, ardından her parça için sıfırdan `new THREE.BoxGeometry()`, `new THREE.EdgesGeometry()`, `new THREE.MeshStandardMaterial()` ve `new THREE.LineSegments()` tahsis ediliyordu.
- **Etki:** 20 modüllü bir projede 300+ kutu ve 300+ tel kafes geometrisi (~1.200 WebGL GPU buffer çağrısı) her fare hareketinde GPU sürücüsünü kilitliyor ve kare hızını 60 FPS'ten 15-20 FPS'e düşürüyordu.
- **Düzeltme:** 
  1. Tek bir birim küp geometrisi (`UNIT_BOX_GEO = new THREE.BoxGeometry(1, 1, 1)`) ve tel kafes (`UNIT_EDGES_GEO`) belleğe sabitlendi. Paneller `mesh.scale.set(w, h, d)` ile boyutlandırıldı.
  2. Materyaller `materialCache` ve `edgeMaterialCache` ile tekilleştirildi.
  3. Sahne güncellemesinde geometriler çöpe atılmayıp `meshGroup.clear()` ile anında temizlendi; GPU tahsisi sıfırlandı.

### 🔴 Darboğaz 2 (Kritik): 60 FPS Kesintisiz Render Döngüsü (Pil & GPU Tüketimi)
- **Konum:** `apps/configurator/src/components/ThreeCanvas.tsx:135`
- **Mekanizma:** `animate()` fonksiyonu, kullanıcı fareye dokunmasa ve sahne tamamen durağan olsa dahi saniyede 60 kez sahneyi baştan çiziyordu.
- **Etki:** Showroom tabletlerinde aşırı ısınma ve %40-60 GPU yükü.
- **Düzeltme:** **On-Demand Rendering** mimarisine geçildi. Yalnızca kamera hareket ettiğinde (`OrbitControls 'change'`) veya sahne/parametre kirlendiğinde (`needsRenderRef.current = true`) render çağrıldı; durağan durumda render 0 FPS'e (sıfır GPU yükü) indirildi.

### 🔴 Darboğaz 3 (Kritik): Senkron `JSON.parse(JSON.stringify(project))` ve Ağır BOM/Fiyat Zinciri
- **Konum:** `apps/configurator/src/store/useConfiguratorStore.ts:169`
- **Mekanizma:** Her `setDimensions`, `setMaterials` veya `setBayCount` tetiklendiğinde tüm projenin tam derin kopyası alınıyor ve `recompute` ile tüm modüller için BOM, kesim listesi, delik operasyonları ve fiyat hesaplanıyordu.
- **Etki:** 20-50 modülde her ölçü sürgüsü adımında ana iş parçacığı 15-25ms kilitleniyordu.
- **Düzeltme:**
  1. Hızlı yapısal nesne kopyalama (`cloneProject`) fonksiyonuna geçildi; serileştirme yükü 0.05ms altına çekildi.
  2. `bomProjectCache` ile proje revizyon kimliğine dayalı deterministik BOM önbelleklemesi devreye alındı.

### 🟡 Darboğaz 4 (Yüksek): Giyotin Plaka Yerleşim (Nesting) Tekrarlı Hesaplamaları
- **Konum:** `packages/manufacturing/src/sheet-nesting.ts`
- **Mekanizma:** BOM modalı her açıldığında veya malzeme değişiminde onlarca parçanın 2D yerleşimi kerf ve damar yönü hesabı sıfırdan yapılıyordu.
- **Düzeltme:** `computeNestingKey` fonksiyonu ile parça konfigürasyonu değişmediği sürece hesaplama sonucu anında `nestingCache`'den 0.02ms içinde döndürüldü.

### 🟡 Darboğaz 5 (Yüksek): Web Worker ve Eşzamansız Yarış Durumları
- **Konum:** `apps/configurator/src/workers/manufacturing-worker-client.ts`
- **Mekanizma:** Ağır arka plan hesaplamaları sırasında kullanıcı yeni bir ölçü girdiğinde eski hesaplama sonucu yeni tasarımı ezebilirdi (Race Condition).
- **Düzeltme:** `version` ve `jobId` doğrulaması uygulandı. Eski hesaplamalar anında `cancelled` durumuna alınarak atıldı; yalnızca en güncel revizyon onaylandı.
