# Üretim ve İmalat Kuralları (MANUFACTURING_RULES.md)

## 1. Malzeme ve Plaka Standartları

- **Standart Hammadde Plaka Ölçüsü**: $2800 \times 2070 \text{ mm}$ ($5.796 \text{ m}^2$).
- **Standart Gövde Kalınlığı**: $18\text{ mm}$ (MDF-Lam veya Yonga Levha).
- **Standart Arkalık Kalınlığı**: $8\text{ mm}$ (oluk içine geçme) veya $18\text{ mm}$ (ağır yük asma modülleri).
- **Standart Fire Oranı**: Parametrik hesaplarda otomatik olarak $\%12$ plaka fire payı eklenir.

---

## 2. Ebatlama Kuralları (Selco WNT 600 Uyumluluğu)

Birim üretim tesisinde kullanılan Selco WNT 600 panel ebatlama testeresi için aşağıdaki teknik sınırlar dikkate alınır:
1. **Asgari Kesim Boyutu**: $70\text{ mm}$. Testere kıskançlarının tutamayacağı $70\text{ mm}$ altındaki parçalar için sistem otomatik uyarı verir (`validationWarnings`).
2. **Testere Bıçak Kalınlığı (Kerf)**: Optimizasyon motoru için $4.4\text{ mm}$ hesaplanır.
3. **Temizleme Kesimi (Trim Cut)**: Plaka kenarlarından $15\text{ mm}$ gönye tıraşlama payı düşülür.
4. **Damar Yönü (Grain Direction)**: Ahşap kaplama ve desenli melaminlerde yan paneller, dikmeler ve kapaklar standart olarak **boyuna (lengthwise)** yönlendirilir.

---

## 3. Kenar Bantlama (Edge Banding) Standartları

- **Gövde Ön Kenarları**: $1.0\text{ mm}$ ABS bant.
- **Kapaklar ve Çekmece Önleri**: 4 kenar $1.0\text{ mm}$ veya $2.0\text{ mm}$ ABS bant.
- **Gövde Görünmeyen Arka ve Üst Kenarlar**: Ham bırakılır veya $0.4\text{ mm}$ astar bant.
- Kenar bandı toplam metre hesabı tüm parçaların aktif bantlanan kenar uzunluklarının toplamı üzerinden yapılır.

---

## 4. Donanım ve Hırdavat Standartları

1. **Bağlantı Elemanları**: Her gövde birleşiminde (alt, üst tabla ve ara dikmeler) minifix gövde + mil + 8x35mm ahşap kavela çifti kullanılır.
2. **Kapak Menteşeleri**: Blum Clip Top Blumotion 110° frenli menteşe:
   - $H \le 900\text{ mm}$: 2 adet
   - $900 < H \le 1600\text{ mm}$: 3 adet
   - $1600 < H \le 2000\text{ mm}$: 4 adet
   - $H > 2000\text{ mm}$: 5 adet
3. **Çekmece Rayları**: Blum Antaro / Tandembox frenli 500mm gizli ray takımı.
