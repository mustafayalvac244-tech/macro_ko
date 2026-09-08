# Mağazaya Çıkış Denetimi

Bu dosya, "uygulama store'a salınmaya hazır mı" sorusunun **ölçülmüş** cevabını
tutar. Tahmin ve iyimser çerçeveleme yok; her satırın kanıtı yanında.

**Kısa cevap: hayır, henüz değil.** Üç zorunlu engel var ve üçü de sizin
hesap açmanızı gerektiriyor (kod tarafında yapılabilecekler yapıldı).

---

## A. ZORUNLU ENGELLER (bunlar çözülmeden yayına çıkılamaz)

### A1. Şifre sıfırlama tamamen çalışmıyor — KANITLANDI

**Durum:** Kullanıcı şifresini unutursa hesabına **bir daha giremez**.

**Kanıt (canlı yapılandırmadan okundu, tahmin değil):**

- Supabase'deki `recovery` e-posta şablonunun tamamı şu:
  `<p><a href="{{ .ConfirmationURL }}">Reset password</a></p>` — yani içinde
  **yalnız bir bağlantı var, kod yok.**
- Uygulamadaki ekran (`app/forgot-password.tsx`) ise **6 haneli kod** istiyor:
  `maxLength={6}`, `disabled={code.trim().length < 6}`, ardından
  `verifyOtp({ type: 'recovery' })`.
- E-posta kodu hiç göndermediği için kullanıcı bu alanı **asla dolduramaz**.

**Neden düzeltemedim:** Supabase'in kendi cevabı:

> `Email template modification is not available for free tier projects using
> the default email provider. Please upgrade your plan or configure a custom
> SMTP provider.` (HTTP 400)

Yani şablon, custom SMTP tanımlanmadan **değiştirilemiyor**.

**Çözüm:** aşağıdaki A2 yapıldığı anda şablonu ben düzeltirim; uygulama
tarafında değişiklik gerekmez (mevcut kod zaten doğru kurgulanmış).

### A2. Gerçek bir e-posta sağlayıcısı (SMTP) yok

**Durum:** Proje Supabase'in yerleşik e-posta servisini kullanıyor
(`smtp_host = None`).

**Ölçülen sınır:** `rate_limit_email_sent = 2` — **saatte 2 e-posta, tüm proje
için.** Aynı saatte üçüncü kullanıcı şifresini unutursa e-posta hiç gitmez.
Bunu yükseltmeyi denedim, Supabase reddetti:

> `Custom SMTP required to configure RATE_LIMIT_EMAIL_SENT.` (HTTP 401)

**Sizin yapmanız gereken** (ücretsiz seçenekler yeterli):

