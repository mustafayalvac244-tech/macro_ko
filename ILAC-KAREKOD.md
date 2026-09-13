# İlaç kutusu karekod uygulaması — beş özellik önerisi

> **Bu belge bu depoya ait bir ürünü anlatmıyor.** Bu depo (`macro_ko`) VekilPro —
> avukatlar için dava takip uygulaması. Belge, ayrı bir ürün fikri için hazırlanan
> bir ön nottur ve görev dalı `claude/ilac-okutma-5-ozellik-msdj63` olduğu için
> buraya kondu. VekilPro deposunda durmasını istemiyorsan sil.

Görsel hâli (aynı içerik): https://claude.ai/code/artifact/0ca0f9ad-add5-4929-bf88-6070e6248ee9

---

## Dürüstlük notu — önce bu

- **Kod görülmedi.** Bu depoda ilaç ya da karekod kodu yok. Aşağıdakilerin tamamı
  "QR okuyan bir ilaç uygulaması yaptım" cümlesine ve genel bilgiye dayanıyor.
  Hiçbiri ölçüm değil, hiçbiri denenmedi.
- **Sayfada tek bir sayı uydurulmadı.** Pazar büyüklüğü, kullanıcı sayısı, dönüşüm
  oranı, gelir tahmini yok. Sayı gereken yerlerde `[köşeli parantez]` var.
- **Doğrulanması gerekenler** en altta madde madde listelendi.

---

## 0. Her şeyden önce: kutudaki kod QR değil

Türk ilaç kutusundaki kod **GS1 DataMatrix**, QR değil. İkisi farklı sembol:
QR'ın üç köşesinde büyük kare "göz" vardır; DataMatrix'in iki kenarı **dolu bir L**,
diğer iki kenarı **kesik çizgilidir**.

Tarayıcı yalnızca QR formatına ayarlıysa gerçek kutuların çoğunu okuyamaz — ve
**hata da vermez**, sessizce bekler. Kullanıcı "bozuk" deyip siler.

Yapılacak: kamera ayarında `datamatrix` formatını aç. Expo kullanılıyorsa
`expo-camera`'daki `barcodeScannerSettings.barcodeTypes` listesine `datamatrix`,
kutunun üstündeki eski çizgili barkod için `ean13` ekle.

### Karekodun içinde ne var

| AI | Alan | Uzunluk | Not |
|----|------|---------|-----|
| `(01)` | GTIN | 14 hane, **sabit** | Ürün kimliği |
| `(21)` | Seri no | **değişken** | O tek kutu |
| `(17)` | SKT (YYMMDD) | 6 hane, **sabit** | Gün `00` ise: ayın son günü |
| `(10)` | Parti no | **değişken** | Geri çağırmada kritik |

Örnek ham içerik (`⟨GS⟩` = ASCII 29):

```
]d2 01 08680000000013 21 2H4K9QW7X1 ⟨GS⟩ 17 271200 10 L27B14
```

### Asıl tuzak: ayrıştırma

Parti ve seri numarası **değişken uzunlukta** ve `GS` ayıracıyla biter. Bu
işlenmezse seri numarasının sonuna parti numarası yapışır — en sık yapılan hata,
ve ekranda "çalışıyor" gibi görünür.

Çalışan ve test edilmiş hâli depoda: [`ilac-karekod/karekod.ts`](ilac-karekod/karekod.ts)
(27 test geçiyor, `tsc --strict` temiz — bkz. [`ilac-karekod/README.md`](ilac-karekod/README.md)).

Bu notun ilk hâlinde buraya yazdığım ayrıştırıcıyı **hiç çalıştırmamıştım**.
Çalıştırınca iki gerçek hata çıktı:

1. Yukarıdaki örnek GTIN'in (`...017`) **kontrol hanesi tutmuyordu**; doğrusu
   `...013`. Düzeltildi — ve modüle kontrol hanesi doğrulaması eklendi, çünkü
   hatalı okumanın sessizce kabul edilmesi tam olarak bu demek.
