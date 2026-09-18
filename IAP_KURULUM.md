# Gerçek Satın Alma Kurulumu (RevenueCat) — Sıfırdan Rehber

> **Son güncelleme: 13.09.2026.** Fiyatlar ve haklar o günkü koddan
> yazıldı. Bu dosyadaki sayılar `src/config/planlar.ts` ve
> `_shared/katman.ts` ile aynı olmak zorunda; ayrışırsa mağaza panelinde
> yanlış ürün kurulur ve yanlış olduğu ancak ilk ödemede anlaşılır.
> Play'e çıkış sırası için: **`PLAY.md`**.

**İKİ AYRI ÜRÜN** artık **RevenueCat** üzerinden App Store / Google Play'in
kendi satın alma sistemleriyle (StoreKit / Google Play Billing) alınır:

| | Fiyat | Verdiği hak | Entitlement | Offering |
|---|---|---|---|---|
| Temel | 399₺/ay | Tüm dosya/müvekkil/finans özellikleri | `premium` | `default` (Current) |
| AI | 2.999₺/ay | Temel + **1650 istek** (ilk 750'si en yetenekli modelle) **+ 25 mütalaa/ay** | `premium` VE `ai` | `ai` |

AI paketi HER İKİ entitlement'ı da vermeli — "AI planı Temel'i de içerir" sözü
buradan gelir (kod bunu bekliyor, bkz. adım 4).

**DENEME HAKKI 13.09.2026'DA DEĞİŞTİ (ürün sahibi kararı).** Eskiden ücretsiz
katmandaydı; artık **₺399'luk Temel pakete** ait: 3 istek, YAŞAM BOYU (aylık
değil, bir kez, yenilenmez). **Ödeme yapmamış kullanıcıda yapay zekâ tamamen
kapalıdır** ve uçlar 403 `tier_required` döndürür.

Bu bir **sunucu sayacıdır** (`profiles.deneme_soru_kullanildi`), satın alma
ürünleriyle ilgisi yoktur — mağaza panelinde bunun için bir şey kurmanız
gerekmez. Karar `_shared/katman.ts` içinde `is_premium` bayrağına bakılarak
veriliyor, yani **Temel aboneliği RevenueCat üzerinden doğru kurulmazsa deneme
hakkı da açılmaz.**

Deneme istekleri ücretli modelle karşılanır: bir avukatın yapay zekâyla İLK
teması kötü bir çıktı olursa ürünü bir daha denemeyebilir. (Groq kullanıcıya
hiç yönlendirilmiyor; yalnız sunucudaki hata-kurtarma zincirinde altyapı
yedeği olarak duruyor.)

Kod tarafı **hazır** — aşağıdaki adımlar sizin (geliştirici hesabı sahibi
olarak) mağaza panellerinde ve RevenueCat panelinde yapmanız gereken, kodla
YAPILAMAYAN manuel kurulum adımlarıdır.

**Neden Stripe değil?** Apple ve Google, mağaza üzerinden dağıtılan bir
uygulamada dijital özellik/abonelik satışını kendi ödeme sistemleri
üzerinden yapmanızı zorunlu kılıyor. Stripe kaldırıldı (bkz. `APPSTORE.md`).

**Neden RevenueCat?** iOS (StoreKit) ve Android (Google Play Billing) ayrı
ayrı native ödeme sistemleridir; RevenueCat ikisini tek bir SDK ve tek bir
"premium" yetkisi (entitlement) altında birleştirir, makbuz doğrulamasını ve
yenileme/iptal takibini kendi sunucusunda yapar — biz kendi doğrulama
sunucumuzu yazmak zorunda kalmayız.

---

## 0. Şu an kodda hazır olan

- `src/lib/purchases.ts` — RevenueCat istemci sarmalayıcısı.
- `app/premium.tsx` — "Aboneliğe Geç" butonu artık gerçek satın alma başlatır
  (RevenueCat kurulmadıysa eskisi gibi "çok yakında" der, hiçbir şey kırılmaz).
