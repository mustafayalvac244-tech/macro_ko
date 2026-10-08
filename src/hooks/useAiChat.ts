import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { sohbetleriOku, sohbetleriYaz } from '@/lib/sohbetDeposu';
import { gonderilecekGecmis } from '@/utils/sohbetGecmisi';
import { useAuthStore } from '@/store/authStore';
import { aiHataMetni } from '@/lib/aiHata';
import { useT } from '@/i18n';

/** Bir sohbet balonu. `model` = AI yanıtı, `user` = avukatın sorusu. */
export interface AiMessage {
  id: string;
  role: 'user' | 'model';
  text: string;
  /**
   * Sunucu asıl (ücretli) modele ulaşamayıp YEDEK modelle cevapladı.
   *
   * ÖLÇÜLEN ARIZA (2026-09-11): Anthropic kredisi bitince ai-chat sessizce
   * Gemini/Groq'a düştü ve 1.999₺ ödeyen üye bunu HİÇ görmedi — uygulama
   * yanıttaki `model` ve `yedekModel` alanlarını okumuyordu. Ücretli üyeye
   * zayıf modelin cevabını asıl modelinkiymiş gibi göstermek dürüst değil;
   * bu bayrak balonun altında küçük bir uyarı olarak görünür.
   */
  yedek?: boolean;
  /**
   * İki sağlayıcı da düştü; bu bir model cevabı DEĞİL, sorunun ilgili mevzuat
   * özeti. Eskiden `yedek` ile aynı uyarıyı alıyordu ("yedek modelle üretildi")
   * — model yokken model diyordu.
   */
  yapayZekasiz?: boolean;
  /** Cevabı hangi modelin yazdığı (sunucudan; teşhis ve şeffaflık için). */
  model?: string;
  /**
   * Cevaptaki içtihat atıflarının denetim özeti (bkz. AtifDenetimi).
   *
   * SOHBETTE DENETİM HİÇ YOKTU. Dilekçe, mütalaa ve belge incelemesi
   * denetleniyordu; "bu konuda emsal karar var mı" sorusu ise en çok buraya
   * soruluyor ve cevaptaki karar numarası doğrudan dilekçeye kopyalanıyor.
   * Korumayı en çok gerektiği yerde kapatmış olduk.
   */
  kararDenetimi?: { toplam: number; dogrulanan: Array<{ atif: string; daire?: string; tarih?: string; id?: string }>; havuzdaYok: string[]; olanaksiz: Array<{ atif: string; sebep: string }> };
  /** Metinde havuzda bulunmayan kanun maddesi atfı (bkz. ai.fakeArticles). */
  uydurmaMadde?: string[];
}

/** Kenarda saklanan bir sohbet. Cihazda (AsyncStorage) tutulur. */
export interface AiConversation {
  id: string;
  title: string;
  messages: AiMessage[];
  updatedAt: number;
}

// SUNUCUNUN GERÇEK HATA KODU (08.10.2026). Eskiden yalnız dört kod tanınıyor,
// gerisi 'generic'e çevriliyordu: deneme hakkı biten avukat sohbette
// "İnternet bağlantınızı kontrol edin" görüyor, hakkının bittiğini hiç
// öğrenmiyordu. Çeviri ortak yerde (src/lib/aiHata.ts > aiHataMetni).
// 'generic' yalnız sunucuya HİÇ ulaşılamadığında (ağ hatası) kullanılır.
type AiError = string;

