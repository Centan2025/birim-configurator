# BİRİM CONFIGURATOR V4 — KAPAK VE CEPHE SİSTEMLERİ (`DOOR_SYSTEMS.md`)

**Tarih:** 4 Kasım 2026  
**Sürüm:** V4.0  
**Durum:** `IMPLEMENTED` / `TESTED` (Faz 04 Tamamlandı)

---

## 1. VERİ MODELİ PRENSİBİ: HAREKET MEKANİZMASI VE BİNİ AYRIMI

Faz 04 gereksinimlerinde listelenen 12 ürün kategorisi veri modelinde tekrar (duplication) yaratmamak için **Ana Hareket Ailesi (`DoorMotionCategory`)** ve **Gövde Bini Varyantı (`DoorOverlayType`)** olarak ortogonal biçimde modellenmiştir:
- **`DoorOverlayType`**: `"full_overlay"` (Tam bini), `"half_overlay"` (Yarım bini), `"inset"` (İçten / gömme kapak).
- **`DoorSystemId`**: 12 ürün kategorisinin tamamını kapsayan kanonik kapak sistemi tanımlayıcısı.

---

## 2. DESTEKLENEN 12 KAPAK VE HAREKET KATEGORİSİ

| # | Kategori Kodu (`DoorSystemId`) | Ürün Kategorisi Adı | Kanat Sayısı | Bini Varyantı (`overlayType`) | 3D Kinematik Hareket Rotası | Gerekli Montaj Boşluğu & Özel Kural | Uyumlu Donanım Aileleri | Doğrulama |
| :--- | :--- | :--- | :---: | :---: | :--- | :--- | :--- | :---: |
| **1** | `hinged_single` | Tek Menteşeli Kapak (Sol/Sağ) | 1 | `full_overlay` / `half_overlay` | Dikey eksende $0^\circ \to 110^\circ / 155^\circ$ dönüş (`rotY`) | Çevre boşluğu $2\text{ mm}$; iç çekmece varsa $155^\circ$ sıfır çıkıntılı menteşe zorunlu. | Blum CLIP top BLUMOTION (`71B3550`, `71B7550`), Hettich Sensys (`8645i`, `8657i`), Grass Tiomos, Salice Silentia+ | `VERIFIED` |
| **2** | `hinged_double` | Çift Menteşeli Kapak | 2 | `full_overlay` / `half_overlay` | Sol kanat $-\theta$, sağ kanat $+\theta$ simetrik dönüş | Orta birleşim fugası $3\text{ mm}$. | Blum CLIP top, Hettich Sensys, Grass Tiomos, Salice Silentia+ | `VERIFIED` |
| **3** | `hinged_inset` | İçten Menteşeli Kapak (Gömme) | 1 veya 2 | `inset` | Gövde yan/üst/alt panelleriyle hemzemin (flush) dönüş | Menteşe tabanı ve raf pimi ön sırası $37 + T_{\text{door}} + 2\text{ mm}$ ($57\text{ mm}$) geride; $18\text{ mm}$ deveboynu krank menteşe (`71B3750` / `8645i B16`). | Blum `71B3750`, Hettich `9071207`, Sugatsune `HES3D` | `VERIFIED` |
| **4** | `hinged_overlay_variant` | Tam / Yarım Bini Menteşeli Varyant | 1 veya 2 | `half_overlay` | Ortak ara dikmeyi paylaşan iki yan kapak dönüşü | $18\text{ mm}$ ara dikmede her kapak $7.5\text{ mm}$ basar ($3\text{ mm}$ orta boşluk); $9.5\text{ mm}$ yarım bini menteşe (`71B3650`). | Blum `71B3650`, Hettich `9071206` | `VERIFIED` |
| **5** | `sliding_top_hung` | Üstten Taşımalı Sürgülü Kapak | 2, 3, 4 | `full_overlay` (Infront / Vorfront) | Yatay X ekseninde çift/üçlü ray üzerinde doğrusal kayma | Gövde üst tablasında taşıyıcı ray; min. $80\text{ mm}$ derinlik payı; maks. $50\text{–}80\text{ kg}$/kapak. | Hettich `TopLine L`, Häfele `Slido F-Line`, Hawa `Clipo / Junior` | `VERIFIED` |
| **6** | `sliding_bottom_rolling` | Alttan Taşımalı Sürgülü Kapak | 2, 3, 4 | `inset` / `full_overlay` | Alt kılavuz ray üzerinde tekerlekli yatay kayma | Gövde alt tablası yükü taşır; üst tabla sehiminden etkilenmez. | Häfele `Slido Classic`, Hettich `SlideLine M` | `VERIFIED` |
| **7** | `lift_parallel` | Paralel Yukarı Kalkar Kapak | 1 | `full_overlay` | Kapak cephesi düşey düzlemini koruyarak $+Y$ ve $+Z$ yönünde paralel yükselir | $H: 300\text{–}580\text{ mm}$, $m \le 20\text{ kg}$; üstte minimum $200\text{–}350\text{ mm}$ dikey açılma hacmi. | Blum `AVENTOS HL top`, Häfele `Free Up`, Grass `Kinvaro L-80` | `VERIFIED` |
| **8** | `lift_bi_fold` | Katlanarak Yukarı Kalkar Kapak | 2 (Yatay bölünmüş) | `full_overlay` | Üst kanat yukarı dönerken alt kanat orta menteşeyle katlanarak yükselir | $H: 480\text{–}1200\text{ mm}$; güç faktörü $LF \in [2700, 19300]$; parmak koruma orta menteşesi (`78Z5500T`). | Blum `AVENTOS HF top`, Häfele `Free Fold`, Grass `Kinvaro F-20` | `VERIFIED` |
| **9** | `lift_up_stay` | Döner Yukarı Kalkar / Aşan Kapak | 1 | `full_overlay` | Üst kenardan ($75^\circ\text{–}107^\circ$) yukarı döner (`HK top`) veya kabin üstünden aşar (`HS top`) | `HK top`: $H: 205\text{–}600\text{ mm}$, $LF \in [420, 9000]$, $m \le 18\text{ kg}$. | Blum `AVENTOS HK top` / `HS top`, Häfele `Free Flap`, Grass `Kinvaro T-Slim`, Salice `Wind` | `VERIFIED` |
| **10** | `folding_side` | Katlanır Yan Kapak (Bi-Fold / Akordeon) | 2 veya 4 | `full_overlay` | Dikey menteşeyle birbirine bağlı 2 kanat yana doğru katlanarak açılır | Kanat genişliği $250\text{–}600\text{ mm}$, kanat ağırlığı $\le 25\text{ kg}$ ($50\text{ kg}$ çift). | Hettich `WingLine L`, Blum Köşe Bi-Fold (`79T8500` + `71T6550`) | `VERIFIED` |
| **11** | `pocket_retractable` | Pocket / Yan Cebe Gizlenen Kapak | 1 (*uno*) veya 2 (*duo*) | `full_overlay` / `inset` | Kapak $90^\circ$ açılır, ardından gövde yanındaki gizli cebe (`Z` ekseninde geriye) sürülür | Blum REVEGO: $100\text{ mm}$ (*uno*) / $150\text{ mm}$ (*duo*) yan cep genişliği, $D \ge 573\text{ mm}$, $H: 1800\text{–}2980\text{ mm}$, $m \le 35\text{ kg}$. | Blum `REVEGO uno/duo`, Hawa `Concepta III` / `Folding Concepta III`, Salice `Exedra2` | `VERIFIED` |
| **12** | `tambour_roller` | Tambur / Panjur Kapak | 1 (Esnek şerit) | `inset` | Dikey veya yatay kılavuz kanal içinde üst/arka salyangoz makaraya sarılır | Üstte/arkada $140\text{–}180\text{ mm}$ sarım kutusu boşluğu; üretici özel kanal profili. | Rehau `RAUVOLET` / Häfele Tambur (`UNVERIFIED` — Yalnızca 3D önizleme düzeyinde; CNC üretim onayı kapalıdır) | `UNVERIFIED` (Önizleme) |

