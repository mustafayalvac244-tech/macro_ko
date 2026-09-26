# Yayın planı — seçilmek için

> **23.09.2026.** Ürün sahibi: *"Programı artık salıcaz, zeki hamleler
> yapalım, çıktığımızda o kadar rakip arasından seçilmemizi sağlayacak
> planlar yap."*
>
> **Kanıtın kaynağı — karıştırılmadı:**
> - **ÖLÇÜLDÜ** = bugün kodda / canlı sistemde / App Store Connect'te bakıldı.
> - **PAZAR.md** = 17.09.2026 iTunes API + yorum ölçümü. Yalnız iOS; Google
>   Play hiç ölçülmedi. Rakip ürünler **kullanılmadı**.
> - Kendi tahminim olan her yer **"ölçülmedi"** diye işaretli.
>
> Hiçbir maddeye "şu kadar kullanıcı getirir" demiyorum. Ölçülmedi.

---

## 0. Bugün neredeyiz — ÖLÇÜLDÜ

| Konu | Durum |
|---|---|
| iOS sürüm 3.4.0 | `REJECTED` (20.09, Guideline 2.1 — bilgi istendi, içerik reddi değil) |
| Vitrin | eksiksiz: derleme 3, açıklama, 12 ekran görüntüsü, kategori, gizlilik |
| Demo hesap | 23.09'da forma yazıldı (`demoAccountRequired=true`, kullanıcı var) |
| Abonelik "Vekil Pro Premium" | `READY_TO_SUBMIT`, 399,99 ₺, TUR — uygulamayla birlikte gidecek |
| Abonelik "AI" | **ölçülmedi** — kayıt penceresinde kesildi |
| Giriş 504 hatası | kodda düzeltildi (`3a03fa4`), **derleme 3'te YOK** |
| Veritabanı yükü | vektörleme kapalı; hasat açık (ürün sahibi kararı) |
| KVKK veri sorumlusu | **BOŞ** — `unvan`, `adres`, `eposta` hepsi `null` |
| Deneme süresi | **yok** — aboneliklerde tanıtım teklifi tanımlı değil |
| Mağaza metninde "reklamsız" | **geçmiyor** |
| Yeni karar bildirimi | **yazılmamış** — kodda iz yok |

---

## 1. Yayından ÖNCE — bunlar olmadan çıkma

### 1.1 KVKK veri sorumlusu kimliği — **SENDEN**
`src/config/kvkk.ts` → `VERI_SORUMLUSU`. Gereken: **unvan** (şirket adı ya
da şahıs şirketiyse ad-soyad), **adres**, **e-posta**. Varsa KEP, MERSİS.

Neden en üstte: müşterimiz **avukat**. Aydınlatma metninde veri
sorumlusunun kim olduğu yazmıyorsa, ilk açan avukat bunu görür — ve bir
hukuk ürününün kendi KVKK metnini eksik bırakması, satışın başladığı yerde
güveni bitirir. Bunu ben dolduramam; uydurmam gerekir.

### 1.2 Derleme 4 mü, derleme 3 mü — **SENİN KARARIN**

Derleme 3'te giriş hatası duruyor: sunucu yavaşlarsa ekrana ham JSON ve
sunucu adresi basıyor. Apple incelemecisi bunu görürse **ikinci red** gelir.

