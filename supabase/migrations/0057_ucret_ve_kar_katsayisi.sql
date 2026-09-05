-- ÜCRET İLE MALİYETİ AYIR: kontörden düşen tutar, bize mal olan tutar değildir.
--
-- İŞ KURALI: her istekte bir birim sağlayıcıya (Claude) gider, iki birim kâr
-- kalır. Yani kullanıcıdan alınan ücret = maliyet × 3, marj %66,7.
--
-- NEDEN İKİ AYRI SÜTUN. Tek sütunla ("maliyet") çalışırsak iki soruyu birden
-- cevaplayamayız: "bu ay sağlayıcıya ne ödedik" ve "bu ay ne kazandık". İadede
-- de yanlış tutar geri verilir — kullanıcı 5,70 TL ödeyip 1,90 TL geri alırsa
-- iade, şikâyeti büyütmekten başka işe yaramaz.
--
-- maliyet_try : sağlayıcıya ödediğimiz (gider defteri)
-- ucret_try   : kullanıcının kontöründen düşen (satış)
-- Kâr = ucret_try - maliyet_try.

alter table public.ai_istek add column if not exists ucret_try numeric(12,4) not null default 0;

-- Geçmiş satırlarda ücret kaydı yoktu; maliyet neyse ücret de o sayılır
-- (katsayı yokken kontörden düşen tutar maliyetin kendisiydi).
update public.ai_istek set ucret_try = maliyet_try where ucret_try = 0 and maliyet_try > 0;

/**
 * İade: kullanıcıya ÖDEDİĞİ tutar geri verilir, bize mal olan değil.
 */
create or replace function public.ai_istek_iade(p_istek uuid, p_user uuid, p_sebep text default null)
returns jsonb
language plpgsql
security definer set search_path = public as $$
declare r public.ai_istek;
begin
  select * into r from public.ai_istek where id = p_istek and user_id = p_user;
  if not found then
    return jsonb_build_object('ok', false, 'neden', 'bulunamadi');
  end if;
  if r.iade_edildi then
    return jsonb_build_object('ok', false, 'neden', 'zaten_iade');
  end if;

  update public.ai_istek set iade_edildi = true, iade_sebep = left(coalesce(p_sebep, ''), 300) where id = p_istek;

  -- Müşteriye hiç yazılmamışsa (mekanik kusur) geri verilecek bir şey yok;
  -- iade yine kaydedilir, çünkü kalite göstergesi olarak değerlidir.
  if not r.musteriye_yazildi then
    return jsonb_build_object('ok', true, 'iade_try', 0, 'hak', 0);
  end if;

  update public.ai_usage
     set calls = greatest(0, calls - 1), updated_at = now()
   where user_id = p_user and period = r.gun;

  if r.ucret_try > 0 then
    update public.ai_kontor
       set bakiye_try = bakiye_try + r.ucret_try,
           toplam_harcanan_try = greatest(0, toplam_harcanan_try - r.ucret_try),
           guncellendi = now()
     where user_id = p_user;
  end if;

  return jsonb_build_object('ok', true, 'iade_try', r.ucret_try, 'hak', 1);
end;
$$;

grant execute on function public.ai_istek_iade(uuid, uuid, text) to service_role;

-- Operasyon görünürlüğü: ay bazında gider, satış ve kâr.
create or replace view public.ai_kar_ozeti as
  select
    left(gun, 7) as ay,
    count(*) filter (where not iade_edildi) as istek,
    -- coalesce: hiç faturalı istek yoksa sütun boş değil SIFIR görünsün;
    -- boş bir rapor "veri yok" ile "kazanç yok"u karıştırır.
    coalesce(round(sum(maliyet_try) filter (where not iade_edildi), 2), 0) as gider_try,
    coalesce(round(sum(ucret_try) filter (where not iade_edildi), 2), 0) as satis_try,
    coalesce(round(sum(ucret_try - maliyet_try) filter (where not iade_edildi), 2), 0) as kar_try,
    count(*) filter (where iade_edildi) as iade_sayisi
  from public.ai_istek
  group by 1
  order by 1 desc;
