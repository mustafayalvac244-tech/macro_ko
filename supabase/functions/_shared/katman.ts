// ÜYELİK KATMANI → SAĞLAYICI VE MODEL. Tek kaynak, testli.
// ---------------------------------------------------------------------------
// NEDEN AYRI DOSYA. Bu tablo iki uçta AYRI AYRI yazılmıştı (ai-chat ve ictihat)
// ve ikisi birbirinden ayrıldı: ai-chat'te Pro/Elit Claude'a taşınmışken,
// ictihat hâlâ Gemini'ye ve AI katmanını Groq'a yolluyordu. Yani aynı üye,
// hangi ekranı açtığına göre başka bir modelle konuşuyordu — ve bunu kimse
// fark etmiyordu, çünkü iki dosyaya birden bakan yoktu.
//
// Kopyalanan mantık, sessizce ayrışan mantıktır. Bugün tam bu sınıftan üç arıza
// çıktı (hata metni üç ekranda ayrı, Gemini yedeğinin ölü model adı, kotanın
// "yarın" sanılması). Katman kararı buradan ve yalnız buradan verilir.
//
// KURAL (fiyatlama sadeleştirildi — tek ücretli katman, "ai"):
//   • ÜCRETSİZ (ödeme yok) — HİÇ AI YOK, deneme hakkı da YOK.
//     13.09.2026'da değişti (ürün sahibi kararı): deneme hakkı ücretsiz
//     katmandan alınıp ₺399'luk "Vekil Pro" paketine taşındı.
//     GEREKÇE: 3 deneme, kullanıcı başına ~₺3'lük bir müşteri edinme
//     maliyetiydi ve hiçbir ödeme adımı görmeden dağıtılıyordu. Artık ödeme
//     yapmış ama AI paketi almamış üyeye veriliyor; yani parayı çoktan ödemiş
//     birine "AI'ı da bir dene" demek için harcanıyor. Kararı veren şey
//     ölçüm değil ürün tercihidir ve öyle yazılmalıdır.
//   • ₺399 "Vekil Pro" (is_premium = true, ai_tier ≠ 'ai') — YAŞAM BOYU
//     (aylık değil) DENEME_SORU_LIMIT kadar bir tat, o da ücretli modelle:
//     kalitesi düşük bir izlenim bırakmasın diye. Tükenince kapı kapanır.
//   • ÜCRETLİ = yalnız "ai" katmanı, CLAUDE SONNET 5 (12.09.2026'da Opus 5'ten
//     indirildi — ürün kararı, gerekçe: maliyet. Opus $5/$25, Sonnet $2/$10 per
//     MTok; ölçülmüş dilekçe boyutlarıyla (4.844 giriş + 1.573 çıkış, n=7)
//     istek başına ₺2,67 yerine ₺1,07). Pro/Elit katmanları
//     kaldırıldı (canlıda hiçbir kullanıcı bu tier'larda değildi — doğrulandı;
//     hiçbir IAP ürünü onlara satılmıyordu, ölü koddu).
//   • GROQ artık kullanıcıya hiç YÖNLENDİRİLMEZ — yalnız Claude çağrısı
//     BAŞARISIZ olursa devreye giren bir ALT YAPI YEDEĞİDİR (bkz. ai-chat
//     içindeki ucretliChat → ucretsizChat düşüşü). Bu dosyadaki hiçbir
//     TierCfg artık provider:'groq' döndürmez; Groq'un varlığı ai-chat'in
//     kendi hata-kurtarma zincirinde saklı kalır.
//   • Claude anahtarı yoksa "ai" katmanı da Groq'a düşer: ödeyen üye boş ekran
//     görmesin. Anahtar eklenince deploy gerekmeden Claude'a geçer.
//
// MODELİ DEĞİŞTİRMEK TEK ENV: VEKIL_CLAUDE_MODEL (varsayılan claude-sonnet-5).
// Opus'a dönmek istenirse bu değişkene claude-opus-5 yazmak yeter; deploy
// gerekmez. Ayrı bir "opus modeli" alanı BİLEREK kaldırıldı — iki alan varken
// hangisinin gerçekten kullanıldığı kod okunmadan anlaşılmıyordu.

export type Saglayici = 'groq' | 'gemini' | 'claude' | 'openai';

