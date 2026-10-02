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

**Son güncelleme:** 03.10.2026 (satış planı: sayaç 0165 canlı, web paketi, PR)

## 1. Şu an — yayın durumu

- **iOS 3.4.0 App Store'da YAYINDA** (iTunes lookup id 6812859016, TR,
  yayın 27.09 19:46 UTC — 01.10 ölçüldü). Sitede App Store bağlantısı main'de
  (957a16a, başka oturum: Safari şeridi + 2. düğme; benimki çakışmada bırakıldı).
- Apple 2. ret (25.09) üç maddeydi, üçü de kapandı:
  2.3.7 görsellerde fiyat → görseller değişti, yüklendi (MD5 eşleşti) ·
  5.1.1 TC zorunlu → isteğe bağlı (derleme 6+) ·
  2.1(b) abonelik yüklenmiyor → RevenueCat `default`/`ai` teklifleri ürün
  sahibi tarafından dolduruldu (26.09 ölçüldü).
- **Web** (`vekilpro.app/app`) `main`'den yayınlanır; `docs/app` = `npm run
  export:web` (41 sn, 03.10 ölçüldü) + commit. Ortam yoksa derleme durur.
- **Android/Play:** başlanmadı (bkz. KARAR-DEFTERI §3).
- **Hasat AÇIK** (28.09 18:34 UTC, 0160; ürün sahibi "hasata devam"). Geri alma
  eşiği: kullanıcı tablolarında zaman aşımı → 0156 ifadesiyle kapat.
  Vektörleme hâlâ kapalı (0154/0155). Ölçüldü 01.10: 24 saatte 14.373 yeni
  karar (katalog 11.037 + terim 3.336).
- **Hasat talebe göre (0162, 01.10):** ai-chat sorusu ve içtihat araması (1.
  sayfa) 970 sabit konuyla eşleşir → hasat_konu_talep sayacı (METİN YOK, kişi
  yok) + öncelik ≥200 → emsal hasadında saatte bir öne alınır. Sıklık aynı.
  0163: sınıra takılıp bitmiş talepli konu 51. sayfadan sürer; harvest-tick
  talepli konuda 200 sayfaya iner. Test araması sayacı silindi (gerçek değil).

## 2. Sıradaki / açık işler

000. **SATIŞ PLANI (03.10, "hepsini yap"):** kayıt kısaldı (TC/büro "Ek
   bilgiler" altında), ana ekranda "3 adımda başla" kartı, kullanım sayacı
   (0165 CANLI; kişisel veri yok; yönetici → "Kullanım (sayaç)"), gizlilik
   metni güncellendi. Web paketi 5a7ffd1. Telefonlara OTA GİTMEDİ — sorulacak.
   ÜRÜN SAHİBİ, OTA'dan ÖNCE: App Store Connect → App Privacy → "Usage Data →
   Product Interaction · Analytics · kimliğe bağlı değil" (API kapalı).
   Android: Play hesabı (25 $) ürün sahibinde; metinler PLAY.md'de.

00. **Satın alma webhook'u ÇALIŞIYOR** (02.10 22:38 UTC ölçüldü: RevenueCat test
   olayı → 200). Sır Supabase + RevenueCat'te. Gerçek ilk satın almada is_premium
   açıldığı ayrıca doğrulanmalı. 'Bearer' toleransı depoda (038d9bf), DAĞITILMADI.
0a. **Claude ÇALIŞIYOR (01.10 17:14 ölçüldü).** Üç hata düzeltildi: anahtar
   çalışma alanına bağlı değildi → CALISMA_ALANI (Default, _shared/claudeIstemci);
   Haiku uyarlamalı düşünmeyi reddediyordu → _shared/claudeModel; deneme kontör
   düşüyordu (bakiye eksiye) + yedek cevap aylık hakkı yiyordu → ai-chat v121+.
   Anahtar ~30.10 biter. Test hesapları silindi. PR #127 main'e birleşti, OTA 27.
   Deneme: Sonnet 5, düşünme kapalı; dilekçe tavanı 6k + kesilirse devam.
   02.10: 0164 + v126 — kuraldaki "2 hafta" hatası düzeltildi, iscilik_faiz + denetim.
0b. 30.09: UYGULAMA BİLDİRİMİ yazıldı: 0161 (push_cihaz, admin_bildirim_gonder,
   Expo push + pg_net) canlıda doğrulandı; oturum açılınca izin+adres kaydı;
   yönetici ekranı → "Bildirim gönder" (son N / herkes). OTA 5961921e (30.09 17:35).
   AÇIK: telefona düştüğü ÖLÇÜLMEDİ; iOS için Expo'da APNs anahtarı tanımlı mı
   BİLİNMİYOR (bilet "InvalidCredentials" dönerse eksik o). Adres ancak
   kullanıcı yeni sürümü açıp izin verince oluşur. Web paneline girmedi.
0. 28.09: kayıtta sahte başarı düzeltildi + ücretsiz 5 deneme sorusu (OTA
   gitti, telefona indiği ÖLÇÜLMEDİ). Deneme takibi: yönetici → 0159; soru
   METNİ saklanmıyor. AI kendini "Vekil Pro asistanıyım" diye tanıtır.
3. KVKK m.9: Supabase (İrlanda) + AI (ABD) için standart sözleşme ve Kurum'a
   bildirim YAPILMADI — ürün sahibinin işi (KVKK-UYUM.md seçenek A).
4. Kayıtta avukat (baro sicil) doğrulaması yok — ürün sahibi kararı bekliyor.
5. Supabase panelinde "Leaked password protection" kapalı (bir tık).
6. KVKK veri sorumlusu kimliği (unvan/adres/e-posta) hâlâ eksik.
7. Android "Şifremi unuttum" kesilmesi: login/signup'taki `<Link><Text/></Link>`
   Pressable + tek Text yapıldı (26.09). Android'de DOĞRULANMADI (emülatör
   yok) — ürün sahibi yeni derlemede bakmalı. Kod değişikliği; iOS/Android'e
   ancak yeni derleme ya da OTA ile gider.
9. İzinler: bulut oturumunda yalnız Accept edits / Plan / Auto var; repo
   ayarındaki bypass/dontAsk YOK SAYILIR. En az soru = Auto. "Bypass var" deme.

## 3. Kritik kimlikler

- Supabase proje: `wjshlysfmeqlnfiibknj` (eu-west-1). Son göç: `0165`.
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
  01.10: "para harcama, bakiyeyi bitirme" — test için yapay zekâya SORU SORMA.
- Sağlık verisi bu depoya girmez; eczane tablolarına/fonksiyonlarına dokunma.
- Tevkil panosu ve meslektaş mesajları **KAPALI** (26.09, 0158). Veri
  silinmedi. Açmak ürün sahibi kararı.
- Ölçmediğin sayıyı yazma; kör bekleme yok; sonucu değiştirmeyen tekrar yok.

## 5. Bu oturumda öğrenilen tuzaklar

- `git rm` düşünce `&&` zinciri `| grep` yüzünden devam edip commit etti
  (26.09). Test/komut zincirinde çıkış kodunu boruya kaptırma.
- `main`'e birleştirirken eski dallar düzeltilmiş dosyaları geri getirebilir
  (iPad hata görseli, "ücretsiz" başlığı) — çakışmada bizimkini tut, testi koş.
  İSTİSNA (03.10): main'e BAŞKA oturum doğrudan yazmış olabilir; birleştirmeden
  önce `git log HEAD..origin/main` bak, daha yeni/doğru olanı tut.
- Satış ekranı fiyatı sabitten değil mağazadan (`priceString`) okunmalı.
- 30.09: "Zoho ile bilgi@vekilpro.app bedava" denildi; ücretsiz planın yalnız bazı
  veri merkezlerinde olduğu biliniyordu ama söylenmedi — AB'de yoktu (4 $/ay).
  Koşula bağlı bilgi "evet" diye verilmez; koşul cevabın İLK cümlesine yazılır.
