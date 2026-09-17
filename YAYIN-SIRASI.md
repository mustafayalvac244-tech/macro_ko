# Yayın Sırası — tıkla ve yap

> **16.09.2026.** Ürün sahibi: *"Apple'dan ve Google Play'den salalım."*
>
> **ÖNCE DÜRÜST CEVAP: bugün mağazada yayına giremeyiz.** Sebebi kod değil,
> ikisi de dışarıdan gelen iki kural:
>
> | engel | ne zaman kalkar |
> |---|---|
> | EAS ücretsiz plan Android derleme kotası doldu | **1 Ekim 2026** (ya da Starter planına geçilirse bugün) |
> | Play kişisel hesap: 12 test kullanıcısı × **14 kesintisiz gün** kapalı test | Kapalı testi başlattığın günden 14 gün sonra |
>
> **Ama bugün yapılacak en değerli şey var ve 1 Ekim'i beklemiyor:** kapalı
> testi elinde HAZIR DURAN AAB ile bugün başlat. İki bekleme üst üste biner,
> yan yana değil. Ayrıntı: `PLAY.md` §0.1.

---

## Hazır olanlar (ben yaptım) — kaç tane gerekiyor, kaç tane var

| ne | mağaza şartı | üretilen | nerede |
|---|---|---|---|
| **Play** telefon görseli | en az 2, **en çok 8** | **8** ✅ | `magaza-pazarlama/play/01…08` |
| **Play** öne çıkan görsel | **1 zorunlu**, tam 1024×500 | **1** ✅ | `play/feature-1024x500.png` |
| **Play** uygulama simgesi | **1 zorunlu**, tam 512×512 | **1** ✅ | `play/icon-512.png` |
| **App Store** iPhone 6.7" | en az 1, en çok 10 | **8** ✅ | `magaza-pazarlama/ios/01…08` |
| **App Store** iPad 13" | **zorunlu** (`supportsTablet: true`) | **4** ✅ | `magaza-pazarlama/ipad/01…04` |

> **iPad'i az kalsın atlıyordum.** `app.json`'da `ios.supportsTablet: true`
> olduğu için Apple iPad görselini ZORUNLU tutuyor ve olmadan gönderim
> reddedilir. 2048×2732 boyutunda dört görsel üretildi; iPad'in iki sütunlu
> düzeni telefondan farklı göründüğü için bunlar çerçevesiz, ham hâlleriyle
> kullanılıyor — Apple bunu kabul ediyor ve tablet düzenini olduğu gibi
> göstermek daha dürüst.
>
> Alternatif: `supportsTablet: false` yapmak. O zaman iPad görseli
> gerekmez ama iPad kullanan avukatlar uygulamayı App Store'da bulamaz.
> Karar senin; bugünkü hâliyle iPad destekli gidiyoruz.

**Vitrin sırası** (ürün sahibi kararı): yapay zekâ başta, ücretsiz olan
ayrıca ve açıkça yazılı.
1. Uydurmayan yapay zekâ · 2. Duruşmadan çıkın, süre hazır ·
3. UYAP dosyasını atın · 4. Gününüz tek bakışta ·
5. Duruşma ve süreler **ücretsiz** · 6. Vekâlet ücreti hesaplı ·
7. Hesaplayıcılar **ücretsiz** · 8. Dilekçe taslağı

**Görsellerde sayı ve fiyat YOK** (ürün sahibi kararı): rakam eskir ve
eskiyen rakam yalan olur; özellik eskimez.

| diğer | nerede |
|---|---|
| Gizlilik politikası | https://vekilpro.app/privacy.html |
| Kullanım koşulları | https://vekilpro.app/terms.html |
| Hesap silme sayfası | https://vekilpro.app/hesap-silme.html |

Yeniden üretmek için:
```
VP_TEMA=dark node scripts/magaza-ekranlari.mjs
VP_TEMA=dark VP_EKRANLAR=/durusma-cikisi,/dosya-aktar,/laws,/calculators,/dilekce-uret node scripts/magaza-ekranlari.mjs
node scripts/magaza-pazarlama.mjs
```

---

# A) GOOGLE PLAY

## A0 · Play kaydını AÇ — bu adım eksikti (16.09.2026)

