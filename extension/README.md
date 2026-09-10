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

## Kurulum

1. `chrome://extensions` → **Geliştirici modu** açık
2. **Paketlenmemiş öğe yükle** → bu `extension/` klasörünü seçin
3. Araç çubuğunda simgeye tıklayın → panel açılır

## Gereklilik

Panel `https://mustafayalvac244-tech.github.io/macro_ko/app/` adresini açar.
Bu adresin yayında olması için **dalın `main`'e birleştirilmiş** olması gerekir
(GitHub Pages `main` dalının `docs/` klasöründen yayın yapıyor).

## Bilinen sınırlar

- Web sürümünde **bildirimler ve biyometrik kilit** çalışmaz (bunlar mobil
  özellikleri). Dosya, ajanda, içtihat ve hesaplayıcılar çalışır.
- Mağazaya yayınlanmadı; geliştirici modunda yüklenir.
