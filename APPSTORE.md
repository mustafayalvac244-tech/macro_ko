# App Store Yayın Dosyası — Vekil Pro

App Store Connect'e **doğrudan kopyalanacak** metinler ve cevaplar.
Arkadaşının hesabı hazır olur olmaz bu dosyayla 1 saatte yayına girilir.

---

## 0. ⚠️ Önce bunlar — yoksa Apple reddeder

| # | Konu | Durum |
|---|---|---|
| 1 | iOS izin açıklama metinleri (Face ID, galeri, kamera, takvim) | ✅ **eklendi** (`app.json`) |
| 2 | Kullanılmayan mikrofon izni (`RECORD_AUDIO`) | ✅ **kaldırıldı** |
| 3 | **Gizlilik Politikası URL'si** (herkese açık web adresi) | ❌ **senin yapman lazım** — aşağıda |
| 4 | **Demo hesabı** (Apple incelemecisi için) | ❌ **senin yapman lazım** — aşağıda |
| 5 | Kullanılmayan Stripe eklentisi | ⚠️ öneri — aşağıda |

### 3) Gizlilik Politikası URL'si (zorunlu)
Apple, uygulama içi ekran kabul etmiyor; **herkese açık bir web adresi** istiyor.
En hızlı ve ücretsiz yol — GitHub Pages:
1. Repoda `docs/privacy.html` oluştur (uygulamadaki `app/privacy.tsx` metnini koy)
2. GitHub → Settings → Pages → Source: `main` / `docs`
3. Çıkan adres (`https://<kullanıcı>.github.io/macro_ko/privacy.html`) App Store'a girilir

> İstersen bu sayfayı ben hazırlayayım — söylemen yeterli.

### 4) Demo hesabı (zorunlu)
Girişli uygulamalarda Apple **çalışan bir test hesabı** ister; yoksa "Guideline 2.1"
ile reddeder. İçi **dolu** olmalı (boş hesap "eksik uygulama" görünür).
- E-posta: `demo@vekilpro.app` (veya kendi alan adın)
- Şifre: güçlü bir şifre belirle
- İçine 3-5 dava, birkaç müvekkil, duruşma ve finans kaydı gir
- App Store Connect → App Review Information → Sign-In Required ✓ → bilgileri yaz

### 5) Stripe eklentisi (öneri)
`app.json` içindeki `@stripe/stripe-react-native` eklentisi **kullanılmıyor** ama
native ödeme kodunu binary'e ekliyor. Apple, ödeme SDK'sı gören uygulamalarda
"uygulama içi satın alma kullanıyor musun?" diye sorabiliyor. İlk iOS derlemesi
zaten sıfırdan yapılacağı için **şimdi çıkarmak en doğru an.** Onay verirsen
`plugins` listesinden ve `package.json`'dan kaldırırım.

---

## 1. Temel bilgiler

| Alan | Değer |
|---|---|
| **App Name** (30 karakter) | `Vekil Pro` |
| **Subtitle** (30 karakter) | `Avukat dosya ve süre takibi` |
| **Kategori (birincil)** | Business |
| **Kategori (ikincil)** | Productivity |
| **Yaş sınırı** | 4+ |
| **Fiyat** | Ücretsiz (abonelik sonra eklenecek) |
| **Dil** | Türkçe (birincil), İngilizce |

---

## 2. Promotional Text (170 karakter — istediğin zaman değiştirilebilir)

```
Duruşma çıkışında süreyi kaydet, uygulama kanuni süreyi kendisi hesaplasın. Dava, müvekkil, duruşma ve büro finansı tek yerde.
```

---

## 3. Description (App Store açıklaması)

```
Vekil Pro, avukatın günlük işini tek uygulamada toplar: dava takibi, duruşma
takvimi, kanuni süreler, müvekkil yönetimi ve büro finansı.

SÜRE KAÇIRMAYI ÖNLER
Duruşma bittiğinde uygulama size sonucu sorar. Üç dokunuşla seçersiniz; sonraki
duruşmayı ve kanuni süreyi dayanağıyla birlikte kendisi oluşturur. Kanun yoluna
başvuru sürelerinin tebliğden işlediğini bilir (HMK m.345) — karar tarihinden
hesaplayıp sizi yanıltmaz.

DAVA VE MÜVEKKİL YÖNETİMİ
• Sınırsız dava, müvekkil ve duruşma kaydı
• Dosya aşaması, karşı taraf ve vekalet bilgileri
• İcra takibi ve tahsilat yönetimi
• Vekaletname takibi, özel yetki kontrolü (HMK m.74)
• Belge kasası — dosyaya ait evrakları yanınızda taşıyın

TAKVİM VE HATIRLATMALAR
• Duruşma, keşif, toplantı ve süre takvimi
• Akıllı bildirimler; telefon takviminize aktarma
• Günlük özet: bugün sizi ne bekliyor

BÜRO FİNANSI
• Gelir-gider takibi, tekrarlı kalemler
• Dava bazlı tahsilat ve ödeme sözü takibi
• Aylık özet ve muhasebeciye tek dokunuşla CSV aktarımı

ADLİYEDE İNTERNET OLMASA DA ÇALIŞIR
• 8 temel kanun, 4.674 madde cihazınızda çevrimdışı
• Son senkronize dosyalarınız çevrimdışı okunabilir

HUKUKİ ARAÇLAR
• Dilekçe şablonları (mazeret, itiraz, istinaf ve daha fazlası)
• Avukatlık ücret sözleşmesi üretici
• Hukuki hesaplayıcılar

GÜVENLİK
• Face ID ile uygulama kilidi
• Verileriniz kullanıcı bazında yalıtılır; başka kimse göremez
• Otomatik günlük yedekleme

Vekil Pro bağımsız bir yazılımdır; Adalet Bakanlığı veya UYAP ile resmî bir
bağlantısı yoktur. Uygulamadaki hukuki bilgiler yol gösterici niteliktedir,
hukuki tavsiye değildir; güncel mevzuatı teyit ediniz.
```

