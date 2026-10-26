# Araç Audit — tablet uygulaması

QA denetimi için **Android/iOS tablet uygulaması** (Expo SDK 57 · React Native).
Şasi okut, araç modelini seç, **parçaya dokun → hataya dokun → kaydedildi.**
Fotoğraf Excel'in içine gömülü çıkar. Her kayıt önce cihaza yazılır — hat
kapsama alanı dışındayken de çalışır.

> Bu klasör **Vekil Pro'dan tamamen bağımsızdır**: kendi `package.json`'ı, kendi
> `app.json`'ı, kendi `node_modules`'ı var. Kökteki `tsconfig.json` bu klasörü
> hariç tutar, yani Vekil Pro'nun CI'ı bu koddan etkilenmez. Olgunlaştığında
> kendi deposuna taşımak `git mv` kadar kolay olmalı — o yüzden hiçbir şey
> `../src` altından içe aktarılmaz.

## Çalıştırma

```bash
cd arac-audit-app
npm install
npm start          # Expo geliştirme sunucusu
npm run web        # tarayıcıda
npm run kontrol    # tip denetimi
```

Tablette çalıştırmak için bir **geliştirme derlemesi** (development build)
gerekir; `expo-camera`, `expo-sqlite` gibi yerel modüller Expo Go içinde
çalışmaz.

```bash
npx eas build --profile development --platform android
```

## Telefona kurma ve güncelleme

**Kurma (APK).** `.github/workflows/arac-audit-apk.yml` uygulama her
değiştiğinde GitHub'ın makinesinde APK derler (≈18 dk, Expo hesabı gerekmez).
**Doğrudan bağlantı (24.10.2026):** derleme OTA denetiminden geçince APK
tek commit'lik `apk` dalına zorla itilir; sabit adres
`https://github.com/mustafayalvac244-tech/macro_ko/raw/apk/arac-audit.apk`
girişsiz, zip'siz indirir. (Önceki yol — koşu sayfasındaki `arac-audit-apk`
zip eki — GitHub girişi istiyordu; ürün sahibi telefondan açamadı.) Depo
herkese açık; APK'da anahtar yok (`.env.example` dışında ortam dosyası yok,
kodda sunucu adresi/anahtar yok — 24.10.2026'da tarandı).

**Güncelleme (OTA, 28.09.2026'dan).** Ürün sahibi: "OTA ile güncelleme at."
`.github/workflows/arac-audit-ota.yml`, uygulama değişip bu dala push edilince
JavaScript paketini Expo'nun güncelleme sunucusuna (EAS Update) yayımlar.
Telefon her açılışta denetler ve **arka planda** indirir; açılış beklemez
(fabrikada bağlantı zayıf olabilir). İnince ana sayfada "Yeni sürüm hazır ·
kayıtlar silinmez" şeridi çıkar; "Yeniden başlat"a basılmazsa bir sonraki
açılışta kendiliğinden devreye girer. Hangi paketin çalıştığı **Ayarlar →
Sürüm**'de yazar ("Güncelleme 1a2b3c4d · tarih"); iş akışı özetindeki Android
güncelleme kimliğiyle karşılaştırılınca indiği görülür.

- **Bir kez yeni APK gerekir.** 0.2.0'dan önceki APK'larda güncelleme modülü
  (`expo-updates`) yok; onlar OTA alamaz.
- **İlk yayın 0.2.0 APK'ya inmez — beklenen.** Telefon yalnız çalışan
  paketten **daha yeni** bir güncellemeye geçer (`expo-updates` 57.0.23,
  `LoaderSelectionPolicyFilterAware.kt`: `commitTime` karşılaştırması). APK'nın
  içindeki paketin zamanı derleme anıdır (`createManifestForBuildAsync.js`:
  `commitTime: new Date()`). İlk OTA (koşu 36408770278) başarılı APK
  derlemesinden (koşu 36410058049) **önce** yayımlandı; bu yüzden o APK'da
  Sürüm "APK ile gelen paket", "Güncellemeleri denetle" "Güncel" der. İkisi
  aynı kod, kayıp yok. Telefona inecek ilk güncelleme APK'dan sonraki ilk
  yayındır. Bu, kaynak koddan ve koşu sırasından çıkarım; **telefonda
  görülmedi.**
- **Derleme belleği.** 0.2.0'ın ilk derlemesi (koşu 36408769922) kod hatasıyla
  değil bellekle düştü: `expo-updates` altı Android modülü ekledi ve yayın
  öncesi lint analizleri Gradle'ın 512 MiB metaspace sınırına sığmadı
  (`OutOfMemoryError: Metaspace`). APK iş akışı artık Gradle'a 4 GiB heap ve
  1,5 GiB metaspace veriyor.
- **OTA yerel kodu değiştiremez:** yeni kütüphane, izin, ikon, paket adı.
  Bunlarda `app.json → version` yükseltilir ve yeni APK kurulur. Çalışma zamanı
  politikası `appVersion`: güncelleme yalnız aynı sürümdeki APK'lara iner.
- **Bekçi.** `package.json`, `package-lock.json` ya da `app.json` değişip sürüm
  aynı kaldıysa iş akışı yayımlamaz — eski APK'da olmayan bir yerel modülü
  çağıran JS oraya inip uygulamayı çökertebilirdi.
- **Hesap.** Güncellemeler Vekil Pro'nun Expo hesabında (olivyeejiru) **ayrı
  bir projede** (`@olivyeejiru/arac-audit`) durur; kimliği, kanalı ve
  güncellemeleri Vekil Pro'nunkilerle kesişmez. 27.09'da APK için bu hesap
  bilerek kullanılmamıştı (gradle hesapsız derliyor); OTA hesapsız olmuyor.
- **Neyin doğrulandığı.** `expo-updates` 57.0.23'ün ayar kodu ve `eas-cli`
  24.8.0'ın kaynağı okundu (docs.expo.dev bu ortamdan erişilemedi). Geçici bir
  kopyada `expo prebuild` ile üretilen AndroidManifest'te güncelleme adresi,
  kanal başlığı ve çalışma zamanı (0.2.0) görüldü; APK iş akışı derlenen
  APK'nın **içinde** bu üçünü ayrıca denetliyor. **Telefona gerçekten indiği
  henüz görülmedi.**

## Dosya düzeni

```
app/                    ekranlar (expo-router: dosya = rota)
  _layout.tsx           yazı tipleri, tema, gezinme
  index.tsx             denetim listesi
  yeni.tsx              yeni denetim (araç + şasi)
  barkod.tsx            şasi barkodu okuma
  ayarlar.tsx           tema, ekibin eklediği hata tipleri, veri durumu
  denetim/[id].tsx      ÇALIŞMA EKRANI — hızlı giriş; tablette iki bölme
  denetim/rapor.tsx     rapor, Excel/CSV paylaşımı
src/
  tema/                 token'lar, iki palet, TemaSaglayici
  bilesenler/           paylaşılan arayüz — yeni bileşen yazmadan önce buraya bak
    temel.tsx           Baslik, BaslikDugmesi, Dugme, Secenek, AramaKutusu, Olcu, AltCubuk…
    simgeler.ts         TEK simge kaynağı (lucide) — ekranlar simgeyi buradan alır
  cekirdek/             ALAN MANTIĞI: katalog, VIN, derece/özet, XLSX motoru
  veri/depo.ts          SQLite — senkrona hazır normalize şema
```

## Tasarım kuralları

- **Renk temadan gelir.** Bileşende çıplak hex yazma — iki temanın birinde
  sessizce okunmaz olur. `const { renkler } = useTema()`.
- **Stiller `makeStyles` kalıbıyla**: `const s = useMemo(() => stiller(renkler), [renkler])`.
  Sabit `StyleSheet.create` tema değişince donar.
- **Boşluk/köşe skalası dışına çıkma.** `padding: 14` yerine 12 ya da 16.
- **`tipografi.*` bir stil nesnesidir**, sayı değil: `{ ...tipografi.h3, color: ... }`.
- **Dokunma hedefi en az 48 px** (`DOKUNMA`). Eldivenli parmak için.
- **Üç durumu da ele al**: yükleniyor · boş · hata.
- **Bilgiyi yalnız renkle verme.** Derece rozeti hem renk hem rakam taşır;
  seçili seçenek tik simgesi, açık anahtar topuzun yeri ile de ayrılır.
- **Aynı anda tek alt sayfa.** `AltSayfa` kabuğu bir tanedir, içeriği değişir —
  iki `Modal` üst üste açıldığında kapanan modal DOM'da asılı kalıp alttakini
  engelliyor (15.09.2026'da ölçüldü).
- Yeni yerel bağımlılık eklemeden önce **sor**: her biri OTA ile gidemeyecek
  yeni bir derleme demek. (`lucide-react-native` yerel DEĞİL: zaten kurulu
  `react-native-svg` üstünde saf JavaScript; yeni derleme gerektirmez.)

### Görsel yenileme — Vekil Pro dili (25.10.2026)

Üç deneme oldu. 24.10'da ürün sahibi *"görsel olarak çok kötü, dandik,
profesyonel yap"* dedi; koyu lacivert çubuk, 4/6/8/12 köşe, gölgesiz düz
kartlar ve büyük harfli etiketler yaptım. Ertesi gün: *"arayüz beğenmedim …
yazı tipi falan kötü duruyor."* İki yenilemeyi de kendi zevkime göre
yapmıştım; bu kez tahmin yerine **ürün sahibinin zaten onayladığı tek tasarım
dili** alındı: Vekil Pro'nun `src/theme/tokens.ts` + `palettes.ts` ("Klasik"
palet) dosyaları. Değişenler (hepsi `src/tema/` ve `bilesenler/temel.tsx`):

- **Başlık sayfa zemininde**, koyu çubuk yok; düğmeler beyaz yüzey + ince
  kenar, birincil olan lacivert dolgulu. Durum çubuğu simgeleri temaya göre.
  Koyu lacivert yalnız **yüzen katmanlarda** kaldı (kayıt bildirimi, barkod
  çerçevesi) — tokenlar `ters*` adını aldı.
- **Renkler** Vekil Pro Klasik: zemin `#EEF2F8`, vurgu `#173C7E`, çizgi
  `#CFD9EA`. Soluk metin Vekil'den koyu (`#56657F`): oradaki `#828EA6` 13 px
  yazıda 3,3:1 kalıyor; burada 5 açık yüzeyin hepsinde ≥ 4,68:1 ölçüldü.
- **Köşeler** 8/12/16/20 (Vekil `radius`), kartlar beyaz + yumuşak gölge
  (`0 4 12`, %8 lacivert — Vekil `shadow.card`) + soluk kenar.
- **Etiketler normal yazımla**: "DENETLENEN ARAÇ" → "Denetlenen araç",
  "BODY NO" → "Body no". Bölüm başlıkları 16 px yarı kalın, sol vurgu çizgisi
  kalktı. Büyük harf + geniş aralık ekranı panel/terminal gibi gösteriyordu.
- **Sadeleştirme:** ana sayfadaki koyu "Yeni denetim başlat" kartı tek büyük
  düğmeye indi; sayacın altındaki açıklama cümlesi, şasi kutusunun mavi bilgi
  kutusu (küçük ipucu satırı oldu) ve haritanın altındaki not kaldırıldı;
  kök adımdaki tek kırıntı ("Sistemler") gizlendi. Süzgeç çipleri hap biçimli
  ve küçük (`Secenek kucuk`), telefonda tek satıra sığıyor.

**Ölçülen:** `kontrast.py` iki temada 39'ar çift, hepsi eşiğin üstünde
(ilk ölçümde 2 çift düşüktü, soluk metin koyultuldu). Web paketinde 4
düzende uçtan uca sınav hatasız; 4 × 17 ekran görüntüsüne bakıldı.
**Ölçülmeyen:** gerçek cihaz; ve asıl soru — ürün sahibi bunu beğenecek mi.
Vekil Pro'yu beğendiği bilgisi dolaylı (o ürünü aylardır kullanıyor, bu
dile itiraz etmedi); "beğendi" demek değil.

