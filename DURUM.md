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
- **Web** (`vekilpro.app/app`) `main`'den yayınlanır; `docs/app` = `npm run
  export:web` (41 sn, 03.10 ölçüldü) + commit. Ortam yoksa derleme durur.
- **Android/Play:** başlanmadı (bkz. KARAR-DEFTERI §3).
- **Hasat AÇIK** (28.09 18:34 UTC, 0160; ürün sahibi "hasata devam"). Geri alma
  eşiği: kullanıcı tablolarında zaman aşımı → 0156 ifadesiyle kapat.
  Vektörleme hâlâ kapalı (0154/0155). Ölçüldü 01.10: 24 saatte 14.373 yeni
  karar (katalog 11.037 + terim 3.336).
- **Hasat talebe göre (0162/0163):** soru/arama 324 düz konuyla eşleşir → talep
  sayacı + öncelik ≥200 → öne alınır. 03.10: sayaç HİÇ kayıt tutmamış (bkz. 0a).

## 2. Sıradaki / açık işler

0000. OTA'larda satın alma kapalıydı (RevenueCat anahtarı yoktu) → PR #131 + OTA
   3ee398e9 ile düzeldi; inişi ÖLÇÜLMEDİ. Tek abonelik SANDBOX; gerçek satış 0.
000. **SATIŞ PLANI (03.10, "hepsini yap"):** kayıt kısaldı (TC/büro "Ek
   bilgiler" altında), ana ekranda "3 adımda başla" kartı, kullanım sayacı
   (0165 CANLI; kişisel veri yok; yönetici → "Kullanım (sayaç)"), gizlilik
   metni güncellendi. WEB CANLI (PR #129). Telefonlara OTA 3ee398e9 ile gitti.
   ÜRÜN SAHİBİ, OTA'dan ÖNCE: App Store Connect → App Privacy → "Usage Data →
   Product Interaction · Analytics · kimliğe bağlı değil" (API kapalı).
   Android: Play hesabı VAR (03.10). AAB derlemesi main'den başlatıldı, sonucu
   ÖLÇÜLMEDİ. Web'de satın alma yok; mesaj iPhone'a yönlendirir (PR #130).

00a. **AI UZUN DÖNEM (03.10, ürün sahibi "6 ay aylık 2499, yıl aylık 1999"):** App
   Store'da vekil_ai_six_month 14.999 TL, vekil_ai_annual 23.999 TL kuruldu (tam
   kademe yok, en yakın; MISSING_METADATA, görsel işleniyor, yalnız TUR). Satış
   ekranında süre seçici (RevenueCat'te paket varsa görünür). ÜRÜN SAHİBİ:
   RevenueCat → iki ürünü premium+ai'ye bağla, 'ai' teklifine Six Month + Annual
   paketi ekle; Apple'a incelemeye gönder. Sözleşme/site metni satışa açılınca.
00. **Satın alma webhook'u ÇALIŞIYOR** (02.10 22:38 UTC ölçüldü: RevenueCat test
   olayı → 200). Sır Supabase + RevenueCat'te. Gerçek ilk satın almada is_premium
   açıldığı ayrıca doğrulanmalı. 'Bearer' toleransı depoda (038d9bf), DAĞITILMADI.
0a. **Claude ÇALIŞIYOR (01.10 17:14 ölçüldü).** Üç hata düzeltildi: anahtar
   çalışma alanına bağlı değildi → CALISMA_ALANI (Default, _shared/claudeIstemci);
   Haiku uyarlamalı düşünmeyi reddediyordu → _shared/claudeModel; deneme kontör
   düşüyordu (bakiye eksiye) + yedek cevap aylık hakkı yiyordu → ai-chat v121+.
   Anahtar ~30.10 biter.
   Deneme: Sonnet 5, düşünme kapalı; dilekçe tavanı 6k + kesilirse devam.
   03.10: 2.999 ₺ paketi: dilekçe+mütalaa OPUS 5 (maxOut 16k, tahmin), sohbet+belge
   Sonnet 5, künye+taşma Haiku (v131). Denemeler Sonnet. Opus maliyeti ÖLÇÜLMEDİ.
   03.10 ölçüldü: sohbet ₺2,20/soru (tahmin ₺0,64), dilekçe ₺2,11. Geçmiş önbelleği +
   önbellek fiyatı → 0168, ai-chat v135, PR #138; etkisi ÖLÇÜLMEDİ (onbellek_okunan).
   Talep sayacı (hasat_konu_talep) 0 kayıt — sebebi BULUNAMADI (açık iş).
0b. Bildirim (0161): telefona düştüğü ÖLÇÜLMEDİ; Expo'da APNs anahtarı BİLİNMİYOR.
0. ÜCRETSİZ DENEME 10 (03.10; 0166, OTA 82feafd; kart 3. adım → Dilekçe Üret).
   Soru/cevap METNİ saklanmaz.
0c. **KÜNYE CANLI TEYİDİ (03.10, 0167, ai-chat v132, ictihat v68, PR #136).** Olay:
   avukat dilekçeye içtihat istedi, model 2 künye yazdı, ikisi havuzda yoktu;
   künye araması 6× 502 (Emsal düşünce tüm arama düşüyordu). Şimdi: havuzda
   olmayan Yargıtay künyesi Bedesten'de aranır → doğrulandı(uyap) / canlıda YOK
   / ulaşılamadı(sarı). ÜRÜN SAHİBİ: "kullanıcıya yazılamaz, çıkar ama zekice" →
   canlıda yok + olanaksız künye METİNDEN ÇIKARILIR (4 mod), cümlesi için havuz/
   canlı GERÇEK karar ÖNERİSİ döner (metne girmez); içtihat istenince dosyaya 5–6
   karar. ai-chat v134, PR #137, OTA 220cb0d (03.10 20:09 UTC). ÖLÇÜLMEDİ.
3. KVKK m.9: Supabase (İrlanda) + AI (ABD) için standart sözleşme ve Kurum'a
   bildirim YAPILMADI — ürün sahibinin işi (KVKK-UYUM.md seçenek A).
4. Kayıtta avukat (baro sicil) doğrulaması yok — ürün sahibi kararı bekliyor.
5. Supabase panelinde "Leaked password protection" kapalı (bir tık).
6. KVKK veri sorumlusu kimliği (unvan/adres/e-posta) hâlâ eksik.
7. Android "Şifremi unuttum" kesilmesi düzeltildi (26.09, Pressable + tek Text);
   Android'de DOĞRULANMADI (emülatör yok) — ürün sahibi yeni derlemede bakmalı.
9. Bulutta yalnız Accept edits / Plan / Auto var; bypass YOK. En az soru = Auto.

## 3. Kritik kimlikler

- Supabase proje: `wjshlysfmeqlnfiibknj` (eu-west-1). Son göç: `0168`.
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
