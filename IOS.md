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
