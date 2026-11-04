# BİRİM CONFIGURATOR V4 — DONANIM SİSTEMLERİ TEKNİK ARAŞTIRMASI (`RESEARCH_HARDWARE_SYSTEMS.md`)

**Tarih:** 4 Kasım 2026  
**Sürüm:** V4.0  
**Durum:** `IMPLEMENTED` / `TESTED` (Faz 01 Tamamlandı)

---

## 1. MENTEŞE SİSTEMLERİ (HINGES — EN 15570)

Aşağıdaki tablo, üretici kataloglarından doğrulanmış (`VERIFIED`) gerçek ürün kodlarını, tas/vida delik şablonlarını, kapak kalınlığı sınırlarını ve bini formüllerini içerir:

| Üretici & Aile | Model & SKU | Açılma Açısı | Bini / Uygulama | Tas Deliği ($\varnothing \times \text{Derinlik}$) | Vida/Dübel Kalıbı (Boss Pattern) | Kapak Kalınlığı ($T_{\text{door}}$) | Kapak Ağırlık Limiti (Adet / Yükseklik) | Doğrulama & Kaynak |
| :--- | :--- | :---: | :--- | :---: | :---: | :---: | :--- | :---: |
| **Blum CLIP top BLUMOTION** | `71B3550` (Vidalı)<br>`71B3590` (INSERTA) | $110^\circ$ | Tam Bini (0 mm krank) | $\varnothing 35 \times 13.0\text{ mm}$ | $45 \times 9.5\text{ mm}$ | $16\text{–}24\text{ mm}$ | 2 adet: $\le 9\text{ kg}$<br>3 adet: $\le 15\text{ kg}$<br>4 adet: $\le 20\text{ kg}$<br>5 adet: $\le 24\text{ kg}$ | `VERIFIED`<br>(`SRC_BLUM_CAT_HINGE`) |
| **Blum CLIP top BLUMOTION** | `71B3650` (Vidalı)<br>`71B3690` (INSERTA) | $110^\circ$ | Yarım Bini (9.5 mm krank) | $\varnothing 35 \times 13.0\text{ mm}$ | $45 \times 9.5\text{ mm}$ | $16\text{–}24\text{ mm}$ | 2–5 adet ($\le 24\text{ kg}$) | `VERIFIED`<br>(`SRC_BLUM_CAT_HINGE`) |
| **Blum CLIP top BLUMOTION** | `71B3750` (Vidalı)<br>`71B3790` (INSERTA) | $110^\circ$ | İçten Kapak / Inset (18 mm krank) | $\varnothing 35 \times 13.0\text{ mm}$ | $45 \times 9.5\text{ mm}$ | $16\text{–}24\text{ mm}$ | 2–5 adet ($\le 24\text{ kg}$); taban $37 + T_{\text{door}} + 2\text{ mm}$ geride | `VERIFIED`<br>(`SRC_BLUM_CAT_HINGE`) |
| **Blum CLIP top BLUMOTION 155°** | `71B7550` (Vidalı)<br>`71B7590` (INSERTA) | $155^\circ$ | Tam Bini — **Sıfır Çıkıntı (Zero Protrusion)** | $\varnothing 35 \times 11.7\text{ mm}$ | $45 \times 9.5\text{ mm}$ | $16\text{–}26\text{ mm}$ | İç çekmeceli (SPACE TOWER) modüller için zorunlu | `VERIFIED`<br>(`SRC_BLUM_CAT_HINGE`) |
| **Blum CLIP top BLUMOTION Kalın Kapak** | `71B9550` | $95^\circ$ | Kalın Kapak / Profil Kapak | $\varnothing 35 \times 13.0\text{ mm}$ | $45 \times 9.5\text{ mm}$ | $18\text{–}28\text{ mm}$ | Kalın lake / profil kapaklar için düşük fuga boşluğu | `VERIFIED`<br>(`SRC_BLUM_CAT_HINGE`) |
| **Hettich Sensys 110°** | `9071205` (8645i B00 Tam)<br>`9071206` (8645i B9.5 Yarım)<br>`9071207` (8645i B16 İçten) | $110^\circ$ | Tam / Yarım / İçten | $\varnothing 35 \times 12.8\text{ mm}$ | $52 \times 5.5\text{ mm}$ (TH52) | $15\text{–}24\text{ mm}$ | $35^\circ$ kendiliğinden kapanma açısı, entegre Silent System | `VERIFIED`<br>(`SRC_HETTICH_SENSYS`) |
| **Hettich Sensys 165°** | `9099540` (8657i TH52) | $165^\circ$ | Tam Bini — **Sıfır Çıkıntı (Zero Protrusion)** | $\varnothing 35 \times 11.6\text{ mm}$ | $52 \times 5.5\text{ mm}$ (TH52) | $15\text{–}32\text{ mm}$ | İç çekmece yan boşluğu sıfır çıkıntı sağlar | `VERIFIED`<br>(`SRC_HETTICH_SENSYS`) |
| **Grass Tiomos 110°** | `F028138521` | $110^\circ$ | Tam Bini | $\varnothing 35 \times 12.6\text{ mm}$ | $45 \times 9.5\text{ mm}$ | $14\text{–}26\text{ mm}$ | Menteşe kolu içinde 3 kademeli ayarlanabilir yavaşlatıcı | `VERIFIED`<br>(`SRC_GRASS_TIOMOS`) |
| **Salice Silentia+ 110°** | `C7P6AE9` (110° Düz)<br>`CFA7AE9` (155° Sıfır Çıkıntı) | $110^\circ / 155^\circ$ | Tam Bini | $\varnothing 35 \times 12.0\text{ mm}$ | $48 \times 9.0\text{ mm}$ veya $45 \times 9.5\text{ mm}$ | $16\text{–}26\text{ mm}$ | Tas içine gömülü çift silikon yağlı yavaşlatıcı | `VERIFIED`<br>(`SRC_SALICE_SILENTIA`) |

