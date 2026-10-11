// Vekil :: içtihat (case-law) retrieval + grounded AI summary.
//
// Kaynak: UYAP Emsal Karar (emsal.uyap.gov.tr) — Yargıtay, Danıştay, Bölge
// Adliye/İdare Mahkemesi kararlarının kamuya açık resmi bankası. Mahkeme
// kararları kamusal kayıttır; burada yalnızca arama/getirme yapıyoruz.
//
// Anahtarsız mimari: kullanıcı hiçbir şey girmez, giriş yapmış olması yeter.
// Gemini anahtarı sunucuda secret olarak durur (yalnızca "summarize" için).
//
// Deploy:
//   supabase functions deploy ictihat
//   (GEMINI_API_KEY zaten ai-chat için tanımlı; summarize onu kullanır)
import { createClient } from 'npm:@supabase/supabase-js@2';
import Anthropic from 'npm:@anthropic-ai/sdk@0.124.0';
import { claudeIle } from '../_shared/claudeIstemci.ts';
import { dusunmeAyari } from '../_shared/claudeModel.ts';
import { kotaRezerve, overLimit, tierConfig as ortakKatman } from '../_shared/katman.ts';
// Dönem anahtarları ortak: bu uç günlük sayacı hiç bilmiyordu ve içtihat
// ekranından yapılan AI çağrıları günlük haktan düşmüyordu (bkz. _shared/kullanim.ts).
import { aiGun, aiPeriod } from '../_shared/kullanim.ts';
// Fiyat tablosu ortak: burada yalnız iki eski Gemini satırı kalmıştı ve
// bilinmeyen her modeli gemini-2.5-pro fiyatından sayıyordu.
import { costTry, faturaGirdi } from '../_shared/fiyat.ts';
import { rizaKapisi } from '../_shared/kvkkRiza.ts';
import { basarisizsaIadeEt, type HakRezervasyonu, type IadeIslemleri } from '../_shared/hakIadesi.ts';
// Saf mantık ayrı dosyada ve testli (tests/ictihatArama.test.ts): künyeyi
// ezmeyen arşiv yükü, kesme işareti, Türkiye günü, akıllı sayfa, künye
// "bulunamadı" kuralı, hata yanıtı.
import {
  akilliIlkSayfa,
  arsivSatiri,
  bedestenTarihi,
  IstekSiniri,
  kaynakArizasiMi,
  kesmeTemizle,
  kunyeYokDenemez,
  ucHataYaniti,
} from '../_shared/ictihatArama.ts';
import { DevreKesici } from '../_shared/dayaniklilik.ts';
// CORS başlıkları ORTAK dosyadan geliyor — bkz. _shared/cors.ts.
// Burada elle yazılmaları, altı uçta `x-client-info` başlığının izin
// listesinden düşmesine ve tarayıcıda tam arızaya yol açmıştı.
import { CORS } from '../_shared/cors.ts';

const EMSAL_BASE = 'https://emsal.uyap.gov.tr';
// MODEL_BASIC / MODEL_PLUS KALDIRILDI: katman tablosu ortak dosyaya taşınınca
// ikisi de okunmaz oldu. Okunmayan yapılandırma anahtarı zararsız değildir —
// sonraki okuyucu onların hâlâ etkili olduğunu sanar ve yanlış yerde ayar arar.

// ── AI MALİYET ÖLÇÜMÜ + KATMAN TAVANI (batma koruması) ──────────────────────
// Her AI çağrısının token maliyeti hesaplanıp ai_usage'a yazılır; çağrıdan önce
// kullanıcının bu-ay maliyeti katman tavanını aşmışsa çağrı engellenir.
// KATMAN TABLOSU BURADA DEĞİL: _shared/katman.ts.
//
// Burada kendi kopyası vardı ve ai-chat'teki asıl tablodan AYRILMIŞTI: orada
// Pro/Elit Claude'a taşınmışken burası hâlâ Gemini'ye, AI katmanını da Groq'a
// yolluyordu. Aynı üye, hangi ekranı açtığına göre başka bir modelle
// konuşuyordu ve bunu kimse fark etmiyordu — iki dosyaya birden bakan yoktu.
//
// İÇTİHAT AI'Sİ ARTIK CLAUDE KONUŞUYOR. Eskiden burada "şimdilik Groq'ta"
// notu vardı: Claude/OpenAI seçilen katman AÇIKÇA Groq'a düşürülüyordu, çünkü
// llmCall yalnız Groq ve Gemini konuşuyordu. Görünürlüğü yalnız bu yorumdaydı;
// kullanıcı görmüyordu. Sonuç: 1.999₺ ödeyen "ai" katmanı üyesi, ürünün asıl
// vaadi olan "olaya uygun emsal karar" analizini ÜCRETSİZ modelden alıyordu —
// ve bu, 2026-09-11'de tsc'nin yakaladığı bir tip hatasıyla ortaya çıktı
// (ortakKatman'a claudeOpusModel hiç verilmiyordu; canlıda undefined'dı —
// o alan 12.09.2026'da tamamen kaldırıldı, artık tek alan claudeModel).
//
// Üç şey birden düzeltildi, çünkü Opus'u açmak tek başına yetmezdi:
//   1) llmCall'a Claude dalı (JSON modu için response_format yok; metinden
//      ayıklanıyor, bkz. jsonAyikla).
//   2) SORU/DENEME HAKKI SAYILIYOR. Bu uç ai_mod_rezerve_et'i hiç çağırmıyordu;
//      Opus'a açınca içtihat ekranı, aylık 250 soru sözünün DIŞINDA sınırsız
//      Opus çağrısı olurdu. Şimdi analiz ve özet, ai-chat'teki soru kotasından
//      düşüyor; deneme katmanında yaşam boyu 3 haktan.
//   3) ai_istek SATIRI YAZILIYOR. Bu uç yalnız ai_usage yazıyordu; içtihat
//      Opus harcaması ne harcama özetinde ne iade mekanizmasında görünüyordu.
//
// HENÜZ ÖLÇÜLMEDİ: Opus'un içtihat analizinin kalitesi. Bu değişiklik modeli
// değiştirir; "daha iyi" demek için ölçüm gerekir (eval-ictihat yalnız
// aramayı ölçüyor, AI analizini ölçen bir set yok).

// Sağlayıcıya göre anahtar.
function aiKey(provider: Provider): string | undefined {
  if (provider === 'claude') return Deno.env.get('ANTHROPIC_API_KEY') ?? undefined;
  return provider === 'groq' ? (Deno.env.get('GROQ_API_KEY') ?? undefined) : (Deno.env.get('GEMINI_API_KEY') ?? undefined);
}
async function usageRow(userId: string, period: string = aiPeriod()): Promise<{ calls: number; cost: number }> {
  const s = svc();
  if (!s) return { calls: 0, cost: 0 };
  const { data } = await s.from('ai_usage').select('calls,cost_try').eq('user_id', userId).eq('period', period).maybeSingle();
  const r = data as { calls?: number; cost_try?: number } | null;
  return { calls: Number(r?.calls ?? 0), cost: Number(r?.cost_try ?? 0) };
}
/** Tavan aşıldı mı? (billable→TL, ücretsiz→çağrı sayısı) */
async function recordUsage(userId: string, model: string, tin: number, tout: number, billable: boolean, mod = 'ictihat'): Promise<void> {
  const s = svc();
  if (!s) return;
  const cost = billable ? costTry(model, tin, tout) : 0; // ücretsiz katman: maliyet 0
  const p = aiPeriod();
  const { data } = await s.from('ai_usage').select('calls,tokens_in,tokens_out,cost_try').eq('user_id', userId).eq('period', p).maybeSingle();
  const prev = data as { calls?: number; tokens_in?: number; tokens_out?: number; cost_try?: number } | null;
  await s.from('ai_usage').upsert({
    user_id: userId,
    period: p,
    calls: (prev?.calls ?? 0) + 1,
    tokens_in: (prev?.tokens_in ?? 0) + tin,
    tokens_out: (prev?.tokens_out ?? 0) + tout,
    cost_try: Number(prev?.cost_try ?? 0) + cost,
    updated_at: new Date().toISOString(),
  }, { onConflict: 'user_id,period' });

  // GÜNLÜK SATIR. Bu uç günlük sayacı hiç yazmıyordu: kullanıcı içtihat
  // ekranından ortak Groq kotasını yakabiliyor, günlük hakkı hiç azalmıyordu.
  // Sınır, sınırlaması gereken şeyi sınırlamıyordu.
  const g = aiGun();
  const { data: gv } = await s.from('ai_usage').select('calls,tokens_in,tokens_out,cost_try').eq('user_id', userId).eq('period', g).maybeSingle();
  const gp = gv as { calls?: number; tokens_in?: number; tokens_out?: number; cost_try?: number } | null;
  await s.from('ai_usage').upsert({
    user_id: userId,
    period: g,
    calls: (gp?.calls ?? 0) + 1,
    tokens_in: (gp?.tokens_in ?? 0) + tin,
    tokens_out: (gp?.tokens_out ?? 0) + tout,
    cost_try: Number(gp?.cost_try ?? 0) + cost,
    updated_at: new Date().toISOString(),
  }, { onConflict: 'user_id,period' });

  // İSTEK SATIRI — bu uç bunu HİÇ yazmıyordu. Soru metni saklanmaz; yalnız
  // ölçü bilgileri. Yoksa içtihat ekranından yapılan Opus çağrıları harcama
  // özetinde (ai_harcama_ozeti) görünmez ve iade edilemez.
  try {
    await s.from('ai_istek').insert({
      user_id: userId, gun: g, mod, model, tokens_in: tin, tokens_out: tout, maliyet_try: cost, musteriye_yazildi: true,
    });
  } catch {
    // Kayıt tutulamadıysa cevap yine verilir; yalnız iade edilemez.
  }
}

type KatmanCfg = ReturnType<typeof tierConfig>['cfg'];

/**
 * İçtihat AI çağrısı için HAK REZERVE EDER — ai-chat'teki kapının aynısı.
 *
 * "ai" katmanı: aylık soru kotasından (ai_mod_rezerve_et, mütalaa değil).
 * Deneme katmanı: yaşam boyu deneme hakkından (deneme_hakki_rezerve_et).
 * Servis istemcisi kurulamadıysa AÇIK KAPI BIRAKMAYIZ: kota doğrulanamıyorsa
 * reddetmek, "belki fazladan izin ver"den güvenlidir.
 *
 * @returns reddedildiyse 402 yanıtı, geçtiyse null
 */