- `app/_layout.tsx` — SDK açılışta kuruluyor, oturum değişince RevenueCat
  kimliği Supabase kullanıcı kimliğiyle eşleniyor.
- `supabase/functions/revenuecat-webhook/` — RevenueCat'in gönderdiği gerçek
  satın alma bildirimini işleyip `profiles.is_premium` VE `profiles.ai_tier`'ı
  (RevenueCat'in event.entitlement_ids'ine göre, ikisi bağımsız) açan/kapatan
  uç. **Zaten canlıya dağıtıldı** ama sır (secret) girilmediği için şu an
  güvenli biçimde 503 dönüyor (`{"error":"not_configured"}`) — adım 5'te açılacak.
- `purchases` tablosu — RevenueCat olaylarının denetim kaydı (migration 0072/
  0073, **zaten uygulandı**).
- `supabase/functions/_shared/katman.ts` — "ai" katmanının aylık hak
  tanımı (1650 istek / 750 asıl model / 25 mütalaa) ve deneme kapısı.
  Kontöre değil sayıya bakar; kota dolunca `ai_soru_kota_bitti` /
  `ai_mutalaa_kota_bitti` hatası döner, istemci bunu anlıyor (`aiHata.ts`).

Yani geriye kalan HER ADIM, sizin mağaza/RevenueCat hesaplarınızda yapacağınız
tıklamalar ve bana vereceğiniz üç anahtar/sır.

---

