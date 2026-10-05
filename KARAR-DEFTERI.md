# Karar Defteri — sohbet kaybolursa buradan devam edilir

**Bu dosyanın varlık sebebi.** Ürün sahibi 13.09.2026'da "bu sohbet asla
silinmesin" dedi. Sohbetin kendisi korunamaz — o, Claude hesabında duruyor ve
depodan erişilemiyor. Doğru çözüm sohbeti kilitlemek değil, **sohbete bağımlı
olmamak**: burada yalnız konuşmada geçen, başka hiçbir dosyada yazmayan
kararlar ve açık işler var.

Kural: bir karar burada yazılıysa **tekrar tartışılmaz**, uygulanır. Değişmesi
gerekiyorsa satır güncellenir ve tarihi değişir.

---

## 1. Alınmış kararlar — tartışma kapandı

| Tarih | Karar | Kim |
|---|---|---|
| 13.09.2026 | **3 AI deneme hakkı ₺399'luk pakete ait.** Ücretsiz katmanda AI yok. | Ürün sahibi |
| 13.09.2026 | **Android paket adı `com.vekilpro.app`.** İlk Play yüklemesinden sonra DEĞİŞTİRİLEMEZ. | Ürün sahibi |
| 15.09.2026 | **iOS bundle ID de `com.vekilpro.app`.** Eski `com.macroko.legal` bize ait olmayan Apple ekibine (27V4XBQFG4) kayıtlıydı; yeni hesapta kullanılamıyordu. App Store Connect'te YENİ kayıt açılacak, abonelik ürünleri yeniden tanımlanacak. Uygulama hiç yayınlanmadığı için kayıp yok. | Ürün sahibi |
| 13.09.2026 | **Play hesabı kişisel (bireysel).** Bu yüzden 12 test kullanıcısı × 14 gün kapalı test zorunlu — bkz. PLAY.md. | Ürün sahibi |
| 13.09.2026 | **İki abonelik birden**: ₺399 ve ₺2.999. | Ürün sahibi |
| 13.09.2026 | **Vurgu rengi altın (`#E3C275`)**, açık mavi kaldırıldı. Hem uygulamada hem tanıtım sitesinde. | Ürün sahibi |
| 13.09.2026 | **Eczane (İlaçPro) tablolarının disk maliyeti konusu kapandı.** "Daha fazla yer kaplamıcak, kaplarsa genişletirim." Bir daha maliyet gerekçesiyle gündeme getirilmez. KVKK ayrım kuralı AYRI ve geçerli (bkz. AGENTS.md). | Ürün sahibi |
| önceki | **Disk freni 30 GB.** "Ek ücret öderim." Supabase Pro'da 8 GB dahil, üstü $0,125/GB/ay → 30 GB'da ayda +$2,75. | Ürün sahibi |
| 26.09.2026 | **Tevkil panosu ve meslektaş mesajları KAPATILDI** ("tevkili kapat"). Rotalar/ekranlar silindi, KVKK metninden başlık çıktı, 0158 ile erişim kapandı; veri silinmedi. 14.09'daki "geri açıldı" kararının yerine geçer. | Ürün sahibi |
| 25.09.2026 | **T.C. Kimlik No kayıtta isteğe bağlı** (Apple 5.1.1). Girilirse doğrulanır. | Ürün sahibi (Apple reddi üzerine) |
| 26.09.2026 | **Geçmiş DURUM.md'de tutulur**, CLAUDE.md'den otomatik yüklenir; her önemli adımda güncellenir. | Ürün sahibi |
| 26.09.2026 | **Az soru:** "sorma, hepsine evet diyorum". Yalnız gerçekten ürün sahibine ait kararlar sorulur. | Ürün sahibi |
| 28.09.2026 | **Ücretsiz katmana 5 yapay zekâ deneme sorusu, Haiku ile.** 13.09'daki "ücretsizde AI yok" kararının yerine geçer. Vekil Pro'da toplam 10. | Ürün sahibi |
| önceki | **PR'ları Claude kendi merge eder.** "sen et merge her zaman" | Ürün sahibi |
| 14.09.2026 | **Tevkil panosu, sohbet ve günün sorusu yayından ÇIKARILDI.** Silinmediler; `src/ekranlar-beklemede/` altında duruyorlar (1.928 satır). Sebep: menüde yoktular ama derin bağlantıyla açılabiliyorlardı, bu da Play içerik anketini ve KVKK metinlerini yanlış duruma düşürüyordu. **Geri açma sırası: önce KVKK/gizlilik metinleri, sonra ekranlar, sonra PLAY.md 4.3.** | Ürün sahibi onayı ile |

