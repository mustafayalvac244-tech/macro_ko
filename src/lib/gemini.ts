import * as SecureStore from 'expo-secure-store';

const KEY_NAME = 'vekil-gemini-key';
const MODEL = 'gemini-2.0-flash';

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
