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

**Son güncelleme:** 26.09.2026 10:30 UTC

## 1. Şu an — yayın durumu

- **iOS 3.4.0** App Store Connect'te `PREPARE_FOR_SUBMISSION`, **derleme 7
  bağlı** (26.09 10:28 UTC, doğrulandı). Apple'a GÖNDERİLMEDİ.
- **Engel yok.** Gönder düğmesine **ürün sahibi** basacak: API'den gönderim
  bu oturumun izin denetimince engellendi (26.09). Gönderirken: sürüm
  sayfasında iki abonelik işaretlenir + 3 maddelik ret yanıtı yapıştırılır.
- Apple 2. ret (25.09) üç maddeydi, üçü de kapandı:
  2.3.7 görsellerde fiyat → görseller değişti, yüklendi (MD5 eşleşti) ·
  5.1.1 TC zorunlu → isteğe bağlı (derleme 6+) ·
  2.1(b) abonelik yüklenmiyor → RevenueCat `default`/`ai` teklifleri ürün
  sahibi tarafından dolduruldu (26.09 ölçüldü).
- **Web** (`vekilpro.app/app`) `main` dalından yayınlanıyor; `docs/app`
  `npm run export:web` ile üretilip commit edilir. Canlı paket = main'deki.
- **Android/Play:** başlanmadı (bkz. KARAR-DEFTERI §3).
- **Hasat** yayına kadar durduruldu (0156). Vektörleme kapalı (0154/0155).

## 2. Sıradaki / açık işler

1. Ürün sahibi gönderdikten sonra: `tam-denetim` ile durumu oku, aboneliklerin
   `WAITING_FOR_REVIEW` olduğunu doğrula.
2. Demo hesabın (bayram@vekilpro.app) duruşma tarihleri sabit (ilki 27.09);
   inceleme uzarsa `scripts/demo-hesap-ornek-veri.sql` ile tazele.
3. KVKK m.9: Supabase (İrlanda) + AI (ABD) için standart sözleşme ve Kurum'a
   bildirim YAPILMADI — ürün sahibinin işi (KVKK-UYUM.md seçenek A).
4. Kayıtta avukat (baro sicil) doğrulaması yok — ürün sahibi kararı bekliyor.
5. Supabase panelinde "Leaked password protection" kapalı (bir tık).
6. KVKK veri sorumlusu kimliği (unvan/adres/e-posta) hâlâ eksik.

## 3. Kritik kimlikler

- Supabase proje: `wjshlysfmeqlnfiibknj` (eu-west-1). Son göç: `0158`.
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
