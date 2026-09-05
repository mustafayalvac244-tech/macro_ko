// AI SAĞLIK KONTROLÜ — hangi sağlayıcı ayakta?
//
// NEDEN VAR. Ücretli bir üründe en kötü senaryo, müşterinin bize haber
// vermesidir: "yapay zekâ çalışmıyor". Groq'un günlük token kotası bittiğinde
// asistan tamamen susuyordu ve bunu ancak kullanıcı fark ediyordu. Bu uç,
// sağlayıcıları tek tek yoklayıp durumlarını söyler; ai-chat'in yedeğe geçiş
// mantığı da aynı bilgiye dayanır.
//
// ANAHTAR ASLA DÖNMEZ. Yalnız "tanımlı mı" ve "yanıt verdi mi" bilgisi çıkar.
//
// Yetki: yalnız oturum açmış kullanıcı çağırabilir. Yoklama istekleri en küçük
// boyutta tutulur (birkaç token) ki sağlık kontrolünün kendisi kotayı yemesin.

import { createClient } from 'jsr:@supabase/supabase-js@2';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

type Durum = {
  saglayici: string;
  anahtar: boolean;
  calisiyor: boolean;
  http?: number;
  neden?: string;
  ms?: number;
  model?: string;
};

async function groqYokla(): Promise<Durum> {
  const key = Deno.env.get('GROQ_API_KEY') ?? '';
  const model = Deno.env.get('VEKIL_GROQ_MODEL') || 'openai/gpt-oss-120b';
  if (!key) return { saglayici: 'groq', anahtar: false, calisiyor: false, neden: 'anahtar yok' };
  const t0 = Date.now();
  try {
    const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
      body: JSON.stringify({
        model,
        messages: [{ role: 'user', content: 'ping' }],
        max_tokens: 1,
        temperature: 0,
      }),
    });
    const ms = Date.now() - t0;
    if (res.ok) return { saglayici: 'groq', anahtar: true, calisiyor: true, http: 200, ms };
    const govde = await res.text();
    // Günlük kota ile anlık yoğunluk aynı 429'u döner; ayırmak şart, çünkü
    // biri "yarın", diğeri "bir dakika sonra" demek.
    const gunluk = res.status === 429 && /per\s*day|tokens per day|daily/i.test(govde);
    return {
      saglayici: 'groq',
      anahtar: true,
      calisiyor: false,
      http: res.status,
      neden: gunluk ? 'günlük kota bitti' : res.status === 429 ? 'anlık yoğunluk' : 'hata',
      ms,
    };
  } catch {
    return { saglayici: 'groq', anahtar: true, calisiyor: false, neden: 'ağ hatası' };
  }
}

// ListModels'in döndürdüğü ad, o ANAHTARIN kullanabileceği model demek DEĞİL:
// Google bazı modelleri "yeni kullanıcılara kapalı" tutuyor ve bunlar listede
// görünüp çağrıda 404 veriyor. Bu yüzden adaylar tek tek denenir.
const GEMINI_ADAYLAR = [
  Deno.env.get('VEKIL_GEMINI_MODEL') || '',
  'gemini-flash-latest',
  'gemini-flash-lite-latest',
  'gemini-2.5-flash-lite',
  'gemini-3-flash-preview',
  'gemini-3.1-flash-lite',
  'gemini-2.5-flash',
].filter(Boolean);

async function geminiTekModel(key: string, model: string): Promise<Durum> {
  const t0 = Date.now();
  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ role: 'user', parts: [{ text: 'ping' }] }],
          generationConfig: { maxOutputTokens: 1, temperature: 0 },
        }),
      }
    );
    const ms = Date.now() - t0;
    if (res.ok) return { saglayici: 'gemini', anahtar: true, calisiyor: true, http: 200, ms, model };
    const govde = await res.text();
    return {
      saglayici: 'gemini',
      anahtar: true,
      calisiyor: false,
      http: res.status,
      // Google'ın 429'u genelde "kota yok / faturalandırma kapalı" demektir.
      neden: res.status === 429 ? 'kota/faturalandırma' : govde.slice(0, 90),
      ms,
      model,
    };
  } catch {
    return { saglayici: 'gemini', anahtar: true, calisiyor: false, neden: 'ağ hatası', model };
  }
}

