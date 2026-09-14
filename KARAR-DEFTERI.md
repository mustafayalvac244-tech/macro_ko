# Karar Defteri — sohbet kaybolursa buradan devam edilir

**Bu dosyanın varlık sebebi.** Ürün sahibi 13.09.2026'da "bu sohbet asla
silinmesin" dedi. Sohbetin kendisi korunamaz — o, Claude hesabında duruyor ve
depodan erişilemiyor. Doğru çözüm sohbeti kilitlemek değil, **sohbete bağımlı
olmamak**: burada yalnız konuşmada geçen, başka hiçbir dosyada yazmayan
kararlar ve açık işler var.

Kural: bir karar burada yazılıysa **tekrar tartışılmaz**, uygulanır. Değişmesi
gerekiyorsa satır güncellenir ve tarihi değişir.

---

## 1. Alınmış kararlar — tartışma kapandı

| Tarih | Karar | Kim |
|---|---|---|
| 13.09.2026 | **3 AI deneme hakkı ₺399'luk pakete ait.** Ücretsiz katmanda AI yok. | Ürün sahibi |
| 13.09.2026 | **Android paket adı `com.vekilpro.app`.** İlk Play yüklemesinden sonra DEĞİŞTİRİLEMEZ. iOS'ta `com.macroko.legal` duruyor (App Store kaydı zaten var). | Ürün sahibi |
| 13.09.2026 | **Play hesabı kişisel (bireysel).** Bu yüzden 12 test kullanıcısı × 14 gün kapalı test zorunlu — bkz. PLAY.md. | Ürün sahibi |
| 13.09.2026 | **İki abonelik birden**: ₺399 ve ₺2.999. | Ürün sahibi |
| 13.09.2026 | **Vurgu rengi altın (`#E3C275`)**, açık mavi kaldırıldı. Hem uygulamada hem tanıtım sitesinde. | Ürün sahibi |
| 13.09.2026 | **Eczane (İlaçPro) tablolarının disk maliyeti konusu kapandı.** "Daha fazla yer kaplamıcak, kaplarsa genişletirim." Bir daha maliyet gerekçesiyle gündeme getirilmez. KVKK ayrım kuralı AYRI ve geçerli (bkz. AGENTS.md). | Ürün sahibi |
| önceki | **Disk freni 30 GB.** "Ek ücret öderim." Supabase Pro'da 8 GB dahil, üstü $0,125/GB/ay → 30 GB'da ayda +$2,75. | Ürün sahibi |
| önceki | **PR'ları Claude kendi merge eder.** "sen et merge her zaman" | Ürün sahibi |
| 14.09.2026 | **Tevkil panosu, sohbet ve günün sorusu yayından ÇIKARILDI.** Silinmediler; `src/ekranlar-beklemede/` altında duruyorlar (1.928 satır). Sebep: menüde yoktular ama derin bağlantıyla açılabiliyorlardı, bu da Play içerik anketini ve KVKK metinlerini yanlış duruma düşürüyordu. **Geri açma sırası: önce KVKK/gizlilik metinleri, sonra ekranlar, sonra PLAY.md 4.3.** | Ürün sahibi onayı ile |

## 2. Değişmez güvenlik kuralları

Bunlar istekle bile gevşetilmez; daha önce teklif edildi ve reddedildi.

- **`service_role` / `sb_secret_...` anahtarı hiçbir koşulda alınmaz, istenmez,
  yazılmaz.** RLS'i baypas eder; sızarsa tüm avukat verisi gider.
- **Hesap şifresi, panel erişimi kabul edilmez.** Teklif edildi, reddedildi.
- **`EXPO_TOKEN`, `GOOGLE_PLAY_SERVICE_ACCOUNT`, `RESEND_API_KEY`** yalnız
  GitHub Secrets'a, ürün sahibi tarafından eklenir. Sohbete, ekran görüntüsüne,
  depoya asla yazılmaz.
- App Store Connect `.p8` anahtarı ve RevenueCat webhook sırrı paylaşılmaz.
  Yalnız public `appl_`/`goog_` anahtarları güvenli. Supabase anon anahtarı
  tasarımı gereği açıktır.
- **Bu sohbette hiçbir sır yok** — hepsi reddedildiği için. Yani sohbetin
  silinmesi bir güvenlik kaybı değil, yalnız hafıza kaybı olurdu. Bu dosya o
  boşluğu kapatıyor.

## 3. Ürün sahibinin yapacakları — sırayla

Bunları Claude yapamaz; panel erişimi gerektiriyor.

- [ ] **`VEKILPRO` adlı GitHub secret'ını sil ve o Expo token'ını iptal et.**
      (Ekran görüntüsünde açığa çıkmıştı; iptal edilmediyse hâlâ geçerli.)
