-- ÜCRETSİZ YEDEK — KATMAN 1: veritabanı içi günlük anlık görüntü.
-- Supabase Free planda yedek/PITR yok. Bu mekanizma, en olası felakete karşı
-- korur: yanlış silme, hatalı güncelleme, bozuk migration, uygulama hatası.
-- (Projenin tamamen kaybı için Katman 2 = dışarı şifreli yedek gerekir.)
create extension if not exists pg_cron;
create schema if not exists backup;
revoke all on schema backup from anon, authenticated;

create table if not exists backup.snapshots (
  id bigint generated always as identity primary key,
  snap_at timestamptz not null default now(),
  tbl text not null,
  row_data jsonb not null
);
create index if not exists snapshots_tbl_at_idx on backup.snapshots (tbl, snap_at desc);
alter table backup.snapshots enable row level security;  -- API'ye asla açılmaz

-- Kullanıcı verisi olan tablolar (içtihat/mevzuat gibi yeniden üretilebilir
-- referans verisi hariç — yer kaplamasın).
create or replace function backup.take_snapshot()
returns integer language plpgsql security definer set search_path = public as $$
declare
  t text;
  n integer := 0;
  tables text[] := array[
    'profiles','clients','cases','hearings','deadlines','documents',
    'finance_entries','payments','payment_promises','case_expenses',
    'case_installments','client_advances','client_expenses',
    'enforcement_files','enforcement_collections','jobs','offices',
    'office_members','purchases','question_answers','feedback'
  ];
begin
  foreach t in array tables loop
    if to_regclass('public.'||t) is not null then
      execute format(
        'insert into backup.snapshots(tbl,row_data) select %L, to_jsonb(x) from public.%I x', t, t
      );
      n := n + 1;
    end if;
  end loop;
  -- 21 günden eski anlık görüntüleri temizle (Free plan disk sınırı için)
  delete from backup.snapshots where snap_at < now() - interval '21 days';
  return n;
end;
$$;

-- Bir tabloyu belirli bir anlık görüntüden geri yükleme yardımcısı.
-- Örn: select backup.restore_preview('cases');  -> hangi anlar mevcut
create or replace function backup.restore_preview(p_tbl text)
returns table(snap_at timestamptz, satir_sayisi bigint)
language sql stable security definer set search_path = public as $$
  select s.snap_at, count(*) from backup.snapshots s
  where s.tbl = p_tbl group by s.snap_at order by s.snap_at desc
$$;

-- Her gece 03:15 UTC (TR 06:15) otomatik yedek
select cron.unschedule('vekil_daily_backup') where exists (
  select 1 from cron.job where jobname = 'vekil_daily_backup'
);
select cron.schedule('vekil_daily_backup', '15 3 * * *', $$select backup.take_snapshot()$$);
