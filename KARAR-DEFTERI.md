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
| 13.09.2026 | **Android paket adı `com.vekilpro.app`.** İlk Play yüklemesinden sonra DEĞİŞTİRİLEMEZ. iOS'ta `com.macroko.legal` duruyor (App Store kaydı zaten var). | Ürün sahibi |
| 13.09.2026 | **Play hesabı kişisel (bireysel).** Bu yüzden 12 test kullanıcısı × 14 gün kapalı test zorunlu — bkz. PLAY.md. | Ürün sahibi |
| 13.09.2026 | **İki abonelik birden**: ₺399 ve ₺2.999. | Ürün sahibi |
| 13.09.2026 | **Vurgu rengi altın (`#E3C275`)**, açık mavi kaldırıldı. Hem uygulamada hem tanıtım sitesinde. | Ürün sahibi |
| 13.09.2026 | **Eczane (İlaçPro) tablolarının disk maliyeti konusu kapandı.** "Daha fazla yer kaplamıcak, kaplarsa genişletirim." Bir daha maliyet gerekçesiyle gündeme getirilmez. KVKK ayrım kuralı AYRI ve geçerli (bkz. AGENTS.md). | Ürün sahibi |
| önceki | **Disk freni 30 GB.** "Ek ücret öderim." Supabase Pro'da 8 GB dahil, üstü $0,125/GB/ay → 30 GB'da ayda +$2,75. | Ürün sahibi |
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
- [ ] App Store Connect'te `com.macroko.legal` kaydı gerçekten var mı bak.
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
