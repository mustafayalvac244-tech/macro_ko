# UDF'nin gerçek UYAP Editör'de açılması — denetim (04.10.2026)

**Ne denendi:** `src/lib/udf.ts > udfUret` ile üretilen dilekçe, Adalet
Bakanlığı'nın resmî **UYAP Doküman Editörü 5.4.20** Linux paketiyle
(`rayp.adalet.gov.tr/resimler/2/dosya/uyapeditor_5.4.20_amd64.zip`) açıldı.
Ekransız sunucuda Xvfb + Java 11 kullanıldı (editör Java 6–14 istiyor; 21 ile
"Java Sürümünüz Uygun Değil" diyor). Belge, editörün kendi giriş noktasıyla
açıldı (`WPAppManager getNewWPInstance EDITOR_TYPE_DOCUMENT <dosya>`) ve
pencere bileşenlerinden belge modeli okundu.

**Sonuç (deterministik, tekrar koşulsa aynı çıkar):**

| Denetim | Sonuç |
|---|---|
| Açılış | Hata kutusu yok; başlık "Doküman Editörü v5.4.20 - yeni.udf" |
| Belge sürümü | Durum çubuğu "Belge Sürüm : 1.8(güncel)" |
| Metin | 12 paragrafın tamamı, Türkçe harfler ve `& < > "` bozulmadan |
| Hiza | Başlıklar ortalı (1), gövde iki yana yaslı (3) |
| Yazı | Times New Roman, 12 punto |
| Kalın başlık | `bold="true"` → başlıklar kalın, gövde normal |

**Ölçülmeyenler:** Windows'taki editör (ekranda yazı tipi farklı görünebilir;
belgedeki değer Times New Roman), editörde KAYDET/e-imza adımı, UYAP'a
gerçek gönderim. "DAVACI : …" satırlarındaki iki nokta boşlukla hizalandığı
için orantılı yazı tipinde tam hizalı durmaz — düzeltilmedi.
