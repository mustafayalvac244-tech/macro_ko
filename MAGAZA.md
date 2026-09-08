# Mağazaya Çıkış Denetimi

Bu dosya, "uygulama store'a salınmaya hazır mı" sorusunun **ölçülmüş** cevabını
tutar. Tahmin ve iyimser çerçeveleme yok; her satırın kanıtı yanında.

**Kısa cevap: hayır, henüz değil.** Üç zorunlu engel var ve üçü de sizin
hesap açmanızı gerektiriyor (kod tarafında yapılabilecekler yapıldı).

> **GÜNCELLEME — e-posta doğrulaması AÇILDI.** `mailer_autoconfirm = false`.
> Doğrulanmamış hesapla giriş denendi ve `email_not_confirmed` ile reddedildi
> (kanıtlandı). Bunun bir SONUCU var ve bilmeniz şart: doğrulama e-postası
> Supabase'in yerleşik göndericisinden çıkıyor, yani **saatte 2 e-posta** ve
> metin **İngilizce**. Yani şu anda saatte en fazla 2 kişi kayıt olabilir.
> Bugün gerçek kullanıcı akışı olmadığı için zararsız, ama **A2 (SMTP)
> yapılmadan mağazaya çıkılamaz** — çıkılırsa üçüncü kayıt olan kişi hesabına
> hiç giremez. Geri almak isterseniz tek komut, söylemeniz yeterli.

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

## B2. E-POSTA DOĞRULAMASI VE CAPTCHA (bu turda eklendi)

### Ne yapıldı

| Konu | Durum | Kanıt |
|---|---|---|
| E-posta doğrulaması | ✅ **Canlıda açık** | `mailer_autoconfirm = false`; doğrulanmamış hesapla giriş denendi → `email_not_confirmed` (400) |
| Doğrulanmamışken uygulamaya girme | ✅ Engellendi | `signUp` oturum döndürmezse ekran artık uygulamaya yönlendirmiyor, "E-postanızı doğrulayın" ekranını gösteriyor |
| Kayıt bilgilerinin kaybolması | ✅ **Kökten çözüldü** | Alanlar artık `handle_new_user` tetikleyicisinden yazılıyor (migration 0086). Oturumsuz açılan bir hesapta TC/baro/sicil profile **yazıldı** — canlı testle doğrulandı |
| Üstveriyle yetki yükseltme | ✅ Mümkün değil | Kayıt üstverisine `is_admin: true` ve `is_premium: true` enjekte edildi; profilde ikisi de **false** kaldı |
| Geçersiz TC | ✅ Reddediliyor | `tc_no: "abc123"` gönderildi, profile `null` yazıldı; diğer alanlar korundu |
| Türkçe hata mesajı | ✅ Var | "E-posta adresiniz henüz doğrulanmamış. Gelen kutunuzu kontrol edin." |

### Captcha — kod hazır, ANAHTAR BEKLİYOR

Seçim **Cloudflare Turnstile**, hCaptcha değil. Gerekçe doğrudan sizin
isteğiniz: hCaptcha çoğu kullanıcıya görsel bulmaca (trafik ışığı seçme)
gösterir; Turnstile'ın `interaction-only` kipi ise kullanıcıların büyük
kısmını **hiçbir etkileşim istemeden** geçirir.

Uygulanan tasarım: bileşen normalde **yüksekliği sıfır** olarak çizilir —
kullanıcı hiçbir şey görmez, hiçbir şeye tıklamaz. Yalnızca Turnstile gerçekten
insan onayı isterse kutu açılır. Kayıt, giriş ve şifre sıfırlama uçlarına
bağlandı. Yeni native bağımlılık **eklenmedi** (`react-native-webview` zaten
projedeydi), yani OTA ile gidebilir.

**Anahtar tanımlı değilken hiçbir şey çizilmez ve isteklere hiçbir alan
eklenmez** — yani bugünkü davranışın birebir aynısı; bu kod hiçbir şeyi bozamaz.

