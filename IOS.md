# App Store'a Çıkış — Sıra ve Denetim

> **15.09.2026.** Apple Developer Program üyeliği bu gün açıldı. Bu dosya
> `PLAY.md`'nin iOS eşi: neyin hazır olduğu **ölçülerek** yazıldı, neyin
> hazır olmadığı da açıkça yazıldı.
>
> **iOS'a hiç derleme yapılmadı.** Aşağıdaki "temiz" işaretleri kodun
> denetiminden geliyor, başarılı bir derlemeden ya da Apple incelemesinden
> **değil**. İlk derleme ve ilk inceleme hâlâ ölçülmemiş iki adım.

---

## 1. Ölçülen durum — Apple'ın en sık reddettiği noktalar

Aşağıdaki her satır 15.09.2026'da depodan **arandı**, hatırlanmadı.

| Risk | Durum | Dayanak |
|---|---|---|
| **Uygulama dışı ödeme** (en sert reddi) | **YOK** | `payment-sheet` uç işlevi istemciden hiç çağrılmıyor; premium ekranı native'de yalnız RevenueCat kullanıyor |
| **Web'e "orada satın al" bağlantısı** | **YOK** | Web premium ekranı satış yapmıyor, "mağazalarda yayına girince alınabilir" diyor (`premium.webBody`) |
| **Apple ile Giriş zorunluluğu** | **DOĞMUYOR** | Hiçbir üçüncü taraf girişi yok (Google/Facebook/Apple OAuth araması boş döndü). Kural yalnız başka sosyal giriş varsa devreye girer |
| **Hesap silme** (Apple zorunlu tutuyor) | **VAR** | `app/hesap-sil.tsx` → `delete_account` RPC'si; ayrıca web'de `docs/hesap-silme.html` |
| **İzin açıklama metinleri** | **5/5 VAR** | FaceID, Fotoğraf, Kamera, Takvim (oku), Takvim (yaz) — hepsi Türkçe ve ne için kullanıldığını söylüyor |
| **Şifreleme beyanı** | **VAR** | `ITSAppUsesNonExemptEncryption: false` |
| **Gizlilik ve koşullar sayfaları** | **YAYINDA** | `docs/privacy.html`, `docs/terms.html` |

**Yani kod tarafında bilinen bir engel yok.** Bu, "kabul edilecek" demek
değil; "bilinen tuzaklara düşmüyoruz" demek.

---

## 2. Yapılması gereken — sırayla

### a) App Store Connect anahtarını secret'a koy · **SEN**

App Store Connect → Users and Access → Integrations → App Store Connect API
→ yeni anahtar (rol: **App Manager**) → `.p8` dosyasını indir.

GitHub → Settings → Secrets and variables → Actions → New repository secret

```
Ad     : ASC_API_KEY_P8
Değer  : indirdiğin .p8 dosyasının TAMAMI (BEGIN/END satırları dâhil)
```

- **`.p8` bir kez indirilir.** Apple ikinci kez vermez; kaybedersen anahtarı
  iptal edip yenisini üretmen gerekir.
- **Bana yapıştırma.** Yayımlama yetkisi taşıyor; secret dışında hiçbir yere
  yazılmamalı.
- Anahtarın kimlik bilgileri (key id `RV7JV3VRZB`, issuer id, team id
  `27V4XBQFG4`, app id `6789656277`) gizli **değil** ve zaten `eas.json`'da
  duruyor. Gizli olan yalnız `.p8`'in kendisi.

`EXPO_TOKEN` zaten Android iş akışı için gerekiyordu; ikinci bir tane gerekmez.

### b) İmzalama kimliklerini BİR KEZ oluştur · **SEN** (etkileşimli)

```
npx eas-cli credentials --platform ios
```

**Bu adım atlanamaz ve CI yapamaz.** iOS dağıtım sertifikası ve provisioning
profile ilk kez üretilirken Apple hesabına giriş ister; GitHub Actions
etkileşim yapamaz. Bir kez kurulduktan sonra EAS saklar ve iş akışı
`--non-interactive` koşar.