export interface TierCfg {
  provider: Saglayici;
  model: string;
  /** Maliyet hesaplanıp kontörden düşülecek mi? Ücretsiz katmanda false. */
  billable: boolean;
  /** Aylık tavan neyle ölçülür: çağrı sayısı mı, TL mi? */
  limitKind: 'calls' | 'cost';
  limit: number;
  maxOut: number;
  /** GÜNLÜK istek hakkı. 0/undefined = günlük sınır yok. Artık yalnız Claude
   *  anahtarı eksikken düşülen Groq yedek yolunda kullanılıyor. */
  gunluk?: number;
  /**
   * AYLIK SORU/MÜTALAA KOTASI — yalnız "ai" katmanında dolu. "ai" katmanı
   * 2.999₺/ay sabit ücrete SAYIYLA dahildir ("750 soru + 25 mütalaa"),
   * kontöre HİÇ bakmaz — avukata "bakiyeniz kadar" değil "ayda şu kadar"
   * sözü verildi. Mütalaa ayrı sayılır çünkü tek istek değil çok adımlı: tek
   * bir mütalaa, bir sohbet sorusunun 4-8 katı token tüketir.
   */
  modLimits?: { soru: number; mutalaa: number };
  /**
   * TAŞMA — aylık kota bitince kapıyı kapatmak yerine daha ucuz modele geç.
   *
   * Eskiden kota dolunca istek 402 ile REDDEDİLİYORDU: ödeme yapan bir avukat
   * ayın 20'sinde "hakkınız bitti" duvarına çarpıyor ve ayın kalanında ürünü
   * hiç kullanamıyordu. Ödediği ay boyunca kapalı kalan bir araç, bir daha
   * yenilenmeyen bir aboneliktir.
   *
   * ekLimit: taşmada verilen EK istek sayısı. Sınırsız DEĞİL — sınırsız ucuz
   * model de sınırsız maliyettir. Bittiğinde yine 402 döner.
   */
  tasma?: { model: string; ekLimit: number };
  /**
   * YAŞAM BOYU deneme hakkı — yalnız free/baslangic'te dolu. modLimits'ten
   * FARKI: modLimits AYLIK sıfırlanır (ai_mod_kota), bu ise BİR KEZ, hiç
   * yenilenmeden (bkz. profiles.deneme_soru_kullanildi ve
   * deneme_hakki_rezerve_et). Kontör kontrolünü de modLimits gibi atlatır —
   * ai-chat'teki kontrol koşuluna bakılırsa `billable && !modLimits &&
   * !denemeLimit` şeklindedir.
   */
  denemeLimit?: number;
  /**
   * AI TAMAMEN KAPALI — ödeme yapmamış kullanıcı.
   *
   * NEDEN AYRI BİR ALAN, "limit: 0" DEĞİL. Sıfır limitle reddetmek, uçlarda
   * "kotan bitti" (402) yoluna düşerdi ve kullanıcıya YANLIŞ sebep söylenirdi:
   * beklerse yenilenecek sanır, oysa beklemekle açılmaz. Ayrı alan, ayrı hata
   * kodu ve ayrı cümle demek — "bu özellik pakette yok, şu pakette var".
   */
  aiKapali?: true;
}

export interface KatmanSecenek {
  groqModel: string;
  /**
   * "ai" katmanının ve deneme hakkının kullandığı ücretli model.
   * VEKIL_CLAUDE_MODEL env'inden gelir; varsayılan claude-sonnet-5.
   */
  claudeModel: string;
  /** ANTHROPIC_API_KEY tanımlı mı? Değilse ücretli katman Groq'a düşer. */
  claudeAnahtariVar: boolean;
  /**
   * İSTENEN İŞ TÜRÜ — model buna göre seçilir (bkz. MOD_UCUZ).
   * `body.mode`'dan gelir: 'sohbet' | 'dilekce' | 'mutalaa' | 'belge' | 'kunye'.
   * Verilmezse güçlü model kullanılır — yani unutmak KALİTE tarafına düşer,
   * ucuz tarafa değil.
   */
  mod?: string;
  /** Ölçüm için sağlayıcı/model zorlama (üretimde tanımsız). */
  zorlaSaglayici?: string;
  zorlaModel?: string;
}