2. **Kutunun çizgili barkodu (EAN-13) yolu eksikti.** AI `(01)` standartta
   zaten 14 hane sabit, yani 13 haneli GTIN karekoddan gelmez; eski çizgili
   barkoddan gelir ve onda hiç AI yoktur. Önemli sonucu şu: EAN-13 **kutuyu
   değil yalnız ürünü** tanır — seri numarası taşımadığı için o kodla ne Miat
   Radarı ne de mükerrer sayım engeli çalışır.

Ayrıca ilk hâl, tanınmayan bir AI'yı sessizce dizginin sonuna kadar yutuyor,
sıradan bir QR okutulduğunda `undefined` dönüyor ve 30 Şubat gibi tarihleri
sessizce 2 Mart'a kaydırıyordu. Hepsi düzeltildi.


---

## Beş özellik — sırası tesadüf değil

Bunlar beş ayrı fikir değil, tek bir zincir: (1) kullanıcıyı getirir,
(2) doktoru ve eczacıyı tanıtımcı yapar, (3) alışkanlığı kurar, (4) faturayı
ödetir, (5) kopyalanamayan varlığı kurar. Sıra bozulursa zincir kopar — veri seti
olmadan hendek, kullanıcı olmadan ağ olmaz.

---

### 01 · KANCA — "Kutu konuşsun"

**An.** 72 yaşında bir kadın prospektüsü açmış, altı puntoluk yazıyı okuyamıyor.
Telefonu kutuya tutuyor. Telefon konuşuyor: *"Bu ilaç tansiyon için. Sabah, aç
karnına, günde bir tane. Greyfurt suyuyla içme. Başın dönerse ayağa yavaş kalk."*

**Ne yapar.** Karekoddan GTIN'i alır, Kullanma Talimatı'nı bulur, altı cümleye
indirir: ne için, ne zaman, yemekle ilişkisi, neyle alınmaz, en sık üç yan etki,
"hemen doktora git" işaretleri. Üstüne sesli okuma ve dev punto — tek ekran,
tek buton, açınca kendi okur.

**Kritik tasarım kararı.** Sadeleştirmeyi **her okutmada** yapay zekâya yaptırma.
Ürün başına **bir kez** üret, bir eczacıya onaylat, gömülü dağıt. Üç kazanç:
aynı kutu her zaman aynı cümleyi söyler; maliyet sıfıra yakınsar; metnin arkasında
imzası olan bir insan olur. Sorumluluk tartışması çıkarsa tek savunma budur.

**Kimsenin bakmadığı pazar.** Görme engelli biri ilaç kutusunu ayırt edemiyor —
kutular aynı boyda, aynı kartonda. Onun için bu "güzel olmuş" değil, tek çözüm.
Erişilebilirlik hikâyesi aynı anda üç kapı açar: basın, mağaza editörleri,
destek/hibe başvuruları.

**Kim öder.** Kimse. Bu özellik para değil, kullanıcı kazandırır.

**Risk.** Talimatı sadeleştirmek ile tıbbi tavsiye vermek arasındaki çizgiyi
ekranda göster: "Bu, prospektüsün özetidir. Doktorunun söylediği esastır."
Dipnota gömme, özetin yanına koy.

---

### 02 · AĞ — "İlaç Kimliğim": kodu okuyan değil, kod üreten uygulama

**An.** Acil servis. Hasta konuşamıyor. Cüzdanından bir kart çıkıyor. Doktor
okutuyor: dokuz ilaç, iki alerji, kan grubu, kritik tanı notu, aranacak yakının
numarası. Üç saniye.

Ya da poliklinikte, yedi dakika var: *"Ne kullanıyorsunuz?" — "Beyaz, yuvarlak bir
hap, sabahları."* Bunun yerine doktor telefondaki kodu okutuyor.

**Ters çevirme.** Herkes kod okuyor. Sen **kod üret**. O anda uygulama bir
tarayıcı olmaktan çıkar, bir **kimlik** olur — ve kimlikler silinmez.

**İki katman — ve bu ayrım KVKK savunmasıdır.**

