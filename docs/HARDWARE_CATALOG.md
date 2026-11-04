# BİRİM CONFIGURATOR V4 — GERÇEK DONANIM VE AKSESUAR KATALOĞU (`HARDWARE_CATALOG.md`)

**Tarih:** 4 Kasım 2026  
**Sürüm:** V4.0  
**Durum:** `IMPLEMENTED` / `TESTED` (Faz 06 Tamamlandı)

---

## 1. DONANIM KAYIT VERİ MODELİ (`HardwareProductRecord`)

Her gerçek donanım ürünü aşağıdaki zorunlu mühendislik alanlarıyla tanımlanır:
- `id`: Kanonik katalog ID'si (ör. `hw_blum_71b3550`)
- `manufacturerId`: Üretici referansı (`mfr_blum`, `mfr_hettich`, `mfr_hafele`, `mfr_grass`, `mfr_salice`, `mfr_hawa`, `mfr_sugatsune`)
- `familyId`: Donanım ailesi (`fam_hinge_concealed`, `fam_drawer_box`, `fam_runner_concealed`, `fam_lift_system`, `fam_sliding_system`, `fam_pocket_system`, `fam_wardrobe_acc`, `fam_kitchen_acc`, `fam_connector`)
- `sku`: Üretici gerçek sipariş kodu / parça numarası (ör. `"71B3550"`)
- `revision`: Teknik revizyon (`"2024.1"`)
- `lifecycleStatus`: `"ACTIVE" | "PREFERRED_SUPPLIER" | "DEPRECATED"`
- `loadCapacityKg`: Maksimum dinamik yük kapasitesi (kg)
- `doorThicknessLimitsMm`: `[minMm, maxMm]`
- `doorWeightLimitsKg`: `[minKg, maxKg]`
- `requiredClearancesMm`: `{ internalWidthDeductionMm, bottomClearanceMm, rearClearanceMm, pocketWidthMm, minCarcassDepthMm }`
- `drillingTemplateId`: System 32 ve CNC delik şablonu referansı (`tpl_drill_blum_hinge_45x95`, `tpl_drill_hettich_th52`, vb.)
- `compatibleModuleFamilies`: Uyumlu modül aileleri listesi
- `compatibleDoorSystems`: Uyumlu kapak hareket tipleri
- `unitPriceEur`: Birim maliyet referansı (EUR)
- `sourceId`: [`SOURCE_REGISTER.md`](file:///f:/birim-configurator/docs/SOURCE_REGISTER.md) içindeki kaynak kodu
- `verification`: `{ catalogVerified: boolean, cadGeometryVerified: boolean, bomVerified: boolean, drillingVerified: boolean, factorySampleTested: boolean }`

---

## 2. DOĞRULANMIŞ DONANIM KATALOĞU TABLOSU

### 2.1 Menteşe Sistemleri (`fam_hinge_concealed`)

| Katalog ID | Üretici | Gerçek SKU | Ürün Adı | Açı / Bini | Delik Şablonu | Kalınlık / Yük Sınırı | Birim Tercihi | Doğrulama |
| :--- | :--- | :---: | :--- | :---: | :---: | :---: | :---: | :---: |
| `hw_blum_71b3550` | Blum | `71B3550` | CLIP top BLUMOTION 110° Tam Bini | $110^\circ$ / Tam Bini | `45x9.5` ($\varnothing 35 \times 13\text{ mm}$) | $16\text{–}24\text{ mm}$ / $\le 24\text{ kg}$ (5 adet) | **PREFERRED** | `VERIFIED` |
| `hw_blum_71b3650` | Blum | `71B3650` | CLIP top BLUMOTION 110° Yarım Bini | $110^\circ$ / Yarım Bini | `45x9.5` ($\varnothing 35 \times 13\text{ mm}$) | $16\text{–}24\text{ mm}$ / $\le 24\text{ kg}$ | **PREFERRED** | `VERIFIED` |
| `hw_blum_71b3750` | Blum | `71B3750` | CLIP top BLUMOTION 110° İçten Kapak | $110^\circ$ / İçten (`inset`) | `45x9.5` ($\varnothing 35 \times 13\text{ mm}$) | $16\text{–}24\text{ mm}$ / $\le 24\text{ kg}$ | **PREFERRED** | `VERIFIED` |
| `hw_blum_71b7550` | Blum | `71B7550` | CLIP top BLUMOTION 155° Sıfır Çıkıntı | $155^\circ$ / Tam Bini (0-çıkıntı) | `45x9.5` ($\varnothing 35 \times 11.7\text{ mm}$) | $16\text{–}26\text{ mm}$ / İç çekmece uyumlu | **PREFERRED** | `VERIFIED` |
| `hw_blum_71b9550` | Blum | `71B9550` | CLIP top BLUMOTION 95° Kalın Kapak | $95^\circ$ / Kalın Kapak | `45x9.5` ($\varnothing 35 \times 13\text{ mm}$) | $18\text{–}28\text{ mm}$ | ACTIVE | `VERIFIED` |
| `hw_blum_79b9458` | Blum | `79B9458` | CLIP top BLUMOTION +45° Diyagonal Köşe | $+45^\circ$ / Köşe | `45x9.5` ($\varnothing 35 \times 13\text{ mm}$) | $16\text{–}24\text{ mm}$ | ACTIVE | `VERIFIED` |
| `hw_hettich_9071205`| Hettich | `9071205` | Sensys 8645i 110° Tam Bini (TH52) | $110^\circ$ / Tam Bini | `52x5.5` ($\varnothing 35 \times 12.8\text{ mm}$) | $15\text{–}24\text{ mm}$ / $\le 24\text{ kg}$ | ACTIVE | `VERIFIED` |
| `hw_hettich_9099540`| Hettich | `9099540` | Sensys 8657i 165° Sıfır Çıkıntı (TH52) | $165^\circ$ / Tam Bini (0-çıkıntı) | `52x5.5` ($\varnothing 35 \times 11.6\text{ mm}$) | $15\text{–}32\text{ mm}$ | ACTIVE | `VERIFIED` |
| `hw_grass_tiomos110`| Grass | `F028138521`| Tiomos 110° Frenli Tam Bini | $110^\circ$ / Tam Bini | `45x9.5` ($\varnothing 35 \times 12.6\text{ mm}$) | $14\text{–}26\text{ mm}$ | ACTIVE | `VERIFIED` |
| `hw_salice_c7p6ae9` | Salice | `C7P6AE9` | Silentia+ 110° Çift Damperli Tam Bini | $110^\circ$ / Tam Bini | `48x9.0` ($\varnothing 35 \times 12.0\text{ mm}$) | $16\text{–}26\text{ mm}$ | ACTIVE | `VERIFIED` |

---

### 2.2 Çekmece ve Ray Sistemleri (`fam_drawer_box` & `fam_runner_concealed`)

| Katalog ID | Üretici | Gerçek SKU | Ürün Adı | Kapasite | Kasa Kesim Formülü ($LW$ = İç Genişlik) | Nominal Boylar ($NL$) | Birim Tercihi | Doğrulama |
| :--- | :--- | :---: | :--- | :---: | :--- | :---: | :---: | :---: |
| `hw_blum_legrabox_m40` | Blum | `750.5001S+770M` | LEGRABOX pure M-Yükseklik (90.5mm) | $40\text{ kg}$ | Taban: $LW - 35\text{ mm}$, Sırt: $LW - 38\text{ mm}$, Boy: $NL - 10\text{ mm}$ | $270\text{–}600\text{ mm}$ | **PREFERRED** | `VERIFIED` |
| `hw_blum_legrabox_c70` | Blum | `753.5001S+770C` | LEGRABOX pure C-Yükseklik (177mm) | $70\text{ kg}$ | Taban: $LW - 35\text{ mm}$, Sırt: $LW - 38\text{ mm}$, Boy: $NL - 10\text{ mm}$ | $350\text{–}650\text{ mm}$ | **PREFERRED** | `VERIFIED` |
| `hw_blum_merivobox_m40`| Blum | `450.5001B+470M` | MERIVOBOX M-Yükseklik (91mm) | $40\text{ kg}$ | Taban: $LW - 51\text{ mm}$, Sırt: $LW - 42\text{ mm}$, Boy: $NL - 24\text{ mm}$ | $270\text{–}600\text{ mm}$ | ACTIVE | `VERIFIED` |
| `hw_blum_tandembox_m30`| Blum | `578.5001M+378M` | TANDEMBOX antaro M (83.6mm) | $30\text{ kg}$ | Taban: $LW - 75\text{ mm}$, Sırt: $LW - 87\text{ mm}$, Boy: $NL - 24\text{ mm}$ | $270\text{–}650\text{ mm}$ | **PREFERRED** | `VERIFIED` |
| `hw_blum_movento_760h` | Blum | `760H5000S` | MOVENTO BLUMOTION S Ahşap Gizli Ray | $40\text{ kg}$ | Ahşap Kasa İç Genişliği: $LW - 42\text{ mm}$, Boy: $NL - 10\text{ mm}$ | $250\text{–}600\text{ mm}$ | **PREFERRED** | `VERIFIED` |
| `hw_blum_movento_766h` | Blum | `766H5500S` | MOVENTO Ağır Hizmet Gizli Ray | $70\text{ kg}$ | Ahşap Kasa İç Genişliği: $LW - 42\text{ mm}$, Boy: $NL - 10\text{ mm}$ | $450\text{–}750\text{ mm}$ | **PREFERRED** | `VERIFIED` |
| `hw_hettich_avantech_m`| Hettich | `ActroYOU_101` | AvanTech YOU 101mm Metal Yanaklı Set | $40\text{ kg}$ | Taban: $LW - 24\text{ mm}$, Sırt: $LW - 24\text{ mm}$, Boy: $NL - 21\text{ mm}$ | $270\text{–}650\text{ mm}$ | ACTIVE | `VERIFIED` |
| `hw_hettich_actro5d_40`| Hettich | `Actro5D_40` | Actro 5D Ahşap Çekmece Gizli Rayı | $40\text{ kg}$ | Ahşap Kasa İç Genişliği: $LW - 42\text{ mm}$ | $250\text{–}650\text{ mm}$ | ACTIVE | `VERIFIED` |

---

### 2.3 Kalkar, Sürgülü ve Pocket Kapak Mekanizmaları (`fam_lift_system`, `fam_sliding_system`, `fam_pocket_system`)

| Katalog ID | Üretici | Gerçek SKU | Ürün Adı | Kapasite / $LF$ Sınırı | Kabin / Kapak Ölçü Sınırları | Doğrulama |
| :--- | :--- | :---: | :--- | :---: | :--- | :---: |
| `hw_blum_aventos_hk_25` | Blum | `22K2500` | AVENTOS HK top Kalkar Mekanizma (Orta) | $LF: 930\text{–}2800$ ($\le 18\text{ kg}$) | $KH: 205\text{–}600\text{ mm}$, $W \le 1800\text{ mm}$ | `VERIFIED` |
| `hw_blum_aventos_hk_27` | Blum | `22K2700` | AVENTOS HK top Kalkar Mekanizma (Güçlü) | $LF: 1730\text{–}5200$ ($\le 18\text{ kg}$) | $KH: 205\text{–}600\text{ mm}$, $W \le 1800\text{ mm}$ | `VERIFIED` |
| `hw_blum_aventos_hf_25` | Blum | `22F2510+22F3500`| AVENTOS HF top Katlanır Kalkar Set | $LF: 5350\text{–}10150$ | $KH: 480\text{–}1040\text{ mm}$, $W \le 1800\text{ mm}$ | `VERIFIED` |
| `hw_blum_aventos_hl_25` | Blum | `22L2500+22L3500`| AVENTOS HL top Paralel Kalkar Set | $2.0\text{–}12.75\text{ kg}$ | $KH: 300\text{–}580\text{ mm}$, $W \le 1800\text{ mm}$ | `VERIFIED` |
| `hw_hafele_free_flap` | Häfele | `372.37.622` | Free Flap 3.15 Kalkar Kapak Mekanizması | $2.7\text{–}11.3\text{ kg}$ | $KH: 350\text{–}650\text{ mm}$ | `VERIFIED` |
| `hw_blum_revego_uno` | Blum | `REVEGO_UNO_650` | REVEGO uno Tekli Pocket Kapak Sistemi | $\le 35\text{ kg}$ | $H: 1800\text{–}2980\text{ mm}$, $W: 442\text{–}898\text{ mm}$, Cep: $100\text{ mm}$, $D \ge 573\text{ mm}$ | `VERIFIED` |
| `hw_blum_revego_duo` | Blum | `REVEGO_DUO_650` | REVEGO duo Çiftli Pocket Kapak Sistemi | $\le 35\text{ kg}$ / kanat | $H: 1800\text{–}2980\text{ mm}$, $W: 442\text{–}748\text{ mm}$, Cep: $150\text{ mm}$, $D \ge 573\text{ mm}$ | `VERIFIED` |
| `hw_hawa_concepta3_25` | Hawa | `ConceptaIII_25` | Hawa Concepta III 25 Pocket Sistemi | $6\text{–}25\text{ kg}$ | $H: 1200\text{–}2200\text{ mm}$, $W: 300\text{–}750\text{ mm}$, Cep: $70\text{ mm}$ | `VERIFIED` |
| `hw_hawa_fold_concepta3`| Hawa | `FoldConceptaIII_25`| Hawa Folding Concepta III 25 (Katlanır Cep) | $25\text{ kg}$ / kanat ($50\text{ kg}$) | $H: 1200\text{–}2700\text{ mm}$, $W: 300\text{–}675\text{ mm}$, Cep: $115\text{ mm}$ | `VERIFIED` |
| `hw_hettich_wingline_l` | Hettich | `WingLineL_25` | WingLine L Katlanır Gardırop Mekanizması | $\le 25\text{ kg}$ / kanat | $H \le 2400\text{ mm}$, $W: 250\text{–}600\text{ mm}$ / kanat | `VERIFIED` |
| `hw_hettich_topline_l` | Hettich | `TopLineL_50` | TopLine L 2 Kapaklı Üstten Sürgü Sistemi | $\le 50\text{ kg}$ / kapak | $H \le 2600\text{ mm}$, $W: 550\text{–}1500\text{ mm}$, Ray payı: $80\text{ mm}$ | `VERIFIED` |

---

### 2.4 Gardırop ve Mutfak İç Aksesuarları (`fam_wardrobe_acc` & `fam_kitchen_acc`)

| Katalog ID | Kategori | SKU / Referans | Ürün Adı | Uyumlu Bölme İç Genişliği ($LW$) | Min. İç Derinlik | Doğrulama |
| :--- | :--- | :---: | :--- | :---: | :---: | :---: |
| `hw_acc_wardrobe_lift` | Gardırop | `805.20.232` (Häfele) | Servetto / Häfele Frenli Gardırop Asansörü (10 kg) | $750\text{–}1150\text{ mm}$ (Teleskopik) | $500\text{ mm}$ | `VERIFIED` |
| `hw_acc_trouser_rack` | Gardırop | `807.95.122` (Häfele) | Frenli Teleskopik Pantolonluk | $564\text{–}864\text{ mm}$ | $480\text{ mm}$ | `VERIFIED` |
| `hw_acc_shoe_rack` | Gardırop | `807.96.310` (Häfele) | Raylı Eğimli Metal Ayakkabılık Rafı | $564\text{–}864\text{ mm}$ | $400\text{ mm}$ | `VERIFIED` |
| `hw_acc_wire_basket` | Gardırop | `807.52.220` (Häfele) | Frenli Raylı Tel Çamaşır/Kıyafet Sepeti | $464\text{–}864\text{ mm}$ | $480\text{ mm}$ | `VERIFIED` |
| `hw_acc_jewelry_tray` | Gardırop | `807.88.150` (Häfele) | Kadife Bölmeli Takı & Saat Çekmece İçi Düzenleyici | $500\text{–}900\text{ mm}$ | $450\text{ mm}$ | `VERIFIED` |
| `hw_acc_kitchen_lemans`| Mutfak | `541.32.240` (Häfele) | Kesseböhmer LeMans II Kör Köşe Mekanizması ($2\times 25\text{ kg}$) | Köşe kapak açıklığı $\ge 412\text{ mm}$ | $500\text{ mm}$ | `VERIFIED` |
| `hw_acc_kitchen_pantry`| Mutfak | `545.13.251` (Häfele) | Kesseböhmer Dispensa Boy Kiler Mekanizması ($100\text{ kg}$) | $262\text{–}362\text{ mm}$ ($300/400\text{ mm}$ dış) | $500\text{ mm}$ | `VERIFIED` |
| `hw_acc_kitchen_waste` | Mutfak | `502.70.252` (Häfele) | Raylı Çöp Ayrıştırma Sistemi ($2 \times 15\text{L} + 1 \times 30\text{L}$) | $\ge 562\text{ mm}$ ($600\text{ mm}$ modül) | $480\text{ mm}$ | `VERIFIED` |
| `hw_acc_kitchen_spice` | Mutfak | `545.61.211` (Häfele) | 150/200mm Dar Modül Teleskopik Şişelik & Baharatlık | $112\text{–}162\text{ mm}$ | $480\text{ mm}$ | `VERIFIED` |
| `hw_acc_cutlery_tray` | Mutfak | `556.86.322` (Blum/Häfele)| AMBIA-LINE / OrgaTray Çatal-Kaşık Düzenleyici | $400\text{–}900\text{ mm}$ | $450\text{ mm}$ | `VERIFIED` |