**ÖLÇÜLDÜ, ürün sahibinin Play Console ekran görüntüsünden:** hesapta
**yalnız 1 uygulama** var ve o İlaçPro (`com.ilacpro.app`). **Vekil Pro'nun
Play kaydı hiç açılmamış.**

Bu bölüm bugüne kadar "uygulamayı aç" diye başlıyordu — yani açılmış bir
kayıt olduğunu **varsayıyordu**. Ürün sahibine defalarca "kapalı testi
başlat" dendi; başlatılacak kayıt yoktu. Varsayım doğrulanmadan yazıldığı
için kimse fark etmedi.

**Hesap künyesi (aynı ekran görüntüsünden):**

| | |
|---|---|
| Hesap adı | Vekilpro |
| Tür | **Kişisel hesap** → 12 test kullanıcısı × 14 gün şartı geçerli |
| Uygulama sayısı | 1 (İlaçPro) |
| İlaçPro durumu | Taslak · **Dahili test** · İncelemede · 0 kullanıcı |

**Üretim erişimi muafiyeti YOK.** 12×14 şartı uygulama başına değil hesap
başına ve bir kez üretim erişimi alınınca sonraki uygulamalar muaf oluyor —
ama bu hesap hiç üretime çıkmamış. İlaçPro **dahili testte** ve dahili test
o sayaca **saymıyor**; sayan şey kapalı test.

**Yapılacak:** https://play.google.com/console → **Uygulama oluştur**
- Ad: `Vekil Pro: Avukat Asistanı`
- Dil: Türkçe · Uygulama · Ücretsiz
- Beyanlar (içerik politikası + ABD ihracat yasaları)

Kayıt açılınca A1'e geç.

## A1 · Kapalı testi başlat — en kritik adım

Bu, 14 günlük sayacı başlatır. Beklemenin tek sebebi bu adımın geciktirilmesi
olur.

1. **Play Console** → https://play.google.com/console
2. A0'da açtığın uygulamayı aç (paket adı `com.vekilpro.app`)
3. Sol menü → **Test** → **Kapalı test** *(dahili test DEĞİL — o sayılmıyor)*
4. **Yeni sürüm oluştur** → şu AAB'yi yükle:
   ```
   https://expo.dev/artifacts/eas/eUwBZnQwOAjMRrR04z5FmpWZbbGUqibpZkxnjxrTZkw.aab
   ```
   Bu koşu #4'ten kalan, paket adı doğru (`com.vekilpro.app`), sürüm 3.3.2.
   3.4.0 hazır olunca aynı kanala yeni sürüm olarak eklenir.
5. **Test kullanıcıları** sekmesi → e-posta listesi oluştur → **12 kişi ekle**
   (Google gerçek Google hesabı istiyor)
6. Sürümü **yayınla** ve test bağlantısını 12 kişiye gönder

> **14 gün KESİNTİSİZ.** Biri çıkıp tekrar girerse onun sayacı sıfırlanır.
> 12 sayısı, 14 günü aralıksız tamamlamış kişi sayısı — o yüzden 12 değil
> **14-15 kişi** ekle, birkaç kişi düşse bile 12 kalsın.

## A2 · Mağaza kaydı formları

**Play Console → Uygulama içeriği** altında sırayla:

| form | cevap | kaynak |
|---|---|---|
| **Uygulama erişimi** | Test hesabı ver: `demo@vekilpro.app` *(is_premium açıldı 16.09)* | `PLAY.md` §4.1 |
| **Veri güvenliği** | Tablo hâlinde hazır | `PLAY.md` §4.2 |
| **İçerik derecelendirmesi** | "Kullanıcılar içerik oluşturup başkalarına gösterebilir mi" → **HAYIR** | `PLAY.md` §4.3 |
| **Reklam kimliği** | **Kullanılmıyor** | `PLAY.md` §4.4 |
| **Hedef kitle** | 18+ / profesyonel | `PLAY.md` §4.5 |

> **Uygulama erişimi formu atlanırsa RED SEBEBİDİR.** İncelemeci giriş
> ekranının arkasını göremezse uygulamayı inceleyemez.

## A3 · Mağaza vitrini

**Play Console → Büyüt → Ana mağaza girişi**

- **Uygulama adı:** `Vekil Pro: Avukat Asistanı` (26 karakter, sınır 30)
  > Play'de çakışma **yok**; App Store ile aynı olsun diye böyle. Gerekçe
  > aşağıda B2'de.