## 2. Değişmez güvenlik kuralları

Bunlar istekle bile gevşetilmez; daha önce teklif edildi ve reddedildi.

- **`service_role` / `sb_secret_...` anahtarı hiçbir koşulda alınmaz, istenmez,
  yazılmaz.** RLS'i baypas eder; sızarsa tüm avukat verisi gider.
- **Hesap şifresi, panel erişimi kabul edilmez.** Teklif edildi, reddedildi.
- **`EXPO_TOKEN`, `GOOGLE_PLAY_SERVICE_ACCOUNT`, `RESEND_API_KEY`** yalnız
  GitHub Secrets'a, ürün sahibi tarafından eklenir. Sohbete, ekran görüntüsüne,
  depoya asla yazılmaz.
- App Store Connect `.p8` anahtarı ve RevenueCat webhook sırrı paylaşılmaz.
  Yalnız public `appl_`/`goog_` anahtarları güvenli. Supabase anon anahtarı
  tasarımı gereği açıktır.
- **Bu sohbette hiçbir sır yok** — hepsi reddedildiği için. Yani sohbetin
  silinmesi bir güvenlik kaybı değil, yalnız hafıza kaybı olurdu. Bu dosya o
  boşluğu kapatıyor.

## 3. Ürün sahibinin yapacakları — sırayla

Bunları Claude yapamaz; panel erişimi gerektiriyor.

- [ ] **`VEKILPRO` adlı GitHub secret'ını sil ve o Expo token'ını iptal et.**
      (Ekran görüntüsünde açığa çıkmıştı; iptal edilmediyse hâlâ geçerli.)
