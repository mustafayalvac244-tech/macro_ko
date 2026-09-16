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

## A1 · Kapalı testi BUGÜN başlat — en kritik adım

Bu, 14 günlük sayacı başlatır. Beklemenin tek sebebi bu adımın geciktirilmesi
olur.

1. **Play Console** → https://play.google.com/console
2. Uygulamayı aç (paket adı `com.vekilpro.app`)
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

## B4 · Bana üç bilgiyi ver · **SEN → BEN**

Bunlar gizli **değil**, `eas.json`'a yazılacak (eskileri silindi):

```
Issuer ID : App Store Connect API sayfasının üstünde
Key ID    : yeni ürettiğin anahtarın yanında
App ID    : B2'de not ettiğin Apple ID (sayı)
```

> **Team ID geldi: `5NNRTB2436`.** 16.09.2026'da B1 ekranındaki "App ID
> Prefix" satırından okundu ve `eas.json > submit.production.ios.appleTeamId`
> alanına yazıldı. Eski `27V4XBQFG4` başka birinin ekibiydi.

### B1'de capability seçme — **ölçüldü, hiçbiri gerekmiyor**

16.09.2026, kod okunarak:
- `expo-notifications` kurulu ama yalnız `scheduleNotificationAsync`
  çağrılıyor (`src/lib/notifications.ts` 63, 367, 474). `getExpoPushTokenAsync`
  / `getDevicePushTokenAsync` **hiç yok** → bildirimler yerel →
  **Push Notifications işaretlenmez.**
- `signInWithOAuth` / `signInWithIdToken` / `expo-apple-authentication`
  **hiç yok** → **Sign in with Apple gerekmez.**
- In-App Purchase her App ID'de zaten açıktır, kutusu yoktur.

Gereksiz capability işaretlemek zararsız değildir: bazıları (Push, Sign in
with Apple) profil/sertifika üretimini ve inceleme sorularını değiştirir.

## B5 · İmzalama kimliklerini oluştur · **SEN** (bilgisayarında, bir kez)

```
npx eas-cli credentials --platform ios
```

> **Bu adım atlanamaz ve CI yapamaz.** iOS dağıtım sertifikası ilk kez
> üretilirken Apple hesabına giriş ister; GitHub Actions etkileşim yapamaz.
> Atlanırsa ilk koşu kimlik hatasıyla düşer — arıza değil, sıranın gereği.

## B6 · Derle ve TestFlight'a gönder · **BEN**

B3-B5 bitince söyle, şunu koşarım:
https://github.com/mustafayalvac244-tech/macro_ko/actions/workflows/ios-dagit.yml
→ `is: derle-ve-gonder`, `profil: production`

> iOS kotası **ölçülmedi** — EAS'ın hatası "Android builds" diyordu, yani
> sayaç platform başına tutuluyor *gibi* görünüyor ama denenmedi.

## B7 · App Store Connect'te doldurulacaklar · **SEN**

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