- **Kısa açıklama (80 karakter):**
  `Avukatın dosyası, takvimi ve içtihadı tek yerde.`
- **Tam açıklama:** aşağıdaki "Mağaza metni" bölümünden kopyala
- **Uygulama simgesi:** `magaza-pazarlama/play/icon-512.png` (tam 512×512)
- **Öne çıkan görsel:** `magaza-pazarlama/play/feature-1024x500.png`
- **Telefon ekran görüntüleri:** `magaza-pazarlama/play/01…08` — **8 PNG**
  *(Play en az 2 istiyor, en çok 8 alıyor; sekizini de koy)*

## A4 · 14 gün sonra

Üretim erişimine başvur → onaylanınca **Üretim** kanalına 3.4.0'ı yükle.

---

# B) APP STORE

## B1 · Bundle ID kaydet · **SEN**

https://developer.apple.com/account/resources/identifiers/list

**Yeni Identifier** → App IDs → App → `com.vekilpro.app`

> Bundle ID 16.09.2026'da `com.macroko.legal`'den değişti çünkü eskisi
> **senin olmayan** bir Apple ekibine (`27V4XBQFG4`) kayıtlıydı.
> Gerekçe: `IOS.md` §0.

## B2 · App Store Connect kaydı aç · **SEN**

https://appstoreconnect.apple.com/apps → **+** → Yeni Uygulama

- Platform: iOS
- Ad: `Vekil Pro: Avukat Asistanı`
- Birincil dil: Türkçe
- Bundle ID: `com.vekilpro.app`
- SKU: `vekilpro-ios`

Kayıt açılınca **App Information → Apple ID** sayısını not et — `eas.json`'a
o yazılacak.

### Neden düz "Vekil Pro" değil — 16.09.2026

İlk denemede Apple reddetti: *"The app name you entered is already being
used."*

**ÖLÇÜLDÜ** (iTunes Search API, TR mağazası, 16.09.2026): `vekilpro` → **0
sonuç**, `Vekil Pro` → alakasız 6 VPN uygulaması. Yani **yayında** o adı
taşıyan bir uygulama yok. Yakın adlar var ama çakışmıyor: *Huquq360 Vekil*,
*VekilAI*, *Vekil Gayrimenkul*.

**Bu aramanın göremediği şey:** iTunes araması yalnız yayınlanmış
uygulamaları kapsar. App Store Connect'te açılıp hiç yayınlanmamış bir kayıt
da adı rezerve eder ve aramada görünmez. En olası tutan: `eas.json`'dan
sildiğimiz eski kayıt (`ascAppId 6789656277`, ekip `27V4XBQFG4`).
**Kanıtlanmadı** — ürün sahibinin o hesaba erişimi yok, dolayısıyla adı geri
almanın pratik yolu da yok.

Apple'ın benzersizlik denetimi **tam metin** üzerinde; ek kelime çakışmayı
kaldırıyor. `app.json > name` hâlâ `Vekil Pro` — telefonun ana ekranında
görünen ad değişmedi, değişen yalnız mağaza vitrini başlığı.

## B3 · API anahtarı üret · **SEN**

https://appstoreconnect.apple.com/access/integrations/api

**Yeni anahtar** → rol **App Manager** → `.p8` dosyasını indir

> **`.p8` bir kez indirilir**, Apple ikinci kez vermez.

Sonra GitHub'a ekle:
https://github.com/mustafayalvac244-tech/macro_ko/settings/secrets/actions/new

```
Ad    : ASC_API_KEY_P8
Değer : .p8 dosyasının TAMAMI (BEGIN/END satırları dâhil)
```

> **Bana yapıştırma.** Yayımlama yetkisi taşıyor.

## B4 · Kimlikler · **TAMAM (16.09.2026)**

Dördü de geldi ve `eas.json`'a yazıldı. Gönderim koruması artık geçiyor
(`node` ile doğrulandı, çıktı: "geçer").

**`eas.json > submit.production.ios`:**

