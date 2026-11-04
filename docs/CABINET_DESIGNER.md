# Profesyonel Dolap Tasarımcısı (CABINET_DESIGNER.md)

## 1. Dolap ve Kapak Tipleri

Birim Configurator V2 aşağıdaki dolap ve kapak tiplerini destekler:
1. **Standart Menteşeli Gardırop**: Tek sol, tek sağ veya çift menteşeli kapaklar.
2. **Sürgülü Kapaklı Gardırop**: Çift raylı, ray kayma mesafeli kinematik simülasyon.
3. **Açık Giyinme Odası (Walk-in)**: Kapaksız, modern antrasit veya ceviz gövde, çift askılık ve kaskat çekmeceli.
4. **Köşe Dolap (L-Wardrobe)**: $950 \times 950\text{mm}$ 90° köşe dönüşü sağlayan entegre karkas.
5. **Çok Gövdeli Gardırop Duvarı**: Yan yana dizilmiş 2, 3 veya 4 bağımsız kule kabin.

---

## 2. İç Donanım Kütüphanesi

- **Sabit ve Hareketli Raflar**: System 32 deliklerine oturan kilitli 5mm pimlidir.
- **Tandembox Çekmeceler**: Blum frenli raylar, klapa ve iç kasa yükseklikleri parametrik hesaplanır.
- **Teleskopik Pantolonluk**: Frenli ray üzerinde çalışan özel pantolon askı modülü.
- **Ayarlanabilir Ayakkabılık**: Eğimli tel/metal ayakkabı rafları.
- **Tel Çamaşır Sepeti**: Derin raylı sepet donanımı.
- **Gömme LED Profili**: Yan panel veya raf altına frezelenen alüminyum kanal profili.

---

## 3. Akıllı Açıklık Danışmanı (Smart Span Advisor)

Kullanıcı duvardan duvara genişlik girdiğinde sistem otomatik hesaplar:
- Örn. **3600mm açıklık**: 3 eşit 1200mm kabin önerisi (avantajlar, dezavantajlar ve plaka firesi analiziyle birlikte).
- **Menteşe Sayısı Hesabı**: Kapak boyu $\le 900\text{mm} \to 2$ menteşe, $900-1600\text{mm} \to 3$ menteşe, $1600-2000\text{mm} \to 4$ menteşe, $> 2000\text{mm} \to 5$ menteşe.
