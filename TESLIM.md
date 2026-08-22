# Vekil Pro — iOS Yayın / Arkadaşa Devir Rehberi

Bu doküman, uygulamayı **App Store'a arkadaşının Apple hesabından** yayınlamak
için gereken her şeyi adım adım anlatır. Teknik olmayan biri de takip edebilsin
diye sade yazıldı.

---

## 0) Mevcut durum (şu an ne var)

| Şey | Değer | Not |
|---|---|---|
| Uygulama adı | **Vekil Pro** | `app.json` |
| Sürüm | **3.3.2** | OTA güncellemeler bu sürüme gider |
| Expo/EAS hesabı | **olivyeejiru** | Build'leri bu hesap yönetiyor |
| EAS Project ID | `7645a179-55d0-45a2-a1f7-1208d82140c8` | Sabit, değişmez |
| iOS Bundle ID | **com.macroko.legal** | Şu an Apple Ekibi `27V4XBQFG4`'e kayıtlı |
| App Store uygulaması | `6789656277` | Zaten oluşturulmuş (Ekip `27V4XBQFG4`) |
| Backend (Supabase) | Kuruldu, çalışıyor | Yayından bağımsız, hazır |
| Yapay zeka | Çalışıyor (Groq / gpt-oss-120b) | Anahtar müşteride sorulmuyor |

> **Önemli:** Backend, yapay zeka, yedekleme — hepsi hazır ve yayından bağımsız.
> Eksik olan tek şey: uygulamayı App Store'a **arkadaşının hesabından** koymak.

---

## 1) ÖNCE KARAR: Hangi yol?

`com.macroko.legal` bundle ID'si şu an **`27V4XBQFG4`** numaralı Apple ekibine
kayıtlı. Arkadaşının hesabından yayınlamak için iki yoldan **biri** seçilir:

### Yol A — Arkadaşın kendi hesabından, YENİ bundle ID (en kolay, önerilen)
Arkadaşın kendi Apple Developer hesabını açar; uygulamaya **yeni bir bundle ID**
veririz (örn. `com.<arkadasadi>.vekilpro`). Eski ekiple hiç uğraşmayız.
- ✅ En temiz yol, kimseden izin/aktarım beklemez.
- ⚠️ App Store'da "yeni uygulama" olur (indirme sayısı sıfırdan başlar — zaten
  henüz yayında değil, kaybedecek bir şey yok).

### Yol B — Uygulamayı arkadaşın hesabına TRANSFER et
`27V4XBQFG4` **senin/bizim** ekibimizse, App Store Connect'ten uygulamayı
arkadaşının hesabına transfer edebiliriz (bundle ID aynı kalır).
- ✅ Bundle ID ve uygulama kaydı korunur.
- ⚠️ Her iki tarafın da geçerli sözleşmeleri olmalı, transfer birkaç gün sürebilir.
- ⚠️ `27V4XBQFG4` arkadaşının ekibiyse zaten transfer gerekmez — sadece bilgileri
  ver, yayınlarız.

**Bilmem gereken:** `27V4XBQFG4` numaralı ekip **kimin**? (Senin mi, benim
kurduğum bir test mi, yoksa zaten arkadaşının mı?) Buna göre A veya B'yi seçeriz.
Emin değilsen **Yol A** ile gitmek en risksizidir.

---

## 2) Arkadaşının yapması gerekenler (hesap tarafı)

1. **Apple Developer Program üyeliği** (yıllık **99 USD**).
   - https://developer.apple.com/programs/enroll/
   - Bireysel veya şirket olarak açabilir. Onay 24–48 saat sürebilir.
   - > Bu ücret Apple'a gider; bizim uygulamayla ilgisi yok, App Store'da yayın
     > yapan herkes öder. Kaçışı yok.

2. Üyelik onaylandıktan sonra **App Store Connect**'e girsin:
   https://appstoreconnect.apple.com

---

## 3) Arkadaşından bana/sana lazım olan 4 bilgi

Yayını yapabilmem için arkadaşının hesabından şu 4 şeyi toplaman yeterli.
(Şifre İSTEMİYORUM — sadece bu teknik bilgiler.)

1. **Apple Team ID** — App Store Connect → Membership → "Team ID" (10 haneli,
   örn. `AB12CD34EF`).

2. **App Store Connect API Key** (yükleme için, en güvenli yöntem):
   - App Store Connect → **Users and Access** → **Integrations / Keys** sekmesi
   - "App Store Connect API" altında **+** ile yeni anahtar oluştur, rol:
     **App Manager** (veya Admin).
   - İnen **`.p8` dosyasını** bana ver (bir kez in
     dirilir, saklaması önemli).
   - Aynı ekranda görünen **Key ID** ve **Issuer ID**'yi de not al.

