-- İÇTİHAT ATIF HARİTASI — hangi karar hangi maddeyi uyguluyor?
--
-- FİKİR: havuzdaki 4.000+ karar şu ana kadar AI için yalnızca METİN YIĞINIYDI;
-- benzerlik araması onları buluyordu ama "bu karar hangi maddeyi uyguluyor"
-- bilgisi hiçbir yerde yoktu. Oysa avukatın asıl sorusu çoğu zaman budur:
-- "TBK m.315'i uygulayan kararlar neler?"
--
-- Kararlar bu bilgiyi zaten metinlerinde taşıyor: "İİK'nin 275. maddesi",
-- "HUMK'nun 428.maddesi", "6098 sayılı Kanun'un 315. maddesi". Ölçüldü:
-- 4.058 kararın 1.782'sinde (%44) tanınabilir atıf var; toplam 5.389 atıf
-- çıkarılabiliyor ve çıkarım 3 saniye sürüyor. Yani yeni bir veri kaynağına,
-- AI çağrısına veya paraya gerek yok — bilgi zaten elimizde, yapılandırılmamış.
--
-- NE KAZANDIRIR:
--  1) AI beslemesi: bir maddeyi anlatırken o maddeyi UYGULAYAN gerçek kararlar
--     gösterilebilir (benzer metinli kararlar değil).
--  2) Kapsam ölçümü: hangi maddede hiç karar yok? Hasat oraya yönlendirilebilir.
--  3) İçerik boşluğunun ölçüsü: İİK'ya 937 atıf var ama İİK METNİ havuzda YOK.
--     Bu, "İİK eksik" demenin sayısal karşılığı.
--
-- MÜLGA KANUNLAR AYRI TUTULUR: HUMK (386 atıf), BK (146), MK (38) yürürlükten
-- kalkmış kanunlardır. "HUMK m.428" ile "HMK m.428" AYNI ŞEY DEĞİLDİR; eski
-- atıfı yürürlükteki kanuna eşlemek, avukata yanlış madde göstermek olur.
-- Bu yüzden kısaltma OLDUĞU GİBİ saklanır ve mülga olanlar işaretlenir.

create table if not exists public.ictihat_atif (
  karar_id text not null references public.ictihat_kararlar(id) on delete cascade,
  kanun text not null,
  madde_no integer not null,
  primary key (karar_id, kanun, madde_no)
);

create index if not exists ictihat_atif_madde_idx on public.ictihat_atif (kanun, madde_no);
create index if not exists ictihat_atif_karar_idx on public.ictihat_atif (karar_id);

alter table public.ictihat_atif enable row level security;
drop policy if exists ictihat_atif_read on public.ictihat_atif;
create policy ictihat_atif_read on public.ictihat_atif for select to authenticated using (true);

/**
 * Karar metninden madde atıflarını çıkarır.
 *
 * Desen, gerçek karar metinlerinden türetildi; Türkçe kararlar kısaltmayı
 * çekim ekiyle yazıyor ("İİK'nin", "TCK.nun", "HMK'nın") ve madde numarasıyla
 * "madde" kelimesi arasına nokta/boşluk/sıra eki girebiliyor.
 *
 * Sınır: yalnız KISALTMALI atıflar yakalanır. "6098 sayılı Kanun'un 315.
 * maddesi" gibi numarayla yazılan atıflar bu desene girmez — kapsam %100
 * değildir ve öyle olduğu iddia edilmemektedir.
 */
create or replace function public.ictihat_atif_cikar(p_karar_id text)
returns integer
language plpgsql
security definer set search_path = public
as $$
declare
  eklenen integer := 0;
  metin text;
begin
  select full_text into metin from public.ictihat_kararlar where id = p_karar_id;
  if metin is null then return 0; end if;

  insert into public.ictihat_atif (karar_id, kanun, madde_no)
  select p_karar_id, kanun, madde_no
  from (
    select distinct
      -- Yazım farklarını tek biçime indir: IIK → İİK gibi.
      case upper(m[1])
        when 'IIK' then 'İİK'
        when 'IYUK' then 'İYUK'
        else upper(m[1])
      end kanun,
      (m[2])::integer madde_no
    from (
      select regexp_matches(
        metin,
        '(TBK|HMK|TCK|CMK|TMK|TTK|İİK|IIK|HUMK|İYUK|IYUK|MK|BK)[^0-9]{0,18}([0-9]{1,4})[^0-9]{0,4}madde',
        'gi') m
    ) t
    -- Madde numarası 0 veya absürt büyükse atıf değil, tarih/tutar olabilir.
    where (m[2])::integer between 1 and 1600
  ) z
  on conflict do nothing;

  get diagnostics eklenen = row_count;
  return eklenen;
end;
$$;

-- Yeni karar eklendiğinde atıfları kendiliğinden çıkar: hasat sürekli çalıştığı
-- için elle doldurma unutulursa harita eskir (aynı hata vektörlemede yaşandı).
create or replace function public.ictihat_atif_trg()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  perform public.ictihat_atif_cikar(new.id);
  return new;
end;
$$;

drop trigger if exists ictihat_atif_after_insert on public.ictihat_kararlar;
create trigger ictihat_atif_after_insert
  after insert on public.ictihat_kararlar
  for each row execute function public.ictihat_atif_trg();

/**
 * Bir maddeyi UYGULAYAN kararları getirir (metin benzerliğiyle değil, atıfla).
 * Yargıtay kararları önce: yerleşik içtihat, yerel karardan ağırdır.
 */
create or replace function public.kararlar_madde_ile(
  p_kanun text,
  p_madde integer,
  p_limit integer default 5
)
returns table(
  id text, kurul text, daire text, esas_no text, karar_no text,
  karar_tarihi text, snippet text
)
language sql stable security definer set search_path = public as $$
  select k.id, k.kurul, k.daire, k.esas_no, k.karar_no, k.karar_tarihi,
         left(k.full_text, 320)
  from public.ictihat_atif a
  join public.ictihat_kararlar k on k.id = a.karar_id
  where a.kanun = upper(p_kanun) and a.madde_no = p_madde
  order by case k.kurul when 'Yargıtay' then 0 when 'Danıştay' then 1
                        when 'BAM' then 2 when 'BİM' then 3 else 4 end,
           k.id
  limit greatest(1, least(20, p_limit));
$$;

grant execute on function public.kararlar_madde_ile(text, integer, integer) to authenticated, anon;