### Görsel dil (27.09.2026)

- ~~Üstte koyu uygulama çubuğu — iki temada da.~~ **25.10.2026'da kalktı**
  (yukarıdaki bölüm). Başlık hâlâ `Baslik`tır ve **üst güvenli alanı kendisi
  alır**; alt eylem çubuğu `AltCubuk`tur, ev çubuğu payını o alır. (Önceden yeni denetim,
  rapor ve ayarlar ekranları güvenli alanı hiç almıyordu — çentikli cihazda
  başlık durum çubuğunun altında kalırdı.)
- **Simgeler yalnız `simgeler.ts`ten.** Emoji ve `‹ ⤓ ✓ 📷` gibi yazı işaretleri
  kaldırıldı: emoji cihazın yazı tipiyle çizilir, üreticiden üreticiye değişir.
  Simge adları sürümler arasında değişiyor; yeni bir ad eklerken kurulu
  paketin içinde ara (`grep "exports.Ad = " node_modules/lucide-react-native/dist/cjs/lucide-react-native.js`).
- **Tablet düzeni**: `useDuzen().tablet` — kısa kenar ≥ 600 (Android'in
  "sw600dp" tablet eşiği) VE genişlik ≥ 720. Telefon yatay çevrilse de tek
  bölmede kalır. Tablette çalışma ekranı iki bölmedir (solda parçalar hep
  açık); telefonda iki adım.
- **Kontrast ölçülür, göz kararı verilmez** (WCAG formülü, 27.09.2026). Açık
  temada üç renk eşiğin altındaydı ve düzeltildi: `metinSolgun` 3.53 → en az
  4.60:1, derece 2 rozeti 3.93 → 4.63:1, derece 1 rozeti 4.26 → 4.65:1. Yeni
  çubuk: yazı 15.2:1, soluk yazı 5.9:1 (düğme zemininde), vurgu düğmesi
  yazısı 7.6:1. Derece seçici: seçili rakam ve seçili olmayan rakam iki
  temada da en az 5.28:1. `cizgiGuclu` yüzeyde 2.58:1 — denetim öğesinin
  TEK sınırı olarak kullanılmaz (kabul anahtarının kapalı rayı bu yüzden
  `metinSolgun` kenarlı).

### Lumiform'dan esinlenen düzen (25.10.2026)

Ürün sahibi: *"Lumiform'dan esinlen, güzel bir program."* Lumiform'un
sayfaları bu ortamdan açılamadı; yalnız arama özetleri okundu. **Doğrulanan:**
mobil ana ekranda başlanmış ve atanmış formlar ayrı durur; denetimde başarısız
madde anında işaretlenir ve düzeltici aksiyon açılır; puanlama, fotoğraf,
not, çevrimdışı çalışma var; masaüstünde ana bölümler kalıcı bir menüde.
**Doğrulanamayan:** cevap düğmelerinin ve ilerleme çubuğunun görünüşü, renkler.
Aşağıdakiler bu sınıftaki denetim uygulamalarının ortak deseni üzerine benim
uyarlamam; Lumiform'un kopyası değil, renkleri de alınmadı.

- **Alt sekme çubuğu:** Denetimler · Analiz · Ayarlar (`app/(sekmeler)/`).
  `expo-router/js-tabs` saf JavaScript; paket eklenmedi, OTA ile gider.
  Analiz önce sayaç kartındaki bir düğmede, Ayarlar başlıktaki dişlideydi.
- **Denetim ekranı bir kontrol listesi:** üstte "2/5 kontrol edildi" ve
  ilerleme çubuğu; her sistem bir soru kartı, altında iki cevap: **Uygun**
  (hatasız kontrol edildi, yeşil) ve **Hata gir / n hata** (kırmızı). Hatası
  olan sistemde "Uygun" kilitli. Listenin sonunda **Denetimi bitir**: rapor,
  bitirme onayı açık hâlde açılır ve kontrol edilmemiş sistemler sayılır.
  Eski yuvarlak onay kutusu kartın İÇİNDE ikinci bir düğmeydi; Android'de
  ekran okuyucu içteki düğmeye ulaşamazdı. Cevaplar artık kartın kardeşi.
- **Ana sayfa kartı:** devam eden denetimde "Kontrol edilen sistemler 2/5"
  ve ilerleme çubuğu (liste sorgusu kapsam adedini alt sorguyla sayıyor).
- **Rapor:** dört ayrı ölçü kutusu yerine tek özet kartı; altında kontrol
  ilerlemesi. Derece 3 sıfırsa kırmızı görünmez.

**Ölçülen:** web paketinde 16 adımlık uçtan uca sınav 4 düzende hatasız (yeni
adımlar: sekmeler, "Uygun" kilidi, ilerleme değeri 2/5, listeden bitir, rapor
özeti). Sınavı ben yazdım. İlk koşu iki şey yakaladı ve düzeltildi:
react-native-web ilerleme değerini aktarmıyordu (`aria-value*` ile çözüldü);
telefonda sekme etiketinin kutusu 9 piksel kalıyordu (içerik 16). Etiket
ölçümü `sekme-olc.mjs` ile yapıldı; aynı ölçüm, kesik olduğu bilinen bir kutuda
"taşıyor" dedi. Yeni renk yok; kullanılan çiftler önceki kontrast ölçümünde
var. **Ölçülmeyen:** gerçek cihaz ve ürün sahibinin beğenisi.

## Yazı tipi — Manrope (25.10.2026)

Sıra: IBM Plex → (24.10) Inter + JetBrains Mono → (25.10) **Manrope**, tek
aile, 400/500/600/700/800. Ürün sahibi *"yazı tipi falan kötü duruyor"*
deyince ekran görüntülerine yeniden bakıldı: göze batan şey eşit genişlikli
yazıydı — büyük sayılarda çizgili sıfır ("0 derece 3"), şasi kutusunda
terminal görünümü. Manrope, Vekil Pro'nun gövde yazısı; onun onayından
geçmiş tek yazı tipi bu. Şasi/body numarası artık mono değil: `tipografi.kimlik`
harf aralığını açar (VIN standardında I, O, Q zaten yok). Sayı sütunları
`fontVariant: tabular-nums` ile hizalanır. Dosyalar `assets/fonts/` altında
(5 × ~97 KB, Inter+Mono'nun 1,6 MB'ına karşı 0,5 MB), SIL OFL lisansı yanında.

**Neden paket değil, dosya:** `@expo-google-fonts/*` eklemek `package.json`'ı
değiştirir; OTA bekçisi yayını durdurur ve herkes APK'yı yeniden kurmak
zorunda kalırdı. TTF sıradan bir varlık, OTA ile gider. Eski IBM Plex
paketleri `package.json`'da duruyor ama kullanılmıyor; bir sonraki sürüm
yükseltmesinde kaldırılacak.

**Doğrulama** (`scratchpad/sinav/font-kontrol.mjs`, 25.10.2026): web
paketinde Chromium'a yüklenen sayfada `document.fonts` beş Manrope ağırlığını
"loaded" bildirdi, beş TTF isteği 200 döndü, ana başlık `<h1>` gerçekten
`Manrope_700Bold` ile çiziliyor. **Tabular-nums ölçüldü:** `tabular-nums` ile
"1111" ve "0000" aynı genişlikte (99,20 px); özellik kapalıyken 67,5 / 102,7 —
yani Manrope'un rakamları varsayılan olarak orantılı, sütun hizası bu
özelliğe bağlı ve çalışıyor. **Gerçek cihazda görülmedi.**

