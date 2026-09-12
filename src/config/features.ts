// Özellik bayrakları.
//
// NEDEN ARTIK TEK BAYRAK DEĞİL. Eskiden tek bir AI_ENABLED vardı ve sekiz
// ekranı birlikte açıp kapatıyordu. Bu, "aç" ile "kapat" arasında üçüncü bir
// seçenek bırakmıyordu; oysa özelliklerin hazırlık düzeyi AYNI DEĞİL:
//
//   • DİLEKÇE ve BELGE İNCELEME ölçüldü ve çalışıyor. Dilekçede on senaryonun
//     onu da geçti (tek koşuda hepsi birden değil — ücretsiz modellerin koşudan
//     koşuya değişkenliği yüzünden tek koşunun oranı güvenilir değil), belge
//     incelemesinde üç senaryonun üçü geçti.
//   • MÜTALAA kapalı: ücretsiz modeller mütalaada kanun uyduruyordu ve özellik
//     uçta da Claude'a kilitli (ANTHROPIC_API_KEY gelene kadar 503 döner).
//     Açmak, kullanıcıya bozuk bir ekran göstermek olurdu.
//   • SOHBET, İÇTİHAT ANALİZİ, DOSYA AKTARMA ve SAVAŞ PLANI hiç ölçülmedi.
//     Ölçülmemiş özelliği açmak, kalitesini kullanıcıyla sınamaktır.
//
// Bayrakları ayırmak, ölçülmüş olanı ölçülmemişi beklemeden yayınlamayı
// mümkün kılıyor.
//
// ÜCRETSİZ KOTA ORTAKTIR: sağlayıcının günlük tavanı TÜM kullanıcılar için
// tek havuz (bkz. _shared/kullanim.ts). Günlük adil kullanım sınırı uçta
// uygulanıyor; havuz bittiğinde kullanıcı "kota doldu, şu kadar sonra tekrar
// deneyin" mesajı görür — sessiz bir arıza değil.

/** Dilekçe üretimi — ölçüldü, açık. */
export const AI_DILEKCE_ENABLED = true;

/** Belge inceleme — ölçüldü, açık. */
export const AI_BELGE_ENABLED = true;

/**
 * Derin hukuki değerlendirme — AÇILDI (2026-09-11, kullanıcı kararı).
 *
 * NEDEN AÇILDI: bu bayrağın kapalı olma gerekçesi tek bir şeydi —
 * "Claude anahtarı gelene kadar kapalı". ANTHROPIC_API_KEY artık Supabase
 * uç ortamında tanımlı, yani gerekçe ortadan kalktı. Katman seçimi anahtarın
 * varlığına bakıyor ve deploy gerektirmeden Claude'a dönüyor
 * (bkz. _shared/katman.ts: "Anahtar eklenince deploy gerekmeden Claude'a döner").
 *
 * ÜCRETSİZ KULLANICI BUNU GÖREMEZ, ve bu bayrakla ilgili değil: sunucu
 * mütalaayı yalnız 'ai' katmanına açıyor ve diğerlerine 403 `tier_required`
 * döndürüyor (ai-chat/index.ts:1667). Ekran o kodu zaten karşılıyor ve
 * "Pro gerekli" durumunu gösteriyor. Yani bayrak yalnızca istemcideki
 * "Çok Yakında" perdesiydi; kaldırıldı.
 *
 * ── DÜRÜSTLÜK NOTU: BU ÖZELLİĞİN KALİTESİ ÜCRETLİ MODELLE HİÇ ÖLÇÜLMEDİ ──
 *
 * Elimizdeki TEK mütalaa ölçümü 2026-09-05 tarihli ve BEŞ SENARYONUN BEŞİ DE
 * KUSURLU çıkmış (scripts/eval-mutalaa-hatalar.json). O dosyada model künyesi
 * YOK — ölçüm künye mekanizmasından önceydi — yani hangi modelin ürettiğini
 * kesin bilmiyoruz. Anahtar o tarihte tanımlı olmadığı için ücretsiz bir model
 * olduğu ÇIKARIMI yapılabilir, ama bu bir çıkarımdır, kayıt değil.
 *
 * Kusurların türü önemli: UYDURMA değil, EKSİK. Kaçırılanlar arasında
 *   • işe iadede ZORUNLU ARABULUCULUK (dava şartı — atlanırsa dava usulden red)
 *   • trafik kazasında uzamış (ceza) zamanaşımı
 *   • kira tahliyesinde "iki haklı ihtar" ve süreler
 *   • ödeme emrinde icra mahkemesi yolu ve "itiraz satışı durdurmaz"
 *   • idari işlemde 60 gün, adli tatil, yürütmenin durdurulması
 * var. Bunlar bir avukatın gözünden kaçarsa hak kaybı doğurur.
 *
 * Bu yüzden ekrandaki hukuki uyarı (HukukiUyari) ve "çıktı TASLAKTIR"
 * çerçevesi burada kozmetik değil, gerekli. Ücretli modelle ölçüm yapılana
 * kadar "mütalaa kalitesi iyi" DENEMEZ; yalnız "erişime açıldı" denebilir.
 *
 * 12.09.2026: model Opus 5'ten Sonnet 5'e indirildi (maliyet). Mütalaa
 * Opus'ta da ölçülememişti, Sonnet'te de ölçülmedi — durum değişmedi.
 *
 * ÖLÇÜM TEK TIK UZAKTA: Actions → "AI Ölçümü" → grup: ai. eval-mutalaa beş
 * senaryodur, en pahalı gruptaki en küçük settir.
 */
