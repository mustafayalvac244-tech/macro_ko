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
// KURAL BASİT:
//   • TABAN = GROQ. Ücretsiz katmanlar Groq'ta çalışır; günlük tavan model
//     başına ayrı olduğu için ai-chat birden çok Groq modelini sırayla dener.
//   • ÜCRETLİ = CLAUDE SONNET 5. Pro, Elit ve AI katmanları buradadır.
//   • GEMINI YALNIZ YEDEK. Hiçbir katmanın birincil sağlayıcısı değildir;
//     yalnız Groq düştüğünde ücretsiz hattı ayakta tutar (ai-chat içinde).
//   • Claude anahtarı yoksa ücretli katman Groq'a düşer: ödeyen üye boş ekran
//     görmesin. Anahtar eklenince deploy gerekmeden Claude'a geçer.

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
  /** GÜNLÜK istek hakkı. Ücretsiz sağlayıcının günlük tavanı TÜM kullanıcılar
   *  için ORTAK olduğundan, tek bir üyenin havuzu bitirmesi diğer herkesi o gün
   *  hizmetsiz bırakır. 0/undefined = günlük sınır yok (ücretli katmanda
   *  kontör zaten sınırdır). */
  gunluk?: number;
}

export interface KatmanSecenek {
  groqModel: string;
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
 * Asıl sınır artık kontör: kullanıcı ne kadar yüklediyse o kadar harcar. Buradaki
 * TL tavanı bir GÜVENLİK AĞI: bir hata (sonsuz döngü, bozuk istemci) kontörü
 * aşan bir harcama üretirse, aylık maliyetimiz bu değerde durur. Tavan bu yüzden
 * katmandan katmana değişmiyor; korunan şey üyenin bütçesi değil, bizim
 * faturamız.
 */
const UCRETLI_TAVAN_TRY = 3000;

export function tierConfig(
  aiTier: string | null | undefined,
  _isPremium: boolean,
  secenek: KatmanSecenek
): { tier: string; cfg: TierCfg } {
  const { groqModel, claudeModel, claudeAnahtariVar } = secenek;
  const t = aiTier || 'baslangic';

  // Ücretli katmanların tek farkı çıktı tavanı: mütalaa uzun, sohbet kısa.
  // Model hepsinde aynı — "daha çok para, daha iyi model" demiyoruz; daha çok
  // para, daha çok kullanım demek. Aksi hâlde ucuz katmandaki avukata bilerek
  // kötü cevap vermiş oluruz.
  const claude = (maxOut: number): TierCfg => ({
    provider: 'claude',
    model: claudeModel,
    billable: true,
    limitKind: 'cost',
    limit: UCRETLI_TAVAN_TRY,
    maxOut,
  });

  const table: Record<string, TierCfg> = {
    // TABAN — Groq, ücretsiz. Günlük hak, ortak havuzu tek üyenin bitirmesini
    // engeller; aylık çağrı sınırı ikinci koruma.
    free: { provider: 'groq', model: groqModel, billable: false, limitKind: 'calls', limit: 20, maxOut: 1024, gunluk: 5 },
    // maxOut 1024 dilekçe taslağını ortasından kesiyordu (ölçüldü); 2048 tam
    // bir taslağa yetiyor.
    baslangic: { provider: 'groq', model: groqModel, billable: false, limitKind: 'calls', limit: 500, maxOut: 2048, gunluk: 15 },
    // ÜCRETLİ — Claude Sonnet 5. maxOut, ölçülen çıktı uzunluklarına göre:
    // dilekçe ~3.000 token ve adaptif düşünme de bu tavana dahil.
    pro: claude(8192),
    elit: claude(8192),
    ai: claude(8192),
  };

  let cfg = table[t] ?? table.free;

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

  // Claude anahtarı yoksa ücretli katman ücretsiz hatta düşer: ödeyen üye boş
  // ekran görmesin. Anahtar eklenince deploy gerekmeden Claude'a döner.
  if (cfg.provider === 'claude' && !claudeAnahtariVar) {
    cfg = { ...cfg, provider: 'groq', model: groqModel, billable: false, limitKind: 'calls', limit: 4000, gunluk: 25 };
  }
  return { tier: t, cfg };
}

/** Aylık tavan aşıldı mı? */
export function overLimit(cfg: TierCfg, row: { calls: number; cost: number }): boolean {
  return cfg.limitKind === 'cost' ? row.cost >= cfg.limit : row.calls >= cfg.limit;
}