---

## 2. ÇEKMECE VE RAY SİSTEMLERİ (DRAWER & RUNNER SYSTEMS — EN 15338)

| Üretici & Aile | Model & SKU | Tip | Yük Kapasitesi | Kasa Yükseklikleri & Boylar ($NL$) | Doğrulanmış Kesim Formülleri ($LW$ = Bölme Net İç Genişliği) | Doğrulama & Kaynak |
| :--- | :--- | :--- | :---: | :--- | :--- | :---: |
| **Blum LEGRABOX** | Ray: `750.` (40kg) / `753.` (70kg)<br>Yanak: `770N`, `770M`, `770K`, `770C`, `770F` | Ultra ince ($12.8\text{ mm}$) düz metal yanaklı çekmece | **40 kg / 70 kg** | $N: 66.5\text{ mm}$<br>$M: 90.5\text{ mm}$<br>$K: 128.5\text{ mm}$<br>$C: 177\text{ mm}$<br>$F: 241\text{ mm}$<br>$NL: 270\text{–}650\text{ mm}$ | • **Taban Genişliği ($16\text{ mm}$):** $LW - 35\text{ mm}$<br>• **Ahşap Sırt Genişliği:** $LW - 38\text{ mm}$<br>• **Taban Derinliği:** $NL - 10\text{ mm}$<br>• *Not:* $16\text{ mm}$ taban altında boydan kanal (rebate) gerektirir. | `VERIFIED`<br>(`SRC_BLUM_LEGRABOX`) |
| **Blum MERIVOBOX** | Ray: `450.` (40kg) / `453.` (70kg)<br>Yanak: `470N`, `470M`, `470K`, `470E` | L-form tek platform metal yanaklı çekmece | **40 kg / 70 kg** | $N: 68.5\text{ mm}$<br>$M: 91\text{ mm}$<br>$K: 129\text{ mm}$<br>$E: 192\text{ mm}$<br>$NL: 270\text{–}600\text{ mm}$ | • **Taban Genişliği ($16\text{ mm}$):** $LW - 51\text{ mm}$ (Kanal açma gerektirmez)<br>• **Ahşap Sırt Genişliği:** $LW - 42\text{ mm}$<br>• **Taban Derinliği:** $NL - 24\text{ mm}$ | `VERIFIED`<br>(`SRC_BLUM_MERIVOBOX`) |
| **Blum TANDEMBOX antaro** | Ray: `578.` (30kg) / `576.` (65kg)<br>Yanak: `378N`, `378M`, `378K` | Klasik çift cidarlı metal yanaklı çekmece | **30 kg / 65 kg** | $N: 68.5\text{ mm}$<br>$M: 83.6\text{ mm}$<br>$K: 115.6\text{ mm}$<br>$D/C: 204\text{ mm}$<br>$NL: 270\text{–}650\text{ mm}$ | • **Taban Genişliği ($16\text{ mm}$):** $LW - 75\text{ mm}$<br>• **Ahşap Sırt Genişliği:** $LW - 87\text{ mm}$<br>• **Taban Derinliği:** $NL - 24\text{ mm}$ | `VERIFIED`<br>(`SRC_BLUM_TANDEMBOX`) |
| **Blum MOVENTO** | `760H` (40kg)<br>`766H` (70kg) | Ahşap kasalı çekmece için tam açılımlı gizli ray | **40 kg / 70 kg** | $NL: 250\text{–}750\text{ mm}$ ($50\text{ mm}$ adımlarla + ara boylar) | • **Ahşap Kasa İç Genişliği ($SKW$):** $LW - 42\text{ mm}$ ($\le 16\text{ mm}$ yanak kalınlığı için)<br>• **Ahşap Kasa Boyu ($SKL$):** $NL - 10\text{ mm}$<br>• **Alt Boşluk:** Min. $14\text{ mm}$ | `VERIFIED`<br>(`SRC_BLUM_MOVENTO`) |
| **Hettich AvanTech YOU** | Ray: `Actro YOU` (40/70kg) / `Quadro YOU` (30kg) | $13\text{ mm}$ ince çift cidarlı metal yanaklı çekmece | **30 / 40 / 70 kg** | Yükseklik: $77, 101, 139, 187, 251\text{ mm}$<br>$NL: 270\text{–}650\text{ mm}$ | • **Taban Genişliği ($16\text{ mm}$):** $LW - 24\text{ mm}$ (Alt kanal açma gerektirmez)<br>• **Ahşap Sırt Genişliği:** $LW - 24\text{ mm}$<br>• **Taban Derinliği:** $NL - 21\text{ mm}$ | `VERIFIED`<br>(`SRC_HETTICH_AVANTECH`) |
| **Hettich Actro 5D** | `Actro 5D` (40/70kg) | Ahşap çekmece gizli rayı (5 yönlü ayar) | **10 / 40 / 70 kg** | $NL: 250\text{–}750\text{ mm}$ | • **Ahşap Kasa İç Genişliği ($SKW$):** $LW - 42\text{ mm}$ ($16\text{ mm}$ yanak / EB 20 için) | `VERIFIED`<br>(`SRC_HETTICH_ACTRO5D`) |
| **Grass Nova Pro Scala & Dynapro** | `Nova Pro Scala` (Box)<br>`Dynapro` (Gizli Ray) | Metal yanaklı & ahşap gizli ray | **40 kg / 70 kg** | Scala: $H63, H90, H122, H186, H250$<br>$NL: 270\text{–}650\text{ mm}$ | • **Dynapro İç Genişlik:** $LW - 42\text{ mm}$ (`VERIFIED`)<br>• **Scala Taban Kesim Formülü:** `UNVERIFIED` (Katalog PDF tablosu doğrulaması bekliyor). | `VERIFIED` / `UNVERIFIED`<br>(`SRC_GRASS_SCALA`) |
| **Häfele Matrix** | `Matrix Box S` / `Matrix Box P` / `Slim A30` | Metal yanaklı çekmece ailesi | **30 / 35 / 50 / 70 kg** | $NL: 270\text{–}600\text{ mm}$ | • $16\text{ mm}$ taban ve sırt kullanır; alt-seri bazlı $LW$ düşüm farkı `UNVERIFIED`. | `VERIFIED` / `UNVERIFIED`<br>(`SRC_HAFELE_MATRIX`) |