/**
 * İŞE GÖRE MODEL — ürün sahibi kararı, 16.09.2026.
 *
 * "Basit şeyleri Haiku'ya yaptıracağız. Avukata 'vay be çok iyi yapay zeka'
 * dedirtecek yerde Sonnet kullanırız."
 *
 * ÖNCEKİ TASARIMIN ARIZASI. Yönlendirme İŞE değil SIRAYA göreydi: ilk 750
 * istek güçlü modelle, sonrası Haiku. Bunun anlamı şuydu — çok çalışan
 * avukatın **751. dilekçesi** Haiku'ya düşüyordu. Yani sistem, en çok kullanan
 * kullanıcının EN ÖNEMLİ çıktısını düşürüyordu. İşe göre yönlendirme bunu da
 * düzeltiyor: dilekçe ve mütalaa sıradan bağımsız olarak güçlü modelde kalır.
 *
 * ÖLÇÜM (canlı `ai_istek`, 16.09.2026 — n=16, KÜÇÜK ama fark yapısal):
 *
 *   mod       ort.girdi  ort.çıktı   Haiku    Sonnet   ne iş
 *   kunye         2.282       169   ₺0,13    ₺0,26   sınıflandırma
 *   sohbet        5.473       426   ₺0,32    ₺0,64   kısa cevap
 *   dilekce       4.842     1.771   ₺0,58    ₺1,15   MAHKEMEYE GİDEN BELGE
 *   mutalaa      21.055     3.216   ₺1,56    ₺3,12   en yüksek bahis
 *
 * Ayrım kalite değil GÖRÜNÜRLÜK ve BAHİS üzerinden: künye bir sınıflandırma
 * işidir, çıktısı 169 token ve kullanıcı onu bir form alanı olarak görür.
 * Dilekçe ise avukatın okuyup imzaladığı, mahkemeye sunduğu metindir.
 *
 * BELGE BİLEREK GÜÇLÜ TARAFTA. Ölçümde `belge` modunda hiç satır yoktu, yani
 * hangi tarafa ait olduğu BİLİNMİYOR. Bilinmeyeni ucuz tarafa koymak, ucuzluğu
 * varsayım üzerine kurmak olurdu; bilinmeyen güçlü tarafta durur ve ölçüldükten
 * sonra taşınır.
 *
 * ÖLÇÜLMEDİ — DÜRÜSTLÜK PAYI: Haiku'nun bu iki modda YETERLİ olduğu
 * ölçülmedi. Sistem istemi bütün modellere aynı gidiyor (uydurma yasağı,
 * kapsam kilidi, kimlik kilidi) ama küçük modellerin talimat izleme gücü
 * genelde daha düşüktür. Tablo ölçümle düzeltilecek; bugünkü hâli bir
 * BAŞLANGIÇ, bir sonuç değil.
 */
// 03.10.2026 — SOHBET UCUZ TARAFTAN ÇIKTI (ürün sahibi: "2999'da emin olalım,
// memnuniyet şart"). 2.999 ₺ ödeyen üyenin sohbeti Haiku'ya gidiyordu; ücretsiz
// deneme ise Sonnet'teydi — yani ödeyen, denemeden daha zayıf model alıyordu.
// Sözleşme de "ilk 750 istek en yetenekli modelle" diyordu; sohbette bu doğru
// değildi. Künye bir form doldurma sınıflandırması, kullanıcı metin olarak
// görmüyor: ucuz tarafta kaldı.
const MOD_UCUZ: readonly string[] = ['kunye'];

/**
 * AĞIR İŞ — OPUS (03.10.2026, ürün sahibi: "dilekçe, mütalaa Opus olsun ama
 * saçmalamasın"). Avukatın mahkemeye sunduğu ya da müvekkile verdiği metin
 * en güçlü modelde; sohbet ve belge Sonnet'te kalır. Yalnız 'ai' katmanında:
 * ücretsiz ve ₺399 denemesi Sonnet'te (maliyet; ürün sahibi "para harcama").
 *
 * "Saçmalamasın" için modelden bağımsız denetimler zaten her çıktıda koşuyor:
 * uydurma madde/tutar, karar atfı havuz denetimi, çakışan dayanak, işçilik
 * uyarıları, kusurlu çıktıda hak düşülmemesi. Opus'ta uyarlamalı düşünme
 * AÇIK (dusunme = !denemeLimit → true) ve düşünme token'ları max_tokens'a
 * DAHİL olduğundan tavan yükseltildi (AGIR_IS_MAX_OUT).
 *
 * MALİYET (hesap, ölçüm değil): Opus $5/$25, Sonnet'in 2,5 katı. Ölçülen Sonnet
 * dilekçesi ₺2,21 → Opus ≈ ₺5,5 + düşünme; mütalaa ₺3,12 → ≈ ₺7,8. Gerçek
 * değer ilk aboneden ai_istek.maliyet_try ile ölçülecek.
 */
const MOD_AGIR: readonly string[] = ['dilekce', 'mutalaa'];
export const AI_AGIR_IS_MODEL = 'claude-opus-5';
/** Ağır işte çıktı tavanı — düşünme + ~3.000 token metin. ÖLÇÜLMEDİ, tahmin. */
export const AGIR_IS_MAX_OUT = 16000;