| alan | değer | nereden |
|---|---|---|
| `appleTeamId` | `5NNRTB2436` | B1 ekranındaki "App ID Prefix" satırı |
| `ascAppId` | `6812859016` | B2 kaydının Apple ID'si |
| `ascApiKeyId` | `954DS7AUM3` | B3'te üretilen `vekilpro-ci` anahtarı |
| `ascApiKeyIssuerId` | `98bb20ac-…-99b4d7b88d20` | API sayfasının üstü |

GitHub secret `ASC_API_KEY_P8` ürün sahibi tarafından eklendi (16.09.2026).
**Doğrulanmadı** — GitHub secret'ın varlığını dışarıdan okutmuyor; ilk
doğrulama iş akışının "Secret kontrolü" adımında olacak.

> Eski `27V4XBQFG4` / `6789656277` başka birinin ekibine aitti, silinmişti.

### `954DS7AUM3` anahtarı sohbete gönderildi — ürün sahibi kararı

16.09.2026: `.p8` dosyası, "bana yapıştırma" uyarısına rağmen sohbete
yüklendi. Oturumdaki kopya silindi; depoda izi yok (`git ls-files` temiz,
`.gitignore` zaten `*.p8` kapatıyor). Ama anahtar, amaçlanan yol dışında bir
yerden — konuşma kaydından — geçti.

İptal edip yenisini üretmek önerildi (maliyeti ~2 dk, Apple 50 aktif
anahtara izin veriyor). **Ürün sahibi kararı: "eskiden devam."** Yani bu
anahtar bilinçli olarak kullanımda tutuluyor. Karar tekrar gündeme
getirilmez; ama Apple hesabında beklenmedik bir yükleme/değişiklik
görülürse **ilk bakılacak yer burasıdır.**

### Sürüm uyuşmazlığı — kapatılacak

App Store Connect kaydı varsayılan **iOS 1.0** ile açıldı; `app.json` ise
**3.4.0**. İncelemeye göndermeden önce ASC'deki sürüm alanı build'in
`CFBundleShortVersionString` değeriyle aynı olmalı. TestFlight bunu
takmıyor, **App Store incelemesi takıyor**. Bkz. B7.

### B1'de capability seçme — **İLK ÖLÇÜM YANLIŞTI, düzeltildi**

**Önce yazılan (16.09.2026, yanlış):** "hiçbiri gerekmiyor". Gerekçe,
`src/lib/notifications.ts`'te yalnız `scheduleNotificationAsync` bulunması,
`getExpoPushTokenAsync` / `getDevicePushTokenAsync`'in hiç olmamasıydı.

**Ne oldu:** koşu #1 tam olarak bu yüzden düştü.

```
Provisioning profile "vekilpro-ci-..." doesn't include the
Push Notifications capability.
... doesn't include the aps-environment entitlement.
```

**Hata nerede:** ölçümün kendisi doğruydu ama **yanlış şeyi ölçüyordu.**
Entitlement'ı JavaScript kullanımı değil, `expo-notifications` **config
plugin'i** yazıyor. Push token hiç alınmasa bile plugin native projeye
`aps-environment` ekliyor. Doğru soru "kod push kullanıyor mu" değil,
"**hangi plugin entitlement yazıyor**".

**Bugünkü durum (plugin kaynakları okunarak):**

| yetenek | gerekli mi | neden |
|---|---|---|
| **Push Notifications** | **EVET** | `expo-notifications` plugin'i `aps-environment` yazıyor |
| iCloud | hayır | `expo-document-picker` yazıyor **ama** `config.ios?.usesIcloudStorage` koşuluna bağlı; `app.json`'da o anahtar yok, yani `iCloudContainerEnvironment` ayarı bugün **işlevsiz** |
| Sign in with Apple | hayır | `signInWithOAuth` / `signInWithIdToken` / `expo-apple-authentication` hiç yok |
| In-App Purchase | — | her App ID'de zaten açık, kutusu yok |

**Elle işaretlemene gerek yok:** `scripts/ios-imza-uret.mjs` artık profili
üretmeden önce `GEREKEN_YETENEKLER` listesindekileri App ID üzerinde
kendisi açıyor (ASC API `bundleIdCapabilities`).

## B5 · İmzalama kimlikleri · **ARTIK BEN YAPIYORUM** (16.09.2026)

**Ürün sahibi:** *"abi şunları sen yap ya bıktım."*

