# Parametrik Mobilya Motoru V2 (PARAMETRIC_ENGINE_V2.md)

## 1. Modüler Tasarım ve Çoklu Kabin Desteği

V2 ile birlikte sistem tek bir dolap gövdesine bağımlı olmaktan çıkarılmış; çoklu kabin mimarisine geçirilmiştir:
- **Yan Yana Modüller**: Sınırsız sayıda bağımsız kabin gövdesi yan yana dizilebilir, otomatik $X$ ekseni kenetlenmesi (snapping) sağlanır.
- **Köşe Modülleri**: 90° L-Köşe gardırop ve kör köşe mutfak alt dolapları.
- **Özel Donanımlar**: Pantolonluk, ayakkabılık, tel sepet, gömme LED aydınlatma profili.

---

## 2. Kısıt Çözücü ve Çarpışma Tespiti (Constraint Solver)

`validateProject` fonksiyonu tasarım aşamasında anlık fiziksel kontrolleri yürütür:
1. **Negatif/Sıfır Ölçü Reddi**: Zod çalışma zamanı şemaları ile doğrulanır.
2. **Asgari ve Azami Boyutlar**:
   - Genişlik: $200\text{mm} - 3600\text{mm}$ (Tek modülde 3600mm üzerine çıkıldığında otomatik bölme uyarısı verilir).
   - Yükseklik: $300\text{mm} - 2800\text{mm}$ (Standart plaka boyu üzeri için tepe modülü önerilir).
   - Derinlik: $200\text{mm} - 950\text{mm}$.
3. **Raf Sehim Eşiği (Deflection Threshold)**: Desteksiz $950\text{mm}$ üzerindeki raflarda otomatik `WARN_SHELF_SPAN_DEFLECTION` uyarısı.
4. **İç Çekmece & Menteşe Çakışması**: İç çekmecelerin yükseklik kotu standart menteşe bölgelerine ($100\text{mm}, 850\text{mm}, 1500\text{mm}, 2050\text{mm}$) denk geldiğinde distans payı uyarısı verilir.
5. **3D Hacimsel Çakışma (AABB)**: İki bağımsız modülün $X, Y, Z$ eksenlerinde birbiri içerisine geçmesi engellenir.
6. **Tavan Çarpışması**: Modül toplam montaj yüksekliğinin mekân tavan yüksekliğini aşması engellenir.
