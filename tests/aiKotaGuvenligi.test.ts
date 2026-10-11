// AI KULLANIM SAYACI — TEK DEYİMDE ARTAR (09.10.2026, 50 denetçi bulgusu 8).
//
// 8) KULLANIM SAYACI OKU-YAZ İDİ. recordUsage ai_usage satırını okuyup
//    "okunan + 1" yazıyordu; aynı anda biten iki istekten birinin çağrısı,
//    token'ı ve maliyeti kayboluyordu. Artık tek deyimde ekleniyor (göç 0191).
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { kullanimEkle, type KullanimArtisi } from '../supabase/functions/_shared/kullanimSayaci';

const kod = readFileSync(join(__dirname, '..', 'supabase/functions/ai-chat/index.ts'), 'utf8');

describe('kullanım sayacı tek deyimde artar', () => {
  const govde = kod.slice(kod.indexOf('async function recordUsage('), kod.indexOf('const SYSTEM_PROMPT ='));

  it('recordUsage ai_usage satırını okuyup yeniden yazmıyor', () => {
    expect(govde).not.toMatch(/from\('ai_usage'\)/);
  });

  it('aylık ve günlük satır atomik eklemeyle yazılıyor', () => {
    expect(govde.match(/await kullanimEkle\(/g) ?? []).toHaveLength(2);
  });
});

// ── kullanimEkle'nin kendisi ────────────────────────────────────────────────

type Satir = { calls: number; tokens_in: number; tokens_out: number; cost_try: number };
const ARTIS: KullanimArtisi = { calls: 1, tokensIn: 100, tokensOut: 20, cost: 0.5 };
const bekle = () => new Promise((r) => setTimeout(r, 5));

/** Bellekte ai_usage. `islevVar` false ise RPC, PostgREST'in "işlev yok" hatasını döner. */
function sahteVeritabani(islevVar: boolean, rpcHataKodu?: string) {
  const tablo = new Map<string, Satir>();
  const anahtar = (u: string, p: string) => `${u}|${p}`;
  const istemci = {
    rpcCagri: 0,
    async rpc(fn: string, a: Record<string, unknown>) {
      istemci.rpcCagri++;
      if (rpcHataKodu) return { error: { code: rpcHataKodu } };
      if (!islevVar || fn !== 'ai_usage_ekle') return { error: { code: 'PGRST202' } };
      // Postgres'teki insert ... on conflict do update: okuma ve yazma TEK adım.
      const k = anahtar(String(a.p_user), String(a.p_period));
      const s = tablo.get(k) ?? { calls: 0, tokens_in: 0, tokens_out: 0, cost_try: 0 };
      tablo.set(k, {
        calls: s.calls + Number(a.p_calls),
        tokens_in: s.tokens_in + Number(a.p_tokens_in),
        tokens_out: s.tokens_out + Number(a.p_tokens_out),
        cost_try: s.cost_try + Number(a.p_cost),
      });
      await bekle();
      return { error: null };
    },
    from(_t: string) {
      const filtre: Record<string, string> = {};
      const sorgu = {
        select: () => sorgu,
        eq: (sutun: string, deger: string) => {
          filtre[sutun] = deger;
          return sorgu;
        },
        maybeSingle: async () => {
          const s = tablo.get(anahtar(filtre.user_id, filtre.period));
          await bekle(); // okuma ile yazma arasında ağ gidiş-dönüşü
          return { data: s ? { ...s } : null };
        },
        upsert: async (r: Record<string, unknown>) => {
          tablo.set(anahtar(String(r.user_id), String(r.period)), {
            calls: Number(r.calls),
            tokens_in: Number(r.tokens_in),
            tokens_out: Number(r.tokens_out),
            cost_try: Number(r.cost_try),
          });
          return { error: null };
        },
      };
      return sorgu;
    },
    satir: (u: string, p: string) => tablo.get(anahtar(u, p)),
  };
  return istemci;
}

describe('kullanimEkle', () => {
  it('eşzamanlı iki istek iki çağrı olarak sayılır', async () => {
    const db = sahteVeritabani(true);
    await Promise.all([kullanimEkle(db, 'u1', '2026-10', ARTIS), kullanimEkle(db, 'u1', '2026-10', ARTIS)]);
    expect(db.satir('u1', '2026-10')).toEqual({ calls: 2, tokens_in: 200, tokens_out: 40, cost_try: 1 });
  });

  it('kusurlu/yedek cevapta (calls 0) token ve maliyet yine yazılır, çağrı yazılmaz', async () => {
    const db = sahteVeritabani(true);
    await kullanimEkle(db, 'u1', '2026-10-09', { ...ARTIS, calls: 0 });
    expect(db.satir('u1', '2026-10-09')).toEqual({ calls: 0, tokens_in: 100, tokens_out: 20, cost_try: 0.5 });
  });

  // Kusurun kendisi: eski oku-yaz deseni (bugün yalnız göç öncesi yedek yol)
  // aynı anda biten iki istekten birini kaybediyor.
  it('eski oku-yaz deseni eşzamanlı iki istekte bir çağrı KAYBEDİYOR', async () => {
    const db = sahteVeritabani(false);
    await Promise.all([kullanimEkle(db, 'u4', '2026-10', ARTIS), kullanimEkle(db, 'u4', '2026-10', ARTIS)]);
    expect(db.satir('u4', '2026-10')?.calls).toBe(1);
  });

  it('göç 0191 canlıda yoksa (PGRST202) eski yola düşer: sayaç yine artar', async () => {
    const db = sahteVeritabani(false);
    await kullanimEkle(db, 'u2', '2026-10', ARTIS);
    await kullanimEkle(db, 'u2', '2026-10', ARTIS);
    expect(db.satir('u2', '2026-10')?.calls).toBe(2);
  });

  it('başka bir RPC hatasında eski yola DÜŞMEZ (çift sayım olmasın)', async () => {
    const db = sahteVeritabani(true, '08006');
    await kullanimEkle(db, 'u3', '2026-10', ARTIS);
    expect(db.rpcCagri).toBe(1);
    expect(db.satir('u3', '2026-10')).toBeUndefined();
  });
});