Aşağıdaki "atlanamaz" bölümü **tarihsel kayıt olarak duruyor** çünkü tespiti
doğruydu: `eas credentials` yolu gerçekten Apple şifresi ve iki adımlı
doğrulama istiyor. Ama o yolun **tek yol olmadığı** anlaşıldı.

**Yeni yol.** Sertifikayı ve provisioning profile'ı Apple'ın kendi REST
API'siyle üretiyoruz. ASC API anahtarı başlı başına bir kimlik doğrulama
yöntemi: şifre istemiyor, telefona kod göndermiyor. Üretilenler `.p12`
olarak paketlenip `credentials.json` ile EAS'ın önüne konuyor; `eas.json`'a
eklenen `production-yerel-imza` profili `credentialsSource: "local"`
kullandığı için EAS kendi kimlik kurulumunu **hiç çalıştırmıyor**.

- Betik: `scripts/ios-imza-uret.mjs`
- İş akışı girdisi: `imza: apple-api`

**ÖLÇÜLDÜ — üç koşu, 16.09.2026:**

| koşu | ne denendi | sonuç |
|---|---|---|
| #1 | `derle-ve-gonder` | Sertifika + profil üretildi, `.p12` paketlendi, **EAS "Using local iOS credentials (credentials.json)" dedi** — sonra Xcode `aps-environment` eksikliğinden düştü |
| #2 | aynısı, yetenek açma eklendi | Sertifika iptal + yeniden üretildi; `bundleIdCapabilities?limit=200` 400 verdi |
| #3 | `yalniz-imza` | **Baştan sona geçti:** yetenek açıldı, eski profil silindi, yenisi üretildi, `credentials.json` yazıldı — 62 saniye |
| #4 | `derle-ve-gonder` | **BAŞARILI.** 18:32:22 → 19:11:14 (39 dk). IPA derlendi ve **TestFlight'a yüklendi**. Derleme: `7bfc29c1-374e-4150-8402-53445f462fb5` |

**B6 TAMAMLANDI (16.09.2026 19:11 UTC).** Apple girişi, şifre ve iki adımlı
doğrulama hiçbir koşuda istenmedi. Ürün sahibinin Windows'ta terminal açması
gerekmedi.

Apple ID şifresi hiçbir koşuda sorulmadı, doğrulama kodu istenmedi.
Koşu #1 ayrıca ilk kez doğruladı: `ASC_API_KEY_P8` secret'ı gerçekten
tanımlı ve içeriği geçerli bir özel anahtar.

### İki ders

**1. `yalniz-imza` modu neden var.** İlk iki hata da Apple API ile ilgili
küçük hatalardı ve ikisi de 40 saniyede belli oluyordu — ama tam derlemeye
bağlı oldukları için her denemede 40 dakika bekleniyordu. Ayrı bir mod
eklemek, öğrenme döngüsünü 40 dakikadan 55 saniyeye indirdi. **Uzun bir
işin ucundaki kısa adımı ayrı koşabilmek, o işi hızlandırmaktan daha
değerli.**

**2. Süreyi kendi bekleyişinle ölçme.** Bu koşuları izlerken ürün sahibine
"50 dakika oldu", "80 dakika oldu", "kayıt ucu saatlerdir 404" dedim.
Ürün sahibinin ekran görüntüsü **"8 minutes ago"** diyordu.

GitHub damgalarından hesaplanan gerçek süreler: koşu #1 **199 sn**,
#2 **48 sn**, #3 **62 sn**. Dördü **9 dakikalık** bir aralıkta başlamış.

Dahası, bu uyuşmazlığı "GitHub'ın durum ucu bayat" diye teşhis edip o
teşhisi bir ders olarak yazmıştım — **kanıtı yoktu ve geri alındı**.
Doğrusu: süre iddiası yazacaksan iki damga arasındaki farkı hesapla
(`created_at` → `updated_at`), kendi bekleyişine güvenme.

Kalan pratik bilgi: `get_job_logs` koşu bitene kadar 404 veriyor, bu
normal. Durum için `list_workflow_runs`'ı `status=completed` ve
`status=in_progress` ile iki kez çağırmak tek bir alana bakmaktan daha
sağlam.

