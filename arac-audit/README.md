# Araç Audit — QA denetim kayıt ve raporlama

Elle doldurulan denetim listelerinin yerine geçen, **tarayıcıda çalışan, çevrimdışı**
bir uygulama. Şasi numarası okutulur, 3B model üzerinde hatanın olduğu parçaya
dokunulur, hata tipi listeden seçilir, isterseniz fotoğraf çekilir — ve Excel
raporu, **fotoğraflar hatanın yanına gömülmüş hâlde** tek dokunuşla iner.

> Bu klasör Vekil Pro'dan tamamen bağımsızdır. `src/`, `app/` veya `supabase/`
> altındaki hiçbir dosyaya dokunmaz, hiçbir ortak bağımlılığı yoktur.

---

## Çalıştırma

Üç yol var; hiçbiri kurulum gerektirmez.

| Yol | Nasıl | Ne zaman |
|---|---|---|
| **Tek dosya** | `arac-audit/tek-dosya/arac-audit.html` dosyasını tablete kopyalayıp açın | En hızlısı. USB, e-posta, WhatsApp — sunucu yok, internet yok. |
| **Yerel sunucu** | Klasörde `python3 -m http.server 8000`, sonra `http://<bilgisayar-ip>:8000` | Aynı ağdaki birden çok tablet aynı sürümü kullanır. |
| **Yayında** | Klasörü herhangi bir statik sunucuya koyun | Telefona "uygulama olarak ekle" ile kurulur, çevrimdışı çalışır. |

Tek dosya sürümünü yeniden üretmek için:

```bash
node arac-audit/derle.mjs
```

**Kamera notu:** barkod okuma ve fotoğraf çekme için tarayıcının kameraya
erişmesi gerekir. Tarayıcılar bunu yalnız `https://` ya da `localhost`
üzerinde verir. Tek dosya sürümünde (`file://`) galeriden fotoğraf seçilebilir
ama kamera açılmaz — sahada kamera kullanacaksanız yerel sunucu ya da
HTTPS yolunu seçin.

---

## Akış

1. **Yeni Denetim** → araç (IONIQ 3 / i20 / BAYON), şasi numarası, plaka (varsa).
   - Şasi 17 hane olarak doğrulanır: yasak harfler (I, O, Q), ISO 3779 kontrol
     hanesi, model yılı. Kontrol hanesi tutmazsa **uyarır, engellemez** — Avrupa
     üretimi araçlarda bu hane kontrol hanesi olmayabilir.
   - Barkod okutma Chrome/Android'de çalışır; okunan metin 17 haneye göre süzülür.
2. **Denetim ekranı** → 3B modelde parçaya dokunun, ya da "Listeden seç" ile arayın.
3. **Hata sayfası** → hata tipi (yalnız o parçada anlamlı olanlar listelenir),
   şiddet, adet, konum, açıklama, fotoğraf. **Kaydet.**
4. **Excel / CSV / Rapor** → alt çubuktan. Excel'de her fotoğraf, ait olduğu
   hatanın satırında "Fotoğraf" sütununda durur.

Bir hatayı kaydetmek en fazla üç dokunuştur: *parça → hata tipi → Kaydet.*
En sık kullandığınız parça+hata ikilileri "Hızlı seçim" şeridinde tek dokunuşa
iner; bu şerit **kullandıkça kendi kendine sıralanır** (sayaç cihazda tutulur).

---

## Kendi Excel şablonunuza uyarlama

Excel'in sütun düzeni **tek bir yerden** gelir: `js/rapor.js` içindeki `SUTUNLAR`
dizisi. Şablonunuzu gönderdiğinizde değişecek yer yalnızca burasıdır.

```js
export const SUTUNLAR = [
  { anahtar: 'sira',  baslik: '#',         genislik: 5,  stil: STIL.SAYI,  deger: (h, i) => i + 1 },
  { anahtar: 'parca', baslik: 'Parça',     genislik: 26, stil: STIL.GOVDE, deger: (h) => PARCA_INDEKS[h.parcaId]?.ad },
  { anahtar: 'foto',  baslik: 'Fotoğraf',  genislik: 24, fotograf: true,   deger: () => '' },
  // ...
];
```

