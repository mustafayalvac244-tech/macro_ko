# UYAP entegrasyonu — hangi yol gerçekten açık

Tarih: 14.09.2026. Ürün sahibi: *"şu UYAP entegrasyonunu sağlamamız lazım."*

## Önce bir düzeltme

13.09.2026'da `RAKIP-OZELLIK-ANALIZI.md`'ye şunu yazmıştım:

> ⛔ UYAP Avukat Portal / e-Tebligat — e-imza + web servis + sertifikasyon
> istiyor; Expo uygulamasından yapılamaz, ayrı ürün kararı

**Bu eksikti.** Anlattığım şey **kurumsal web servis** yolu ve o kısım doğru.
Ama tek yol o değil; avukat yazılımlarının fiilen kullandığı yol başka ve
sertifikasyon istemiyor. Tek yolmuş gibi sunarak kapalı olmayan bir kapıyı
kapalı gösterdim.

---

## İki ayrı yol var, karıştırılıyor

### Yol A — Kurumsal UYAP Web Servisi (bize UYMUYOR)

Adalet Bakanlığı'yla **protokol** imzalanır, SSL sertifikası **kendi
sunucunuza** kurulur, her istekte kimlik bilgisi gider.

| Koşul | Değer |
|---|---|
| Kamu kurumu eşiği | 2.000+ dosya |
| **Özel şirket eşiği** | **4.000+ dosya** |
| Gereken belgeler | Başvuru dilekçesi, hizmet sözleşmesi, imza sirküleri, ticaret sicil |
| Ücret | Dosya başına/yıl: ilk 1.000 → 10 ₺, 1.001-10.000 → 5 ₺; kapalı dosya bedava |

**Neden bize uymuyor:** bu yol, bir kurumun **KENDİ** dosyalarına erişmesi için.
Binlerce icra dosyası olan bankalar, telekom şirketleri için tasarlanmış.
Vekil Pro bir yazılım satıcısı; dosyalar bizim değil, avukatların. 4.000
dosyalık eşik de bizde yok.

*(Kaynak: microdestek.com.tr kurumsal UYAP web servis anlatımı,
kurum.uyap.gov.tr başvuru kılavuzu. Adalet Bakanlığı'nın kendi resmî
koşul metnini doğrudan OKUMADIM — bu rakamlar aracı bir anlatımdan.)*

### Yol B — Avukatın KENDİ e-imzasıyla, kendi tarayıcısında (AÇIK OLAN YOL)

Piyasadaki avukat yazılımları bunu yapıyor. Mekanizma:

1. Avukat **kendi** e-imzası ya da **m-imzası** ile UYAP Avukat Portal'a girer
2. Yazılım, ekranda **zaten görünen** veriyi okur
3. Kendi programına aktarır

**Sertifikasyon YOK, protokol YOK, eşik YOK.** Çünkü ortada yeni bir erişim
yaratılmıyor: avukat kendi verisine, kendi kimliğiyle, resmî arayüzden zaten
erişiyor. Yazılım yalnız okuduğunu düzenliyor.

Bu yolu kullananlar: UYAP Katibim, UYAP Downloader (İstanbul Barosu duyurdu),
Cübbe eklentisi, TrTech toplu sorgu. Bir kısmı Windows masaüstü programı,
**bir kısmı Chrome eklentisi**.

---

## Bizim avantajımız: temel zaten atılmış

`extension/` klasöründe **çalışan bir Chrome eklentimiz var** ve tam olarak
doğru şeyi yapıyor:

- UYAP'ın **yanında yan panel** olarak açılıyor, açık kalıyor
- "Sayfadan dosya aç" düğmesi, açık sayfadaki dava bilgisini okuyup Vekil
  Pro'da dosya açıyor
- `lib/cikar.js` (169 satır) şunları çıkarıyor: esas no, karar no, mahkeme,
  davacı/davalı (ve icra karşılıkları: alacaklı/borçlu, sanık/katılan),
  dava türü, tarih
- **CSS seçici kullanmıyor, metin kalıbı kullanıyor** — UYAP arayüzünü
  değiştirdiğinde seçiciler sessizce boşalır, metin kalıbı ekrandaki yazıya
  bakar. Bu karar doğru ve kıymetli.
- Türkçe büyük harf tuzağı da çözülmüş (`/mahkemesi/i` deseni "MAHKEMESİ" ile
  eşleşmez; kodda notu var)

Eksik olan tek şey: **tek dosya değil, LİSTE okuyabilmek.**

---

## Üçüncü bir kapı: UYAP'ın kendi dışa aktarımı

UYAP Avukat Portal'da **"Excel'e Aktar"** var (duruşmalar menüsü; ayrıca son
iki ayın tebligat raporu Excel olarak indirilebiliyor).

Yani avukat UYAP'tan kendi listesini indirip bize verebilir. Bu, hiçbir
entegrasyon ilişkisi gerektirmez ve **`RAKIP-OZELLIK-ANALIZI.md`'deki 3.
maddeyi (başka programdan içe aktarım) aynı anda çözer.**

---

## Önerilen sıra

| # | İş | Neden önce bu |
|---|---|---|
| 1 | **Excel içe aktarım** | Sıfır bağımlılık, sıfır izin. Avukat UYAP'tan indirir, biz okuruz. Aynı kod rakip programlardan geçişi de çözer. |
| 2 | **Eklentiyi liste okumaya çıkarmak** | Temel hazır; tek dosya yerine dosya listesi sayfasını okumak. "Tek tıkla dosyalarım" algısını bu verir. |
| 3 | Duruşma/tebligat senkronu | 2'nin üstüne oturur. |
| ⛔ | Kurumsal web servis | Eşik ve model bize uymuyor. Şirket büyüyüp kendi dosya hacmi oluşursa yeniden bakılır. |

---

## ÖLÇÜLMEYENLER — karar vermeden önce bilinmesi gerekenler

Bunları "sorun yok" diye okumayın; **bakılmadı** demek:

- **UYAP Avukat Portal'a giremiyorum** (e-imza gerekiyor, bende yok ve
  istemiyorum). Dosya listesi sayfasının HTML'ini hiç görmedim. Yani 2.
  maddenin ne kadar zor olduğunu **bilmiyorum** — sayfa tablo olabilir, iframe
  olabilir, sanal kaydırma olabilir; üçü üç ayrı zorluk.
- **Excel çıktısının biçimini görmedim.** Hangi sütunlar var, başlıklar ne —
  bilinmiyor. 1. maddeye başlamadan önce **bir avukattan örnek dosya almak
  şart**, aksi hâlde sütun eşlemesi tahminle yazılır.
- **UYAP'ın kullanım koşullarının tarayıcı eklentilerine bakışını
  doğrulamadım.** Rakipler bunu açıkça yapıyor ve İstanbul Barosu bir tanesini
  duyurdu — bu güçlü bir işaret ama hukuki görüş değil. Ürün sahibi bunu bir
  meslektaşına sormalı.
- Yol A'nın rakamları aracı bir kaynaktan; Bakanlığın resmî metni okunmadı.