**SERTİFİKA SINIRI.** Betik her koşuşta yeni sertifika üretiyor (özel anahtar
koşu bitince kayboluyor, eskisi bir daha kullanılamıyor). Apple hesap başına
2 tanesine izin veriyor, yani üçüncü koşudan önce `eski_sertifika: iptal-et`
seçilmeli. Varsayılan `dokunma`: hesapta sertifika varsa betik durup
listeliyor, sessizce silmiyor.

---

### (TARİHSEL) Neden `eas credentials` yolu atlanamıyordu — eas-cli 24.6.0

Ürün sahibi haklı olarak sordu: "bunu nereye yazacağım" — yani yerel kurulum
gerçekten gerekli mi? Tahmin etmek yerine kaynak okundu.

`build/credentials/ios/actions/SetUpDistributionCertificate.js:41`

```js
async runNonInteractiveAsync(_ctx, currentCertificate) {
    log.warn('Distribution Certificate is not validated for non-interactive builds.');
    if (!currentCertificate) {
        throw new MissingCredentialsNonInteractiveError();
    }
```

İki parça farklı davranıyor:

| kimlik | CI'da üretilebilir mi |
|---|---|
| **Provisioning profile** | **Evet** — `EXPO_ASC_API_KEY_PATH` / `EXPO_ASC_KEY_ID` / `EXPO_ASC_ISSUER_ID` verilirse (kaynaktaki hata metni bunu açıkça söylüyor) |
| **Dağıtım sertifikası** | **Hayır** — yoksa doğrudan `MissingCredentialsNonInteractiveError` |

Ayrıca `eas credentials` komutunun **hiç** `--non-interactive` bayrağı yok
(`--help` çıktısı: yalnız `-p/--platform`). Expo dokümanı da aynı yere
çıkıyor: *"a successful build from your local machine ... ensures build
credentials are created, including ... iOS distribution certs and
provisioning profiles."*

Expo web sitesinden sertifika üretme yolu da **yok** — sitede yalnız push
anahtarı indiriliyor (`app-signing/app-credentials` sayfası okundu).

### (TARİHSEL) Windows'ta ne yapılacaktı

> **BU ARTIK GEREKMİYOR** — yukarıdaki Apple API yolu bunu ortadan kaldırdı.
> Yalnız o yol bozulursa geri dönülecek yedek olarak duruyor.

Depo klonlu ve Node.js kurulu değilse sıra şu:

1. **Node.js LTS kur:** https://nodejs.org → "LTS" düğmesi → indir, kur
   (varsayılan seçeneklerle İleri-İleri).
2. **Projeyi indir:** https://github.com/mustafayalvac244-tech/macro_ko
   → yeşil **Code** → **Download ZIP** → indirilen dosyaya sağ tık →
   **Tümünü ayıkla**. Git kurmaya gerek yok.
3. **Komut İstemi'ni aç:** Başlat → `cmd` yaz → Enter.
4. Klasöre gir (yol kendi ayıkladığın yer):
   ```
   cd %USERPROFILE%\Downloads\macro_ko-claude-legal-case-management-app-dipuvb
   ```
5. **Bağımlılıkları kur** (~3-5 dk). Bu adım şart: `app.json` içindeki config
   plugin'leri `node_modules`tan çözülüyor, yoksa eas-cli uygulama
   yapılandırmasını okuyamaz.
   ```
   npm install
   ```
6. **Expo'ya giriş yap:**
   ```
   npx eas-cli login
   ```
7. **Kimlikleri üret:**
   ```
   npx eas-cli credentials --platform ios
   ```
   Menüde sırasıyla: **production** profili → **Build Credentials** →
   **All: Set up all the required credentials to build your project**.
   Apple hesabına giriş isteyecek (Apple ID + şifre + iki adımlı doğrulama).

Bitince EAS sertifikayı ve profili kendi tarafında saklar; sonraki her CI
koşusu `--non-interactive` çalışabilir.

## B6 · Derle ve TestFlight'a gönder · **BEN**

B3-B5 bitince söyle, şunu koşarım:
https://github.com/mustafayalvac244-tech/macro_ko/actions/workflows/ios-dagit.yml
→ `is: derle-ve-gonder`, `profil: production`

> iOS kotası **ölçülmedi** — EAS'ın hatası "Android builds" diyordu, yani
> sayaç platform başına tutuluyor *gibi* görünüyor ama denenmedi.

## B7 · App Store Connect'te doldurulacaklar · **SEN**