export const AI_MUTALAA_ENABLED = true;

/**
 * UYAP belgesinden dosya aktarma — ÖLÇÜLDÜ ama henüz açılmadı.
 *
 * Yedi senaryoluk ölçüm kuruldu (scripts/kunye-senaryolari.json): 7/7 temiz,
 * 20 alanın 20'si doğru, SIFIR uydurma, sıfır tuzak. İstem sunucuya taşındı ve
 * belgede karşılığı olmayan alan artık atılıyor.
 *
 * AÇILDI (kullanıcı kararı). Dürüstlük notu değişmedi: ölçüm YEDİ senaryodur,
 * ince bir settir ve özellik GERÇEK KULLANICIYA HİÇ GİTMEDİ (sıfır kayıt).
 * "7/7 geçti" ifadesi bu setin tamamı için doğrudur, genel doğruluk iddiası
 * değildir. Ekran zaten çıkarılamayan alanı boş bırakıyor ve modele tahmin
 * ettirmiyor — yanlış alanla dosya kurmaktansa boş bırakmak yeğdir.
 *
 * NOT: bu özellik ai-chat'ten geçer (mode: 'kunye'), yani ÜCRETSİZ kullanıcının
 * yaşam boyu 3 deneme hakkından birini harcar. Üyelik ekranındaki deneme satırı
 * bu ekranı da sayar (bkz. premium.f.freeDeneme).
 */
export const AI_AKTARMA_ENABLED = true;

/**
 * İçtihat ARAMASI — her zaman açık, ücretsiz.
 *
 * DÜZELTİLEN HATA. İçtihat ekranının tamamı `AI_ENABLED` bayrağına bağlıydı ve
 * o bayrak kapalı olduğu için ekran "Çok Yakında" ile kapatılıyordu
 * (app/ictihat.tsx). Oysa ekranın üç kipinden yalnız BİRİ yapay zekâ kullanıyor:
 *
 *   • Kelime araması → canlı UYAP/Bedesten'e gider, AI YOK
 *   • Künye ile bul  → canlı UYAP/Bedesten'e gider, AI YOK
 *   • Olay analizi   → yapay zekâ kullanır
 *
 * Yani ürünün en güçlü ve tamamen ücretsiz özelliği, ilgisiz bir AI bayrağı
 * yüzünden kullanıcıya hiç açılmıyordu. Uç fonksiyonunda hiçbir kısıt yoktu;
 * kapı yalnızca istemcide kapalıydı. İçtihat araması artık hiçbir bayrağa
 * bağlı değil — ürün kararı gereği ücretsiz ve sınırsız.
 */

/**
 * İçtihatta OLAY ANALİZİ (yapay zekâ ile).
 *
 * AÇILDI (2026-09-11, kullanıcı kararı). Gerekçe AI_ENABLED ile aynı: ölçüm
 * hâlâ yok, ama artık istekler ücretli Claude modeline gidiyor (canlıda
 * doğrulandı) ve bu kip ürünün asıl vaadi — "AI eski emsal davayı getirsin".
 *
 * Kapalıyken yalnız bu KİP gizleniyordu; arama ve künye zaten çalışıyordu.
 * Ölçüm seti hazır: eval-ictihat 30 soru ve API HARCAMASI YOK (yalnız
 * veritabanı arama fonksiyonlarını ölçüyor) — Actions → AI Ölçümü → arama.
 */
export const AI_ICTIHAT_ANALIZ_ENABLED = true;

/**
 * Ölçülmemiş AI özellikleri: sohbet ve savaş planı. Eski AI_ENABLED bayrağının
 * yerini tutar; adı KORUNDU çünkü birçok ekranda kullanılıyor ve hepsini birden
 * değiştirmek, açılmaması gereken ekranları sessizce açma riski taşırdı.
 *
 * DİKKAT: içtihat ARTIK bu bayrağa bağlı değildir (yukarıya bakınız).
 *
 * AÇILDI (2026-09-11, kullanıcı kararı). Kapalı olma gerekçesi "ölçülmedi"ydi
 * ve o gerekçe hâlâ geçerli — bu özellikler ölçülmedi. Kararı değiştiren şey
 * başka: bugüne kadar bu ekranlar açılsaydı ÜCRETSİZ modellere düşerdi.
 * Anahtar öncesi ölçülen 11 isteğin 11'i gpt-oss/qwen/gemini'ye gitmişti ve
 * mütalaada ücretsiz modellerin kanun uydurduğu daha önce ölçülmüştü. Şimdi
 * canlıda doğrulandı ki istekler ücretli Claude modeline gidiyor (ai_istek:
 * claude-opus-5 — o doğrulama 11.09'da Opus'la yapıldı; 12.09'da model
 * Sonnet 5'e indirildi, sağlayıcı aynı kaldı). Yani risk aynı değil.
 *
 * YİNE DE KAYDA GEÇSİN: "ölçülmedi" ile "iyi çalışıyor" aynı şey değildir.
 * Sohbet ve savaş planı için elimizde TEK bir ölçüm yok. Bu ekranların
 * çıktısı TASLAKTIR ve ekrandaki hukuki uyarı burada kozmetik değil.
 * Ölçüm: Actions → "AI Ölçümü" → grup: ai (eval-sohbet 10 senaryo).
 */
export const AI_ENABLED = true;
