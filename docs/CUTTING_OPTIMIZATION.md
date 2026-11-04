# Gerçek 2D Plaka Optimizasyonu ve Selco WNT 600 (CUTTING_OPTIMIZATION.md)

## 1. 2D Giyotin Yerleşim Algoritması (Bin Packing)

V1'deki sabit %12 fire varsayımı, V2 ile birlikte **gerçek 2D Guillotine Bin Packing optimizasyon algoritmasına** dönüştürülmüştür.

### Algoritma Girdileri:
- **Plaka Boyutu**: $2800 \times 2070\text{ mm}$ (veya seçilen alternatif ölçü).
- **Çevre Tıraşlama (Trim Cut)**: $15\text{ mm}$ gönyeleme payı (Kullanılabilir alan: $2770 \times 2040\text{ mm}$).
- **Testere Bıçak Kalınlığı (Kerf)**: $4.4\text{ mm}$.
- **Damar Yönü (Grain Direction)**: Desenli veya kaplamalı panellerde 90° döndürme kısıtlaması; desensiz panellerde en iyi alan dolumu için serbest döndürme.

### Çıktılar:
- Her parça için plaka indeksi, yerleşim koordinatları $(x, y, w, l)$, döndürülme durumu (`isRotated`).
- Plaka bazında net kullanılan alan ($m^2$), kalan fire alanı ($m^2$) ve fire yüzdesi (%).
- Web arayüzünde ölçekli 2D plaka yerleşim şeması görselleştirmesi.

---

## 2. Selco WNT 600 Adaptörü ve `UNVERIFIED` Parametreler

Fabrika ortamında çalışan Biesse Selco WNT 600 ebatlama testeresi için ara format XML çıktıları üretilir.

> [!WARNING]
> Aşağıdaki parametreler fabrika Selco makine şefi tarafından fiziksel olarak doğrulanana kadar sistemde `UNVERIFIED` olarak işaretlenmiştir:
> 1. `sawBladeKerfMm: 4.4` (Testere bıçak kalınlığı fabrika takım tablosu ile doğrulanmalıdır).
> 2. `minGripperCutWidthMm: 70` (Tutucu kıskaç asgari derinliği doğrulanmalıdır).
> 3. `scoringBladeKerfMm: 3.2` (Çizici alt bıçak kalınlığı doğrulanmalıdır).
> 4. `controllerFormat: OSAI_OPEN_XML` (Kontrol ünitesi sürümü doğrulanmalıdır).
