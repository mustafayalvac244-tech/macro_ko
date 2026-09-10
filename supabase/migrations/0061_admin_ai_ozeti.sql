-- YÖNETİCİ PANELİ İÇİN AI İŞ ÖZETİ.
--
-- NEDEN. Bu oturumda kontör, ücret/maliyet ayrımı, iade ve günlük adil kullanım
-- eklendi. Hiçbiri yönetici panelinde GÖRÜNMÜYOR. Görünmeyen bir iş modeli
-- yönetilemez: "bugün kaç istek geçti", "ne kazandık", "kaç iade geldi",
-- "hangi model cevaplıyor" sorularının cevabı olmadan ne fiyat ayarlanabilir
-- ne de kalite sorunu fark edilebilir.
--
-- İADE ORANI ÖZELLİKLE ÖNEMLİ. Ölçüm senaryolarını biz yazıyoruz — kendi
-- sınavımızı kendimiz hazırlıyoruz. İade ise gerçek dosyada işe yaramadığını
-- gören avukatın sözü. Hangi işte (dilekçe/mütalaa/belge) iade çok geliyorsa,
-- sıradaki düzeltme oradadır.
--
-- Yalnız yönetici çağırabilir; RPC her çağrıda is_admin doğrular.

create or replace function public.admin_ai_ozeti()
returns json
language plpgsql
security definer set search_path = public as $$
declare sonuc json;
begin
  if not coalesce((select is_admin from public.profiles where id = auth.uid()), false) then
    raise exception 'not_admin';
  end if;

  select json_build_object(
    -- BUGÜN: günlük dönem anahtarı YYYY-AA-GG biçiminde.
    'bugun_istek',   (select coalesce(sum(calls), 0) from public.ai_usage where period = to_char(now(), 'YYYY-MM-DD')),
    'bugun_token',   (select coalesce(sum(tokens_in + tokens_out), 0) from public.ai_usage where period = to_char(now(), 'YYYY-MM-DD')),
    -- Ücretsiz sağlayıcının günlük ortak tavanı; ne kadarını yaktığımızı görmek
    -- için ham sayı yeterli (tavan sağlayıcıda 200.000 token).
    'ay_istek',      (select coalesce(sum(calls), 0) from public.ai_usage where period = to_char(now(), 'YYYY-MM')),
    'ay_gider_try',  (select coalesce(round(sum(maliyet_try), 2), 0) from public.ai_istek
                        where not iade_edildi and gun >= to_char(date_trunc('month', now()), 'YYYY-MM-DD')),
    'ay_satis_try',  (select coalesce(round(sum(ucret_try), 2), 0) from public.ai_istek
                        where not iade_edildi and gun >= to_char(date_trunc('month', now()), 'YYYY-MM-DD')),
    'ay_kar_try',    (select coalesce(round(sum(ucret_try - maliyet_try), 2), 0) from public.ai_istek
                        where not iade_edildi and gun >= to_char(date_trunc('month', now()), 'YYYY-MM-DD')),
    'ay_iade',       (select count(*) from public.ai_istek
                        where iade_edildi and gun >= to_char(date_trunc('month', now()), 'YYYY-MM-DD')),
    'ay_toplam_istek', (select count(*) from public.ai_istek
                        where gun >= to_char(date_trunc('month', now()), 'YYYY-MM-DD')),
    -- İade oranı, kalitenin en dürüst göstergesi (bkz. başlıktaki not).
    'iade_orani',    (select case when count(*) = 0 then 0
                        else round(100.0 * count(*) filter (where iade_edildi) / count(*), 1) end
                        from public.ai_istek where gun >= to_char(date_trunc('month', now()), 'YYYY-MM-DD')),
    -- Hangi işte iade çok geliyor: sıradaki düzeltmenin adresi.
    'iade_dagilim',  (select coalesce(json_agg(x), '[]'::json) from (
                        select mod, count(*) filter (where iade_edildi) as iade, count(*) as toplam
                        from public.ai_istek
                        where gun >= to_char(date_trunc('month', now()), 'YYYY-MM-DD')
                        group by mod order by 2 desc
                      ) x),
    -- Yüklü toplam kontör: gelecekteki gelir değil, ÖDENMİŞ ve harcanmamış borç.
    'kontor_bakiye', (select coalesce(round(sum(bakiye_try), 2), 0) from public.ai_kontor),
    -- Son gerçek çağrılara hangi sağlayıcı/model cevap verdi.
    'saglayicilar',  (select coalesce(json_agg(json_build_object(
                        'saglayici', saglayici, 'sonuc', son_sonuc, 'model', son_model, 'zaman', son_zaman
                      ) order by saglayici), '[]'::json) from public.ai_saglayici_durum)
  ) into sonuc;
  return sonuc;
end;
$$;

grant execute on function public.admin_ai_ozeti() to authenticated;