---

## 3. KALKAR KAPAK MEKANİZMALARI (LIFT SYSTEMS)

Kalkar kapaklarda doğrulama motoru **Güç Faktörü ($LF$ — Power Factor)** formülünü kullanır:
$$\text{LF} = H_{\text{carcass}}\text{ [mm]} \times \left(m_{\text{door}}\text{ [kg]} + 2 \cdot m_{\text{handle}}\text{ [kg]}\right)$$

| Üretici & Sistem | Doğrulanmış SKU'lar | Hareket Tipi | Kabin Yüksekliği ($KH$) | Kapak Ağırlığı / Güç Faktörü ($LF$) | Doğrulama & Kaynak |
| :--- | :--- | :--- | :---: | :--- | :---: |
| **Blum AVENTOS HK top** | `22K2300` ($LF: 420\text{–}1610$)<br>`22K2500` ($LF: 930\text{–}2800$)<br>`22K2700` ($LF: 1730\text{–}5200$)<br>`22K2900` ($LF: 3200\text{–}9000$) | Tek parça yukarı döner kalkar (`lift_up_stay`) | **$205\text{–}600\text{ mm}$** | Maks. kapak ağırlığı **$18\text{ kg}$** (2 mekanizma ile); entegre açı sınırlayıcı ($75^\circ\text{–}107^\circ$). | `VERIFIED`<br>(`SRC_BLUM_AVENTOS`) |
| **Blum AVENTOS HF top** | Güç ünitesi: `22F2210`, `22F2510`, `22F2810`<br>Kol: `22F3200`, `22F3500`, `22F3800`, `22F3900` | İki parçalı katlanır kalkar (`lift_bi_fold`) | **$480\text{–}1200\text{ mm}$** | $LF: 2700\text{–}19300$; üstte $120^\circ$ CLIP top menteşe (`70T5550.TL`) + ortada parmak koruma menteşesi (`78Z5500T`). | `VERIFIED`<br>(`SRC_BLUM_AVENTOS`) |
| **Blum AVENTOS HL top** | Güç ünitesi: `22L2200`, `22L2500`, `22L2800`<br>Kol: `22L3200`, `22L3500`, `22L3800`, `22L3900` | Paralel yukarı kalkar (`lift_parallel`) | **$300\text{–}580\text{ mm}$** | Kapak ağırlığı **$1.25\text{–}20.0\text{ kg}$** ($KH$ yüksekliğine bağlı matris). | `VERIFIED`<br>(`SRC_BLUM_AVENTOS`) |
| **Blum AVENTOS HS top** | Güç ünitesi: `22S2200`, `22S2500`, `22S2800`<br>Kol: `22S3500` | Üstten aşarak döner kalkar (`lift_up_over`) | **$350\text{–}800\text{ mm}$** | Kapak ağırlığı **$2.0\text{–}21.5\text{ kg}$**; taç/ışık bandı ile uyumlu. | `VERIFIED`<br>(`SRC_BLUM_AVENTOS`) |
| **Häfele Free Ailesi** | `Free Flap 1.7` / `3.15` (Stay)<br>`Free Fold` (Katlanır)<br>`Free Up` (Paralel)<br>`Free Slide` (Dikey) | 4 ana kalkar hareket ailesi | Flap: $200\text{–}650\text{ mm}$<br>Fold: $450\text{–}1040\text{ mm}$ | • Free Flap: $1.0\text{–}15.0\text{ kg}$<br>• Free Fold: $1.9\text{–}20.9\text{ kg}$<br>• Free Up: $4.0\text{–}24.0\text{ kg}$ | `VERIFIED`<br>(`SRC_HAFELE_FREE`) |
| **Grass Kinvaro** | `T-Slim` / `T-71` / `F-20` / `L-80` / `S-35` | Gömme ve standart kalkar mekanizmalar | $200\text{–}800\text{ mm}$ | T-Slim yalnızca $12\text{ mm}$ kalınlığındadır; $\ge 16\text{ mm}$ yan panele gömülebilir. | `VERIFIED`<br>(`SRC_GRASS_KINVARO`) |
| **Salice Wind & Pacta** | `Wind` (Kalkar)<br>`Pacta` (90° Düşer Kapak) | Yukarı kalkar / Aşağı açılır bar kapağı | Pacta: $280\text{–}600\text{ mm}$ | Pacta: $2.5\text{–}15.0\text{ kg}$, $\varnothing 35 \times 13\text{ mm}$ tas ($\text{TAB} = 4.5\text{ mm}$). | `VERIFIED`<br>(`SRC_SALICE_LIFT`) |