**Sizin yapmanız gereken:** [dash.cloudflare.com](https://dash.cloudflare.com)
→ Turnstile → Add site → widget mode **Managed**. İki anahtar çıkar. Bana
verin, gerisini ben yaparım.

**⚠️ SIRA ÖNEMLİ — tersi yapılırsa herkes kapıda kalır:**

1. Site anahtarı uygulamaya girer (`EXPO_PUBLIC_TURNSTILE_SITE_KEY`) → sürüm
   yayınlanır.
2. Kullanıcıların çoğu yeni sürüme geçer.
3. **Ancak o zaman** Supabase'de captcha zorunlu kılınır (secret key ile).

3'ü 1'den önce yapmak, eski sürümdeki **herkesin** kaydını ve girişini kırar.
Bu yüzden Supabase tarafında captcha'yı **bilerek açmadım**
(`security_captcha_enabled = false` olarak duruyor).

---

## B3. PLAN MODELİ YENİDEN KURULDU (bu turda)

**Bulunan durum (ölçüldü):** `is_premium` uygulamada **hiçbir şeyi açmıyordu** —
arandığında yalnız avatara rozet koyduğu ve admin panelinde göründüğü çıktı.
Deneme bitince de uygulama kilitlenmiyor, panoda bir hatırlatma çıkıyordu.
Yani 399 ₺'lik abonelik satılıyor, karşılığında hiçbir şey verilmiyordu. Bu tek
başına App Store Review 3.1.2 ret sebebidir.

**Ürün kararı (kullanıcının):** içtihat ücretsiz, yapay zekâ ücretli, 399 ₺'nin
de gerçek bir karşılığı olacak.

### Yeni katmanlar

| | Ücretsiz | Vekil Pro — 399 ₺ | + Yapay Zekâ — 1.999 ₺ |
|---|---|---|---|
| **İçtihat araması** | ✅ **Sınırsız** | ✅ Sınırsız | ✅ Sınırsız |
| Mevzuat, hesaplayıcı, şablon | ✅ Sınırsız | ✅ | ✅ |
| Duruşma, görev, ajanda, hatırlatma | ✅ Sınırsız | ✅ | ✅ |
| Dava | 5 | Sınırsız | Sınırsız |
| Müvekkil | 10 | Sınırsız | Sınırsız |
| Belge | 5 | Sınırsız | Sınırsız |
| Finans ve raporlar | ✖ | ✅ | ✅ |
| Yapay zekâ | 3 deneme sorusu | ✖ | 250 soru |

**İçtihat neden ücretsiz kalabiliyor:** bize API ücreti getirmiyor. Arama
doğrudan canlı UYAP/Bedesten'e gidiyor; ödediğimiz tek şey kendi arşivimizin
disk alanı.

**Ajanda/duruşma neden sınırsız:** uygulamanın çekirdek faydası bu. Bir
avukatın duruşma takvimini sınırlamak ürünü kullanılamaz kılar ve ücretsiz
katmanı tuzağa çevirir. Ücretsiz katman gerçekten işe yaramazsa kimse
ücretliye de geçmez.

### Sunucuda uygulandı — kanıtlandı

Limit **veritabanı tetikleyicisinde** (migration 0087), istemcide değil. Bu
oturumda istemci tarafı kilidin sahte olduğu iki kez kanıtlanmıştı.

| Senaryo | Sonuç |
|---|---|
| Ücretsiz kullanıcı, 30 davası var, limit 5 | `plan_limiti:dava:5` ile **reddedildi** |
| Aynı kullanıcı premium yapılınca | **Eklendi** (muafiyet çalışıyor) |
| Ücretsiz kullanıcı, finans kaydı | `plan_limiti:finans:0` ile **reddedildi** |

Test satırları silindi, hesap premium durumu geri alındı, dava sayısı 42'ye döndü.

**Mevcut veriye dokunulmuyor.** Tetikleyici yalnız YENİ kayıt eklemeyi
engelliyor; hiçbir satır silinmiyor, gizlenmiyor, salt-okunur olmuyor. Bugün
30 davası olan kullanıcı 30'unu da görmeye ve düzenlemeye devam eder.

**Kullanıcıya ne görünüyor:** "Kaydedilemedi" gibi yanıltıcı bir hata değil —
"Ücretsiz planda 5 dava açabilirsiniz ve bu hakkınız doldu. Mevcut davalarınız
duruyor; yenisini eklemek için Vekil Pro'ya geçin." + **Planları gör** düğmesi.

### Ekranda ne değişti

Üyelik ekranı artık **ücretsiz katmanı da gösteriyor** (önceden yalnız iki
ücretli kart vardı). En üstte içtihatın ücretsiz olduğunu söyleyen bir şerit,
ardından üç kart. Kullanım Koşulları'nın 3. bölümü de üç katmanı ve "içtihat
ücretsizliği kampanya değil, kalıcı kuraldır" taahhüdünü içeriyor.

---

## B4. YAYIN GECESİ TUZAK TEMİZLİĞİ

| # | Tuzak | Neden tehlikeliydi | Durum |
|---|---|---|---|
| T1 | `eas.json` → iOS `credentialsSource: "local"` | Yanında bir `credentials.json` bekler; o dosya depoda yok (doğru olarak .gitignore'da). Derleme tam yayın gecesi kimlik hatasıyla durabilirdi. | ✅ Kaldırıldı — EAS kendi yönettiği (remote) kimlik bilgilerini kullanacak |
| T2 | Apple incelemesi demo hesabı ücretsiz katmandaydı | Yeni plan limitlerinden sonra `demo@vekilpro.app` finans modülünü açamıyordu (`plan_limiti:finans:0`). İncelemeci uygulamanın yarısını göremez, "özellik çalışmıyor" diye reddedebilirdi. | ✅ `is_premium = true` yapıldı. `ai_tier` BİLEREK null bırakıldı: incelemeci AI satın alma akışını hâlâ test edebilsin diye |
| T3 | Ölü Stripe değişkeni | `EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_your-publishable-key` hem production hem preview ortamında duruyordu; uygulamada Stripe'a tek satır referans yok. | ✅ İki ortamdan da silindi |

**Doğrulandı:** demo hesabıyla gerçek giriş denendi, `access_token` döndü.

### Bilerek DOKUNMADIĞIM bir şey

`eas.json`'daki build profillerinin `env` blokları, EAS'in sunucu tarafındaki
ortam değişkenleriyle **aynı değerleri tekrarlıyor** (Supabase URL + anon key).
İkisi ayrışırsa derleme ile OTA farklı arka uca bakar.

Bunu bu gece **düzeltmedim**. Sebebi: ikisinin değerlerini karşılaştırdım ve
şu an **birebir aynılar**, yani bugün bir arıza üretmiyor. Düzeltmek için
profillere `environment` alanı ekleyip `env` bloklarını silmek gerekir — bu,
şema hatası ihtimali taşıyan bir değişiklik ve yanlış giderse tam yayın
gecesinde derlemeyi durdurur. Riski getirisinden büyük buldum. Yayından sonra
sakin bir günde yapılmalı.

**Ayrıca doğrulandı:** EAS'in production ortamında `EXPO_PUBLIC_SUPABASE_URL`
ve `EXPO_PUBLIC_SUPABASE_ANON_KEY` **tanımlı** — yani bugüne kadar yayınlanan
OTA'lar doğru arka uçla paketlenmiş. (Bunu varsaymamıştım, ölçtüm.)

---

## D. KARAR SİZE AİT OLAN BAŞLIKLAR

1. **Test hesapları canlıda duruyor.** `@vekil.local` / `@vekilpro.app`
   uzantılı 6+ hesap ve verileri üretim veritabanında. Silinmesi geri
   alınamaz olduğu için kendi başıma silmedim — "temizle" derseniz silerim.

2. **E-posta doğrulaması artık AÇIK** (bkz. B2). Tek açık uç: SMTP olmadan
   saatte 2 kayıt sınırı ve İngilizce e-posta. Mağazaya çıkmadan önce A2
   kapatılmalı.

3. **AI paketi bugün ne satıyor?** Anahtar geldiğinde bile açık olan AI
   özellikleri: **dilekçe üretimi** ve **belge inceleme** (ikisi de ölçüldü).
   Mütalaa, sohbet, içtihat analizi kapalı. 1.999 ₺'yi bu ikisiyle mi
   başlatmak istersiniz, yoksa mütalaayı da açıp öyle mi — bu ürün kararı ve
   sizin.

4. **Kullanım Koşulları metnini bir hukukçu okumadı.** Mağaza incelemesini
   geçecek ve kullanıcıyı yanıltmayan bir taslak yazdım; ticari yayından önce
   bir meslektaşınıza okutmanız gerekir. Siz avukatsınız — bu sizin alanınız,
   benim değil.

---

## E. Sıra

1. SMTP hesabı açın (A2) → bana söyleyin → şifre sıfırlamayı düzeltip **test
   ederim** (A1 kapanır).
2. Anthropic anahtarını verin → AI paketi gerçekten çalışır hâle gelir.
3. RevenueCat + mağaza hesapları (A3) → satış açılır.
4. Turnstile anahtarlarını verin → captcha'yı sıraya uygun açalım.
5. Native derleme (`react-native-purchases` eklendiği için OTA yetmez) ve
   mağaza gönderimi.