## 3B model nasıl çalışıyor

Geometri React Native tarafında üretilir (`cekirdek/model3d.ts` — araç ölçüleri
burada, **tek kaynak**), çizim bir WebView içinde olur (`cekirdek/modelWebView.ts`).
Neden: React Native'de `<canvas>` yok; Skia yeni bir yerel bağımlılık, SVG ise
140 yüzeyi her karede güncellemekte tutuk. Web'de aynı çizici `<iframe>` içinde
koşar (`bilesenler/ModelTuvali.web.tsx`).

**Modeller CAD değildir.** Dış ölçülerden türetilmiş şematik gövdelerdir; amaç
"sol arka kapı" yazmak yerine oraya dokunabilmek. Üç aracın da boy/en/yükseklik
/dingil değeri kamuya açık teknik veriden *yaklaşık* alındı, **üçü de üretici
belgesinden doğrulanmadı** — uygulama bunu araç kartında rozetle ve denetim
ekranında uyarıyla gösterir. Ön/arka sarkma hiçbirinde yayımlanmıyor, boy ile
dingilden türetildi: ölçüm değil, tahmin.

IONIQ 3 15.09.2026'ya kadar tamamen **yer tutucuydu** (hiçbir kaynaktan
gelmeyen, "dik burunlu crossover" oranlı bir gövde). Araç 20.04.2026'da
tanıtıldığı için artık gerçek lansman verisi kullanılıyor: 4155×1800×1505 mm,
dingil 2680 mm, "Aero Hatch" silüeti (alçak burun, her iki sıra boyunca düz
tavan, arka spoyler'a inen bagaj). Bu bir *doğrulama* değil, kaynaksızdan
kamuya açık kaynağa geçiştir — i20/BAYON ile aynı seviye.

### Araç silüeti — kaldırıldı (25.10.2026)

`bilesenler/AracIkonu.tsx` araç kartlarında `model3d.ts`teki `ustHat`ten
türetilmiş bir silüet çiziyordu; altında "Elektrikli / İçten yanmalı" etiketi
vardı. Ürün sahibi: *"Araç tipleri çok dandik, araç tipi koyma, isim yeter."*
İkon ve etiket yeni denetim formundan ve ana sayfa kartından çıktı, dosya
silindi; araç seçimi artık Bilgiler sayfasındaki gibi yalnız adla (`Secenek`).
Araç tipi (`tip: 'ev' | 'ice'`) veri modelinde duruyor — parça listesi hâlâ
ona göre seçilir, yalnız ekranda yazmıyor.

### Döndürülebilir araç (360°) — 26.10.2026

Ürün sahibi: *"Hyundai sitelerinde aracı döndürebiliyoruz; araç üstünden parça
seçmek için ekleyebilir miyiz?"* Görsel kaynağı olarak Hyundai'nin **resmî**
görsellerini seçti. Elindekiler sitedeki gibi 24–36 karelik bir dizi değil,
**standart bakışlar** (önden, sol önden, soldan …, üstten). Sonra: *"sol ön
garnişe tıklayınca o parça seçilsin."*

- **Dokuz bakış yuvası:** Ön, Sol ön, Sol yan, Sol arka, Arka, Sağ arka, Sağ
  yan, Sağ ön, Üstten. Ayarlar → *Araç görselleri (360°)*: her yuvaya
  galeriden tek görsel seçilir, değiştirilir, temizlenir. Açılar sabit (0, 45 …
  315). İlk tasarımdaki çok kareli içe aktarma ile ön kare / yön / kırpma ayarı
  **çıkarıldı**: standart bakışta açı adından belli, ayarlanacak bir şey yok.
- **Görseller depoya ve APK'ya girmez.** İkisi de herkese açık. Seçilen görsel
  küçültülüp (en çok 1600 px) uygulamanın klasörüne kopyalanır, yalnız o
  telefonda durur; tam yedeğe de girmez (`veri/aracGorselleri.ts`).
- **Ayna:** eksik bir yan yuva karşı yanın yatay aynasıyla doldurulur, ekranda
  *"aynalanmış görünüm"* yazar. Yalnız sol/sağ çiftleri arasında; ön, arka ve
  üst uydurulmaz. Araç tam simetrik değil (şarj kapağı vb.).
- **Döndürme:** parmak yana kaydıkça ya da ◀ ▶ ile sıradaki dolu (ya da
  aynalanmış) bakış; *Üstten* ayrı düğme. Uygulama açıldığında sol önden
  başlar, sonra araç başına son bakışta kalır (telefonda parça açılıp
  dönülünce de).
- **Dokunuş → parça:** bakışın **parça haritası** varsa
  (`cekirdek/gorunumParcalari.ts` → `PARCA_HARITALARI`: görsele göre
  normalize çokgenler) ve görselin en/boy oranı haritanınkiyle **%2 içinde**
  uyuyorsa dokunulan parçanın **hata ızgarası** açılır — listeden seçmekle
  aynı. İç içe çokgenlerde küçük olan kazanır (kapının üstündeki ayna);
  katalogda olmayan kimlik yok sayılır; çokgen dışına dokunuş yalnız *"Bir
  parçaya dokunun"* der, tahmin yok. Aynalanan bakış kaynağın haritasının
  aynasını kullanır (`sol_` ↔ `sag_`). Kaydı olan parçalar görselin üstünde
  hafif boyanır; tablette seçili parça vurgulu, adı altta yazar.
- **Harita yoksa ya da oran uymuyorsa → bölge:** araç en/boy ölçüsünden bir
  kutu sayılıp görünen yüzler yatay eksene yerleştirilir; dokunulan yüzün dış
  bölgesi açılır, parça listeden seçilir. **Yaklaşık:** köşe bakışlarında
  gerçek görselde ön/yan sınırı kutudan farklı düşer (ürün sahibinin sol ön
  görselinde ön, enin ~%43'ü; kutu %30 diyor). Tavan yalnız Üstten bakışta.
- **`PARCA_HARITALARI` bugün BOŞ.** Çokgen verisi ayrı hazırlanıyor; gelene
  kadar her bakış bölge düzeyinde çalışır. Ayarlar her yuvada durumu yazar:
  *parça haritası yok / uyuyor / oran uymuyor*.
- Görsel yokken ekran eskisi gibi şematik haritayı gösterir. Erişilebilirlik:
  görüntü ekran okuyucuya kapalı (çokgenler öğe değil); ◀ ▶ ve Üstten adlı,
  sistem listesi her zaman altında.
- **Sınav kancası:** `EXPO_PUBLIC_GORUNUM_HARITASI_SINAV` (JSON) yalnız uçtan
  uca sınavın web derlemesinde verilir ve o aracın haritalarının yerine geçer.
  APK/OTA derlemesinde tanımsız; olağan web derlemesinde sınav haritasından
  iz olmadığı derlenmiş dosyada arandı (yok).

**Doğrulanan** (beklentileri, sınav haritasını ve sentetik görselleri ben
yazdım; bağımsız bir sınav değil):
- Birim testleri: `tests/aracAuditGorunumParcalari.test.ts` (9) ve
  `tests/aracAuditDonus.test.ts` (11). Beş koruma tek tek bilerek bozuldu (en
  küçük çokgen, ayna taraf çevirisi, bilinmeyen parça eleme, %2 oran payı,
  kenar boşluğu); her birinde en az bir test düştü.
- Web'de telefon ve tablette 10 adımlık uçtan uca sınav, **sentetik** görsel ve
  **sentetik** haritayla: yuva seç / değiştir / temizle; 4:3 görselde *oran
  uymuyor*; tampona dokunuş → Ön tampon ızgarası, kayıttan sonra tampon boyalı;
  çokgen dışı → yalnız ipucu; kaydırma; ayna kapıyı yener, bilinmeyen çokgen
  arka kapıyı gölgelemez; aynalanmış Sağ ön / Sağ yan'da tampon sağda, sağ ön
  kapı ve sağ ayna; haritasız Ön → bölge; Üstten → tavan; oran uymayan görselde
  kenar boşluğu dokunuşu boş, görsele dokunuş bölge; İngilizce yazılar. Aynalı
  haritayı bilerek kapatınca sınav o adımda düştü.
- Ürün sahibinin **gerçek** görselleriyle (sağ yan eksik) yalnız web'de bir
  gözlem koşusu: sekiz bakış sırayla döndü, Sağ yan aynalandı, Sol ön'de
  solda ön / sağda yan bölgesi açıldı. Harita olmadığı için yüz düzeyi.
  Görseller dosya seçiciyle tarayıcıya verildi; depoya, pakete girmedi.

**Doğrulanmayan:** gerçek parça haritası yok — parça düzeyindeki dokunuş yalnız
sentetik görsel + sentetik haritayla görüldü. **Telefonda hiç görülmedi**
(galeri izni, dosya kopyalama, parmakla kaydırma ve dokunuş).

## Hata listesi kodda bitmiyor — ekip kendi tipini ekler

Sahada sürekli yeni ve çok spesifik hata çıkıyor. Her yeni hata için sürüm
beklemek denetimi durdurur: denetçi ya en yakın tipi seçip veriyi bozar ya da
hiç kaydetmez. Bu yüzden hata tipi listesi **çalışma anında genişletilebilir**.

Akış hata kaydı ekranındadır, ayrı bir yönetim ekranına gitmek gerekmez:
denetçi arama kutusuna gördüğü hatayı yazar; listede yoksa kutu
*"… adıyla yeni hata tipi ekle"* düğmesine dönüşür, ad ön dolu gelir, grup ve
şiddet seçilir, tip eklenir **ve o anda seçili hâle gelir**.

Kurallar ve gerekçeleri:

- **Yerleşik liste (`cekirdek/katalog.ts`) değiştirilmez**, özel tipler onun
  üstüne bindirilir. Böylece bir sonraki sürümde yerleşik listeyi güncellemek
  ekibin kendi eklediklerini silmez.
- **Grup seçimi parçanın izin verdiği gruplarla sınırlıdır.** Aksi hâlde
  denetçi "cam" grubuna tip ekler, kapı sacında arar, bulamaz.
- **Kaldırma gerçek silme değildir.** Eski hatalar `hata_tipi_id` ile o kayda
  bağlı; satır silinse geçmiş raporlarda hata adı yerine `ht_m4x9k2` yazardı.
  Kaldırılan tip seçim listesinden çıkar, indekste kalır.
- **Katalog indeksi yerinde güncellenir, yeniden atanmaz.** `rapor.ts` ve
  `puan.ts` indeksi içe aktarma anında yakalıyor; yeni nesne atansa o iki modül
  eski referansla çalışır ve özel tipli hata Excel'de ham kimlik olarak çıkar.

Bu davranışların bozulması SESSİZDİR — uygulama çalışmaya devam eder, hata
ancak raporu açan kişi tarafından günler sonra fark edilir. O yüzden
`tests/aracAuditOzelHataTipi.test.ts` hepsini tek tek sınar (Excel sütunlarının
adı ve grubu çözmesi dahil).

> Kök `tsconfig.json` bu test dosyasını hariç tutar. Gerekçe: dosya
> `arac-audit-app`'e import ediyor, kök `tsc` zinciri takip edip
> `expo-image-manipulator`a varıyor ve CI'da o paket kurulu olmadığı için
> düşüyor (15.09.2026'da node_modules geçici kaldırılarak ölçüldü). Vitest
> bu listeye bakmaz, test koşmaya devam eder.

### Katalog ekibin Excel'ine uyarlandı (26.10.2026)

Ürün sahibi ekibin kullandığı Excel'i gönderdi. Problem kayıtları sayıldı;
**sayılar şirket verisi olduğu için bu depoya yazılmadı**, ürün sahibine
sohbette verildi. Sonuç ve yapılan:

- En sık kullanılan tiplerden **8'inin karşılığı yoktu**; eklendi: temas
  (Touching), çakışma (Interference), dalgalanma (Wave), çöküntü izi (Sink
  mark), sarkma (Sagging), kaynak izi (Welding mark), kalıp izi (Mould mark),
  yapışma zayıf (Poor sticky).
- En sık problemler **boşluk ve kademe**, ve ekip yönünü yazıyor. Uygulamada
  tek "boşluk farkı" ve tek "kademe farkı" vardı; fazla ile dar zıt kök
  nedenlerdir. Ayrıldı: boşluk fazla / dar / düzensiz, kademe dışarıda /
  içeride. Genel olanlar eski kayıtlar için duruyor.
- Birebir karşılığı olan tiplerin **İngilizce adı ekibin terimine** çekildi
  ("Dent" → "Dent mark", "Squeak" → "Squeak noise", "Misaligned" →
  "Mismatching"…): Excel çıktısı ekibin geçmiş kayıtlarıyla aynı kelimeyi
  kullanıyor.
- Dış panellerde ızgarada **önce montaj grubu** geliyor; ekibin dış sistem
  kayıtlarında montaj tipi problemler belirgin biçimde daha sık.

Tip kimlikleri değişmedi; eski kayıtlar aynen okunur. Excel tipi ile
uygulama tipi arasındaki eşleme benim yargım, ölçüm değil; sayımlar ise
Excel'den. `tests/aracAuditKatalogEkip.test.ts` uyarlamayı korur (bilerek
bozulunca düştüğü görüldü).

## Hızlı giriş — çalışma ekranının tek amacı

**Adım adım seçim (ürün sahibi, 24.10.2026: "Profesyonel bir şey olsun. Hata
gir diye ekran olsun, seçe seçe ilerlesinler, en dıştan, hızlı hızlı
girebilmek için.")** Parça artık 169 satırlık tek listeden değil, şirketteki
Excel formunun System → Part → Problem sırası gibi kademeli seçilir:
**Sistem** (Dış / İç / Motor bölmesi / Fonksiyon / Yol testi) → **Bölge** (ör.
Sol yan; tek bölgeli sistemde atlanır) → **Parça** → derece + **Hata** (dokununca
kaydedilir). Kayıttan sonra en dışa değil **aynı bölgenin parçalarına**
dönülür: o bölgede ikinci hata iki dokunuş. Üstte "Sistemler › Dış › Sol yan"
izi her adıma geri döndürür; her kartta o sistem/bölge/parçadaki kayıt sayısı
yazar. Arama kutusu her adımda durur. Kod: `src/bilesenler/AdimliSecim.tsx`.


26.09.2026 ürün sahibi geri bildirimi: *"programı hiç beğenmedim… parça
seçilecek, gap mı scratch mı seçilecek, hataları tak tak girebilecekler."*

Önceki çalışma ekranı 3B modeli merkeze koyuyordu ve her kayıt bir form
açıyordu. Şimdiki akış:

    parça ara → parçaya dokun → hataya dokun → KAYDEDİLDİ

- **Derece yeni parçada 1'den başlar** (28.09.2026'dan). Önceden son seçilen
  derece hatırlanıp bir sonraki parçaya taşınıyordu; kullanılabilirlik
  sınamasında bu, dereceye bakmayan denetçinin önceki dereceyi **sessizce**
  yazması demekti (aşağıda "Kullanılabilirlik sınaması"). Izgaranın üstünde
  "Dokunduğunuz hata [n] olarak kaydedilir" yazar.
- **Kayıttan sonra bildirimde iki düğme var:** "Aynı parçaya" (aynı parçaya bir
  hata daha; derece korunur — **2 dokunuş**) ve "Geri al" (yanlış dokunuş tek
  dokunuşla silinir; ardından kısa bir "Geri alındı" bildirimi). Yeni parçaya
  kayıt: parçaya dokun, gerekirse dereceyi seç, hataya dokun. (Tarayıcıda
  sayıldı; tablette sayılmadı.)
- **Parçalar tarafıyla yazılır** ("Sol ön kapı", "Sağ ön kapı"); arama kelime
  kelime ve sırasız, Türkçe karakter şart değil ("sag on kapi" bulur), LH/RH ve
  İngilizce adla da bulur.
- **Fotoğraf, not, adet hızlı yolda değil**; "Liste"den kayda dokunup sonradan
  eklenir.
- **3B model ana ekrandan kaldırıldı** ("görünüm sonraya kalsın"). Bileşen
  dosyaları duruyor; sipariş edilen gerçek model gelince geri bağlanacak.

**Bilinen tuzak, düzeltildi:** "Geri al" bildirimi ızgaranın son satırının
üstünde yüzüyor. İlk sürümde metin alanı dokunuşu yutuyordu, kayıttan sonraki
6 sn o satıra basılamıyordu. Şimdi dokunuşu yalnız "Geri al" düğmesi alıyor.
Bunu sınayan ilk testim **yanlıştı** — Playwright tıklamadan önce düğmeyi
kaydırıp bildirimin altından çıkarıyordu, düzeltmesiz pakette de geçiyordu.
Kaydırmayan ham tıklamaya çevrilince hatayı düzeltmesiz pakette yakaladı,
düzeltmeli pakette geçti.

## Ekibin Excel'i (NAS) — içerik buna göre (26.10.2026)

Ürün sahibi ekibin kullandığı Excel'i ("NAS — New Audit System") gönderdi ve
*"İçeriği buna göre yap, Excel'de her şey var; biz kullanış ve arayüz
sunacağız"* dedi. Excel'in formları ve makrosu okundu (makrolar
**çalıştırılmadı**, yalnız metni okundu). Uygulamaya taşınanlar — kural
`src/cekirdek/nas.ts`'te tek yerde:

| Excel | Uygulamada |
|---|---|
| DEMERIT 0–3, form 0 ile açılır | Demerit 0–3, **her kayıt 0 ile başlar** (hızlı panel ve ayrıntı). Eski "kabul edilebilir" bayrağı **0 sayılır** |
| CLASS MINOR / MAJOR / MAIN, varsayılan MINOR | Aynı; her kayıttan sonra MINOR'a döner |
| SYSTEM (EXTERIOR, INTERIOR, BODY, PAINT, CHASSIS, DRIVE, ELECTRIC, MOVING) | Parça ve hata tipinden **önerilir** (ör. boya tipleri → PAINT, motor bölmesi → CHASSIS), ayrıntıda değiştirilir. Öneri kuralı benim yargım |
| RESPONSIBLE listesi | Hazır seçenekler + serbest yazım; parçaya öğrenme sürüyor |
| PROBLEM SOURCE (AUDIT, 3M - DEALER CLAIM, LONG TERM, NCBS, DURABILITY) | Aynı liste, varsayılan AUDIT. Eski "HMC Audit" → AUDIT, "Durability" → DURABILITY sayılır |
| MODEL kodu (AC3, BC3, CUV, N, BJ, BC4 CUV) | Araçlar "BJ · IONIQ 3" gibi kodla gösterilir; N, AC3, BC4 CUV eklendi |
| BODY: yalnız rakam, tam 6 hane | Aynı kural; eski kayıtlardaki farklı body no olduğu gibi kalır |
| Scores paneli: Bugün / Bu Hafta / G. Hafta / Bu Ay / Bu Yıl; Audit Skoru | Ana sayfa sayacı ve Analiz bunu gösterir. **Skor = 100 × Σ demerit ÷ denetlenen araç**, VBA gibi tam yarıda çifte yuvarlanır. **Yalnız AUDIT kaynağı sayılır** (makro da öyle) |
| AUDIT_CARS_LIST, PROBLEMS_LIST sayfaları | Ayarlar → Veri → **Excel'e aktar (NAS)**: bütün denetimler aynı sütunlarla, satırlar o dosyaya yapıştırılabilir |

**Excel'den bilerek farklı olanlar** (makro hataları kopyalanmadı; bu yüzden
sayılar Excel'dekiyle aynı çıkmayabilir — fark Excel'in hatasıdır):
"Bu Ay" yıla bakmıyor (bütün yılların aynı ayı toplanıyor); BJ satırına toplam
yazılıyor; tarih metin olarak yazılıyor (burada gerçek tarih hücresi);
VERIFICATION BODY NO hücrelerinin çoğunda bir form etiketinin adı ("Label17")
var (burada boş); PHOTO LINK hep aynı klasör (burada tam yedekteki dosya adı).
Excel'in hangi satırlarında bunların görüldüğü şirket verisi olduğu için
**depoya yazılmadı.**