- **Sürüm numarasını `3.4.0` yap** — kayıt `1.0` ile açıldı, `app.json`
  3.4.0. Uyuşmazsa inceleme reddeder (B4'teki not)
- **Trader status** (Business bölümü) — AB dağıtımı için zorunlu. Beyan
  vermeyeceksen ülke listesini AB dışına daralt; varsayılan tüm dünyadır
- Gizlilik politikası adresi: `https://vekilpro.app/privacy.html`
- **App Privacy** ("Nutrition Label") — `docs/privacy.html` ile **birebir**
  tutarlı olmalı; eksik beyan yayından sonra da ceza sebebi
- Kategori: Business ya da Productivity · Yaş sınırı · Destek adresi
- Ekran görüntüleri:
  - **iPhone 6.7"** → `magaza-pazarlama/ios/01…08` (8 adet, 1290×2796)
  - **iPad 13"** → `magaza-pazarlama/ipad/01…04` (4 adet, 2048×2732)
    **ZORUNLU** — `supportsTablet: true` olduğu için Apple istiyor
- **Abonelik ürünleri** (`premium`, `ai`) tanımlı ve **"Ready to Submit"**
  olmalı — onaylanmadan abonelikli sürüm incelemeye alınmaz
  (`IAP_KURULUM.md`)

---

## Mağaza metni (iki mağaza için aynı)

**Kısa açıklama (Play, 80 karakter):**
```
Avukatın dosyası, takvimi ve içtihadı tek yerde.
```

**Tam açıklama:**
```
Vekil Pro, avukatlar için tasarlanmış bir büro yönetimi ve hukuki araştırma
uygulamasıdır.

DOSYA VE MÜVEKKİL YÖNETİMİ
• Dava dosyalarınızı mahkeme, aşama ve karşı taraf bilgisiyle tutun
• Müvekkil kayıtları, vekâletnameler ve belgeler tek yerde
• Her dosyanın duruşma, süre ve çalışma kaydı geçmişi

DURUŞMA VE SÜRE TAKİBİ
• Duruşmalarınız ve süreleriniz takvimde
• Hatırlatmalar — süre kaçırma riskini azaltır
• Günlük görünüm: bugün ne var, sırada ne var

İÇTİHAT ARAMASI
• Yargıtay ve Danıştay kararlarında tam metin araması
• Olayınızı anlatın, ilgili içtihat bulunsun
• Verilen her kanun maddesi ve karar künyesi işaretlenir:
  doğrulandı, havuzda bulunamadı ya da olamaz

FİNANS
• Vekâlet ücreti, tahsilat ve gider takibi
• KDV ve stopaj otomatik hesaplanır
• Serbest meslek makbuzu bilgileri hazır

MEVZUAT VE HESAPLAYICILAR
• Kanun metinlerinde arama
• Kıdem tazminatı, faiz ve harç hesaplayıcıları
• Dilekçe şablonları

GÜVENLİK
• Verileriniz şifreli aktarılır
• Uygulama kilidi (Face ID / parmak izi)
• Hesabınızı ve verilerinizi uygulama içinden kalıcı olarak silebilirsiniz

Yapay zekâ özellikleri ayrı bir pakettedir; ücretsiz hesaplarda kapalıdır.

Gizlilik: https://vekilpro.app/privacy.html
Koşullar: https://vekilpro.app/terms.html
```

> **Metinde bilerek olmayanlar:** "hata yapmaz", "kesin sonuç", "davanızı
> kazanın" gibi ifadeler yok. Hukuk ürününde sonuç vaadi hem meslek
> kurallarına aykırı hem de iki mağazada yanıltıcı tanıtım sayılır.
> "Süre kaçırmayın" değil "süre kaçırma riskini azaltır" yazıyor — birincisi
> garanti, ikincisi doğru.

---

## Sıra özeti

```
BUGÜN        A1 kapalı test  ← 14 günlük sayaç başlar
             A2, A3 formlar ve vitrin
             B1, B2, B3 Apple kaydı + anahtar
             B4 dört bilgiyi bana ver
             B5 eas credentials (senin bilgisayarında)
SONRA        B6 iOS derleme (ben)
             B7 App Store formları
1 EKİM       Android 3.4.0 derlemesi (kota sıfırlanır)
+14 GÜN      Play üretim erişimi başvurusu
```
