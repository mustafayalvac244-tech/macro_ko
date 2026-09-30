# DURUM — her oturumda otomatik yüklenir (CLAUDE.md → @DURUM.md)

> **Neden var (26.09.2026, ürün sahibi):** "Context window doldukça buna çözüm
> bul, unutma geçmişi." Sohbet uzayınca özetleniyor ve ayrıntı kayboluyor.
> Bu dosya özetlemeden etkilenmez: CLAUDE.md her oturumda ve her özetlemeden
> sonra yeniden yüklenir, bu dosya da onunla gelir.
>
> **KURAL:** önemli bir adım bittiğinde (yayın, derleme, göç, ürün sahibi
> kararı, yeni açık iş) bu dosya AYNI turda güncellenir ve commit edilir.
> Kısa tut — 120 satırı geçerse `tests/durumDosyasi.test.ts` düşer. Uzun
> gerekçe ve geçmiş `KARAR-DEFTERI.md`'ye yazılır, burada yalnız ŞU AN.

**Son güncelleme:** 29.09.2026 (PC geçişi hazır → PC-GECIS.md)

## 1. Şu an — yayın durumu

- **iOS 3.4.0 Apple'da: `WAITING_FOR_REVIEW`, derleme 7** (27.09 18:15 UTC
  okundu). İki abonelik de `WAITING_FOR_REVIEW` — sürümle birlikte gitmiş.
  Ürün sahibi arayüzden gönderdi (API'den gönderim izin denetimince engelli).
- Apple 2. ret (25.09) üç maddeydi, üçü de kapandı:
  2.3.7 görsellerde fiyat → görseller değişti, yüklendi (MD5 eşleşti) ·
  5.1.1 TC zorunlu → isteğe bağlı (derleme 6+) ·
  2.1(b) abonelik yüklenmiyor → RevenueCat `default`/`ai` teklifleri ürün
  sahibi tarafından dolduruldu (26.09 ölçüldü).
- **Web** (`vekilpro.app/app`) `main` dalından yayınlanıyor; `docs/app`
  `npm run export:web` ile üretilip commit edilir. **18.09–26.09 arası canlı
  web giriş yaptırmıyordu** (paket Supabase adresi olmadan derlenmişti);
  26.09'da düzeltildi. Artık ortam yoksa derleme durur, tests/webPaketi düşer.
- **Android/Play:** başlanmadı (bkz. KARAR-DEFTERI §3).
- **Hasat AÇIK** (28.09 18:34 UTC, 0160; ürün sahibi "hasata devam"). Geri alma
  eşiği: kullanıcı tablolarında zaman aşımı → 0156 ifadesiyle kapat.
  Vektörleme hâlâ kapalı (0154/0155).

## 2. Sıradaki / açık işler

00. **ACİL — satın alma sunucuya ulaşmıyor.** `revenuecat-webhook` 28.09'da
   `503 not_configured` döndü (REVENUECAT_WEBHOOK_SECRET yok); `purchases`
   tablosunda hiç RevenueCat olayı yok. Ödeyen kullanıcının is_premium/ai_tier'ı
   AÇILMAZ. Ürün sahibi: aynı rastgele değeri Supabase secret'a ve RevenueCat →
   Integrations → Webhooks → Authorization'a girecek. Doğrulama: yetkisiz POST
   503 değil 401 dönmeli. Satın alma bildirimi: RevenueCat iOS uygulaması.
0a. 30.09: Claude ÇALIŞMIYOR — yeni ANTHROPIC_API_KEY çalışma alanına bağlı değil
   (ai_saglayici_durum: 400 "not scoped to a workspace"). Ürün sahibi anahtarı
   Workspace=Default seçerek yeniden oluşturacak (30 gün sınırlı; ~30.10'da
   yenile). Test hesabı ai-test-kontrol@vekilpro.app (d6d41785…) doğrulamadan
   sonra SİLİNECEK. Sonra üyelere "5 deneme sorusu" e-postası (hepsinde
   deneme_soru_kullanildi=0, ölçüldü).
0. 28.09: kayıtta sahte başarı düzeltildi (authStore.signUp) + ücretsiz katmana
   5 deneme sorusu (Haiku; sunucu ai-chat v111 / ictihat v54 dağıtıldı).
   Web canlı; telefonlara OTA ile gönderildi (ürün sahibi: "göndermeden önce
   bunu da ekle"). OTA'nın telefona indiği ÖLÇÜLMEDİ.
   Deneme takibi: yönetici ekranı → "Deneyen kişi / Ücretliye geçen / Deneme
   (7 gün)" (0159 admin_deneme_takibi). Soru METNİ saklanmıyor, gösterilmiyor.
   Yapay zekâ kendini "Vekil Pro asistanıyım" diye tanıtıyor (28.09; sunucu
   ai-chat v112 / ictihat v55; karşılama metni 2. OTA ile gitti. Eski ad
   "Vekil AI"); AI olduğunu saklamaz, model/şirket adını söylemez.
1. İnceleme sonucunu `tam-denetim` ile oku (sürüm satırı: `3.4.0  =  DURUM`).
2. Demo hesabın (bayram@vekilpro.app) duruşma tarihleri sabit (ilki 27.09);
   inceleme uzarsa `scripts/demo-hesap-ornek-veri.sql` ile tazele.
3. KVKK m.9: Supabase (İrlanda) + AI (ABD) için standart sözleşme ve Kurum'a
   bildirim YAPILMADI — ürün sahibinin işi (KVKK-UYUM.md seçenek A).
4. Kayıtta avukat (baro sicil) doğrulaması yok — ürün sahibi kararı bekliyor.
5. Supabase panelinde "Leaked password protection" kapalı (bir tık).
6. KVKK veri sorumlusu kimliği (unvan/adres/e-posta) hâlâ eksik.
7. Android "Şifremi unuttum" kesilmesi: login/signup'taki `<Link><Text/></Link>`
   Pressable + tek Text yapıldı (26.09). Android'de DOĞRULANMADI (emülatör
   yok) — ürün sahibi yeni derlemede bakmalı. Kod değişikliği; iOS/Android'e
   ancak yeni derleme ya da OTA ile gider.
8. Statik çeviri anahtarı taraması: eksik 0/1.819 (26.09, kod taraması).
   Dinamik anahtarlar (51 yer) canlı değerlerle kısmen karşılaştırıldı.
9. İzinler (resmi belge, 26.09 okundu): bulut oturumunda mod menüsü yalnız
   Accept edits / Plan / Auto sunar — "Bypass permissions isn't available".
   Repo `.claude/settings.json`'daki bypass/dontAsk bulutta YOK SAYILIR.
   En az soru = Auto (arka planda güvenlik denetimi; Apple gönderimi ve kendi
   izin ayarını değiştirme bu denetimce engellendi). "Bypass var" deme — yok.

## 3. Kritik kimlikler

- Supabase proje: `wjshlysfmeqlnfiibknj` (eu-west-1). Son göç: `0160`.
- Dal: `claude/legal-case-management-app-dipuvb` → PR ile `main`'e, **Claude
  merge eder** ("sen et merge her zaman").
- iOS imza: `ios-dagit.yml` + `imza: apple-api`. Her derlemede ÖNCE
  `yalniz-imza` ile listele, YALNIZ bizim önceki derlemenin sertifikasını
  `iptal_sertifika_id` ile iptal et. **`MK673L5BTW` İlaç Pro'nundur — ASLA
  iptal etme.** Build numarası uzaktan artar (son: 7).
- Süreler (ölçüldü): derleme+gönderim koşusu 8–46 dk; Apple işleme ≤24 dk
  (derleme 7); `vitrin-yaz`/`tam-denetim` ~1–2 dk.
- RevenueCat teklifleri public `appl_` anahtarla ölçülür (eas.json'da).

## 4. Kalıcı ürün sahibi kuralları (özet — tamamı AGENTS.md/KARAR-DEFTERI)

- **Az soru sor.** "Sorma, hepsine evet diyorum." Karar gerçekten onunsa sor.
- Sır/anahtar sohbete, depoya yazılmaz; `service_role`/`sb_secret_` asla.
- Kullanıcının sohbete yazdığı kişisel veri (TC no vb.) hiçbir yere yazılmaz.
- Telefona izinsiz OTA yok. Ücretli değerlendirme betiği izinsiz koşmaz.
- Sağlık verisi bu depoya girmez; eczane tablolarına/fonksiyonlarına dokunma.
- Tevkil panosu ve meslektaş mesajları **KAPALI** (26.09, 0158). Veri
  silinmedi. Açmak ürün sahibi kararı.
- Ölçmediğin sayıyı yazma; kör bekleme yok; sonucu değiştirmeyen tekrar yok.

## 5. Bu oturumda öğrenilen tuzaklar

- `git rm` düşünce `&&` zinciri `| grep` yüzünden devam edip commit etti
  (26.09). Test/komut zincirinde çıkış kodunu boruya kaptırma.
- `main`'e birleştirirken eski dallar düzeltilmiş dosyaları geri getirebilir
  (iPad hata görseli, "ücretsiz" başlığı) — çakışmada bizimkini tut, testi koş.
- Satış ekranı fiyatı sabitten değil mağazadan (`priceString`) okunmalı.
- 30.09: "Zoho ile bilgi@vekilpro.app bedava" denildi; ücretsiz planın yalnız bazı
  veri merkezlerinde olduğu biliniyordu ama söylenmedi — AB'de yoktu (4 $/ay).
  Koşula bağlı bilgi "evet" diye verilmez; koşul cevabın İLK cümlesine yazılır.
