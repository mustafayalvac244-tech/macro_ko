# Ödeme Kurulumu ve Deneme Ödemesi Rehberi (Stripe)

Vekil'de ödemeler **Stripe** ile alınır. Kart bilgileri hiçbir zaman uygulamada
veya veritabanınızda saklanmaz — Stripe'ın güvenli ödeme ekranında (PCI-DSS
uyumlu) işlenir. **Test modunda gerçek para çekilmez**; sahte kart numarasıyla
istediğiniz kadar deneme yaparsınız.

Toplam süre: ~10 dakika.

---

## 1. Stripe hesabı açın (ücretsiz)

1. https://dashboard.stripe.com/register adresinden hesap açın.
2. Girişte sağ üstte **"Test mode" (Test modu)** anahtarının **AÇIK** olduğundan
   emin olun (turuncu görünür). Test modundayken her şey sahtedir.

## 2. Anahtarlarınızı alın

1. Stripe panelinde **Developers → API keys** sayfasına gidin.
2. İki anahtar göreceksiniz:
   - **Publishable key** — `pk_test_...` ile başlar. Herkese açık olabilir;
     uygulamanın içine gömülür.
   - **Secret key** — `sk_test_...` ile başlar. **GİZLİDİR.** Sadece Supabase'e
     girilir, asla uygulamaya konmaz, kimseyle paylaşılmaz.

## 3. Supabase'e sunucu fonksiyonunu kurun

1. https://supabase.com/dashboard → projeniz → sol menüde **Edge Functions**.
2. **"Create function"** (veya "New function") → isim: `payment-sheet`
3. Açılan kod editörüne bu depodaki
   [`supabase/functions/payment-sheet/index.ts`](./supabase/functions/payment-sheet/index.ts)
   dosyasının **tüm içeriğini** yapıştırın → **Deploy**.
4. Fonksiyonun sayfasında **Secrets** bölümüne gidin → yeni secret ekleyin:
   - İsim: `STRIPE_SECRET_KEY`
   - Değer: 2. adımdaki `sk_test_...` anahtarınız → kaydedin.

## 4. Publishable key'i uygulamaya ekleyin

`eas.json` (veya yerel `.env`) içine:

```
EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_SIZIN-ANAHTARINIZ
```

Ardından APK'yı **yeniden derleyin** (anahtar derleme sırasında gömülür).

## 5. Deneme ödemesi yapın 💳

1. Uygulamada **Ayarlar → Vekil Premium** → **Güvenli Ödeme Yap**.
2. Stripe'ın ödeme ekranı açılır. Şu **sahte test kartını** girin:
   - Kart numarası: **4242 4242 4242 4242**
   - Son kullanma: gelecekte herhangi bir tarih (ör. **12/30**)
   - CVC: herhangi 3 hane (ör. **123**)
   - Posta kodu isterse: **34000**
3. **Öde**'ye basın → "Ödeme başarılı! 🎉" görürsünüz.
4. Stripe panelinde **Payments** sayfasını açın → 199,00 TL'lik test ödemenizi
   listede görürsünüz. Gerçek para hareketi YOKTUR.

### Başka senaryoları denemek isterseniz (hepsi sahte)

| Kart numarası          | Sonuç                            |
| ---------------------- | -------------------------------- |
| 4242 4242 4242 4242    | Başarılı ödeme                   |
| 4000 0000 0000 0002    | Kart reddedildi                  |
| 4000 0025 0000 3155    | 3D Secure doğrulaması ister      |
| 4000 0000 0000 9995    | Yetersiz bakiye                  |

## Gerçek (canlı) ödemeye geçiş — ileride

1. Stripe hesabınızda işletme doğrulamasını tamamlayın (banka hesabı vb.).
2. Test mode anahtarını KAPATIN; **canlı** `pk_live_` / `sk_live_` anahtarlarını
   alın.
3. Supabase secret'ını `sk_live_...` ile, `eas.json`'daki anahtarı `pk_live_...`
   ile değiştirin, yeniden derleyin.
4. Not: Google Play'de yayınlarken uygulama İÇİ dijital özellik satışı Google
   Play Billing gerektirir; Stripe fiziksel hizmet/danışmanlık ücretleri için
   uygundur. Mağazaya çıkmadan önce bu ayrımı konuşalım.