1. **Acil katman:** veri kodun içine gömülü, internetsiz okunur, ama sadece hayati
   minimum — kan grubu, alerji, kritik tanı, acil kişi.
2. **Tam katman:** süreli bağlantı + tek kullanımlık anahtar. Tam ilaç listesi
   yalnızca buradan açılır. Kartı yerde bulan biri listeyi göremez.

**Neden ticari olarak güçlü.** B2C'de en pahalı kalem kullanıcı edinmedir. Doktor
ve eczacı bu kodu sevdiği anda uygulamayı **onlar** tanıtır: "Şu uygulamayı
indirin, kodunuzu getirin."

**Fiziksel ürün — küçümseme.** Cüzdan kartı, buzdolabı magneti, anahtarlık künyesi.
Yaşlı kullanıcı telefona değil kâğıda güvenir. Hem ek gelir kalemi, hem evin
içinde duran kalıcı reklam.

**Risk.** Sağlık verisi KVKK'da **özel nitelikli kişisel veri** — en ağır rejim.
Açık rıza, ayrı saklama, şifreleme, yurt dışına aktarım kısıtı mimarinin ilk
gününde kurulmalı. Sonradan eklenmez; eklemeye kalkarsan veritabanını baştan
yazarsın.

---

### 03 · SARSINTI — "Çakışma alarmı"

**An.** Kullanıcıya tek bir şey söylüyorsun: *"Mutfak çekmecesindeki bütün kutuları
arka arkaya okut."* Doksan saniye. Sonra tek ekran:

```
Tarama bitti
  9  ilaç bulundu
  2  tanesi aynı etken maddeyi taşıyor
  1  tanesinin son kullanma tarihi geçmiş
  3  tanesinin daha ucuz eşdeğeri var
```

Bu bir tanıtım ekranı değil, bir **gösteri**. Uygulamayı sattıran şey anlattığın
özellikler değil, kullanıcının kendi çekmecesinde bunu görmesi. Videoya çek,
reklamın da bu olsun.

**Üç katman, zorluk sırasıyla.**

1. **Aynı etken madde.** En kolayı ve en çarpıcısı; GTIN → etken madde eşleşmesi
   yeter. İnsan iki ayrı marka alıyor, ikisi de parasetamol; günlük dozu farkında
   olmadan ikiye katlıyor. Bu ekranı gören kullanıcı yüksek sesle "aaa" der.
2. **Etkileşim.** Lisanslı veritabanı ister. Tek dürüst seçenek: ya lisansla, ya
   hiç yapma. **Yarım yapılmış etkileşim kontrolü, hiç yapmamaktan tehlikelidir** —
   kullanıcı "uygulama bir şey demedi" diye rahatlar.
3. **Eşdeğer ve fiyat farkı.** Cebe dokunan tek katman.

**Risk.** Etkileşim uyarısı ve doz hesabı yazılımı "tıbbi cihaz" sınıflandırmasına
itebilir. Bu bir kod sorusu değil, **hukuk sorusu** — cevabı kod yazmadan önce alınır.

---

### 04 · GELİR — "Miat Radarı"

**An.** Eczacı rafı dört dakikada tarıyor. Ekran: *"Rafında son kullanma tarihine
90 günden az kalmış [tutar] TL'lik ilaç var. Bunun [tutar] TL'lik kısmı hâlâ iade
edilebilir. İade süresi en yakın olan: [ürün], [gün] gün."*

**Neden abonelik olur.** Çünkü kendi bedelini kendi raporlar: *"Geçen ay bu
uygulama sana [tutar] TL kurtardı; aylık ücreti [tutar] TL."* Bu cümleyi kurabilen
yazılım satılır. Aboneliği iptal etmek, kurtarılan parayı geri vermek gibi hissettirir.

**Gerçek teknik üstünlük.** Çizgili barkod (EAN-13) **ürünü** sayar; karekoddaki
seri numarası **o tek kutuyu** sayar. Yani mükerrer sayım fiziksel olarak imkânsız
hâle gelir. Üstelik SKT zaten kodun içinde: **tek bir tarih elle girilmiyor.**
Bunu rakip barkodla yapamaz.