Atlanırsa ilk koşu kimlik hatasıyla düşer — bu bir arıza değil, sıranın
gereği.

### c) Derle · **BEN ya da SEN**

GitHub → Actions → **iOS Derle ve Gönder** → Run workflow
- `is: derle`, `profil: production`

İlk koşuda tökezlerse hata mesajını `.github/workflows/ios-dagit.yml`
başına yorum olarak ekle. Android dosyasındaki "ilk koşuda unutulmuştu"
notları tam olarak böyle birikti ve aynı hatanın ikinci kez yaşanmasını
engelledi.

### d) TestFlight'a gönder

- `is: derle-ve-gonder` (ya da derleme zaten varsa `gonder`)
- Apple'ın işlemesi **10–60 dakika** sürebilir; bitmeden TestFlight'ta
  görünmez.
- Kendi cihazın dışındaki test kullanıcıları için **Beta App Review**
  gerekiyor (ayrı ve daha kısa bir inceleme).

### e) App Store Connect'te doldurulacaklar · **SEN**

Kodda olmayan, yalnız panelde doldurulan alanlar:

- Gizlilik politikası adresi: `https://vekilpro.app/privacy.html`
- **App Privacy** ("Nutrition Label") — hangi veriyi topladığın. Bu ürün
  müvekkil verisi tutuyor; eksik ya da yanlış beyan, yayından sonra da
  ceza sebebi. `docs/privacy.html` ile birebir tutarlı olmalı.
- Yaş sınırı, kategori (Business ya da Productivity), destek adresi
- **Abonelik ürünleri**: RevenueCat tarafındaki iki ürün (`premium`, `ai`)
  App Store Connect'te de tanımlı ve **"Ready to Submit"** olmalı. Ürünler
  onaylanmadan abonelikli bir sürüm incelemeye alınmaz.
  Fiyat ve haklar için tek kaynak: `IAP_KURULUM.md`.

---

## 2.5 ÖN UÇUŞ KONTROLÜ — ÇÖZÜLDÜ (15.09.2026)

`npx expo-doctor` önce **18/21** geçiyordu, üç denetim düşüyordu. Üçü de
kapatıldı: **şimdi 21/21 geçiyor, sıfır sorun.**

Bunlar EAS kuyruğuna girmeden bulundu — girseydik 30 dakika bekleyip hata
alacaktık. Aşağıdaki kayıt, aynı sorunlar geri dönerse tanınsın diye duruyor.

### a) `app.json` şema hatası — `android.queries` geçersiz alandı · **ÇÖZÜLDÜ**

```
Field: android - should NOT have additional property 'queries'
```

Expo yapılandırma şemasında `android.queries` diye bir alan yok. Blok,
"ileride `canOpenURL` kullanan biri tuzağa düşmesin" diye savunma amaçlı
eklenmişti — ama **koruma sağlamıyordu, yalnız yapılandırmayı geçersiz
kılıyordu.**

Kaldırmadan önce ölçüldü: `canOpenURL` kodun **hiçbir yerinde
kullanılmıyor** (yalnız kaldırıldığını anlatan yorumlarda geçiyor). Her
çağrı `Linking.openURL` ve o, `<queries>` gerektirmiyor. Yani kaldırmanın
davranışa etkisi **sıfır**.

iOS karşılığı `ios.infoPlist.LSApplicationQueriesSchemes` **geçerli bir
alan** ve olduğu gibi duruyor.

İleride Android'de `canOpenURL` gerekirse: manifest'e `<queries>` eklemek
bir **config plugin** işidir (`withAndroidManifest`), app.json alanı değil.
Not `src/utils/reminder.ts` içine yazıldı.

### b) Hermes bellek regresyonu — iOS için asıl riskti · **ÇÖZÜLDÜ**

