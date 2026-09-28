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
Koşu sayfasının altındaki `arac-audit-apk` zip'inden çıkan .apk telefona kurulur.

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

### Görsel dil (27.09.2026)

- **Üstte koyu uygulama çubuğu — iki temada da.** Sahada ekranın hangi
  uygulamada olduğunu bir bakışta ayırır; durum çubuğu simgeleri bu yüzden hep
  açık renk. Çubuk `Baslik`tır ve **üst güvenli alanı kendisi alır**; alt
  eylem çubuğu `AltCubuk`tur, ev çubuğu payını o alır. (Önceden yeni denetim,
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

## Yazı tipi neden IBM Plex

Endüstriyel/mühendislik bağlamı için tasarlandı, Türkçe karakterleri tam, ve
mono eşi **işlevsel**: şasi numarası ve hata kodunda eşit genişlikli haneler
yanlış okumayı azaltır. Süsleme değil.

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

### Araç kartındaki silüet ikonu

`bilesenler/AracIkonu.tsx` ikonu elle çizmez; `model3d.ts`teki `ustHat`ten
üretir. Elle çizilmiş SVG konsaydı ölçü düzeltmesinde 3B model güncellenir,
ikon eski şekliyle kalırdı. Üç araç **aynı ölçekte** çizilir ki kartta i20
gerçekten IONIQ 3'ten kısa görünsün.

3B modelde gövde rengi nötr kalır: şiddet vurgusu (A kırmızı) gövdenin üstüne
çizilir, kırmızı gövdede kırmızı vurgu okunmaz. IONIQ 3'ün lansman rengi
(Fierce Red) yalnız ikonda kullanılır — vurgu çizilmeyen tek yer orası.

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

## Hızlı giriş — çalışma ekranının tek amacı

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

## Derece — ekibin kendi sistemi, puan yok

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
- **Phase (faz)** ve **denetçi** listeden seçilir, sonraki denetimde
  hatırlanır (ürün sahibi, 28.09.2026). Faz listesi hazır gelir: T1, T2, LP1,
  LP2, Pre-M, M, SOP. İkisine de formdaki "+ Ekle" ile ad eklenir; Ayarlar'da
  eklenir ve kaldırılır. "lp2" yazmak ikinci bir LP2 açmaz, var olanı seçer.
  Listeler **cihazda** saklanır: bir tablette eklenen ad öbürüne geçmez
  (merkezi sunucu yok). Hazır denetçi listesi boş; nedeni
  `src/cekirdek/listeler.ts`'te.
- **Team** elle yazılır ve hatırlanır.
- **Spec (LH / RH)** ve **km** (ürün sahibi, 28.09.2026) şasi kartında
  girilir; araca özgü oldukları için **hatırlanmaz**. Raporun başlık
  bloğunda "Spec" ve "Mileage" olarak çıkar, çalışma ekranı başlığında ve ana
  sayfa kartında spec görünür. Km yalnız rakam tutar (en çok 7 hane);
  girilmezse boş kalır, 0 ile karışmaz (veritabanında NULL — göç 5). "LH /
  RH"nin anlamı ekipten teyit edilmedi; uygulama yorumlamadan yazar.
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

## Durum — ne bitti, ne bitmedi

| | |
|---|---|
| Tasarım sistemi, iki tema | **Bitti** |
| Görsel yenileme: koyu çubuk, simgeler, tablette iki bölme, kartlar | **Bitti** — web'de tablet/telefon × açık/koyu koşuldu; **gerçek tablette görülmedi** |
| Denetim listesi · yeni denetim · çalışma ekranı · rapor · ayarlar | **Bitti** |
| Parça kataloğu (169 parça; elektrikli araçta 163, benzinlide 161 listelenir), VIN doğrulama | **Bitti** (web sürümünden taşındı, TypeScript'e çevrildi) |
| Hızlı giriş (2 dokunuş), geri al | **Bitti** |
| Kullanılabilirlik düzeltmeleri (üç ajanın sınaması, 28.09.2026) | **Bitti** — yapay zekâ ajanlarının web sınamasına göre; **gerçek denetçiyle doğrulanmadı** (aşağıda) |
| Derece 1/2/3 + kabul edilebilir (parantez) | **Bitti** — sıralama ürün sahibine soruldu ("evet"); kademe tanımları alınmadı |
| Hata tipini uygulama içinden ekleme · arama · ayarlardan yönetme | **Bitti** |
| 3B model — dokunmayla parça seçimi | Ana ekrandan **kaldırıldı**; gerçek model bekleniyor |
| SQLite yerel depo (senkrona hazır şema) | **Bitti** |
| Excel/CSV üretimi ve paylaşımı | **Bitti** — ekibin tablosunun düzeninde, İngilizce; C/D sütunları ve F'deki "A" bilinmiyor |
| **Merkezi sunucu (Supabase), çok kullanıcı, yönetici panosu** | **YAPILMADI** — sıradaki iş |
| Hata takip döngüsü (atandı → giderildi → doğrulandı) | Şema hazır, arayüz **yapılmadı** |
| Barkod okuma | Kodu yazıldı, **gerçek kamerayla denenmedi** |
| Gerçek cihazda çalıştırma | APK ürün sahibinin telefonunda açıldı (ekran görüntüsü, 28.09.2026); kamera, barkod, paylaşım **denenmedi** |
| OTA güncelleme (EAS Update) | Kuruldu — telefona indiği **görülmedi** |

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