/**
 * SOHBET HAIKU'DA (04.10.2026, ürün sahibi: "haiku'ya geçelim, test edeceğiz").
 * Avukat geri bildirimi: "yapay zekâ yavaş cevap veriyor". Bu bir DENEME
 * kararıdır ve geçmişi var: 01.10'da Haiku'dan Sonnet'e geçilmişti ("haiku
 * kötüyse sonnete geçelim"). Yalnız asistan SOHBETİ; dilekçe/mütalaa Opus'ta,
 * belge Sonnet'te kalır. Denemede de, ücretli katmanda da aynı.
 *
 * Ölçüm (03.10, 12 gerçek istek, sunucu kaydı): sohbet 24–38 sn sürüyordu,
 * bunun ~4 sn'si yazma; kalan ~20 sn modelden bağımsız arama/denetim adımları
 * (çıkarım: süre ile çıktı uzunluğunun doğrusal uydurması). Yani Haiku'nun
 * kazandıracağı süre sınırlı olabilir; sonuç ölçülerek değerlendirilecek.
 *
 * Mod adı AÇIKÇA 'sohbet' olmalı: ai-chat sohbet isteğine 'sohbet' adını
 * kendisi verir. Tanınmayan/boş mod hâlâ güçlü modele düşer (aşağıda).
 */
// Haiku 4.5 — AI_TASMA_MODEL ile aynı model (o sabit dosyada daha aşağıda tanımlı).
export const SOHBET_MODELI = 'claude-haiku-4-5-20251001';

/**
 * HER İŞ HAIKU (04.10.2026, ürün sahibi: "hepsini haiku yap, dilekçenin
 * düzeltmesini de o yapsın"). Sohbet denemesinin hemen ardından gelen karar:
 * dilekçe, mütalaa, belge, künye, düzeltme — deneme ve ücretli katmanda hepsi
 * Haiku 4.5. 03.10'daki "dilekçe+mütalaa Opus" kararının YERİNE geçer.
 * Modelden bağımsız denetimler (uydurma tarih/tutar/madde, künye canlı teyidi,
 * kusurlu çıktıda hak düşmemesi) aynen çalışır. Kalite farkı ÖLÇÜLMEDİ.
 * Geri dönmek: bu sabiti ve aşağıdaki üç `model:` satırını eski hâline almak.
 */
export const AI_MODELI = SOHBET_MODELI;
export function sohbetMi(mod: string | undefined): boolean {
  return mod === 'sohbet';
}

/** İş türüne göre model seçer. Mod bilinmiyorsa güçlü model. */
export function modModeli(mod: string | undefined, gucluModel: string, ucuzModel: string, agirModel = gucluModel): string {
  if (mod && MOD_AGIR.includes(mod)) return agirModel;
  return mod && MOD_UCUZ.includes(mod) ? ucuzModel : gucluModel;
}

/** Dilekçe/mütalaa mı (Opus + yüksek çıktı tavanı)? */
export function agirIsMi(mod: string | undefined): boolean {
  return !!mod && MOD_AGIR.includes(mod);
}

/**
 * ÜCRETLİ KATMAN TAVANI — kontör devreye girdikten sonra ne işe yarıyor?
 *
 * "ai" katmanı artık kontöre hiç bakmadığından (modLimits) bu tavan onda
 * fiilen devre dışıdır (bkz. index.ts: billable && !modLimits koşulu). Yine
 * de TierCfg alanı dolu tutulur — gelecekte kontörle ölçülen bir katman
 * eklenirse hazır bir GÜVENLİK AĞI olarak kalsın diye.
 */
const UCRETLI_TAVAN_TRY = 3000;

/**
 * "AI" KATMANI FİYATLAMASI — 2.999₺/ay (2026-09-11; 1.999 → 3.999 → 2.999,
 * son değişiklik rakip Lexedes'in 2.990₺ planına göre), 750 soru + 25 mütalaa,
 * CLAUDE SONNET 5 (12.09.2026'da Opus 5'ten indirildi; gerekçe maliyet).
 *
 * KANIT KAYNAĞI AYRIŞTIRILARAK SÖYLENİR:
 *   - Model fiyatları (Opus $5/$25, Sonnet $2/$10 per MTok) doğrulanmış
 *     kaynaktır (web arama, birden fazla kaynakta aynı rakam — Anthropic'in
 *     kendi sayfası değil).
 *   - Token sayıları (dilekçe ~4.844 giriş + 1.573 çıkış) GERÇEK ÖLÇÜMDÜR
 *     (n=7, veritabanından) ve Sonnet/Groq kullanımında ölçüldü — yani ARTIK
 *     KULLANDIĞIMIZ modelin kendi ölçümü. Bununla istek başına:
 *         Sonnet ≈ ₺1,07   ·   Opus ≈ ₺2,67   (kur 42)
 *     Bu, indirmenin gerekçesinin kendisi.
 *   - Mütalaa çarpanı (4-8x) TAHMİNDİR, ölçülmedi. Mütalaa iki model çağrısı
 *     yapıyor ve dosyası çok daha büyük; 750 soru + 25 mütalaalık paketin
 *     gerçek maliyeti HÂLÂ ÖLÇÜLMEDİ.
 *   - "En kötü senaryo ~924₺" gibi eski toplamlar Opus varsayımıyla kurulmuş
 *     TAHMİNİ hesaplardı; model değiştiği için artık geçersizler ve yenisi
 *     ölçümle kurulacak (bkz. scripts/istek.mjs > ParaButcesi, ön yoklama).
 */
