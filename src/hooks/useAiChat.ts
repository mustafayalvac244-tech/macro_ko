import { useCallback, useRef, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useT } from '@/i18n';

/** Bir sohbet balonu. `model` = Gemini yanıtı, `user` = avukatın sorusu. */
export interface AiMessage {
  id: string;
  role: 'user' | 'model';
  text: string;
}

type AiError = 'rate_limit' | 'generic';

let seq = 0;
const nextId = () => `m${Date.now()}_${seq++}`;

/**
 * Vekil AI sohbeti. Anahtarsız mimari: uygulama hiçbir API anahtarı tutmaz;
 * `ai-chat` Edge Function'ı kullanıcının JWT'siyle çağrılır, Gemini anahtarı
 * sunucuda (Supabase secret) durur. Müşteriden anahtar istenmez.
 */
export function useAiChat() {
  const t = useT();
  const [messages, setMessages] = useState<AiMessage[]>([]);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<AiError | null>(null);
  // Sunucunun bildirdiği aktif AI katmanı (üyeliğe göre): basic | plus.
  const [tier, setTier] = useState<'basic' | 'plus' | null>(null);
  // Yarışı önlemek için gönderim sırasında en güncel geçmişi ref'te tutuyoruz.
  const historyRef = useRef<AiMessage[]>([]);

  const send = useCallback(
    async (raw: string) => {
      const text = raw.trim();
      if (!text || sending) return;

      setError(null);
      const userMsg: AiMessage = { id: nextId(), role: 'user', text };
      const history = [...historyRef.current, userMsg];
      historyRef.current = history;
      setMessages(history);
      setSending(true);

      try {
        const { data, error: fnErr } = await supabase.functions.invoke('ai-chat', {
          body: { messages: history.map((m) => ({ role: m.role, text: m.text })) },
        });

        if (fnErr) {
          // functions.invoke, non-2xx yanıtta FunctionsHttpError fırlatır;
          // gövdeyi okuyup kota hatasını ayırt etmeye çalışıyoruz.
          let code = '';
          try {
            const ctx = (fnErr as { context?: Response }).context;
            if (ctx && typeof ctx.json === 'function') {
              const j = await ctx.json();
              code = j?.error ?? '';
            }
          } catch {
            // gövde okunamazsa genel hataya düşer
          }
          setError(code === 'rate_limit' ? 'rate_limit' : 'generic');
          return;
        }

        const payload = data as { text?: string; tier?: 'basic' | 'plus' } | null;
        const reply = payload?.text?.trim();
        if (!reply) {
          setError('generic');
          return;
        }
        if (payload?.tier) setTier(payload.tier);

        const modelMsg: AiMessage = { id: nextId(), role: 'model', text: reply };
        const withReply = [...historyRef.current, modelMsg];
        historyRef.current = withReply;
        setMessages(withReply);
      } catch {
        setError('generic');
      } finally {
        setSending(false);
      }
    },
    [sending]
  );

  const reset = useCallback(() => {
    historyRef.current = [];
    setMessages([]);
    setError(null);
  }, []);

  const errorText = error === 'rate_limit' ? t('ai.errRateLimit') : error === 'generic' ? t('ai.errGeneric') : null;

  return { messages, sending, error, errorText, tier, send, reset };
}