1. [resend.com](https://resend.com) (aylık 3.000 e-posta ücretsiz) ya da
   Brevo / SendGrid üzerinden bir hesap açın.
2. Bir alan adı doğrulayın (ör. `vekilpro.app`) — SPF/DKIM kayıtları panelde
   verilir.
3. Supabase → Authentication → Emails → **SMTP Settings**'e girin:
   host, port (587), user, pass, gönderen adresi (`destek@vekilpro.app`),
   gönderen adı (`Vekil Pro`).
4. Bana haber verin: şablonları Türkçeye çevirip şifre sıfırlama kodunu
   (`{{ .Token }}`) ekleyeceğim ve gerçek bir sıfırlama denemesiyle test
   edeceğim.

**Not:** Şu an tüm e-posta metinleri **İngilizce** (Supabase varsayılanı).
Türk avukatlara İngilizce "Reset your password" gitmesi de A2 ile düzelir.

### A3. Satın alma altyapısı (RevenueCat + mağaza) hiç kurulmadı

Kod tarafı hazır ve doğru davranıyor: RevenueCat yapılandırılmadığı için
teklif `null` geliyor ve satın alma butonu "çok yakında" diyor — **sahte
premium verilmiyor, ücretsiz açılmıyor.** Ama bu, bugün hiçbir şey
satılamayacağı anlamına da geliyor.

Adımlar `IAP_KURULUM.md` dosyasında. Apple/Google geliştirici hesabı gerekir.

---

## B. BU DENETİMDE DÜZELTİLENLER (kodda, yayına hazır)

| # | Sorun | Neden ciddiydi | Durum |
|---|---|---|---|
| B1 | **AI paketi kapalı özellikleri satıyordu** | Kart "12 hukuki mütalaa dahil", "Mütalaa: derin inceleme", "Vekil AI asistanı", "İçtihat araması" diyordu; oysa `AI_MUTALAA_ENABLED=false` ve `AI_ENABLED=false`. 1.999 ₺ ödeyen kullanıcı o ekranlarda "Çok Yakında" görecekti. App Store Review 2.1/3.1.2 doğrudan reddeder; Türkiye'de ayıplı hizmettir. | ✅ Liste artık bayraklardan türetiliyor — kapalı özellik reklam edilemiyor |
| B2 | **Temel paket AI vaat ediyordu** | 399 ₺'lik kartta "Yapay zekâ özellikleri — çok yakında üyeliğe dahil" yazıyordu. AI ayrı ve 1.999 ₺'lik pakettir. "Ben AI için ödedim" itirazının kaynağı. | ✅ "Yapay zekâ özellikleri ayrı pakettedir" |
| B3 | **Kullanım Koşulları (EULA) hiç yoktu** | Apple, abonelik satan uygulamada Gizlilik'in yanında Kullanım Koşulları'nı da **uygulama içinde** zorunlu tutar. Tek başına ret sebebi. | ✅ `app/terms.tsx` eklendi; Ayarlar, Üyelik ve Kayıt ekranlarından bağlantılı |
| B4 | **AI kartında otomatik yenileme ibaresi yoktu** | Temel pakette deneme metni vardı, AI katmanında hiç yoktu. Review 3.1.2 bunu ister. | ✅ Fiyat + otomatik yenileme + iptal yolu yazıldı |
| B5 | **Çalışmayan AI paketi satın alınabilir olacaktı** | Uç, `ANTHROPIC_API_KEY` yokken 503 döner (doğrusu bu — sessizce ucuz modele düşmüyor). Ama RevenueCat kurulduğu gün, anahtar olmasa bile paket satılabilir hâle gelirdi ve müşterinin **her** isteği hata alırdı. | ✅ Sağlık yoklaması "ücretli hat kapalı" derse satın alma başlamıyor (ağ hatasında engellemiyor) |
| B6 | **Depolamada dosya boyutu sınırsızdı** | `file_size_limit = NULL`. Tek bir dev yükleme, 1 GB'lık ücretsiz kotayı bitirip **tüm** büroların belge yüklemesini durdurabilirdi. | ✅ 25 MB sınır kondu (mevcut en büyük dosya 714 kB — 35 kat pay) |
| B7 | **Kayıtta sessiz veri kaybı riski** | `profiles` güncellemesinin hatası hiç okunmuyordu. Bugün çalışıyor; e-posta doğrulaması açıldığı an oturum olmayacağı için TC/baro/sicil **uyarısız** kaybolurdu. | ✅ Hata artık yakalanıp loglanıyor |
| B8 | **İstemcide sahte premium yüzeyi** | Premium durumu `AsyncStorage`'daki `vekil-premium` anahtarından da okunuyordu. Uygulamanın hiçbir yeri onu yazmıyor (ölü kod) ama cihaza erişen biri "abone" görüntüsü üretebilirdi. | ✅ Kaldırıldı — tek kaynak sunucu |
| B9 | **Ölü fiyat metni** | `'premium.price': '₺199,00'` + `'tek seferlik'`. Kullanılmıyordu ama abonelik satan bir üründe "tek seferlik" diyen bir fiyat dizesini durdurmak, birinin onu yeniden bağlaması riskini taşır. | ✅ Silindi |
| B10 | **`site_url` = `http://localhost:3000`** | E-postadaki bağlantılar telefonda ölü bir adrese gidiyordu. | ✅ `vekil://` yapıldı, `uri_allow_list` tanımlandı |

---

## C. DENETLENDİ VE SAĞLAM ÇIKTI (kanıtıyla)

Bunları da kontrol ettim; **sorun bulunmadı** — "bakmadım" ile "baktım, temiz"
farkı önemli olduğu için yazıyorum.

| Konu | Sonuç | Kanıt |
|---|---|---|
| Kayıt formundaki bilgiler kaydediliyor mu | ✅ Çalışıyor | Tek gerçek kayıtta TC, baro ve sicil dolu. **Yanlış alarma düşmedim:** boş görünen 8 hesap benim test hesaplarım (`@vekil.local`, `@vekilpro.app`), form üzerinden değil API ile açılmışlar |
| Başka avukat TC / telefon / e-postamı görebilir mi | ✅ Hayır | `authenticated` rolünün `profiles` üzerinde okuyabildiği kolonlar: `avatar_url, bar_number, baro, created_at, firm_name, friend_code, full_name, id, is_admin, is_premium, updated_at`. `tc_no`, `phone`, `email` **yok** |
| Satın alma kaydı taklit edilebilir mi | ✅ Hayır | `purchases` tablosunda yalnız SELECT politikası var; INSERT/UPDATE/DELETE politikası yok |
| Kullanıcı kendini premium/admin yapabilir mi | ✅ Hayır | `trg_protect_profile_privileges` tetikleyicisi canlıda aktif |
| RLS açığı | ✅ Yok | Politikasız tek iki tablo `ictihat_harvest_state` ve `legal_rules`; ikisinde de RLS **açık** ve politika **sıfır** = istemciye tamamen kapalı (doğru durum) |
| Belge kovası herkese açık mı | ✅ Hayır | `case-documents.public = false` |
| Hesap silme (Apple zorunlu) | ✅ Var | Ayarlar > Hesabı Sil; storage temizliği + `delete_account()` RPC |
| Satın almaları geri yükleme (Apple zorunlu) | ✅ Var | `premium.tsx` → `restorePurchases()` |
| Eksik çeviri anahtarı | ✅ Sıfır | Kullanılan tüm `t('...')` anahtarları hem `tr.ts` hem `en.ts` içinde var; iki dosya arasında fark yok |
| Derleme ve testler | ✅ Temiz | `tsc --noEmit` hatasız, 271/271 test geçiyor |
| Ücretli katman sessizce ucuz modele düşüyor mu | ✅ Hayır | Anahtar yoksa 503 `not_configured` döner — para ödeyene Groq verilmiyor |

---

## D. KARAR SİZE AİT OLAN BAŞLIKLAR

1. **Test hesapları canlıda duruyor.** `@vekil.local` / `@vekilpro.app`
   uzantılı 6+ hesap ve verileri üretim veritabanında. Silinmesi geri
   alınamaz olduğu için kendi başıma silmedim — "temizle" derseniz silerim.

2. **E-posta doğrulaması kapalı** (`mailer_autoconfirm = true`). Bugünkü
   faydası: kayıt anında uygulamaya girilebiliyor. Riski: biri başkasının
   e-postasıyla hesap açabilir ve yanlış yazılan e-posta şifre kurtarmayı
   imkânsız kılar. Açmak isterseniz **önce A2 (SMTP) şart** — aksi hâlde
   kayıt tamamen kırılır.

3. **Captcha kapalı** (`security_captcha_enabled = false`). Otomatik toplu
   kayıt mümkün; veritabanı zaten 500 MB sınırının %83'ünde. hCaptcha/Turnstile
   ücretsiz, açmamı isterseniz açarım (uygulama tarafında da değişiklik
   gerekir).

4. **AI paketi bugün ne satıyor?** Anahtar geldiğinde bile açık olan AI
   özellikleri: **dilekçe üretimi** ve **belge inceleme** (ikisi de ölçüldü).
   Mütalaa, sohbet, içtihat analizi kapalı. 1.999 ₺'yi bu ikisiyle mi
   başlatmak istersiniz, yoksa mütalaayı da açıp öyle mi — bu ürün kararı ve
   sizin.

5. **Kullanım Koşulları metnini bir hukukçu okumadı.** Mağaza incelemesini
   geçecek ve kullanıcıyı yanıltmayan bir taslak yazdım; ticari yayından önce
   bir meslektaşınıza okutmanız gerekir. Siz avukatsınız — bu sizin alanınız,
   benim değil.

---

## E. Sıra

1. SMTP hesabı açın (A2) → bana söyleyin → şifre sıfırlamayı düzeltip **test
   ederim** (A1 kapanır).
2. Anthropic anahtarını verin → AI paketi gerçekten çalışır hâle gelir.
3. RevenueCat + mağaza hesapları (A3) → satış açılır.
4. Test hesaplarını temizleyelim, captcha kararını verin.
5. Native derleme (`react-native-purchases` eklendiği için OTA yetmez) ve
   mağaza gönderimi.
