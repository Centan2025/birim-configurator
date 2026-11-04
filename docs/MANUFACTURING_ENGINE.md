# İmalat ve Üretim Mühendisliği V2 (MANUFACTURING_ENGINE.md)

## 1. Kararlı Parça Kimlikleri (Stable Part IDs)

Her parça deterministik ve tekil bir kimliğe sahiptir:
`P_{moduleId}_{componentId}` (Örn: `P_mod1_side_left`, `P_mod1_shelf_0_1`)

Her parça kaydı şu üretim parametrelerini içerir:
- Net kesim boyu, eni ve kalınlığı ($L \times W \times T\text{ mm}$)
- Damar yönü (`lengthwise`, `crosswise`, `none`)
- 4 kenar bağımsız ABS kenar bandı ($1\text{mm} / 2\text{mm}$)
- Birleşim tipi (`minifix_dowel`)
- Delik operasyonları dizisi (`DrillingHole[]`)

---

## 2. System 32 CNC Delik Motoru

Her panel için standart 32mm grid sistemine uygun delikler matematiksel olarak hesaplanır:
1. **Minifix Kam Yuvası**: $\varnothing 15\text{mm}$, derinlik $13.5\text{mm}$, kenardan $34\text{mm}$ eksen mesafesi.
2. **Minifix Saplama & Kavela**: $\varnothing 8\text{mm}$, derinlik $12\text{mm}$ (yüzey) veya $30\text{mm}$ (kenar).
3. **Menteşe Tası**: $\varnothing 35\text{mm}$, derinlik $12.5\text{mm}$, kenardan $21.5\text{mm}$ merkez mesafesi.
4. **Menteşe Tabanı & Ray Montaj Delikleri**: $\varnothing 5\text{mm}$, $32\text{mm}$ hatve aralığı, $37\text{mm}$ ön kenar girintisi.
5. **Raf Pimi Delikleri**: $\varnothing 5\text{mm}$, derinlik $12\text{mm}$, $32\text{mm}$ veya $64\text{mm}$ dikey hatve.

---

## 3. Üretim Onay ve Kilitleme İş Akışı

```text
Tasarım (Draft)
     │
     ▼
Teknik Doğrulama (Kısıt Çözücü Hata Kontrolü)
     │
     ▼
Üretim Snapshot Oluşturma (Kesim, Delik ve Nesting Kilitlenir)
     │
     ▼
Yetkili Onayı (production_approved)
     │
     ▼
ERP / CNC İş Emri Aktarımı (Idempotent API)
```
Onaylanmış bir tasarım versiyonu değiştirilemez; değişiklik gerekiyorsa yeni bir revizyon versiyonu ($v2, v3$) açılır.