**Uygulama kimlikleri** (RevenueCat/App Store Connect/Play Console'da
istenecek — `app.json`'dan): iOS Bundle ID ve Android Package Name ikisi de
iki platformda da **`com.vekilpro.app`**.
**15.09.2026'DA AYNILAŞTILAR.** Önce iOS `com.macroko.legal` idi; o bundle ID
bize ait olmayan bir Apple ekibine (27V4XBQFG4) kayıtlı olduğu için yeni
hesapta kullanılamıyordu ve `com.vekilpro.app` yapıldı (bkz. IOS.md bölüm 0).
RevenueCat'e iOS uygulamasını eklerken bu yeni bundle ID'yi yazın.

> **App Store Connect'teki abonelik ürünleri YENİ kayıtta yeniden
> tanımlanacak.** Ürünler uygulama kaydına bağlıdır, eski kayıttan taşınmaz.
> Uygulama hiç yayınlanmadığı için kaybedilen bir şey yok.

## 1. RevenueCat hesabı açın (ücretsiz)

1. https://app.revenuecat.com/signup adresinden hesap açın.
2. Yeni bir **Proje** oluşturun (ör. "Vekil Pro").

## ⚠ ÖLÇÜLDÜ 18.09.2026 — `vekil_ai_monthly` TÜRKİYE'DE 399,99 ₺

Canlı App Store Connect API'sinden okundu (koşu #19, `abonelik-oku`):

```
vekil_ai_monthly  6813558875   175 ülkede fiyatlı
  TÜRKİYE = 399,99 TL          ← olması gereken: 2.999 TL
  ARE 24,99 · AFG 6,99 · ATG 6,99 · AIA 6,99 · ALB 7,99
```

Yabancı ülke rakamları da aynı yöne işaret ediyor: 6,99–9,99 bandı, yani
**Temel paketin kademesi**. AI ürünü Temel'in fiyatıyla açılmış görünüyor.

**Bu ölçüm iki aşamada doğrulandı** çünkü ilk okuma güvenilir değildi.
İlk sürüm Apple'ın `included` havuzundan "içinde TUR geçen ilk fiyat
noktasını" seçiyordu — kaydın kendi ilişkisine bakmadan. O bir eşleştirme
değil tahmindi. Doğrusu her `prices` kaydının `territory` ve
`subscriptionPricePoint` ilişkilerini BİRLİKTE çözmek; yukarıdaki sayı öyle
okundu.

**Neden önemli — hesap `supabase/functions/_shared/katman.ts`'den:**

| | |
|---|---|
| en kötü durumda API gideri (750 soru + 25 mütalaa + taşma) | **₺1.493** |
| hedeflenen fiyat | ₺2.999 → gider gelirin %50'si |
| **ölçülen fiyat** | **₺399,99** → Apple payı düştükten sonra ~₺280–340 net |

Yani kotasını dolduran bir abone, hedeflenen kâr yerine belirgin zarar
yazar. **Bu bir üst sınırdır, beklenen gider değil** — katman.ts'in kendi
notu: ortalama kullanım BİLİNMİYOR, ödeme yapan kullanıcı henüz yok.
Ortalama kullanıcı kotanın onda birini kullanırsa 399,99 da zarar
ettirmeyebilir. Ama tasarlanan fiyat bu değil ve fark 7,5 kat.

**KARAR ÜRÜN SAHİBİNİN.** Fiyatı düzeltmek, 399,99'da bırakmak ya da
paketi yeniden kurgulamak — üçü de savunulabilir, seçim ölçümün değil.

---

## 2. App Store Connect'te İKİ abonelik ürünü tanımlayın

1. App Store Connect → uygulamanız → **Abonelikler** (Subscriptions).
2. Yeni bir **Abonelik Grubu** oluşturun (ör. "Vekil Premium") — **aynı grup
   içine ikisini de** koyun (bir kullanıcının Temel'den AI'a geçmesi
   "upgrade" sayılsın, ayrı gruplarda bu çalışmaz).
3. Grubun içine İKİ ürün ekleyin:
   - Ürün kimliği: `vekil_premium_monthly` — Süre **1 Ay** — Fiyat 399₺'ye en
     yakın Apple kademesi.
   - Ürün kimliği: `vekil_ai_monthly` — Süre **1 Ay** — Fiyat 2.999₺'ye en
     yakın Apple kademesi.
   - İkisi için de yerelleştirme (en azından Türkçe): başlık + açıklama.
4. Uygulamanızın "Uygulama İçi Satın Almalar Anlaşması"nın (Paid Apps
   Agreement) App Store Connect'te İMZALANMIŞ ve banka/vergi bilgilerinin
   girilmiş olması gerekir — yoksa ürünler "onaya hazır" duruma geçmez.

## 3. Play Console'da İKİ abonelik ürünü tanımlayın

> Uygulama henüz Play Console'da yayınlanmadıysa önce oraya bir uygulama
> girişi (en azından "Dahili test" aşamasında) oluşturulmalı.

1. Play Console → uygulamanız → **Gelir kazanma → Abonelikler**.
2. İki abonelik: `vekil_premium_monthly` (Apple ile AYNI isim, aylık, 399₺'ye
   en yakın fiyat) ve `vekil_ai_monthly` (2.999₺'ye en yakın fiyat).

## 4. RevenueCat'i mağazalara bağlayın

1. RevenueCat panelinde **Project Settings → Apps** → "Add App" ile hem iOS
   hem Android uygulamanızı ekleyin (Bundle ID / Package name girilir).
2. iOS için: App Store Connect **API Anahtarı** (App Store Connect →
   Users and Access → Integrations → App Store Connect API) üretip
   RevenueCat'e bağlayın — RevenueCat'in kendi rehberi adım adım gösteriyor.
3. Android için: Play Console'da bir **Google Servis Hesabı** (Service
   Account) oluşturup RevenueCat'e JSON anahtarını yükleyin.
4. **İki Entitlement** oluşturun (kimlikler kodla BİREBİR eşleşmeli —
   `src/lib/purchases.ts` → `PREMIUM_ENTITLEMENT_ID` / `AI_ENTITLEMENT_ID`):
   - `premium`: hem iOS hem Android `vekil_premium_monthly` ürününü bağlayın
     — VE `vekil_ai_monthly`'yi de (AI planı Temel'i içerir, bu yüzden AI
     ürünü BU entitlement'a da bağlı olmalı).
   - `ai`: yalnız `vekil_ai_monthly` ürününü bağlayın.
5. **İki Offering** oluşturun:
   - `default` — içine `vekil_premium_monthly`'yi **Monthly** paket tipiyle
     ekleyin, bu Offering'i **Current** işaretleyin (kod `getCurrentOffering()`
     ile bunu okuyor).
   - `ai` — içine `vekil_ai_monthly`'yi **Monthly** paket tipiyle ekleyin.
     Current OLMASIN (yalnız kimlikle çağrılıyor — kod `getOffering('ai')`
     ile bunu okuyor).