3. **Uygulama kaydı**: App Store Connect → Apps → **+** → New App
   - Platform: iOS
   - İsim: **Vekil Pro** (App Store'da bu isim benzersiz olmalı; doluysa
     "Vekil Pro - Avukat" gibi bir varyant deneriz)
   - Bundle ID: Yol A'da yeni oluşturduğumuz ID
   - Oluşunca sana bir **App ID (ascAppId)** verir (10 haneli sayı) → bunu da al.

4. **(Yol A ise) İstediğin bundle ID** — örn. `com.<arkadasadi>.vekilpro`.

> Bu dördünü toplayıp bana verdiğinde, `eas.json`'daki yayın ayarlarını
> güncelleyip App Store'a yüklerim.

---

## 4) Ben (Claude) neyi ayarlayacağım — sen bilgileri verince

1. `app.json` → iOS `bundleIdentifier` (Yol A'da yeni ID).
2. `eas.json` → `submit.production.ios` altındaki `appleTeamId`, `ascAppId`,
   `ascApiKeyId`, `ascApiKeyIssuerId` alanlarını arkadaşının değerleriyle
   değiştiririm; `.p8` dosyasını `asc-api-key.p8` olarak koyarım.
3. iOS için imza sertifikası + provisioning profilini EAS ile üretiriz.

---

## 5) Yayın komutları (bilgiler girildikten sonra)

Bilgisayarında (Expo hesabına `olivyeejiru` ile giriş yapılmış olmalı):

```bash
# 1) Bağımlılıklar
npm install

# 2) iOS üretim derlemesi (bulutta, EAS sunucusunda derlenir)
npx eas build --platform ios --profile production

# 3) App Store'a yükle
npx eas submit --platform ios --profile production --latest
```

- İlk `build` sırasında EAS, imza sertifikası/profil sorabilir → "let EAS handle
  it" (EAS yönetsin) seç.
- `submit` bitince uygulama App Store Connect'te **"Ready to Submit"** olur.

---

## 6) App Store Connect'te son adımlar (arkadaş veya sen)

Uygulama yüklendikten sonra App Store Connect'te doldurulması gerekenler:

- [ ] **Ekran görüntüleri** (6.7" ve 6.5" iPhone için — birkaç ekran fotoğrafı).
- [ ] **Açıklama** metni (uygulama ne yapıyor — Türkçe).
- [ ] **Anahtar kelimeler**, kategori (**Business** veya **Productivity**).
- [ ] **Gizlilik Politikası URL'si** — uygulamada `app/privacy.tsx` var; bir web
      sayfası olarak da yayınlamamız gerekebilir (yardımcı olurum).
- [ ] **App Privacy** anketi: hangi veriler toplanıyor (e-posta, isim vb.).
- [ ] **Yaş sınırı** ve **fiyat** (ücretsiz — uygulama içi satın alma sonra).
- [ ] **"Submit for Review"** → Apple incelemesi (genelde 24–48 saat).

---

## 7) Sık sorulanlar

**S: OTA güncellemeler ne olacak?**
Yayından sonra, kod değişikliklerini `npx eas update --branch production` ile
anında gönderebiliriz — App Store incelemesi beklemeden. (Sadece görsel/mantık
değişiklikleri; native/sürüm değişikliği yeni build ister.)

**S: Sürüm 3.3.2'yi değiştirecek miyiz?**
İlk App Store yüklemesi için 3.3.2 kalabilir. OTA güncellemeler bu sürüme gider;
sürümü yükseltirsek eski OTA'lar kesilir, o yüzden gerekmedikçe dokunmayız.

**S: Ödeme (500/1500/2500 TL) ne olacak?**
Şu an ekranda "yakında" görünüyor, sahte tahsilat yok. Apple, uygulama içi
dijital satışları **App Store içi satın alma (IAP)** ile ister; bunu yayından
sonra ayrı kurarız (Apple %15–30 komisyon alır). İlk yayında ücretsiz çıkmak
en hızlısı.

**S: Android?**
Ayrı süreç (Google Play, tek seferlik 25 USD). Hazır olduğunda onu da yazarım.

---

## Özet — sıradaki 3 adım (sen)

1. `27V4XBQFG4` ekibi kimin, öğren → **Yol A mı B mi** karar ver (emin değilsen A).
2. Arkadaşın **Apple Developer üyeliğini** açsın (99 USD).
3. Bölüm 3'teki **4 bilgiyi** topla, bana ver → gerisini ben ayarlayıp yüklerim.
