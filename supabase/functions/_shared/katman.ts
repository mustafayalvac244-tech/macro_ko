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
//   • ÜCRETSİZ (free/baslangic) — hiç AI YOK. Yalnız YAŞAM BOYU (aylık değil)
//     DENEME_SORU_LIMIT kadar bir tat verilir (bkz. denemeLimit), o da ücretli
//     modelle — kalitesi düşük bir izlenim bırakmasın diye. Tükenince kapı kapanır.
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
   * 2.999₺/ay sabit ücrete SAYIYLA dahildir ("250 soru + 12 mütalaa"),
   * kontöre HİÇ bakmaz — avukata "bakiyeniz kadar" değil "ayda şu kadar"
   * sözü verildi. Mütalaa ayrı sayılır çünkü tek istek değil çok adımlı: tek
   * bir mütalaa, bir sohbet sorusunun 4-8 katı token tüketir.
   */
  modLimits?: { soru: number; mutalaa: number };
  /**
   * YAŞAM BOYU deneme hakkı — yalnız free/baslangic'te dolu. modLimits'ten
   * FARKI: modLimits AYLIK sıfırlanır (ai_mod_kota), bu ise BİR KEZ, hiç
   * yenilenmeden (bkz. profiles.deneme_soru_kullanildi ve
   * deneme_hakki_rezerve_et). Kontör kontrolünü de modLimits gibi atlatır —
   * ai-chat'teki kontrol koşuluna bakılırsa `billable && !modLimits &&
   * !denemeLimit` şeklindedir.
   */
  denemeLimit?: number;
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
  /** Ölçüm için sağlayıcı/model zorlama (üretimde tanımsız). */
  zorlaSaglayici?: string;
  zorlaModel?: string;
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
 * son değişiklik rakip Lexedes'in 2.990₺ planına göre), 250 soru + 12 mütalaa,
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
 *     yapıyor ve dosyası çok daha büyük; 250 soru + 12 mütalaalık paketin
 *     gerçek maliyeti HÂLÂ ÖLÇÜLMEDİ.
 *   - "En kötü senaryo ~924₺" gibi eski toplamlar Opus varsayımıyla kurulmuş
 *     TAHMİNİ hesaplardı; model değiştiği için artık geçersizler ve yenisi
 *     ölçümle kurulacak (bkz. scripts/istek.mjs > ParaButcesi, ön yoklama).
 */
const AI_SORU_LIMIT = 250;
const AI_MUTALAA_LIMIT = 12;

/**
 * Ödeme yapmamış (free/baslangic) bir kullanıcıya YAŞAM BOYU (bir kez, hiç
 * yenilenmeyen) verilen deneme sorusu sayısı. Neden Groq değil Claude: Groq'ta
 * GERÇEK bir mantık hatası ölçüldü (bkz. konuşma geçmişi — "aldı" fiilini
 * "ödedi"ye çevirmişti); bir avukatın AI özelliğiyle İLK teması bu olursa
 * ürünü bir daha denemeyebilir. 3 istek, ölçülen dilekçe boyutlarıyla
 * (₺1,07/istek) kullanıcı başına ~₺3'lük bir müşteri edinme maliyetidir.
 */
export const DENEME_SORU_LIMIT = 3;

export function tierConfig(
  aiTier: string | null | undefined,
  _isPremium: boolean,
  secenek: KatmanSecenek
): { tier: string; cfg: TierCfg } {
  const { groqModel, claudeModel, claudeAnahtariVar } = secenek;
  const t = aiTier || 'baslangic';

  const denemeCfg: TierCfg = {
    provider: 'claude',
    model: claudeModel,
    // billable:true — deneme isteklerinin GERÇEK maliyeti (ai_usage/ai_istek)
    // kaydedilsin isteriz, kendi muhasebemiz için. Kontörden düşülmeye
    // ÇALIŞILIR ama free/baslangic kullanıcının kontör bakiyesi yok/sıfır
    // olduğundan bu deneme sessizce başarısız olur (bkz. ai_kontor_dus'un
    // çağrıldığı recordUsage: "Bakiye düşülemediyse kullanıcının cevabı
    // engellenmez; kayıp bizde kalır") — yani gider bize yazılır, kullanıcıya
    // hiç fatura çıkmaz. denemeLimit alanı, aşağıdaki kontör ÖN kontrolünü
    // (index.ts: billable && !modLimits && !denemeLimit) atlatır.
    billable: true,
    limitKind: 'calls',
    limit: DENEME_SORU_LIMIT,
    maxOut: 2048,
    denemeLimit: DENEME_SORU_LIMIT,
  };

  const table: Record<string, TierCfg> = {
    free: denemeCfg,
    baslangic: denemeCfg,
    // ÜCRETLİ — tek katman, Claude Sonnet 5. maxOut, ölçülen çıktı
    // uzunluklarına göre: dilekçe ~3.000 token ve adaptif düşünme de bu
    // tavana dahil.
    ai: {
      provider: 'claude',
      model: claudeModel,
      billable: true,
      limitKind: 'cost',
      limit: UCRETLI_TAVAN_TRY,
      maxOut: 8192,
      modLimits: { soru: AI_SORU_LIMIT, mutalaa: AI_MUTALAA_LIMIT },
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