## 5. Webhook'u bağlayın

1. RevenueCat panelinde **Project Settings → Integrations → Webhooks**.
2. URL: `https://wjshlysfmeqlnfiibknj.supabase.co/functions/v1/revenuecat-webhook`
3. **Authorization header value**: rastgele, uzun, tahmin edilemez bir metin
   üretin (ör. bir parola üretici ile 32+ karakter) — buna **A** diyelim.
4. Supabase Dashboard → Edge Functions → `revenuecat-webhook` → **Secrets** →
   yeni secret: isim `REVENUECAT_WEBHOOK_SECRET`, değer **A** (RevenueCat
   panelindeki AYNI değer).

## 6. İstemci API anahtarlarını uygulamaya ekleyin

> ### ✅ ANDROID TARAFI KAPATILDI — 18.09.2026
>
> `EXPO_PUBLIC_REVENUECAT_ANDROID_KEY` artık `eas.json`'daki **preview ve
> production** profillerinde tanımlı (`goog_…`). RevenueCat'te Google Play
> uygulaması oluşturuldu ve anahtar oradan alındı.
>
> **iOS TARAFI DA KAPATILDI — 18.09.2026.** `EXPO_PUBLIC_REVENUECAT_IOS_KEY`
> (`appl_…`) her iki profile de yazıldı. RevenueCat'te Apple App Store
> uygulaması oluşturuldu; bu adımda ayrıca **In-App Purchase anahtarı**
> (ASC API anahtarından AYRI bir .p8) ve onun kendi **Issuer ID**'si gerekti.
> İkisi App Store Connect → Integrations → **In-App Purchase** sekmesinde.
>
> **BU DEĞİŞİKLİK OTA İLE GİTMEZ.** Ortam değişkenleri derleme zamanında
> paketin içine gömülüyor; anahtarın etkili olması için **yeni bir derleme**
> gerekiyor. Play'e yüklü olan `vekilpro-3.3.2.aab` bu anahtarı TAŞIMIYOR.
>
> ---
>
> ### (TARİHSEL) Bu adım 16.09.2026'da yapılmamıştı
>
> `eas.json`'daki `preview` ve `production` profillerinin `env` bloklarında
> **yalnız iki Supabase değişkeni var**; RevenueCat anahtarları yok.
> Depoda `EXPO_PUBLIC_REVENUECAT_*` yalnız iki yerde geçiyor ve ikisi de
> `purchases.ts`'teki okuma satırları — hiçbir yerde **yazılmıyorlar**.
>
> **Sonucu ne:** `src/lib/purchases.ts:42`
> ```ts
> const apiKey = Platform.OS === 'ios' ? IOS_KEY : ANDROID_KEY;
> if (!apiKey) { ...; return; }   // satın alma SESSİZCE kapalı
> ```
> Yani uygulama abonelik ekranını gösteriyor, kullanıcı düğmeye basıyor ve
> **hiçbir şey olmuyor.** Çökme yok, hata yok — bu yüzden fark edilmedi.
>
> **Nerede ölçüldü:** Play'e yüklenen `vekilpro-3.3.2.aab`, Android koşu #4
> (13.09.2026, commit `bc8f206`) çıktısı. O commit'te `purchases.ts` ve
> `react-native-purchases` VAR, anahtar YOK.
>
> **Şu an tek iyi tarafı:** Play mağaza kaydında "dijital ürün satın alma:
> Hayır" denmiş ve bu, çalışma zamanı davranışına *kazara* uyuyor. Kapalı
> test için sorun değil. **Üretimden önce üçü birden gerekir:**
> 1. `goog_`/`appl_` anahtarları aşağıdaki gibi `eas.json`'a
> 2. Play Console'da `premium` ve `ai` abonelik ürünleri
> 3. Beyan "Evet"e döner → içerik derecelendirme + veri güvenliği formları
>    güncellenir
>
> Anahtarlar **gizli değildir** (istemciye gömülüyorlar) — sohbete
> yazılabilir. Gizli olan RevenueCat *secret* anahtarı ve webhook sırrıdır.