- [x] ~~Göçleri canlı Supabase'de çalıştır~~ — **Claude yaptı 14.09.2026.**
      `0131` (çalışma kaydı) ve `0132` (0091'in yarım kalan indeksleri) mevcut
      `SUPABASE_ACCESS_TOKEN` ile uygulandı. Sonra `0133_canli_dogrulama.sql`
      (salt okunur) koşuldu ve canlı şema **ölçüldü**: `amount` gerçekten
      `ALWAYS` hesaplanan sütun, RLS açık (`time_entries own`), sahiplik
      tetikleyicisi yerinde, üç CHECK kısıtı duruyor, `profiles.hourly_rate`
      numeric, indekssiz FK kalmamış, canlı kayıt sayısı 0. Sekiz ölçüm de
      yereldekiyle aynı çıktı. Ürün sahibinden bir şey gerekmiyor.
- [x] ~~App Store Connect'te `com.macroko.legal` kaydı var mı bak.~~ Konu kapandı 15.09.2026: bundle ID `com.vekilpro.app` yapıldı, eski kayıt kullanılmayacak.
      Yoksa iOS de `com.vekilpro.app`'e hizalanabilir.
- [ ] Play Console'da uygulamayı `com.vekilpro.app` paketiyle oluştur.
- [ ] AAB'yi iç teste yükle, gerçek telefona kur. **Uygulama bugüne kadar
      gerçek bir Android cihazda HİÇ çalıştırılmadı.**
- [ ] Play formlarını doldur (metinler hazır: PLAY.md bölüm 4-5).
- [ ] İki abonelik ürününü tanımla (PLAY.md bölüm 3).
- [ ] 12 test kullanıcısı bul, 14 gün kapalı test.
- [ ] Ticari unvan belli olunca `src/config/kvkk.ts` → `VERI_SORUMLUSU` doldur;
      aynı bilgi privacy.html ve hesap-silme.html'e de yazılacak.
- [ ] Depo adını `macro_ko` → `vekilpro` değiştir. Sonrasında
      `github.io/macro_ko` geçen 4 dosya güncellenmeli.

## 4. Son yapılan derleme

| Alan | Değer |
|---|---|
| APK (telefona kurulur) | Koşu #6 — 14.09.2026, commit `1f1d35a`, `preview` profili, 34,7 dk sürdü. **Burak abiye gidecek olan bu.** <br>https://expo.dev/accounts/olivyeejiru/projects/macro_ko/builds/7be3b109-a75d-458a-899c-0c3de6895f6e <br>Android telefonda açılır, sayfadaki düğme kurar. Play'e GİTMEDİ ve kapalı test süresini saymaz. |
| AAB (Play'e yüklenir) | Koşu #5 — 14.09.2026, commit `4a6f660`. Bağlantı Actions kaydında. |
| Son OTA | Koşu #22 — 14.09.2026, commit `c3abe7b`, dal `production`, **çalışma zamanı 3.3.2** (EAS çıktısından okundu, APK ile eşleşiyor). İçerik: toplu aktarım ekranı + menü girişi — bunlar APK derlendikten SONRA yazıldığı için pakette yoktu. |
| Önceki AAB | `eUwBZnQwOAjMRrR04z5FmpWZbbGUqibpZkxnjxrTZkw.aab` (`bc8f206`) — **ARTIK KULLANMAYIN**, zaman kaydını, makbuzu, gecikme düzeltmesini ve ekran temizliğini içermiyor |
| İçerik | `com.vekilpro.app` + altın vurgu + zaman kaydı + makbuz dökümü + safha gecikme düzeltmesi + erişilemeyen ekranların çıkarılması |
| Expo hesabı | `olivyeejiru` |

> `versionCode` EAS'te tutuluyor (`appVersionSource: remote`), `app.json`'daki
> değer YOK SAYILIR.

**Ne zaman OTA yeter, ne zaman derleme şart** — 14.09.2026'da soruldu, ölçüldü:

| Değişen şey | Yol | Süre |
|---|---|---|
| Ekran, metin, iş mantığı, dil dosyası, hesaplama | **OTA** (`ota-yayinla.yml`) | ~3 dk |
| Yeni kütüphane, izin, ikon, paket adı, `version` | **Derleme** (`android-dagit.yml`) | ~35 dk |

Kural: `package.json` bağımlılıkları ya da `app.json`'ın native alanları
değişmediyse OTA yeter. Bugünkü APK gerçekten gerekliydi —
`POST_NOTIFICATIONS` izni ve `com.vekilpro.app` paket adı native'di.

**Sessiz tuzak:** `runtimeVersion` politikası `appVersion`. `app.json`'daki
`version` yükseltilirse eski derlemeler yeni OTA'ları **hiç almaz** ve bu
hata vermez — sadece hiçbir şey olmaz. Sürüm yükseltmek, elde derleme
olmadan, sahadaki tüm kurulumları güncellemesiz bırakır.

## 4a. Hasat — asıl sınır disk, hız değil (14.09.2026)

**Bir daha "hasadı hızlandıralım" diye başlanmasın diye ölçüm burada.**

Hasat YAVAŞ DEĞİL: metin hızı **615 karar/saat = 14.770/gün**, tasarlanan
teorik tavanın (14.400) üstünde. Sınır disk:

| Ölçüm | Değer |
|---|---|
| Havuz | 44.137 karar · karar başına **28,1 KB** |
| ~~6000 MB frenine kalan~~ | ~~135.890 karar → ~9 gün~~ **← BU YANLIŞTI, aşağıya bak** |
| **Canlı fren eşiği** | **30.000 MB** (ürün sahibinin 30 GB kararı) |
| Bugünkü boyut · artış | 2.280 MB · **363,7 MB/gün** (son 24 saatte 13.252 karar) |
| **>> Frene kalan** | **76 gün** |
| 30 GB'a sığan karar | ~1.093.000 |
| Katalog | 2.376.678 künye (metni bekleyen 2.353.945) |
| Katalogun tamamı bugünkü maliyetle | **63,7 GB** — 30 GB kararının 2 katı |


> ⚠️ **DÜZELTME (14.09.2026, aynı gün).** Yukarıda önce "6000 MB frenine
> ~9 gün" yazmıştım ve bunu ürün sahibine de öyle söyledim. **Yanlıştı.**
> Sebep: `0121` ölçüm dosyasının İÇİNDE 6000 sayısı sabit yazılı ve o sayı
> eskimiş; canlı frenin gerçek eşiği `disk_musait_mi` fonksiyonunda
> **30.000 MB**. Yani 0121'in çıktısını okurken onun kendi varsayımını
> ölçüm sandım. Doğrusu 0139 ile canlıdan okundu: **76 gün.**
>
> Ders: bir ölçüm dosyasının çıktısı, o dosyanın içine gömülü sabitler kadar
> güvenilirdir. `0121`'deki 6000 düzeltilmeli.

**28,1 KB nereye gidiyor** (2000 satır örneklem, 0136):
`full_text` **4,5 KB** · `fts` 7,3 KB · `fts_simple` **10,0 KB** · diğer 1,1 KB.
Yani iki arama vektörü metnin 3,8 katı ve satırın %76'sı.

### Yapıldı (0138, canlıya uygulandı, geri alınabilir)
- Metin indirme kotası **40 → 15**. Sebep: 40'lık upsert `statement timeout`
  yiyip turun tamamını kaybettiriyordu (eklenen 0). Yavaşlatma değil.
- Katalog genişletme **4 dk → 30 dk** (~%95). Sebep: katalog metinden 76 kat
  önde (159 yıllık kuyruk) ve 0129'da ölçüldüğü gibi aynı kamu kaynağına
  yüklenip **avukatın beklediği AI cevabını** yavaşlatıyor.
- Etki henüz ÖLÇÜLMEDİ; bir sonraki 0121 koşusunda bakılacak.

### DENENDİ VE REDDEDİLDİ — stored tsvector'leri düşürmek
Cazip görünüyordu: 28,1 → ~10,8 KB, katalogun tamamı 24,5 GB'a iner ve
mevcut 30 GB kararının içine sığardı. **Yerel kıyasla ölçüldü, reddedildi.**

| Şema | Toplam boyut | Sıralı arama |
|---|---|---|
| stored tsvector (bugün) | 931 MB | **455 ms** |
| ifade indeksi | 454 MB | **60 sn'de bitmedi** |

Sebep: `0113` sıralama için `ts_rank(k.fts, tq)` kullanıyor; sütun olmayınca
tsvector her eşleşen satırda yeniden hesaplanıyor (birim maliyet ~1,9 ms/satır,
19,5 KB metinde). Disk 2 kat iyileşiyor ama arama kullanılamaz hale geliyor.

**Ara yol (doğrulanmadı):** yalnız `fts_simple`i düşürmek — 0113'te sıralama
için değil, yalnız `@@` önek eşleşmesinde kullanılıyor ve `@@` indeksten
cevaplanabilir. Karar başına 28,1 → ~18,1 KB olurdu. **Sentetik veriyle
doğrulanamadı**: ürettiğim metinde her satır her kelimeyi içerdiği için her
sorgu her satırla eşleşti ve planlayıcı indeksi hiç kullanmadı. Gerçek
seçicilikte ölçmek gerekir.

### Açık kalan — ürün sahibi kararı
2,37 milyon kararın tamamı bugünkü maliyetle saklanamaz. Seçenek: kapsamı
daraltmak (hangi mahkeme / hangi yıl aralığı avukat için değerli), ya da
diski büyütmek. Bu teknik değil ürün kararı.

## 4b. Araç değerlendirmesi — graphify (14.09.2026)

**Karar: bağımlılık olarak alınmadı. Ara sıra kullanılabilir, ama Grep'in
yerine geçmez.** Bir daha "bunu kullansak mı" diye tartışılmasın diye ölçüm
burada.

Ürün sahibi duyup sordu ("verimini artırıyormuş"). Gerçek bir araç —
`Graphify-Labs/graphify`, PyPI'da `graphifyy` (çift y; `graphify` adı başkasında),
Apache-2.0, sürüm 0.9.61. Kod tabanını tree-sitter ile yerel olarak ayrıştırıp
bilgi grafiğine çeviriyor. LLM çağırmıyor, **para harcamıyor**.

**ÖLÇÜLDÜ — bu depoda, 4 soruyla.** (Dört soru kapsamlı bir değerlendirme
değildir; aşağısı gördüğüm kadarıdır.)

| Ölçüm | Sonuç |
|---|---|
| İndeksleme | 588 dosya, **21-24 sn**, 5.922 düğüm / 18.459 kenar |
| "AtifDenetimi'ni kim kullanıyor?" | ✅ **Doğru** — 4 ekranı da satır numarasıyla buldu, benim ölçümümle birebir |
| "time_entries nedir?" | 🟡 Tablo→tablo referansları ve indeksler var, **sütun adları YOK** |
| "Pano ekranından jobs tablosuna yol?" | ❌ **Bulamadı** |
| SQL desteği | Ayrı kurulum ister (`graphifyy[sql]`); yoksa 154 göç grafiğe hiç girmiyor |

**Neden bizde sınırlı kalıyor — iki yapısal sebep:**

1. **Sütun adı taşımıyor.** Bugünkü gerçek hatam `ictihat_kararlar.created_at`
   var sanmaktı; graphify bunu **önleyemezdi**. Çözen şey
   `grep -A14 "create table"` oldu.
2. **TypeScript ile SQL arasında köprü yok.** Veri erişimimiz
   `supabase.from('jobs')` gibi METİN çağrıları; statik AST bunu SQL
   tablosuna bağlayamıyor. Grafik iki ayrı ada hâlinde.

**Sessiz risk — asıl dikkat edilecek nokta.** `src/utils/zamanKaydi.ts` için
"sözdizimi hatası" deyip dosyadan yalnız **14 sembol** çıkardı. O dosya
geçerli TypeScript: `tsc` temiz, 25 test geçiyor. Yani grafik, doğru
görünürken eksik olabiliyor. **%99 doğru bir grafik, tam da otoriter
göründüğü için tehlikelidir.** Doğruluğun önemli olduğu bir soruda cevabı
Grep ile teyit etmeden kullanma.

**Ne zaman işe yarar:** çok dosyaya yayılan bir refactor'ün etkisini görmek,
tanımadığın bir bölüme oryantasyon. Maliyeti düşük (~40 sn kurulum+indeks),
çıktısı `graphify-out/` (10 MB, `.gitignore`'da).

## 5. Açık işler — sıradaki gündem

Tam gerekçeler `RAKIP-OZELLIK-ANALIZI.md`'de.

1. ✅ Zaman/çalışma kaydı — yazıldı, canlıya uygulandı ve canlıda **ölçüldü**
   (0133). Hiçbir avukat henüz kullanmadı: canlı kayıt sayısı 0.
2. ✅ Serbest meslek makbuzu dökümü — yazıldı. Gerçek bir makbuzla
   karşılaştırılmadı; doğruluğu Burak abi teyit edene kadar **varsayım**.
2b. ⏸ **Tevkil panosu + sohbet geri açma** — kod hazır, park edildi.
    Açılacaksa sıra: KVKK metinleri → ekranlar → PLAY.md 4.3 → yeni AAB.
3. 🟡 **İçe aktarım** — ekran ve ayrıştırıcı YAZILDI (`app/toplu-aktar.tsx`,
   `src/utils/iceAktarim.ts`, 27 test). Ama testlerdeki örnek dosyaları **ben
   uydurdum**: Türkçe Excel'in noktalı virgülü, BOM'u, tırnaklı hücresi gibi
   bilinen tuzaklar karşılanıyor. **GERÇEK bir UYAP/Sinerji/KolayOfis dışa
   aktarma dosyasıyla hiç denenmedi.** Ölçülen şey ayrıştırıcının benim
   tanımladığım kurallara uyması; gerçek dosyayı okuyabildiği DEĞİL.
   Ürün sahibinden hâlâ bir gerçek dosya bekleniyor — ama artık iş o dosyayı
   beklemiyor, yalnız doğrulaması bekliyor.
4. ⏸ Müvekkil portalı — verinin RLS sınırından çıktığı ilk özellik olur;
   ürün sahibi kararı gerekiyor
5. ⏸ Ekip/büro dosya paylaşımı — en büyük mimari iş, her tablonun RLS
   politikası değişir
6. 🟡 **UYAP — "yapılamaz" demiştim, YANLIŞTI.** Düzeltildi 14.09.2026.
   İki ayrı yol var ve ben ikisini birbirine karıştırıp ikisine birden
   "olmaz" dedim:
   - **Kurumsal web servis** (MoJ protokolü, sunucuda SSL sertifikası, özel
     şirketler için 4.000+ dosya şartı, dosya başı yıllık ücret) — bu gerçekten
     bugün bizim için kapalı.
   - **Avukatın kendi e-imza/m-imzasıyla kendi tarayıcısında** portala girmesi
     — sertifikasyon istemiyor. Bunun ne kadarının bize yaradığı
     `UYAP-ENTEGRASYON-YOLU.md`'de yazılı.
   Ürün sahibinin e-imzası yok; ilk somut adım bu yüzden Burak abinin
   portaldan aldığı **gerçek bir dışa aktarma dosyası** (madde 3 ile aynı
   dosya).

**`finance_entries`'te müvekkil bağı yok** (`client_id` sütunu yok, ölçüldü) —
bu yüzden makbuz ekranında müşteri adı elle giriliyor. Eklenirse orası
ön-dolar.

**Açık iş (DURUM'dan taşındı, 05.10.2026):** hasat talep sayacı
(`hasat_konu_talep`, 0162/0163) 03.10'da HİÇ kayıt tutmamıştı; sebebi
bulunamadı.

## 5a. Avukat geri bildirimi turu (04.10.2026)

Ürün sahibinin aktardığı avukat geri bildirimleri, geliş sırasıyla (PR #142).

- **"Üretilen dilekçeye düzeltme butonu"** — düzenleme ZATEN vardı ama 13 px'lik
  bir yazıydı; `ai_cikti_geri_bildirim` tablosunda o güne kadar 0 satır vardı.
  Çerçeveli Düzelt düğmesi + uzun metnin altında tekrar. Ders: var olan özellik
  bulunamıyorsa yoktur.
- **"UDF'de yüklemede sıkıntı var, sözleşmede yok"** — iki ayrı kusur: kasa
  seçicisinde `.udf`/`*/*` yoktu (iPhone'da gri), web'de `*/*` tarayıcı
  süzgecine girmiyor (Chromium `GetFileTypesFromAcceptType` MIME'i uzantıya
  çevirir; UDF'nin MIME'i yok). Üretilen UDF de UDF-Toolkit şablonuna hizalandı
  (1.8, `hvl-default` stili). UYAP Editör Linux 5.4.20 indirildi; gerçek
  editörde açma denemesi ürün sahibi durdurduğu için YAPILMADI.
- **"Bu tarafta hiç belge ekle yok"** — Belge Arşivi'nde FAB içe aktarılmış ama
  hiç çizilmemişti (12.09'dan beri); yükleme rotası hiçbir yerden açılmıyordu.
- **"Dilekçe Üret'e dosya ekleme" + "PDF sadece yazıları çıkarıyor"** — PDF artık
  Claude'a belge bloğu (sayfa görüntüsü + metin). Tavanlar ürün kararı: 3 ek,
  20 sayfa görüntü, 8 MB. Maliyet TAHMİN: Anthropic örneğinde sayfa başı ~2.300
  token; gerçek değer `ai_istek.tokens_in`'den okunacak.
- **"Toplu Aktarım / Derin Araştırma ne yapıyor belirsiz"** — Toplu Aktarım
  menüden çıktı (2 ekran açılışı); Derin Araştırma satılan özellik (2 kullanım),
  silinmedi, adı Hukuki Araştırma oldu.
- **"Ekstra mikrofon"** — web'de tarayıcının konuşma tanıması. Chrome sesi kendi
  hizmetine gönderir (MDN); not düğmenin yanında. Telefonda uygulama içi mikrofon
  yeni derleme ister — ürün sahibi kararı bekliyor.
- **"Yapay zekâ yavaş, cevaplar kısa" → SOHBET HAIKU.** Ölçüm (03.10, 12 istek):
  sohbet 24–38 sn, model ~100 token/sn yazıyor; ~20 sn modelden bağımsız
  arama/denetim adımları (doğrusal uydurmadan çıkarım). Kısalık, sistem
  talimatındaki 500/900 karakter kuralından (11.09, benim ölçüm setim). Önerim
  Haiku DEĞİL, paralelleştirme + kural gevşetmeydi; ürün sahibi "haiku'ya
  geçelim, test edeceğiz" dedi — karar onun, uygulandı (ai-chat v136). 01.10'da
  tersi yapılmıştı ("haiku kötüyse sonnete geçelim"); karşılaştırma ölçülerek
  yapılmalı.

### Haiku / Sonnet ölçümü (04.10.2026, ürün sahibinin 1 $ bütçesiyle)

Aynı 7 senaryo, cevaplar okunarak değerlendirildi (senaryoları ben seçtim,
tek deneme). Haiku ₺5,77; Sonnet ₺9,01 + mütalaa yeniden ₺3,94 + düşen ilk
Sonnet mütalaasının kaydedilemeyen maliyeti (TAHMİN ≤ ₺6). Haiku: hız
kazancı yok, dilekçede dava değeri/faiz hatası, incelemede yanlış TBK maddeleri
(189, 489), sık yazım hatası. Sonnet: sohbet, dilekçe, inceleme ve araştırma
temiz; emin olmadığı madde numarasını yazmak yerine "teyit edin" diyor. Ürün
sahibi "sonnet yap" dedi → her iş Sonnet 5. Yan bulgu: Sonnet + düşünmeyle
mütalaa Supabase süre sınırına (150 sn) çarpıyordu; düzeltildi.

## 5b. Rakip yorumlarından ders — Apilex (04.10.2026, ürün sahibi: "apilexte olan sorunları yorumlardan al, bizde olmasın")

Ölçüm: App Store TR, Apilex (id 6752776204, sürüm 1.3.4, 4,73★ / 271 oy),
iTunes RSS ile 55 yazılı yorum (22.03–30.09.2026): 48×5★, 1×2★, 6×1★.
Google Play: 4,2★ / 140 yorum görüldü ama yorum metinleri çekilemedi
(sayfa JS'le çiziyor; üç deneme) — Android şikâyetleri OKUNMADI.

| Apilex şikâyeti (1–2★) | Bizde ölçülen | Yapılan |
|---|---|---|
| Doğrulama kodu/e-postası gelmiyor, hesap açılamıyor (3 yorum) | Kendi SMTP (Resend, noreply@vekilpro.app, 200/sa) tanımlı; doğrulama açık; ama "tekrar gönder" HİÇ YOKTU | Kayıt bekleme ekranı + girişte "doğrulanmamış" hatasına tekrar gönder düğmesi (25 sn geri sayım; sunucu süresi kazanır) |
| Ücretsiz deneme yok, fiyat anlaşılmadan alınamıyor (2) | 10 ücretsiz soru; vitrin ve tanıtım metninde yazılı; fiyat mağazadan okunuyor | — |
| "Paket değiştirin" → "uygun paket bulunamadı" (satın alma kırık) | RevenueCat ölçüldü: default ve ai tekliflerinde yalnız aylık; ekran yalnız var olan paketi gösterir | — (yıllık ASC'de hâlâ eksik; ekran onu göstermiyor) |
| Uygulama 400 TL + içeride paket | İndirme ücretsiz | — |
| "Çalışmıyor" | ErrorBoundary var; çökme raporlama YOK | — (açık) |

**Canlı ölçüm (05.10.2026 06:24–06:25 UTC, ürün sahibi "emin ol"):** anon
anahtarla gerçek kayıt (`mustafayalvac244+vekil-dogrulama-0624@gmail.com`,
plus-adres; doğrulanmadı, SİLİNMEDİ — silme onayı verilmedi) → /signup 200,
1,6 sn (SMTP içinde, hata yok) → hemen /resend → **429 "18 saniye sonra"**
(uygulama bu sayıyı geri sayıma koyar) → 37 sn sonra /resend → **200, 1,0 sn**,
auth_logs'ta hata yok. Captcha: Turnstile anahtarı derlemede yok, sunucu
captcha'sız isteği kabul etti. Gelen kutusuna DÜŞTÜĞÜ ölçülmedi (Gmail okuma
yetkisi yok); ürün sahibi kendi kutusunda iki doğrulama e-postası görmeli.

5★ yorumlarda övülenler (bizde durumu): kaynakça veren agent (atıf denetimi
var), projeler/dosya entegrasyonu (dava dosyası var), Resmî Gazete özeti
(YOK), sözleşme üretme (dilekçe var, sözleşme şablonu ÖLÇÜLMEDİ), web+mobil
(var).

## 5c. Neden satmıyor — huni ölçümü (05.10.2026, ürün sahibi: "kimse almıyor, şapkayı önüne koy düşün, bu senin programın")

Ölçüldü (canlı veritabanı, test kalıplı hesaplar ve ürün sahibi hariç):
- 02.07–05.10 arası **15 gerçek hesap**; 14'ü giriş yapmış, 5'i ertesi
  gün(ler)de dönmüş, 4'ü dava, 4'ü müvekkil açmış, 7'si yapay zekâ denemiş.
- Gerçek satış **0**. Satın alma ekranı iOS'ta 3 kez açılmış (03.10), **1**
  satın alma başlatılmış, Apple ödeme ekranında **vazgeçilmiş**.
- App Store'da 0 oy, 0 yorum. Web'de satın alma yok (yalnız iPhone); Android yok.
- Web ekran sayaçlarında `/`, `/login`, `/signup`, `/forgot-password` her
  biri ~100 (03–05.10) — birbirine bu kadar yakın olması gerçek trafik
  değil otomatik ziyaret izlenimi veriyor; AYIRT EDİLMEDİ.

Piyasa (web araması 05.10.2026, kaynaklar sohbette): De Jure 1.500–6.800 ₺/ay
(baro üyesine %25–40 indirim), Avudex 800/1.600/3.600 ₺/ay + ücretsiz deneme,
Lawlera 594–1.050 ₺/ay (indirimli), KatipAI 199 → 499 ₺/ay, Lexform ücretsiz,
Apilex 24.999,99 ₺/ay — 39.999,99 ₺/6 ay (bir kaynak), web'den satış hepsinde.
Bizim AI paketi **2.999 ₺/ay**, yalnız iPhone'dan.

Maliyet (ölçüldü 03.10): soru başı ~₺2,1–2,2 (Sonnet). Ücretli tavan bugün
kullanıcı başına ₺3.000/ay maliyet + 750 soru (katman.ts) — fiyat düşerse
tavan da düşmeli, yoksa yoğun kullanıcı zarar ettirir.

## 5d. Performans — model dışı bekleme nerede (05.10.2026, ürün sahibi: "fiyatla alakası yok, performanstan memnun değiller")

Modelsiz kuru koşu (ai-chat `x-kuru-kosu`, scripts/olcum-adim.mjs; 04.10'da
Sonnet'in ürettiği 7 gerçek cevap × 2, harcama ₺0, sonuç
scripts/olcum-adim-sonuc.json): besleme_mevzuat 3,0–16,3 sn, besleme_ictihat
0,8–16,8 sn; denetimler (madde/künye/canlı teyit) < 0,6 sn; embedding ~0,3 sn.

Veritabanında ayrı ölçüm (EXPLAIN ANALYZE): kararlar_madde_ile 5.429 ms
(her soruda 3 kez) — sebep `select distinct kanun` 337 bin satır tarıyordu;
search_ictihat_fts önek basamağında count(*) 14.176 ms.

0172 (05.10 20:10 UTC, GitHub Actions arızası yüzünden iş akışıyla değil
Supabase apply_migration ile uygulandı): kararlar_madde_ile **136 ms**;
search_ictihat_fts kira sorusunda **4.266 ms** (kalan süre disk okuması —
5,1 GB tablo, hasat sürekli yazıyor; ÇÖZÜLMEDİ). Sonuç eşitliği: madde 5/5
aynı; fts 11/12 aynı, farklı olanda ESKİ fonksiyon da kendi içinde kararsız
(sırasız limit 1500 — ayrı kalite sorunu, açık).

Uçtan uca kuru koşu 0172 sonrası TEKRARLANMADI (Actions arızası).

## 6. Nerede ne yazıyor

| Dosya | İçeriği |
|---|---|
| `AGENTS.md` | Dürüstlük kuralları, sağlık verisi ayrımı — **her oturumda geçerli** |
| `PLAY.md` | Google Play çıkış planı, mağaza metinleri, formlar |
| `TESLIM.md` / `APPSTORE.md` | iOS yayın ve devir |
| `RAKIP-OZELLIK-ANALIZI.md` | Rakip taraması, ölçülen boşluklar |
| `YAYIN-DENETIMI.md` | Çıkış öncesi denetim: ne ölçüldü, ne ölçülmedi |
| `BEKLEME-PENCERESI.md` | Google doğrulaması beklerken yapılacak işler |
| `BURAK-TEST-LISTESI.md` | Gerçek avukata verilecek test listesi |
| `UYAP-ENTEGRASYON-YOLU.md` | UYAP'ın hangi yolu açık, hangisi kapalı |
| `UYAP-NOTU.md` | Bedesten içtihat ucu — ölçülmüş, başka projeye verilebilir |
| `MIMARI-DEVIR.md` | Eczane uygulaması devir notu (veritabanı paylaşılmaz) |
| `YEDEK.md` / `YEDEKLEME.md` | Yedekleme düzeni |
| `IAP_KURULUM.md` / `ODEME.md` | Abonelik ve ödeme kurulumu |

---

## Neden şifre koymuyoruz

Bir dosyaya şifre koymak burada koruma değil, **yanlış güven** üretirdi:
depo GitHub'da duruyor ve depoya erişebilen dosyayı zaten okur. Gerçek koruma
üç yerde: deponun kendi erişim izinleri, GitHub Secrets (anahtarlar için) ve
Supabase RLS (avukat verisi için). Üçü de kurulu.