```
ÖNCE : expo@57.0.1 → Hermes V1 250829098.0.14  (ETKİLENEN)
SONRA: expo@57.0.22                            (düzeltme .0.16'da geldi)
```

Expo'nun kendi duyurusunda geçen bilinen bir bellek regresyonu. Bellek
sorunu iOS'ta Android'den sert sonuçlanır: sistem uygulamayı öldürür,
kullanıcı "kapanıyor" der. Apple incelemesinde çökme = doğrudan ret.

### c) 26 paket geride · **ÇÖZÜLDÜ**

`npx expo install --fix` ile SDK'nın beklediği sürümlere çekildi:

| paket | önce | sonra |
|---|---|---|
| expo | 57.0.1 | **57.0.22** |
| react-native | 0.86.0 | 0.86.3 |
| react-native-screens | 4.25.2 | 4.26.0 |
| expo-router | 57.0.2 | 57.0.21 |
| expo-updates | 57.0.6 | 57.0.22 |
| react-native-reanimated | 4.5.0 | 4.5.1 |
| react-native-worklets | 0.10.0 | 0.10.1 |

### Yükseltme sonrası doğrulama — ÖLÇÜLDÜ

- `npx expo-doctor` → **21/21 geçti**
- `npx tsc --noEmit` → temiz
- `npm test` → **71 dosya / 815 test geçti**
- `npm run export:web` → derlendi
- Pano ve dava listesi **render edilip gözle bakıldı**, bozulma yok

**SIRA BİLEREK BÖYLEYDİ.** Sürüm yükseltmesi Android'i de etkiliyor ve
Android test aşamasında. Yükseltmeyi iOS çıktıktan SONRA yapmak iki mağazayı
birden riske atardı; ilk iOS derlemesinden ÖNCE yapıldı.

**DİKKAT — natif derleme henüz yapılmadı.** Yukarıdaki doğrulamaların hepsi
web/JS tarafı. Yükseltme natif bağımlılıkları da değiştirdi
(react-native 0.86.0 → 0.86.3, reanimated, worklets); bunların derlenip
telefonda çalıştığı **ölçülmedi**. İlk Android derlemesi de bu yüzden
yeniden yapılmalı.

---

## 3. Ölçülmemiş riskler — dürüstlük payı

Bunlar "sorun var" demek değil; **bakılmadı** demek.

- **iPad.** `supportsTablet: true` olduğu için Apple incelemeyi iPad'de de
  yapar. Ama `genisEkranMi` yalnız web'de çok sütuna geçiyor; native iPad
  telefon düzenini büyütülmüş hâlde görecek. Bozuk değil, ama iPad'e göre
  tasarlanmış da değil — ve **hiç iPad'de açılmadı**.
  Karar senin: `supportsTablet: false` yaparsak iPad incelemesi tümden
  kalkar, karşılığında iPad kullanan avukatlar App Store'da uygulamayı
  bulamaz.
- **İlk derleme hiç koşmadı.** `ios-dagit.yml` Android'in çalıştığı
  doğrulanmış kalıbından türetildi ama iOS tarafı doğrulanmadı.
- **Apple incelemesi.** Yukarıdaki denetim bilinen tuzakları kapsıyor;
  inceleme yine de başka bir sebeple takılabilir.
- **`premium.webBody` metni eskiyecek.** Şu an "mağazalarda yayına girdiğinde
  satın alınabilir olacak" diyor. iOS yayına girdiği gün bu cümle yanlış
  olur ve güncellenmeli.

---

## 4. Play'den farkı — karıştırma

| | Play | App Store |
|---|---|---|
| Çıktı | AAB | IPA |
| Test kanalı | internal / alpha / beta | TestFlight |
| İmzalama | EAS kendi üretir, etkileşim yok | **Bir kez etkileşimli kurulum şart** |
| Gönderim anahtarı | servis hesabı JSON | App Store Connect `.p8` |
| İnceleme | kapalı testte yok | TestFlight dış test dâhil **var** |

Play çıkış sırası ayrı dosyada: **`PLAY.md`**.
