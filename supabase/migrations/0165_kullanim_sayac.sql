-- 03.10.2026 — KULLANIM SAYACI (satış planı: "nerede bırakıyorlar, göremiyoruz").
--
-- NEDEN. Reklam verildi, kayıt geldi, satış yok — ama kullanıcının hangi
-- ekranda bıraktığını gösteren HİÇBİR ölçüm yoktu. Bu göç, gün × olay ×
-- platform başına yalnız bir SAYAÇ tutar.
--
-- KİŞİSEL VERİ YOK — BİLEREK. Kullanıcı kimliği, cihaz kimliği, IP, metin
-- yok. Olay adı sabit bir biçimde ('ekran:/clients/:id' gibi; istemci kimlik
-- parçalarını ':id' yapar) ve sunucu biçime uymayanı reddeder. Bu yüzden kişi
-- bazlı "kim ne yaptı" sorusunun cevabı bu tabloda YOKTUR; yalnız toplam akış.
--
-- GÜN TÜRKİYE SAATİYLE. current_date sunucuda UTC'dir; 00:00–03:00 arası
-- açılışlar bir önceki güne yazılırdı ve yönetici ekranındaki "Bugün" yanlış
-- olurdu. Bu yüzden gün, Europe/Istanbul saatinden alınır.
--
-- ANON ÇAĞIRABİLİR — giriş/kayıt ekranları oturum açılmadan görülür ve huni
-- orada başlıyor. Kötüye kullanım sınırı: olay adı biçimi + platform listesi;
-- en kötü ihtimalle sayaç şişer, veri sızmaz.

create table if not exists public.kullanim_sayac (
  gun      date    not null default (now() at time zone 'Europe/Istanbul')::date,
  olay     text    not null,
  platform text    not null,
  adet     integer not null default 0,
  primary key (gun, olay, platform)
);

-- Politika YOK: yalnız security definer fonksiyonlar okur/yazar.
alter table public.kullanim_sayac enable row level security;
revoke all on public.kullanim_sayac from anon, authenticated;

create or replace function public.kullanim_kaydet(p_olay text, p_platform text)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
  if p_olay is null or p_olay !~ '^[a-z_]{2,20}:[a-z0-9_:/.-]{0,80}$' then
    return;
  end if;
  if p_platform is null or p_platform not in ('ios', 'android', 'web') then
    return;
  end if;
  insert into public.kullanim_sayac as k (gun, olay, platform, adet)
  values ((now() at time zone 'Europe/Istanbul')::date, p_olay, p_platform, 1)
  on conflict (gun, olay, platform) do update set adet = k.adet + 1;
end;
$function$;

create or replace function public.admin_kullanim_ozet(p_gun integer default 7)
returns json
language plpgsql
security definer
set search_path to 'public'
as $function$
declare sonuc json;
begin
  if not coalesce((select pr.is_admin from public.profiles pr where pr.id = auth.uid()), false) then
    raise exception 'not_admin';
  end if;
  select coalesce(json_agg(x order by x.adet desc), '[]'::json) into sonuc
  from (
    select olay, sum(adet)::integer as adet,
           sum(adet) filter (where platform = 'ios')::integer as ios,
           sum(adet) filter (where platform = 'android')::integer as android,
           sum(adet) filter (where platform = 'web')::integer as web
    from public.kullanim_sayac
    where gun > (now() at time zone 'Europe/Istanbul')::date - greatest(1, least(coalesce(p_gun, 7), 90))
    group by olay
    order by sum(adet) desc
    limit 60
  ) x;
  return sonuc;
end;
$function$;

revoke execute on function public.kullanim_kaydet(text, text) from public;
revoke execute on function public.admin_kullanim_ozet(integer) from public, anon;
grant execute on function public.kullanim_kaydet(text, text) to anon, authenticated;
grant execute on function public.admin_kullanim_ozet(integer) to authenticated;
