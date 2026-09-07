# Gerçek Satın Alma Kurulumu (RevenueCat) — Sıfırdan Rehber

Premium abonelik (399₺/ay) artık **RevenueCat** üzerinden App Store / Google
Play'in kendi satın alma sistemleriyle (StoreKit / Google Play Billing) alınır.
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
  satın alma bildirimini işleyip `profiles.is_premium`'u açan/kapatan uç.
  **Zaten canlıya dağıtıldı** ama sır (secret) girilmediği için şu an güvenli
  biçimde 503 dönüyor (`{"error":"not_configured"}`) — adım 4'te açılacak.
- `purchases` tablosu — RevenueCat olaylarının denetim kaydı (migration 0072,
  **zaten uygulandı**).

Yani geriye kalan HER ADIM, sizin mağaza/RevenueCat hesaplarınızda yapacağınız
tıklamalar ve bana vereceğiniz üç anahtar/sır.

---

## 1. RevenueCat hesabı açın (ücretsiz)

1. https://app.revenuecat.com/signup adresinden hesap açın.
2. Yeni bir **Proje** oluşturun (ör. "Vekil Pro").

## 2. App Store Connect'te abonelik ürünü tanımlayın

1. App Store Connect → uygulamanız → **Abonelikler** (Subscriptions).
2. Yeni bir **Abonelik Grubu** oluşturun (ör. "Vekil Premium").
3. Grubun içine bir ürün ekleyin:
   - Ürün kimliği (Product ID): `vekil_premium_monthly` (bu ismi RevenueCat'e
     de gireceksiniz, birebir aynı olmalı).
   - Süre: **1 Ay**.
   - Fiyat: 399₺'ye en yakın Apple fiyat kademesini seçin.
   - Yerelleştirme (en azından Türkçe): başlık + açıklama girin.
4. Uygulamanızın "Uygulama İçi Satın Almalar Anlaşması"nın (Paid Apps
   Agreement) App Store Connect'te İMZALANMIŞ ve banka/vergi bilgilerinin
   girilmiş olması gerekir — yoksa ürün "onaya hazır" duruma geçmez.

## 3. Play Console'da abonelik ürünü tanımlayın

> Uygulama henüz Play Console'da yayınlanmadıysa önce oraya bir uygulama
> girişi (en azından "Dahili test" aşamasında) oluşturulmalı.

1. Play Console → uygulamanız → **Gelir kazanma → Abonelikler**.
2. Yeni abonelik: Ürün kimliği `vekil_premium_monthly` (Apple ile AYNI isim —
   RevenueCat'te tek bir Offering altında ikisini birleştireceğiz).
3. Baz plan: aylık, 399₺'ye en yakın fiyat.

## 4. RevenueCat'i mağazalara bağlayın

1. RevenueCat panelinde **Project Settings → Apps** → "Add App" ile hem iOS
   hem Android uygulamanızı ekleyin (Bundle ID / Package name girilir).
2. iOS için: App Store Connect **API Anahtarı** (App Store Connect →
   Users and Access → Integrations → App Store Connect API) üretip
   RevenueCat'e bağlayın — RevenueCat'in kendi rehberi adım adım gösteriyor.
3. Android için: Play Console'da bir **Google Servis Hesabı** (Service
   Account) oluşturup RevenueCat'e JSON anahtarını yükleyin.
4. **Entitlement** oluşturun: kimlik `premium` (kod bu isimle eşleşiyor —
   `src/lib/purchases.ts` → `PREMIUM_ENTITLEMENT_ID`). Hem iOS hem Android
   `vekil_premium_monthly` ürününü bu entitlement'a bağlayın.
5. **Offering** oluşturun (ör. "default"), içine bir **Package** ekleyin,
   paket tipi **Monthly**, ürünü yukarıdaki `vekil_premium_monthly` seçin.
   Bu Offering'i **Current** (varsayılan) olarak işaretleyin — kod
   `getCurrentOffering()` ile bunu okuyor.

## 5. Webhook'u bağlayın

1. RevenueCat panelinde **Project Settings → Integrations → Webhooks**.
2. URL: `https://wjshlysfmeqlnfiibknj.supabase.co/functions/v1/revenuecat-webhook`
3. **Authorization header value**: rastgele, uzun, tahmin edilemez bir metin
   üretin (ör. bir parola üretici ile 32+ karakter) — buna **A** diyelim.
4. Supabase Dashboard → Edge Functions → `revenuecat-webhook` → **Secrets** →
   yeni secret: isim `REVENUECAT_WEBHOOK_SECRET`, değer **A** (RevenueCat
   panelindeki AYNI değer).

## 6. İstemci API anahtarlarını uygulamaya ekleyin

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
  sekmesinde olayı, Supabase'de `purchases` tablosunda yeni satırı ve
  `profiles.is_premium`'un `true` olduğunu doğrulayın.

## 9. Ayrı ve henüz ele alınmamış bir konu: AI kontör satın alma

`payment-sheet` / `stripe-webhook` uçları AI kontör (kredi) satın alma için
yazılmıştı ama Stripe SDK'sı kaldırıldığından bu yana **hiçbir ekrandan
çağrılmıyor** — şu an kullanıcı arayüzünde kontör satın alma yolu yok. Bu,
premium abonelikten AYRI bir iş kalemi; istenirse aynı RevenueCat altyapısı
(tüketilebilir/non-renewing ürün olarak) veya ayrı bir çözümle ele alınabilir.