async function hakRezerve(
  cfg: KatmanCfg,
  tier: string,
  userId: string
): Promise<{ red: Response } | { model: string }> {
  // AI PAKETTE YOK — ödeme yapmamış kullanıcı (bkz. _shared/katman.ts).
  // ai-chat'teki kapının aynısı ve aynı sebeple deneme rezervasyonundan önce.
  if (cfg.aiKapali) {
    return { red: json({ error: 'tier_required', tier, required: 'premium' }, 403) };
  }
  const s = svc();
  if (cfg.denemeLimit) {
    const r = s ? (await s.rpc('deneme_hakki_rezerve_et', { p_user: userId, p_limit: cfg.denemeLimit })).data : false;
    if (!r) return { red: json({ error: 'deneme_hakki_bitti', tier, hak: cfg.denemeLimit }, 402) };
  }
  // KOTA BİTİNCE KAPI KAPANMIYOR, UCUZ MODELE DÜŞÜYOR (bkz. katman.ts > tasma).
  // Ödeme yapan avukatın ayın ortasında duvara çarpması, yenilenmeyen bir
  // aboneliğin en kısa yoludur. Taşma da sınırsız değildir.
  const rez = await kotaRezerve(cfg, false, async (soruLimit, mutalaaLimit) => {
    if (!s) return false;
    return Boolean((await s.rpc('ai_mod_rezerve_et', {
      p_user: userId, p_ay: aiPeriod(), p_mutalaa: false,
      p_soru_limit: soruLimit, p_mutalaa_limit: mutalaaLimit,
    })).data);
  });
  if (!rez.ok) return { red: json({ error: 'ai_soru_kota_bitti', tier, hak: rez.hak }, 402) };
  return { model: rez.model };
}

/**
 * hakRezerve'in ayırdığını kayda geçirir (_shared/hakIadesi.ts biçimi):
 * deneme katmanı deneme hakkından, AI paketi aylık soru kotasından.
 */
function rezervasyonKaydi(cfg: KatmanCfg, userId: string): HakRezervasyonu {
  return {
    userId,
    deneme: !!cfg.denemeLimit,
    mod: cfg.modLimits ? { ay: aiPeriod(), mutalaa: false } : null,
  };
}

/** İade işlemleri; hata YUTULUR — iade düşse de kullanıcının yanıtı değişmez. */
function iadeIslemleri(): IadeIslemleri {
  return {
    deneme: async (userId) => {
      const s = svc();
      if (!s) return;
      try { await s.rpc('deneme_hakki_serbest_birak', { p_user: userId }); } catch { /* kayıp bizde */ }
    },
    mod: async (userId, ay, mutalaa) => {
      const s = svc();
      if (!s) return;
      try { await s.rpc('ai_mod_serbest_birak', { p_user: userId, p_ay: ay, p_mutalaa: mutalaa }); } catch { /* kayıp bizde */ }
    },
  };
}

/** Çağrı ARIZAYLA bittiyse rezerve edilen hakkı geri verir; hata yutulur. */
async function hakSerbestBirak(cfg: KatmanCfg, userId: string): Promise<void> {
  const s = svc();
  if (!s) return;
  try {
    if (cfg.denemeLimit) await s.rpc('deneme_hakki_serbest_birak', { p_user: userId });
    if (cfg.modLimits) await s.rpc('ai_mod_serbest_birak', { p_user: userId, p_ay: aiPeriod(), p_mutalaa: false });
  } catch {
    // geri verme başarısız olsa da kullanıcıya hata göstermeyiz; kayıp bizde kalır
  }
}

type Meter = { tin: number; tout: number };

/** ai-chat'teki kullanimOzeti ile aynı biçim: { model, girdiToken, ciktiToken, maliyetTL }. */
function kullanimOzeti(model: string, m: Meter, billable: boolean) {
  const maliyet = billable ? costTry(model, m.tin, m.tout) : 0;
  return { model, girdiToken: m.tin, ciktiToken: m.tout, maliyetTL: Math.round(maliyet * 100) / 100 };
}
// deno-lint-ignore no-explicit-any
function meterAdd(m: Meter, j: any): void {
  m.tin += j?.usageMetadata?.promptTokenCount ?? 0;
  m.tout += j?.usageMetadata?.candidatesTokenCount ?? 0;
}

// Sağlayıcı-genel LLM çağrısı: ücretsiz katman Groq (OpenAI uyumlu), Pro/Elit Gemini.
// Groq llama-3.3-70b-versatile'ı 17.06.2026'da kaldırdı; halef gpt-oss-120b.
const GROQ_MODEL = Deno.env.get('VEKIL_GROQ_MODEL') || 'openai/gpt-oss-120b';
// Model adları ai-chat ile AYNI env değişkenlerinden: iki uç ayrışırsa aynı
// üye ekrana göre başka modelle konuşur ve kimse fark etmez (bu bir kez oldu).
const CLAUDE_MODEL = Deno.env.get('VEKIL_CLAUDE_MODEL') || 'claude-sonnet-5';
type Provider = 'gemini' | 'groq' | 'claude';

/**
 * Ortak katman tablosunu bu ucun konuşabildiği sağlayıcılara indirger.
 * Claude artık doğrudan konuşuluyor; yalnız OpenAI seçilirse Groq'a düşer
 * (bu uçta OpenAI istemcisi yok). Claude anahtarı yoksa ortak tablo zaten
 * Groq'a düşürüyor (katman.ts: claudeAnahtariVar).
 */
function tierConfig(aiTier: string | null | undefined, isPremium: boolean) {
  const { tier, cfg } = ortakKatman(aiTier, isPremium, {
    groqModel: GROQ_MODEL,
    claudeModel: CLAUDE_MODEL,
    claudeAnahtariVar: !!Deno.env.get('ANTHROPIC_API_KEY'),
  });
  if (cfg.provider === 'openai') {
    return {
      tier,
      cfg: { ...cfg, provider: 'groq' as Provider, model: GROQ_MODEL, billable: false, limitKind: 'calls' as const, limit: 4000 },
    };
  }
  return { tier, cfg: { ...cfg, provider: cfg.provider as Provider } };
}

/**
 * Metnin içinden ilk JSON nesnesini ayıklar.
 *
 * Claude'da response_format yok; "yalnız JSON yaz" dense de bazen kod
 * bloğu ya da bir cümle ekliyor. JSON.parse doğrudan çağrılırsa bu, planın
 * sessizce boşa düşmesi demek (geminiPlan'daki catch {issue:'', queries:[]}).
 * Groq/Gemini çıktısına da zararsız: zaten saf JSON'sa aynen döner.
 */