**Kim öder — eczaneden ibaret değil.** Eczane, poliklinik, diş kliniği, veteriner,
diyaliz merkezi, bakımevi, güzellik merkezi, iş yeri hekimliği dolabı, otel reviri,
ilkyardım dolabı olan her fabrika. Derdi aynı: rafta sessizce ölen para.

**Kurumsal uzantı.** Bakımevinde "kim, hangi ilacı, hangi saatte verdi" kaydı hâlâ
büyük ölçüde kâğıtta. Kutuyu ve hastayı okutarak tutulan kayıt, denetimde ibraz
edilebilir bir tutanak üretir. Denetime giren kurum buna para öder — aldığı şey
yazılım değil, denetimde rahat uyumak.

**Risk.** İade penceresinin kaç gün olduğuna dair **hiçbir sayı verilmedi**, çünkü
bilinmiyor. Depo sözleşmesinden ve mevzuattan al; uygulamaya sabit yazma,
ayarlanabilir yap.

---

### 05 · HENDEK — "Kör nokta": kutu yokken

**An.** Haplar günlük bölmeli hap kutusuna aktarılmış, kutular atılmış. Ya da yerde
tek bir hap var ve evde çocuk var. Karekod okuyan uygulamanın burada hükmü yok.

**Ne yapar.** Hapın fotoğrafını çek: şekil, renk, çentik, üstündeki kabartma yazı.
Uygulama "şu üç ilaçtan biri" der.

**Ve asıl fikir bu.** Türkiye'de bu ölçekte bir görsel hap veritabanı yok. Ama
kullanıcılara kurdurulabilir: her kutu okutulduğunda sor — *"İçindeki hapın
fotoğrafını da çeker misin? İki saniye."* GTIN zaten belli, yani **fotoğraf
kendiliğinden etiketlenmiş** oluyor. Rakibin parayla kuramayacağı varlık budur:
bütçe değil, kullanıcı tabanı gerektirir. Sen uykudayken büyür.

**Katkıyı oyuna çevir.** Katkı sayacı, ilk yüz katkıcıya ömür boyu ücretsiz, en çok
katkı veren eczaneye rozet. İnsanlar veri vermeyi sevmez; **katkıda bulunmayı** sever.

**Risk — sertçe.** Görsel tanımanın güvenilirliğini **ölçmeden iddia etme**.
Başlangıçta "bu ilaç şudur" deme; "en olası üç aday" göster, seçimi kullanıcıya
bırak. Yanlış tanınan bir hap, hiç tanınmayan haptan tehlikelidir.

---

## Beşe sığmayanlar

- **Oruç modu.** "Günde iki doz, on iki saat arayla" — sahur ve iftar saatine
  oturtulmuş doz planı. Ramazan'da bu özelliğin haberini gazeteci yazar. Yılın bir
  ayı, ama indirme grafiğini o ay değiştirir. Yurt dışından gelen rakip bunu yapmaz.
- **Rapor sayacı.** Kronik hastanın ilaç raporu bitmeden uyarı; kaçırıldığı gün
  cepten ödeme başlar, yani uyarının değeri doğrudan lirayla ölçülür.
- **Bitmeden haber ver.** Kutudaki adet + günlük doz: "İlacın altı gün sonra
  bitiyor, reçeteyi dört gün içinde yazdır."
- **Soğuk zincir.** İnsülin ve biyolojik ilaçlar 2–8 °C'de durmalı; uzun elektrik
  kesintisinden sonra uyarı.
- **Mükerrer seri.** Aynı seri numarası kısa aralıkla uzak iki yerde okutulursa
  şüphe bayrağı. Resmî sisteme bağlanmadan çalışır — ama kanıt değil **sinyal**;
  kullanıcıya da tam olarak böyle söyle.
- **Ailenin dolabı.** Hane içinde ortak envanter: "Bu ilaç kayınvalidende var,
  SKT'si de uygun."

