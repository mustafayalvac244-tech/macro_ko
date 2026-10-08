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

**Son güncelleme:** 08.10.2026 (Console hesabı askıda; Claude Startup listesi; UYAP keşif aracı; bento geri alındı, {{ad}} çeviri hatası düzeltmesi kaldı; panelde kullanıcı kaynağı 0173; gece görevi 0174)

## 1. Şu an — yayın durumu

- **iOS 3.4.0 App Store'da YAYINDA** (iTunes lookup id 6812859016, TR,
  yayın 27.09 19:46 UTC — 01.10 ölçüldü). Sitede App Store bağlantısı var.
- **Web** (`vekilpro.app/app`) `main`'den yayınlanır; `docs/app` = `npm run
  export:web` (41 sn, 03.10 ölçüldü) + commit. Ortam yoksa derleme durur.
- **Hasat AÇIK** (28.09 18:34 UTC, 0160; ürün sahibi "hasata devam"). Geri alma
  eşiği: kullanıcı tablolarında zaman aşımı → 0156 ifadesiyle kapat.
  Vektörleme hâlâ kapalı (0154/0155). Ölçüldü 01.10: 24 saatte 14.373 yeni
  karar (katalog 11.037 + terim 3.336).

## 2. Sıradaki / açık işler

000. **SATIŞ PLANI (03.10):** kısa kayıt, "3 adımda başla", kullanım sayacı (0165),
   gizlilik metni — WEB+OTA CANLI. ÜRÜN SAHİBİ: App Privacy → Usage Data/Product
   Interaction/Analytics. Android: Play hesabı VAR; AAB derlemesi sonucu ÖLÇÜLMEDİ.
   Web'de satın alma yok; mesaj iPhone'a yönlendirir (PR #130).

00r. **REKLAM (04.10, "full reklam, vurucu şeyler"):** REKLAM.md (kanıt tablosu,
   Meta/Google/LinkedIn/Story metinleri, yazılmayacak iddialar). App Store
   tanıtım metni canlıya yazıldı (tanitim-yaz, 12:10 UTC, 160 krktr, geri okundu).
   Web'de utm → sayaç `kaynak:<kaynak>/<kampanya>`. BEKLENEN: avukat alıntıları
   için yazılı izin; reklam kanalı; story çekimi için 1 dilekçe onayı (≈₺5,5).
00a. **AI FİYAT (04.10 son):** aylık 2.999 TL; YILLIK 29.999 TL (Apple'dan geri okundu; hedef
   12×2.499=29.988, tam kademe yok); 6 aylık İPTAL (gösterilmez, satışta değil). Yıllık hâlâ
   MISSING_METADATA. ÜRÜN SAHİBİ: RevenueCat 'ai'ye Annual bağla, ASC'den incelemeye gönder.
00. **Satın alma webhook'u ÇALIŞIYOR** (02.10 22:38 UTC ölçüldü: RevenueCat test
   olayı → 200). Sır Supabase + RevenueCat'te. Gerçek ilk satın almada is_premium
   açıldığı ayrıca doğrulanmalı. 'Bearer' toleransı depoda (038d9bf), DAĞITILMADI.
0a. **CLAUDE: 08.10 CONSOLE HESABI ASKIDA (bkz. 2u).** 01.10'da çalışıyordu. Üç hata düzeltildi: anahtar
   çalışma alanına bağlı değildi → CALISMA_ALANI (Default, _shared/claudeIstemci);
   Haiku uyarlamalı düşünmeyi reddediyordu → _shared/claudeModel; deneme kontör
   düşüyordu (bakiye eksiye) + yedek cevap aylık hakkı yiyordu → ai-chat v121+.
   Anahtar ~30.10 biter.
   Modeller (05.10 teyit, "maliyet çok, olmaz"): SOHBET + DÜZELT HAIKU, gerisi SONNET 5 (katman.ts
   isModeli). ÖLÇÜM 04.10 aynı 7 senaryo (scripts/olcum-{haiku,sonnet}-sonuc.json):
   Haiku hızlı değil, yanlış madde no + yazım hatası; Sonnet temiz, ~2 kat pahalı. Mütalaa
   süre sınırına çarpıyordu (546) → aramalar paralel + düşünmesiz: 72,9 sn (ai-chat v139).
   HIZ: aramalar + denetimler PARALEL (v140). Ölçüldü: sohbet 25–30 → 22–23 sn, dilekçe
   66 → 58 sn; ~20 sn hâlâ modelden bağımsız, NEREDE harcandığı ÖLÇÜLMEDİ (adım süresi yok).
   Maliyet/önbellek ölçümü: KARAR-DEFTERI §5c. Gerçek satış 0; tek abonelik sandbox.
   04.10 gece (avukat "kısa, detay yok"): sohbet 500/900 krktr tavanı KALDIRILDI (~800–4.000),
   madde başına 2 karar; ai_istek'e sure_ms/model_bas_ms/model_ms (0169) — 20 sn nerede, gerçek
   kullanımda görülecek. Telefonda mikrofon YOK: klavye dikte ipucu (yerel modül = derleme).
   APİLEX DERSİ (04.10, KARAR-DEFTERI §5b): doğrulama e-postası TEKRAR GÖNDER eklendi; SMTP
   Resend ölçüldü. 0b. Bildirim (0161) ÖLÇÜLMEDİ. 0. Deneme 10 soru (0166).
   RESMÎ GAZETE (05.10): fihrist 3 saatte bir çekilir (cron vekil_resmi_gazete, 0170); 7 gün
   canlıda 200 (367–710 ms). Başlıklar aynen, AI özeti YOK. OTA BEKLİYOR. 06.10 BENTO ürün sahibi BEĞENMEDİ → geri alındı (web 08.10).
   PERFORMANS (05.10, KARAR §5d): madde-karar sorgusu 5,4 sn→136 ms; içtihat FTS hâlâ ~4 sn (disk).
   06.10: panelde "Nereden:" (kayit_kaynagi; eski kayıtlar cihaz kaydından platform). vekil_madde_baglam
   29.09'dan beri düşüyordu → 10 dk sınır (elle 205,7 sn'de bitti). Hasat INSERT'leri 30–63 sn sürüyor (disk).
0c. **KÜNYE CANLI TEYİDİ (03.10, 0167, PR #136/#137, OTA 220cb0d).** Havuzda olmayan
   Yargıtay künyesi Bedesten'de aranır; canlıda yok/olanaksız künye METİNDEN
   ÇIKARILIR (ürün sahibi "kullanıcıya yazılamaz"), yerine gerçek karar ÖNERİSİ.
   İçtihat istenince dosyaya 5–6 karar. Gerçek kullanımda ÖLÇÜLMEDİ.
0d. **AVUKAT GERİ BİLDİRİMİ (04.10, PR #142):** Düzelt düğmesi; UDF her seçicide, üretilen
   UDF 1.8 + hvl-default; GERÇEK UYAP Editör 5.4.20'de (Linux) AÇILDI, başlıklar kalın
   (scripts/udf-editor-denetim.md; Windows ve kaydet/e-imza denenmedi); Dilekçe Üret'e dosya
   ekleme, PDF sayfa görüntüsüyle (20 sayfa / 8 MB, maliyet ÖLÇÜLMEDİ); web'de sesle yazma;
   Belge Arşivi'ne Belge Yükle; Derin Araştırma → Hukuki Araştırma. WEB CANLI. OTA 7b06a953
   (04.10 17:20 UTC, 3.4.0); cihaza indiği ÖLÇÜLMEDİ. SİTE (04.10 akşam): "KVKK uyumlu" ×2,
   fotoğraftan künye, "olamaz", CSV/web planı SSS'leri düzeltildi; gizlilikte ek belge + web
   mikrofonu yazılı (testle korunur). Uygulama içi gizlilik metni: web'de, OTA'ya GİTMEDİ.

2u. **UYAP LİSTE (07.10):** eklentiye maskeli keşif (extension/lib/kesif.js); BEKLENEN avukattan keşif dosyası.
   **CONSOLE ASKIDA (08.10):** yedek modele düşer; inceleme metni CLAUDE-STARTUP.md. Belgeden dosya aç YAPAY ZEKÂSIZ: WEB CANLI (08.10 19:10 UTC, PR #155), OTA BEKLİYOR.
3. KVKK m.9: Supabase (İrlanda) + AI (ABD) sözleşme/bildirim YAPILMADI — ürün sahibinin (KVKK-UYUM.md A).
4. Baro sicil doğrulaması yok (ürün sahibi kararı). 5. Leaked password koruması kapalı. 6. KVKK veri sorumlusu kimliği eksik. 7. Android şifre sıfırlama DOĞRULANMADI.

## 3. Kritik kimlikler

- Supabase proje: `wjshlysfmeqlnfiibknj` (eu-west-1). Son göç: `0174` (0172 apply_migration ile; Actions arızası).
- Dal: `claude/legal-case-management-app-dipuvb` → PR ile `main`'e, Claude merge eder
  AMA **06.10: "Bana göstermeden yayınlama"** — main'e birleştirme = web yayını; önce görüntü göster, onay al.
- iOS imza: `ios-dagit.yml` + `imza: apple-api`. Her derlemede ÖNCE
  `yalniz-imza` ile listele, YALNIZ bizim önceki derlemenin sertifikasını
  `iptal_sertifika_id` ile iptal et. **`MK673L5BTW` İlaç Pro'nundur — ASLA
  iptal etme.** Build numarası uzaktan artar (son: 7).
- Süreler (ölçüldü): derleme+gönderim koşusu 8–46 dk; Apple işleme ≤24 dk
  (derleme 7); `vitrin-yaz`/`tam-denetim` ~1–2 dk.

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
