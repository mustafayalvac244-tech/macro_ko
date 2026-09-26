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

## Dosya düzeni

```
app/                    ekranlar (expo-router: dosya = rota)
  _layout.tsx           yazı tipleri, tema, gezinme
  index.tsx             denetim listesi
  yeni.tsx              yeni denetim (araç + şasi)
  barkod.tsx            şasi barkodu okuma
  ayarlar.tsx           tema, karar eşikleri
  denetim/[id].tsx      ÇALIŞMA EKRANI — 3B model + hata kaydı
  denetim/rapor.tsx     rapor, Excel/CSV paylaşımı
src/
  tema/                 token'lar, iki palet, TemaSaglayici
  bilesenler/           paylaşılan arayüz — yeni bileşen yazmadan önce buraya bak
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
- **Bilgiyi yalnız renkle verme.** Şiddet rozeti hem renk hem harf taşır.
- **Aynı anda tek alt sayfa.** `AltSayfa` kabuğu bir tanedir, içeriği değişir —
  iki `Modal` üst üste açıldığında kapanan modal DOM'da asılı kalıp alttakini
  engelliyor (15.09.2026'da ölçüldü).
- Yeni yerel bağımlılık eklemeden önce **sor**: her biri OTA ile gidemeyecek
  yeni bir derleme demek.

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

16.09.2026 ürün sahibi geri bildirimi: *"programı hiç beğenmedim… parça
seçilecek, gap mı scratch mı seçilecek, hataları tak tak girebilecekler."*

Önceki çalışma ekranı 3B modeli merkeze koyuyordu ve her kayıt bir form
açıyordu. Şimdiki akış:

    parça ara → parçaya dokun → hataya dokun → KAYDEDİLDİ

- **Derece üstte sabit durur, son seçilen hatırlanır.** Aynı derecede art arda
  girişte, son dokunulan bir parçaya kayıt **2 dokunuş**, yeni parçaya 2 dokunuş
  + arama. (Tarayıcıda sayıldı; tablette sayılmadı.)
- **Kayıttan sonra "Geri al" çıkar** — yanlış dokunuş tek dokunuşla silinir.
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

**Sıralama varsayımı — teyit bekliyor:** "3 kötü" dendiği için 3 en ağır, 1 en
hafif kabul edildi. Ters ise `cekirdek/katalog.ts` içindeki `DERECELER`de üç
`id` yer değiştirir. Kademelerin yazılı bir tanımı ekipten alınmadı.

**Ceza puanı ve KABUL/ŞARTLI/RED kaldırıldı** (16.09.2026, ürün sahibi: *"bizde
öyle bir şey yok"*). Uydurma bir puanı rapora yazmak, olmayan bir ölçütü varmış
gibi gösterir. Geri eklenmemeli.

**Veri göçü (göç 3):** eski `A/B/C` kayıtları `3/2/1`'e dönüştürülür. Hem eski
cihaz yolu (göç 2'de A/B/C verisiyle) hem yeni kurulum yolu Node'un yerleşik
SQLite'ında gerçek SQL koşularak doğrulandı. Toplu yeniden adlandırma sırasında
göç 1 ve 2'deki `siddet` sütun adı da yanlışlıkla değişmişti; tarayıcı testi
"no such column: siddet" ile yakaladı, eski göçler orijinaline döndürüldü.

## Durum — ne bitti, ne bitmedi

| | |
|---|---|
| Tasarım sistemi, iki tema | **Bitti** |
| Denetim listesi · yeni denetim · çalışma ekranı · rapor · ayarlar | **Bitti** |
| 166 parçalık katalog, VIN doğrulama | **Bitti** (web sürümünden taşındı, TypeScript'e çevrildi) |
| Hızlı giriş (2 dokunuş), geri al | **Bitti** |
| Derece 1/2/3 + kabul edilebilir (parantez) | **Bitti** — sıralama varsayımı teyit bekliyor |
| Hata tipini uygulama içinden ekleme · arama · ayarlardan yönetme | **Bitti** |
| 3B model — dokunmayla parça seçimi | Ana ekrandan **kaldırıldı**; gerçek model bekleniyor |
| SQLite yerel depo (senkrona hazır şema) | **Bitti** |
| Excel/CSV üretimi ve paylaşımı | **Bitti** — ama sütunlar ekibin tablosuna henüz uyarlanmadı |
| **Merkezi sunucu (Supabase), çok kullanıcı, yönetici panosu** | **YAPILMADI** — sıradaki iş |
| Hata takip döngüsü (atandı → giderildi → doğrulandı) | Şema hazır, arayüz **yapılmadı** |
| Barkod okuma | Kodu yazıldı, **gerçek kamerayla denenmedi** |
| Gerçek cihazda çalıştırma | **Denenmedi** — bu ortamda emülatör yok |

### Neyin nasıl doğrulandığı

Uygulama `expo export --platform web` ile paketlendi ve gerçek Chromium'da
uçtan uca koşuldu: açılış → yeni denetim → VIN doğrulama → SQLite'a yazma →
3B modelin çizilmesi (tuval %37 dolu) → 166 parça içinde arama → hata kaydı →
rapor → koyu tema. Tip denetimi (`strict`) sıfır hatayla geçiyor.

**Native tarafta hiçbir şey denenmedi.** Web paketi, mantığın ve arayüzün
doğru olduğunu gösterir; kamera, barkod, dosya paylaşımı ve WebView'ın tablet
davranışı ancak gerçek cihazda görülür.

**Web'e özgü bilinen kısıt:** SQLite tarayıcıda OPFS kullanır ve aynı anda tek
yazıcıya izin verir; uygulamayı iki sekmede açarsanız ikincisi "kayıtlar
okunamadı" der. Tablette böyle bir kısıt yoktur.