**Çıkarım, doğrulanmadı:** BJ = IONIQ 3. Excel'de BJ en yeni model kodu ve
2026'da aktif üç model (BJ, BC3, CUV) ürün sahibinin verdiği üç araçla
(IONIQ 3, i20, BAYON) örtüşüyor. Yanlışsa `model3d.ts`'te tek satır.

**Önceki kararlarla ilişkisi.** 26.09.2026'da kaldırılan *bizim uydurduğumuz*
ceza puanı ağırlıkları ve KABUL/ŞARTLI/RED damgasıydı — onlar geri gelmedi.
Demerit ise ekibin kendi Excel'indeki, denetçinin seçtiği sayı. 24.10.2026'da
skor bilinmediği için seçilen DPU'nun yerini Excel'in Audit Skoru aldı.

**Excel'de olup henüz yapılmayanlar:** dayanıklılık filosu takibi (KM, bakım,
plaka, çıkış formu), problem takibi (PROGRESS, COUNTERMEASURE, CM tarihi,
doğrulama body no), Excel'deki parça listesinin içe alınması.

**Nasıl doğrulandı:** birim testleri (`tests/aracAuditNas.test.ts`,
`aracAuditSayac`, `aracAuditIstatistik`) — beklentileri Excel'den okuyarak
**ben yazdım**; Excel'in kendisiyle aynı sayıyı verdiğinin kanıtı değil. İki
koruma bilerek bozuldu, testler düştü (AUDIT süzgeci, VBA yuvarlaması).
Veritabanı göçü 8 (`sinif`, `sistem` sütunları) Node SQLite'ta sıfırdan ve göç
7'deki eski bir kayıtla koşuldu. Web'de 4 düzende 14 adımlık sınav geçti.
**Telefonda görülmedi.**