function jsonAyikla(metin: string): string {
  const t = metin.replace(/```(?:json)?/gi, '').trim();
  const bas = t.indexOf('{');
  const son = t.lastIndexOf('}');
  return bas >= 0 && son > bas ? t.slice(bas, son + 1) : t;
}
async function llmCall(
  provider: Provider,
  apiKey: string,
  model: string,
  system: string,
  userText: string,
  opts: { json?: boolean; maxTokens: number; temperature: number },
  meter?: Meter
): Promise<string> {
  if (!apiKey) throw new Error('not_configured');
  if (provider === 'claude') {
    try {
      const res = await claudeIle(apiKey, (client) => client.messages.create({
        model,
        // DÜŞÜNME TAVANA DAHİL. Adaptif düşünme açıkken düşünme token'ları da
        // max_tokens'tan düşer; 400'lük bir tavan yalnız düşünmeye gidip metin
        // boş dönebilir. Kısa JSON plan çağrısında düşünme KAPALI ve sıcaklık
        // geçerli; metin üreten çağrılarda düşünme açık, tavana pay ekleniyor
        // ve sıcaklık GÖNDERİLMİYOR (düşünme açıkken API reddeder).
        max_tokens: opts.json ? opts.maxTokens : opts.maxTokens + 6000,
        // Haiku 4.5 uyarlamalı düşünmeyi reddeder (400) — bkz. _shared/claudeModel.ts.
        // JSON çağrısı: düşünme kapalı + sıcaklık (Sonnet/Opus 5'te düşünme varsayılan açık;
        // açıkken sıcaklık reddedilir). Metin çağrısı: düşünme açık.
        ...(opts.json ? { temperature: opts.temperature, ...dusunmeAyari(model, false) } : dusunmeAyari(model, true)),
        system: opts.json ? `${system} YALNIZ geçerli bir JSON nesnesi döndür; kod bloğu, açıklama, başlık yazma.` : system,
        messages: [{ role: 'user', content: userText }],
      }));
      if (res.stop_reason === 'refusal') throw new Error('refusal');
      const text = (res.content as Array<{ type: string; text?: string }>)
        .filter((b) => b.type === 'text')
        .map((b) => b.text ?? '')
        .join('');
      if (meter) {
        const u = res.usage;
        // Önbellek fiyatıyla (03.10.2026, bkz. _shared/fiyat.ts > faturaGirdi).
        meter.tin += faturaGirdi(u.input_tokens ?? 0, u.cache_read_input_tokens ?? 0, u.cache_creation_input_tokens ?? 0);
        meter.tout += u.output_tokens ?? 0;
      }
      return opts.json ? jsonAyikla(text) : text;
    } catch (e) {
      if (e instanceof Anthropic.RateLimitError) throw new Error('rate_limit');
      if (e instanceof Anthropic.AuthenticationError) throw new Error('not_configured');
      if ((e as Error).message === 'refusal') throw e;
      // GERÇEK MESAJ TAŞINIR. İlk sürüm her şeyi 'upstream'e indirgiyordu ve
      // ilk canlı yoklamada tam bu oldu: 3 saniyede 502, sebebi görünmez.
      // Mesaj yanıtın 'detail' alanında dışarı çıkar (anahtar içermez; SDK
      // hata mesajları durum kodu + API metnidir).
      const hata = new Error('upstream') as Error & { ayrinti?: string };
      hata.ayrinti = `claude: ${(e as Error)?.message ?? String(e)}`.slice(0, 300);
      throw hata;
    }
  }
  // AĞ HATASI DA 'upstream'. fetch'in kendi hatası (TypeError) etiketsiz
  // yukarı çıkınca dış catch onu "UYAP yanıt vermiyor" diye bildiriyor ve
  // MESAJINI yanıtın 'detail' alanına koyuyordu. Deno'nun ağ hatası mesajı
  // istek URL'sini içerir; Gemini URL'sinde anahtar (?key=) var. Bu yüzden
  // mesaj TAŞINMAZ, yalnız hatanın türü.
  const agHatasi = (e: unknown): never => {
    const hata = new Error('upstream') as Error & { ayrinti?: string };
    hata.ayrinti = `${provider}: ağ hatası (${(e as Error)?.name ?? 'bilinmiyor'})`;
    throw hata;
  };
  if (provider === 'groq') {
    const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: GROQ_MODEL,
        messages: [{ role: 'system', content: system }, { role: 'user', content: userText }],
        temperature: opts.temperature,
        max_tokens: opts.maxTokens,
        ...(opts.json ? { response_format: { type: 'json_object' } } : {}),
      }),
    }).catch(agHatasi);
    if (!res.ok) throw new Error(res.status === 429 ? 'rate_limit' : 'upstream');
    const j = await res.json();
    if (meter) { meter.tin += j.usage?.prompt_tokens ?? 0; meter.tout += j.usage?.completion_tokens ?? 0; }
    return j.choices?.[0]?.message?.content ?? '';
  }
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: system }] },
        contents: [{ role: 'user', parts: [{ text: userText }] }],
        generationConfig: { temperature: opts.temperature, maxOutputTokens: opts.maxTokens, ...(opts.json ? { responseMimeType: 'application/json' } : {}) },
      }),
    }
  ).catch(agHatasi);
  if (!res.ok) throw new Error(res.status === 429 ? 'rate_limit' : 'upstream');
  const j = await res.json();
  if (meter) meterAdd(meter, j);
  return j.candidates?.[0]?.content?.parts?.map((p: { text?: string }) => p.text ?? '').join('') ?? '';
}


const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });

/** UYAP getDokuman HTML'ini düz metne çevirir (Gemini'ye ve önizlemeye uygun). */
function htmlToText(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

interface Hit {
  id: string;
  daire: string;
  esasNo: string;
  kararNo: string;
  kararTarihi: string;
  durum: string;
  /** Aranan kelimenin karar metnindeki geçtiği yerden kısa önizleme. */
  snippet?: string;
  /** Kararın kaynağı: UYAP Emsal (varsayılan) veya Yargıtay Karar Arama. */
  src?: 'emsal' | 'yargitay';
  /** Künye detayı: tespit edilen karar sonucu (Bozma/Onama/…). */
  outcome?: string;
  /** Künye detayı: kararın hüküm/sonuç bölümünden kısa alıntı. */
  sonuc?: string;
  /** Künye detayı: incelenen (alt derece) mahkeme bilgisi. */
  incelenen?: string;
  /** Aranan ifade kararın metninde birebir geçiyor mu (arama motoru bazen
   *  ilgili/köke yakın kararlar da döndürüyor). undefined=önizleme çekilmedi. */
  matched?: boolean;
}

/**
 * Karar metninden kural-tabanlı (AI'sız) hızlı analiz: operatif sonuç
 * (Bozma/Onama/…), hüküm bölümü alıntısı ve incelenen alt derece mahkeme.
 * Sonuç tespiti kararın SON kısmından (hüküm fıkrası) yapılır — metnin
 * ortasındaki geçişlerden etkilenmez.
 */
function analyzeDecision(text: string): { outcome?: string; sonuc?: string; incelenen?: string } {
  if (!text) return {};
  const clean = text.replace(/\s+/g, ' ').trim();
  const low = clean.toLocaleLowerCase('tr');

  // Hüküm/sonuç bölümü: son "sonuç" işaretinden itibaren, yoksa son 380 karakter.
  const mk = low.lastIndexOf('sonuç');
  const rawSonuc = mk >= 0 ? clean.slice(mk, mk + 420) : clean.slice(-380);
  const sonuc = rawSonuc ? (mk > 0 ? '' : '…') + rawSonuc.trim() + '…' : undefined;

  // Operatif sonucu kararın son bölümünden (hüküm fıkrası) tespit et.
  const tail = low.slice(-1200);
  const has = (s: string) => tail.includes(s);
  let outcome: string | undefined;
  if (has('düzeltilerek onan')) outcome = 'Düzeltilerek Onama';
  else if (has('kısmen') && (has('bozulmasına') || has('bozulması'))) outcome = 'Kısmen Bozma';
  else if (has('bozulmasına') || has('bozulması')) outcome = 'Bozma';
  else if (has('onanmasına') || has('onanmasi') || has('onanması') || has('onandığ')) outcome = 'Onama';
  else if (has('kaldırılmasına')) outcome = 'Kaldırma (istinaf)';
  else if (has('esastan') && has('reddine')) outcome = 'İstinaf Başvurusu Reddi';
  else if (has('kabulüne')) outcome = 'Kabul';
  else if (has('reddine')) outcome = 'Ret';

  // İncelenen alt derece mahkeme (varsa).
  let incelenen: string | undefined;
  const im = clean.match(/İNCELENEN KARARIN MAHKEMESİ\s*:?\s*([^\n]{3,80}?)(?:\s{2,}|TARİHİ|NUMARASI|SAYISI|$)/i);
  if (im) incelenen = im[1].trim();

  return { outcome, sonuc, incelenen };
}

/** Türkçe küçük harf + şapkalı harf katlaması (â→a, î→i, û→u). Uzunluk korunur,
 *  böylece katlanmış metindeki indeks orijinal metinde aynı yeri gösterir. */
function foldTr(s: string): string {
  return s.toLocaleLowerCase('tr').replace(/â/g, 'a').replace(/î/g, 'i').replace(/û/g, 'u');
}

/** Aranan ifadenin (veya 3+ harfli kelimelerinden birinin) metinde geçtiği ilk
 *  konumu döndürür; hiç geçmiyorsa -1. */
function findTermIndex(foldedText: string, query: string): number {
  const terms = [query.trim(), ...query.trim().split(/\s+/).filter((w) => w.length >= 3)]
    .map(foldTr)
    .filter(Boolean);
  for (const term of terms) {
    const i = foldedText.indexOf(term);
    if (i >= 0) return i;
  }
  return -1;
}

/**
 * Aranan kelimenin karar metninde geçtiği yerden kısa bir önizleme çıkarır
 * (LEGALBANK/Lexpera tarzı) — avukat kararı açmadan konuyla ilgisini görsün.
 * Eşleşme bulunamazsa kararın giriş kısmından bir özet döner.
 */
function buildSnippet(text: string, query: string): string {
  if (!text) return '';
  const clean = text.replace(/\s+/g, ' ').trim();
  const idx = findTermIndex(foldTr(clean), query);
  const MAX = 240;
  if (idx < 0) {
    return clean.slice(0, MAX).trim() + (clean.length > MAX ? '…' : '');
  }
  const start = Math.max(0, idx - 90);
  const end = Math.min(clean.length, idx + 150);
  return (start > 0 ? '…' : '') + clean.slice(start, end).trim() + (end < clean.length ? '…' : '');
}

/** Aranan ifade metinde birebir (şapka-katlamalı) geçiyor mu? */
function textHasTerm(text: string, query: string): boolean {
  return findTermIndex(foldTr(text.replace(/\s+/g, ' ')), query) >= 0;
}

/**
 * Canlı UYAP sonuçlarına önizleme ekler: ilk `limit` kararın metnini paralel
 * çekip aranan kelimenin çevresinden kesit çıkarır. Metni çekilemeyen karar
 * sessizce önizlemesiz kalır (arama yine de sonuç döndürür).
 */
async function attachSnippets(hits: Hit[], query: string, limit = 10): Promise<void> {
  const targets = hits.slice(0, limit).filter((h) => !h.snippet && h.id);
  await Promise.all(
    targets.map(async (h) => {
      try {
        const text = await fetchDocText(h.id, h.src);
        h.snippet = buildSnippet(text, query);
        h.matched = textHasTerm(text, query);
        // Tam metni bizde kalıcı arşivle — UYAP çökse de bu karar bizde kalır.
        await archiveDecision(h, text);
      } catch {
        // önizleme alınamadı → geç
      }
    }),
  );
}

/**
 * KAYNAK ÇAĞRILARINA DEVRE KESİCİ (UYAP Emsal ve Bedesten ayrı ayrı).
 *
 * NEDEN. Kaynak çökünce her arama 10 sn'lik zaman aşımını sonuna kadar
 * bekliyor (akıllı kipte iki arama + ilk sayfadaki her karar için belge
 * isteği), kullanıcı hatayı çok geç görüyor ve ölü kaynağa yük bindirmeye
 * devam ediyorduk. Üst üste 3 arızadan sonra 60 sn boyunca istek HİÇ
 * denenmez ('source_unreachable', arama arşive düşer); sonra tek yoklama.
 * Eşik ve süre varsayılan (_shared/dayaniklilik.ts), bu kaynaklar için
 * ÖLÇÜLMEDİ.
 *
 * Yalnız kaynağın ÇÖKTÜĞÜNÜ gösteren hatalar sayılır (kaynakArizasiMi);
 * 404 gibi cevaplar kaynağın sağlam olduğunu gösterir. Devre bellekte ve
 * edge örneğine özeldir (bkz. _shared/uyapCanli.ts'te aynı gerekçe).
 */
const emsalDevre = new DevreKesici();
const bedestenDevre = new DevreKesici();

async function devreIle<T>(devre: DevreKesici, is: () => Promise<T>): Promise<T> {
  if (!devre.gecebilirMi()) throw new Error('source_unreachable');
  try {
    const sonuc = await is();
    devre.basarili();
    return sonuc;
  } catch (e) {
    // Sayılmayan hata kaynağın CEVAP verdiğini gösterir: devreyi sağlam say.
    // (Yoklama hakkını harcayıp ne başarılı ne başarısız dersek devre
    // sonsuza dek "yarım açık"ta kalır.)
    if (kaynakArizasiMi(e)) devre.basarisiz();
    else devre.basarili();
    throw e;
  }
}

/** fetch'in kendi hatası (ağ, zaman aşımı) → kaynak arızası. Mesaj taşınmaz. */
const agKopar = (): never => {
  throw new Error('source_unreachable');
};

async function emsalSearch(query: string, page: number, pageSize: number): Promise<{ hits: Hit[]; total: number }> {
  return devreIle(emsalDevre, async () => {
    const res = await fetch(`${EMSAL_BASE}/aramalist`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        'User-Agent': 'Mozilla/5.0',
        'X-Requested-With': 'XMLHttpRequest',
        Referer: `${EMSAL_BASE}/`,
      },
      body: JSON.stringify({ data: { arananKelime: query, pageSize, pageNumber: page } }),
      // ZAMAN AŞIMI YOKTU. Bedesten çağrılarında 10 sn sınır var, Emsal'de
      // hiç yoktu: takılan bir UYAP isteği işlevi platform sınırına kadar
      // bekletiyordu. Aynı sınır (10 sn) burada da; ölçülmüş değil, Bedesten
      // çağrılarıyla tutarlılık için.
      signal: AbortSignal.timeout(10000),
    }).catch(agKopar);
    if (!res.ok) throw new Error(`emsal_search_${res.status}`);
    const j = await res.json();
    // UYAP Solr çökünce HTTP 200 döner ama recordsTotal gelmez ve liste boştur;
    // bunu gerçek "0 sonuç"tan (recordsTotal=0) ayırıp kaynak arızası olarak yükselt.
    const recTotal = j?.data?.recordsTotal;
    const metaErr = (j?.metadata?.FMTY === 'ERROR');
    if (metaErr || (recTotal == null && (j?.data?.data?.length ?? 0) === 0)) {
      throw new Error('source_unreachable');
    }
    const rows = j?.data?.data ?? [];
    const hits: Hit[] = rows.map((r: Record<string, unknown>) => ({
      id: String(r.id ?? ''),
      daire: String(r.daire ?? ''),
      esasNo: String(r.esasNo ?? ''),
      kararNo: String(r.kararNo ?? ''),
      kararTarihi: String(r.kararTarihi ?? ''),
      durum: String(r.durum ?? ''),
    }));
    return { hits, total: Number(j?.data?.recordsTotal ?? hits.length) };
  });
}

async function emsalDocument(id: string): Promise<string> {
  return devreIle(emsalDevre, async () => {
    const res = await fetch(`${EMSAL_BASE}/getDokuman?id=${encodeURIComponent(id)}`, {
      headers: { Accept: 'application/json', 'User-Agent': 'Mozilla/5.0', Referer: `${EMSAL_BASE}/` },
      signal: AbortSignal.timeout(10000), // bkz. emsalSearch
    }).catch(agKopar);
    if (!res.ok) throw new Error(`emsal_doc_${res.status}`);
    const j = await res.json();
    return htmlToText(String(j?.data ?? ''));
  });
}

// ---------------------------------------------------------------------------
// Bedesten API (bedesten.adalet.gov.tr) — Adalet Bakanlığı birleşik karar
// bankası. UYAP Emsal (BAM + yerel) YARGITAY içermez; Yargıtay ve Danıştay
// kararlarına buradan erişiyoruz. Yargıtay'ın kendi sitesi (karararama) bulut
// IP'lerini engellediği için tek erişilebilir Yargıtay kaynağı budur.
// ---------------------------------------------------------------------------
const BEDESTEN_BASE = 'https://bedesten.adalet.gov.tr';
const BEDESTEN_HEADERS = {
  'Content-Type': 'application/json',
  Accept: 'application/json',
  'User-Agent': 'Mozilla/5.0',
  AdaletApplicationName: 'UyapMevzuat',
};

/** Bedesten base64 (UTF-8) içeriğini düz metne çevirir. */
function b64ToUtf8(b64: string): string {
  try {
    const bin = atob(b64);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return new TextDecoder('utf-8').decode(bytes);
  } catch {
    return b64; // zaten düz metinse olduğu gibi
  }
}

function bedestenRows(j: unknown): Hit[] {
  const list = (j as { data?: { emsalKararList?: unknown[] } })?.data?.emsalKararList ?? [];
  return (list as Record<string, unknown>[])
    .map((r): Hit => {
      const birim = String(r.birimAdi ?? '');
      const type = (r.itemType as { name?: string })?.name;
      const prefix = type === 'DANISTAYKARAR' ? 'Danıştay' : 'Yargıtay';
      // ISO'nun ilk 10 karakteri UTC günüdür: 05.03.2024 kararı
      // "2024-03-04T21:00:00Z" geliyor ve 04.03.2024 gösteriliyordu.
      const kt = bedestenTarihi(r.kararTarihiStr, r.kararTarihi);
      return {
        id: String(r.documentId ?? ''),
        daire: birim ? `${prefix} ${birim}` : prefix,
        esasNo: r.esasNoYil != null ? `${r.esasNoYil}/${r.esasNoSira}` : '',
        kararNo: r.kararNoYil != null ? `${r.kararNoYil}/${r.kararNoSira}` : '',
        kararTarihi: kt,
        durum: '',
        src: 'yargitay' as const,
      };
    })
    .filter((h) => h.id);
}

async function bedestenSearch(
  query: string,
  page: number,
  pageSize: number,
  itemType = 'YARGITAYKARARI',
  opts?: { sortByDate?: boolean },
): Promise<{ hits: Hit[]; total: number }> {
  return devreIle(bedestenDevre, async () => {
    const data: Record<string, unknown> = {
      pageSize,
      pageNumber: page,
      itemTypeList: [itemType],
      phrase: query,
    };
    // Varsayılan: alaka (relevance) sıralaması. İstenirse en yeni karar → eski.
    if (opts?.sortByDate) {
      data.sortFields = ['KARAR_TARIHI'];
      data.sortDirection = 'desc';
    }
    const res = await fetch(`${BEDESTEN_BASE}/emsal-karar/searchDocuments`, {
      method: 'POST',
      headers: BEDESTEN_HEADERS,
      body: JSON.stringify({ data }),
      signal: AbortSignal.timeout(10000),
    }).catch(agKopar);
    if (!res.ok) throw new Error(`bedesten_${res.status}`);
    const j = await res.json();
    // Bedesten HTTP 200 dönüp arka plan (UYAP Solr) çökünce metadata'da hata
    // bildiriyor; bunu "0 sonuç" sanmayıp kaynak arızası olarak yükselt.
    const meta = (j as { metadata?: { FMTY?: string; FMC?: string } })?.metadata;
    if (meta?.FMTY === 'ERROR' || (meta?.FMC ?? '').includes('EXCEPTION')) {
      throw new Error('source_unreachable');
    }
    return { hits: bedestenRows(j), total: Number((j as { data?: { total?: number } })?.data?.total ?? 0) };
  });
}

async function bedestenDocument(id: string): Promise<string> {
  return devreIle(bedestenDevre, async () => {
    const res = await fetch(`${BEDESTEN_BASE}/emsal-karar/getDocumentContent`, {
      method: 'POST',
      headers: BEDESTEN_HEADERS,
      body: JSON.stringify({ data: { documentId: id } }),
      signal: AbortSignal.timeout(10000),
    }).catch(agKopar);
    if (!res.ok) throw new Error(`bedesten_doc_${res.status}`);
    const j = await res.json();
    const data = (j as { data?: { content?: string; mimeType?: string } })?.data;
    const mime = String(data?.mimeType ?? '');
    // Taranmış (PDF/görüntü) kararların metni yok — düz metin sözü vermeyelim.
    if (mime && !mime.includes('html') && !mime.includes('text')) return '';
    return htmlToText(b64ToUtf8(String(data?.content ?? '')));
  });
}

/** Kaynağa göre karar tam metnini getirir. */
async function fetchDocText(id: string, src?: 'emsal' | 'yargitay'): Promise<string> {
  return src === 'yargitay' ? await bedestenDocument(id) : await emsalDocument(id);
}

// ---------------------------------------------------------------------------
// KALICI ARŞİV — çekilen kararları kendi veritabanımıza (ictihat_kararlar)
// yazarız; böylece UYAP çökse bile daha önce görülen kararlar bizde kalır ve
// arşivden sunulur. Servis anahtarı (service_role) ile yazılır.
// ---------------------------------------------------------------------------
let _svc: ReturnType<typeof createClient> | null = null;
function svc(): ReturnType<typeof createClient> | null {
  if (_svc) return _svc;
  const url = Deno.env.get('SUPABASE_URL');
  const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (url && key) _svc = createClient(url, key);
  return _svc;
}

/**
 * DİSK EMNİYET FRENİ — ARŞİVLEME İÇİN.
 *
 * BULUNAN DELİK. 0084'te disk freni kondu ama yalnız CRON yollarını koruyordu
 * (hasat_tetikle, vektorle_tetikle). Oysa arşive yazan ikinci bir yol daha var
 * ve o KULLANICI ARAMASIYLA tetikleniyor: her arama, canlı UYAP'tan çekilen
 * kararları buraya upsert ediyor. Yani fren, büyümenin kullanıcı tarafından
 * tetiklenen kısmını hiç kapsamıyordu.
 *
 * ÖLÇÜM (bu delik bulunurken): birkaç test aramam iki dakika içinde 52 karar
 * ekledi (~1,7 MB). Veritabanı 500 MB sınırının 423 MB'ında; sınır aşılırsa
 * proje SALT-OKUNUR olur ve hiçbir avukat dava/duruşma kaydedemez.
 *
 * ÇÖZÜM: eşik aşıldıysa arşivleme atlanır. ARAMA ÇALIŞMAYA DEVAM EDER —
 * sonuçlar zaten canlı UYAP'tan geliyor; kaybedilen tek şey önbelleğe alma.
 * Sonuç 5 dakika bellekte tutulur ki her arama için ek bir sorgu atılmasın.
 */
let _diskOk: { deger: boolean; zaman: number } | null = null;
async function diskMusaitMi(): Promise<boolean> {
  const now = Date.now();
  if (_diskOk && now - _diskOk.zaman < 5 * 60_000) return _diskOk.deger;
  const db = svc();
  if (!db) return false;
  try {
    const { data, error } = await db.rpc('disk_musait_mi');
    const deger = !error && data === true;
    _diskOk = { deger, zaman: now };
    return deger;
  } catch {
    // Ölçemiyorsak arşivlemeyi ATLARIZ: emin olmadan yazmak, dolu diske
    // yazmaya devam etmek demektir ve sonucu salt-okunur moddur.
    _diskOk = { deger: false, zaman: now };
    return false;
  }
}

/**
 * Bir kararı tam metniyle arşive yaz (idempotent upsert). En iyi çaba; hata yutulur.
 *
 * İKİ KURAL (09.10.2026):
 *  - Yük `arsivSatiri` ile kurulur: boş künye alanı yüke GİRMEZ. Belge yolu
 *    kararı künyesiz arşivliyordu ve upsert, havuzda dolu duran künyeyi
 *    null'a eziyordu.
 *  - KULLANICININ ARAMA METNİ YAZILMAZ. Eskiden `arama_terimi`ne sorgunun
 *    ilk 120 karakteri gidiyordu; avukat müvekkil adı ya da olay yazabilir ve
 *    bu, kalıcı karar havuzuna düşerdi (müvekkil sırrı). Sütunu yalnız hasat
 *    işleri doldurur (sabit konu listesinden).
 */
async function archiveDecision(h: Hit, fullText: string): Promise<void> {
  const db = svc();
  if (!db || !h.id || !fullText || fullText.length < 200) return; // taranmış/boş atla
  if (!(await diskMusaitMi())) return; // disk sınıra yakın: arşivleme, arama sürsün
  try {
    await db.from('ictihat_kararlar').upsert(arsivSatiri(h, fullText, ''), { onConflict: 'id' });
  } catch {
    // arşivleme en iyi çabadır; başarısız olsa da kullanıcı akışını bozmaz
  }
}

/** "E.2019/3641", "2019 / 3641", "2019-3641" → "2019/3641"; geçersizse ''. */
function normalizeKunyeNo(raw: string): string {
  const m = (raw ?? '').match(/(\d{4})\s*[/\-.]\s*(\d{1,6})/);
  return m ? `${m[1]}/${m[2]}` : '';
}

/** Havuz RPC satırını uygulama Hit şekline çevirir. */
// deno-lint-ignore no-explicit-any
function rowToHit(r: any): Hit {
  return {
    id: String(r.id ?? ''),
    daire: String(r.daire ?? ''),
    esasNo: String(r.esas_no ?? ''),
    kararNo: String(r.karar_no ?? ''),
    kararTarihi: String(r.karar_tarihi ?? ''),
    durum: String(r.durum ?? ''),
  };
}

async function geminiSummary(query: string, docs: Array<{ hit: Hit; text: string }>, provider: Provider, model: string, apiKey: string, meter?: Meter): Promise<string> {
  if (!apiKey) throw new Error('not_configured');

  // Her kararın metnini token için sınırlayıp kaynak etiketiyle veriyoruz;
  // Gemini yalnızca bu gerçek kararlara atıf yapacak.
  const corpus = docs
    .map((d, i) => {
      const label = `[${i + 1}] ${d.hit.daire} — E.${d.hit.esasNo} K.${d.hit.kararNo} (${d.hit.kararTarihi})`;
      return `${label}\n${d.text.slice(0, 6000)}`;
    })
    .join('\n\n----\n\n');

  const system =
    'Sen Vekil Pro asistanısın. Sana verilen GERÇEK mahkeme kararlarını ' +
    'kullanarak avukatın sorusunu yanıtla. YALNIZCA verilen kararlardaki bilgilere dayan; ' +
    'karar metinlerinde olmayan hiçbir içtihat, madde veya sonuç UYDURMA. Atıf yaparken ' +
    'kararı [1], [2] gibi numaralarıyla ve daire + esas/karar no ile belirt. Kısa, mesleki ' +
    'Türkçe yaz. Sonuna, bunun hukuki tavsiye olmadığını ve kararların güncelliğinin teyit ' +
    'edilmesi gerektiğini ekle.';

  const text = await llmCall(
    provider, apiKey, model, system,
    `SORU: ${query}\n\nİLGİLİ KARARLAR:\n\n${corpus}`,
    { maxTokens: 1400, temperature: 0.3 }, meter
  );
  if (!text) throw new Error('empty');
  return text.trim();
}

/**
 * OLAY ANALİZİ — 1. adım: avukatın anlattığı olaydan, UYAP Emsal'de içtihat
 * aramak için en isabetli Türkçe arama terimlerini ve hukuki nitelendirmeyi üretir.
 */
async function geminiPlan(olay: string, provider: Provider, model: string, apiKey: string, meter?: Meter): Promise<{ issue: string; queries: string[] }> {
  if (!apiKey) throw new Error('not_configured');

  const system =
    'Sen Türk hukukunda uzman bir asistansın. Avukatın anlattığı somut olayı hukuken nitelendir ve ' +
    'UYAP Emsal içtihat bankasında ARAMA yapmak için en isabetli 3 Türkçe arama terimi üret. ' +
    'Terimler kısa olsun (2-5 kelime), dava türü/kurum/kavram içersin (ör. "gerçek olmayan ihtiyaç tahliye"). ' +
    'SADECE şu JSON formatında yanıt ver: {"issue":"kısa hukuki nitelendirme","queries":["terim1","terim2","terim3"]}';

  const raw = await llmCall(
    provider, apiKey, model, system,
    `OLAY:\n${olay.slice(0, 4000)}`,
    { json: true, maxTokens: 400, temperature: 0.2 }, meter
  );
  try {
    const parsed = JSON.parse(raw);
    const queries = Array.isArray(parsed.queries) ? parsed.queries.map((q: unknown) => String(q)).filter(Boolean).slice(0, 3) : [];
    return { issue: String(parsed.issue ?? ''), queries };
  } catch {
    return { issue: '', queries: [] };
  }
}

/**
 * OLAY ANALİZİ — son adım: olaya göre hukuki değerlendirme + çözüm önerisi yazar
 * ve verilen GERÇEK kararlardan olaya en uygun olanları kaynak göstererek işaret eder.
 */
async function geminiAnalyze(
  olay: string,
  issue: string,
  docs: Array<{ hit: Hit; text: string }>,
  provider: Provider,
  model: string,
  apiKey: string,
  meter?: Meter
): Promise<string> {
  if (!apiKey) throw new Error('not_configured');

  const corpus = docs
    .map((d, i) => {
      const label = `[${i + 1}] ${d.hit.daire} — E.${d.hit.esasNo} K.${d.hit.kararNo} (${d.hit.kararTarihi})`;
      return `${label}\n${d.text.slice(0, 4500)}`;
    })
    .join('\n\n----\n\n');

  const system =
    'Sen Vekil Pro asistanısın, Türk hukukunda uzman bir asistan. Avukatın anlattığı somut olaya göre şu ' +
    'yapıda, mesleki Türkçe bir analiz yaz:\n' +
    '1) HUKUKİ DEĞERLENDİRME: olayın hukuki nitelendirmesi, uygulanacak temel kurallar (madde no varsa belirt).\n' +
    '2) ÇÖZÜM / STRATEJİ: avukatın atması gereken adımlar, dikkat noktaları.\n' +
    '3) OLAYA UYGUN İÇTİHAT: aşağıda verilen GERÇEK kararlardan olaya en uygun olanları [1],[2] şeklinde ' +
    'atıfla ve HER BİRİ İÇİN olaya neden uyduğunu tek cümleyle açıkla.\n' +
    'YALNIZCA verilen kararlara atıf yap; listede olmayan karar/esas no UYDURMA. Uygun karar yoksa dürüstçe söyle. ' +
    'Sonuna, bunun hukuki tavsiye olmadığını ve kararların güncelliğinin teyit edilmesi gerektiğini ekle.';

  const text = await llmCall(
    provider, apiKey, model, system,
    `OLAY:\n${olay.slice(0, 4000)}\n\nÖN NİTELENDİRME: ${issue}\n\nADAY KARARLAR:\n\n${corpus}`,
    { maxTokens: 2000, temperature: 0.3 }, meter
  );
  if (!text) throw new Error('empty');
  return text.trim();
}

/**
 * Kaynağa (UYAP/Bedesten) giden eylemler için KULLANICI BAŞI sınır. Yapay
 * zekâ eylemleri (özet, analiz) zaten kotalı. 30 istek / 60 sn: ÖLÇÜLMEDİ,
 * TAHMİN — bir avukatın elle gezinmesinin çok üstünde, bir betiğin altında
 * seçildi; gerçek kullanımın dağılımı bilinmiyor. Bellekte, edge örneği
 * başına (bkz. IstekSiniri).
 */
const kaynakIstekSiniri = new IstekSiniri(30, 60_000);

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return json({ error: 'method' }, 405);

  // Yalnızca giriş yapmış Vekil kullanıcıları.
  const authHeader = req.headers.get('Authorization') ?? '';
  const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: userData, error: userErr } = await supabase.auth.getUser();
  if (userErr || !userData.user) return json({ error: 'unauthorized' }, 401);

  let body: {
    action?: 'search' | 'document' | 'summarize' | 'analyze' | 'kunye';
    query?: string;
    olay?: string;
    id?: string;
    ids?: string[];
    page?: number;
    pageSize?: number;
    /** Arama mahkeme süzgeci: 'yargitay' | 'danistay' | 'emsal'. */
    court?: 'yargitay' | 'danistay' | 'emsal';
    /** Künye araması: esas no ("2019/3641"), karar no ("2022/1689"), daire süzgeci. */
    esas?: string;
    karar?: string;
    daire?: string;
    /** document: kaynağı belirtir (emsal varsayılan). */
    src?: 'emsal' | 'yargitay';
    /** Arama modu: 'smart' (tam ifade önce), 'exact' (yalnız ardışık), 'recent' (en yeni). */
    mode?: 'smart' | 'exact' | 'recent';
  };
  try {
    body = await req.json();
  } catch {
    return json({ error: 'bad_request' }, 400);
  }

  try {
    const action = body.action ?? 'search';

    // Kaynağa giden eylemlerde kullanıcı başı sınır. 'rate_limit' yayındaki
    // istemcinin zaten tanıdığı koddur ("yoğunluk, bir dakika sonra deneyin").
    if (
      (action === 'search' || action === 'kunye' || action === 'document') &&
      !kaynakIstekSiniri.izinVer(userData.user.id)
    ) {
      return json({ error: 'rate_limit' }, 429);
    }

    if (action === 'search') {
      // KESME İŞARETİ UYAP aramasını öldürüyor (ölçüldü: 0 vs 86.985 kayıt;
      // bkz. kesmeTemizle). Temiz sorgu hem aramada hem önizleme kesitinde
      // kullanılır; "Yargıtay'ın" aramasının boş dönmesi böylece biter.
      const query = kesmeTemizle(body.query ?? '');
      if (!query) return json({ error: 'bad_request' }, 400);
      const pageSize = Math.min(20, Math.max(1, Number(body.pageSize ?? 15)));
      const page = Math.max(1, Number(body.page ?? 1));
      // HASAT TALEBİ (0162) — aranan konu hasatta öne alınsın. Yalnız ilk
      // sayfa sayılır (sayfa çevirmek yeni talep değil). Metin SAKLANMAZ;
      // ateşle-unut, aramayı bekletmez.
      if (page === 1) {
        const s = svc();
        if (s) void s.rpc('hasat_talep_kaydet', { p_metin: query, p_kaynak: 'arama' }).then(() => {}, () => {});
      }
      // Mahkeme süzgeci: 'yargitay' (Bedesten) | 'danistay' (Bedesten) | 'emsal'
      // (UYAP Emsal: BAM + yerel). Varsayılan Yargıtay — en üst mahkeme.
      const court = body.court ?? 'yargitay';

      // Yargıtay / Danıştay → Bedesten (tam sayfalama, tek kaynak).
      if (court === 'yargitay' || court === 'danistay') {
        const itemType = court === 'danistay' ? 'DANISTAYKARAR' : 'YARGITAYKARARI';
        const mode = body.mode ?? 'smart';
        // Çok kelimeli sorguda tırnak = ardışık (tam ifade) araması.
        const multiWord = query.trim().split(/\s+/).length > 1;
        try {
          let hits: Hit[];
          let total: number;
          if (mode === 'recent') {
            // EN YENİ: tarihe göre sırala (alaka değil).
            const r = await bedestenSearch(query, page, pageSize, itemType, { sortByDate: true });
            hits = r.hits;
            total = r.total;
          } else if (mode === 'exact' && multiWord) {
            // TAM İFADE: yalnız kelimelerin ardışık geçtiği kararlar.
            const r = await bedestenSearch(`"${query}"`, page, pageSize, itemType);
            hits = r.hits;
            total = r.total;
          } else if (page === 1 && multiWord) {
            // AKILLI (varsayılan): önce tam ifade (ardışık), sonra kelime bazlı;
            // "şerit değiştirme" gibi aramalarda tam ifade EN ÜSTTE çıkar.
            const [ph, kw] = await Promise.all([
              bedestenSearch(`"${query}"`, 1, pageSize, itemType).catch(() => ({ hits: [], total: 0 })),
              bedestenSearch(query, 1, pageSize, itemType),
            ]);
            // Birleşik liste pageSize'a KESİLMEZ: 2. sayfa kelime aramasının
            // 2. sayfasıdır, kesilen kelime sonuçları hiçbir sayfada
            // görünmezdi (bkz. akilliIlkSayfa). Fazladan kararlar önizleme
            // çekimini artırmasın diye aşağıda yalnız ilk pageSize'ı çekilir.
            hits = akilliIlkSayfa(ph.hits, kw.hits);
            total = kw.total || ph.total;
          } else {
            // Tek kelime ya da sayfa 2+ : düz kelime araması.
            const r = await bedestenSearch(query, page, pageSize, itemType);
            hits = r.hits;
            total = r.total;
          }
          await attachSnippets(hits, query, pageSize);
          // Aranan ifadenin metinde birebir GEÇMEDİĞİ (köke yakın) kararları
          // sona at — "recent" modunda tarih sırasını bozmamak için dokunma.
          if (mode !== 'recent') {
            hits.sort((a, b) => (a.matched === false ? 1 : 0) - (b.matched === false ? 1 : 0));
          }
          return json({ hits, total, page, source: court });
        } catch (e) {
          // Kaynak çökük → daha önce arşivlediğimiz kararlardan sun (bizde
          // kalanlar). HER hata türünde: zaman aşımı ve 5xx de buraya düşer
          // (eskiden yalnız HTTP 200 + hata üstverisi 'source_unreachable'
          // arşive bakıyordu). Arşiv sorgusu da düşerse özgün hata fırlar.
          if (page === 1) {
            try {
              const { data } = await supabase.rpc('search_ictihat_fts', { q: query, match_count: pageSize });
              const arsivHits = (data ?? []).map((r: Record<string, unknown>) => {
                const h = rowToHit(r);
                if (r.snippet) h.snippet = String(r.snippet);
                h.matched = true;
                return h;
              });
              if (arsivHits.length > 0) return json({ hits: arsivHits, total: arsivHits.length, page: 1, source: 'archive' });
            } catch {
              // arşiv de yanıt vermedi → özgün hata
            }
          }
          throw e;
        }
      }

      // TAM İFADE KİPİ EMSAL DALINDA DA ÇALIŞIR. Önceden bu dal `mode`
      // parametresine hiç bakmıyordu; kullanıcı "Tam ifade"yi seçse de düz
      // kelime araması yapılıyordu, yani düğme sessizce etkisizdi. Tırnaklı
      // sorgu UYAP Emsal'de de ardışık ifade araması yapar (künye akışı zaten
      // buna dayanıyor). "En yeni" burada UYGULANMAZ: emsalSearch bir sıralama
      // parametresi almıyor ve elimizdeki tek sayfayı tarihe göre dizmek
      // "en yeni kararlar" olmaz, kullanıcıyı yanıltırdı — o kip istemcide
      // gizleniyor.
      const emsalMode = body.mode ?? 'smart';
      const tekKelime = query.trim().split(/\s+/).length < 2;
      const emsalQuery = emsalMode === 'exact' && !tekKelime ? `"${query}"` : query;

      // Sayfa 2+ : sayfalama yalnız canlı UYAP Emsal üzerinden (havuz sayfa 1'de karışır).
      if (page > 1) {
        const live = await emsalSearch(emsalQuery, page, pageSize);
        await attachSnippets(live.hits, query);
        return json({ hits: live.hits, total: live.total, page, source: 'live' });
      }

      // 1) Kendi havuzumuz — önce semantik (embedding varsa), sonra anahtar-kelime (FTS).
      const seen = new Set<string>();
      const hits: Hit[] = [];
      const pushRows = (rows: unknown[]) => {
        for (const r of rows ?? []) {
          const h = rowToHit(r);
          if (h.id && !seen.has(h.id)) {
            // Havuzda tam metin varsa önizlemeyi bedavaya çıkar (canlı çekmeye gerek yok).
            const ft = (r as Record<string, unknown>)?.full_text;
            if (ft) h.snippet = buildSnippet(String(ft), query);
            seen.add(h.id);
            hits.push(h);
          }
        }
      };

      // ÖNCE KELİME ARAMASI, SONRA ANLAMSAL — bu sıra ölçümle belirlendi.
      //
      // Eskiden tersiydi ve kelime araması PRATİKTE HİÇ ÇALIŞMIYORDU:
      // match_ictihat_semantic'in alaka eşiği yok, en yakın komşuları
      // döndürür; yani her zaman istenen sayıda satır gelir ve "sonuç
      // yetersizse kelime aramasını da çalıştır" koşulu asla sağlanmazdı.
      // Ölçüldü: tamamen alakasız bir sorgu ("kedi maması fiyatları") bile
      // 10 sonuç ve 0,84 skorlar döndürüyor — gerçek eşleşmelerin skoru 0,89.
      // Sonuç: avukat, kelime araması hiç devreye girmeden yalnız anlamsal
      // sonuç görüyordu. Oysa gte-small İngilizce ağırlıklı ve Türkçe hukuk
      // metninde skorları birbirine yakın çıkıyor; kelime araması kanun
      // terimini birebir yakaladığı için isabeti daha yüksek.
      const { data: ftsRows } = await supabase.rpc('search_ictihat_fts', { q: query, match_count: pageSize });
      pushRows(ftsRows ?? []);

      // ANLAMSAL ARAMA BU UÇTAN KALDIRILDI (09.10.2026). Sorgu, KVKK rızası
      // alınmadan Gemini'ye (yurt dışı) gönderilip vektöre çevriliyordu; üstelik
      // Gemini text-embedding-004 768 boyutlu, havuz sütunu vector(384)
      // (canlıda ölçüldü): karşılaştırma boyut hatasıyla düşüyor, hata
      // yutuluyordu. Yani rızasız bir dış çağrı, hiçbir şey kazandırmıyordu.
      // Vektörleme zaten kapalı (0154/0155). Havuz araması kelime aramasına
      // dayanıyor; geri getirmek ürün sahibi kararı + rıza kapısı + yerel
      // (384 boyutlu) bir model gerektirir.

      // 2) Havuz yetersizse canlı UYAP Emsal'den tamamla (dedupe).
      let total = hits.length;
      let source = 'corpus';
      if (hits.length < 8) {
        try {
          const live = await emsalSearch(emsalQuery, 1, pageSize);
          pushRows(live.hits);
          total = live.total;
          source = hits.length > live.hits.length ? 'hybrid' : 'live';
        } catch (e) {
          // Havuzda bir şey varsa canlı hatayı yutup havuzu döneriz.
          if (hits.length === 0) throw e;
        }
      }

      // TAM İFADE KİPİNDE ARŞİV SATIRLARINI SÜZ.
      //
      // Canlı emsal sonuçları zaten tırnaklı sorguyla geldiği için ardışık
      // eşleşmedir. Ama KENDİ arşivimizden gelenler FTS ve anlamsal aramayla
      // seçildi; ikisi de ifadeyi ARDIŞIK aramaz. Süzmezsek "tam ifade" denen
      // listede ifadeyi hiç içermeyen kararlar kalırdı.
      //
      // Süzme yalnız SNIPPET'İ OLAN satırlara uygulanır: snippet'i olanlar tam
      // metni elimizde olan arşiv satırlarıdır. Snippet'i olmayanlar canlıdan
      // gelmiştir ve bu noktada metinleri henüz çekilmemiştir (attachSnippets
      // aşağıda çalışır) — onları metne bakarak elemek, hepsini yanlışlıkla
      // silmek olurdu.
      const ifade = query.trim().toLocaleLowerCase('tr');
      const suzulmus =
        emsalMode === 'exact' && !tekKelime
          ? hits.filter((h) => !h.snippet || h.snippet.toLocaleLowerCase('tr').includes(ifade))
          : hits;

      // Sonuç boş çıkarsa BOŞ dönülür; süzmeyi iptal edip alakasız kararları
      // göstermek "tam ifade" sözünü bozardı.
      const paged = suzulmus.slice(0, pageSize);
      // Canlı gelen (havuzda tam metni olmayan) kararlara önizleme ekle.
      await attachSnippets(paged, query);
      // total UPSTREAM değerdir, dönen satır sayısı DEĞİL. Bir ara burada
      // exact kipinde total'ı paged.length'e eşitlemiştim: ekranda "5 sonuç"
      // yazar, "daha fazla yükle" de kırılırdı. Tırnaklı sorgunun kendi toplamı
      // zaten doğru sayıdır.
      return json({ hits: paged, total, page: 1, source });
    }

    // KÜNYE İLE KARAR BULMA — karşı tarafın atıf yaptığı kararı doğrulamak,
    // sadece künyesi bilinen kararın tam metnine ulaşmak için. Tırnaklı arama +
    // sunucuda tam eşleşme süzmesi; eşleşmeyenler "atıf yapan kararlar" olur.
    if (action === 'kunye') {
      const esas = normalizeKunyeNo(body.esas ?? '');
      const karar = normalizeKunyeNo(body.karar ?? '');
      const daireFilter = (body.daire ?? '').trim().toLocaleLowerCase('tr');
      if (!esas && !karar) return json({ error: 'bad_request' }, 400);

      // Dar terimle ara (esas varsa esas): tırnaklı arama tam ifadeyi bulur.
      // Yargıtay Karar Arama Emsal taramasıyla PARALEL koşar (erişilemezse boş
      // döner) — seri beklemek toplam süreyi timeout kadar uzatıyordu.
      const term = esas || karar;
      // Yargıtay künyesini de tara (Bedesten). Erişilemezse DÜŞTÜĞÜ not edilir:
      // eskiden hata sessizce boş listeye çevriliyordu ve Emsal'de bulunmayan
      // bir Yargıtay künyesi için ekran "bu künyeyle karar bulunamadı" diyordu
      // (bkz. kunyeYokDenemez).
      let yargitayDustu = false;
      const ygPromise: Promise<Hit[]> = bedestenSearch(term, 1, 20, 'YARGITAYKARARI')
        .then((r) => r.hits)
        .catch((e) => {
          yargitayDustu = true;
          console.error('kunye: yargıtay araması düştü:', e instanceof Error ? e.message : String(e));
          return [] as Hit[];
        });
      const collected: Hit[] = [];
      const seen = new Set<string>();
      // EMSAL DÜŞERSE BEDESTEN'LE DEVAM (03.10.2026). Ölçüldü: 21:21–21:25'te
      // künye aramaları 6 kez 502 döndü; Emsal'in tek hatası tüm aramayı
      // düşürüyordu, Bedesten sonucu hiç bakılmadan çöpe gidiyordu.
      let emsalDustu = false;
      for (let p = 1; p <= 3; p++) {
        let rows: Hit[] = [];
        let total = 0;
        try {
          ({ hits: rows, total } = await emsalSearch(`"${term}"`, p, 20));
        } catch (e) {
          emsalDustu = true;
          console.error('kunye: emsal araması düştü:', e instanceof Error ? e.message : String(e));
          break;
        }
        for (const h of rows) {
          if (h.id && !seen.has(h.id)) {
            seen.add(h.id);
            collected.push(h);
          }
        }
        if (collected.length >= total || rows.length === 0) break;
      }
      for (const h of await ygPromise) {
        const key = `yg-${h.id}`;
        if (!seen.has(key)) {
          seen.add(key);
          collected.push(h);
        }
      }

      const matches = (h: Hit) =>
        (!esas || h.esasNo === esas) &&
        (!karar || h.kararNo === karar) &&
        (!daireFilter || h.daire.toLocaleLowerCase('tr').includes(daireFilter));
      const exact = collected.filter(matches);

      // TAM EŞLEŞME YOK VE KAYNAKLARDAN BİRİ DÜŞTÜYSE bu "yok" değil
      // "ulaşılamadı"dır: Yargıtay künyesi yalnız Bedesten'de, istinaf künyesi
      // yalnız Emsal'de bulunur; düşen kaynağın kapsadığı karar hiç aranmadı.
      // Karşı tarafın atfını doğrulayan avukata yanlış "bulunamadı", atfın
      // uydurma olduğunu ima eder. Hata olarak dönmek hem yayındaki hem yeni
      // istemcide "ulaşılamadı" gösterir; atıf yapan kararlar bu durumda
      // gösterilmez (eski istemci onları "bulunamadı"nın altında gösterirdi).
      if (kunyeYokDenemez(exact.length, emsalDustu, yargitayDustu)) throw new Error('source_unreachable');
      const citing = collected.filter((h) => !matches(h)).slice(0, 10);

      // Tam eşleşme: önizleme + DETAYLI ANALİZ (sonuç, hüküm alıntısı, incelenen
      // mahkeme). Atıf yapanlar: künyenin geçtiği yer (karşı taraf "cımbızla mı
      // çekmiş" oradan görülür).
      await Promise.all([
        ...exact.slice(0, 4).map(async (h) => {
          try {
            const text = await fetchDocText(h.id, h.src);
            h.snippet = buildSnippet(text, term);
            const a = analyzeDecision(text);
            h.outcome = a.outcome;
            h.sonuc = a.sonuc;
            h.incelenen = a.incelenen;
            await archiveDecision(h, text);
          } catch {
            // analiz alınamadı → geç
          }
        }),
        ...citing.slice(0, 8).map(async (h) => {
          try {
            const text = await fetchDocText(h.id, h.src);
            h.snippet = buildSnippet(text, term);
            await archiveDecision(h, text);
          } catch {
            // önizleme alınamadı → geç
          }
        }),
      ]);

      return json({ esas, karar, exact, citing });
    }

    if (action === 'document') {
      const id = (body.id ?? '').trim();
      if (!id) return json({ error: 'bad_request' }, 400);
      // ÖNCE ARŞİV (bizde kalan): hızlı ve UYAP çökse bile çalışır.
      // SERVİS istemcisiyle okunur: ictihat_kararlar'da authenticated rolünün
      // SELECT yetkisi yok (0104; canlıda has_table_privilege = false, RLS
      // politikası yetkinin yerine geçmez). Kullanıcı JWT'siyle her okuma
      // 42501 ile düşüyor, `data` null geliyor ve kod "arşivde yok" sanıp hep
      // canlı kaynağa gidiyordu — UYAP çöktüğünde arşiv hiç işe yaramıyordu.
      // Havuz herkese açık karar metnidir; kullanıcı verisi içermez.
      const arsiv = svc();
      const { data: row } = arsiv
        ? await arsiv.from('ictihat_kararlar').select('full_text').eq('id', id).maybeSingle()
        : { data: null };
      if (row?.full_text) return json({ id, text: String(row.full_text), source: 'archive' });
      // Arşivde yoksa canlı çek ve metni arşive yaz (bir dahaki sefere bizde kalsın).
      const text = body.src === 'yargitay' ? await bedestenDocument(id) : await emsalDocument(id);
      await archiveDecision({ id, daire: '', esasNo: '', kararNo: '', kararTarihi: '', durum: '', src: body.src ?? 'emsal' }, text);
      return json({ id, text });
    }

    if (action === 'summarize') {
      const query = (body.query ?? '').trim();
      const ids = (body.ids ?? []).slice(0, 4);
      if (!query || ids.length === 0) return json({ error: 'bad_request' }, 400);

      // KVKK KAPISI. Arama ve belge getirme kapının DIŞINDA (Türkiye'deki
      // kaynağa ve kendi veritabanımıza gider); özet ise kullanıcının sorgusunu
      // yurt dışındaki modele yollar. Kapı tam bu ayrımın üstünde duruyor:
      // rıza vermeyen avukat içtihat aramaya devam edebilir, yalnız yapay zekâ
      // özeti kapalı kalır.
      const rizaRed = await rizaKapisi(supabase, CORS);
      if (rizaRed) return rizaRed;

      // Önce havuzdan metin+meta (varsa), eksik kalanı canlı Emsal'den çek.
      // Servis istemcisiyle: kullanıcı JWT'si bu tabloyu okuyamaz (bkz. document).
      const arsivS = svc();
      const { data: corpusRows } = arsivS
        ? await arsivS.from('ictihat_kararlar').select('id,daire,esas_no,karar_no,karar_tarihi,durum,full_text').in('id', ids)
        : { data: null };
      // deno-lint-ignore no-explicit-any
      const corpus = new Map<string, any>((corpusRows ?? []).map((r: any) => [String(r.id), r]));

      const docs: Array<{ hit: Hit; text: string }> = [];
      for (const id of ids) {
        const c = corpus.get(id);
        if (c?.full_text) {
          docs.push({ hit: rowToHit(c), text: String(c.full_text) });
          continue;
        }
        try {
          const text = await emsalDocument(id);
          if (text) docs.push({ hit: { id, daire: '', esasNo: '', kararNo: '', kararTarihi: '', durum: '' }, text });
        } catch {
          // ulaşılamayan kararı atla
        }
      }
      if (docs.length === 0) return json({ error: 'source_unreachable' }, 502); // metin alınamadı = kaynak sorunu, yapay zekâ değil
      // Üyelik katmanı + maliyet tavanı kontrolü (batma koruması).
      // profiles PII sertleştirmesiyle authenticated'a SELECT kapalı; tier'ı
      // SERVİS anahtarıyla (RLS bypass) oku, yoksa herkes "baslangic"e düşer.
      let prof: { is_premium?: boolean; ai_tier?: string } | null = null;
      {
        const s = svc();
        if (s) {
          const r = await s.from('profiles').select('is_premium, ai_tier').eq('id', userData.user.id).maybeSingle();
          prof = r.data as { is_premium?: boolean; ai_tier?: string } | null;
        }
      }
      const { tier, cfg } = tierConfig(prof?.ai_tier, !!prof?.is_premium);
      const row = await usageRow(userData.user.id);
      if (overLimit(cfg, row)) return json({ error: 'quota_exceeded', tier, used: row.cost, calls: row.calls, ceiling: cfg.limit, limitKind: cfg.limitKind }, 402);
      // GÜNLÜK ADİL KULLANIM. Ortak Groq kotası tüm kullanıcılar için tek havuz;
      // bu uç sayacı hiç okumuyordu, yani içtihat ekranından havuz sınırsızca
      // tüketilebiliyordu.
      if (cfg.gunluk && cfg.gunluk > 0) {
        const gun = await usageRow(userData.user.id, aiGun());
        if (gun.calls >= cfg.gunluk) {
          return json({ error: 'gunluk_hak_bitti', tier, gunlukHak: cfg.gunluk, kullanilan: gun.calls }, 429);
        }
      }
      const key = aiKey(cfg.provider);
      if (!key) return json({ error: 'not_configured' }, 503);
      // SORU HAKKI — ai-chat'teki kapının aynısı; bu uç bunu hiç saymıyordu.
      const rez = await hakRezerve(cfg, tier, userData.user.id);
      if ('red' in rez) return rez.red;
      // Kota taştıysa bu istek ucuz modelle yapılır; maliyet ve yanıt künyesi
      // de o modelle kaydedilir ki muhasebe gerçeği göstersin.
      const aktifModel = rez.model;
      const meter: Meter = { tin: 0, tout: 0 };
      let summary: string;
      try {
        summary = await geminiSummary(query, docs, cfg.provider, aktifModel, key, meter);
      } catch (e) {
        // Arızada rezerve edilen hak geri verilir: avukat bizim arızamızın
        // bedelini kotasından ödemesin.
        await hakSerbestBirak(cfg, userData.user.id);
        throw e;
      }
      await recordUsage(userData.user.id, aktifModel, meter.tin, meter.tout, cfg.billable, 'ictihat-ozet');
      // 'model' ve 'kullanim' yanıtta: ölçüm, sonucun hangi modelden ve kaça
      // geldiğini bilsin (ai-chat ile aynı biçim; künye bunu toplar).
      return json({ summary, count: docs.length, tier, model: cfg.model, kullanim: kullanimOzeti(cfg.model, meter, cfg.billable) });
    }

    // OLAY ANALİZİ — avukat olayı anlatır; AI hukuki değerlendirme + çözüm yazar ve
    // olaya uygun GERÇEK içtihatı bulup getirir (kelime araması değil, akıl yürütme).
    if (action === 'analyze') {
      const olay = (body.olay ?? '').trim();
      if (olay.length < 15) return json({ error: 'bad_request' }, 400);

      // KVKK KAPISI — analiz, avukatın yazdığı OLAY ANLATIMINI yurt dışındaki
      // modele gönderir. Bu, uygulamadaki en hassas metinlerden biri: içinde
      // müvekkil bilgisi bulunması olağandır.
      const rizaRed = await rizaKapisi(supabase, CORS);
      if (rizaRed) return rizaRed;

      // Üyelik katmanı + maliyet tavanı kontrolü (batma koruması).
      // profiles PII sertleştirmesiyle authenticated'a SELECT kapalı; tier'ı
      // SERVİS anahtarıyla (RLS bypass) oku, yoksa herkes "baslangic"e düşer.
      let prof: { is_premium?: boolean; ai_tier?: string } | null = null;
      {
        const s = svc();
        if (s) {
          const r = await s.from('profiles').select('is_premium, ai_tier').eq('id', userData.user.id).maybeSingle();
          prof = r.data as { is_premium?: boolean; ai_tier?: string } | null;
        }
      }
      const { tier, cfg } = tierConfig(prof?.ai_tier, !!prof?.is_premium);
      const row = await usageRow(userData.user.id);
      if (overLimit(cfg, row)) return json({ error: 'quota_exceeded', tier, used: row.cost, calls: row.calls, ceiling: cfg.limit, limitKind: cfg.limitKind }, 402);
      // GÜNLÜK ADİL KULLANIM. Ortak Groq kotası tüm kullanıcılar için tek havuz;
      // bu uç sayacı hiç okumuyordu, yani içtihat ekranından havuz sınırsızca
      // tüketilebiliyordu.
      if (cfg.gunluk && cfg.gunluk > 0) {
        const gun = await usageRow(userData.user.id, aiGun());
        if (gun.calls >= cfg.gunluk) {
          return json({ error: 'gunluk_hak_bitti', tier, gunlukHak: cfg.gunluk, kullanilan: gun.calls }, 429);
        }
      }
      const key = aiKey(cfg.provider);
      if (!key) return json({ error: 'not_configured' }, 503);
      const meter: Meter = { tin: 0, tout: 0 };
      // SORU HAKKI — analiz iki model çağrısı (plan + analiz) ama TEK soru
      // sayılır: kullanıcıya verilen söz "aylık N soru", "2N model çağrısı"
      // değil.
      const rez2 = await hakRezerve(cfg, tier, userData.user.id);
      if ('red' in rez2) return rez2.red;
      // Kota taştıysa her iki çağrı da ucuz modelle yapılır.
      const model = rez2.model;

      // HAK İADESİ TEK YERDE (bkz. _shared/hakIadesi.ts). Eskiden yalnız
      // FIRLATILAN hatada iade vardı; "uygun karar yok" ve "metin alınamadı"
      // yolları catch'e düşmeden `return` ediyordu ve rezerve edilen soru hakkı
      // geri verilmiyordu — oysa ekrandaki mesaj "hakkınızdan düşülmedi"
      // diyordu. Şimdi 2xx dışı her dönüş ve her fırlatılan hata iade eder.
      return await basarisizsaIadeEt(rezervasyonKaydi(cfg, userData.user.id), async () => {
        // 1) Olaydan arama terimleri üret.
        const plan = await geminiPlan(olay, cfg.provider, model, key, meter);
        // Modelin ürettiği terimde de kesme işareti UYAP aramasını öldürür.
        const queries = (plan.queries.length > 0 ? plan.queries : [olay.slice(0, 60)])
          .map((q) => kesmeTemizle(q))
          .filter(Boolean);

        // 2) Her terimle gerçek kararları topla (havuz + canlı), dedupe, sınırla.
        const seen = new Set<string>();
        const candidates: Hit[] = [];
        for (const q of queries) {
          if (candidates.length >= 8) break;
          try {
            const { data: ftsRows } = await supabase.rpc('search_ictihat_fts', { q, match_count: 4 });
            for (const r of ftsRows ?? []) {
              const h = rowToHit(r);
              if (h.id && !seen.has(h.id)) { seen.add(h.id); candidates.push(h); }
            }
          } catch { /* havuz yoksa geç */ }
          try {
            const live = await emsalSearch(q, 1, 5);
            for (const h of live.hits) {
              if (h.id && !seen.has(h.id) && candidates.length < 10) { seen.add(h.id); candidates.push(h); }
            }
          } catch { /* canlı ulaşılamazsa geç */ }
        }
        // Kaynak cevap verdi ama olaya uygun karar çıkmadı: yapay zekâ boş
        // dönmedi, 'empty' ("yapay zekâ boş cevap verdi") yanlış cümle olurdu.
        if (candidates.length === 0) return json({ error: 'karar_yok' }, 404);

        // 3) En fazla 6 kararın gerçek metnini çek (havuz önce), AI'a ver.
        const top = candidates.slice(0, 6);
        const ids = top.map((h) => h.id);
        // Servis istemcisiyle: kullanıcı JWT'si bu tabloyu okuyamaz (bkz. document).
        const arsivA = svc();
        const { data: corpusRows } = arsivA
          ? await arsivA.from('ictihat_kararlar').select('id,full_text').in('id', ids)
          : { data: null };
        // deno-lint-ignore no-explicit-any
        const corpusText = new Map<string, string>((corpusRows ?? []).map((r: any) => [String(r.id), String(r.full_text ?? '')]));

        const docs: Array<{ hit: Hit; text: string }> = [];
        for (const h of top) {
          let text = corpusText.get(h.id) ?? '';
          if (!text) {
            try { text = await emsalDocument(h.id); } catch { text = ''; }
          }
          if (text) docs.push({ hit: h, text });
        }
        // Adaylar var ama hiçbirinin metni alınamadı: kaynak sorunu.
        if (docs.length === 0) return json({ error: 'source_unreachable' }, 502);

        // 4) Olaya göre analiz + olaya uygun içtihat.
        const analysis = await geminiAnalyze(olay, plan.issue, docs, cfg.provider, model, key, meter);
        await recordUsage(userData.user.id, model, meter.tin, meter.tout, cfg.billable, 'ictihat-analiz');
        // Uygulamaya, analizde kullanılan kararları (dokunup okunabilsin diye) döndür.
        // 'model' ve 'kullanim' yanıtta: ölçüm, sonucun hangi modelden ve kaça
        // geldiğini bilsin (ai-chat ile aynı biçim; künye bunu toplar).
        return json({ analysis, issue: plan.issue, queries, hits: docs.map((d) => d.hit), tier, model, kullanim: kullanimOzeti(model, meter, cfg.billable) });
      }, iadeIslemleri());
    }

    return json({ error: 'bad_request' }, 400);
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'upstream';
    // 'ayrinti' varsa (Claude dalı, ağ hatası) onu taşı: "upstream" tek başına
    // teşhis ettirmiyor.
    const ayrinti = (e as Error & { ayrinti?: string })?.ayrinti;
    // 03.10.2026: 502'nin sebebi kayıtlarda görünmüyordu (yalnız "booted").
    console.error('ictihat 502:', msg, ayrinti ?? '');
    // Kod eşlemesi _shared/ictihatArama.ts > ucHataYaniti: yapay zekâ servisi
    // düşünce 'upstream'/'empty' döner (ekranda "UYAP yanıt vermiyor" değil);
    // 'source_unreachable' yalnız gerçekten kaynak (UYAP/Bedesten) hatalarında.
    // `detail` (sağlayıcı/ağ hata metni) kullanıcıya DÖNMEZ (10.10.2026): iç
    // ayrıntı sızdırır; sebep yukarıdaki console.error satırında, sunucu günlüğünde.
    const { status, govde } = ucHataYaniti(msg, ayrinti);
    const { detail: _ic, ...disaGiden } = govde;
    return json(disaGiden, status);
  }
});