- [ ] **Göçleri canlı Supabase'de çalıştır:** `0131_zaman_kaydi.sql` (çalışma
      kaydı; koşmazsa sekme sessizce boş görünür) ve
      `0132_eksik_indeksler_onarim.sql` (0091'in yarım kalan indeksleri).
- [ ] App Store Connect'te `com.macroko.legal` kaydı gerçekten var mı bak.
      Yoksa iOS de `com.vekilpro.app`'e hizalanabilir.
- [ ] Play Console'da uygulamayı `com.vekilpro.app` paketiyle oluştur.
- [ ] AAB'yi iç teste yükle, gerçek telefona kur. **Uygulama bugüne kadar
      gerçek bir Android cihazda HİÇ çalıştırılmadı.**
- [ ] Play formlarını doldur (metinler hazır: PLAY.md bölüm 4-5).
- [ ] İki abonelik ürününü tanımla (PLAY.md bölüm 3).
- [ ] 12 test kullanıcısı bul, 14 gün kapalı test.
- [ ] Ticari unvan belli olunca `src/config/kvkk.ts` → `VERI_SORUMLUSU` doldur;
      aynı bilgi privacy.html ve hesap-silme.html'e de yazılacak.
- [ ] Depo adını `macro_ko` → `vekilpro` değiştir. Sonrasında
      `github.io/macro_ko` geçen 4 dosya güncellenmeli.

## 4. Son yapılan derleme

| Alan | Değer |
|---|---|
| AAB | Koşu #5 — 14.09.2026, commit `4a6f660`. Bağlantı Actions kaydında. |
| Önceki AAB | `eUwBZnQwOAjMRrR04z5FmpWZbbGUqibpZkxnjxrTZkw.aab` (`bc8f206`) — **ARTIK KULLANMAYIN**, zaman kaydını, makbuzu, gecikme düzeltmesini ve ekran temizliğini içermiyor |
| İçerik | `com.vekilpro.app` + altın vurgu + zaman kaydı + makbuz dökümü + safha gecikme düzeltmesi + erişilemeyen ekranların çıkarılması |
| Expo hesabı | `olivyeejiru` |

> `versionCode` EAS'te tutuluyor (`appVersionSource: remote`), `app.json`'daki
> değer YOK SAYILIR.

## 5. Açık işler — sıradaki gündem

Tam gerekçeler `RAKIP-OZELLIK-ANALIZI.md`'de.

1. ✅ Zaman/çalışma kaydı — yazıldı, göç canlıya uygulanmadı
2. ✅ Serbest meslek makbuzu dökümü — yazıldı
2b. ⏸ **Tevkil panosu + sohbet geri açma** — kod hazır, park edildi.
    Açılacaksa sıra: KVKK metinleri → ekranlar → PLAY.md 4.3 → yeni AAB.
3. ⏸ **İçe aktarım** — başlamadan önce bir rakip programın (Sinerji/KolayOfis)
   gerçek dışa aktarma dosyası gerekiyor; biçimi bilmeden sütun eşleme ekranı
   tasarlanamaz. **Ürün sahibinden bekleniyor.**
4. ⏸ Müvekkil portalı — verinin RLS sınırından çıktığı ilk özellik olur;
   ürün sahibi kararı gerekiyor
5. ⏸ Ekip/büro dosya paylaşımı — en büyük mimari iş, her tablonun RLS
   politikası değişir
6. ⛔ UYAP Avukat Portal / e-Tebligat — e-imza + web servis + sertifikasyon
   istiyor; Expo uygulamasından yapılamaz, ayrı ürün kararı

**`finance_entries`'te müvekkil bağı yok** (`client_id` sütunu yok, ölçüldü) —
bu yüzden makbuz ekranında müşteri adı elle giriliyor. Eklenirse orası
ön-dolar.

## 6. Nerede ne yazıyor

| Dosya | İçeriği |
|---|---|
| `AGENTS.md` | Dürüstlük kuralları, sağlık verisi ayrımı — **her oturumda geçerli** |
| `PLAY.md` | Google Play çıkış planı, mağaza metinleri, formlar |
| `TESLIM.md` / `APPSTORE.md` | iOS yayın ve devir |
| `RAKIP-OZELLIK-ANALIZI.md` | Rakip taraması, ölçülen boşluklar |
| `UYAP-NOTU.md` | Bedesten içtihat ucu — ölçülmüş, başka projeye verilebilir |
| `MIMARI-DEVIR.md` | Eczane uygulaması devir notu (veritabanı paylaşılmaz) |
| `YEDEK.md` / `YEDEKLEME.md` | Yedekleme düzeni |
| `IAP_KURULUM.md` / `ODEME.md` | Abonelik ve ödeme kurulumu |

---

## Neden şifre koymuyoruz

Bir dosyaya şifre koymak burada koruma değil, **yanlış güven** üretirdi:
depo GitHub'da duruyor ve depoya erişebilen dosyayı zaten okur. Gerçek koruma
üç yerde: deponun kendi erişim izinleri, GitHub Secrets (anahtarlar için) ve
Supabase RLS (avukat verisi için). Üçü de kurulu.