RevenueCat panelinde **Project Settings → API Keys**'te iOS ve Android için
ayrı "Public app-specific API key" değerleri var (bunlar GİZLİ değildir,
Stripe'ın publishable key'i gibi uygulama içine gömülebilir). `eas.json`
içindeki `preview` ve `production` profillerinin `env` bloklarına ekleyin:

```json
"env": {
  "EXPO_PUBLIC_SUPABASE_URL": "...",
  "EXPO_PUBLIC_SUPABASE_ANON_KEY": "...",
  "EXPO_PUBLIC_REVENUECAT_IOS_KEY": "appl_XXXXXXXXXXXX",
  "EXPO_PUBLIC_REVENUECAT_ANDROID_KEY": "goog_XXXXXXXXXXXX"
}
```

Yerel geliştirme için `.env` dosyasına da aynı iki satırı ekleyin.

## 7. YENİDEN DERLEME ŞART — OTA bunu TAŞIYAMAZ

⚠️ **En kritik nokta bu.** RevenueCat native (yerel) kod içerir. Vekil Pro
normalde EAS Update ile anında (mağaza incelemesi beklemeden) güncelleniyor
— ama bu, yalnız JavaScript tarafı için geçerli. `react-native-purchases`
gibi yeni bir native modül eklemek EAS Update ile YAYILAMAZ; yeni bir
**native build** (`eas build`) gerekir ve bu build önce TestFlight/Play
Dahili Test'te denenip sonra mağaza incelemesine gönderilmelidir. Adım 1-6
tamamlanmadan derleme anlamsızdır (anahtarlar boşsa satın alma sessizce
"çok yakında" moduna düşer — çökmez, ama gerçek satın alma da olmaz).

```
eas build --profile development --platform ios      # ilk test için
eas build --profile production --platform all       # mağazaya gönderim için
```

## 8. Test edin (sandbox — gerçek para çekilmez)

- **iOS**: App Store Connect → Users and Access → **Sandbox Testers**'da bir
  test hesabı oluşturun; cihazda Ayarlar → App Store → Sandbox Hesabı ile
  giriş yapıp uygulamada satın alma deneyin.
- **Android**: Play Console → **Lisans Testi**ne (License Testing) e-posta
  adresinizi ekleyin; o hesapla Play Store'a giriş yapıp Dahili Test
  sürümünde satın alma deneyin.
- Her iki durumda da satın alma sonrası: RevenueCat panelinde **Customers**
  sekmesinde olayı, Supabase'de `purchases` tablosunda yeni satırı doğrulayın.
  Temel satın alındıysa `profiles.is_premium = true`; AI satın alındıysa
  HEM `is_premium = true` HEM `profiles.ai_tier = 'ai'` olmalı (adım 4'teki
  entitlement eşlemesi yanlışsa yalnız biri açılır — o zaman RevenueCat
  panelinde `ai` ürününün `premium` entitlement'ına da bağlı olduğunu kontrol
  edin). AI hesabıyla uygulamada birkaç soru sorup 250/12'lik sayacın
  gerçekten iş gördüğünü de deneyin.

## 9. Ayrı ve henüz ele alınmamış bir konu: AI kontör satın alma

`payment-sheet` / `stripe-webhook` uçları AI kontör (kredi) satın alma için
yazılmıştı ama Stripe SDK'sı kaldırıldığından bu yana **hiçbir ekrandan
çağrılmıyor** — şu an kullanıcı arayüzünde kontör satın alma yolu yok. Bu,
premium abonelikten AYRI bir iş kalemi; istenirse aynı RevenueCat altyapısı
(tüketilebilir/non-renewing ürün olarak) veya ayrı bir çözümle ele alınabilir.