## Dil — Türkçe / English (26.10.2026)

Ürün sahibi: *"İng Türkçe seçenek de olsun."* Ayarlar → Görünüm → Dil.
Seçenek adları kendi dillerinde yazılır (Türkçe / English): dili bilmeyen biri
de kendi dilini bulsun. Tercih cihazda saklanır; açılış onu okumadan çizmez
(okuma 1,5 sn'de takılırsa Türkçe açılır).

- Metinler kullanıldığı yerde çift durur: `t('Yeni denetim', 'New audit')`
  (`src/veri/dilDeposu.ts`). Anahtar dosyası yok — metni değiştiren iki dili
  aynı satırda görür.
- Katalog (parça, bölge, hata tipi, grup, sistem) zaten iki dilliydi; ekranda
  seçili dilde gösterilir. İngilizcesi boş bırakılmış bir ekip tipi İngilizce
  arayüzde Türkçe adıyla çıkar.
- Excel'den gelen terimler iki dilde de İngilizce kalır: Demerit, Class,
  MINOR/MAJOR/MAIN, System, Responsible, AUDIT…, Problem source, Body no.
- **Excel/CSV raporunun dili ayrıdır**, ekibin tablosu gibi İngilizce kalır.

## Derece — ekibin kendi sistemi, puan yok

> **26.10.2026'dan beri aşağıdakinin yerini yukarıdaki "Ekibin Excel'i"
> bölümü aldı:** derece artık Excel'deki DEMERIT (0–3), "kabul edilebilir"
> parantezi kalktı (karşılığı demerit 0). Aşağısı tarihçe olarak duruyor.

Üç derece var: **1, 2, 3.** Her biri iki durumda yazılır:

| Yazım | Anlamı |
|---|---|
| `3` | hata — düzeltilmesi gerekir |
| `(3)` | kabul edilebilir — kayda geçer, iş emri doğurmaz |

Parantez süs değil, **anlamı tersine çevirir.** Bu yüzden:

- Gösterimin tek kaynağı `dereceGosterimi()` (`cekirdek/puan.ts`). Ekran ve
  Excel aynı fonksiyonu kullanır; test ikisinin ayrışmadığını sınar.
- **"Kabul edilebilir" anahtarı yapışkan değildir**, her kayıttan sonra kapanır.
  Yapışkan olsaydı bir kez açık unutulan anahtar sonraki gerçek hataları
  sessizce "(3)" yazardı.
- Rozet parantezi hem metinle hem kesikli çerçeveyle gösterir; ayrım yalnız
  renge bırakılmadı.

**Sıralama: 3 en ağır, 1 en hafif.** Dayanağı (26.09.2026): "3 kötü" dendi;
ürün sahibine "3'ü en ağır kabul ettim, tersiyse söyle" diye soruldu, yanıt
"evet" oldu. Yanlış çıkarsa `cekirdek/katalog.ts` içindeki `DERECELER`de üç
`id` yer değiştirir. **Hâlâ alınmadı:** kademelerin yazılı tanımı (1 ile 2'yi
ne ayırır).

**Ceza puanı ve KABUL/ŞARTLI/RED kaldırıldı** (26.09.2026; istek 16.09.2026, ürün sahibi: *"bizde
öyle bir şey yok"*). Uydurma bir puanı rapora yazmak, olmayan bir ölçütü varmış
gibi gösterir. Geri eklenmemeli.

**Veri göçü (göç 3):** eski `A/B/C` kayıtları `3/2/1`'e dönüştürülür. Hem eski
cihaz yolu (göç 2'de A/B/C verisiyle) hem yeni kurulum yolu Node'un yerleşik
SQLite'ında gerçek SQL koşularak doğrulandı. Toplu yeniden adlandırma sırasında
göç 1 ve 2'deki `siddet` sütun adı da yanlışlıkla değişmişti; tarayıcı testi
"no such column: siddet" ile yakaladı, eski göçler orijinaline döndürüldü.

**Sayımlarda kabul edilebilir bulgu ayrı tutulur.** Özetteki derece tablosu
iki sütun: düzeltilecek hata ve kabul edilebilir. DPU (araç başı hata)
kabul edilebilir bulguları saymaz — tanım gereği düzeltilecek hata değiller.

## Rapor — ekibin kendi tablosu ("Part Related Issues")

Kaynak: ekibin 26.09.2026'da gönderdiği ekran görüntüsü. Excel artık o
tablonun düzeninde ve **İngilizce** çıkar (ekibin tablosu baştan sona
İngilizce; uygulama ekranı Türkçe kalır):

| No | Area | Phase | Grade | Issue | Type | Photo | Source | Team | Responsible |
|---|---|---|---|---|---|---|---|---|---|
| 1 | Exterior · LH side | LP2 | 3 | LH front fender scratch | Part | *(gömülü)* | HMC Audit | QE Team 2 | HMTR PD (SEOHON E-HWA) |
| 2 | Exterior · LH side | LP2 | (2) | LH front door gap variation - upper corner (x2) | Part | | HMC Audit | QE Team 2 | |

- Başlık satırı ekibinkini izler: `Hyundai IONIQ 3 LP2 — Part-Related Issues
  (QE Team 2, 26.09.2026)`. İlk sayfanın adı "Part Related Issues".
- **Issue** sütunu elle yazılmaz, üretilir: `{parça} {hata} - {ayrıntı}` —
  ekibin kendi yazımı ("FR door trim wrinkle - quadrant inner…") örnek alındı.
  Parça adı **her zaman tarafı içerir** (`parcaTamAdi`): katalogda dış yan
  paneller tarafı taşımıyordu ("Front fender"), "hangi çamurluk?" belli
  değildi.
- İngilizce küçültme İngilizce yerel ayarla yapılır. Türkçe yerelde "I" → "ı"
  olur; "Inoperative" raporda "ınoperative" çıkardı (ölçüldü, testte var).
- **Sadeleştirme (ürün sahibi, 24.10.2026).** Şirkette kullanılan Excel
  formunun fotoğrafını attı ("bizdeki gereksiz bilgileri sil"); hangi
  alanların gideceğini **kendisi seçti**: plaka, km, faz, ekip, rapor no
  (denetim) ile adet ve konum (hata kaydı) formdan kalktı. Spec, Part/Complex
  türü ve kabul edilebilir **kaldı**. Eski bir denetimde/kayıtta dolu olanlar
  silinmez: raporda yalnız doluysa görünür, düzenleyip kaydetmek onları
  değiştirmez. Raporun **Phase** ve **Team** sütunları ekibin tablosuyla
  uyum için duruyor; yeni denetimde boş kalır.
- **Denetçi** listeden seçilir, sonraki denetimde hatırlanır (ürün sahibi,
  28.09.2026). Formdaki "+ Ekle" ile ad eklenir; Ayarlar'da eklenir ve
  kaldırılır. "ali veli" yazmak ikinci bir "Ali Veli" açmaz, var olanı seçer.
  Liste **cihazda** saklanır: bir tablette eklenen ad öbürüne geçmez
  (merkezi sunucu yok). Hazır denetçi listesi boş; nedeni
  `src/cekirdek/listeler.ts`'te.
- **Spec (LH / RH)** (ürün sahibi, 28.09.2026) şasi kartında girilir; araca
  özgü olduğu için **hatırlanmaz**. Raporun başlık bloğunda, çalışma ekranı
  başlığında ve ana sayfa kartında görünür. "LH / RH"nin anlamı ekipten teyit
  edilmedi; uygulama yorumlamadan yazar.
- **Source** her denetimde "HMC Audit". Formdaki kaynak seçimi, üretim hattı
  ve vardiya ürün sahibinin isteğiyle kaldırıldı (28.09.2026). Eski bir
  denetimde hat/vardiya doluysa raporda yine görünür; boşsa "Line / Shift"
  satırı hiç basılmaz.
- **Type** (Part/Complex) varsayılan Part; ayrıntı ekranından değişir.
- **Responsible parçaya öğrenilir:** ayrıntı ekranında bir parça için yazılan
  sorumlu, o parçanın sonraki hızlı kayıtlarına kendiliğinden gelir.
  Hiç yazılmamışsa **boş kalır** — tahmin edilip rapora basılmaz. Complex
  hatanın sorumlusu (çoğu zaman bir tasarım ekibi) parçaya **öğretilmez**;
  öğretilseydi o parçanın sıradan hataları tasarım ekibine yazılırdı.

**Bilinmeyen — uydurulmadı, ekibe sorulacak:**
- Ekibin tablosundaki **C ve D** sütunları (sayılar) — rapora konmadı.
- **F** sütununda görülen sarı **"A"** — derece oraya kondu ama "A"nın
  anlamı bilinmiyor.
- **Area** değerleri: ekibin tablosunda "Moving & Interior" gibi daha kaba
  alanlar var; şimdilik kendi bölge adlarımız yazılıyor.

## Dünyadaki benzerler ve onlardan alınanlar (24.10.2026)

Ürün sahibi: *"Sen geliştir, tam gözden geçir, dünyada örnekleri varsa kopya
çek, derin araştırma yap ve uygula, bana sorma."* Araştırma yalnız web
aramasıyla yapılabildi; bu ortamda site sayfaları açılamıyor (DNS kapalı),
o yüzden aşağıdakiler arama özetlerine dayanır, sayfaların kendisi okunmadı.
Vendor sayfaları pazarlama metnidir; bağımsız inceleme bulunmadı.

| Kaynak | Ne yapıyor | Bizde |
|---|---|---|
| [ATS Inspect — EV üreticisi vaka](https://www.ats-global.com/success-stories/paperless-quality-inspection-at-electric-car-manufacturer/) | Tablette 3B CAD üstünde kusurun yerine dokunma; tip, şiddet, sorumlu hücre, fotoğraf; araca göre değişen kontrol listesi; son kalite kapısı; anlık rapor | 3B yerine **şematik araç haritası** (bölgeye dokun); **kapsam** (sistem kontrol listesi) ve Bitir'de eksik sistem uyarısı |
| [SafetyCulture / iAuditor](https://safetyculture.com/iAuditor) · [App Store](https://apps.apple.com/us/app/iauditor-inspections-checks/id499999532) | Kontrol listesi şablonları, fotoğraf üstüne çizim, çevrimdışı, fotoğraflı ve imzalı PDF/CSV/Word rapor | Kapsam listesi; Excel/CSV/HTML rapor zaten vardı. **Fotoğraf üstüne çizim ve imza YOK** (aşağıda) |
| [iFactory — son kontrol panosu](https://ifactoryapp.com/industries/automotive-manufacturing/final-inspection-quality-dashboard-first-time-through) · [kalite analitiği](https://ifactoryapp.com/article/quality-analytics-dashboard-software) | FTT/DPU istasyon bazında, hata tipi dağılımı, tekrar eden araç bayrağı, vardiya kalıpları; Pareto'nun en uzun çubuğunu kırmak | **Analiz** ekranı: Pareto (birikimli pay), **tekrarlayan hata** (≥2 araç), sisteme göre DPU, **haftalık DPU** (8 hafta) |
| [2013 — koltuk son kontrolünde Pareto](https://reference-global.com/download/article/10.2478/ata-2013-0012.pdf) | Aylık kontrol verisinden uygunsuzlukları Pareto ile sıralama | Aynı yöntem, parça + hata tipi çifti üstünden |
| [Dealers Online — panel hasarı belgeleme](https://hub.dealersonline.co.za/guides/essential-steps-for-documenting-panel-damage) · [AP Inspector](https://apps.apple.com/app/id6764258571) · [PurInspect](https://apps.apple.com/us/app/id1610157502) | Şemada panele dokun → hasar tipi → yakın fotoğraf, kalem/fosforlu işaretleme | Harita akışı; **işaretleme yok** |
| [Infor Nexus QA](https://www.infor.com/resources/infor-nexus-quality-assurance) · [Wooqer](https://wooqer.com/feeds/service/manufacturing-audit-software) | Denetim sırasında hata + fotoğraf; standart hata kodları; tekrarlayan sorun panoları | Standart katalog zaten vardı; tekrarlayan hata eklendi |
| [CAQ Compact.Net](https://caq.de/en/quality-inspection-software) | Muayene planı + veri toplama, SPC uyarıları, kök neden | Kapsam dışı (SPC yok) |
| [Coventry — Final Vehicle Product Audit](https://pureportal.coventry.ac.uk/en/publications/final-vehicle-product-audit-methodologies-within-the-automotive-i/) · [FISITA — demerit](https://go.fisita.com/store/papers/MVT2012/MVT_20124003) | Sözel değerlendirmeyi puana çevirme; ağırlıklı ceza (demerit) | Ceza puanı yok (ürün sahibi 16.09: "bizde öyle bir şey yok"); DPU var |

Hyundai/Kia'ya özgü GCA/DPHU ölçütü aramada bulunamadı; yalnız genel
kalite haberleri çıktı (J.D. Power PP100 vb.). O yüzden skor DPU'da kaldı.

**Bu turda eklenenler:** kapsam (göç 7 `denetim_kapsam`; hata kaydedilince
sistem kendiliğinden işaretlenir, hatasızsa elle; Bitir bandı eksikleri
sayar; künye ve Excel'de "Kontrol edilen sistemler"), araç haritası
(`AracHaritasi.tsx`, 5 dış bölge; Alt listede), Analiz ekranı
(`app/istatistik.tsx`, hesaplar `istatistik.ts`'te testli), denetim süresi
(kart, künye, Excel), tam yedek (Ayarlar → Veri; zip: `veri.json` +
fotoğraflar; **geri yükleme yok**).

**Bilerek yapılmayanlar:** fotoğraf üstüne çizim ve imza (SafetyCulture'da
var; çizim tuvali ve dışa aktarım ayrı bir iş), 3B model (gerçek model yok),
MES/ERP bağlantısı ve kalite kapısı (ATS; sunucu yok), SPC (CAQ). Hepsi
merkezi sunucu kurulunca yeniden ele alınır.

**Doğrulama:** `istatistik.ts` ve `sistemler.ts` için 9 birim testi; göç 7
Node SQLite'ta göç 6'lı veritabanından (çift yazım, yabancı anahtar, silince
kaskad); uçtan uca sınav 15 adım, 4 düzen; ekran görüntüleri. Sınavı ben
yazdım, web paketi; **gerçek denetçi ve gerçek cihazla doğrulanmadı**.
Analiz ekranındaki sayılar bu cihazın verisidir, ekibin toplamı değil.

### Üreticilerde durum — Tesla, Mercedes, Toyota ve diğerleri (25.10.2026)

Ürün sahibi sordu: *"Dünyada benzer bir uygulama var mı, Tesla'da, Mercedes'te,
Toyota'da?"* 24 web araması yapıldı (sayfalar açılamadı, DNS kapalı; yalnız
arama özetleri). Kanıt kaynağı her satırda yazıyor; üreticilerin iç araçları
hakkında kamuya açık bilgi azdır ve çoğu sayı üretici ya da satıcı beyanıdır.

| Üretici | Bulunan | Kaynak türü |
|---|---|---|
| **Mercedes-Benz** | MO360 içinde **"Quality Live"**: kalite yöneticisi her aracın anlık kalite durumunu telefon/el terminalinden görür; bölgesindeki kalite durumu için uyarı alır; yapay zekâ onarım (rework) önerir; 30'dan fazla fabrikada | Basın bülteni, 2020–2023 |
| **BMW** | **GenAI4Q** (Regensburg, 2025): yapay zekâ her araç için kontrol kapsamını seçip bir telefon uygulamasında sıralıyor (~1.400 araç/gün); bulgu için sesli not; ayrıca AIQX kamera platformu | BMW basın bülteni |
| **Ford** | Valencia: bileğe takılan cihazda Android uygulaması, araca özel kontrol listesi, hattı durdurabiliyor (Ford: %7 daha az hata, araç başına 7 sn kazanç). Kuzey Amerika'da 17 fabrikada iPhone + IBM görüntü tanıma (Ford: 150 milyon kontrol, 400 bin bulgu) | Ford beyanı, ticari basın |
| **Toyota** | Resmî: 1.500 noktalı final kontrol, parça doğrulama için el terminali. Satıcı vakası (ATS Inspect, pres atölyesi): tablette parça çizimine dokunarak hata yeri, 0,1–1,0 ağırlık, fotoğraf | Toyota fabrika turu; satıcı broşürü |
| **Nissan / Renault** | VES/AVES standardı: 300'den fazla ölçüt, yalnız sertifikalı "VES Master" uygular, seri üretimde de dönemsel; uygulama/tablet bilgisi yok | Nissan sürdürülebilirlik raporu |
| **Hyundai / Kia** | Ekim 2026 E-FOREST: tünel tipi kamera + yapay zekâ ile bitmiş araç dış kontrolü (Kia Hwaseong), gövde hatalarını sesli soruyla tipe göre döken "Polaris" ajanı; 2032'ye kadar otonom fabrika. Tablet denetim uygulaması hakkında bir şey yok | Basın |
| **Volvo** | Torslanda: hat sonunda UVeye kamera tüneli, 360° dış tarama (2020'den beri) | Ticari basın |
| **Tesla** | İç uygulama hakkında **hiçbir kamuya açık bilgi yok**; otomatik kontrol robotları (EINES). Mağazadaki "TSL Check", "Inspect T" üçüncü taraf teslimat kontrol uygulamalarıdır, Tesla'nın değil | Basın, mağaza sayfaları |
| **GM** | GCA (Global Customer Audit) bir süreç adı; uygulama ayrıntısı yok | Forum (zayıf kanıt) |
| **Türkiye** | Ford Otosan 2022'de "Dijital Mükemmellik Merkezi" platformu planı; Tofaş, Toyota, Hyundai Assan için bulgu yok | Köşe yazısı |

**Çıkarım (benim yorumum, ölçüm değil):** büyük üreticilerde "tek başına
denetim uygulaması" yok; hata kaydı, fabrikanın MES/kalite sisteminin bir
modülü (Quality Live gibi). 2024–2026 eğilimi iki yönlü: dış yüzey hataları
için kamera tüneli + yapay zekâ, kontrol kapsamını araç başına yapay zekânın
seçmesi. Bu uygulamanın zaten yaptığı şeyler (araç başına kayıt, bölgeye
dokunarak yer, derece, fotoğraf, Pareto, DPU) ATS Inspect ve Quality Live'ın
çekirdeğiyle örtüşüyor. Onlarda olup burada olmayanlar: **merkezi sunucu ve
canlı durum**, sesli not, kameradan otomatik bulgu, hat entegrasyonu (hattı
durdurma, onarıma yönlendirme).

## Durum — ne bitti, ne bitmedi

| | |
|---|---|
| Tasarım sistemi, iki tema | **Bitti** |
| Görsel yenileme: koyu çubuk, simgeler, tablette iki bölme, kartlar | **Bitti** — web'de tablet/telefon × açık/koyu koşuldu; **gerçek tablette görülmedi** |
| Görsel dil üçüncü kez (25.10.2026): Vekil Pro paleti, Manrope, açık başlık, normal yazımlı etiketler | **Kod bitti, beğeni ölçülmedi** — kontrast 2 × 39 çift ≥ eşik; 4 düzende sınav geçti; ürün sahibi henüz görmedi |
| Lumiform'dan esinlenen düzen (25.10.2026): sekmeler, kontrol listesi, ilerleme, rapor özeti | **Kod bitti, beğeni ölçülmedi** — 4 düzende 16 adım geçti; gerçek cihazda görülmedi |
| Denetim listesi · yeni denetim · çalışma ekranı · rapor · ayarlar | **Bitti** |
| Parça kataloğu (169 parça; elektrikli araçta 163, benzinlide 161 listelenir), VIN doğrulama | **Bitti** (web sürümünden taşındı, TypeScript'e çevrildi) |
| Hızlı giriş (2 dokunuş), geri al | **Bitti** |
| Kullanılabilirlik düzeltmeleri (üç ajanın sınaması, 28.09.2026) | **Bitti** — yapay zekâ ajanlarının web sınamasına göre; **gerçek denetçiyle doğrulanmadı** (aşağıda) |
| Derece 1/2/3 + kabul edilebilir (parantez) | **26.10.2026'da yerini Excel'in DEMERIT 0–3 + CLASS'ı aldı** (aşağıdaki satır) |
| Excel içeriği (NAS, 26.10.2026): demerit, class, system, responsible, kaynak listesi, model kodu, body 6 hane, Audit Skoru, Excel'e aktar | **Kod bitti** — kurallar Excel'den okundu; testleri ben yazdım; 4 düzende 14 adım geçti; **telefonda görülmedi**. BJ = IONIQ 3 çıkarım |
| Döndürülebilir araç (360°, 26.10.2026): dokuz bakış yuvası, eksik yan aynalanır, parça haritası varsa dokunulan parçanın ızgarası açılır, yoksa dış bölge | **Kod bitti, veri yok** — `PARCA_HARITALARI` boş (çokgenler ayrı hazırlanıyor), bugün bölge düzeyi. Web'de telefon ve tablette 10 adım **sentetik** görsel + **sentetik** haritayla geçti; gerçek görsellerle yalnız web'de yüz düzeyi gözlem; **telefonda denenmedi** |
| Dil: Türkçe / English (26.10.2026) | **Kod bitti** — Türkçe sınav 4 düzende değişmeden geçti (Türkçe metinler aynı kaldı); İngilizce sınav telefon ve tablette 10 ekranı taradı, Türkçe harfli metin yalnız bilerek kendi dilinde yazılan "Türkçe" seçeneği. Tarama Türkçe harf içermeyen Türkçe kelimeyi kaçırabilir; ekran görüntüleri gözle de bakıldı. Çeviriler benim (ve yardımcı ajanların); **İngilizce bilen bir kullanıcı okumadı**, telefonda görülmedi |
| Hata tipini uygulama içinden ekleme · arama · ayarlardan yönetme | **Bitti** |
| 3B model — dokunmayla parça seçimi | Ana ekrandan **kaldırıldı**; gerçek model bekleniyor |
| SQLite yerel depo (senkrona hazır şema) | **Bitti** |
| Excel/CSV üretimi ve paylaşımı | **Bitti** — ekibin tablosunun düzeninde, İngilizce; C/D sütunları ve F'deki "A" bilinmiyor |
| **Merkezi sunucu (Supabase), çok kullanıcı, yönetici panosu** | **YAPILMADI** — sıradaki iş |
| Hata takip döngüsü (atandı → giderildi → doğrulandı) | Şema hazır, arayüz **yapılmadı** |
| Barkod okuma | Kodu yazıldı, **gerçek kamerayla denenmedi** |
| Gerçek cihazda çalıştırma | APK ürün sahibinin telefonunda açıldı (ekran görüntüsü, 28.09.2026); kamera, barkod, paylaşım **denenmedi** |
| OTA güncelleme (EAS Update) | Kuruldu — telefona indiği **görülmedi** |
| Sadeleştirme: Excel formunda olmayan alanlar kalktı (24.10.2026) | **Bitti** — ürün sahibinin seçtiği yedi alan |
| Ana sayfa sayacı: araç başına bugün / bu hafta / bu ay / bu yıl (24.10.2026) | **26.10.2026'da Excel'in Scores paneline çevrildi**: G. hafta eklendi, ölçü Audit Skoru (DPU kalktı), yalnız AUDIT kaynağı. **Yalnız bu cihaz** |
| Adım adım hata girişi: Sistem → Bölge → Parça → Hata (24.10.2026) | **Bitti** — kayıttan sonra aynı bölgenin parçalarına dönülür; arama kısayol olarak duruyor. Web'de sınandı, **gerçek denetçiyle denenmedi** |
| Kapsam (sistem kontrol listesi), araç haritası, Analiz (Pareto / tekrarlayan hata / haftalık DPU), süre, tam yedek (24.10.2026) | **Bitti** — "Dünyadaki benzerler" bölümü; 26.10.2026'da Analiz'in ölçüsü Audit Skoru ve Excel'in SYSTEM'i oldu; web'de sınandı, **gerçek cihazda görülmedi**; geri yükleme yok |
| Excel formundan: "Problem yok" (hatasız aracı tek dokunuşla kaydet ve bitir), body no ile giriş (şasi isteğe bağlı), Problem Source seçimi (24.10.2026) | **Bitti** — 26.10.2026'dan beri body no Excel'in kuralıyla (tam 6 rakam), kaynak listesi Excel'in beş değeri. Veritabanı göçü 6 Node SQLite'ta sıfırdan ve göç 5'ten koşularak doğrulandı; **telefonda görülmedi** |

### Kullanılabilirlik sınaması (28.09.2026)

Ürün sahibi: *"Kullanımı biraz kötü. 3 ajan kur, kullansınlar, yorum
yapsınlar. Yoruma göre düzelt."*

**Yöntem ve sınırı.** Üç yapay zekâ ajanı uygulamanın **web paketini**
gerçek Chromium'da, dokunmatik telefon (390×844) ve tablet (1024×768, 768×1024)
boyutunda kullandı: deneyimli hat denetçisi (telefon, hız), ilk kez kullanan
denetçi (tablet), ekip lideri (rapor, Excel, koyu tema). Senaryoları ve
"doğru"yu ajanlar ve ben yazdık, her akış **bir kez** koşuldu. Bunlar **gerçek
kullanıcı verisi değildir**; dokunuş sayıları ve öğe konumları deterministik
ölçüm, "anlaşılmadı" yargıları tek bir AI denemesinin gözlemidir. Kamera,
barkod, paylaşım menüsü, eldiven, güneş ışığı web'de ölçülemedi.

**Üçünün de bağımsız olarak gördüğü, düzeltilenler:**
- Sol/sağ parçalar aynı adla görünüyordu; "sol ön kapı" araması dıştaki kapıyı
  bulmuyordu → tam ad tarafıyla, arama kelime kelime/sırasız/Türkçe karaktersiz.
- Kaydı düzeltmek zahmetliydi: düzenlemede DERECE 37 kutunun altındaydı
  (telefonda y=1370) → düzenlemede derece en üstte, hata tipi katlı.
- "Sil" onaysız, geri alınamaz ve "Vazgeç"in 8 px yanındaydı → iki adımlı onay,
  ayrı yerde (silme fotoğrafları da siliyor; geri al yerine onay).
- Bitmiş denetim uyarısız değişiyordu, "Bitir" onaysızdı → bitmiş kart raporu
  açar; çalışma ekranında bant; değişiklik olursa denetim yeniden "devam
  ediyor" olur; "Bitir" iki adımlı.
- EKİP/PLAKA örnek metinleri girilmiş değer gibiydi → "Örn. …".
- Kontrol hanesi uyarısı test şasisinde çıkıyordu → yalnız zorunlu olduğu
  bölgelerde (K. Amerika 1–5, Çin L). **Gerçek HMTR şasileriyle denenmedi.**

**İkisinin gördüğü:** derecenin yeni parçaya sessizce taşınması (yeni parçada
1), başladıktan sonra künyenin düzeltilememesi ("Bilgiler" sayfası; denetim
silme), denetçi/faz boşken uyarısız başlaması (ilk dokunuşta söylenir), formda
her seferinde IONIQ 3 seçili gelmesi (son araç hatırlanır), aynı şasinin
uyarısız ikinci kez açılması ("Onu aç / Yine de başla").

**Birinin gördüğü:** Türkçe karaktersiz arama, "Aynı parçaya" kısayolu, sessiz
geri al, telefonda başlık çiplerinin ~132 px tutması (tek satır), camda "Cam"
grubunun en altta olması (parçanın kendi grup sırası), ana sayfada arama/süzgeç
yokluğu, rapordaki satırdan düzeltme (9 dokunuş → 1), rapor listesinin derece
sırası, Excel'de durum/bitiş zamanı, İngilizce dosyada Türkçe kalan Summary,
yazdırmada `fitToPage` eksikliği, özel tipte İngilizce ad uyarısı, "(3)"
önizlemesine "Raporda" etiketi, dikey tablette kesilen şasi.

**Yapılmayanlar:** merkezi sunucu (tabletler arası görünürlük), Excel'in gerçek
Excel'de açılıp basılması, telefonda raporun kısaltılması (künye listeden önce
duruyor), web'de Excel paylaşımının çalışması (web'e özgü; uygulama değil).

**Göndermeden önceki uçtan uca sınav.** Bu dalda her push OTA ile telefonlara
yayımlandığı için düzeltmeler önce web paketinde, gerçek Chromium'da sınandı.
Hızlı giriş sınavı artık **20 adım** (27.09'da 13'tü; aradakilerin bir kısmı
başka özellikler için eklendi). Bu iş için eklenenler: yeni parçada derecenin
1'e dönmesi, Bitir'in onayı, bitmiş kartın raporu açması, rapordaki satırdan
düzenleme (derece üstte), bitmiş denetimin kayıtla yeniden açılması, aynı şasi
uyarısı, "Bilgiler"de ekibin düzeltilip geri okunması, iki silme onayının
ekranda görünmesi, denetimin silinmesi, ana sayfada şasinin son haneleriyle
arama. Gönderilmeden **dört gerçek hata** çıktı; ikisini sınav, ikisini ekran
görüntüsü gösterdi:

1. Rapordaki hata satırının ekran okuyucu etiketinde derece yoktu (düğmenin
   etiketi içindeki rozetinkini örtüyordu) → etikete derece ve kabul eklendi.
2. "Bitir" ve "Denetimi sil" ana sayfaya `router.replace('/')` ile dönüyordu:
   çalışma ekranı yığında kalıyor, üstüne ikinci bir ana sayfa biniyordu —
   Android'de geri tuşu kapanmış bir denetime dönerdi. → `router.dismissTo('/')`.
   **Kontrol vakası:** eski kodla derlenen pakette adım düştü ("Denetim ara"
   iki ekranda), yenisinde geçti.
3. Silme onayı kaydırmanın en altında açılıyor, "Evet, sil" alttaki
   Vazgeç/Kaydet çubuğunun arkasında kalıyordu (kayıt ve denetim silmede).
   Bunu sınav değil **ekran görüntüsü** gösterdi: Playwright tıklamadan önce
   kendisi kaydırdığı için "tıklanabildi" bunu kanıtlamıyordu. → Onay açılınca
   kendiliğinden sona kaydırır; sınava düğmenin ortasında en üstte kendisinin
   olduğunu ölçen bir denetim eklendi. **Kontrol vakası:** eski pakette düştü.
4. Kayıt düzenlemede ADET kutusu (iki 48 px düğme + sayı) satırın üçte birine
   sığmıyordu: web'de "+" KONUM'un altında kalıyor, telefonda sayıya yer
   kalmıyordu. **Bu işten önce de vardı** (satır değişmemişti) ve üç ajanın
   raporlarında yok; ekran görüntüsünde görüldü. → ADET sabit genişlikte, dar
   ekranda KONUM alt satıra iner; sınava "+" ile sayının üstünün açık olduğunu
   ölçen denetim eklendi. **Kontrol vakası:** eski pakette düştü.

Son koşu (düzeltmelerden sonra): tablet 1024×768 ve telefon 390×844, açık ve
koyu temada **dört düzende de 20/20**; birim testleri 896/896.

Sınırı: sınavı ve "doğru" tanımını ben yazdım; web paketi, telefon değil;
her düzende bir koşu. Bağımsız doğrulama değildir.

### Neyin nasıl doğrulandığı

Uygulama `expo export --platform web` ile paketlendi ve gerçek Chromium'da
uçtan uca koşuldu: açılış → yeni denetim → VIN doğrulama → SQLite'a yazma →
3B modelin çizilmesi (tuval %37 dolu) → 166 parça içinde arama → hata kaydı →
rapor → koyu tema. Tip denetimi (`strict`) sıfır hatayla geçiyor.

**Excel dosyasının kendisi** (26.09.2026): uygulamanın `excelUret` koduyla
gerçek bir JPEG gömülü örnek rapor üretildi ve uygulamadan BAĞIMSIZ bir
okuyucuyla (openpyxl) açıldı: ZIP bütünlüğü, sayfa adları, başlık, 10 sütun
başlığı, her hücrenin değeri, `(2)` gösterimi, fotoğrafın doğru hücreye (Photo
sütunu, doğru satır) ve 149×112 px boyuta oturduğu okundu. **Gerçek Excel'de
açılmadı** — bu ortamda Excel yok.

**Görsel yenileme** (27.09.2026): aynı uçtan uca sınav yeni düzene uyarlandı
ve dört düzende koşuldu — tablet 1024×768 ve telefon 390×844, her biri açık
ve koyu temada. Dördünde de 13 adımın hepsi geçti: iki dokunuşla kayıt,
derecenin hatırlanması, bildirimin altındaki düğmeye HAM tıklamayla basılması
(ölçüm: 3 → 4 kayıt), kabul anahtarının yapışkan olmaması, geri al, sorumlu
öğrenme, raporda 1 × (3) ve 4 × 3 rozeti. Ekran görüntülerine tek tek
bakıldı; bulunan kusurlar (telefonda ana sayfa kartında şasinin "NLHB51ABPD…"
diye kesilmesi, web'de girdilerin üstüne tarayıcının siyah odak çizgisinin
binmesi, koyu temada çubuğun sol bölmeyle birleşmesi) düzeltilip yeniden
koşuldu. Bu sınavı ve "doğru" tanımını ben yazdım; bağımsız bir doğrulama
değildir.

**Araç tipine göre parçalar ve sadeleştirme** (28.09.2026, ürün sahibi:
"Elektrikli araç seçince özellikler ona göre gelsin. Çok kalabalık olmasın"):
elektrikli araçta "Yakıt / şarj kapağı" yerine **Şarj kapağı**, "Şanzıman /
redüktör" yerine **Redüktör** listelenir; benzinlide tersi. Yalnız elektrikliye
çıkan parçaların adındaki "(EV)" eki kalktı. Eski parça kimlikleri korundu
(eski kayıtlar çözülmeye devam eder; testte var). Ekrandan kalkanlar: araç
kartındaki ölçüler, "ölçü doğrulanmadı" etiketi ve ölçü uyarısı; ana sayfadaki
dört sayı kutusu ve sunucu kutusu (bilgi başlığın altında: "Kayıtlar yalnız bu
cihazda"); parça satırlarındaki ve hata kutularındaki İngilizce alt satır
(aramada ve raporda duruyor); kabul anahtarının alt satırı; tabletteki özet
bölmesinin sayı kutuları. **Hata tiplerinden hiçbiri silinmedi** — hangisinin
ekipte hiç kullanılmadığını ekip bilir. Şarj/yakıt kapağının hangi yanda olduğu
bilinmiyor; iki yanda da listelenir.

**Bildirim sınavı sıkılaştırıldı** (28.09.2026): hata kutuları kısalınca eski
ölçüm kurulamadı; ilk düzeltme denemesi bildirimin geçirgen dolgusuna dokunuyor
ve dokunuşu yutan (kasıtlı bozulmuş) pakette de GEÇİYORDU. Şimdi ölçüm
bildirimin yazı alanında parmağın neye değdiğine bakıyor; bozuk pakette tablet
ve telefonda düştüğü, düzgün pakette geçtiği görüldü.

**Ekrandaki yanlış bir cümle düzeltildi** (27.09.2026): ana sayfa "kayıtlar
bağlantı gelince kendiliğinden gönderilecek" diyordu. Doğru değildi —
gönderen bir kod yok, sunucu kurulmadı. Artık "kayıtlar yalnız bu cihazda;
dışarı almak için raporu Excel olarak paylaşın" diyor; her karttaki
"GÖNDERİLMEDİ" rozeti de kaldırıldı (hep doğruydu, bilgi taşımıyordu).

**Native tarafta hiçbir şey denenmedi.** Web paketi, mantığın ve arayüzün
doğru olduğunu gösterir; kamera, barkod, dosya paylaşımı ve WebView'ın tablet
davranışı ancak gerçek cihazda görülür.

**Web'e özgü bilinen kısıt:** SQLite tarayıcıda OPFS kullanır ve aynı anda tek
yazıcıya izin verir; uygulamayı iki sekmede açarsanız ikincisi "kayıtlar
okunamadı" der. Tablette böyle bir kısıt yoktur.