// Depo anahtarı hesaba bağlı: bkz. src/lib/sohbetDeposu.ts.
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
  const userId = useAuthStore((s) => s.session?.user.id ?? null);
  const userIdRef = useRef<string | null>(userId);
  userIdRef.current = userId;
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

  // Açılışta (ve hesap değişince) cihazdan BU HESABIN sohbetlerini yükle.
  useEffect(() => {
    let alive = true;
    setConversations([]);
    setLoaded(false);
    if (!userId) return;
    (async () => {
      try {
        const raw = await sohbetleriOku(userId);
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
  }, [userId]);

  // Yükleme bitmeden yazmak, okunamayan eski geçmişin üstüne boş liste
  // yazmak demekti; `loaded` olmadan depoya dokunulmaz.
  const loadedRef = useRef(false);
  loadedRef.current = loaded;
  const persist = useCallback((list: AiConversation[]) => {
    const uid = userIdRef.current;
    if (!uid || !loadedRef.current) return;
    sohbetleriYaz(uid, JSON.stringify(list)).catch(() => {});
  }, []);

  /**
   * Sohbeti verilen mesajlarla listeye yazar (varsa günceller, yoksa ekler).
   * `id` verilmezse açık sohbet. Gönderim sırasında başka sohbete geçilirse
   * cevap, sorunun sorulduğu sohbete yazılsın diye kimlik açıkça verilir.
   */
  const upsertActive = useCallback(
    (msgs: AiMessage[], convId?: string) => {
      if (msgs.length === 0) return;
      setConversations((prev) => {
        const id = convId ?? activeIdRef.current;
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

  /**
   * Soruyu gönderir. Başarısız olursa `false` döner: ekran yazılan soruyu
   * kutuya geri koyar ve yanıtsız soru geçmişten çıkarılır (eskiden soru
   * kutudan siliniyor, geçmişte yanıtsız kalıyordu; yeniden yazılınca iki
   * 'user' mesajı art arda gidiyordu).
   */
  const send = useCallback(
    async (raw: string): Promise<boolean> => {
      const text = raw.trim();
      if (!text || sending) return true;

      setError(null);
      const userMsg: AiMessage = { id: nextId(), role: 'user', text };
      const onceki = historyRef.current;
      const history = [...onceki, userMsg];
      // Gönderim sırasında başka sohbete geçilebilir: cevap BU sohbete yazılır.
      const convId = activeIdRef.current;
      historyRef.current = history;
      setMessages(history);
      upsertActive(history, convId);
      setSending(true);

      const geriAl = () => {
        if (activeIdRef.current === convId) {
          historyRef.current = onceki;
          setMessages(onceki);
        }
        if (onceki.length) upsertActive(onceki, convId);
        else
          setConversations((prev) => {
            const next = prev.filter((c) => c.id !== convId);
            persist(next);
            return next;
          });
      };

      try {
        const { data, error: fnErr } = await supabase.functions.invoke('ai-chat', {
          body: { messages: gonderilecekGecmis(history).map((m) => ({ role: m.role, text: m.text })) },
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
          // Gövde okunamadıysa kod bilinmiyor ama sunucuya ULAŞILDI: bu bir
          // internet sorunu değil, 'generic' (bağlantı) mesajı yanlış olur.
          setError(code || 'tamamlanamadi');
          geriAl();
          return false;
        }

        const payload = data as {
          text?: string;
          tier?: 'basic' | 'plus';
          model?: string;
          /** Sunucu asıl modele ulaşamadı, yedekle cevapladı (bkz. AiMessage.yedek). */
          yedekModel?: boolean;
          /** İki sağlayıcı da düştü; bu bir model cevabı değil, mevzuat özeti. */
          yapayZekasiz?: boolean;
          kararDenetimi?: AiMessage['kararDenetimi'];
          uydurmaMadde?: string[];
        } | null;
        const reply = payload?.text?.trim();
        if (!reply) {
          setError('tamamlanamadi');
          geriAl();
          return false;
        }
        if (payload?.tier) setTier(payload.tier);

        const modelMsg: AiMessage = {
          id: nextId(),
          role: 'model',
          text: reply,
          yedek: payload?.yedekModel === true || undefined,
          yapayZekasiz: payload?.yapayZekasiz === true || undefined,
          model: payload?.model,
          kararDenetimi: payload?.kararDenetimi,
          uydurmaMadde: payload?.uydurmaMadde?.length ? payload.uydurmaMadde : undefined,
        };
        const withReply = [...history, modelMsg];
        if (activeIdRef.current === convId) {
          historyRef.current = withReply;
          setMessages(withReply);
        }
        upsertActive(withReply, convId);
        return true;
      } catch {
        setError('generic');
        geriAl();
        return false;
      } finally {
        setSending(false);
      }
    },
    [sending, upsertActive, persist]
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

  // Metin ORTAK yardımcıdan geliyor (src/lib/aiHata.ts). Burada ayrı yazıldığı
  // sürece bir yerde düzeltilen şey ötekinde eksik kalıyordu: "kaç dakika
  // sonra" bilgisi eklendiğinde bu dosyada daily_quota'ya konmuş, rate_limit
  // dalında unutulmuştu.
  const errorText = error ? aiHataMetni({ error, yeniden: yeniden ?? undefined }, t) : null;

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
