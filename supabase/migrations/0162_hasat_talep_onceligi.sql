-- 01.10.2026 — HASAT, SORULAN KONULARA YOĞUNLAŞSIN. Ürün sahibi: "verimli hasat
-- yap, sorulan soruları takip et, o konulara yoğunluk ver".
--
-- SORU METNİ SAKLANMAZ — BİLEREK. ai_istek metni hiç tutmuyor (müvekkil sırrı,
-- Av.K. m.36; aydınlatma metni metnin yalnız yanıt için gönderildiğini
-- söylüyor). Bu göç de tutmaz: hasat_talep_kaydet metni yalnız BELLEKTE,
-- hasat listesindeki (ictihat_harvest_state) SABİT konu adlarıyla eşleştirir
-- ve yalnız "konu / gün / kaynak / adet" sayacını artırır. Kişi bağı yok
-- (user_id yok), metin parçası yok — listede olmayan bir kelime hiçbir yere
-- yazılmaz. Bedeli: listede olmayan yeni bir konu sinyal üretmez.
--
-- NE DEĞİŞİR.
--  • Eşleşen konunun önceliği ANINDA en az 200'e çıkar (eskiden en fazla 160).
--  • hasat_sonraki_terim, önceliği 200+ olan ve son 1 saatte işlenmemiş konuyu
--    sıranın EN BAŞINA alır: emsal hasadı her 3 dakikada bir konu işliyor, yani
--    sorulan konu bitene kadar saatte bir sayfa daha derinleşir.
--  • hasat_onceligini_tazele (haftalık) son 30 günün talebini de sayar; talep
--    sönünce öncelik kendiliğinden eski düzeyine iner.
--
-- YÜK DEĞİŞMEZ. Hasat sıklığı ve paket boyu aynı; yalnız SIRA değişiyor
-- (bkz. once-dusun §1 — bu göç hiçbir sayıyı büyütmüyor).

create table if not exists public.hasat_konu_talep (
  terim  text not null,
  gun    date not null default current_date,
  kaynak text not null check (kaynak in ('arama', 'ai')),
  adet   integer not null default 0,
  primary key (terim, gun, kaynak)
);

-- Politika YOK — bilerek: yalnız security definer fonksiyonlar okur/yazar.
alter table public.hasat_konu_talep enable row level security;
revoke all on public.hasat_konu_talep from anon, authenticated;

-- Konu adının "çekirdeği": sondaki dava/davası/davaları sözcüğü atılır ki
-- "kira tespiti" araması "kira tespit davası" konusuyla eşleşsin.
create or replace function public.hasat_terim_cekirdek(p_terim text)
returns text
language sql
immutable
set search_path to 'public'
as $function$
  select trim(regexp_replace(public.tr_kucult(trim(p_terim)), '\s+(dava|davası|davasi|davaları|davalari)$', ''));
$function$;

create or replace function public.hasat_talep_kaydet(p_metin text, p_kaynak text)
returns integer
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_metin text := public.tr_kucult(left(coalesce(p_metin, ''), 2000));
  v_sayi  integer;
begin
  if p_kaynak not in ('arama', 'ai') or length(trim(v_metin)) < 3 then
    return 0;
  end if;

  with eslesen as (
    select h.terim
    from public.ictihat_harvest_state h
    where h.terim not like '%:%'
      and length(public.hasat_terim_cekirdek(h.terim)) >= 4
      and position(public.hasat_terim_cekirdek(h.terim) in v_metin) > 0
  ),
  sayac as (
    insert into public.hasat_konu_talep as t (terim, gun, kaynak, adet)
    select terim, current_date, p_kaynak, 1 from eslesen
    on conflict (terim, gun, kaynak) do update set adet = t.adet + 1
    returning t.terim
  )
  update public.ictihat_harvest_state h
  set oncelik = greatest(coalesce(h.oncelik, 100), 200)
  from sayac s
  where h.terim = s.terim;

  get diagnostics v_sayi = row_count;
  return v_sayi;
end;
$function$;

create or replace function public.hasat_onceligini_tazele()
returns integer
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  guncellenen integer;
begin
  with dava_konulari as (
    select public.tr_kucult(trim(case_type)) as konu, count(*)::numeric as adet
    from public.cases
    where case_type is not null
      and length(trim(case_type)) >= 4
      and public.tr_kucult(trim(case_type)) not in ('dava','dosya','diğer','diger','genel','hukuk','ceza dosyası')
    group by 1
  ),
  toplam as (select greatest(sum(adet), 1) as t from dava_konulari),
  talep as (
    select terim, sum(adet) as adet
    from public.hasat_konu_talep
    where gun > current_date - 30
    group by terim
  ),
  puanlar as (
    select
      h.terim,
      -- TAVANI EN DIŞTA UYGULA — least() içeride olursa eşleşme yokken NULL'ı
      -- yutar ve tavanı döndürür.
      100 + least(60, coalesce((
        select round(60 * sum(d.adet) / (select t from toplam))::integer
        from dava_konulari d
        where position(d.konu in public.tr_kucult(h.terim)) > 0
           or position(public.tr_kucult(h.terim) in d.konu) > 0
      ), 0))
      -- SORULAN KONU: son 30 günde en az bir talep → 200 eşiğinin üstü
      -- (hasat_sonraki_terim'de öne alınma eşiği); her ek talep +10, en çok 300.
      + coalesce((select least(300, 100 + 10 * (t.adet - 1))::integer from talep t where t.terim = h.terim), 0)
      as yeni_oncelik
    from public.ictihat_harvest_state h
  )
  update public.ictihat_harvest_state h
  set oncelik = greatest(1, p.yeni_oncelik)
  from puanlar p
  where h.terim = p.terim and h.oncelik is distinct from greatest(1, p.yeni_oncelik);

  get diagnostics guncellenen = row_count;
  return guncellenen;
end;
$function$;

create or replace function public.hasat_sonraki_terim(p_onek text default null)
returns table(terim text, next_page integer)
language sql
stable
security definer
set search_path to 'public'
as $function$
  select s.terim, s.next_page
  from public.ictihat_harvest_state s
  where case
          when p_onek is null or p_onek = '' then s.terim not like '%:%'
          else s.terim like p_onek || '%'
        end
    and (
      not coalesce(s.done, false)
      or s.last_run is null
      or s.last_run < now() - interval '7 days'
    )
  order by
    -- SORULAN KONU ÖNCE (0162): öncelik 200+ ve son 1 saatte işlenmemiş.
    (coalesce(s.oncelik, 0) >= 200 and coalesce(s.last_run < now() - interval '1 hour', true)) desc,
    (s.last_run is null) desc,
    coalesce(s.last_run < now() - interval '2 days', true) desc,
    s.oncelik desc nulls last,
    s.last_run asc nulls first
  limit 1;
$function$;

revoke execute on function public.hasat_talep_kaydet(text, text) from public, anon, authenticated;
grant execute on function public.hasat_talep_kaydet(text, text) to service_role;