---

## 4. Keywords (100 karakter, virgülle, boşluksuz)

```
avukat,hukuk,dava,duruşma,süre,müvekkil,icra,baro,adliye,dilekçe,tebligat,vekalet,büro,ajanda
```

---

## 5. Ekran görüntüsü metinleri (6-8 görsel)

Her ekran görüntüsünün üstüne konacak başlıklar:

| # | Ekran | Üst yazı |
|---|---|---|
| 1 | Ana ekran | **Bugün sizi ne bekliyor?** Duruşma, süre ve işler tek bakışta |
| 2 | Duruşma Çıkışı | **Süre kaçırmayın.** Duruşma sonucunu seçin, süreyi uygulama hesaplasın |
| 3 | Dava detay | **Her dosya elinizin altında.** Aşama, taraflar, belgeler |
| 4 | Takvim | **Duruşma takviminiz.** Hatırlatmalar otomatik |
| 5 | Finans | **Büronuzun parası.** Gelir-gider, tahsilat, muhasebeye aktarım |
| 6 | Mevzuat | **İnternet yokken bile.** 4.674 madde cebinizde |
| 7 | Vekalet | **Özel yetki kontrolü.** Eksik yetkiyi önceden görün |

**Gerekli boyutlar:** 6.7" (1290×2796) ve 6.5" (1242×2688) — iPhone simülatöründen
ya da gerçek cihazdan alınabilir.

---

## 6. App Privacy anketi cevapları

Apple'ın "App Privacy" bölümünde işaretlenecekler. **Doğru beyan önemli** —
yanlış beyan uygulamanın kaldırılma sebebidir.

**Toplanan veriler → Uygulama İşlevselliği (App Functionality) amacıyla,
kullanıcı kimliğine BAĞLI (Linked to You), izleme (Tracking) YOK:**

| Veri türü | Toplanıyor mu | Not |
|---|---|---|
| İletişim bilgisi — E-posta | ✅ Evet | Hesap açılışı |
| İletişim bilgisi — İsim | ✅ Evet | Profil |
| İletişim bilgisi — Telefon | ✅ Evet | İsteğe bağlı profil alanı |
| Kullanıcı içeriği — Diğer | ✅ Evet | Dava/müvekkil kayıtları, belgeler |
| Tanımlayıcılar — Kullanıcı ID | ✅ Evet | Hesap kimliği |
| Konum | ❌ Hayır | |
| Kişiler (rehber) | ❌ Hayır | |
| Reklam verisi | ❌ Hayır | |
| Kullanım/analitik | ❌ Hayır | |
| **Tracking (izleme)** | ❌ **Hayır** | Reklam ağı yok, ATT izni gerekmez |

> Müvekkil TC kimlik numarası gibi hassas alanlar "Kullanıcı içeriği" altında
> değerlendirilir ve avukatın kendi kaydıdır; üçüncü tarafla paylaşılmaz.

---

## 7. App Review Information (incelemeciye not)

App Store Connect → App Review Information → Notes alanına:

```
Vekil Pro, Türkiye'deki avukatların dava dosyalarını, duruşma takvimini,
kanuni süreleri ve büro finansını yönettiği bir üretkenlik uygulamasıdır.

Kullanım için giriş gereklidir; demo hesabı bilgileri yukarıdadır. Demo
hesabında örnek dava, müvekkil ve duruşma kayıtları hazır bulunmaktadır.

Uygulama şu an ücretsizdir; uygulama içi satın alma bulunmamaktadır.
Yapay zekâ özellikleri arayüzde "Yakında" olarak işaretlidir ve devre dışıdır.

İzinler: bildirimler (duruşma hatırlatması), takvim (duruşmayı telefon
takvimine ekleme), galeri/kamera (dosyaya belge ekleme), Face ID (uygulama
kilidi). Tümü kullanıcı isteğiyle ve isteğe bağlı çalışır.

Uygulama bağımsızdır; Adalet Bakanlığı veya UYAP ile resmî bağlantısı yoktur.
```

---

## 8. Yayın komutları

```bash
npm install

# iOS üretim derlemesi (EAS bulutta derler)
npx eas build --platform ios --profile production

# App Store'a yükle
npx eas submit --platform ios --profile production --latest
```

`eas.json` içindeki `submit.production.ios` alanları arkadaşının bilgileriyle
güncellenecek (Team ID, ascAppId, API key) — detaylar `TESLIM.md`'de.

---

## 9. Yayın öncesi son kontrol

- [ ] Gizlilik politikası web adresi hazır ve açılıyor
- [ ] Demo hesabı oluşturuldu, içi dolduruldu, giriş test edildi
- [ ] Ekran görüntüleri alındı (6.7" ve 6.5")
- [ ] `eas.json` arkadaşının Apple bilgileriyle güncellendi
- [ ] Bundle ID kararı verildi (yeni ID mi, transfer mi — `TESLIM.md`)
- [ ] Stripe eklentisi kaldırılsın mı, karar verildi
- [ ] Açıklama ve anahtar kelimeler App Store Connect'e girildi
- [ ] App Privacy anketi dolduruldu
- [ ] Build yüklendi ve "Ready to Submit" görünüyor
- [ ] Submit for Review