- **Sıra** = Excel'deki sütun sırası. Diziyi yeniden sıralamak yeter.
- **`baslik` / `baslikEn`** = başlık metni (rapor dili ayarlardan seçilir).
- **`genislik`** = sütun genişliği (Excel karakter birimi).
- **`deger(hata, sıra, {dil})`** = hücreye yazılacak değer.
- **`fotograf: true`** = fotoğrafların gömüleceği sütun. **Tam olarak bir sütunda**
  bulunmalıdır; satır yüksekliği ve sütun genişliği fotoğrafa göre otomatik ayarlanır.
- **`stilSecici(hata)`** = koşullu biçim (şiddet sütunu böyle renkleniyor).

Üst bilgi bloğunu (Rapor No, Şasi, Plaka, Denetçi, Hat, Vardiya, Sonuç…)
değiştirmek için aynı dosyadaki `ustBilgiCiftleri` işlevi yeterlidir.

Bir sütun ekleyip `tests/aracAuditRapor.test.ts` testini koşarsanız, başlığın
gerçekten dosyaya yazıldığı ve fotoğrafın doğru sütunda kaldığı sınanır.

---

## Hata kataloğu

`js/katalog.js` üç katmanlıdır:

```
BÖLGE            →  PARÇA                →  HATA TİPİ
Dış · Sol yan       Arka kapı               Gıcırtı        = Rear door squeak noise
İç · Tavan          Sol A direği garnişi    Göçük          = A pillar garnish dent
```

Bugün **14 bölge, 166 parça, 53 hata tipi** var. Her parça yalnız kendisinde
anlamlı olan hata gruplarını gösterir; "multimedya ekranı" için "boya akıntısı"
hiç listelenmez.

Yeni parça eklemek: ilgili bölgenin `parcalar` dizisine bir satır. `cift: true`
yazarsanız otomatik olarak sol/sağ diye ikiye açılır. 3B modelde tıklanabilir
olmasını istiyorsanız `mesh` alanını `model3d.js`'teki yüzey kimliğiyle aynı
yapın — testler bu bağı iki yönlü denetler.

---

## Ceza puanı ve karar eşikleri — okumadan kullanmayın

Şiddet sınıfları (A/B/C), puan ağırlıkları (10/5/1) ve karar eşikleri
(şartlı 15, red 40) **örnek başlangıç değerleridir. Hiçbir üreticinin resmî
audit standardından ölçülmemiştir.** Ayarlar ekranından değiştirilebilir.

Kendi standardınızın sayılarını girene kadar bu puanı yalnız **kendi
denetimlerinizi birbiriyle kıyaslamak** için kullanın; mutlak bir kalite
ölçütü olarak raporlamayın.

---

## 3B modeller hakkında dürüst not

Modeller **üreticinin CAD verisi değildir.** Aracın dış ölçülerinden
(uzunluk/genişlik/yükseklik/dingil mesafesi) türetilmiş şematik gövdelerdir.
Amaç güzel bir görüntü değil, denetçinin "sol arka kapı" yazmak yerine oraya
dokunabilmesidir.

| Araç | Ölçü kaynağı |
|---|---|
| i20, BAYON | Kamuya açık teknik veriden **yaklaşık** alındı, üretici belgesinden doğrulanmadı. |
| IONIQ 3 | **Yer tutucu.** Araç piyasada yok; ölçüler hiçbir kaynaktan ölçülmedi. |

Uygulama bunu gizlemez: ölçüsü doğrulanmamış araçlarda araç kartında
"ölçü doğrulanmadı" rozeti ve denetim ekranında uyarı çıkar.

**Fotoğraf/teknik veri gönderirseniz** `js/model3d.js → ARACLAR` içindeki
`ustHat`, `belY`, `esikY` ve `kapiX` değerleri güncellenir.
`model-onizleme.html` sayfası üç aracın altı bakışını yan yana gösterir;
oran bozukluğu oradan tek bakışta görülür.

