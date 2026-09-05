import { useCallback, useEffect, useRef, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '@/lib/supabase';
import { useT } from '@/i18n';

/** Bir sohbet balonu. `model` = AI yanıtı, `user` = avukatın sorusu. */
export interface AiMessage {
  id: string;
  role: 'user' | 'model';
  text: string;
}

/** Kenarda saklanan bir sohbet. Cihazda (AsyncStorage) tutulur. */
export interface AiConversation {
  id: string;
  title: string;
  messages: AiMessage[];
  updatedAt: number;
}

type AiError = 'rate_limit' | 'daily_quota' | 'quota_exceeded' | 'generic';

const STORE_KEY = 'vekil.ai.conversations.v2';
const MAX_CONVERSATIONS = 40;

let seq = 0;
const nextId = () => `m${Date.now()}_${seq++}`;
const newConvId = () => `c${Date.now()}_${seq++}`;

/** İlk kullanıcı mesajından kısa bir başlık türetir. */
function deriveTitle(messages: AiMessage[]): string {
  const first = messages.find((m) => m.role === 'user')?.text?.trim();
  if (!first) return '';
  const oneLine = first.replace(/\s+/g, ' ');
  return oneLine.length > 48 ? oneLine.slice(0, 47).trimEnd() + '…' : oneLine;
}

/**
 * Vekil AI sohbeti. Anahtarsız mimari: uygulama hiçbir API anahtarı tutmaz;
 * `ai-chat` Edge Function'ı kullanıcının JWT'siyle çağrılır, model anahtarı
 * sunucuda (Supabase secret) durur. Müşteriden anahtar istenmez.
 *
 * Sohbetler cihazda saklanır: uygulama kapanıp açılsa da geçmiş kaybolmaz,
 * kullanıcı eski sohbetlere dönebilir.
 */
export function useAiChat() {
  const t = useT();
  const [messages, setMessages] = useState<AiMessage[]>([]);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<AiError | null>(null);
  /** Sağlayıcının bildirdiği yeniden deneme süresi (saniye). */
  const [yeniden, setYeniden] = useState<number | null>(null);
  // Sunucunun bildirdiği aktif AI katmanı (üyeliğe göre): basic | plus.
  const [tier, setTier] = useState<'basic' | 'plus' | null>(null);

  // Kenarda saklanan tüm sohbetler ve o an açık olanın kimliği.
  const [conversations, setConversations] = useState<AiConversation[]>([]);
  const [activeId, setActiveId] = useState<string>(() => newConvId());
  const [loaded, setLoaded] = useState(false);

  // Yarışı önlemek için gönderim sırasında en güncel geçmişi ref'te tutuyoruz.
  const historyRef = useRef<AiMessage[]>([]);
  const activeIdRef = useRef<string>(activeId);
  activeIdRef.current = activeId;

  // Açılışta cihazdan sohbetleri yükle.
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(STORE_KEY);
        const list: AiConversation[] = raw ? JSON.parse(raw) : [];
        if (alive && Array.isArray(list)) setConversations(list);
      } catch {
        // bozuk/erişilemez depo: boş geçmişle devam
      } finally {
        if (alive) setLoaded(true);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  const persist = useCallback((list: AiConversation[]) => {
    AsyncStorage.setItem(STORE_KEY, JSON.stringify(list)).catch(() => {});
  }, []);

  /** Aktif sohbeti verilen mesajlarla listeye yazar (varsa günceller, yoksa ekler). */
  const upsertActive = useCallback(
    (msgs: AiMessage[]) => {
      if (msgs.length === 0) return;
      setConversations((prev) => {
        const id = activeIdRef.current;
        const conv: AiConversation = {
          id,
          title: deriveTitle(msgs) || t('ai.title'),
          messages: msgs,
          updatedAt: Date.now(),
        };
        const rest = prev.filter((c) => c.id !== id);
        const next = [conv, ...rest].slice(0, MAX_CONVERSATIONS);
        persist(next);
        return next;
      });
    },
    [persist, t]
  );

  const send = useCallback(
    async (raw: string) => {
      const text = raw.trim();
      if (!text || sending) return;

      setError(null);
      const userMsg: AiMessage = { id: nextId(), role: 'user', text };
      const history = [...historyRef.current, userMsg];
      historyRef.current = history;
      setMessages(history);
      // Soru sorulur sorulmaz kaydet; yanıt gelmese de mesaj kaybolmasın.
      upsertActive(history);
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
              // Sağlayıcı "kaç saniye sonra" diyorsa onu gösteririz: kota
              // KAYAN pencereyle yenileniyor, oysa mesajımız "yarın tekrar
              // deneyin" diyordu. Avukatı 23 dakika beklemesi gerekirken
              // ertesi güne yollamak, o gün için ürünü yok etmekti.
              if (typeof j?.yeniden === 'number' && j.yeniden > 0) setYeniden(j.yeniden);
            }
          } catch {
            // gövde okunamazsa genel hataya düşer
          }
          setError(
            code === 'rate_limit' || code === 'daily_quota' || code === 'quota_exceeded' ? code : 'generic'
          );
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
        upsertActive(withReply);
      } catch {
        setError('generic');
      } finally {
        setSending(false);
      }
    },
    [sending, upsertActive]
  );

  /** Yeni boş sohbet başlatır (mevcut sohbet zaten kenarda kayıtlı). */
  const newChat = useCallback(() => {
    historyRef.current = [];
    setMessages([]);
    setError(null);
    setActiveId(newConvId());
  }, []);

  /** Kenardaki bir sohbeti açar. */
  const openConversation = useCallback((id: string) => {
    setConversations((prev) => {
      const conv = prev.find((c) => c.id === id);
      if (conv) {
        historyRef.current = conv.messages;
        setMessages(conv.messages);
        setError(null);
        setActiveId(conv.id);
      }
      return prev;
    });
  }, []);

  /** Bir sohbeti geçmişten siler. Açık olan silinirse yeni boş sohbete geçer. */
  const deleteConversation = useCallback(
    (id: string) => {
      setConversations((prev) => {
        const next = prev.filter((c) => c.id !== id);
        persist(next);
        return next;
      });
      if (activeIdRef.current === id) {
        historyRef.current = [];
        setMessages([]);
        setError(null);
        setActiveId(newConvId());
      }
    },
    [persist]
  );

  // Geriye dönük uyumluluk: eski `reset` = yeni sohbet.
  const reset = newChat;

  const errorText =
    error === 'rate_limit'
      ? t('ai.errRateLimit')
      : error === 'daily_quota'
        ? yeniden && yeniden < 6 * 3600
          ? t('ai.errQuotaWait', { dk: String(Math.max(1, Math.ceil(yeniden / 60))) })
          : t('ai.errDailyQuota')
        : error === 'quota_exceeded'
          ? t('ai.errQuota')
          : error === 'generic'
            ? t('ai.errGeneric')
            : null;

  return {
    messages,
    sending,
    error,
    errorText,
    tier,
    send,
    reset,
    newChat,
    conversations,
    activeId,
    openConversation,
    deleteConversation,
    loaded,
  };
}
