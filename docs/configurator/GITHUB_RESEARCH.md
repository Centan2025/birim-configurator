# Birim V3.1 / V4 — Açık Kaynak GitHub Projeleri Derinlemesine Araştırma ve Lisans Raporu (`GITHUB_RESEARCH.md`)

Bu rapor, [Centan2025/birim-configurator](https://github.com/Centan2025/birim-configurator) projesinin hem **Mağazada Müşteri / Satış Danışmanı** (sıfır CAD bilgisiyle hızlı 2D/3D tasarım, akıllı duvar yapışması, görsel sunum) hem de **Fabrikada Üretim Planlamacısı** (bitmiş vs. testere net kesim ölçüsü, kenar bandı düşümü, Sistem 32 / Blum / Hettich CNC delik şemaları, giyotin plaka optimizasyonu, katmanlı DXF ve fail-closed ERP üretim kapısı) hedefleri doğrultusunda incelenen **25 açık kaynak projenin** gerçek kaynak kodu, lisans ve mimari analizini içerir.

## 1. Hedef Listedeki 9 Projenin Lisans ve Kod Kullanım Uygunluğu

| Proje | GitHub Erişimi | Doğrulanan Lisans | Birim'de Kod Kullanımı | Mağaza (Müşteri UX) Katkısı | Fabrika (Üretim Planlama) Katkısı |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **[Morti](https://github.com/torusservices/morti-app)** | Public | **MIT** | **Uygun** | Özyinelemeli hücre/bölme (`cell grid`), kapak/çekmece/malzeme atama, 3D sahne ızgarası | `assembly.ts` hücre sınırları, `cutlist.ts` rol kodlu (`S/H/B/O/D`) kesim listesi, `assembly-validation.ts` |
| **[CabKit3D](https://github.com/carinotj19/CabKit3D)** | Public | **MIT** | **Uygun** | 3D patlatılmış görünüm kaydırıcısı (*exploded view*), 360° döner tabla, tek tıkla kulp/malzeme | `cabinetMath.js`, `bom.js` (`BOM CSV`, `SKU JSON`), `validation.js` malzeme bazlı raf sehim ve kapak genişliği **inline auto-fix** |
| **[CabineTeer](https://github.com/chemrich/cabineteer)** | Public | **Apache-2.0** | **Uygun** | Parametrik JSON/CLI spec ve bağımsız Three.js 3D önizleme | Euro-style 32mm gövde/çekmece kuralları, Blum Tandem 550H min yükseklik doğrulaması, 2D Giyotin kesim şeması |
| **[OpenPlan3D](https://github.com/laanlabs/openPlan3D) & [OpenKitchen3D](https://openkitchen3d.com/open-source)** | Public | **MIT** | **Uygun** | 2D/3D kat planı, otomatik duvar/komşu mıknatıslanması (*snapping*), tüm mutfakta tek tıkla malzeme eşitleme, otomatik tezgâh/baza/kör parça | Katalog şeması (`openkitchen3d/catalog@0.1`), kapı açılım / pencere / koridor / ada çakışma denetleyicisi, katmanlı mimari DXF |
| **[Cabineato](https://github.com/gregheerkens/cabineato)** | Public | **Belirsiz** (`LICENSE` yok) | **İzin Gerekli (Yalnız Mimari Fikir)** | Gerçek zamanlı R3F 3D montaj önizleme, kulp aks seçimi | Maker.js tabanlı System 32 (`5mm`), lamba/kanal (*dado*) ve CNC köşe boşaltma (*dogbone*) katmanlı DXF fikri |
| **[VARYFORM](https://github.com/irina-grigoreva/varyform-3d-configurator)** | Public | **Proprietary** (`All rights reserved`) | **Uygun Değil (Kod Kopyalanmadı)** | 3D / 2D SVG cephe geçişi | İzomorfik tek kaynaklı `calculateParts()` ve sunucu doğrulamalı fiyatlandırma prensibi |
| **[Cabinet Studio](https://github.com/petervanderwalt/cabinet-studio)** | Public | **Belirsiz** (`LICENSE` yok) | **İzin Gerekli (Yalnız Matematiksel Referans)** | Animasyonlu kapak/çekmece, otomatik çekmece klapa paylaştırma | 8mm kanallı arkalık, 2mm raf / 20mm çekmece geri çekme, Blum 37/32 menteşe matematiği |
| **[ZimaP/cabinet](https://github.com/ZimaP/cabinet)** | Public | **Belirsiz** (`LICENSE` yok) | **İzin Gerekli (Kod Kopyalanmadı)** | Hazır dolap tipleri ve A/B/C malzeme sınıfları | Prosedürel 35mm menteşe tası ve 32mm delik ekseni modelleme yaklaşımı |
| **[ArcaneSK](https://github.com/ArcaneSK/cabinet-configurator-interface)** | Public | **Belirsiz** (`LICENSE` yok) | **İzin Gerekli (Kod Kopyalanmadı)** | 3D duvara sürükle-bırak, duvar/grid yapışma, çoklu seçim ve Undo/Redo | Sahne yerleşim JSON ve çarpışma algılama yaklaşımı |

## 2. Genişletilmiş GitHub Araştırması: Ek MIT / Apache-2.0 Açık Kaynak Projeler

Hedef listenin ötesinde yapılan araştırmada, **MIT** ve **Apache-2.0** lisanslı şu projeler tespit edilmiş ve mimari/algoritmik desenleri Birim V4'e kazandırılmıştır:

| Proje & GitHub Bağlantısı | Doğrulanan Lisans | Birim V4'e Aktarılan Somut Mühendislik ve UX Yeteneği |
| :--- | :--- | :--- |
| **[RajwanYair/WoodworkingShop](https://github.com/RajwanYair/WoodworkingShop)** | **MIT** | Bitmiş (nominal) ölçü ile kenar bandı kalınlığı düşülmüş testere net kesim ölçüsü ($L_{\text{net}} = L_{\text{nominal}} - \sum e$) ayrımı, Euler-Bernoulli + Creep raf sehim hesabı (`sag`), katmanlı CNC DXF |
| **[xiamingyang70/opencabinet](https://github.com/xiamingyang70/opencabinet)** | **MIT** | 6 aşamalı deterministik **Fail-Closed Üretim Kapısı** (`Dimension Chain Closure`, `Oversize Sheet Gate`, `Min Saw Gripper`, `Euler Deflection`, `System 32 Collision Avoidance`, `Physical Factory Sample Gate`) |
| **[doublesharp/bin-packing](https://github.com/doublesharp/bin-packing)** | **MIT** | 2D Giyotin plaka kesiminde tekrar kullanılabilir stok fire (`usableRemnants >= 300x300mm`) konsolidasyonu ve raporlaması |
| **[cvdlab/react-planner](https://github.com/cvdlab/react-planner)** | **MIT** | 2D kat planında nokta, duvar doğrusu, segment ve ızgara yakalama (`snap`) öncelik sırası |
| **[furnishup/blueprint3d](https://github.com/furnishup/blueprint3d)** | **MIT** | Oda köşe-duvar poligon topolojisi ve duvar/zemin modül mıknatıslanma (`WallItem` / `FloorItem`) mimarisi |
| **[qant-au/axonometra](https://github.com/qant-au/axonometra)** | **MIT & Apache-2.0** | 2D Plan / Kesit / Cephe ve 3D Perspektif / Ön / Yan / Üst görünümler arası kesintisiz geçiş |
| **[repalash/threepipe](https://github.com/repalash/threepipe)** | **Apache-2.0** | GPU belleğini şişirmeden tek tıkla PBR yüzey/renk ve kulp varyantı değiştirme |
| **[dxfjs/writer](https://github.com/dxfjs/writer)** | **MIT** | AutoCAD `$INSUNITS = 4` (mm) başlığı ve takım bazlı CNC katmanları (`PANEL_CONTOUR`, `NET_CUT_CONTOUR`, `BORE_35MM`, `CAM_15MM`, `DRILL_8MM`, `DRILL_5MM`, `BACK_GROOVE_8MM`) |

## 3. İki Kullanıcı Profili İçin Sentezlenen Birim V4 Yetenek Matrisi

1. **Mağazada Müşteri ve Satış Danışmanı Deneyimi (`Studio` + `Plan` + `Showroom`)**:
   * **Tek Tıkla Otomatik Düzeltme (`✨ Oto-Düzelt` / `autoFixModuleIssues`)**: `CabKit3D` referansıyla; müşterinin yaptığı ölçü veya donanım seçiminde raf sehimi ($>950\text{ mm}$), geniş tek kapak ($>600\text{ mm}$), Gola+İçerlek kapak çakışması, kulpsuz kapakta bas-aç eksikliği veya EN 1116 ankastre ölçü uyumsuzluğu oluştuğunda tek tıkla otomatik mühendislik düzeltmesi uygular.
   * **Tüm Modüllere Tek Tıkla Malzeme Eşitleme (`Tümüne Uygula`)**: `OpenKitchen3D` referansıyla; mağazada seçilen gövde ve kapak PBR malzemesini tek tıkla projedeki tüm mutfak veya gardırop modüllerine uygular.
   * **3D Patlatılmış Görünüm (`Exploded View %0–%100`) & Canlı Kapak/Çekmece Animasyonu**: `CabKit3D` referansıyla; Showroom modunda kapak açısı ($0^\circ\text{–}90^\circ$), çekmece açılımı ($0\text{–}350\text{ mm}$) ve patlatılmış karkas görünümü (`%0–%100`) kaydırıcılarıyla müşteriye iç yapıyı canlı gösterir.
2. **Fabrikada Üretim Planlamacısı Deneyimi (`BomModal` & `@birim/manufacturing`)**:
   * **Bitmiş (Nominal) Ölçü ve Testere Net Kesim Ölçüsü Ayrımı**: `WoodworkingShop` referansıyla; her parçanın hem bitmiş montaj ölçüsünü (`lengthMm × widthMm`) hem de 4 kenar bant kalınlığı düşülmüş gerçek ebatlama testeresi kesim ölçüsünü (`netCutLengthMm × netCutWidthMm`) ve bant kodunu (`4K (2B+2E) 1mm`, `1B 1mm` vb.) yan yana üretir.
   * **Çakışmasız System 32 & 35mm Menteşe CNC Delik Motoru**: Yan dikmelerde $x = 37\text{ mm}$ hattındaki System 32 raf pimi delikleri ile menteşe taban plakası deliklerinin ($h_y \pm 16\text{ mm}$) üst üste binmesini otomatik engeller.
   * **Katmanlı AutoCAD DXF (`$INSUNITS = 4`) & Tekil/Toplu DXF İhracı**: Hem her parçanın yanındaki `DXF` butonuyla tekil parça DXF'i hem de üst bardaki `Tüm Paneller DXF` butonuyla tüm projenin CNC DXF paketini indirir.
   * **6 Aşamalı Fail-Closed Üretim Kapısı ve ISO 7170 Sehim Tablosu**: BOM portalındaki yeni **"Fabrika Doğrulama & Sehim"** sekmesinde kapalı ölçü zinciri, plaka sınırı, Selco $70\text{ mm}$ kıskaç sınırı, Euler-Bernoulli raf sehim tablosu (`mm` ve `L/300` durumu) ve fabrika fiziksel numune onay kapısını canlı raporlar.