---

## 3. KAPAK AĞIRLIĞI, YOĞUNLUK VE ÇARPIŞMA HACMİ HESABI

### 3.1 Malzeme Yoğunlukları ($\rho$) ve Kapak Ağırlığı ($m_{\text{door}}$)
Kapak sistemi yalnızca görsel animasyon değildir. Hesaplama motoru her kanadın gerçek fiziksel kütlesini hesaplar:
$$m_{\text{door}}\text{ [kg]} = \frac{W_{\text{leaf}}\text{ [mm]} \times H_{\text{leaf}}\text{ [mm]} \times T_{\text{door}}\text{ [mm]}}{10^9} \times \rho\text{ [kg/m}^3\text{]} + m_{\text{handle}}\text{ [kg]}$$

| Malzeme Kategorisi | Yoğunluk ($\rho$) | $600 \times 720 \times 18\text{ mm}$ Kapak Ağırlığı | $600 \times 2200 \times 18\text{ mm}$ Gardırop Kapağı Ağırlığı |
| :--- | :---: | :---: | :---: |
| **Yonga Levha / Melamin (`laminate`)** | $650\text{ kg/m}^3$ | $5.05\text{ kg}$ | $15.44\text{ kg}$ |
| **MDF / İpek Mat Lake (`lacquer`)** | $750\text{ kg/m}^3$ | $5.83\text{ kg}$ | $17.82\text{ kg}$ |
| **Doğal Ahşap Kaplama MDF (`wood`)** | $760\text{ kg/m}^3$ | $5.91\text{ kg}$ | $18.06\text{ kg}$ |
| **Alüminyum Çerçeve Temperli Cam (`glass`)** | $920\text{ kg/m}^3$ (Eşdeğer) | $7.15\text{ kg}$ | $21.86\text{ kg}$ |
| **Kompakt Laminat (`stone`/`compact`)** | $1350\text{ kg/m}^3$ | $10.50\text{ kg}$ ($12\text{ mm}$'de $7.0\text{ kg}$) | $32.08\text{ kg}$ |

### 3.2 Dinamik Menteşe Adedi ve Kalkar Kapak Güç Faktörü ($LF$) Seçimi
1. **Dikey Menteşeli Kapaklar (Blum / Hettich Katalog Diyagramı):**
   - $H \le 900\text{ mm}$ ve $m \le 9\text{ kg} \implies \mathbf{2\text{ adet}}$ menteşe
   - $900 < H \le 1600\text{ mm}$ veya $9 < m \le 15\text{ kg} \implies \mathbf{3\text{ adet}}$ menteşe
   - $1600 < H \le 2000\text{ mm}$ veya $15 < m \le 20\text{ kg} \implies \mathbf{4\text{ adet}}$ menteşe
   - $2000 < H \le 2600\text{ mm}$ veya $20 < m \le 24\text{ kg} \implies \mathbf{5\text{ adet}}$ menteşe
   - $m > 24\text{ kg}$ veya $W_{\text{leaf}} > 650\text{ mm} \implies$ `INCOMPATIBLE` (`ERR_DOOR_TOO_HEAVY_FOR_HINGES`)
2. **Kalkar Kapaklar (AVENTOS HK top Güç Faktörü Çözümlemesi):**
   - $\text{LF} = H_{\text{carcass}} \times (m_{\text{door}} + 2 \cdot m_{\text{handle}})$
   - $420 \le \text{LF} \le 1610 \implies$ `22K2300`
   - $930 \le \text{LF} \le 2800 \implies$ `22K2500`
   - $1730 \le \text{LF} \le 5200 \implies$ `22K2700`
   - $3200 \le \text{LF} \le 9000 \implies$ `22K2900`
   - $\text{LF} > 9000$ veya $m_{\text{door}} > 18\text{ kg} \implies$ `INCOMPATIBLE` (`ERR_LIFT_MECHANISM_OVERLOAD`)