Modelde bilerek yapılmayanlar: tekerlek davlumbazı kesikleri, kapı kolları,
çıta detayları, gerçek yüzey eğrilikleri. Bunlar parça seçimini etkilemez.

---

## Veri nerede duruyor

Her şey **cihazın kendi deposunda** (IndexedDB). Sunucuya hiçbir şey gitmez.

- Denetim kapsama alanı olmayan bir hatta da kesintisiz sürer.
- Fotoğraflar kaydedilirken uzun kenarı 1600 piksele küçültülür (telefon
  kamerası 4000×3000 üretir; 30 hatalı bir denetimde bu 150 MB'lık bir Excel
  demektir).
- **Tarayıcı verisini silmek denetimleri siler.** Ayarlar → "Yedek al" ile
  fotoğraflar dahil tek JSON dosyasına alın; başka cihazda "Yedek yükle" ile
  geri gelir.
- Ayarlar ekranı kullanılan depolama alanını gösterir.

---

## Dosya düzeni

```
arac-audit/
  index.html               uygulama kabuğu
  model-onizleme.html      geliştirme aracı: modelleri yan yana görmek için
  derle.mjs                tek dosya üretici
  sw.js                    çevrimdışı önbellek
  css/stil.css
  js/
    katalog.js    bölge / parça / hata tipi tanımları        ← en sık düzenlenen
    rapor.js      Excel + CSV + yazdırılabilir rapor         ← şablon uyarlaması burada
    model3d.js    araç ölçüleri + 3B motor (bağımlılıksız)
    vin.js        şasi ve plaka doğrulama
    puan.js       ceza puanı, özet, KABUL/ŞARTLI/RED kararı
    depo.js       IndexedDB (denetim, fotoğraf, ayar, sayaç)
    xlsx.js       XLSX yazıcı (gömülü görsel dahil)
    zip.js        ZIP yazıcı + CRC32
    goruntu.js    görüntü ölçüsü okuma + küçültme
    uygulama.js   ekranlar ve akış
  tek-dosya/arac-audit.html   derlenmiş tek dosya sürüm
```

Dış kütüphane **yoktur** — three.js yok, SheetJS yok, çerçeve yok. Neden:
fabrika ağında CDN'e erişim garanti değil ve bir denetim aracının
"bugün açılmıyor" deme lüksü yok.

---

## Testler

```bash
npm test                              # depodaki tüm testler
npx vitest run tests/aracAudit*.test.ts   # yalnız bu uygulamanınkiler
```

55 test üç dosyada:

- `tests/aracAuditVin.test.ts` — şasi normalize/doğrulama, kontrol hanesi, plaka.
- `tests/aracAuditKatalog.test.ts` — katalog bütünlüğü ve **3B model ↔ katalog
  bağı** (bu kırılırsa modele dokunmak hata kaydedemez).
- `tests/aracAuditRapor.test.ts` — ZIP/XLSX yapısı, fotoğrafın doğru hücrede
  gömülmesi, XML kaçırma, CSV, puanlama.

### Neyin sınandığı, neyin sınanmadığı

| Ne | Durum |
|---|---|
| Uçtan uca akış (Chromium) | **Koşuldu**: yeni denetim → 3B dokunma → fotoğraf → kayıt → Excel indirme → rapor. |
| Üretilen .xlsx'in yapısı | **Doğrulandı**: `unzip -t` (CRC) ve `openpyxl` gömülü fotoğrafı doğru hücrede okudu. |
| **Gerçek Microsoft Excel'de açılması** | **DOĞRULANMADI.** Bu ortamda LibreOffice çalışmıyor (bilinen-iyi bir dosyayı da açamadı), Excel yok. İlk yapılacak iş: dosyayı kendi Excel'inizde açıp fotoğrafların yerinde olduğunu görmek. |
| iOS Safari / Android Chrome | **DENENMEDİ.** Yalnız masaüstü Chromium'da koşuldu. |
| Barkod okuma | **DENENMEDİ** — `BarcodeDetector` yalnız gerçek kamerayla sınanabilir. Desteklenmeyen tarayıcıda uygulama elle girişe düşer. |