| Seçenek | Kazanç | Risk |
|---|---|---|
| **A. Derleme 4 çıkar, sonra gönder** (önerim) | incelemeci düzgün hata + otomatik tekrar deneme görür | ~35 dk derleme (rn-ui-kit skill'indeki değer, bugün ölçülmedi); TestFlight'ta otomatik güncelleme açıksa **senin telefonun da güncellenir** |
| B. Derleme 3 ile hemen gönder | bugün sıraya girer | inceleme sırasında sunucu yavaşlarsa red |

B'yi seçersen: **inceleme süresince hasatı durdur.** 22.09'da 7 giriş
denemesinin 6'sı 504'tü ve o saatlerde hasat açıktı.

### 1.3 "Submit to App Review" — **SENDEN, 30 saniye**
API'den dört kapı da kapalı (bkz. `scripts/asc-form.mjs`, başındaki not).
App Store Connect → Vekil Pro → 3.4.0 → **Add for Review** → **Submit**.
Abonelikler de bununla birlikte gider.

---

## 2. Seçilmek için — sıralı

Sıralama ölçütü: **pazarda ölçülmüş bir acı** + **bizde altyapısı var mı**.

### 2.1 Kapı cümlesini değiştir: yapay zekâ değil, "reklamsız + ücretsiz takvim"

**Kaynak: PAZAR.md §3.1, §6.** Yorumlarda en sert cezalandırılan şey
**reklam** — avukat duruşma salonunda telefonu açıyor. İnsanları içeri sokan
şey "AI" değil, **zaman ve mobil erişim**. Bizde reklam yok ve duruşma/süre
ücretsiz katmanda **sınırsız** (`src/config/planlar.ts`, ÖLÇÜLDÜ).

Ama bu fark mağaza metninde **tek kelimeyle geçmiyor** (ÖLÇÜLDÜ).

**Yapılacak:** tanıtım metni →
*"Duruşmanı ve süreni ücretsiz takip et. Reklam yok. Yapay zekâ isteyene."*
Tanıtım metni App Store'da **inceleme gerektirmeden** her an değişir;
yayından sonra da yapılabilir.

### 2.2 Yeni Yargıtay kararı bildirimi — kimsede yok

**Kaynak: PAZAR.md §4.** Bir rakibin yorumlarında açıkça isteniyor:
*"Güncel Yargıtay içtihadı eklendiğinde bildirim alma özelliğini heyecanla
bekliyoruz."* Ölçülen 28 uygulamanın hiçbirinde yok.

Bizde hasat zaten her gün yeni karar ekliyor, bildirim altyapısı var.
Eksik olan: avukatın **konu/daire seçip abone olması** + eşleşen yeni
karar gelince bildirim. **YAZILMADI** (ÖLÇÜLDÜ). Süre tahmini vermiyorum.

Neden en güçlü hamle: diğer özellikler "bizde de var" der; bu **"yalnız
bizde var"** der. Baro duyurusunun başlığı olur.

### 2.3 Bir ay ücretsiz deneme

**Kaynak: PAZAR.md §3.3.** Yorumlarda fiyat şikâyeti ve deneme yokluğu
birlikte geçiyor. Bizde aboneliklerde tanıtım teklifi **yok** (ÖLÇÜLDÜ).

Apple'da aboneliğe "introductory offer" eklenir; uygulama güncellemesi
gerektirmez. Kararı senin — fiyat politikası.

### 2.4 Kanal: mağaza değil, barolar

**Kaynak: PAZAR.md §1, §6.** 28 uygulamanın **toplam** oyu 2.355. Hiçbiri
mağazadan kullanıcı bulamamış. Kanal: **barolar** (üye listesi ve bülteni
var) ve avukat WhatsApp/Telegram grupları.

**Yapılacak:** bir baroya (tanıdığın olan) ücretsiz tanıtım + üyelerine
deneme kodu. Tek baroda ölç, sonra büyüt. İlk baro seçimi senin — kimi
tanıdığını ben bilmiyorum.

### 2.5 "Kaynağını gösteren yapay zekâ"yı öne çıkar

**Kaynak: RAKIP-OZELLIK-ANALIZI.md §B.** Uluslararası pazarda CoCounsel'in
ana satış cümlesi: yanıtlar doğrulanmış veritabanına karşı **atıf denetimli**.
Bizde bu var: verilen her karar künyesi ve kanun maddesi "doğrulandı /
havuzda bulunamadı / olamaz" diye işaretleniyor (mağaza metninde de yazıyor).

Avukatın yapay zekâdan en büyük korkusu **uydurma karar** — ABD'de
uydurma atıf yüzünden yaptırım alan avukat haberleri yaygın. Bu korkuya
doğrudan cevap veren tek yerli ürün olabiliriz. **"Olabiliriz" — rakiplerin
çıktısı denenmedi (PAZAR.md §8), bu yüzden "tek" diyemiyorum.**

### 2.6 Android

**Kaynak: PAZAR.md sınırlar bölümü:** Türkiye'de Android payı ~%75-80 —
**bu rakam kaynaksız yazılmış, ölçülmedi.** Ama kesin olan: Play'de henüz
yokuz ve ölçtüğümüz her şey iOS'un yalnız bir parçası.

Bilinen eksikler (önceki oturumdan): kapalı test için test kullanıcısı
e-postaları, "App access" için demo hesap, RevenueCat anahtarlı yeni
Android derlemesi.

---

## 3. Riskler — bunları bilerek çıkıyoruz

| Risk | Kaynak | Ne yapıyoruz |
|---|---|---|
| Sunucu yavaşlığında giriş 504 | ÖLÇÜLDÜ 22.09: 7 denemenin 6'sı | kodda otomatik tekrar deneme + düzgün mesaj (derleme 4'le gider) |
| Hasat ile kullanıcı sorgularının yarışı | ÖLÇÜLDÜ 23.09: vektörleme kapalıyken bile `clients`, `cases`, `profiles` sorguları zaman aşımına düştü | hasat açık — ürün sahibi kararı. İlk kullanıcı dalgasında (baro duyurusu günü) hasatı durdurmak önerilir |
| Yayın öncesi çökmeler kaydedilemiyor | `istemci_hata` tablosu giriş öncesi yazılamıyor | ürün sahibi kararı bekliyor |
| Yeni karar vektörlenmiyor | vektörleme 23.09'da kapatıldı | anlamsal aramada yeni kararlar görünmez; tam metin aramada görünür |

---

## 4. Yayından sonra ne ölçülecek

Şimdiye kadarki arama ölçümleri (İÇTİHAT %96, MEVZUAT %70,6) **benim
yazdığım soru setiyle** yapıldı. Bağımsız değil. Yayından sonra ilk kez
**gerçek kullanıcı verisi** gelir — hiyerarşide en üstte olan bu:

1. Kayıt → ilk dava ekleme oranı (ücretsiz katman işe yarıyor mu)
2. Ücretsiz → ücretli geçiş (5 dava sınırı doğru yerde mi)
3. Arama sonrası "sonuç yok" oranı
4. Giriş hatası sayısı (504 düzeltmesi çalıştı mı)

Bu dördü ölçülmeden fiyat, sınır ya da özellik sırası değiştirilmez.
