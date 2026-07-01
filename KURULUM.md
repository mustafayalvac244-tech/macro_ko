# Kurulum ve Telefona Yükleme Rehberi (Türkçe)

Bu rehber, **Macro Ko** uygulamasını kurulabilir bir Android **APK** olarak
derleyip telefonunuza yüklemeniz için adım adım anlatır. Bu yöntemde **Expo Go
GEREKMEZ** — uygulama bağımsız çalışır, SDK sürüm uyumsuzluğu sorunu olmaz.

Toplam süre: ~20-30 dakika (çoğu bekleme).

---

## Bölüm 1 — Supabase (veritabanı) kurulumu  ⏱️ ~5 dk

Uygulamada giriş yapıp veri kaydedebilmek için ücretsiz bir Supabase projesi
gerekir.

1. https://supabase.com adresine gidin → **Start your project** → ücretsiz
   hesap açın.
2. **New project** → bir isim ve şifre verin → oluşturun (1-2 dk sürer).
3. Sol menüden **Project Settings → API** açın. Şu ikisini kopyalayın:
   - **Project URL** (ör. `https://abcd1234.supabase.co`)
   - **anon public** anahtarı (uzun `eyJ...` metni)
4. Sol menüden **SQL Editor** açın → **New query** → bu depodaki
   `supabase/migrations/0001_init.sql` dosyasının **tüm içeriğini** yapıştırın →
   **Run**. (Tüm tabloları ve güvenlik kurallarını kurar.)
5. **Authentication → Providers → Email**'in açık olduğundan emin olun.
   (İsterseniz **Authentication → Sign In / Providers** altında e-posta
   doğrulamasını kapatarak test için hızlı kayıt yapabilirsiniz.)

---

## Bölüm 2 — Supabase bilgilerini projeye ekleme  ⏱️ ~2 dk

1. Bilgisayarınızda proje klasöründeki **`eas.json`** dosyasını bir metin
   düzenleyiciyle açın.
2. `preview` (ve isterseniz `production`) bölümündeki şu iki satırı, Bölüm 1'de
   kopyaladığınız gerçek değerlerle değiştirin:
   ```json
   "EXPO_PUBLIC_SUPABASE_URL": "https://SIZIN-PROJENIZ.supabase.co",
   "EXPO_PUBLIC_SUPABASE_ANON_KEY": "eyJ...SIZIN-ANON-KEYINIZ..."
   ```
3. Kaydedin.

> Not: `anon` anahtarı istemci tarafı için tasarlanmış herkese açık bir
> anahtardır; verileriniz Supabase'deki satır güvenliği (RLS) kurallarıyla
> korunur, o yüzden bu anahtarı uygulamaya gömmek güvenlidir.

---

## Bölüm 3 — APK derleme (EAS)  ⏱️ ~15-20 dk

1. Bilgisayarınıza **Node.js** kurulu olmalı (https://nodejs.org, LTS).
2. Proje klasöründe bir terminal açın ve **EAS CLI**'yi kurun:
   ```bash
   npm install -g eas-cli
   ```
3. Ücretsiz bir **Expo hesabı** oluşturup giriş yapın:
   ```bash
   eas login
   ```
   (Hesabınız yoksa https://expo.dev/signup adresinden 1 dakikada açabilirsiniz.)
4. Projeyi Expo hesabınıza bağlayın (soruları Enter/"yes" ile geçin):
   ```bash
   eas init
   ```
5. APK'yı derleyin:
   ```bash
   eas build -p android --profile preview
   ```
   - Derleme Expo'nun bulut sunucularında yapılır (~15 dk).
   - Bittiğinde terminalde ve https://expo.dev panelinizde bir **indirme
     bağlantısı** görünür.

---

## Bölüm 4 — Telefona yükleme  ⏱️ ~2 dk

1. Derleme bitince çıkan bağlantıyı telefonunuzda açın (veya `expo.dev`
   panelinden **Builds** → en üstteki derleme → **Install/Download**).
2. `.apk` dosyasını indirin.
3. Açmaya çalışınca Android "Bilinmeyen kaynaklara izin ver" diye sorabilir →
   izin verin.
4. Kurun ve **Macro Ko**'yu açın. 🎉
5. **Kayıt Ol** ile bir hesap oluşturun → panoya (dashboard) girin → dava,
   müvekkil, duruşma, belge ekleyin.

---

## Sık sorunlar

- **Giriş yaparken hata:** `eas.json` içindeki Supabase URL/anon key yanlış veya
  Bölüm 1'deki SQL çalıştırılmamış olabilir. Kontrol edip **yeniden derleyin**
  (Bölüm 3, adım 5).
- **Supabase bilgilerini değiştirdim:** Değişikliğin uygulamaya yansıması için
  APK'yı yeniden derlemeniz gerekir (`eas build -p android --profile preview`).
- **iPhone kullanıyorum:** APK yalnızca Android içindir. iPhone için
  `eas build -p ios` gerekir; bu Apple geliştirici hesabı gerektirir. En kolayı
  bir Android cihaz kullanmaktır.
