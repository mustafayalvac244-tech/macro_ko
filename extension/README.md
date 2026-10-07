# Vekil Pro — Chrome Eklentisi

Simgeye tıklayınca **yan panel** açılır ve Vekil Pro'nun tamamı orada çalışır:
dosyalar, müvekkiller, ajanda, içtihat araması, hesaplayıcılar. Panel UYAP'ın
yanında açık kalır — dosyayı okurken ajandanız yanınızdadır.

Ayrıca üstteki **"Sayfadan dosya aç"** düğmesi, açık sayfadaki dava bilgilerini
okuyup Vekil Pro'da dosya açar.

## Mimari — neden böyle

**Uygulama eklentinin içine gömülmedi, barındırılan web sürümü açılıyor.**
Gömme denendi ve iki sebeple bırakıldı:

1. Web paketi **21 MB**; her güncelleme eklentiyi elden yeniden yüklemeyi
   gerektirirdi.
2. Pakette `eval` var. MV3 eklenti sayfalarının CSP'si (`script-src 'self'`)
   bunu engelliyor ve uygulama hiç açılmıyordu.

Barındırılan sayfa kendi CSP'siyle çalışır, eklenti **~50 KB** kalır ve uygulama
siz hiçbir şey yapmadan güncellenir.

**Sayfa okuma AI kullanmıyor.** "Esas No: 2023/145", "ANKARA 3. ASLİYE HUKUK
MAHKEMESİ", "DAVALI:" sayfada düz yazıyla duruyor; bunlar düzenli ifadeyle
çıkarılıyor (`lib/cikar.js`) — anında, bedava, kota harcamadan, çevrimdışı.
Yapay zekâ yalnız hiçbir kalıp tutmazsa devreye girer.

CSS/XPath seçicisi de kullanılmıyor: UYAP arayüzünü değiştirdiğinde seçiciler
sessizce boşalır, metin kalıpları ise ekranda görünen yazıya bakar.

## Gizlilik

- `activeTab` + `scripting`: sayfa metni **yalnız düğmeye bastığınızda** okunur.
  Arka planda dinleyen content script **yok**.
- `storage`: yalnız oturum jetonu. **Şifre saklanmaz.**
- Geniş `host_permissions` **istenmiyor**.

## UYAP sayfa yapısı kaydı (keşif) — 07.10.2026

Panelin üstündeki **"UYAP sayfa yapısı"** bölümü, liste okuyucuyu yazabilmemiz
için UYAP sayfalarının **düzenini** kaydeder (tablo mu, iframe mi, sütun
başlıkları ne). Ad, TC no, esas no, tarih, tutar **kaydedilmez**: değerler
cihazdan çıkmadan ‹ESAS_NO›, ‹BUYUK_METIN:12› gibi kalıplara çevrilir.
Yalnız bilinen arayüz sözcükleri ("Esas No", "Davacı") olduğu gibi kalır.
Form alanlarının içeriği hiç okunmaz. Kayıt yalnız bu tarayıcıda durur;
"İndir" ile JSON dosyası alınır, gönderilmeden önce açılıp okunabilir.

Avukattan istenen (yaklaşık 5 dakika):
1. Eklentiyi aşağıdaki gibi kurun, UYAP Avukat Portal'a kendi e-imzanızla girin.
2. Şu sayfaların her birinde **"Bu sayfanın yapısını kaydet"**e basın:
   dosya sorgulama sonuç listesi · bir dosyanın detayı · taraflar · safahat ·
   evrak listesi · duruşmalar (ajanda) · varsa tebligat listesi.
3. **İndir** → dosyayı açıp göz atın → gönderin.

## Kurulum

1. `chrome://extensions` → **Geliştirici modu** açık
2. **Paketlenmemiş öğe yükle** → bu `extension/` klasörünü seçin
3. Araç çubuğunda simgeye tıklayın → panel açılır

## Gereklilik

Panel `https://vekilpro.app/app/` adresini açar.
Bu adresin yayında olması için **dalın `main`'e birleştirilmiş** olması gerekir
(GitHub Pages `main` dalının `docs/` klasöründen yayın yapıyor).

## Bilinen sınırlar

- Web sürümünde **bildirimler ve biyometrik kilit** çalışmaz (bunlar mobil
  özellikleri). Dosya, ajanda, içtihat ve hesaplayıcılar çalışır.
- Mağazaya yayınlanmadı; geliştirici modunda yüklenir.
