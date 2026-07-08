// Vekil :: server-side AI proxy.
// The Gemini API key lives here as a secret — users never see or enter keys;
// signing in to Vekil is enough. Deploy with:
//   supabase functions deploy ai-chat
//   supabase secrets set GEMINI_API_KEY=...
import { createClient } from 'npm:@supabase/supabase-js@2';

const MODEL = 'gemini-2.0-flash';

const SYSTEM_PROMPT =
  'Sen Türk hukuku konusunda uzman, avukatlara yardımcı olan bir asistansın. ' +
  'Adın "Vekil AI". Kısa, net ve mesleki bir dille Türkçe yanıt ver. ' +
  'Mevzuat maddelerine atıf yaparken madde numaralarını belirt. ' +
  'Emin olmadığın konularda bunu açıkça söyle ve her yanıtın sonuna, verdiğin bilginin ' +
  'hukuki tavsiye olmadığını ve güncel mevzuattan teyit edilmesi gerektiğini kısaca hatırlat.';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: CORS });
  }
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'method' }), { status: 405, headers: CORS });
  }

  // Only signed-in Vekil users may use the assistant.
  const authHeader = req.headers.get('Authorization') ?? '';
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_ANON_KEY')!,
    { global: { headers: { Authorization: authHeader } } }
  );
  const { data: userData, error: userErr } = await supabase.auth.getUser();
  if (userErr || !userData.user) {
    return new Response(JSON.stringify({ error: 'unauthorized' }), { status: 401, headers: CORS });
  }

  const apiKey = Deno.env.get('GEMINI_API_KEY');
  if (!apiKey) {
    return new Response(JSON.stringify({ error: 'not_configured' }), { status: 503, headers: CORS });
  }

  let body: { messages?: Array<{ role: 'user' | 'model'; text: string }> };
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: 'bad_request' }), { status: 400, headers: CORS });
  }
  const messages = (body.messages ?? []).slice(-30);
  if (messages.length === 0) {
    return new Response(JSON.stringify({ error: 'bad_request' }), { status: 400, headers: CORS });
  }

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${apiKey}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
      contents: messages.map((m) => ({ role: m.role, parts: [{ text: m.text }] })),
      generationConfig: { temperature: 0.4, maxOutputTokens: 1024 },
    }),
  });

  if (!res.ok) {
    const status = res.status === 429 ? 429 : 502;
    return new Response(JSON.stringify({ error: res.status === 429 ? 'rate_limit' : 'upstream' }), {
      status,
      headers: CORS,
    });
  }

  const data = await res.json();
  const text =
    data.candidates?.[0]?.content?.parts?.map((p: { text?: string }) => p.text ?? '').join('') ?? '';
  if (!text) {
    return new Response(JSON.stringify({ error: 'empty' }), { status: 502, headers: CORS });
  }

  return new Response(JSON.stringify({ text: text.trim() }), {
    headers: { ...CORS, 'Content-Type': 'application/json' },
  });
});
