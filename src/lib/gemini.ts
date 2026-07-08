import * as SecureStore from 'expo-secure-store';
import { supabase } from '@/lib/supabase';

const KEY_NAME = 'vekil-gemini-key';
const MODEL = 'gemini-2.0-flash';

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';
const ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '';

/**
 * Server-side AI: the `ai-chat` edge function keeps the key as a secret, so a
 * signed-in Vekil account is all a user needs. Availability is probed once
 * per app session (404/503 → not deployed yet → fall back to local key).
 */
let serverAiAvailable: boolean | null = null;

export async function checkServerAi(): Promise<boolean> {
  if (serverAiAvailable !== null) return serverAiAvailable;
  if (!SUPABASE_URL) return (serverAiAvailable = false);
  try {
    const res = await fetch(`${SUPABASE_URL}/functions/v1/ai-chat`, { method: 'OPTIONS' });
    serverAiAvailable = res.ok;
  } catch {
    serverAiAvailable = false;
  }
  return serverAiAvailable;
}

async function askServer(history: ChatMessage[]): Promise<string> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  const res = await fetch(`${SUPABASE_URL}/functions/v1/ai-chat`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: ANON_KEY,
      Authorization: `Bearer ${token ?? ANON_KEY}`,
    },
    body: JSON.stringify({ messages: history }),
  });
  if (!res.ok) {
    if (res.status === 404 || res.status === 503) {
      serverAiAvailable = false;
      throw new Error('SERVER_UNAVAILABLE');
    }
    if (res.status === 429) throw new Error('RATE_LIMIT');
    throw new Error(`HTTP_${res.status}`);
  }
  const payload = (await res.json()) as { text?: string };
  if (!payload.text) throw new Error('EMPTY_RESPONSE');
  return payload.text;
}

/**
 * Key baked into the build (eas.json / build env). When present, users never
 * see any setup screen — the assistant just works. The SecureStore key is a
 * developer fallback for builds without an embedded key.
 */
const BUILT_IN_KEY = (process.env.EXPO_PUBLIC_GEMINI_API_KEY ?? '').trim();
export const hasBuiltInKey = BUILT_IN_KEY.length > 10 && !BUILT_IN_KEY.includes('your-');

export async function getEffectiveGeminiKey(): Promise<string | null> {
  if (hasBuiltInKey) return BUILT_IN_KEY;
  return getGeminiKey();
}

export interface ChatMessage {
  role: 'user' | 'model';
  text: string;
}

export async function getGeminiKey(): Promise<string | null> {
  try {
    return await SecureStore.getItemAsync(KEY_NAME);
  } catch {
    return null;
  }
}

export async function setGeminiKey(key: string): Promise<void> {
  await SecureStore.setItemAsync(KEY_NAME, key.trim());
}

export async function clearGeminiKey(): Promise<void> {
  await SecureStore.deleteItemAsync(KEY_NAME).catch(() => {});
}

const SYSTEM_PROMPT =
  'Sen Türk hukuku konusunda uzman, avukatlara yardımcı olan bir asistansın. ' +
  'Adın "Vekil AI". Kısa, net ve mesleki bir dille Türkçe yanıt ver. ' +
  'Mevzuat maddelerine atıf yaparken madde numaralarını belirt. ' +
  'Emin olmadığın konularda bunu açıkça söyle ve her yanıtın sonuna, verdiğin bilginin ' +
  'hukuki tavsiye olmadığını ve güncel mevzuattan teyit edilmesi gerektiğini kısaca hatırlat.';

/**
 * Preferred entry point: server proxy first (membership-based, keyless),
 * then any embedded/local key as fallback.
 */
export async function askVekilAI(history: ChatMessage[]): Promise<string> {
  if (await checkServerAi()) {
    try {
      return await askServer(history);
    } catch (e) {
      if (!(e instanceof Error) || e.message !== 'SERVER_UNAVAILABLE') throw e;
      // fall through to local key
    }
  }
  const key = await getEffectiveGeminiKey();
  if (!key) throw new Error('NO_KEY');
  return askGemini(key, history);
}

/** Calls the Gemini generateContent API with chat history. Throws on failure. */
export async function askGemini(apiKey: string, history: ChatMessage[]): Promise<string> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${encodeURIComponent(apiKey)}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
      contents: history.map((m) => ({ role: m.role, parts: [{ text: m.text }] })),
      generationConfig: { temperature: 0.4, maxOutputTokens: 1024 },
    }),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    if (res.status === 400 && body.includes('API key')) throw new Error('INVALID_KEY');
    if (res.status === 403) throw new Error('INVALID_KEY');
    if (res.status === 429) throw new Error('RATE_LIMIT');
    throw new Error(`HTTP_${res.status}`);
  }
  const data = (await res.json()) as {
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
  };
  const text = data.candidates?.[0]?.content?.parts?.map((p) => p.text ?? '').join('') ?? '';
  if (!text) throw new Error('EMPTY_RESPONSE');
  return text.trim();
}
