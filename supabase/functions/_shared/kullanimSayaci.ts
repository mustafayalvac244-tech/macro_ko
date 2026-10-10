// KULLANIM SAYACI — TEK DEYİMDE EKLEME (09.10.2026, göç 0191). Saf, testli.
// ---------------------------------------------------------------------------
// BULUNAN KUSUR (50 denetçi taraması, kodla doğrulandı). ai-chat'in
// recordUsage'ı ai_usage satırını ÖNCE okuyup SONRA "okunan + artış" yazıyordu
// (aylık ve günlük satır ayrı ayrı). Aynı kullanıcının iki isteği aynı anda
// biterse ikisi de aynı değeri okur, ikisi de aynı değeri yazar: bir isteğin
// çağrısı, token'ları ve maliyeti kaybolur. Yerel Postgres 16'da pgbench ile
// ölçüldü — bkz. göç 0191'in başı.
//
// NE ETKİLENİYORDU, NE ETKİLENMİYORDU. Soru/mütalaa/deneme HAKKI bundan
// etkilenmiyordu: o, istek başlamadan ai_mod_rezerve_et / deneme_hakki_rezerve_et
// ile satır kilidiyle ayrılıyor. Etkilenen ai_usage'dı: aylık maliyet güvenlik
// ağı (katman.ts > overLimit), Claude anahtarı yokken devreye giren günlük hak
// (gunluk), elle iade ve yönetici özetleri.
//
// ÇÖZÜM. insert ... on conflict do update set x = x + excluded.x — tek deyim;
// aynı satıra gelen ikinci yazımı Postgres kendisi sıraya koyar.
//
// GÖÇTEN ÖNCE DAĞITILIRSA. İşlev yoksa (PostgREST PGRST202, Postgres 42883)
// eski oku-yaz yoluna düşülür: sayaç yine artar, yalnız yarış penceresi o süre
// açık kalır. Dağıtım sırası bu yüzden önemsiz. Göç canlıya uygulandıktan sonra
// bu yol silinebilir.
//
// BAŞKA BİR HATADA ESKİ YOLA DÜŞÜLMEZ. Ağ kesintisinde ekleme sunucuda olmuş
// olabilir; ikinci kez yazmak çift sayım olurdu. Eski kod da yazma hatasını
// yutuyordu — davranış o açıdan aynı.

/** Bir isteğin bir sayaç satırına (aylık ya da günlük) eklediği. */
export interface KullanimArtisi {
  /** Hakka yazılan çağrı: kusurlu ya da yedek modelin cevabında 0. */
  calls: number;
  tokensIn: number;
  tokensOut: number;
  /** Bize mal olan TL (kullanıcıdan alınan ücret değil). */
  cost: number;
}

/**
 * supabase-js istemcisinin burada kullanılan yüzü. `from` yalnız göç öncesi
 * eski yolda kullanılır; zincir (select/eq/maybeSingle/upsert) supabase-js'inki.
 */
export interface SayacIstemcisi {
  rpc(fn: string, args: Record<string, unknown>): PromiseLike<{ error: { code?: string | null } | null }>;
  // deno-lint-ignore no-explicit-any
  from(tablo: string): any;
}

/** "Böyle bir işlev yok" — PostgREST şema önbelleği ve Postgres kodu. */
const ISLEV_YOK = new Set(['PGRST202', '42883']);

export async function kullanimEkle(s: SayacIstemcisi, userId: string, period: string, a: KullanimArtisi): Promise<void> {
  const { error } = await s.rpc('ai_usage_ekle', {
    p_user: userId,
    p_period: period,
    p_calls: a.calls,
    p_tokens_in: a.tokensIn,
    p_tokens_out: a.tokensOut,
    p_cost: a.cost,
  });
  if (!error || !ISLEV_YOK.has(String(error.code ?? ''))) return;

  // ESKİ YOL — yalnız göç 0191 canlıda yokken.
  const { data } = await s.from('ai_usage').select('calls,tokens_in,tokens_out,cost_try').eq('user_id', userId).eq('period', period).maybeSingle();
  const prev = data as { calls?: number; tokens_in?: number; tokens_out?: number; cost_try?: number } | null;
  await s.from('ai_usage').upsert({
    user_id: userId,
    period,
    calls: (prev?.calls ?? 0) + a.calls,
    tokens_in: (prev?.tokens_in ?? 0) + a.tokensIn,
    tokens_out: (prev?.tokens_out ?? 0) + a.tokensOut,
    cost_try: Number(prev?.cost_try ?? 0) + a.cost,
    updated_at: new Date().toISOString(),
  }, { onConflict: 'user_id,period' });
}
