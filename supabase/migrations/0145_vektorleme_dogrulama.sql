-- SALT OKUNUR ÖLÇÜM — hiçbir şey yazmaz.
-- 0144 uygulandı; "uygulandı" ile "çalışıyor" ayrı şeylerdir. Bu dosya
-- ikincisini ölçer: cron işleri gerçekten kuruldu mu, çağrılar 200 mü
-- dönüyor, embedding sayısı gerçekten artıyor mu.
--
-- Tek ifade — çok ifadeli dosyada yalnız SON ifade döner (skill kuralı).
select olcum, deger from (
  select 1 as sira, 'vektorle isi sayisi' as olcum,
         coalesce(count(*)::text, 'YOK (!)') as deger
    from cron.job where jobname like 'vekil_vektorle%'
  union all
  select 2, 'zamanlama',
         coalesce(string_agg(distinct schedule, ' | '), 'YOK (!)')
    from cron.job where jobname like 'vekil_vektorle%'
  union all
  select 3, 'hepsi aktif mi',
         coalesce(string_agg(distinct active::text, ','), 'YOK (!)')
    from cron.job where jobname like 'vekil_vektorle%'
  union all
  select 4, 'son 10 dk BASARILI cagri',
         coalesce(count(*)::text, 'YOK (!)')
    from net._http_response
    where created > now() - interval '10 minutes' and content like '%processed%'
  union all
  select 5, 'son 10 dk KAYNAK HATASI',
         coalesce(count(*)::text, 'YOK (!)')
    from net._http_response
    where created > now() - interval '10 minutes' and content like '%WORKER_RESOURCE_LIMIT%'
  union all
  select 6, 'ornek yanit govdesi',
         coalesce(left(max(content), 160), 'YANIT YOK (!)')
    from net._http_response
    where created > now() - interval '10 minutes' and content like '%processed%'
  union all
  select 7, 'embedding VAR',
         coalesce(count(*) filter (where embedding is not null)::text, 'YOK (!)')
    from public.ictihat_kararlar
  union all
  select 8, 'embedding YOK',
         coalesce(count(*) filter (where embedding is null)::text, 'YOK (!)')
    from public.ictihat_kararlar
  union all
  select 9, 'son 10 dk yazilan embedding',
         coalesce(count(*)::text, 'YOK (!)')
    from public.ictihat_kararlar
    where embedding is not null and updated_at > now() - interval '10 minutes'
  union all
  select 10, 'son 10 dk gelen yeni karar (hasat)',
         coalesce(count(*)::text, 'YOK (!)')
    from public.ictihat_kararlar
    where created_at > now() - interval '10 minutes'
) ozet order by sira;
