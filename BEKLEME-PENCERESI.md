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

Mağaza metnimiz bunu zaten söylüyor (*"ÜRETİLEN HER KÜNYE DENETLENİR"*) ama
tanıtım sitesi hâlâ özellik listesi diliyle konuşuyor. Sitenin manşeti bu
olmalı.

## Pencerede yapılacaklar — sırayla

| # | İş | Kim | Neden bu sırada |
|---|---|---|---|
| 1 | **APK'yı telefonuna kur, bir hafta avukat gibi kullan** | Ürün sahibi | Uygulama hiç cihazda çalışmadı. Bulduğun her hata, test kullanıcısının bulmayacağı bir hata. Play hesabı beklerken bunun tek yolu APK. |
| 2 | **Atıf denetimi sayısını ölç** | Ürün sahibi | Ayarlar → Yönetici ekranındaki atıf satırının ekran görüntüsü. Bu, rakiplerin yayımlamadığı tek gerçek sayımız olur. |
| 3 | **Burak'a APK + test listesi ver** | Ürün sahibi | Avukat aramaya gerek yok, zaten var. Aynı kişi üç kapıyı birden açıyor: UYAP ekran görüntüsü, Excel çıktısı (e-imzası var), ve kapalı testin 1. kullanıcısı. Liste hazır: `BURAK-TEST-LISTESI.md` |
| 4 | **Sütun eşlemeli içe aktarım** | Claude | UYAP'a da avukata da bağlı olmayan tek büyük özellik. Hem UYAP Excel çıktısını hem rakip programlardan geçişi aynı kodla çözüyor. |

## Neden bu sıra

1 ve 2 **bugün** yapılabilir, kimseye bağlı değil.
3 en yüksek getirili ve artık **zaman da almıyor** — avukat zaten elimizde.
4'ü ben yaparım, kimseyi beklemez.

UYAP'ın liste okuma kısmı ve müvekkil portalı bilerek **dışarıda**: ilki
avukat olmadan körlemesine yazılır, ikincisi RLS sınırını değiştiren bir
ürün kararı ve acelesi yok.

## Dürüst sınır

Ben bir yarışı kazandıramam; kod yazar ve ölçerim. Yukarıdaki dört maddenin
üçü ürün sahibinde. Bekleme penceresi kod yazarak değil, **Burak'ın eline
çalışan bir APK ve ne deneyeceğini söyleyen bir liste vererek** kazanılır.

Bir de kendime not: "sıfır avukat kullandı" gibi bir cümleyi ÖLÇMEDEN
yazdım ve yanlış çıktı. Depoda `grep Burak` demek otuz saniyelik işti.
Stratejik bir tespiti ölçmeden yazmak, teknik bir tespiti ölçmeden yazmakla
aynı hatadır.
