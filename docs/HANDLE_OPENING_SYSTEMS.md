# BİRİM CONFIGURATOR V4 — KULP VE AÇILMA TEKNOLOJİLERİ (`HANDLE_OPENING_SYSTEMS.md`)

**Tarih:** 4 Kasım 2026  
**Sürüm:** V4.0  
**Durum:** `IMPLEMENTED` / `TESTED` (Faz 05 Tamamlandı)

---

## 1. MİMARİ KURAL: KULP TİPİ VE HAREKET TEKNOLOJİSİ BAĞIMSIZLIĞI

Birim Configurator V4'te **Kulp Kategorisi (`HandleCategory`)** ve **Açılma Teknolojisi (`OpeningTechnology`)** birbirinden tamamen bağımsız iki veri alanıdır:
- Bir kullanıcı **Gola Profil (`gola_profile`)** ile **Yavaşlatıcılı (`soft_close`)** veya **Elektrikli (`servo_electric`)** açılma seçebilir.
- Ancak **Evrensel Uyumluluk Motoru (Faz 07)** geçersiz kombinasyonları (ör. **Kulpsuz Düz Cephe (`handleless`)** + **Standart Manuel / Soft-Close (`soft_close`)** — kapak tutulamayacağı için açılmaz!) otomatik olarak tespit eder ve `INCOMPATIBLE` hatası üretir.

---

## 2. KULP KATEGORİLERİ (`handle_profiles` — 10 Kategori)

| # | Kulp Kodu (`HandleCategory`) | Kulp Adı | Delik / Freze Şablonu | Çıkıntı Payı ($P_{\text{handle}}$) | Kesim Ölçüsü Etkisi | Doğrulama |
| :--- | :--- | :--- | :--- | :---: | :--- | :---: |
| **1** | `knob` | Düğme Kulp (Tek Vida) | $1 \times \varnothing 5\text{ mm}$ delik (Kenardan $50\text{ mm}$) | $25\text{–}32\text{ mm}$ | Yok | `VERIFIED` |
| **2** | `bar_handle` | Standart Çubuk / Köprü Kulp | $2 \times \varnothing 5\text{ mm}$ delik ($C\text{-}C: 128, 160, 192, 320\text{ mm}$) | $30\text{–}38\text{ mm}$ | Yok; köşe dönüşlerinde min. $45\text{ mm}$ kör parça gerektirir. | `VERIFIED` |
| **3** | `long_profile_handle` | Uzun Dikey Gardırop Profil Kulpu | $3\text{–}4 \times \varnothing 5\text{ mm}$ delik ($C\text{-}C: 960, 1184\text{ mm}$) | $22\text{–}35\text{ mm}$ | Yok | `VERIFIED` |
| **4** | `edge_profile` | Kenar Kulpu (Kapak Üst/Yan Kenarına Geçme) | Vida ile arka yüzeyden sabitleme | $18\text{–}22\text{ mm}$ | Kapak yüksekliğinden profil et kalınlığı ($2\text{ mm}$) düşülür. | `VERIFIED` |
| **5** | `recessed_grip` | Gömme Kulp (Sürgülü / Katlanır Kapak İçin) | CNC cep freze yuvası ($120 \times 40 \times 14\text{ mm}$) | **$0\text{ mm}$ (Hemzemin)** | Sürgülü kapakların üst üste geçişinde çakışmayı sıfırlar. | `VERIFIED` |
| **6** | `gola_profile` | Gola Profil (Yatay L/C ve Dikey Gövde Profili) | Gövde yan panellerinde L ($57 \times 26\text{ mm}$) veya C ($73 \times 26\text{ mm}$) CNC kademe kesimi | **$0\text{ mm}$** | Kapak/çekmece klapa yüksekliği parmak girintisi için $30\text{–}35\text{ mm}$ kısaltılır. | `VERIFIED` |
| **7** | `j_pull` | Kendinden Kulplu Kapak (J-Pull / 45° Pahlı) | Kapak üst/alt kenarında $45^\circ$ veya J-form CNC profil frezeleme | **$0\text{ mm}$** | Min. $19\text{–}22\text{ mm}$ MDF/Lake kapak kalınlığı zorunlu (`ERR_JPULL_MIN_THICKNESS`). | `VERIFIED` |
| **8** | `milled_wood_grip` | İşlenmiş Masif / Kaplama Ahşap Kulp | Kapak yüzeyine entegre ahşap kulp çıtası | $15\text{–}25\text{ mm}$ | Yok | `VERIFIED` |
| **9** | `decorative_bespoke` | Dekoratif Özel Tasarım Kulp (Pirinç / Deri / Doğaltaş) | Üretici/tasarım özel delik aksı ($64, 96, 160\text{ mm}$) | $25\text{–}40\text{ mm}$ | Yok | `VERIFIED` |
| **10** | `handleless_plain` | Kulpsuz Düz Cephe (Bas-Aç / Elektrikli İçin) | **0 delik, 0 freze** | **$0\text{ mm}$** | Yalnızca `push_to_open`, `push_to_open_soft_close` veya `servo_electric` ile uyumludur. | `VERIFIED` |