---

## Kim öder, ne zaman öder

| Katman | Ne satılıyor | Kime | Amaç |
|--------|--------------|------|------|
| 0 · Ücretsiz | Özellik 01, 02, 03 | Hasta, hasta yakını, yaşlı, kronik hasta | Gelir değil: kullanıcı, veri seti, doktor–eczacı ağı |
| 1 · Abonelik | Miat Radarı | Eczane, poliklinik, diş, veteriner, diyaliz | Aylık gelir; satış argümanı kurtardığı para |
| 2 · Kurumsal | İlaç verme kaydı ve denetim tutanağı | Bakımevi, huzurevi, özel bakım merkezi | Kurum başına yıllık; aldığı şey uyum |
| 3 · Fiziksel | Acil kart, magnet, künye | Aynı kullanıcılar + kurumlar toplu | Ek gelir ve kalıcı marka |

**Nereden başlama.** Eczanelerin resmî sisteme bağlı, yerleşik yazılımları var.
Onların yerine geçmeye çalışma — **yanlarında dur**. O yazılımlar kasanın ve
reçetenin tarafında; bu ürün rafın ve hastanın tarafında. Rakip olmadığın sürece
eczacı kapıdan içeri alır.

---

## Doğrulanması gerekenler

1. **Kod görülmedi.** Bu depo VekilPro; içinde ilaç ya da karekod kodu yok.
   Yukarıdakilerin hiçbiri ölçüm değil.
2. **Karekod formatı.** Türk ilaç kutusunda GS1 DataMatrix olduğu ve içinde
   GTIN / seri / SKT / parti bulunduğu genel GS1 ve İlaç Takip Sistemi bilgisinden
   yazıldı. Alan sırasını ve ayrıntıları TİTCK'nın karekod kılavuzundan teyit et.
   **Kılavuzun sürüm numarası bilerek verilmedi** — bilinmiyor.
3. **İade penceresi.** Miadına ne kadar kala iade edilebildiğine dair sayı
   verilmedi. Depo sözleşmesi ve mevzuattan alınmalı.
4. **Resmî sisteme bağlanma.** İlaç Takip Sistemi'ne resmî bağlanmanın paydaş
   kaydı ve GLN gerektirdiği biliniyor; şartları teyit edilmeli. Yukarıdaki beş
   özelliğin hiçbiri bu bağlantıyı **zorunlu kılmıyor** — bu kasıtlı.
5. **Tıbbi cihaz sınıfı.** Etkileşim uyarısı ve doz hesabının yazılımı tıbbi cihaz
   kapsamına sokabileceği bir **risk uyarısıdır**, hukuki görüş değil. Avukata sor.
6. **Veri kaynakları.** Kullanma Talimatı, Kısa Ürün Bilgisi ve ilaç fiyat
   listelerinin TİTCK tarafından yayımlandığı biliniyor; format, güncelleme sıklığı
   ve kullanım koşulları kontrol edilmeli.
7. **Expo ayrıntısı.** `expo-camera`'da `datamatrix` formatının açılması gerektiği
   genel bilgiyle yazıldı; kullanılan Expo sürümünün kendi dokümanından teyit et.
8. **Ayrıştırıcı gerçek kutuda denenmedi.** 27 test geçiyor ama sınav setini
   de "doğru"nun tanımını da ben yazdım. Birkaç gerçek kutuyu okutup çıktıyı
   kutunun üstündeki yazıyla karşılaştırman gerekir.
9. **Hiçbir sayı uydurulmadı.** Pazar büyüklüğü, kullanıcı sayısı, dönüşüm oranı,
   gelir tahmini yok. Her `[köşeli parantez]` ölçülecek bir boşluk.

---

Bu belge bir taslaktır. Beş özelliğin hiçbiri kodlanmadı, hiçbiri kullanıcı
üzerinde denenmedi. Bir sonraki adım fikir eklemek değil, birini seçip en küçük
hâliyle bir eczacıya ya da bir hasta yakınına göstermek — ve o kişinin yüzünü izlemek.
