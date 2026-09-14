# İki haftayı nasıl kullanırız — 14.09.2026

Ürün sahibi: *"bu süreci nasıl en iyi şekilde kullanırız, geri kalmayız."*
Ve: *"burada onların AI'ı ve senin yarışın var, bunu ciddiye al."*

## Yarış çerçevesi — bir yönden yanlış, bir yönden çok doğru

**Yanlış olan yön.** Rakiplerle "daha iyi yapay zekâ" yarışı diye bir şey yok.
iAvukat, Avudex, LexChat, Lawyer Team ve biz — hepimiz aynı sağlayıcıları
çağırıyoruz. Kimse kimseden daha iyi bir modele erişmiyor. Bu eksende
kazanılacak bir üstünlük yok ve oraya yatırım yapmak boşa gider.

**Doğru olan yön.** Onlar piyasada ve gerçek kullanımdan öğreniyorlar.

> ⚠️ **BU BÖLÜMDE YANILDIM VE DÜZELTİYORUM.** İlk yazdığımda "sıfır avukat
> bu uygulamayı kullandı" demiştim. Yanlış. Ürün sahibi düzeltti: **Burak
> gerçek bir avukat ve uygulamayı eski sürümleriyle birlikte epey
> kullanmış.** Ölçtüm — kodda **19 yerde** onun (ve Alper'in) geri bildirimi
> yazılı: duruşma türlerinde mazeret kuralı, keşif tarihi, dava dizininin
> açılış tarihine göre sıralanması, "Aktif" yerine Açık/Kapalı ayrımı, masraf
> avansı uyarısının kapatılabilmesi. Yani ürün gerçek avukat elinden geçmiş.

Geriye kalan gerçek boşluk daha dar ve daha net:

> **Ürün sahibi uygulamayı kullanıyor ama gerçek dosya akışı olmadığı için
> hata yakalayamıyor.** Bu bir eksiklik değil, rol meselesi: avukat olmayan
> biri gerçekçi kullanım üretemez.

Yani çözüm ürün sahibini daha çok kullandırmak değil; **Burak'a ne
deneyeceğini söyleyen yapılandırılmış bir liste vermek.** "Bak bakalım"
demek, en çok bilineni bir kez daha doğrulatır; hiç ölçülmemiş yerleri
değil.

## Elimizdeki gerçek üstünlük — ve ölçülebilir olması

Rakipler "yapay zekâmız var" diyor. Bizde onlarda olmayan şu var: **üretilen
her karar künyesi mekanik olarak denetleniyor.** `AtifDenetimi` bileşeni üç
cevaptan birini veriyor:

- **"BU ATIFLAR OLAMAZ"** — gerekçesiyle: *gelecek bir yıla ait numara*,
  *karar yılı esas yılından önce olamaz*, *bu numarada bir daire hiç var
  olmadı*
- **"Havuzumuzda bulunamadı"** — ve dürüst notuyla: *bulunamaması kararın
  yanlış olduğunu göstermez*
- **"Doğrulandı"**

Bir avukat için uydurma künye felakettir: dilekçeye giren sahte bir karar
numarası meslekî bir kaza. Rakiplerin hiçbiri bunu denetlediğini söylemiyor.

**Ve biz bunu SAYABİLİYORUZ.** `admin_atif_denetimi(gun)` RPC'si mod bazında
şunu döndürüyor: istek sayısı · atıf sayısı · doğrulandı · havuzda yok ·
olanaksız · uydurma madde. Yani "yapay zekâ ne sıklıkla künye uyduruyor ve
biz ne kadarını yakalıyoruz" sorusunun **ölçülmüş** cevabı bizde var.

Hiçbir rakip böyle bir sayı yayımlamıyor. Bu hem dürüst bir iddia hem de
kopyalanması zor: sayı, 10,4 milyonluk künye kataloğuna dayanıyor.

## Konumlandırma kararı

**"Yapay zekâmız var" demeyi bırak. "Uydurmayan yapay zekâ" de.**

> ⚠️ **BURADA DA ÖLÇMEDEN YAZDIM.** İlk hâlinde "tanıtım sitesi hâlâ özellik
> listesi diliyle konuşuyor, sitenin manşeti bu olmalı" yazıyordu. Sonra
> baktım: **manşet zaten doğruydu** — `docs/index.html` "Uydurma karar
> numarası / dilekçenize girmesin" diyor ve altında canlı denetim kutusu
> duruyor. Paylaşım kartı (og.html) ve JSON-LD açıklaması da doğruydu.
> Dosyayı açıp bakmak bir dakikalık işti; yapmadım. Aynı hatanın üçüncüsü
> (önce "sıfır avukat kullandı", sonra UYAP'a "yapılamaz").

**Gerçekten eksik olan neymiş — 14.09.2026 ölçümü.** Sayfanın GÖVDESİ ile
arama sonucunda/WhatsApp bağlantısında görünen METİN ayrışmıştı:

| Nerede | Eskiden ne diyordu | Durum |
|---|---|---|
| `<h1>` manşet | "Uydurma karar numarası dilekçenize girmesin" | ✅ zaten doğruydu |
| Paylaşım kartı görseli (og.html) | aynı manşet + "doğrulandı, havuzda yok ya da olamaz" | ✅ zaten doğruydu |
| JSON-LD `description` | "…her künye mekanik olarak denetlenir" | ✅ zaten doğruydu |
| `<title>` | "dava, duruşma ve yapay zekâ asistanı" | ❌ düzeltildi |
| `<meta description>` | "…güçlü yapay zekâ desteğiyle dilekçe taslağı" (211 karakter, sonu kesiliyordu) | ❌ düzeltildi, 155 karakter |
| `og:title` / `og:description` | "büro ve araştırma asistanı" | ❌ düzeltildi |

Yani kartın görseli bir şey, yanındaki yazı başka şey söylüyordu. Gelen kişi
önce "bunun da yapay zekâsı var" cümlesini okuyup sonra bambaşka bir vaatle
karşılaşıyordu — ve rakiplerin hepsi aynı ilk cümleyi kuruyor.

**İddia ölçüldü.** "Üretilen HER künye denetlenir" yazıya dayanmıyor:
`ai-chat` uç işlevinde metin üreten dört yolun (`mutalaa`, `dilekce`,
`belge`, `sohbet`) dördü de `kararAtfiDenetimi()` çağırıyor, dört ekranın
dördü de `AtifDenetimi` bileşenini gösteriyor. Beşinci mod (`kunye`) künye
üretmiyor, yüklenen belgeden okuyor. "Her" kelimesi bu yüzden abartı değil.

## Pencerede yapılacaklar — sırayla

| # | İş | Kim | Neden bu sırada |
|---|---|---|---|
| 1 | **APK'yı telefonuna kur, bir hafta avukat gibi kullan** | Ürün sahibi | Uygulama hiç cihazda çalışmadı. Bulduğun her hata, test kullanıcısının bulmayacağı bir hata. Play hesabı beklerken bunun tek yolu APK. |
| 2 | **Atıf denetimi sayısını ölç** | Ürün sahibi | Ayarlar → Yönetici ekranındaki atıf satırının ekran görüntüsü. Bu, rakiplerin yayımlamadığı tek gerçek sayımız olur. |
| 3 | **Burak'a APK + test listesi ver** | Ürün sahibi | Avukat aramaya gerek yok, zaten var. Aynı kişi üç kapıyı birden açıyor: UYAP ekran görüntüsü, Excel çıktısı (e-imzası var), ve kapalı testin 1. kullanıcısı. Liste hazır: `BURAK-TEST-LISTESI.md` |
| 4 | ✅ ~~Sütun eşlemeli içe aktarım~~ | Claude | **Yapıldı 14.09.2026.** `app/toplu-aktar.tsx` + `src/utils/iceAktarim.ts`, 27 test. Türkçe Excel'in noktalı virgülü, BOM'u, tırnaklı hücresi karşılanıyor. **Ama örnek dosyaları ben uydurdum** — gerçek bir UYAP/Sinerji çıktısıyla hiç denenmedi. Doğrulaması 3. maddeye bağlı. |
| 5 | ✅ ~~Arama/paylaşım metinleri~~ | Claude | **Yapıldı 14.09.2026.** Yukarıdaki tablo. |

## Neden bu sıra

1 ve 2 **bugün** yapılabilir, kimseye bağlı değil.
3 en yüksek getirili ve artık **zaman da almıyor** — avukat zaten elimizde.
4 ve 5 bende bitti; ikisi de kimseyi beklemedi.

**Benim tarafımda açık iş kalmadı.** Sıradaki her şey ya ürün sahibine ya
Burak abiye bağlı. Bu bir engel değil, ölçüm: 1-2-3 yapılmadan yazılacak
kod, körlemesine yazılmış kod olur.

UYAP'ın liste okuma kısmı ve müvekkil portalı bilerek **dışarıda**: ilki
avukat olmadan körlemesine yazılır, ikincisi RLS sınırını değiştiren bir
ürün kararı ve acelesi yok.

## Dürüst sınır

Ben bir yarışı kazandıramam; kod yazar ve ölçerim. Yukarıdaki dört maddenin
üçü ürün sahibinde. Bekleme penceresi kod yazarak değil, **Burak'ın eline
çalışan bir APK ve ne deneyeceğini söyleyen bir liste vererek** kazanılır.

Bir de kendime not: bu dosyada ÖLÇMEDEN yazdığım **üç** cümle çıktı ve
üçü de yanlıştı — "sıfır avukat kullandı" (oysa kodda 19 yerde Burak'ın
geri bildirimi var), UYAP'a "yapılamaz" (oysa iki yoldan yalnız biri
kapalı), ve "sitenin manşeti özellik listesi" (oysa manşet zaten
doğruydu). Üçünün de doğrulanması birer dakikalık işti: `grep Burak`,
mevzuatı okumak, `docs/index.html`'i açmak.

Ortak kusur şu: **stratejik bir cümle, teknik bir cümle kadar ölçüm
istiyor.** Kod hakkında ölçmeden konuşmuyorum ama ürün/piyasa hakkında
ölçmeden konuşmayı kendime serbest bırakmışım. Aynı hata.