---

## 3. AÇILMA TEKNOLOJİLERİ (`opening_mechanisms` — 10 Teknoloji)

| # | Teknoloji Kodu (`OpeningTechnology`) | Açılma Teknolojisi Adı | Çalışma Prensibi & Gerekli Boşluk | Uyumlu Donanım Karşılığı |
| :--- | :--- | :--- | :--- | :--- |
| **1** | `manual_standard` | Standart Yaylı Manuel | Frenleme olmadan yaylı kapanış; kulp zorunlu. | Blum CLIP top yaylı (`71T3550`) / Standart ray |
| **2** | `soft_close` | Frenli Yavaş Kapanış (Soft-Close) | Entegre hidrolik/silikon damper ile sessiz kapanış; kulp veya Gola/J-Pull zorunlu. | Blum `BLUMOTION`, Hettich `Silent System`, Salice `Silentia+` |
| **3** | `push_to_open` | Mekanik Bas-Aç (Push-to-Open) | Kapağa basıldığında mekanik itici ile açılır; yaysız menteşe + manyetik itici. Min. $2.5\text{–}3.0\text{ mm}$ kapak arkası tetikleme boşluğu. | Blum `TIP-ON` (`956A1004` + yaysız menteşe `70T3550`), Hettich `Push to open` |
| **4** | `push_to_open_soft_close`| Bas-Aç + Frenli Kapanış (Mekanik Hibrit) | Basınca açılır, kapatılırken yavaşlatarak çeker ( %100 mekanik, elektrik gerektirmez). Çekmecelerde zorunlu tetikleme boşluğu $2.5\text{ mm}$. | Blum `TIP-ON BLUMOTION` (LEGRABOX / MOVENTO), Hettich `Push to open Silent` |
| **5** | `servo_electric` | Elektrikli Dokunmatik Açılma (Servo) | Hafif dokunuşla motorlu açılma ve kablosuz anahtarla otomatik kapanma. Arka kısımda priz ve adaptör boşluğu gerektirir. | Blum `SERVO-DRIVE` (AVENTOS / Çekmece / Buzdolabı `SERVO-DRIVE flex`) |
| **6** | `sliding_damped` | Yavaşlatıcılı Sürgülü Mekanizma | Ray içinde her iki yönde (açılış ve kapanış) yavaşlatıcı damper. | Hettich `TopLine L Silent System`, Häfele `Slido Smuso` |
| **7** | `folding_assisted` | Yay Destekli Panoramik Katlanır Hareket | Kapak dokunuşla kendiliğinden katlanarak tam açılır. | Hettich `WingLine L Push/Pull to move` |
| **8** | `lift_counterbalanced` | Ağırlık Dengeli Kalkar Hareket (Kademesiz Duruş) | Yay ünitesi kapak ağırlığına ($LF$) göre ayarlanır; bırakıldığı her açıda sabit durur. | Blum `AVENTOS top`, Häfele `Free`, Grass `Kinvaro` |
| **9** | `pocket_assisted` | Destekli Pocket (Gizlenen) Hareket | Bas-aç ile cepten çıkar, $90^\circ$ döner; itildiğinde yavaşlatıcılı mekanizmayla cebe girer. | Blum `REVEGO` (entegre TIP-ON), Hawa `Concepta III Push`, Salice `Exedra2` |
| **10** | `drop_down_damped` | Yavaşlatıcılı Düşer Kapak (Bar Kapağı) | Yukarıdan aşağıya $90^\circ$ kontrollü ve frenli açılış. | Salice `Pacta`, Häfele `Free Up/Down` |

---

## 4. MAĞAZA PERSONELİ KULLANICI DENEYİMİ (3 ADIMLI BASİT SEÇİM)

Mağaza personeline karmaşık menteşe kodları (`71B3550` vs `70T3550`) gösterilmez. Arayüz yalnızca **3 tasarım kararını** sorar:
1. **Kapak Hareketi:** *Menteşeli / Sürgülü / Yukarı Kalkar / Katlanır / Pocket Gizlenen / Açık*
2. **Kulp Görünüşü:** *Çubuk Kulp / Düğme / Gola Profil / J-Pull / Gömme / Kulpsuz Düz*
3. **Açılma Konforu:** *Frenli (Soft-Close) / Bas-Aç (Push-to-Open) / Bas-Aç + Frenli / Elektrikli (Servo)*

Arka plandaki **Uyumluluk ve BOM Motoru**, bu 3 karardan ve kapak ölçüsü/ağırlığından doğru menteşe tipini, adedini, tas/vida delik şablonunu ve itici/damper aksesuarlarını **%100 otomatik** belirler.