/**
 * KOTA YÜKSELTİLDİ (12.09.2026): 250 → 750 soru, 12 → 25 mütalaa.
 *
 * SEBEP. 250/12 paketi OPUS varsayımıyla kurulmuştu (istek başına ₺2,67).
 * Aynı gün Sonnet'e inildi ve ölçülen birim maliyet ₺1,07 oldu — yani paket
 * bir anda gereğinden dar kaldı: kullanıcı üçte bir maliyetle aynı sayıda
 * soru soruyordu.
 *
 * HESAP (birim ₺1,07 — n=7 GERÇEK ÖLÇÜM, veritabanından; kur 42):
 *     750 soru            →  ₺802
 *     25 mütalaa (en kötü) →  ₺214   ← çarpan 8x, ÖLÇÜLMEDİ, tahmin
 *     toplam ~₺1.016 = 2.999₺ gelirin %34'ü
 * 250/12'de bu oran %12 idi. %34, ürün maliyeti olarak rahat bir aralık ve
 * UCRETLI_TAVAN_TRY (₺3.000) zaten üstte ayrı bir emniyet kilidi.
 *
 * DÜRÜSTLÜK NOTU: soru maliyeti ölçümdür, mütalaa çarpanı DEĞİLDİR. Yukarıdaki
 * toplam bu yüzden bir ölçüm değil, en kötü uçtan kurulmuş bir üst sınırdır.
 * Mütalaa gerçek maliyeti ölçülene kadar 25 rakamı temkinli tutuldu.
 */
const AI_SORU_LIMIT = 750;
const AI_MUTALAA_LIMIT = 25;

/**
 * TAŞMA MODELİ VE EK HAK — BÜTÇEYE GÖRE BOYUTLANDI.
 *
 * ÜRÜN KARARI: bir üyenin aylık kullanım hakkı, ödediği paranın YARISI
 * kadar olacak. 2.999₺'lik pakette hedef ~₺1.500 API gideri; kalan, kotayı
 * doldurmayan üyelerden gelen kâr. Kullanım bazlı her planın işleyişi budur.
 *
 * BÜTÇE DAĞILIMI (en kötü durum, yani HERKES hakkını sonuna kadar kullanırsa):
 *     750 Sonnet sorusu       ₺802   (birim ₺1,07 — ÖLÇÜM, n=7)
 *     25 mütalaa              ₺214   (çarpan 8x — TAHMİN, ölçülmedi)
 *     900 Haiku taşma isteği  ₺477   (birim ₺0,53 — fiyat doğrulandı)
 *     ───────────────────────────
 *     toplam                ₺1.493   = gelirin %50'si
 * Üyeye görünen hak: ayda 1.650 istek + 25 mütalaa.
 *
 * BU BİR ÜST SINIR, BEKLENEN GİDER DEĞİL. Ortalama kullanımı BİLMİYORUZ —
 * henüz ödeme yapan kullanıcı yok, yani ölçecek veri yok. Ortalama kullanıcı
 * kotanın onda birini kullanırsa gerçek marj %50 değil ~%95 olur. Buradaki
 * hesap "en kötü durumda bile zarar etmeyelim" içindir.
 *
 * MÜTALAA ÇARPANI HÂLÂ ÖLÇÜLMEDİ. Toplamın ₺214'ü tahmine dayanıyor; bu
 * yüzden ₺1.500 rakamı bir ölçüm değil, en kötü uçtan kurulmuş bir sınırdır.
 * Mütalaa ölçüldüğünde bu blok yeniden hesaplanmalı.
 *
 * NEDEN HAIKU, NEDEN GROQ DEĞİL. Groq ücretsiz ve zaten deneme katmanında
 * kullanılıyor, ama üzerinde GERÇEK bir mantık hatası ölçüldü (bkz.
 * DENEME_SORU_LIMIT yorumu: "aldı" fiilini "ödedi"ye çevirmişti). Ödeme
 * yapan bir avukatın ayın yarısını o kalitede geçirmesi, kapıyı kapatmaktan
 * daha kötü olabilir. Haiku aynı ailede ve hukuki Türkçede belirgin biçimde
 * daha güvenli. Fiyatı 12.09.2026'da doğrulandı ($1/$5 per MTok, birden çok
 * bağımsız kaynak).
 *
 * TAŞMA SINIRSIZ DEĞİL: sınırsız ucuz model de sınırsız maliyettir. Ek hak
 * da bitince istek yine reddedilir. UCRETLI_TAVAN_TRY (₺3.000) üstte ayrı
 * bir emniyet kilidi olarak duruyor ve bu bütçenin iki katı — yani bütçe
 * aşılsa bile tavan devreye girmeden önce fark edilir.
 */
