# BİRİM CONFIGURATOR V4 — ULUSLARARASI STANDARTLAR VE SYSTEM 32 ARAŞTIRMASI (`RESEARCH_STANDARDS.md`)

**Tarih:** 4 Kasım 2026  
**Sürüm:** V4.0  
**Durum:** `IMPLEMENTED` / `TESTED` (Faz 01 Tamamlandı)

---

## 1. METODOLOJİ VE DOĞRULAMA PRENSİBİ

Bu doküman, Birim Configurator V4 parametrik ölçü ve uyumluluk motorunun dayandığı uluslararası mobilya ve donanım standartlarını kayıt altına alır.  
**Katı Kural:** Kamuya açık resmî standart özetlerinden ve üretici teknik kılavuzlarından doğrulanmış kurallar `VERIFIED` olarak işaretlenmiş; tam CEN/ISO telifli tabloları veya fabrika fiziksel testini gerektiren alt parametreler `UNVERIFIED` olarak ayrılmıştır. Kaynağı doğrulanmamış hiçbir sayısal eşik doğrudan CNC üretim onayı kuralı olarak kullanılmaz.

---

## 2. AVRUPA (EN) VE ULUSLARARASI (ISO) STANDARTLAR

| Standart Kodu | Başlık & Kapsam | Doğrulanmış Teknik Gereksinimler (`VERIFIED`) | Doğrulanmamış / Tam Metin Gerektiren Alanlar (`UNVERIFIED`) | Kaynak Kayıt Kodu |
| :--- | :--- | :--- | :--- | :--- |
| **EN 1116:2018** | *Kitchen furniture — Co-ordinating sizes for kitchen furniture and kitchen appliances* | • **Tezgâh Üst Kotu:** Nominal koordinasyon yükseklikleri **850 mm, 900 mm ve 950 mm**.<br>• **Tezgâh Derinliği:** Standart başlangıç koordinasyon derinliği **600 mm** (Alt dolap gövde derinliği $\le 560\text{–}580\text{ mm}$).<br>• **Üst Dolap Derinliği:** Nominal **310 mm – 400 mm** aralığı.<br>• **Ankastre Cihaz Modül Genişliği:** Standart **600 mm** dış modül genişliği ($16\text{–}19\text{ mm}$ yan panel kalınlığına göre **562–568 mm** net iç açıklık) ve min. **550–560 mm** net iç derinlik. | • Cihaz sınıflarına göre (buharlı fırın, sıcak tutma çekmecesi vb.) alt-milimetre dikey montaj tolerans tabloları (`UNVERIFIED` — Cihaz üreticisi teknik çizimi gerektirir). | `SRC_STD_EN1116_2018` |
| **EN 14749:2016 + A1:2022** | *Domestic and kitchen storage units and kitchen-worktops — Safety requirements and test methods* | • **Devrilme & Stabilite:** Açık kapak ve tam açık çekmece yükü altında devrilme güvenliği.<br>• **A1:2022 Güncellemesi:** TV taşıyan depolama üniteleri için **40 kg**'a kadar devrilme ve yük şablonu.<br>• **Parmak Sıkışma / Kesme Boşluğu:** Hareketli parçalar arasında güvenli çalışma boşlukları ($<8\text{ mm}$ veya $>25\text{ mm}$ erişilebilir güvenlik eşiği).<br>• **Duvar Askı Elemanları:** Üst dolap askı elemanları ve gövde birleşimlerinin statik aşırı yük testi zorunluluğu. | • Eklerdeki (Annex) malzeme bazlı N/m² raf yük çarpan tablolarının tam metin katsayıları (`UNVERIFIED`). | `SRC_STD_EN14749_2022` |
| **ISO 7170:2021** | *Furniture — Storage units — Test methods for the determination of strength, durability and stability* | • **Kapsam:** Küresel mekanik test yöntemlerini tanımlar (geçti/kaldı eşikleri EN 14749 / EN 16121'de belirlenir).<br>• **Test Kategorileri:** Uzun süreli düzgün yayılı yük altında raf sehimi (deflection), raf pimi taşıma testi, menteşe ve çekmece raylarının yatay/dikey çarpma (slam) ve yorulma testleri. | • Birim fabrikasında kullanılan 18 mm MDF-Lam / Yonga Levha tedarikçilerinin parti bazlı elastisite modülü ($E$) ve gerçek sehim eğrileri (`UNVERIFIED` — Fabrika numune testi gerektirir). | `SRC_STD_ISO7170_2021` |
| **EN 15570:2008** | *Hardware for furniture — Strength and durability of hinges and their components (Vertical axis)* | • **Dayanıklılık Sınıfları:**<br>  - **Level 1:** Hafif kullanım (~20.000 çevrim).<br>  - **Level 2:** Konut genel kullanım (**40.000 çevrim**).<br>  - **Level 3:** Yoğun/ticari kullanım (**80.000 – 100.000 çevrim** + dikey statik aşırı yük ve yatay aşırı açılma testi). | — (`VERIFIED` — Blum CLIP top BLUMOTION ve Hettich Sensys kataloglarında Level 3 / 200.000 çevrim olarak belgelenmiştir). | `SRC_STD_EN15570` |
| **EN 15338:2007 + A1:2010** | *Hardware for furniture — Strength and durability of extension elements and their components* | • **Dayanıklılık Sınıfları:**<br>  - **Level 3 (Ağır Hizmet):** Beyan edilen yük sınıflarında (**25 kg, 40 kg, 70 kg, 80 kg**) **80.000–100.000 açma/kapama çevrimi**, dikey statik aşırı yük, yanal kuvvet ve sert çarpma testleri. | — (`VERIFIED` — Blum LEGRABOX/MOVENTO ve Hettich AvanTech YOU/Actro 5D için doğrulanmıştır). | `SRC_STD_EN15338` |

---

## 3. SYSTEM 32 (32 MM MOBİLYA MÜHENDİSLİĞİ STANDARDI) KURALLARI

Tüm değerler Avrupa çerçevesiz (frameless) modüler mobilya üretim standardı ve üretici (Blum/Hettich/Häfele) kataloglarıyla **tam doğrulanmıştır (`VERIFIED`)**:

1. **Dikey Delik Adımı (Grid Pitch):** Delik merkezleri arası dikey mesafe tam **$32.0\text{ mm}$**'dir.
2. **Ön Sıra Kenar Gerilemesi (Front Setback):** Yan panelin (dikmenin) ön kenarından (bant dahil bitmiş kenar) ilk dikey delik sırasının merkezine olan mesafe **$37.0\text{ mm}$**'dir.
   - *İçten Kapak (`inset`) İstisnası:* Kapak gövde içine girdiğinde menteşe tabanı ve ray ön bağlantı deliği $37.0 + T_{\text{door}} + G_{\text{inset}}$ (ör. $18\text{ mm}$ kapak için $37 + 18 + 2 = 57.0\text{ mm}$) geriye kayar.
3. **Arka Sıra Kenar Gerilemesi (Rear Setback):**
   - Simetrik CNC delik düzeninde arka kenardan **$37.0\text{ mm}$** VEYA ön sıradan $32\text{ mm}$'nin tam katı ($37.0 + n \times 32.0\text{ mm}$, ör. çekmece rayı arka bağlantı delikleri için $n \in \{4, 6, 7, 8, 9, 10\}$).
4. **Standart Matkap Çapları ve Derinlikleri:**
   - **$\varnothing 5.0\text{ mm} \times 12.0\text{–}13.0\text{ mm}$:** Euro vida ($\varnothing 6.3\text{ mm}$ diş), raf pimi ve menteşe taban dübeli için standart sistem deliği.
   - **$\varnothing 8.0\text{ mm} \times 11.0\text{–}15.0\text{ mm}$:** Ahşap kavela ($8 \times 35\text{ mm}$) ve menteşe tası çakma/INSERTA yan dübelleri.
   - **$\varnothing 15.0\text{ mm} \times 13.5\text{ mm}$:** Minifix / eksantrik bağlantı gövdesi yuvası ($18\text{ mm}$ panel için merkez ofseti $34.0\text{ mm}$).
   - **$\varnothing 35.0\text{ mm} \times 11.5\text{–}13.5\text{ mm}$:** Standart tas menteşe yuvası (Cup hole).
5. **Menteşe Tas Kenar Mesafesi ($\text{TAB} / C / K$) ve Merkez Ofseti:**
   - Kapak kenarından $\varnothing 35\text{ mm}$ tas deliğinin dış çeperine olan mesafe $\text{TAB} \in [3.0, 6.0]\text{ mm}$'dir.
   - Tas merkezinin kapak kenarına olan mesafesi:
     $$X_{\text{cup}} = \frac{35.0}{2} + \text{TAB} = 17.5 + \text{TAB}$$
     - $\text{TAB} = 4.0\text{ mm}$ için $X_{\text{cup}} = 21.5\text{ mm}$ (Birim Fabrika Varsayılanı).
     - $\text{TAB} = 5.0\text{ mm}$ için $X_{\text{cup}} = 22.5\text{ mm}$ (Blum Standart Tam Bini).
6. **Üreticiye Özgü Menteşe Tas Yan Vida/Dübel Kalıpları (Boss Patterns):**
   - **Blum Kalıbı:** Tas merkezinden **$45.0\text{ mm}$** dikey eksen aralığı ($\pm 22.5\text{ mm}$), **$9.5\text{ mm}$** yatay içe ofset.
   - **Hettich (TH52) Kalıbı:** Tas merkezinden **$52.0\text{ mm}$** dikey eksen aralığı ($\pm 26.0\text{ mm}$), **$5.5\text{ mm}$** yatay içe ofset.
   - **Salice / Grass (48/9) Kalıbı:** Tas merkezinden **$48.0\text{ mm}$** dikey eksen aralığı ($\pm 24.0\text{ mm}$), **$9.0\text{ mm}$** yatay içe ofset (Grass Tiomos ve Salice Silentia+ ayrıca $45 \times 9.5\text{ mm}$ varyantına da sahiptir).
