-- 0191 — AI KULLANIM SAYACI TEK DEYİMDE ARTAR (09.10.2026).
--
-- BULUNAN KUSUR (50 denetçi taraması, kodla doğrulandı). ai-chat'in
-- recordUsage'ı ai_usage satırını ÖNCE okuyup (select) SONRA "okunan + artış"
-- yazıyordu (upsert) — aylık (YYYY-AA) ve günlük (YYYY-AA-GG) satırda ayrı
-- ayrı. Aynı kullanıcının iki isteği aynı anda biterse ikisi aynı değeri okur,
-- ikisi aynı değeri yazar: bir isteğin çağrısı, token'ı ve maliyeti kaybolur.
--
-- ÖLÇÜLDÜ (09.10.2026, yerel Postgres 16, bu göç + taklit şema, pgbench,
-- 2 istemci × 500 işlem, AYNI satır, art arda): eski desen (select, ardından
-- upsert) üç turda 557 / 523 / 510 çağrı yazdı — 1.000 olmalıydı; bu işlev
-- üç turda da 1.000 (token ve maliyet de tam). Bu bir ZORLAMA denemesidir:
-- mekanizmayı gösterir, canlıda ne sıklıkla kayıp olduğunu DEĞİL (o, aynı
-- kullanıcının iki isteğinin aynı anda bitmesine bağlı; ölçülmedi). Gerçek
-- Supabase değil — davranış Postgres'in kendisi.
--
-- NE ETKİLENİYORDU. Soru/mütalaa/deneme HAKKI değil: o, istek başlamadan
-- ai_mod_rezerve_et / deneme_hakki_rezerve_et (0074, 0077) ile satır kilidiyle
-- ayrılıyor. Kayıp ai_usage'daydı: aylık maliyet güvenlik ağı (overLimit),
-- Claude anahtarı yokken devreye giren günlük hak, yönetici özetleri.
--
-- ÇÖZÜM. insert ... on conflict do update set x = x + excluded.x — tek deyim.
-- Aynı satıra gelen ikinci yazımı Postgres satır kilidiyle sıraya koyar;
-- arada okunup geri yazılan bir değer yok.
--
-- UÇ İŞLEVİYLE SIRA ÖNEMSİZ. ai-chat (supabase/functions/_shared/
-- kullanimSayaci.ts) bu işlevi bulamazsa (PGRST202/42883) eski yola düşer;
-- göç önce de sonra da uygulanabilir.
--
-- YETKİ: yalnız service_role (para/kota işlevleri gibi, bkz. 0079). Postgres
-- yeni işleve EXECUTE'u varsayılan olarak PUBLIC'e verir; kaldırılmazsa her
-- oturumlu kullanıcı kendi sayacını geri sarabilirdi (eksi artışla).
create or replace function public.ai_usage_ekle(
  p_user uuid,
  p_period text,
  p_calls integer,
  p_tokens_in bigint,
  p_tokens_out bigint,
  p_cost numeric
)
returns void
language sql
security definer
set search_path = public
as $$
  insert into public.ai_usage as u (user_id, period, calls, tokens_in, tokens_out, cost_try, updated_at)
  values (p_user, p_period, coalesce(p_calls, 0), coalesce(p_tokens_in, 0), coalesce(p_tokens_out, 0), coalesce(p_cost, 0), now())
  on conflict (user_id, period) do update
    set calls = u.calls + excluded.calls,
        tokens_in = u.tokens_in + excluded.tokens_in,
        tokens_out = u.tokens_out + excluded.tokens_out,
        cost_try = u.cost_try + excluded.cost_try,
        updated_at = now();
$$;

revoke all on function public.ai_usage_ekle(uuid, text, integer, bigint, bigint, numeric) from public, anon, authenticated;
grant execute on function public.ai_usage_ekle(uuid, text, integer, bigint, bigint, numeric) to service_role;