---

## 4. POCKET (GİZLENEN), KATLANIR VE SÜRGÜLÜ KAPAK SİSTEMLERİ

| Üretici & Sistem | Model / Varyant | Hareket Kategorisi | Kapak Ağırlık Limiti | Kapak Ölçü Sınırları ($H \times W \times T$) | Gerekli Boşluk ve Derinlik Kuralları | Doğrulama & Kaynak |
| :--- | :--- | :--- | :---: | :--- | :--- | :---: |
| **Blum REVEGO** | `REVEGO uno` (Tek)<br>`REVEGO duo` (Çift) | Tam boy entegre Pocket kapak (TIP-ON bas-aç) | **Maks. 35 kg** / kanat | • $H: 1800\text{–}2980\text{ mm}$<br>• $W: 442\text{–}898\text{ mm}$ (*uno*) / $442\text{–}748\text{ mm}$ (*duo*)<br>• $T: 18\text{–}26\text{ mm}$ | • **Sabit Cep Genişliği:** *uno* = **$100\text{ mm}$**, *duo* = **$150\text{ mm}$**.<br>• **Min. Gövde Derinliği:** **$573\text{ mm}$**. | `VERIFIED`<br>(`SRC_BLUM_REVEGO`) |
| **Hawa Concepta III** | `Concepta III 25` / `35` | Tekli döner-sürülür Pocket kapak | **25 kg** (`III 25`)<br>**35 kg** (`III 35`) | • $H: 1200\text{–}2700\text{ mm}$<br>• $W: 300\text{–}750\text{ mm}$<br>• $T: 18\text{–}26\text{ mm}$ | • **Cep Genişliği:** $\approx 65\text{–}75\text{ mm}$ net yan boşluk.<br>• Alt zemin kılavuz kanalı gerektirmez. | `VERIFIED`<br>(`SRC_HAWA_CONCEPTA3`) |
| **Hawa Folding Concepta III** | `Folding Concepta III 20` / `25` | Çift kanat katlanır-sürülür Pocket kapak | **20 kg / 25 kg** kanat başına (50 kg çift) | • $H: 1200\text{–}2700\text{ mm}$<br>• $W: 300\text{–}675\text{ mm}$ / kanat<br>• $T: 18\text{–}26\text{ mm}$ | • Tek yan cepte ($\approx 110\text{–}120\text{ mm}$) $1350\text{ mm}$'lik 2 kanadı gizler (çift taraflı $2700\text{ mm}$). | `VERIFIED`<br>(`SRC_HAWA_CONCEPTA3`) |
| **Salice Exedra2** | `Exedra2 Star` / `Smart` | Kam destekli eşzamanlı çift kanat Pocket | **Maks. 25 kg** / kanat (50 kg çift) | • $H: 1800\text{–}3000\text{ mm}$<br>• $W: 350\text{–}862\text{ mm}$<br>• $T: 18\text{–}25\text{ mm}$ | • Halatsız kam mekanizması ile tek elle senkronize hareket. | `VERIFIED`<br>(`SRC_SALICE_EXEDRA2`) |
| **Hettich WingLine L** | `WingLine L` (*Push / Pull to move*) | Yandan katlanır gardırop/dolap kapağı (`folding_side`) | **Maks. 25 kg** / kanat (50 kg 2 kanat) | • $H: \le 2400\text{ mm}$<br>• $W: 250\text{–}600\text{ mm}$ / kanat<br>• $T: 16\text{–}25\text{ mm}$ | • Tek dokunuşla panoramik açılım, minimum iç derinlik kaybı. | `VERIFIED`<br>(`SRC_HETTICH_WINGLINE`) |
| **Hettich TopLine L** | `TopLine L` | Üstten taşımalı 2/3/4 kapaklı sürgü (`sliding_top_hung`) | **Maks. 50 kg** / kapak | • $H: \le 2600\text{ mm}$<br>• $W: 550\text{–}1500\text{ mm}$<br>• $T: 10\text{–}30\text{ mm}$ | • Çift ray bini boşluğu $\approx 80\text{ mm}$; kulp çakışmasını önlemek için $0\text{–}25\text{ mm}$ ayarlanabilir kapak kaçıklığı. | `VERIFIED`<br>(`SRC_HETTICH_TOPLINE`) |
| **Häfele Slido** | `Slido F-Line` / `Classic` | Üstten ve alttan taşımalı dolap sürgü sistemi | **16 / 40 / 50 / 80 kg** | • $T: 16\text{–}28\text{ mm}$ | • Gövde içi veya gövde önü (infront/vorfront) ray seçenekleri. | `VERIFIED`<br>(`SRC_HAFELE_SLIDO`) |
| **Sugatsune MonoFlat** | `LIN-X1000` | Yanal paralel açılır kapak (`lateral_swing`) | **Maks. 90 kg** | • $H: \le 2980\text{ mm}$<br>• $W: 750\text{–}1100\text{ mm}$<br>• $T: 24\text{–}40\text{ mm}$ | • Kapak öne doğru çok az çıkarak yana paralel kayar; dar koridorlar için ideal. | `VERIFIED`<br>(`SRC_SUGATSUNE_LINX`) |
