# Parametrik Mobilya ve Mutfak Motoru (PARAMETRIC_ENGINE.md)

## 1. Parametrik Çekirdek Mantığı

Birim Configurator, dolap ve mutfak için iki ayrı motor yerine **tek bir birleşik parametrik çekirdek** kullanır.

### Temel Varlıklar:
- **`Project`**: Versiyonlanmış proje üst başlığı, şube ve mekân bilgisi.
- **`Space`**: Duvarlar, tavan yüksekliği ve mekân tipi (oda, giyinme alanı, doğrusal mutfak, L-mutfak vb.).
- **`ModuleInstance`**: Bağımsız kabin/modül. Pozisyon ($X,Y,Z$), Dış Ölçüler ($W,H,D$), Gövde Konfigürasyonu (`CarcassConfig`) ve Bölmeler (`bays`).
- **`BayConfig`**: İç düşey bölmeler. Her bölme bağımsız raf listesi, askı boruları, çekmeceler ve kapak konfigürasyonuna sahiptir.

---

## 2. Milimetrik Deterministik Hesap Formülleri

Tüm hesaplamalar tam sayı veya deterministik ondalık milimetre cinsindendir:

### 2.1 Bölme Genişlikleri (Bay Widths)
Toplam genişlik $W$, gövde panel kalınlığı $T$ (standart 18mm), bölme sayısı $N$:
$$\text{Toplam Panel Kalınlığı} = 2T + (N - 1)T$$
$$\text{Kullanılabilir İç Genişlik} = W - (N + 1)T$$
$$\text{Eşit Bölme Genişliği} = \lfloor \frac{\text{Kullanılabilir İç Genişlik}}{N} \rfloor$$
Kalan milimetreler ilk bölmeye dağıtılarak yuvarlama hatası önlenir ve $\sum \text{bays} + \text{paneller} = W$ eşitliği korunur.

### 2.2 Net İç Yükseklik ve Derinlik
$$\text{Net İç Yükseklik} = H - H_{baza} - 2T$$
$$\text{Net İç Derinlik} = D - 20\text{mm (Arkalık kanalı ve montaj boşluğu)}$$

### 2.3 Raf Sehim (Deflection) Kuralları
Masif veya 18mm melamin/mdf raflarda destek dikmesi olmaksızın 950mm'yi aşan açıklıklarda sistem otomatik olarak:
`WARN_SHELF_SPAN_DEFLECTION`
uyarısı üretir ve mağaza personeline orta dikme paneli ekleme tavsiyesinde bulunur.

---

## 3. Versiyonlama ve Geri Al (Undo / Redo)

- Her parametrik değişiklik Zustand store üzerinde immutable bir `DesignProject` kopyası oluşturur.
- Son 15 durum `history` yığınında tutulur.
- $Ctrl+Z$ ve $Ctrl+Y$ kısayolları veya arayüz butonları ile geri/ileri alınabilir.
