# Fiyatlandırma ve Alternatif Malzeme Motoru (PRICING_ENGINE.md)

## 1. Maliyet ve Satış Fiyatı Formülü

Birim Configurator V2 fiyatlandırma motoru tüm maliyet bileşenlerini sunucu doğrulanabilir deterministik bir formülle hesaplar:

$$\text{Hammadde Toplamı} = \text{Plaka Maliyeti} + \text{Kenar Bandı Maliyeti} + \text{Hırdavat Maliyeti} + \text{CNC Delik Maliyeti}$$
$$\text{İşçilik Maliyeti} = \text{Toplam Panel Alanı } (m^2) \times 0.65\text{ saat/m}^2 \times 28\text{ \euro/saat}$$
$$\text{Genel Gider} = (\text{Hammadde} + \text{İşçilik}) \times \%10$$
$$\text{Net Üretim Maliyeti} = \text{Hammadde} + \text{İşçilik} + \text{Genel Gider}$$
$$\text{Net Satış Tutarı (KDV Hariç)} = (\text{Net Üretim Maliyeti} + \text{Montaj} + \text{Paketleme}) \times (1 + \text{Kâr Marjı } [\%35])$$
$$\text{KDV Dahil Satış Tutarı} = \text{Net Satış Tutarı} \times 1.20$$

---

## 2. Alternatif Malzeme Fiyat Kıyaslaması

Satış personeli müşteriye anında alternatif sunabilmesi için sistem aynı tasarım karkası üzerinden 7 farklı hammadde seçeneğinin satış fiyatını anında hesaplar:
- Melamin Mat Beyaz (Temel)
- Melamin Antrasit Gri
- Doğal Meşe Kaplama
- Amerikan Ceviz Kaplama
- İpek Mat Lake Krem
- İpek Mat Lake Adaçayı Yeşili
- Füme Cam Alüminyum Çerçeve
Fark tutarı (\euro) ve yüzde değişim (%) anlık olarak panelde listelenir.
