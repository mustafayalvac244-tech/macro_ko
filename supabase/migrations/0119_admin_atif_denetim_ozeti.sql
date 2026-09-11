-- ATIF DENETİMİ ÖZETİ, ADMİN EKRANINDA GÖRÜNSÜN.
--
-- NEDEN. 0118 denetim sonuçlarını sayı olarak kaydediyor ama okuma yetkisi
-- yalnız service_role'de: yani tablo YAZILIYOR, hiç OKUNMUYOR. Kimsenin
-- bakmadığı bir ölçüm, ölçüm değildir — birkaç hafta sonra "işe yarıyor mu"
-- sorusuna yine tahminle cevap verilirdi. Bu fonksiyon aynı özeti admin
-- ekranına açıyor.
--
-- YETKİ: admin_overview ile birebir aynı kalıp — SECURITY DEFINER + gövdede
-- is_admin kontrolü + `authenticated`e grant. Kontrolü gövdeye koymak şart:
-- fonksiyon DEFINER olduğu için yetki kontrolü olmadan her üye okuyabilirdi.
--
-- ORAN DEĞİL SAYI döner. Payda küçükken (ilk haftalarda birkaç yüz istek)
-- yüzde vermek olduğundan güçlü bir izlenim yaratır.

create or replace function public.admin_atif_denetimi(gun integer default 30)
returns table(
  mod text,
  istek_sayisi bigint,
  atif_sayisi bigint,
  dogrulanan bigint,
  havuzda_yok bigint,
  olanaksiz bigint,
  uydurma_madde bigint
)
language plpgsql
security definer set search_path = public as $$
begin
  if not coalesce((select is_admin from public.profiles where id = auth.uid()), false) then
    raise exception 'not_admin';
  end if;
  return query
    select k.mod,
           count(*)                 as istek_sayisi,
           coalesce(sum(k.toplam), 0)::bigint,
           coalesce(sum(k.dogrulanan), 0)::bigint,
           coalesce(sum(k.havuzda_yok), 0)::bigint,
           coalesce(sum(k.olanaksiz), 0)::bigint,
           coalesce(sum(k.uydurma_madde), 0)::bigint
    from public.atif_denetim_kaydi k
    where k.olusturuldu >= now() - make_interval(days => greatest(coalesce(gun, 30), 1))
    group by k.mod
    order by istek_sayisi desc;
end; $$;

comment on function public.admin_atif_denetimi(integer) is
  'Atıf denetiminin son N gündeki sonucu — admin ekranı için. Oran değil sayı döner.';

revoke all on function public.admin_atif_denetimi(integer) from public, anon;
grant execute on function public.admin_atif_denetimi(integer) to authenticated, service_role;