export const AI_TASMA_MODEL = 'claude-haiku-4-5-20251001';

/**
 * ÜCRETLİ İŞİN MODELİ — SABİT (03.10.2026, ürün sahibi kararı).
 * Önceden VEKIL_CLAUDE_MODEL ortam ayarından geliyordu ve canlıdaki değeri
 * koddan okunamıyordu (11.09'da bir dilekçe Opus'a gitmişti). Ödeyen
 * müşterinin hangi modeli aldığı bir gizli ayara bağlı kalmasın.
 */
export const AI_UCRETLI_MODEL = 'claude-sonnet-5';
const AI_TASMA_EK = 900;

/**
 * ₺399'luk "Vekil Pro" üyesine YAŞAM BOYU (bir kez, hiç yenilenmeyen) verilen
 * deneme sorusu sayısı. 13.09.2026'ya kadar ÜCRETSİZ katmandaydı; ürün sahibi
 * kararıyla ödeme yapan pakete taşındı. Neden Groq değil Claude: Groq'ta
 * GERÇEK bir mantık hatası ölçüldü (bkz. konuşma geçmişi — "aldı" fiilini
 * "ödedi"ye çevirmişti); bir avukatın AI özelliğiyle İLK teması bu olursa
 * ürünü bir daha denemeyebilir. 3 istek, ölçülen dilekçe boyutlarıyla
 * (₺1,07/istek) kullanıcı başına ~₺3'lük bir müşteri edinme maliyetidir.
 */
// 3 → 10 (15.09.2026, ürün sahibi kararı). Maliyet ölçülen birim fiyattan
// hesaplandı: 10 × ₺1,07 = ₺10,70 abone başına BİR KEZ (₺3,21'di). ₺399'luk
// ilk ayın %2,7'si. Yaşam boyu olduğu için aylık tekrar etmez.
// Sayaç `profiles.deneme_soru_kullanildi`'de duruyor ve sıfırlanmıyor: 3
// hakkını bitirmiş mevcut üyeler bu değişiklikle 7 hak daha alır.
export const DENEME_SORU_LIMIT = 10;

/**
 * ÜCRETSİZ KATMANA 5 DENEME SORUSU — 28.09.2026, ürün sahibi kararı:
 * "Herkese 5 deneme soru hakkı vereceğiz, Haiku'dan cevaplayacak."
 *
 * 13.09'daki "ücretsizde yapay zekâ yok" kararının yerine geçer. Aynı yaşam
 * boyu sayaç (`profiles.deneme_soru_kullanildi`) kullanılır: ücretsiz
 * kullanıcı 5'i bitirip Vekil Pro'ya geçerse toplam 10'a tamamlanır.
 * Derin araştırma (mütalaa) bu hakka dahil DEĞİL — ai-chat onu yalnız 'ai'
 * katmanına açıyor.
 *
 * MODEL: SONNET (01.10.2026, ürün sahibi: "haiku kötüyse sonnete geçelim").
 * Önce Haiku'ydu (AI_TASMA_MODEL). Ölçülen Haiku maliyeti soru başı ₺0,36–0,39
 * (iki gerçek istek, ~8,3 bin girdi token). Haiku'nun kalitesi ÖLÇÜLMEDİ —
 * tek bir cevapta kira artışı kuralını hakkaniyet kuralıyla karıştırdığı
 * görüldü. Geçiş gerekçesi ₺399 denemesindekiyle aynı: kullanıcının yapay
 * zekâyla İLK teması, dönüşüm anı. Sonnet fiyatı Haiku'nun 2 katı ($2/$10
 * vs $1/$5 MTok, platform.claude.com/pricing 28.09 okundu) → soru başı
 * TAHMİN ≈ ₺0,8 (ölçülmedi; yeni tokenizer ve uyarlamalı düşünme artırabilir).
 */
// 03.10.2026: 5 → 10 (ürün sahibi; avukat geri bildirimi: "dilekçe yazarken 5 soru az").
export const UCRETSIZ_DENEME_LIMIT = 10;
export const UCRETSIZ_DENEME_MODEL = 'claude-sonnet-5';

