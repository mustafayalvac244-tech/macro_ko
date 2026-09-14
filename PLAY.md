# Google Play'e Çıkış — Gerçek Plan

Bu dosya, geliştirici hesabı açıldıktan sonra (13.09.2026) yayına kadar
kalan işleri sırayla yazar. Her madde ya **yapıldı** ya da **kim yapacak**
diye işaretli. Tahmin yok; ölçülmüş olanın yanında ölçümü de var.

---

## 0. ÖNCE ŞUNU BİLİN: bugün üretime çıkamayız, çıkmamalıyız da

Hesap **kişisel (bireysel)** olarak açıldı. Google'ın kuralı:

> 13 Kasım 2023'ten sonra açılan kişisel geliştirici hesapları, üretim
> erişimine başvurabilmek için uygulamayı **en az 12 test kullanıcısıyla**,
> bu kullanıcılar **kesintisiz 14 gün** kayıtlı kalacak şekilde **kapalı
> testte** koşmak zorundadır.
> — [Play Console Yardım](https://support.google.com/googleplay/android-developer/answer/14151465)

Bunun pratikte anlamı:

- **Dahili test (internal) bu süreyi SAYMAZ.** Sayan kanal **kapalı test**
  (closed / alpha).
- 14 gün **kesintisiz**: bir test kullanıcısı çıkıp tekrar girerse sayaç
  onun için sıfırlanır. 12 sayısı, 14 günü aralıksız tamamlamış kişi
  sayısıdır.
- Yani **bugün kapalı testi başlatırsak en erken 14 gün sonra** üretim
  erişimine başvurabiliriz; başvuru da ayrıca inceleniyor.

**Doğru okuma:** "14 gün kaybettik" değil. Bu 14 gün, ürünü 12 avukatın
gerçek telefonunda çalıştırdığımız ve bugüne kadar hiç yapılmamış bir şeyi
— **gerçek kullanıcı verisiyle ölçüm** — yapabileceğimiz tek pencere.
Bugüne kadarki bütün ölçümler bizim kendi kurduğumuz senaryolardı.

---

## 1. Bugün hazır olanlar (ölçüldü)

| Konu | Durum | Kanıt |
|---|---|---|
| Android paket adı | **`com.vekilpro.app`** (13.09.2026'da değişti) | `app.json` |
| iOS bundle ID | `com.macroko.legal` — **Apple'da kayıtlı, değiştirilemiyor** | `eas.json` (ascAppId 6789656277) |
| Sürüm | 3.3.2 · versionCode **uzaktan** (EAS) yönetiliyor, ilk derlemede 1→**2** oldu | `eas.json` (`appVersionSource: remote`) |
| **İlk AAB** | **13.09.2026 12:04'te üretildi** — projenin ilk Android derlemesi | koşu #2, 24 dk, imzalama anahtarı EAS'ta hazırdı |
| AAB derleme profili | `production` → `app-bundle` | `eas.json` |
| E-posta altyapısı | **Çalışıyor** — `smtp.resend.com`, gönderen `noreply@vekilpro.app`, saatlik sınır 200, OTP 6 hane / 1 saat | 13.09.2026, `auth-sablon.yml` (kip: oku) canlı ayarlardan okundu |
| Şifre sıfırlama | Kod tabanlı akış kurulu | `app/forgot-password.tsx` |
| Hesap silme | Uygulama içinde, geri alınamaz, yedeklerden de siler | `app/hesap-sil.tsx`, `docs/hesap-silme.html` |
| Gizlilik / koşullar / güvenlik sayfaları | Canlı | vekilpro.app/privacy.html · /terms.html · /guvenlik.html |
| KVKK açık rıza akışı | Okunmadan imzalanamıyor, kanıt kaydediliyor | `src/components/KvkkImza.tsx`, migration 0130 |
| Satın alma kodu | RevenueCat sarmalayıcısı hazır; ürün yoksa "çok yakında" der, sahte premium VERMEZ | `src/lib/purchases.ts` |

> **MAGAZA.md güncel değil.** Oradaki A1 (şifre sıfırlama) ve A2 (SMTP)
> engelleri kapandı; yukarıdaki ölçüm bunu gösteriyor. A3 (satın alma
> kurulumu) hâlâ açık ve aşağıda 3. adımda.

---

## 2. İki gizli anahtar — BUNLARI SİZ EKLEYECEKSİNİZ

Bana ya da başka birine **yazmayın**; ikisi de doğrudan GitHub'a girer.
GitHub → Settings → Secrets and variables → Actions → New repository secret.

**`EXPO_TOKEN`**
expo.dev → Account settings → Access tokens → Create token.
Bu belirteç Expo hesabınızdaki bütün projelerde derleme yapabilir.

**`GOOGLE_PLAY_SERVICE_ACCOUNT`**
1. Play Console → Kullanıcılar ve izinler → **API erişimi**
2. Yeni servis hesabı oluştur (Google Cloud'a yönlendirir)
3. Google Cloud'da o servis hesabı için **JSON anahtar** üret, indir
4. Play Console'a dön, servis hesabına **"Sürümleri yönet"** yetkisi ver
5. İndirdiğiniz JSON dosyasının **tamamını** bu secret'a yapıştırın

İkisi tanımlandığında: Actions → **Android Derle ve Gönder** → `derle-ve-gonder`.
İş akışı anahtarı geçici bir dosyaya yazar, kullanır ve **her hâlükârda siler**;
depoya hiç girmez (`.gitignore`'da da kayıtlı).

---

## 3. Play Console'da abonelik ürünleri (siz)

Kod tarafı hazır. Panelde kurulacak iki ürün — **fiyatlar ve haklar
13.09.2026 itibarıyla**:

| Ürün kimliği | Ad | Fiyat | Verdiği yetki (entitlement) |
|---|---|---|---|
| `vekil_premium_monthly` | Vekil Pro | **399 ₺/ay** | `premium` |
| `vekil_ai_monthly` | Vekil Pro + Yapay Zekâ | **2.999 ₺/ay** | `premium` **ve** `ai` |

> Kimlikler **uydurulmadı**, `IAP_KURULUM.md`'de zaten yazılı olanlar. Apple
> tarafıyla da aynı isimler kullanılıyor; ayrışırsa RevenueCat'te iki ayrı
> ürün gibi görünür ve "AI planı temeli de içerir" kuralı bozulur.

- AI paketi **iki yetkiyi birden** vermeli; "AI planı temeli de içerir" sözü
  buradan geliyor ve kod bunu bekliyor.
- Aylık haklar: **1650 istek** (ilk **750**'si en yetenekli modelle, sonrası
  daha hafif modele yönlenir) + **25 hukuki mütalaa**. Devretmez.
- **3 deneme hakkı** ₺399'luk pakete aittir (13.09.2026 ürün kararı).
  Ücretsiz hesapta yapay zekâ tamamen kapalıdır. Bu bir **sunucu sayacıdır**
  (`profiles.deneme_soru_kullanildi`), Play'de ürün olarak kurulmaz.
- Adım adım RevenueCat kurulumu: `IAP_KURULUM.md`.

---

## 4. Mağaza kaydı — doldurulacak formlar

### 4.1 Uygulama erişimi (App access) — ATLANIRSA RED SEBEBİ

Uygulama giriş ekranının arkasında. Google incelemecisi giremezse uygulamayı
inceleyemez ve reddeder. Play Console → Uygulama içeriği → **Uygulama erişimi**
→ "Tüm işlevler kısıtlı" → bir **test hesabı** girin:

```
E-posta : inceleme@vekilpro.app   (bu hesabı önceden açın ve doğrulayın)
Şifre   : (güçlü bir şifre; buraya değil, forma yazın)
Not     : Hesapta örnek dosya/müvekkil kayıtları hazırdır. Yapay zekâ
          özellikleri ücretli pakete dahildir; inceleme için bu hesaba
          ücretsiz olarak "ai" katmanı tanımlanmıştır.
```

> Hesabı açtıktan sonra bana söyleyin: `profiles.ai_tier = 'ai'` ve
> `is_premium = true` yazan tek satırlık bir migration hazırlayayım —
> incelemeci ödeme yapmadan bütün ekranları görebilsin.

### 4.2 Veri güvenliği (Data safety) — gerçeğe uygun cevaplar

Bu formda yanlış beyan, uygulamanın kaldırılma sebebidir. Aşağıdakiler
koddan ve ölçümden çıkarıldı (`src/config/kvkk.ts` → `ALICILAR`):

| Soru | Cevap |
|---|---|
| Veri topluyor musunuz? | **Evet** |
| Veri üçüncü taraflarla paylaşılıyor mu? | **Evet** — yapay zekâ sağlayıcıları (aşağıda) |
| Aktarımda şifreleme | **Evet** (TLS) |
| Kullanıcı silme isteyebilir mi? | **Evet** — uygulama içi ve vekilpro.app/hesap-silme.html |
| Toplanan türler | Kişisel bilgi (ad, e-posta, telefon — telefon isteğe bağlı); Uygulama etkinliği; **Dosyalar ve belgeler** (kullanıcının yüklediği); Uygulama bilgileri ve performansı (hata kayıtları) |
| Kullanım amacı | Uygulama işlevselliği, hesap yönetimi |
| Reklam / izleme | **YOK** — uygulamada reklam kimliği, izleme ya da üçüncü taraf analiz yok |

**Paylaşım kimlerle (formda "üçüncü taraf" olarak beyan edilir):**
Anthropic, Google (Gemini), Groq, OpenAI — yalnız kullanıcının yapay zekâ
ekranına **kendi yazdığı/eklediği metin**, yalnız **açık rıza** varsa.
Veritabanı topluca gönderilmez. Saklama: Supabase (AB — İrlanda).

### 4.3 İçerik derecelendirmesi

Anket: **Yardımcı program / üretkenlik**. Şiddet, cinsellik, kumar **yok**.

**"Kullanıcılar içerik oluşturup başkalarına gösterebilir mi?" → HAYIR.**

Bu cevap **ANDROID UYGULAMASI İÇİN** verilir ve Android uygulamasında
kullanıcıların birbirine içerik gösterebileceği hiçbir yüzey **yoktur**.

**14.09.2026 — durum değişti, cevap değişmedi. Sebebini okumadan formu
doldurmayın.** Tevkil panosu ve meslektaş yazışması o gün **web sürümüne geri
açıldı**. Buna rağmen Android cevabı "HAYIR" olarak kalıyor, çünkü özellik
mobil uygulamada **gizlenmedi, gerçekten yok**:

- Ekran gövdeleri `src/components/tevkil/` altında ve Metro'nun platform
  uzantısıyla ayrılıyor: `Pano.web.tsx` yalnız **web** paketine giriyor,
  native pakete `Pano.tsx` (bir "yalnız web sürümünde" notu) giriyor.
- Yani derin bağlantıyla `/tevkil` açılsa bile Android'de pano kodu
  **çalıştırılamaz — pakette bulunmuyor.**
- Bu ayrım bilerek `app/` dışında yapıldı: Expo Router (SDK 57) dokümanına
  göre `app/` içindeki platform uzantısı ancak platformsuz sürüm de varsa
  çalışır, yani rota dosyası tek başına özelliği native'de gizleyemezdi.
  Daha önceki hata tam buydu: ekranlar menüde yoktu ama rota olarak
  duruyorlardı — **gizli bir özellik, ankette "hayır" demeyi haklı
  çıkarmaz.** Şimdi gizli değil, yok.

> ⚠️ **CEVABI "EVET"E ÇEVİRMENİZ GEREKEN TEK DURUM:** panonun Android'de de
> açılması. O an `src/components/tevkil/*.web.tsx` bölmesi kaldırılmış ya da
> menü koşulu (`Platform.OS === 'web'`, `src/components/Sidebar.tsx`)
> gevşetilmiş demektir. Bu olursa aynı anda üç şey güncellenir: bu madde,
> 4.2'deki veri güvenliği formu ve — zaten güncel olan — KVKK metinleri.
>
> **KVKK tarafı ARTIK GERİDE DEĞİL.** Aydınlatma metnine "7. Meslektaş
> Panosu" başlığı eklendi (`src/components/KvkkMetin.tsx`, TR ve EN),
> `docs/privacy.html` ve `docs/guvenlik.html` düzeltildi, `KVKK_SURUM`
> `2026-09-3`'e yükseltildi. `tests/webMetinTutarlilik.test.ts` rota varken
> metinlerin susmasını engelliyor.
>
> Ölçülen görünürlük (tahmin değil, koddan): panoda ilan sahibinin **ad soyad
> ve büro adı**; yazışmada ek olarak **baro sicil numarası ve profil
> fotoğrafı**. Telefon, e-posta, kimlik numarası ve dosya kayıtları hiçbir
> durumda görünmüyor.

### 4.4 Reklam kimliği (Advertising ID) izni

`AD_ID` izni **istenmiyor**; Play formunda "reklam kimliği kullanmıyorum"
işaretlenmeli. Yanlış işaretlenirse red gelir.

### 4.5 Hedef kitle

Yetişkin (18+), meslek grubu: avukatlar. Çocuklara yönelik **değil**.

---

## 5. Mağaza vitrini — hazır metinler

**Uygulama adı (30 karakter sınırı):**
```
Vekil Pro — Avukat Asistanı
```

**Kısa açıklama (80 karakter):**
```
Dava, duruşma ve süre takibi; sınırsız ücretsiz içtihat araması.
```

**Tam açıklama (4000 karakter sınırı):**
```
Vekil Pro, avukatın büro işini ve hukuki araştırmasını tek programda
toplar. Dosya takibi yapan bir program ile içtihat veritabanını ayrı ayrı
kullanma zorunluluğunu ortadan kaldırır.

İÇTİHAT ARAMASI — ÜCRETSİZ VE SINIRSIZ
Yargıtay ve Danıştay kararlarına Bedesten üzerinden, istinaf ve yerel
mahkeme kararlarına UYAP Emsal üzerinden canlı erişim. Künye araması
(esas/karar no) dahil. Ücretsiz katmanda da sınırsızdır ve öyle kalacaktır.

BÜRONUN TAMAMI
• Dava, duruşma, görev ve süre takibi; adli tatili ve resmî tatilleri
  uygulayan süre hesaplayıcıları
• Müvekkil kayıtları, belge kasası, vekâletname ve özel yetki takibi
• İcra dosyaları, tahsilat ve ödeme günü takibi
• Büro finansı: gelir-gider, tahsilat ve aylık özet
• Duruşma ve süre hatırlatmaları

YAPAY ZEKÂ — ÜRETİLEN HER KÜNYE DENETLENİR
Dilekçe taslağı, hukuki mütalaa ve belge incelemesi. Ayıran özellik şu:
yapay zekânın verdiği her kanun maddesi ve her karar künyesi mekanik
olarak denetlenir ve size "doğrulandı", "havuzda yok" ya da "olamaz"
diye işaretlenir. Uydurma bir karar numarası dilekçenize sessizce
girmez. Son denetim her hâlükârda avukata aittir.

Üretilen dilekçeyi UYAP Editör biçiminde (.udf) indirebilir, UYAP'tan
indirdiğiniz dosya belgesini yükleyip mahkeme, esas no, taraf ve duruşma
günü okunarak davanızın kaydını kurdurabilirsiniz.

VERİNİZ
Kayıtlarınız Avrupa Birliği (İrlanda) bölgesinde saklanır. Her kayıt
veritabanı düzeyinde yalnız size açıktır. Yapay zekâya yalnız o istekte
sizin yazdığınız metin gider; veritabanınız taranmaz. Yazdıklarınız model
eğitiminde kullanılmaz. Yurt dışına aktarım açık rızanıza bağlıdır ve rıza
hizmetin şartı değildir — vermezseniz programın geri kalanı eksiksiz
çalışır. Ayrıntı: vekilpro.app/guvenlik.html

Vekil Pro bağımsız bir yazılımdır; Adalet Bakanlığı veya UYAP ile resmî
bir bağlantısı yoktur. Uygulamadaki hiçbir çıktı hukuki tavsiye değildir.
```

**Kategori:** İş (Business) · **Etiketler:** hukuk, avukat, dava takibi

**Gizlilik politikası URL'si:** `https://vekilpro.app/privacy.html`
**Hesap silme URL'si:** `https://vekilpro.app/hesap-silme.html`

### Görseller — EKSİK

| Gereken | Boyut | Durum |
|---|---|---|
| Uygulama simgesi | 512×512 PNG | `assets/icon.png`'den üretilebilir |
| Öne çıkan görsel | 1024×500 PNG | **yok** |
| Telefon ekran görüntüsü | en az 2, 16:9 ya da 9:16 | **yok** |

Ekran görüntülerini örnek verili bir hesapla almak gerekiyor: bugünkü
ekranlarda veri boş ve mağaza vitrininde boş ekran, ürünü olduğundan kötü
gösterir. Hazırlamamı isterseniz söyleyin.

---

## 6. Sıra (bugünden itibaren)

1. ~~**Siz:** `EXPO_TOKEN` ekleyin~~ — **zaten vardı**, derleme onunla koştu.
2. **Siz:** Play Console'da uygulamayı oluşturun — paket adı **`com.vekilpro.app`**
3. ~~**Ben:** ilk AAB'yi üretirim~~ — **yapıldı, 13.09.2026 13:57 (koşu #4)**.
   ```
   https://expo.dev/artifacts/eas/eUwBZnQwOAjMRrR04z5FmpWZbbGUqibpZkxnjxrTZkw.aab
   ```
   ⚠️ **Koşu #2'yi YÜKLEMEYİN.** Burada önce koşu #2 yazıyordu; o derlemede
   paket adı hâlâ eski (`com.macroko.legal`) ve renkler eski. Play kaydını
   `com.vekilpro.app` ile açıp oraya #2'yi yüklerseniz paket adı tutmaz.
   Yüklenecek olan yukarıdaki bağlantıdır (commit `bc8f206`).
   Play servis hesabı JSON'u olmadığı için **elle yüklenecek**: Play Console
   → uygulama → Test → Dahili test → Yeni sürüm oluştur → AAB'yi sürükle.
4. **Siz:** dahili testte kendi telefonunuzda açıp bakın. **Buraya kadar
   olan hiçbir şey ölçüm değildir** — gerçek bir Android cihazda uygulamanın
   açıldığı bugüne kadar hiç görülmedi.
5. **İkimiz:** 4.1–4.5'teki formlar
6. **Siz:** 12 test kullanıcısı toplayın (meslektaş, tanıdık — Google gerçek
   Google hesabı istiyor), **kapalı test (alpha)** kanalına alın
7. **14 gün bekleyin** — bu sürede gerçek kullanım verisi ölçülür
8. Üretim erişimine başvurun

---

## 6.1 versionCode nereden geliyor

`app.json`'daki `versionCode: 31` **13.09.2026'da kaldırıldı**. Sebebi
derleme kaydındaki uyarı:

> android.versionCode field in app config is ignored when version source is
> set to remote

Yani o 31 sayısı **hiç kullanılmıyordu**; gerçek sayaç EAS'ta duruyor ve ilk
derlemede 1'den 2'ye çıktı. Dosyada bırakmak, ileride birinin app.json'a
bakıp "31. derlemedeyiz" sanmasına yol açardı — Play ise 2 görecekti.

---

## 7. Bu dosyanın söylemediği şey

Uygulama **hiçbir gerçek Android cihazda çalıştırılmadı**. Bugüne kadar
yapılan bütün ölçümler tarayıcı üzerinden ve kendi kurduğumuz senaryolarla
yapıldı. Bildirimler, takvim izni, biyometrik kilit, Play Billing akışı ve
dosya seçici natif tarafta **hiç denenmedi**. 3. adımdaki dahili test,
bunların ilk gerçek sınavı olacak; oradan hata çıkması beklenen ve normal
bir şeydir.

---

## 8. Paket adı neden değişti, neden yalnız Android'de

**Karar (ürün sahibi, 13.09.2026):** Android paketi `com.macroko.legal` →
**`com.vekilpro.app`**.

**Neden şimdi ve neden acil olarak soruldu.** Play'e ilk yükleme yapıldıktan
sonra paket adı **asla** değiştirilemez; uygulamayı silip yeniden yayımlamak
bile eski kurulumları, yorumları ve sıralamayı kurtarmaz. Yani kararın son
anı yüklemeden önceydi.

**Görünür olduğu tek yer** mağaza bağlantısıdır:
`play.google.com/store/apps/details?id=com.vekilpro.app`

**iOS neden değişmedi.** Apple, bir uygulama kaydı oluşturulduktan sonra
bundle ID'yi değiştirmeye izin vermiyor; `eas.json`'da o kayda ait bir
`ascAppId` (6789656277) duruyor, yani kayıt var görünüyor.

> **KONTROL EDİN — bir dakikalık iş.** App Store Connect'i açıp
> `com.macroko.legal` ile bir uygulama kaydı GERÇEKTEN var mı bakın.
> **Yoksa** bana söyleyin: iOS bundle'ı da `com.vekilpro.app` yaparım ve iki
> platform aynı kalır. Hiçbir şey gönderilmemişken bu tek satırlık bir
> değişiklik; kayıt oluştuktan sonra imkânsız.

**Bunun bedeli (ödendi):** 12:04'te üretilen AAB `com.macroko.legal` ile
imzalıydı, **kullanılamaz**. Yeni paket için EAS yeni bir imzalama anahtarı
üretecek ve derleme baştan koşacak (~25 dk).

**RevenueCat tarafı:** Android uygulaması yeni paket adıyla tanımlanmalı
(`IAP_KURULUM.md` adım 2). iOS tarafı eski bundle ile kalıyor; RevenueCat
zaten platform başına ayrı uygulama tuttuğu için bu çalışır, ama iki ayrı
kimlik olduğunu bilerek kurun.