async function geminiYokla(): Promise<Durum & { denenen?: Durum[] }> {
  const key = Deno.env.get('GEMINI_API_KEY') ?? '';
  if (!key) return { saglayici: 'gemini', anahtar: false, calisiyor: false, neden: 'anahtar yok' };
  const denenen: Durum[] = [];
  for (const m of GEMINI_ADAYLAR) {
    const d = await geminiTekModel(key, m);
    denenen.push(d);
    if (d.calisiyor) return { ...d, denenen };
  }
  return { ...denenen[denenen.length - 1], denenen };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'method' }), { status: 405, headers: CORS });
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_ANON_KEY')!,
    { global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } } }
  );
  const { data: u, error } = await supabase.auth.getUser();
  if (error || !u.user) {
    return new Response(JSON.stringify({ error: 'unauthorized' }), { status: 401, headers: CORS });
  }

  const [groq, gemini] = await Promise.all([groqYokla(), geminiYokla()]);

  // Tanılama: Google zaman zaman model adlarını emekliye ayırıyor ve bu, geçerli
  // bir anahtarla bile 404 verir. Kullanılabilir model adlarını da bildirelim ki
  // "anahtar bozuk" ile "model adı eskimiş" karışmasın.
  let modeller: string[] = [];
  if (gemini.anahtar && !gemini.calisiyor) {
    try {
      const r = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models?key=${Deno.env.get('GEMINI_API_KEY')}`
      );
      if (r.ok) {
        const d = await r.json();
        modeller = (d.models ?? [])
          .filter((m: { supportedGenerationMethods?: string[] }) =>
            (m.supportedGenerationMethods ?? []).includes('generateContent'))
          .map((m: { name?: string }) => String(m.name ?? '').replace('models/', ''))
          .slice(0, 40);
      }
    } catch { /* tanılama başarısız olursa sağlık raporu yine dönsün */ }
  }
  // YOKLAMA TEK BAŞINA YETMEZ. 1 token'lık istek, GÜNLÜK TOKEN tavanı (TPD)
  // dolmuşken bile geçebiliyor; ölçümde tam bu yaşandı: rapor "ayakta,
  // yedekli" derken gerçek dilekçe isteği 429 daily_quota alıyordu. Yalan
  // söyleyen bir sağlık kontrolü, hiç olmamasından kötüdür. Bu yüzden gerçek
  // çağrıların sonucu da okunur ve rapora eklenir.
  let gercek: Array<Record<string, unknown>> = [];
  try {
    const { data } = await supabase.from('ai_saglayici_durum').select('*');
    gercek = (data ?? []) as Array<Record<string, unknown>>;
  } catch { /* durum tablosu okunamazsa yoklama sonucu yine verilir */ }

  const sonGercek = (ad: string) => gercek.find((g) => g.saglayici === ad);
  const gercektenCalisiyor = (d: Durum) => {
    const g = sonGercek(d.saglayici);
    if (!g) return d.calisiyor;                       // gerçek veri yoksa yoklamaya güven
    if (g.son_sonuc === 'ok') return d.calisiyor;
    // Son gerçek çağrı kota/yoğunluk hatası aldıysa, yoklama geçse bile bu
    // sağlayıcı hizmet veremiyor demektir.
    const taze = Date.now() - new Date(String(g.son_zaman)).getTime() < 60 * 60 * 1000;
    return taze ? false : d.calisiyor;
  };

  const ayakta = [groq, gemini].filter(gercektenCalisiyor).map((d) => d.saglayici);

  return new Response(
    JSON.stringify({
      ayakta,
      // Tek sağlayıcı ayaktaysa yedeksiz çalışıyoruz demektir; bu, kota
      // bittiğinde asistanın tamamen susacağı anlamına gelir.
      yedekli: ayakta.length >= 2,
      saglayicilar: [groq, gemini].map((d) => ({
        ...d,
        // Yoklama ile gerçek istek AYRI raporlanır; ikisini tek bayrakta
        // birleştirmek, hangisinin doğru olduğunu gizler.
        gercekSonSonuc: sonGercek(d.saglayici)?.son_sonuc ?? null,
        gercekSonZaman: sonGercek(d.saglayici)?.son_zaman ?? null,
        gercekSonBasari: sonGercek(d.saglayici)?.son_basari ?? null,
      })),
      gemini_modelleri: modeller,
    }),
    { headers: { ...CORS, 'Content-Type': 'application/json' } }
  );
});