export function tierConfig(
  aiTier: string | null | undefined,
  isPremium: boolean,
  secenek: KatmanSecenek
): { tier: string; cfg: TierCfg } {
  const { groqModel, claudeModel, claudeAnahtariVar } = secenek;
  const t = aiTier || 'baslangic';

  const denemeCfg: TierCfg = {
    provider: 'claude',
    // DENEME İŞE GÖRE YÖNLENDİRİLMEZ — BİLEREK. `ai` katmanı sohbet/künyeyi
    // Haiku'ya yollar; deneme YOLLAMAZ, her modda güçlü modelde kalır.
    //
    // Sebep: bu 10 istek, ödeme yapmış bir avukatın yapay zekâyla İLK teması
    // ve dönüşüm anıdır. Fark ₺11,50 yerine ~₺8 — yani ₺3,50. Bir aboneliğin
    // dönüşümünü ₺3,50 için riske atmak kötü bir takas olurdu. Aynı gerekçe
    // denemenin Groq yerine Claude'da koşmasının da sebebi (yukarıda).
    // 04.10.2026 İSTİSNA: sohbet Haiku'ya gider (SOHBET_MODELI, yukarıda).
    model: AI_MODELI,
    // billable:true — deneme isteklerinin GERÇEK maliyeti (ai_usage/ai_istek)
    // kaydedilsin isteriz, kendi muhasebemiz için. KONTÖRDEN DÜŞÜLMEZ:
    // recordUsage `deneme` bayrağıyla ücreti sıfırlar (ai-chat, 01.10.2026).
    // Bu yorumun eski hâli "bakiye sıfır, düşüm sessizce başarısız olur"
    // diyordu — CANLIDA YANLIŞ ÇIKTI: ai_kontor_dus bakiyeyi eksiye indiriyor
    // (test hesabı -1,07 TL, ürün sahibinin hesabı 11.09'dan -8,38 TL).
    // denemeLimit alanı, aşağıdaki kontör ÖN kontrolünü
    // (index.ts: billable && !modLimits && !denemeLimit) atlatır.
    billable: true,
    limitKind: 'calls',
    limit: DENEME_SORU_LIMIT,
    maxOut: 2048,
    denemeLimit: DENEME_SORU_LIMIT,
  };

  /**
   * Ödeme yapmamış kullanıcı: AI kapalı.
   *
   * Alanlar yine de doldurulmuş, çünkü tip bunu istiyor ve bir gün bu dal
   * yanlışlıkla çağrılırsa EN UCUZ yolda kalsın — ama `aiKapali` yüzünden
   * uçlar buraya hiç gelmeden isteği reddediyor.
   */
  const kapaliCfg: TierCfg = {
    provider: 'groq',
    model: groqModel,
    billable: false,
    limitKind: 'calls',
    limit: 0,
    maxOut: 512,
    aiKapali: true,
  };

  // ÜCRETSİZ İLE ₺399'U AYIRAN ŞEY is_premium.
  // Bu parametre bugüne kadar KULLANILMIYORDU (adı `_isPremium` idi): ödeme
  // yapan ₺399 üyesi ile hiç ödemeyen kullanıcı aynı deneme hakkını
  // alıyordu. Artık deneme hakkı yalnız ödeyene veriliyor.
  const ucretsizDenemeCfg: TierCfg = {
    ...denemeCfg,
    // SABİT Sonnet — claudeModel DEĞİL: o VEKIL_CLAUDE_MODEL ortamıyla değişir
    // (11.09'da ₺399 denemesi claude-opus-5'e gitmişti; Opus ≈ Haiku'nun 5
    // katı). Herkese açık ücretsiz denemenin maliyeti ortam ayarına bağlı
    // kalmasın. Bkz. UCRETSIZ_DENEME_LIMIT.
    model: AI_MODELI,
    limit: UCRETSIZ_DENEME_LIMIT,
    denemeLimit: UCRETSIZ_DENEME_LIMIT,
  };
  // kapaliCfg artık yalnız bir güvenlik ağı: hiçbir katman onu seçmiyor.
  void kapaliCfg;
  const odemesizVeyaDeneme: TierCfg = isPremium ? denemeCfg : ucretsizDenemeCfg;

  const table: Record<string, TierCfg> = {
    free: odemesizVeyaDeneme,
    baslangic: odemesizVeyaDeneme,
    // ÜCRETLİ — tek katman, Claude Sonnet 5. maxOut, ölçülen çıktı
    // uzunluklarına göre: dilekçe ~3.000 token ve adaptif düşünme de bu
    // tavana dahil.
    ai: {
      provider: 'claude',
      // İŞE GÖRE MODEL (bkz. MOD_UCUZ / MOD_AGIR). Künye Haiku; sohbet ve belge
      // Sonnet 5; dilekçe ve mütalaa Opus 5 — ilk 750 istek boyunca.
      model: AI_MODELI,
      billable: true,
      limitKind: 'cost',
      limit: UCRETLI_TAVAN_TRY,
      maxOut: agirIsMi(secenek.mod) ? AGIR_IS_MAX_OUT : 8192,
      modLimits: { soru: AI_SORU_LIMIT, mutalaa: AI_MUTALAA_LIMIT },
      tasma: { model: AI_TASMA_MODEL, ekLimit: AI_TASMA_EK },
    },
  };

  let cfg = table[t] ?? table.baslangic;

  // ÖLÇÜM İÇİN ZORLAMA. Hangi modelin daha iyi yazdığı itibara göre değil
  // ÖLÇÜLEREK seçilmeli. Üretimde tanımsızdır.
  const zs = secenek.zorlaSaglayici;
  if (zs === 'claude' || zs === 'gemini' || zs === 'groq' || zs === 'openai') {
    return {
      tier: t,
      cfg: {
        ...cfg,
        provider: zs,
        model: secenek.zorlaModel || cfg.model,
        // Zorlanan model ücretliyse maliyet yine sayılsın; ölçüm yaparken
        // faturayı gözden kaçırmak kolaydır.
        billable: zs !== 'groq',
      },
    };
  }

  // Claude anahtarı yoksa ücretli/deneme katmanı Groq'a düşer: ödeyen üye ya
  // da deneme hakkını kullanan aday boş ekran görmesin. Anahtar eklenince
  // deploy gerekmeden Claude'a döner. Groq'a düşünce kontör/deneme/modLimits
  // hiçbiri ANLAMLI değildir (ücretsiz sağlayıcı) — hepsi temizlenir.
  if (cfg.provider === 'claude' && !claudeAnahtariVar) {
    cfg = {
      provider: 'groq',
      model: groqModel,
      billable: false,
      limitKind: 'calls',
      limit: 4000,
      maxOut: cfg.maxOut,
      gunluk: 25,
    };
  }
  return { tier: t, cfg };
}

/** Aylık tavan aşıldı mı? */
export function overLimit(cfg: TierCfg, row: { calls: number; cost: number }): boolean {
  return cfg.limitKind === 'cost' ? row.cost >= cfg.limit : row.calls >= cfg.limit;
}

/**
 * AYLIK KOTA REZERVASYONU — taşma dahil.
 *
 * İKİ AŞAMALI VE BİLEREK ÖYLE. Önce normal kotadan ister; dolmuşsa taşma
 * tavanından (normal + ek) bir kez daha ister. İkinci çağrı sayacı yine
 * artırır, yalnız daha yüksek bir tavana bakar — yani taşmada kaç istek
 * kullanıldığı ayrı bir sütuna gerek kalmadan sayacın kendisinden okunur.
 *
 * NEDEN MIGRATION YOK. Sayacın yeni değerini döndürmek için RPC'nin dönüş
 * tipini boolean'dan integer'a çevirmek gerekirdi; bu, CREATE OR REPLACE ile
 * yapılamaz (önce DROP gerekir) ve DROP yetkileri düşürür. İkinci bir çağrı,
 * yalnızca kota dolduğunda ve kullanıcı başına ayda bir kez yaşanır — bu
 * maliyet, canlı bir fonksiyonu düşürüp yeniden kurmaktan ucuzdur.
 *
 * Çağıran taraf dönen `model` ile isteği yapar: taşmadaysa ucuz model.
 */
export type RezerveSonuc =
  | { ok: true; tasmada: boolean; model: string }
  | { ok: false; sebep: 'soru' | 'mutalaa'; hak: number };

export async function kotaRezerve(
  cfg: TierCfg,
  mutalaaMi: boolean,
  cagir: (soruLimit: number, mutalaaLimit: number) => Promise<boolean>
): Promise<RezerveSonuc> {
  if (!cfg.modLimits) return { ok: true, tasmada: false, model: cfg.model };
  const { soru, mutalaa } = cfg.modLimits;

  if (await cagir(soru, mutalaa)) return { ok: true, tasmada: false, model: cfg.model };

  if (cfg.tasma) {
    // Yalnız İSTENEN türün tavanı yükseltilir; diğeri olduğu gibi kalır ki
    // soru taşması yanlışlıkla mütalaa hakkı açmasın.
    const s2 = mutalaaMi ? soru : soru + cfg.tasma.ekLimit;
    const m2 = mutalaaMi ? mutalaa + Math.ceil(cfg.tasma.ekLimit / 30) : mutalaa;
    if (await cagir(s2, m2)) return { ok: true, tasmada: true, model: cfg.tasma.model };
  }

  return mutalaaMi
    ? { ok: false, sebep: 'mutalaa', hak: mutalaa }
    : { ok: false, sebep: 'soru', hak: soru };
}
